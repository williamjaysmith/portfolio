"use client";

import { useCallback, useRef, useState } from "react";

import type { ActionResult } from "@/lib/family/errors";

import { useFamily } from "./FamilyProvider";

/**
 * The ONE queue behind every board's commit path (004 T048's dedup): the
 * Tasks board's `useTaskResolve` and the Rewards tab's `useRedeem` are this
 * hook with their own verbs and keys on top, and nothing else about them
 * differs — the gate caught the two copies, and this is the extraction.
 *
 * Every write goes `withActor(run)` through Phase 1's shipped interceptor,
 * unchanged: it produces the punch-in **at the moment of the tap** when nobody
 * is punched in (FR-350, FR-424), retries once on a lapsed cookie, extends the
 * idle expiry on success and invalidates `familyKeys.all`, which is how every
 * board read refreshes. This hook adds no plumbing of its own.
 *
 * **Pessimistic, with no optimistic cache write anywhere** (FR-393, FR-441):
 * the tapped card shows busy for one round trip and then paints from the
 * refetch. Nothing is ever shown as stored that is not, nothing is queued
 * offline, and there is deliberately no `setQueryData` here and no reference
 * to the query client at all.
 *
 * **Writes are serialised, never dropped.** One person ticking off several
 * children's chores in a row is the wall tablet's ordinary evening: a commit
 * on a SECOND key while the first is writing waits its turn — one punch-in
 * sheet at a time, and the actor the first tap earned serves the second — and
 * shows busy while it waits. A second commit on the SAME key while it is
 * waiting or writing is the same tap twice, and is refused **synchronously**
 * (`null`), so a caller can count what it has queued at the moment of the tap
 * — FR-439's `inFlightLocal` reads exactly this.
 *
 * **`NO_ACTOR` is the one silence** in `notice`: it means the punch-in sheet
 * was dismissed, which is a decision rather than a failure, and the promise
 * of both boards is that the card is simply left as it was.
 */

export interface SerialisedWrites {
  /** Every key with a write waiting or in flight — a card shows busy from the tap until its own write settles. */
  busyKeys: ReadonlySet<string>;
  /** The last write's refusal, in the server's own words; null when there is none. */
  notice: string | null;
  clearNotice: () => void;
  /**
   * Queue one write under `key`. Answers `null` at once — nothing queued,
   * nothing written — when that key is already waiting or writing; otherwise
   * the write's own answer, once its turn has come and gone.
   */
  commit: <T>(key: string, run: () => Promise<ActionResult<T>>) => Promise<ActionResult<T>> | null;
}

/** What a refusal says on the board; a dismissed punch-in says nothing. */
function noticeOf(result: ActionResult<unknown>): string | null {
  if (result.ok) return null;
  return result.error === "NO_ACTOR" ? null : result.message;
}

const NO_KEYS: ReadonlySet<string> = new Set();

export function useSerialisedWrites(): SerialisedWrites {
  const { withActor } = useFamily();
  const [busyKeys, setBusyKeys] = useState<ReadonlySet<string>>(NO_KEYS);
  const [notice, setNotice] = useState<string | null>(null);
  // Refs, not `busyKeys`: two taps landing in one tick would both read the
  // same rendered state. `waiting` is every key with a write queued or in
  // flight; `chain` is the queue itself.
  const waiting = useRef(new Set<string>());
  const chain = useRef<Promise<unknown>>(Promise.resolve());

  const clearNotice = useCallback(() => setNotice(null), []);

  // The caller sees the write's fate — its answer, or its rejection — and the
  // key is freed either way.
  const settle = useCallback(
    async <T,>(key: string, turn: Promise<ActionResult<T>>): Promise<ActionResult<T>> => {
      try {
        const result = await turn;
        setNotice(noticeOf(result));
        return result;
      } finally {
        waiting.current.delete(key);
        setBusyKeys(waiting.current.size === 0 ? NO_KEYS : new Set(waiting.current));
      }
    },
    [],
  );

  const commit = useCallback(
    <T,>(key: string, run: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> | null => {
      if (waiting.current.has(key)) return null;
      waiting.current.add(key);
      setBusyKeys(new Set(waiting.current));
      const turn = chain.current.then(() => withActor(run));
      // The queue moves on whatever this write's fate; the caller still sees it.
      chain.current = turn.catch(() => undefined);
      return settle(key, turn);
    },
    [withActor, settle],
  );

  return { busyKeys, notice, clearNotice, commit };
}
