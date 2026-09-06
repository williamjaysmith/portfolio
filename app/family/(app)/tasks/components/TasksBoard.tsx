"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useMemo, useState, type ReactNode } from "react";

import { reorderCategories } from "@/lib/family/actions/categories";
import { createTask, deleteTask, moveRoutine, updateTask } from "@/lib/family/actions/tasks";
import { weekStartOf } from "@/lib/family/calendar/dates";
import type { ActionResult } from "@/lib/family/errors";
import { useTaskResolutions, useTasks } from "@/lib/family/queries";
import { listCompletesWith } from "@/lib/family/rewards/celebrations";
import type {
  ActorSession,
  BoardOccurrence,
  Category,
  StarEntry,
  Task,
  TaskCursor,
  TaskResolution,
  TaskScope,
  TimeOfDay,
  WeekStart,
} from "@/lib/family/types";
import type { TaskInput } from "@/lib/family/validation";

import { DeleteConfirm } from "../../calendar/components/DeleteConfirm";
import { BoardStrip } from "../../components/BoardStrip";
import { EmojiRain } from "../../components/celebrations/EmojiRain";
import { WeekMessage } from "../../components/celebrations/WeekMessage";
import { useRegisterFabAction } from "../../components/FabAction";
import { useFamily, type FamilyContextValue } from "../../components/FamilyProvider";
import { settleEdit, useWriteSurface } from "../../components/useWriteSurface";
import { ClaimDialog } from "./ClaimDialog";
import { ColumnPager, useColumnPage } from "./ColumnPager";
import { DeleteScopeDialog } from "./DeleteScopeDialog";
import { ProfileColumn } from "./ProfileColumn";
import { TaskStreaksProvider } from "./StreakBadge";
import { TaskBoxSheet } from "./TaskBoxSheet";
import { occurrenceKeyOf } from "./TaskCard";
import { dayInWords, TaskDetails } from "./TaskDetails";
import { TaskForm } from "./TaskForm";
import { TaskSearch } from "./TaskSearch";
import {
  UP_FOR_GRABS_COLUMN_ID,
  UP_FOR_GRABS_TITLE,
  UpForGrabsColumn,
} from "./UpForGrabsColumn";
import {
  householdOrderOf,
  previewed,
  useListReorder,
  type ListReorder,
  type RoutineMove,
} from "./useColumnReorder";
import { useBoardGeometry } from "./useBoardGeometry";
import { useBoardOccurrences, type BoardCounters } from "./useBoardOccurrences";
import { useDayAnchor } from "./useDayAnchor";
import { useSectionToggles } from "./useSectionToggles";
import { taskDraftOf, type TaskFormSeed, type TaskSubmitOutcome } from "./useTaskForm";
import {
  occurrenceKeyFrom,
  resolveVerbOf,
  useTaskResolve,
  type ResolveOutcome,
  type TaskResolveIntent,
  type TaskResolveState,
} from "./useTaskResolve";
import {
  prevWeekStartOf,
  useWeekCelebrations,
  type WeekCelebrationsState,
} from "./useWeekCelebrations";

/**
 * T046: the Tasks board — the FR-301 day of per-profile columns, assembled from
 * the US1 pieces, each of which stays ignorant of the others:
 *
 *   useDayAnchor          {today | pinned} displayed day over the shared clock
 *   useBoardGeometry      measures the mounted board → how many columns fit
 *   useBoardOccurrences   the five reads → expand → the counter branch (R317)
 *   useSectionToggles     the clock's window, with per-column overrides (R322)
 *   useTaskResolve        the one `withActor` commit path (R323)
 *
 * **Up for Grabs comes first**, before every Profile, because it belongs to
 * everyone by belonging to nobody (FR-308); then one column per Profile whose
 * **Show on Tasks tab** switch is on — a Profile switched off has no column on
 * any device (FR-313), which is a different thing from this device's own
 * profile filter (FR-383) that `visibleProfiles` already applies.
 *
 * The column each occurrence is drawn in is `boardColumnsOf`, and it is the one
 * place the board could disagree with the numbers above the cards: it partitions
 * by the SAME rule `columnCountersOf` counts by (R318) — the chain's owner, or
 * the Profile a claim credited (FR-367) — so a claimed up-for-grabs chore joins
 * the crediting column and its ring together or not at all.
 *
 * Nothing here filters, and the board holds the day TWICE for that reason:
 * `occurrences` is the drawn slice, below `useBoardOccurrences`'s filter layer,
 * and `allOccurrences` is the whole day above it. Every number a column shows —
 * FR-305's ring, FR-312's per-routine indicator, FR-308's count, and FR-407's
 * star pill (004 T027, summed from the week's entries in the same memo) — is
 * computed from the second, and only the cards are partitioned out of the
 * first, which is what makes "filters and search never move the counters"
 * structural rather than remembered (FR-384, FR-386, SC-310, SC-320, R317).
 *
 * **An unclaimed Up for Grabs tap is diverted** rather than written (T063):
 * FR-368 forbids an anonymous completion, so the circle opens `ClaimDialog`,
 * which asks who did it and then runs the same commit path with the credit
 * (FR-367). A lost race keeps that question open carrying the server's own
 * refusal, and both devices settle on the stored row at the next refetch
 * (FR-370, SC-311). Skip joins from the details sheet, where FR-352 puts it.
 *
 * The two taps are separate by construction (FR-352): the card body opens the
 * details sheet, the circle beside it runs the one commit path. The sheet holds
 * the occurrence's KEY rather than the occurrence, so it re-reads the live
 * expansion on every render — that is how a tick made here repaints the sheet
 * from the refetch, and how a task deleted on another device closes it with a
 * message instead of being recreated (FR-393).
 *
 * The write surface (T057) hangs off the same two taps: the shell's "Add Task"
 * control opens the create form, and the details sheet's parent-only Edit and
 * Delete open the edit form and FR-347's scope question. Every commit goes
 * through the shipped `withActor` interceptor and nothing is written to the
 * cache by hand — the board repaints from the refetch (FR-393).
 *
 * **The two celebrations are the board's** (004 T048, T051 — R408), and both
 * are decided from data the board already holds rather than by anything that
 * arrives later. FR-439's emoji rain is judged AT THE TAP, from the counters
 * as they stand and this device's own completions still in flight, and is
 * mounted on that write's success alone — so a completion from another device
 * is data, and data never mounts it. FR-440's week message is
 * `useWeekCelebrations` over the previous household week's read, shown once
 * per device and dismissed by a tap or its own clock.
 */

/** What the shell's "+" is called on this tab, and what it opens. */
const FAB_LABEL = "Add Task";

/** A failed board read says so once, in the household's words, not the API's. */
const READ_FAILED = "Today's tasks could not be loaded.";

/** FR-393: the sheet's occurrence went away underneath it. */
const GONE_MESSAGE = "That task is no longer here.";

/** Phase 1's top-bar pill (the calendar's idiom) at the FR-397 touch floor. */
const PILL_CLASS =
  "flex min-h-(--fam-touch) min-w-(--fam-touch) items-center justify-center gap-2 " +
  "rounded-full bg-(--fam-pill-btn-bg) px-4 font-medium " +
  "text-(length:--fam-fs-pill) text-(--fam-text-muted)";

/* ------------------------------------------------------------------ pure -- */

/** The day's occurrences split into the columns that draw them. */
export interface BoardColumns {
  /** Belonging to nobody: unassigned AND unclaimed (FR-308, FR-367). */
  upForGrabs: BoardOccurrence[];
  /** Keyed by Profile id — every shown Profile gets an entry, empty or not (FR-316). */
  byProfile: Record<string, BoardOccurrence[]>;
}

/**
 * The membership rule, stated to agree with `columnCountersOf`'s `inColumn`
 * (R318): an occurrence belongs to its chain's owner, or — having none — to the
 * Profile a resolution credited. An occurrence owned by a Profile this board
 * does not show is drawn nowhere, which is FR-313's "no column on any device".
 */
const NO_TASKS: Task[] = [];

export function boardColumnsOf(
  occurrences: readonly BoardOccurrence[],
  profileIds: readonly string[],
): BoardColumns {
  const byProfile: Record<string, BoardOccurrence[]> = {};
  for (const id of profileIds) byProfile[id] = [];

  const upForGrabs: BoardOccurrence[] = [];
  for (const one of occurrences) {
    const owner = one.assigneeId ?? one.creditedCategoryId;
    if (owner === null) upForGrabs.push(one);
    else byProfile[owner]?.push(one);
  }
  return { upForGrabs, byProfile };
}

/** The five seeds, each offered only to the cache entry it was fetched for. */
export interface BoardSeeds {
  initialTasks: Task[];
  initialResolutions?: TaskResolution[];
  initialCarry?: TaskResolution[];
  initialCursors: TaskCursor[];
  /** 004 R407: windowed by the SAME week as the resolutions, and withheld with them. */
  initialStarWeek?: StarEntry[];
}

/**
 * R314's seeding rule. Definitions and cursor tails are unwindowed, so they
 * seed their one key always; the resolutions and the star week are keyed by
 * the anchored week and the carry tail by today's date, so each is withheld
 * the moment the board has navigated away from the day the server fetched
 * for — seeding whichever window happens to be mounted would hand it another
 * window's rows for a whole `staleTime`.
 */
export function boardSeedsOf(
  props: TasksBoardProps,
  displayed: { displayedDate: string; todayDate: string },
  startWeekOn: WeekStart,
): BoardSeeds {
  const sameWeek =
    weekStartOf(displayed.displayedDate, startWeekOn) ===
    weekStartOf(props.initialDate, startWeekOn);
  return {
    initialTasks: props.initialTasks,
    initialCursors: props.initialCursors,
    initialResolutions: sameWeek ? props.initialResolutions : undefined,
    initialCarry: displayed.todayDate === props.initialDate ? props.initialCarry : undefined,
    initialStarWeek: sameWeek ? props.initialStarWeek : undefined,
  };
}

export interface NoticeInputs {
  error: Error | null;
  /** The open sheet's occurrence has left the board (FR-393). */
  gone: boolean;
  /** A sheet that carries the refusal itself is open — details, or the claim. */
  sheetOpen: boolean;
  resolveNotice: string | null;
  /** The board's own message — the create control's, for now. */
  own: string | null;
}

/**
 * The one line under the controls. A refusal raised from inside a sheet is
 * shown IN that sheet, which is modal, so it is not repeated behind it.
 */
export function boardNoticeOf(inputs: NoticeInputs): string | null {
  if (inputs.error !== null) return READ_FAILED;
  if (inputs.gone) return GONE_MESSAGE;
  if (inputs.own !== null) return inputs.own;
  return inputs.sheetOpen ? null : inputs.resolveNotice;
}

/* ----------------------------------------------------------- write surface -- */

/**
 * Which write surface is open (T057). The delete arm carries FR-347's two
 * steps: the scope question first, the confirmation second — and a task that
 * does not repeat skips straight to the confirmation, because the server
 * refuses a scope on one and so no question exists to ask.
 */
type TaskEditorSurface =
  | { kind: "closed" }
  /** FR-378: a create either starts empty or starts from a Task Box template. */
  | { kind: "create"; seed?: TaskFormSeed }
  /** FR-376: reached from the create form, and returning to it either way. */
  | { kind: "taskBox" }
  | { kind: "edit"; task: Task }
  | {
      kind: "delete";
      task: Task;
      occurrence: BoardOccurrence;
      step: "scope" | "confirm";
      scope: TaskScope | null;
      pending: boolean;
    };

const EDITOR_CLOSED: TaskEditorSurface = { kind: "closed" };

/** The scope fields a delete carries: none for a one-off, the key for the narrow scopes. */
function taskScopeFieldsOf(
  occurrence: BoardOccurrence,
  scope: TaskScope | null,
): { scope?: TaskScope; occurrenceKey?: ReturnType<typeof occurrenceKeyFrom> } {
  if (scope === null) return {};
  if (scope === "all") return { scope };
  return { scope, occurrenceKey: occurrenceKeyFrom(occurrence) };
}

/** What a refused delete leaves on the board once its dialogs have closed. */
function deleteNoticeOf(result: ActionResult<null>): string | null {
  if (result.ok) return null;
  return result.error === "NOT_FOUND" ? GONE_MESSAGE : result.message;
}

interface TaskEditor {
  surface: TaskEditorSurface;
  notice: string | null;
  clearNotice: () => void;
  openCreate: () => void;
  /** FR-376: Add → Task Box, and Close there comes back to the Add form. */
  openTaskBox: () => void;
  /** FR-378: a chosen template re-opens the create form, pre-filled. */
  chooseTemplate: (seed: TaskFormSeed) => void;
  openEdit: (occurrence: BoardOccurrence) => void;
  requestDelete: (occurrence: BoardOccurrence) => void;
  chooseScope: (scope: TaskScope) => void;
  close: () => void;
  confirmDelete: () => Promise<void>;
  submit: (input: TaskInput) => Promise<TaskSubmitOutcome>;
}

interface UseTaskEditorOptions {
  /** The household's task rows — where an occurrence's defining task is found. */
  tasks: readonly Task[];
  withActor: FamilyContextValue["withActor"];
}

/**
 * The three commits and the surfaces they belong to. Each write is
 * `withActor(() => action(...))`, so punch-in arrives at the moment of the
 * write, the cache is swept on success and the board redraws from the refetch —
 * there is deliberately no `setQueryData` here (FR-393).
 */
function useTaskEditor({ tasks, withActor }: UseTaskEditorOptions): TaskEditor {
  const { surface, notice, open, setSurface, setNotice, close, clearNotice, reportGone } =
    useWriteSurface<TaskEditorSurface>(EDITOR_CLOSED, GONE_MESSAGE);

  const openOn = useCallback(
    (occurrence: BoardOccurrence, next: (task: Task) => TaskEditorSurface) => {
      const task = tasks.find((row) => row.id === occurrence.taskId);
      // The row left the board between the paint and the tap (FR-393).
      if (!task) {
        setNotice(GONE_MESSAGE);
        return;
      }
      open(next(task));
    },
    [tasks, open, setNotice],
  );

  const openCreate = useCallback(() => open({ kind: "create" }), [open]);
  const openTaskBox = useCallback(() => open({ kind: "taskBox" }), [open]);

  // FR-378: not an action — the ordinary create form, carrying the template's
  // title, emoji and type, with the assignment and the schedule still to ask.
  const chooseTemplate = useCallback((seed: TaskFormSeed) => open({ kind: "create", seed }), [open]);

  const openEdit = useCallback(
    (occurrence: BoardOccurrence) => openOn(occurrence, (task) => ({ kind: "edit", task })),
    [openOn],
  );

  const requestDelete = useCallback(
    (occurrence: BoardOccurrence) =>
      openOn(occurrence, (task) => ({
        kind: "delete",
        task,
        occurrence,
        // FR-347: a one-off is asked nothing, because it takes no scope.
        step: occurrence.isRepeating ? "scope" : "confirm",
        scope: null,
        pending: false,
      })),
    [openOn],
  );

  const chooseScope = useCallback(
    (scope: TaskScope) => {
      setSurface((current) =>
        current.kind === "delete" ? { ...current, step: "confirm", scope } : current,
      );
    },
    [setSurface],
  );

  const confirmDelete = useCallback(async () => {
    if (surface.kind !== "delete" || surface.pending) return;
    setSurface({ ...surface, pending: true });
    const result = await withActor(() =>
      deleteTask({
        id: surface.task.id,
        // FR-258's dialog, restated to the server at the chosen scope.
        confirm: true,
        ...taskScopeFieldsOf(surface.occurrence, surface.scope),
      }),
    );
    setSurface(EDITOR_CLOSED);
    setNotice(deleteNoticeOf(result));
  }, [surface, withActor, setSurface, setNotice]);

  const submit = useCallback(
    async (input: TaskInput): Promise<TaskSubmitOutcome> => {
      if (surface.kind === "create") return withActor(() => createTask(input));
      if (surface.kind !== "edit") return null;
      // FR-331: the whole task, for every assignee, and never a scope; FR-393:
      // another device deleted it first — close, recreate nothing, say so.
      return settleEdit(
        () => withActor(() => updateTask({ id: surface.task.id, patch: input })),
        reportGone,
      );
    },
    [surface, withActor, reportGone],
  );

  return {
    surface,
    notice,
    clearNotice,
    openCreate,
    openTaskBox,
    chooseTemplate,
    openEdit,
    requestDelete,
    chooseScope,
    close,
    confirmDelete,
    submit,
  };
}

/* ---------------------------------------------------------------- reorder -- */

/**
 * Spacing for the CLIENT's copy of the column list only. The browser never
 * writes a `sort_order`: `reorderCategories` takes the complete ordered id list
 * and rebalances every row itself, so these numbers exist purely to give the
 * shared reducer an ascending list to work on.
 */
const CLIENT_GAP = 1000;

/** Both of the board's drags, and the one line a refused one leaves behind. */
interface BoardReorder {
  /** FR-309's column drag: pressed and held on a Profile's name. */
  columns: ListReorder;
  /** FR-310, committed per column by `ProfileColumn`. */
  commitRoutine: (profileId: string, move: RoutineMove) => void;
  /** FR-389: a parent anywhere, a member in their own column. */
  canReorderRoutines: (profileId: string) => boolean;
  notice: string | null;
}

/**
 * The two reorders (T076). Both go through the ONE pure reducer and both write
 * through `withActor`, so a punch-in arrives at the moment of the drop and the
 * board redraws from the refetch — nothing is written to the cache by hand, and
 * a refusal leaves the stored order on screen (FR-393).
 *
 * **FR-309 needs no new action**: the column order is Phase 1's already
 * `requireParent()` `reorderCategories`, which takes the COMPLETE household
 * order. `householdOrderOf` is the reconstruction that makes that safe — the
 * board renders a filtered subset, and every id it does not draw keeps its
 * place. Two consequences follow and are not hidden: there is one household
 * order, not a per-tab one, so a drag here also reorders the calendar's profile
 * chip row and the settings list.
 */
function useBoardReorder(
  profiles: readonly Category[],
  categories: readonly Category[],
  actor: ActorSession | null,
  withActor: FamilyContextValue["withActor"],
): BoardReorder {
  const [notice, setNotice] = useState<string | null>(null);
  const isParent = actor?.role === "parent";

  const items = useMemo(
    () => profiles.map((profile, index) => ({ id: profile.id, sortOrder: (index + 1) * CLIENT_GAP })),
    [profiles],
  );
  const labelOf = useCallback(
    (id: string) => profiles.find((one) => one.id === id)?.label ?? "",
    [profiles],
  );
  const householdIds = useMemo(() => categories.map((one) => one.id), [categories]);

  const report = useCallback((result: ActionResult<unknown>) => {
    setNotice(result.ok ? null : result.message);
  }, []);

  const onDrop = useCallback(
    (move: { order: string[] }) => {
      setNotice(null);
      void withActor(() => reorderCategories(householdOrderOf(householdIds, move.order))).then(
        report,
      );
    },
    [withActor, householdIds, report],
  );

  const columns = useListReorder({
    items,
    axis: "horizontal",
    rowSelector: "[data-reorder-row]",
    // FR-309 verbatim: the press must land on the Profile's NAME, so a swipe
    // that begins anywhere else on the column still pages the board (FR-396).
    handleSelector: "[data-reorder-handle]",
    labelOf,
    enabled: isParent === true,
    onDrop,
  });

  const commitRoutine = useCallback(
    (profileId: string, move: RoutineMove) => {
      setNotice(null);
      void withActor(() => moveRoutine({ ...move, profileId })).then(report);
    },
    [withActor, report],
  );

  const canReorderRoutines = useCallback(
    (profileId: string) => isParent === true || actor?.profileId === profileId,
    [isParent, actor],
  );

  return { columns, commitRoutine, canReorderRoutines, notice };
}

/* ----------------------------------------------------------- celebrations -- */

/**
 * FR-439, judged at the tap and BEFORE the write (R408): does this completion
 * finish its Profile's list for the displayed day? `counters` are over the
 * whole day, above every filter, so a card a filter or a query has hidden
 * still counts (SC-414); `inFlight` is this device's own completions for the
 * Profile still queued or writing, so the second of two quick taps on the
 * last two cards knows the first is as good as done. Only a completion asks —
 * a skip is not one, an undo lengthens the list, and a claim (verb "complete"
 * with no assignee) is refused here by the verb-and-assignee check before
 * `listCompletesWith` would refuse it too — it belongs to nobody's list
 * (FR-368).
 */
function finishesList(
  intent: TaskResolveIntent,
  counters: BoardCounters,
  inFlight: (profileId: string) => number,
): boolean {
  const profileId = intent.occurrence.assigneeId;
  if (intent.verb !== "complete" || profileId === null) return false;
  return listCompletesWith(counters.column(profileId), intent.occurrence, inFlight(profileId));
}

interface BoardCelebrations {
  /** The one commit path, with FR-439's judgement made at every tap. */
  resolve: TaskResolveState;
  /**
   * Which rain is on screen — `0` for none, else the run's own key, so a
   * second finished list while one is still falling rains afresh rather
   * than inheriting the tail of the first.
   */
  rain: number;
  /** `EmojiRain`'s `onDone`: the rain ended, take it down. */
  endRain: () => void;
  /** FR-440's message, and the dismissal that remembers it (T051). */
  week: WeekCelebrationsState;
}

interface UseBoardCelebrationsOptions {
  householdId: string;
  zone: string;
  /** The LIVE day (`useDayAnchor`'s `todayDate`) — the week rolls on the household's midnight, not on navigation. */
  todayDate: string;
  startWeekOn: WeekStart;
  tasks: readonly Task[];
  categories: readonly Category[];
  counters: BoardCounters;
}

/**
 * Both celebrations, over the one commit path (T048, T051). The rain's
 * judgement wraps `useTaskResolve`'s `resolve` rather than watching the
 * counters change, because a counters transition happens on the OTHER device
 * too and races the refetch; the week message wraps nothing, because it is
 * judged from a read that has already settled.
 *
 * The previous week's read is `useTaskResolutions` under the same key the
 * neighbour prefetch already warmed, so on the ordinary day it costs nothing;
 * while it is pending `useWeekCelebrations` judges nothing.
 */
function useBoardCelebrations(options: UseBoardCelebrationsOptions): BoardCelebrations {
  const { householdId, zone, todayDate, startWeekOn, tasks, categories, counters } = options;
  const resolve = useTaskResolve();
  const { resolve: runResolve, inFlightCompletions } = resolve;
  const [rain, setRain] = useState(0);
  const endRain = useCallback(() => setRain(0), []);

  const judged = useCallback(
    async (intent: TaskResolveIntent): Promise<ResolveOutcome> => {
      // Decided before the write, from the counters as they stand (R408) —
      // the refetch that follows a success cannot reach this.
      const finishes = finishesList(intent, counters, inFlightCompletions);
      const outcome = await runResolve(intent);
      if (finishes && outcome !== null && outcome.ok) setRain((run) => run + 1);
      return outcome;
    },
    [counters, inFlightCompletions, runResolve],
  );

  const prevWeek = useTaskResolutions(householdId, prevWeekStartOf(todayDate, startWeekOn));
  const week = useWeekCelebrations({
    zone,
    weekStartDate: todayDate,
    startWeekOn,
    prevWeekResolutions: prevWeek.data,
    tasks,
    categories,
  });

  return { resolve: { ...resolve, resolve: judged }, rain, endRain, week };
}

/* --------------------------------------------------------------- surfaces -- */

/**
 * A sheet opened over ONE occurrence, held as that occurrence's KEY: what it
 * draws is re-read from the live expansion every render, so a resolution made
 * inside it repaints it from the refetch and an occurrence that has left the
 * board takes the sheet with it rather than being recreated from a stale copy
 * (FR-393).
 *
 * Two sheets are built from it — the details view and FR-367's claim question —
 * because both are exactly this: a window onto one occurrence that must not
 * outlive it.
 */
interface OccurrenceSurface {
  /** `occurrenceKeyOf` of the open occurrence, or null when the sheet is closed. */
  key: string | null;
  occurrence: BoardOccurrence | null;
  /** The open occurrence has left the board underneath the sheet (FR-393). */
  gone: boolean;
  open: (occurrence: BoardOccurrence) => void;
  close: () => void;
}

/** Both sheets at once, over one list — the pair the board actually wants. */
interface OccurrenceSheets {
  details: OccurrenceSurface;
  claim: OccurrenceSurface;
}

/**
 * The details view and FR-367's claim question, opened over the SAME live
 * expansion. They are built together because they are the same thing twice and
 * must stay so: a sheet reading a different list from its sibling would close
 * on a filter rather than on a deletion.
 */
function useOccurrenceSheets(occurrences: readonly BoardOccurrence[]): OccurrenceSheets {
  return {
    details: useOccurrenceSurface(occurrences),
    claim: useOccurrenceSurface(occurrences),
  };
}

function useOccurrenceSurface(occurrences: readonly BoardOccurrence[]): OccurrenceSurface {
  const [key, setKey] = useState<string | null>(null);

  const occurrence = useMemo(
    () => occurrences.find((one) => occurrenceKeyOf(one) === key) ?? null,
    [occurrences, key],
  );

  const open = useCallback((one: BoardOccurrence) => setKey(occurrenceKeyOf(one)), []);
  const close = useCallback(() => setKey(null), []);

  return { key, occurrence, gone: key !== null && occurrence === null, open, close };
}

/* ------------------------------------------------------------------ view -- */

function BoardNav({
  date,
  isToday,
  query,
  onQuery,
  onStep,
  onToday,
}: {
  date: string;
  isToday: boolean;
  /** FR-386's query, held by the board and never persisted (R319). */
  query: string;
  onQuery: (next: string) => void;
  onStep: (direction: -1 | 1) => void;
  onToday: () => void;
}) {
  return (
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 px-(--fam-edge-inset) pt-2">
      <p
        // The date is the only thing that says which day is on screen, so it
        // is what shows the midnight rollover happening (FR-315, SC-314).
        aria-current={isToday ? "date" : undefined}
        className="font-(family-name:--fam-font-serif) text-(length:--fam-fs-title)"
      >
        {dayInWords(date)}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        {/* FR-386, Assumption 27: the search sits in the tab's own chrome,
            beside Previous / Today / Next, and filters the board in place. */}
        <TaskSearch value={query} onChange={onQuery} />
        {/* The three day controls wrap as one unit, so a phone never strands
            the Next arrow on a line of its own under the search. */}
        <div className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            aria-label="Previous day"
            onClick={() => onStep(-1)}
            className={PILL_CLASS}
          >
            <ChevronLeft size={20} aria-hidden="true" />
          </button>
          <button type="button" onClick={onToday} className={PILL_CLASS}>
            Today
          </button>
          <button
            type="button"
            aria-label="Next day"
            onClick={() => onStep(1)}
            className={PILL_CLASS}
          >
            <ChevronRight size={20} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}

function Notice({ message }: { message: string | null }) {
  if (message === null) return null;
  return (
    <p
      role="alert"
      className="px-(--fam-edge-inset) py-1 text-(length:--fam-fs-small) text-(--fam-danger)"
    >
      {message}
    </p>
  );
}

export interface TasksBoardProps {
  /** The server-rendered household-local day (R314) — the first paint's date. */
  initialDate: string;
  /** The window the server read the clock in, so the sections do not flip on hydration. */
  initialWindow: TimeOfDay;
  initialTasks: Task[];
  initialResolutions: TaskResolution[];
  initialCarry: TaskResolution[];
  initialCursors: TaskCursor[];
  /** The fifth read (004 R407): the anchored week's star entries, for FR-407's pill. */
  initialStarWeek: StarEntry[];
}

/**
 * FR-368: an up-for-grabs occurrence nobody has claimed cannot be completed
 * anonymously, so a tap on its circle asks who did it instead of sending a
 * write the server would refuse. Once claimed it is an ordinary completed
 * occurrence and un-completing it takes the ordinary path (FR-369).
 */
function needsClaim(occurrence: BoardOccurrence): boolean {
  return occurrence.upForGrabs && occurrence.state === "unresolved";
}

/** What a card's two taps and the sheets' own controls do. */
interface BoardHandlers {
  onOpen: (occurrence: BoardOccurrence) => void;
  onResolve: (occurrence: BoardOccurrence) => Promise<void>;
  /** FR-359, from the details sheet — the same commit path, a different verb. */
  onSkip: (occurrence: BoardOccurrence) => Promise<void>;
  /** FR-367, from the claim question, carrying the Profile it credits. */
  onClaim: (occurrence: BoardOccurrence, creditProfileId: string) => Promise<void>;
  onEdit: (occurrence: BoardOccurrence) => void;
  onDelete: (occurrence: BoardOccurrence) => void;
}

/**
 * The four callbacks that cross between the sheet, the resolve path and the
 * write surface — extracted so the model below assembles hooks rather than also
 * sequencing them.
 */
function useBoardHandlers(
  details: OccurrenceSurface,
  claim: OccurrenceSurface,
  resolve: TaskResolveState,
  editor: TaskEditor,
): BoardHandlers {
  const { open: openDetails, close: closeDetails } = details;
  const { open: openClaim, close: closeClaim } = claim;
  const { resolve: runResolve, clearNotice } = resolve;
  const { clearNotice: clearEditorNotice, openEdit, requestDelete } = editor;

  const onOpen = useCallback(
    (occurrence: BoardOccurrence) => {
      clearEditorNotice();
      // A refusal belongs to the tap that earned it: opening another card must
      // not show it the last card's answer.
      clearNotice();
      openDetails(occurrence);
    },
    [openDetails, clearNotice, clearEditorNotice],
  );

  const onResolve = useCallback(
    async (occurrence: BoardOccurrence) => {
      clearEditorNotice();
      // FR-367/FR-368: it needs a Profile named before it can be written at
      // all, so the tap opens the question rather than the write.
      if (needsClaim(occurrence)) {
        clearNotice();
        closeDetails();
        openClaim(occurrence);
        return;
      }
      const outcome = await runResolve({ occurrence, verb: resolveVerbOf(occurrence.state) });
      // FR-393: another device removed it first — the sheet closes and says so
      // rather than recreating what is no longer there.
      if (outcome !== null && !outcome.ok && outcome.error === "NOT_FOUND") closeDetails();
    },
    [runResolve, closeDetails, openClaim, clearNotice, clearEditorNotice],
  );

  // FR-352's Skip, from the sheet that offers it. A skip settles the
  // occurrence, so the sheet it was chosen in has nothing left to say.
  const onSkip = useCallback(
    async (occurrence: BoardOccurrence) => {
      clearEditorNotice();
      const outcome = await runResolve({ occurrence, verb: "skip" });
      if (outcome !== null && outcome.ok) closeDetails();
    },
    [runResolve, closeDetails, clearEditorNotice],
  );

  // FR-367's claim. A refusal LEAVES the question open — a lost race (FR-370)
  // and a dismissed punch-in are both things the person may answer again.
  const onClaim = useCallback(
    async (occurrence: BoardOccurrence, creditProfileId: string) => {
      const outcome = await runResolve({ occurrence, verb: "claim", creditProfileId });
      if (outcome !== null && outcome.ok) closeClaim();
    },
    [runResolve, closeClaim],
  );

  // The details sheet hands over to a write surface: one dialog at a time.
  const onEdit = useCallback(
    (occurrence: BoardOccurrence) => {
      closeDetails();
      openEdit(occurrence);
    },
    [closeDetails, openEdit],
  );

  const onDelete = useCallback(
    (occurrence: BoardOccurrence) => {
      closeDetails();
      requestDelete(occurrence);
    },
    [closeDetails, requestDelete],
  );

  return { onOpen, onResolve, onSkip, onClaim, onEdit, onDelete };
}

/**
 * The one line under the controls, assembled from the four things that can
 * claim it — extracted so the model below assembles hooks rather than also
 * composing a message. Both sheets carry a refusal themselves, and both are
 * modal, so neither is repeated behind them.
 */
function noticeFor(
  board: { error: Error | null },
  details: OccurrenceSurface,
  claim: OccurrenceSurface,
  resolve: TaskResolveState,
  editor: TaskEditor,
  /** A refused reorder (FR-393): the board redraws from the stored order. */
  reorderNotice: string | null,
): string | null {
  return boardNoticeOf({
    error: board.error,
    gone: details.gone,
    sheetOpen: details.occurrence !== null || claim.occurrence !== null,
    resolveNotice: resolve.notice,
    own: editor.notice ?? reorderNotice,
  });
}

/**
 * The view's own state, before any data is read: which day is displayed,
 * what is typed in the search, which Profiles have a column, how many columns
 * fit, and which page of them is on screen. Split from the model below so each
 * half stays inside the complexity budget on its own.
 */
function useBoardView(props: TasksBoardProps, zone: string, visibleProfiles: Category[]) {
  const anchor = useDayAnchor({ zone, initialDate: props.initialDate });
  // FR-386's search string. Component state, not a store: it is this view's own
  // and dies with it, unlike the four per-device switches (R319). It reaches
  // the board only as `useBoardOccurrences`'s `query`, which applies it BELOW
  // the counter branch — so no keystroke can move a ring or a count (SC-320).
  const [query, setQuery] = useState("");
  const profiles = useMemo(
    () => visibleProfiles.filter((profile) => profile.showOnTasks),
    [visibleProfiles],
  );
  const toggles = useSectionToggles({ zone, initialWindow: props.initialWindow });
  // Up for Grabs plus every shown Profile — the count the fit is decided over,
  // and the count the pager pages through (FR-396).
  const columnCount = profiles.length + 1;
  const geometry = useBoardGeometry(columnCount);
  const page = useColumnPage({
    columnCount,
    perRow: geometry.layout.perRow,
    mode: geometry.layout.mode,
  });
  return { anchor, query, setQuery, profiles, toggles, geometry, page };
}

/**
 * Every hook the board needs, assembled once. Kept out of the component so the
 * rendering below is a rendering of a value rather than a wiring of hooks.
 */
function useTasksBoardModel(props: TasksBoardProps) {
  const { householdId, settings, categories, visibleProfiles, avatarUrls, actor, withActor } =
    useFamily();
  const zone = settings.timezone;
  const { anchor, query, setQuery, profiles, toggles, geometry, page } = useBoardView(
    props,
    zone,
    visibleProfiles,
  );

  const board = useBoardOccurrences({
    householdId,
    displayedDate: anchor.displayedDate,
    todayDate: anchor.todayDate,
    zone,
    startWeekOn: settings.startWeekOn,
    query,
    ...boardSeedsOf(props, anchor, settings.startWeekOn),
  });

  const columns = useMemo(
    () => boardColumnsOf(board.occurrences, profiles.map((profile) => profile.id)),
    [board.occurrences, profiles],
  );

  // Over the WHOLE day, not the drawn slice: an occurrence a filter or a query
  // has hidden is still there, so a sheet opened on it stays open and keeps
  // resolving it. `gone` then means what FR-393 says it means — the row has
  // actually left the board — and never "you typed something".
  const { details, claim } = useOccurrenceSheets(board.allOccurrences);
  // The same cache entry `useBoardOccurrences` seeded: the row an occurrence
  // was drawn from, which the edit and delete surfaces both need.
  const taskRows = useTasks(householdId).data ?? NO_TASKS;
  const editor = useTaskEditor({ tasks: taskRows, withActor });

  // The one commit path, wrapped with FR-439's judgement at the tap, and
  // FR-440's message over the previous week (T048, T051).
  const { resolve, rain, endRain, week } = useBoardCelebrations({
    householdId,
    zone,
    todayDate: anchor.todayDate,
    startWeekOn: settings.startWeekOn,
    tasks: taskRows,
    categories,
    counters: board.counters,
  });

  const handlers = useBoardHandlers(details, claim, resolve, editor);
  const reorder = useBoardReorder(profiles, categories, actor, withActor);
  // While a column is being carried the board paints the drop's preview; with
  // nothing in flight it paints the stored household order (R321).
  const drawnProfiles = previewed(profiles, reorder.columns.order, (one) => one.id);

  // The shell's one create control, named for this tab while the board is
  // mounted, and pointed at the create form.
  useRegisterFabAction(FAB_LABEL, editor.openCreate);

  return {
    anchor,
    query,
    setQuery,
    taskRows,
    profiles,
    categories,
    avatarUrls,
    actor,
    zone,
    timeFormat: settings.timeFormat,
    layout: geometry.layout,
    boardRef: geometry.boardRef,
    // FR-396: which columns are on screen, and how a swipe moves between them.
    page,
    // The whole day, for the numbers above the cards; the drawn slice reaches
    // the columns already partitioned, as `columns` (R317, R318).
    allOccurrences: board.allOccurrences,
    // FR-407's pill per Profile, from the same memo as every other number —
    // handed down as a closure over the week's entries, never the entries.
    starsToday: board.counters.starsToday,
    columns,
    drawnProfiles,
    reorder,
    toggles,
    resolve,
    details,
    claim,
    editor,
    // FR-439's rain and FR-440's message, each mounted by the board alone.
    rain,
    endRain,
    week,
    ...handlers,
    notice: noticeFor(board, details, claim, resolve, editor, reorder.notice),
  };
}

/** One drawn column and the name the pager announces it by (FR-396). */
interface DrawnColumn {
  label: string;
  node: ReactNode;
}

type TasksBoardModel = ReturnType<typeof useTasksBoardModel>;

/**
 * Every column the board has, in the ONE order FR-396 fixes: Up for Grabs
 * first, because it belongs to everyone by belonging to nobody, then the
 * Profiles in the household's own order (FR-309). Built as a list rather than
 * written straight into the tree because the pager shows a window of it — and
 * because the window is a slice of exactly this order, "Up for Grabs first" is
 * true of the first page rather than being separately arranged for.
 */
function drawnColumnsOf(m: TasksBoardModel): DrawnColumn[] {
  return [
    {
      label: UP_FOR_GRABS_TITLE,
      node: (
        <UpForGrabsColumn
          key={UP_FOR_GRABS_COLUMN_ID}
          allOccurrences={m.allOccurrences}
          occurrences={m.columns.upForGrabs}
          toggles={m.toggles.sectionsFor(UP_FOR_GRABS_COLUMN_ID)}
          onToggleSection={(section) => m.toggles.toggleSection(UP_FOR_GRABS_COLUMN_ID, section)}
          busyKeys={m.resolve.busyKeys}
          onOpen={m.onOpen}
          onResolve={m.onResolve}
        />
      ),
    },
    ...m.drawnProfiles.map((profile) => ({
      label: profile.label,
      node: (
        <ProfileColumn
          key={profile.id}
          category={profile}
          allOccurrences={m.allOccurrences}
          occurrences={m.columns.byProfile[profile.id] ?? []}
          starsToday={m.starsToday(profile.id)}
          toggles={m.toggles.sectionsFor(profile.id)}
          onToggleSection={(section) => m.toggles.toggleSection(profile.id, section)}
          photoUrl={m.avatarUrls[profile.id]}
          busyKeys={m.resolve.busyKeys}
          reorderable={m.actor?.role === "parent"}
          canReorderRoutines={m.reorder.canReorderRoutines(profile.id)}
          onMoveRoutine={m.reorder.commitRoutine}
          onOpen={m.onOpen}
          onResolve={m.onResolve}
        />
      ),
    })),
  ];
}

/** The four write surfaces, at most one of which is ever open. */
function TaskEditorSurfaces({ editor, zone }: { editor: TaskEditor; zone: string }) {
  const { surface } = editor;
  if (surface.kind === "create") {
    return (
      <TaskForm
        mode="create"
        seed={surface.seed}
        onSubmit={editor.submit}
        onClose={editor.close}
        onOpenTaskBox={editor.openTaskBox}
      />
    );
  }
  // FR-376: the Task Box replaces the create form it was opened from, and Close
  // brings that form back rather than abandoning the add half-way through.
  if (surface.kind === "taskBox") {
    return <TaskBoxSheet onChoose={editor.chooseTemplate} onClose={editor.openCreate} />;
  }
  if (surface.kind === "edit") {
    return (
      <TaskForm
        mode="edit"
        seed={taskDraftOf(surface.task, zone)}
        onSubmit={editor.submit}
        onClose={editor.close}
      />
    );
  }
  if (surface.kind !== "delete") return null;
  if (surface.step === "scope") {
    return (
      <DeleteScopeDialog
        summary={surface.task.summary}
        routine={surface.task.routine}
        cursorMode={surface.task.renewAfterAmount !== null}
        onChoose={editor.chooseScope}
        onCancel={editor.close}
      />
    );
  }
  return (
    <DeleteConfirm
      summary={surface.task.summary}
      pending={surface.pending}
      onConfirm={() => void editor.confirmDelete()}
      onCancel={editor.close}
    />
  );
}

export function TasksBoard(props: TasksBoardProps) {
  const m = useTasksBoardModel(props);
  const open = m.details.occurrence;
  const claiming = m.claim.occurrence;
  // The window the measured layout allows: every column when they all fit,
  // and a page of them when they do not (FR-394, FR-395, FR-396).
  const visible = drawnColumnsOf(m).slice(m.page.start, m.page.end);

  return (
    <div className="flex h-full min-h-0 flex-col gap-(--fam-task-col-gap)">
      <BoardNav
        date={m.anchor.displayedDate}
        isToday={m.anchor.isToday}
        query={m.query}
        onQuery={m.setQuery}
        onStep={m.anchor.step}
        onToday={m.anchor.goToToday}
      />

      <Notice message={m.notice} />

      {/* FR-440: the earned message, in the board's flow where the notice
          sits; a tap or its own clock dismisses it and surfaces the next. */}
      {m.week.message === null ? null : (
        <WeekMessage message={m.week.message} onDismiss={m.week.dismiss} />
      )}

      {/* FR-371's stored counts, put up once over the task rows the board
          already holds, so every card can read its own without the sections
          and both columns having to carry a number neither has an opinion
          about (T070). */}
      <TaskStreaksProvider tasks={m.taskRows}>
        <ColumnPager
          paged={m.page.paged}
          // FR-309 beside FR-396: once a press-and-hold has claimed the pointer
          // the gesture belongs to the drag, and a drag that wanders sideways
          // must not also page the board out from under itself.
          suspended={m.reorder.columns.active}
          onPage={m.page.step}
          visibleLabels={visible.map((column) => column.label)}
        >
          <BoardStrip
            boardRef={m.boardRef}
            perRow={m.layout.perRow}
            count={visible.length}
            reorder={m.reorder.columns}
          >
            {visible.map((column) => column.node)}
          </BoardStrip>
        </ColumnPager>
      </TaskStreaksProvider>

      <p role="status" aria-live="polite" className="sr-only">
        {m.reorder.columns.announcement}
      </p>

      {open === null ? null : (
        <TaskDetails
          occurrence={open}
          categories={m.categories}
          actor={m.actor}
          timeFormat={m.timeFormat}
          busy={m.details.key !== null && m.resolve.busyKeys.has(m.details.key)}
          notice={m.resolve.notice}
          onResolve={() => void m.onResolve(open)}
          onSkip={() => void m.onSkip(open)}
          onEdit={() => m.onEdit(open)}
          onDelete={() => m.onDelete(open)}
          onClose={m.details.close}
        />
      )}

      {claiming === null ? null : (
        <ClaimDialog
          summary={claiming.summary}
          // Every Profile this board draws a column for; the dialog narrows it
          // to whoever the punched-in person may credit (FR-351).
          profiles={m.profiles}
          actor={m.actor}
          busy={m.claim.key !== null && m.resolve.busyKeys.has(m.claim.key)}
          notice={m.resolve.notice}
          onClaim={(creditProfileId) => void m.onClaim(claiming, creditProfileId)}
          onCancel={m.claim.close}
        />
      )}

      <TaskEditorSurfaces editor={m.editor} zone={m.zone} />

      {/* FR-439: mounted on THIS device's list-finishing completion alone,
          keyed per run so a second finished list rains afresh, and taken
          down by its own `onDone`. Outside every animated wrapper, so its
          fixed layer keeps the viewport as its containing block. */}
      {m.rain === 0 ? null : <EmojiRain key={m.rain} onDone={m.endRain} />}
    </div>
  );
}
