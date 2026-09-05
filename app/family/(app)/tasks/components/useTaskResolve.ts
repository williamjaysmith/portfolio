"use client";

import { useCallback, useRef, useState } from "react";

import {
  completeTaskOccurrence,
  skipTaskOccurrence,
  unresolveTaskOccurrence,
} from "@/lib/family/actions/tasks";
import type { ActionResult } from "@/lib/family/errors";
import type { BoardOccurrence, OccurrenceKey, OccurrenceState } from "@/lib/family/types";

import { useFamily } from "../../components/FamilyProvider";
import { occurrenceKeyOf } from "./TaskCard";

/**
 * T044 / R323: the board's **one** commit path, and the only place a task
 * resolution is ever written from.
 *
 * Every verb goes `withActor(() => action(payload))` through Phase 1's shipped
 * interceptor, unchanged: it produces the punch-in **at the moment of the tap**
 * when nobody is punched in (FR-350, US1-3), retries once on a lapsed cookie,
 * extends the idle expiry on success and invalidates `familyKeys.all`, which
 * is how all four board reads refresh. This hook adds no plumbing of its own —
 * that was the point of the interceptor.
 *
 * **Pessimistic, with no optimistic cache write anywhere** (FR-393): the tapped
 * circle shows a busy state for one sub-second round trip and then paints from
 * the refetch. Nothing is ever shown as done that is not stored, nothing is
 * queued offline, and the two things a hand-patched cache would get wrong — a
 * Completed Date chain's next occurrence and the streak counter — both move
 * server-side on the same write. There is deliberately no `setQueryData` here
 * and no reference to the query client at all.
 *
 * **The payload asserts nothing about identity** (FR-387): the acting Profile
 * comes from the signed punch-in cookie server-side. What travels is FR-353's
 * five-column occurrence key and, on a claim alone, the `creditProfileId` the
 * person chose in `ClaimDialog` — `occurrenceKeyFrom` exists so the drawn
 * occurrence's other fields (its summary, its state, the day it happens to be
 * drawn on) cannot leak into a `strictObject` payload that would refuse them
 * anyway.
 *
 * **One path, all five of FR-350's verbs** (T063), and three actions behind
 * them: FR-355's un-complete and FR-361's unskip are the same DELETE, and
 * FR-367's claim is a completion carrying a credit — the credit is the only
 * thing that makes it one, which is why it needs no action of its own. Nothing
 * else may write a resolution; a second commit path is never authored.
 */

/** FR-350's five resolution verbs, over three actions. */
export type ResolveVerb = "complete" | "claim" | "skip" | "uncomplete" | "unskip";

export interface TaskResolveIntent {
  occurrence: BoardOccurrence;
  /** What this tap means — `resolveVerbOf` reads it off the drawn state. */
  verb: ResolveVerb;
  /**
   * FR-367/FR-368: the Profile a CLAIM credits, chosen in `ClaimDialog`. Read
   * by the `claim` write and by no other, so an ordinary completion asserts
   * nobody even if a caller supplies one.
   */
  creditProfileId?: string;
}

/**
 * The action's answer with its data discarded — nothing reads a resolution
 * row, because the refetch paints — or `null` when no write was attempted at
 * all, which is a second tap on a card that is already waiting or writing.
 */
export type ResolveOutcome = ActionResult<null> | null;

export interface TaskResolveState {
  /**
   * `occurrenceKeyOf` of every occurrence with a write waiting or in flight
   * (FR-393) — a card shows busy from the tap until its own write settles.
   */
  busyKeys: ReadonlySet<string>;
  /** The refusal to show, in the server's own words (FR-351); null when there is none. */
  notice: string | null;
  clearNotice: () => void;
  resolve: (intent: TaskResolveIntent) => Promise<ResolveOutcome>;
}

/**
 * What a tap on the circle means in each drawn state — the same three actions
 * `CompleteCircle` already names, so the label and the write cannot disagree.
 *
 * `claim` and `skip` are NOT here, and deliberately: neither is a drawn state.
 * A claim is a completion the board diverts through `ClaimDialog` because it
 * needs a Profile named first (FR-367), and a skip is chosen from the details
 * sheet's own action list (FR-352, FR-359).
 */
const VERBS: Record<OccurrenceState, ResolveVerb> = {
  unresolved: "complete",
  complete: "uncomplete",
  skipped: "unskip",
};

export function resolveVerbOf(state: OccurrenceState): ResolveVerb {
  return VERBS[state];
}

/** FR-353's five columns, and nothing the client could assert with (R323). */
export function occurrenceKeyFrom(occurrence: BoardOccurrence): OccurrenceKey {
  return {
    taskId: occurrence.taskId,
    assigneeId: occurrence.assigneeId,
    occurrenceDate: occurrence.scheduledDate,
    slot: occurrence.slot,
    cyclePrev: occurrence.cyclePrev,
  };
}

type ResolveWrite = (intent: TaskResolveIntent) => Promise<ActionResult<unknown>>;

/** One row per verb, and the only place a resolution is written from. */
const WRITES: Record<ResolveVerb, ResolveWrite> = {
  complete: ({ occurrence }) =>
    completeTaskOccurrence({ occurrence: occurrenceKeyFrom(occurrence) }),
  // FR-367: the same action, plus the credit that makes it a claim. The server
  // refuses a credit-less claim and a credit on an assigned task (FR-368).
  claim: ({ occurrence, creditProfileId }) =>
    completeTaskOccurrence({ occurrence: occurrenceKeyFrom(occurrence), creditProfileId }),
  skip: ({ occurrence }) => skipTaskOccurrence({ occurrence: occurrenceKeyFrom(occurrence) }),
  uncomplete: ({ occurrence }) =>
    unresolveTaskOccurrence({ occurrence: occurrenceKeyFrom(occurrence) }),
  unskip: ({ occurrence }) =>
    unresolveTaskOccurrence({ occurrence: occurrenceKeyFrom(occurrence) }),
};

/** The row a completion returns is never read: the board repaints from the refetch. */
function withoutData(result: ActionResult<unknown>): ActionResult<null> {
  return result.ok ? { ok: true, data: null } : result;
}

/**
 * What a refusal says on the board. `NO_ACTOR` is the one silence: it means the
 * punch-in sheet was dismissed, which is a decision rather than a failure, and
 * FR-350's promise is that the card is simply left as it was.
 */
function noticeOf(result: ActionResult<null>): string | null {
  if (result.ok) return null;
  return result.error === "NO_ACTOR" ? null : result.message;
}

const NO_KEYS: ReadonlySet<string> = new Set();

export function useTaskResolve(): TaskResolveState {
  const { withActor } = useFamily();
  const [busyKeys, setBusyKeys] = useState<ReadonlySet<string>>(NO_KEYS);
  const [notice, setNotice] = useState<string | null>(null);
  // Refs, not `busyKeys`: two taps landing in one tick would both read the
  // same rendered state. `waiting` is every card with a write queued or in
  // flight; `chain` is the queue itself.
  const waiting = useRef(new Set<string>());
  const chain = useRef<Promise<unknown>>(Promise.resolve());

  const clearNotice = useCallback(() => setNotice(null), []);

  // Writes are serialised, never dropped. One person ticking off several
  // children's chores in a row is the wall tablet's ordinary evening: a tap on
  // a SECOND card while the first is writing waits its turn — one punch-in
  // sheet at a time, and the actor the first tap earned serves the second —
  // and shows busy while it waits. A second tap on the SAME card while it is
  // waiting or writing is the same tap twice, and is ignored.
  const resolve = useCallback(
    async (intent: TaskResolveIntent): Promise<ResolveOutcome> => {
      const key = occurrenceKeyOf(intent.occurrence);
      if (waiting.current.has(key)) return null;
      waiting.current.add(key);
      setBusyKeys(new Set(waiting.current));
      const turn = chain.current.then(() => withActor(() => WRITES[intent.verb](intent)));
      // The queue moves on whatever this write's fate; the caller still sees it.
      chain.current = turn.catch(() => undefined);
      try {
        const result = withoutData(await turn);
        setNotice(noticeOf(result));
        return result;
      } finally {
        waiting.current.delete(key);
        setBusyKeys(waiting.current.size === 0 ? NO_KEYS : new Set(waiting.current));
      }
    },
    [withActor],
  );

  return { busyKeys, notice, clearNotice, resolve };
}
