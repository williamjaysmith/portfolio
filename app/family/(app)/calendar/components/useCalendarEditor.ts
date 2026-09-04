"use client";

import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

import { createEvent, deleteEvent, updateEvent } from "@/lib/family/actions/events";
import type { ActionResult } from "@/lib/family/errors";
import { familyKeys } from "@/lib/family/queries";
import type { Event, EventInput, Occurrence, Scope } from "@/lib/family/types";

import { useFamily, type FamilyContextValue } from "../../components/FamilyProvider";
import {
  isEmptyPatch,
  patchOf,
  rebasedOnSeries,
  touchesSeriesFields,
  type EditTarget,
} from "./event-drafts";
import type { EventFormSeed, SubmitOutcome } from "./useEventForm";

/**
 * The write surface's state machine (T050): which of the US2 surfaces is
 * open — create form, details, edit form, the scope question, the delete
 * confirmation — and the one commit path they all share.
 *
 * Every write goes `withActor(() => action(...))` (R208): Phase 1's
 * interceptor asks "Who's here?" at the moment of the write when nobody is
 * punched in (FR-248/270/275), retries once on a lapsed cookie, and sweeps
 * the query cache on success — which is how the grid redraws. Nothing here
 * writes to the cache itself: the form and the confirmation show a busy
 * state until the action answers, then the refetch draws the truth (FR-288).
 *
 * Order on a repeating event is fixed by FR-250: the scope question comes
 * FIRST, then the punch-in, then the action; dismissing either abandons the
 * pipeline with nothing written (FR-249). For an edit the question is asked
 * after the form is submitted — only then is it known whether the change
 * touches series-only fields, which removes "This event" (FR-287) — and the
 * form stays open underneath, so a cancelled question loses no typing. A
 * one-off never sees the question (FR-238).
 *
 * FR-288's second case: `NOT_FOUND` on a save or delete means another
 * device deleted the event first — every surface closes, nothing is
 * recreated, and the notice says so.
 *
 * Surface transitions and the two commits are plain functions (below); the
 * hook only sequences them.
 */

export const GONE_MESSAGE = "This event no longer exists.";

export type EditorSurface =
  | { kind: "closed" }
  | { kind: "create"; seed: EventFormSeed | undefined }
  | { kind: "details"; target: EditTarget }
  | { kind: "edit"; target: EditTarget; scopeQuestion: { seriesFieldsChanged: boolean } | null }
  | {
      kind: "delete";
      target: EditTarget;
      step: "scope" | "confirm";
      scope: Scope | null;
      pending: boolean;
    };

/** The delete surface alone — what the delete commit and its transitions take. */
type DeleteSurface = Extract<EditorSurface, { kind: "delete" }>;

export interface CalendarEditor {
  surface: EditorSurface;
  /** FR-288's messages and any refusal a dialog could not show itself. */
  notice: string | null;
  /** The create control (FR-254): a bare form, or one prefilled from a tapped slot (FR-255). */
  openCreate: (seed?: EventFormSeed) => void;
  /** A tapped block, bar or "+n more" row (FR-256). */
  openDetails: (occurrence: Occurrence) => void;
  close: () => void;
  /** Details → the edit form (FR-257). */
  edit: () => void;
  /** Details → the scope question (repeat) or straight to confirmation (one-off). */
  requestDelete: () => void;
  chooseScope: (scope: Scope) => void;
  cancelScope: () => void;
  confirmDelete: () => Promise<void>;
  /** The form's commit — create or update, through `withActor`. */
  submit: (input: EventInput) => Promise<SubmitOutcome>;
}

export interface UseCalendarEditorOptions {
  householdId: string;
  /** The anchored week on show — whose cached rows the tapped occurrences expand from. */
  weekStart: string;
  /** Household IANA zone (FR-284). */
  zone: string;
}

const CLOSED: EditorSurface = { kind: "closed" };

/** An edit that changed nothing has nothing to write and simply closes. */
const NOTHING_TO_SAVE: ActionResult<null> = { ok: true, data: null };

/* ------------------------------------------------------------------------- *
 * Transitions — pure, so each is one readable step.
 * ------------------------------------------------------------------------- */

function toEdit(current: EditorSurface): EditorSurface {
  if (current.kind !== "details") return current;
  return { kind: "edit", target: current.target, scopeQuestion: null };
}

/** FR-238: a one-off takes no scope, so no question exists to ask. */
function toDeleteRequest(current: EditorSurface): EditorSurface {
  if (current.kind !== "details") return current;
  const step = current.target.event.rrule === null ? "confirm" : "scope";
  return { kind: "delete", target: current.target, step, scope: null, pending: false };
}

function withScopeQuestion(current: EditorSurface, seriesFieldsChanged: boolean): EditorSurface {
  if (current.kind !== "edit") return current;
  return { ...current, scopeQuestion: { seriesFieldsChanged } };
}

function withScopeChosen(current: EditorSurface, scope: Scope): EditorSurface {
  if (current.kind === "delete") return { ...current, step: "confirm", scope };
  if (current.kind === "edit") return { ...current, scopeQuestion: null };
  return current;
}

/** FR-249: a dismissed question abandons the delete (the details stay) or leaves the form as it was. */
function withScopeDismissed(current: EditorSurface): EditorSurface {
  if (current.kind === "delete") return { kind: "details", target: current.target };
  if (current.kind === "edit") return { ...current, scopeQuestion: null };
  return current;
}

/** The row a tapped occurrence expands from, out of the week the grid rendered. */
function findEvent(
  queryClient: QueryClient,
  householdId: string,
  weekStart: string,
  occurrence: Occurrence,
): Event | undefined {
  const rows = queryClient.getQueryData<Event[]>(familyKeys.week(householdId, weekStart));
  return rows?.find((row) => row.id === occurrence.eventId);
}

/* ------------------------------------------------------------------------- *
 * The commits — contracts' client sequence, through `withActor`.
 * ------------------------------------------------------------------------- */

/** The scope fields an action takes: none for a one-off, the scope alone for `all`, the occurrence for the rest. */
function scopeFieldsOf(
  scope: Scope | null,
  occurrenceDate: string,
): { scope?: Scope; occurrenceDate?: string } {
  if (scope === null) return {};
  return scope === "all" ? { scope } : { scope, occurrenceDate };
}

interface EditCommit {
  zone: string;
  withActor: FamilyContextValue["withActor"];
  /** Puts the scope question up and answers with the choice, or `null` when dismissed. */
  askScope: (seriesFieldsChanged: boolean) => Promise<Scope | null>;
}

/** Diff → (scope question, repeat only) → `withActor(updateEvent)`; `null` = abandoned (FR-249). */
async function commitEdit(
  commit: EditCommit,
  target: EditTarget,
  input: EventInput,
): Promise<SubmitOutcome> {
  const patch = patchOf(input, target, commit.zone);
  if (isEmptyPatch(patch)) return NOTHING_TO_SAVE;
  const repeating = target.event.rrule !== null;
  const scope = repeating ? await commit.askScope(touchesSeriesFields(patch)) : null;
  if (repeating && scope === null) return null;
  return commit.withActor(() =>
    updateEvent({
      id: target.event.id,
      patch: scope === "all" ? rebasedOnSeries(patch, input, target, commit.zone) : patch,
      ...scopeFieldsOf(scope, target.occurrence.occurrenceDate),
    }),
  );
}

/** FR-258: the dialog's confirmation, restated to the server, at the chosen scope. */
function commitDelete(
  withActor: FamilyContextValue["withActor"],
  { target, scope }: DeleteSurface,
): Promise<ActionResult<null>> {
  return withActor(() =>
    deleteEvent({
      id: target.event.id,
      confirm: true,
      ...scopeFieldsOf(scope, target.occurrence.occurrenceDate),
    }),
  );
}

function isGone(outcome: SubmitOutcome): boolean {
  return outcome !== null && !outcome.ok && outcome.error === "NOT_FOUND";
}

/** What a refused delete leaves on the grid once its dialogs have closed. */
function refusalNotice(result: ActionResult<null>): string | null {
  if (result.ok) return null;
  return result.error === "NOT_FOUND" ? GONE_MESSAGE : result.message;
}

/* ------------------------------------------------------------------------- *
 * The hook, in three readable pieces: which surface is open, the scope
 * question's answer slot, and the two commits.
 * ------------------------------------------------------------------------- */

type SetSurface = Dispatch<SetStateAction<EditorSurface>>;

/** The surfaces' own state, and the transitions that need neither an action nor a scope. */
function useSurfaces(lookup: (occurrence: Occurrence) => Event | undefined) {
  const [surface, setSurface] = useState<EditorSurface>(CLOSED);
  const [notice, setNotice] = useState<string | null>(null);

  const openCreate = useCallback((seed?: EventFormSeed) => {
    setNotice(null);
    setSurface({ kind: "create", seed });
  }, []);

  const openDetails = useCallback(
    (occurrence: Occurrence) => {
      const event = lookup(occurrence);
      // The row left the week between the paint and the tap (FR-288).
      if (!event) {
        setNotice(GONE_MESSAGE);
        return;
      }
      setNotice(null);
      setSurface({ kind: "details", target: { occurrence, event } });
    },
    [lookup],
  );

  const close = useCallback(() => setSurface(CLOSED), []);
  const edit = useCallback(() => setSurface(toEdit), []);
  const requestDelete = useCallback(() => setSurface(toDeleteRequest), []);

  return {
    surface,
    setSurface,
    notice,
    setNotice,
    openCreate,
    openDetails,
    close,
    edit,
    requestDelete,
  };
}

/**
 * The scope question: the dialog it puts up, and the answer slot the commit
 * that asked awaits — resolved by the dialog's choose or cancel (the
 * punch-in prompt's idiom, FR-250).
 */
function useScopeQuestion(setSurface: SetSurface) {
  const resolver = useRef<((scope: Scope | null) => void) | null>(null);

  const answer = useCallback((scope: Scope | null) => {
    const resolve = resolver.current;
    resolver.current = null;
    resolve?.(scope);
  }, []);

  const chooseScope = useCallback(
    (scope: Scope) => {
      setSurface((current) => withScopeChosen(current, scope));
      answer(scope);
    },
    [setSurface, answer],
  );

  const cancelScope = useCallback(() => {
    setSurface(withScopeDismissed);
    answer(null);
  }, [setSurface, answer]);

  const askScope = useCallback(
    (seriesFieldsChanged: boolean): Promise<Scope | null> => {
      const pending = new Promise<Scope | null>((resolve) => {
        resolver.current = resolve;
      });
      setSurface((current) => withScopeQuestion(current, seriesFieldsChanged));
      return pending;
    },
    [setSurface],
  );

  return { chooseScope, cancelScope, askScope };
}

interface CommitOptions {
  /** Household IANA zone — the clock a patch's times are rebased in. */
  zone: string;
  surface: EditorSurface;
  setSurface: SetSurface;
  setNotice: (notice: string | null) => void;
  askScope: (seriesFieldsChanged: boolean) => Promise<Scope | null>;
}

/** The two writes, each through `withActor`, and what their outcomes do to the surfaces. */
function useCommits({ zone, surface, setSurface, setNotice, askScope }: CommitOptions) {
  const { withActor } = useFamily();

  /** FR-288: the event is gone — close everything, recreate nothing, say so. */
  const settle = useCallback(
    (outcome: SubmitOutcome): SubmitOutcome => {
      if (!isGone(outcome)) return outcome;
      setSurface(CLOSED);
      setNotice(GONE_MESSAGE);
      return null;
    },
    [setSurface, setNotice],
  );

  const submit = useCallback(
    async (input: EventInput): Promise<SubmitOutcome> => {
      if (surface.kind === "create") return withActor(() => createEvent(input));
      if (surface.kind !== "edit") return null;
      return settle(await commitEdit({ zone, withActor, askScope }, surface.target, input));
    },
    [surface, zone, withActor, askScope, settle],
  );

  const confirmDelete = useCallback(async () => {
    if (surface.kind !== "delete" || surface.pending) return;
    setSurface({ ...surface, pending: true });
    const result = await commitDelete(withActor, surface);
    setSurface(CLOSED);
    setNotice(refusalNotice(result));
  }, [surface, withActor, setSurface, setNotice]);

  return { submit, confirmDelete };
}

export function useCalendarEditor(options: UseCalendarEditorOptions): CalendarEditor {
  const { householdId, weekStart, zone } = options;
  const queryClient = useQueryClient();

  const lookup = useCallback(
    (occurrence: Occurrence) => findEvent(queryClient, householdId, weekStart, occurrence),
    [queryClient, householdId, weekStart],
  );

  const {
    surface,
    setSurface,
    notice,
    setNotice,
    openCreate,
    openDetails,
    close,
    edit,
    requestDelete,
  } = useSurfaces(lookup);
  const { chooseScope, cancelScope, askScope } = useScopeQuestion(setSurface);
  const { submit, confirmDelete } = useCommits({
    zone,
    surface,
    setSurface,
    setNotice,
    askScope,
  });

  return useMemo<CalendarEditor>(
    () => ({
      surface,
      notice,
      openCreate,
      openDetails,
      close,
      edit,
      requestDelete,
      chooseScope,
      cancelScope,
      confirmDelete,
      submit,
    }),
    [
      surface,
      notice,
      openCreate,
      openDetails,
      close,
      edit,
      requestDelete,
      chooseScope,
      cancelScope,
      confirmDelete,
      submit,
    ],
  );
}
