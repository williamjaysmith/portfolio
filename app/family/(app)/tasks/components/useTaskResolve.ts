"use client";

import { useCallback, useRef } from "react";

import {
  completeTaskOccurrence,
  skipTaskOccurrence,
  unresolveTaskOccurrence,
} from "@/lib/family/actions/tasks";
import type { ActionResult } from "@/lib/family/errors";
import type { BoardOccurrence, OccurrenceKey, OccurrenceState } from "@/lib/family/types";

import { useSerialisedWrites } from "../../components/useSerialisedWrites";
import { occurrenceKeyOf } from "./TaskCard";

/**
 * T044 / R323: the board's **one** commit path, and the only place a task
 * resolution is ever written from.
 *
 * The queue itself — `withActor` at the tap, busy from the tap until the write
 * settles, a second card waiting its turn, a second tap on the same card
 * ignored, `NO_ACTOR` silent — is `useSerialisedWrites`, shared with the
 * Rewards tab's `useRedeem` (004 T048). This file is the five verbs on top of
 * it, and one count the board reads at the tap.
 *
 * **Pessimistic, with no optimistic cache write anywhere** (FR-393): the tapped
 * circle shows a busy state for one sub-second round trip and then paints from
 * the refetch. Nothing is ever shown as done that is not stored, nothing is
 * queued offline, and the two things a hand-patched cache would get wrong — a
 * Completed Date chain's next occurrence and the streak counter — both move
 * server-side on the same write. There is deliberately no `setQueryData` here
 * and no reference to the query client at all.
 *
 * **`inFlightCompletions` is FR-439's `inFlightLocal`** (004 T048, SC-414):
 * how many of THIS device's completions for one Profile are still queued or
 * writing, counted from the moment the tap is accepted. The board judges
 * "does this completion finish the list?" at the tap, from the counters as
 * they stand (R408), and two quick taps on the last two outstanding cards
 * must fire once, on the second — the first is not yet in the counters, so it
 * is counted here instead. Only a completion shortens a list: a skip, an undo
 * and a claim (which joins a column's total and its count together) are never
 * counted.
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
  /**
   * FR-439's `inFlightLocal` (004 T048): this device's own completions for
   * `profileId` still queued or writing, read synchronously at the tap.
   */
  inFlightCompletions: (profileId: string) => number;
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
 * The Profile whose list this write shortens, or nobody. Only a plain
 * completion of an assigned occurrence does: an undo lengthens the list, a
 * skip leaves its total (FR-360), and a claim joins a column's total and its
 * count in the same write (FR-367), which is why `listCompletesWith` refuses
 * it too.
 */
function completesFor(intent: TaskResolveIntent): string | null {
  return intent.verb === "complete" ? intent.occurrence.assigneeId : null;
}

export function useTaskResolve(): TaskResolveState {
  const { busyKeys, notice, clearNotice, commit } = useSerialisedWrites();
  // Every accepted completion's key → the Profile it is for, from the tap
  // until its write settles. A ref, not state: it is read at the NEXT tap,
  // which may land in the same tick.
  const completing = useRef(new Map<string, string>());

  const inFlightCompletions = useCallback((profileId: string): number => {
    let count = 0;
    for (const one of completing.current.values()) if (one === profileId) count += 1;
    return count;
  }, []);

  const resolve = useCallback(
    async (intent: TaskResolveIntent): Promise<ResolveOutcome> => {
      const key = occurrenceKeyOf(intent.occurrence);
      const turn = commit(key, () => WRITES[intent.verb](intent));
      // The same tap twice: nothing was queued, so there is nothing to count.
      if (turn === null) return null;
      const profileId = completesFor(intent);
      if (profileId !== null) completing.current.set(key, profileId);
      try {
        return withoutData(await turn);
      } finally {
        completing.current.delete(key);
      }
    },
    [commit],
  );

  return { busyKeys, notice, clearNotice, resolve, inFlightCompletions };
}
