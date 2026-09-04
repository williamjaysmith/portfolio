"use client";

import { useCallback, useRef, useState } from "react";

import { completeTaskOccurrence, unresolveTaskOccurrence } from "@/lib/family/actions/tasks";
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
 * five-column occurrence key and, at T063, the claim's `creditProfileId` —
 * `occurrenceKeyFrom` exists so the drawn occurrence's other fields (its
 * summary, its state, the day it happens to be drawn on) cannot leak into a
 * `strictObject` payload that would refuse them anyway.
 *
 * **One path, shaped for FR-350's five verbs.** Three are wired here: complete,
 * un-complete and unskip — which are two writes, because FR-355's un-complete
 * and FR-361's unskip are the same DELETE and one action serves both. Skip and
 * claim need `skipTaskOccurrence` and a credited Profile, neither of which
 * exists until T063; they join by adding a row to `WRITES` and a verb to the
 * union, and no second commit path is ever authored.
 */

/** FR-350's resolution verbs. `skip` and `claim` join this union at T063. */
export type ResolveVerb = "complete" | "uncomplete" | "unskip";

export interface TaskResolveIntent {
  occurrence: BoardOccurrence;
  /** What this tap means — `resolveVerbOf` reads it off the drawn state. */
  verb: ResolveVerb;
}

/**
 * The action's answer with its data discarded — nothing reads a resolution
 * row, because the refetch paints — or `null` when no write was attempted at
 * all, which is a second tap arriving while one is still in flight.
 */
export type ResolveOutcome = ActionResult<null> | null;

export interface TaskResolveState {
  /** `occurrenceKeyOf` of the occurrence whose write is in flight (FR-393). */
  busyKey: string | null;
  /** The refusal to show, in the server's own words (FR-351); null when there is none. */
  notice: string | null;
  clearNotice: () => void;
  resolve: (intent: TaskResolveIntent) => Promise<ResolveOutcome>;
}

/**
 * What a tap on the circle means in each drawn state — the same three actions
 * `CompleteCircle` already names, so the label and the write cannot disagree.
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

/** One row per verb. T063 adds `skip` and `claim` here and nowhere else. */
const WRITES: Record<ResolveVerb, ResolveWrite> = {
  complete: ({ occurrence }) =>
    completeTaskOccurrence({ occurrence: occurrenceKeyFrom(occurrence) }),
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

export function useTaskResolve(): TaskResolveState {
  const { withActor } = useFamily();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // A ref, not `busyKey`: two taps landing in one tick would both read the
  // same rendered state, and `busyKey` can only describe one card at a time.
  const inFlight = useRef(false);

  const clearNotice = useCallback(() => setNotice(null), []);

  const resolve = useCallback(
    async (intent: TaskResolveIntent): Promise<ResolveOutcome> => {
      if (inFlight.current) return null;
      inFlight.current = true;
      setBusyKey(occurrenceKeyOf(intent.occurrence));
      try {
        const result = withoutData(await withActor(() => WRITES[intent.verb](intent)));
        setNotice(noticeOf(result));
        return result;
      } finally {
        inFlight.current = false;
        setBusyKey(null);
      }
    },
    [withActor],
  );

  return { busyKey, notice, clearNotice, resolve };
}
