/**
 * `expandTaskDay` — the ONE entry point that turns fetched task rows into the
 * day's occurrences (R315). Every renderer reads it, and every server action
 * validating an occurrence key calls the same function, so a stale client can
 * never resolve a phantom.
 *
 * An occurrence is one dated appearance of a task for ONE assignee (spec
 * §Key Entities), so all four generators fan out across `task.assignees`; a
 * task with no assignee rows emits the single unassigned up-for-grabs
 * occurrence instead, which belongs to nobody until it is claimed (FR-365).
 *
 * Nothing is stored: the routine and Scheduled Date generators walk the shared
 * `ruleDatesIn`, the Anytime chore has one undated occurrence for ever, and the
 * Completed Date chore's open occurrence is derived from the chain tail
 * (`cursor.ts`). Skipped occurrences stay in the list — hiding them is the
 * filter layer's job (FR-361), and leaving them out of the denominator is the
 * counters' (FR-360).
 *
 * The decomposition is deliberate rather than discovered at the quality gate:
 * one small generator per task shape, `carryForwardPass` as its own function,
 * and a `flatMap` dispatch, so no function here approaches the complexity
 * ceiling.
 *
 * Framework-free and pure: no React, no storage, no clock — "today" is an
 * argument.
 */

import { localDateOf } from "../calendar/dates";
import { parseRule } from "../recurrence/grammar";
import { ruleDatesIn } from "../recurrence/expand";
import { openOccurrence } from "./cursor";
import { carryWalkRangeOf, dueInstantOf, withinCarryBound } from "./dates";
import { resolutionAt, resolutionIndexOf, type ResolutionIndex } from "./resolutions";
import type {
  BoardOccurrence,
  Task,
  TaskCursor,
  TaskResolution,
  TimeOfDay,
} from "../types";

/** The day being drawn, the day it actually is, and the household's zone. */
export interface ExpandOptions {
  /** The board's displayed household-local day. */
  displayedDate: string;
  /** The household-local date of "now" — the carry pass runs only when they agree. */
  todayDate: string;
  zone: string;
}

/**
 * What every generator reads. `resolutions` and `cursors` are the whole fetched
 * sets, not per-task slices: at a household's scale filtering inside costs
 * nothing and keeps one construction site.
 */
export interface TaskContext {
  index: ResolutionIndex;
  resolutions: readonly TaskResolution[];
  cursors: readonly TaskCursor[];
  options: ExpandOptions;
}

/** One occurrence before its stored state is looked up. */
interface OccurrencePart {
  assigneeId: string | null;
  scheduledDate: string | null;
  slot: TimeOfDay | null;
  cyclePrev: string | null;
  /** The board day it is drawn on — today for a carried-forward occurrence. */
  displayedOn: string;
  isLate: boolean;
}

export function expandTaskDay(
  tasks: readonly Task[],
  resolutions: readonly TaskResolution[],
  cursors: readonly TaskCursor[],
  options: ExpandOptions,
): BoardOccurrence[] {
  const context: TaskContext = {
    index: resolutionIndexOf(resolutions),
    resolutions,
    cursors,
    options,
  };
  const carries = options.displayedDate === options.todayDate;
  return tasks.flatMap((task) => [
    ...generatorFor(task)(task, context),
    ...(carries ? carryForwardPass(task, context) : []),
  ]);
}

type Generator = (task: Task, context: TaskContext) => BoardOccurrence[];

/** The repeat mode is which fields are populated — there is no stored kind. */
function generatorFor(task: Task): Generator {
  if (task.routine) return routineOccurrences;
  if (task.renewAfterAmount !== null) return cursorChoreOccurrences;
  if (task.startsOn === null) return anytimeChoreOccurrences;
  return scheduledChoreOccurrences;
}

/* ------------------------------------------------------------ generators -- */

/**
 * A routine's slots on every matching date (FR-335). Each occurrence is
 * stamped with the slot it was generated for and reads no clock, so it can
 * neither migrate between sections nor expire as the window passes (FR-336).
 */
export function routineOccurrences(task: Task, context: TaskContext): BoardOccurrence[] {
  if (!task.routine) return [];
  if (!ruleMatchesDisplayedDate(task, context)) return [];
  const { displayedDate } = context.options;
  return assigneeIdsOf(task).flatMap((assigneeId) =>
    task.timesOfDay.map((slot) =>
      occurrenceOf(task, context, {
        assigneeId,
        scheduledDate: displayedDate,
        slot,
        cyclePrev: null,
        displayedOn: displayedDate,
        isLate: false,
      }),
    ),
  );
}

/**
 * A dated chore's own date, or its rule's, anchored on `startsOn` (FR-340). A
 * missed occurrence never delays or shifts the next one — the walk is absolute
 * — and stays outstanding on its own day (FR-341).
 */
export function scheduledChoreOccurrences(task: Task, context: TaskContext): BoardOccurrence[] {
  if (task.routine || task.renewAfterAmount !== null || task.startsOn === null) return [];
  if (!ruleMatchesDisplayedDate(task, context)) return [];
  const { displayedDate } = context.options;
  return assigneeIdsOf(task).map((assigneeId) =>
    occurrenceOf(task, context, {
      assigneeId,
      scheduledDate: displayedDate,
      slot: null,
      cyclePrev: null,
      displayedOn: displayedDate,
      isLate: false,
    }),
  );
}

/**
 * The Anytime chore's single undated occurrence (FR-328): present on every
 * displayed day until it is resolved, counting toward that day's total, and
 * never late — it has no deadline to miss.
 *
 * It stays on the day it was resolved as well, because dropping it the instant
 * it is ticked would take it out of that day's denominator and walk the
 * column's ring backwards.
 */
export function anytimeChoreOccurrences(task: Task, context: TaskContext): BoardOccurrence[] {
  if (task.routine || task.startsOn !== null || task.renewAfterAmount !== null) return [];
  const { displayedDate } = context.options;
  return assigneeIdsOf(task)
    .map((assigneeId) => ({
      assigneeId,
      scheduledDate: null,
      slot: null,
      cyclePrev: null,
      displayedOn: displayedDate,
      isLate: false,
    }))
    .filter((part) => isDrawnOn(task, context, part, displayedDate))
    .map((part) => occurrenceOf(task, context, part));
}

/**
 * The Completed Date chore: the open occurrence derived from the published
 * chain tail, plus any cycle already settled on the displayed date (FR-343).
 *
 * Past cycles need no rule walk — the resolution rows ARE the occurrences on
 * their dates. On the day an "Immediately" cycle is completed both appear, the
 * one just ticked and the one it scheduled (0/1 → 1/2); both are genuine under
 * FR-305 and the ratio still moves upward.
 */
export function cursorChoreOccurrences(task: Task, context: TaskContext): BoardOccurrence[] {
  if (task.routine || task.renewAfterAmount === null) return [];
  const { displayedDate } = context.options;
  const settled = chainRowsOf(task, context).filter(
    (row) => row.occurrenceDate === displayedDate,
  );
  return assigneeIdsOf(task).flatMap((assigneeId) => [
    ...settled
      .filter((row) => row.assigneeId === assigneeId)
      .map((row) =>
        occurrenceOf(task, context, {
          assigneeId,
          scheduledDate: displayedDate,
          slot: null,
          cyclePrev: row.cyclePrev,
          displayedOn: displayedDate,
          isLate: false,
        }),
      ),
    ...openPartsOf(task, context, assigneeId)
      .filter((part) => part.scheduledDate === displayedDate)
      .map((part) => occurrenceOf(task, context, part)),
  ]);
}

/* -------------------------------------------------------- carry forward -- */

/**
 * FR-356/357: a Timed or All-day chore left unresolved past its date is placed
 * on today automatically, keeping its own `scheduledDate` as its identity and
 * as what the card shows (FR-358). Routines never carry forward (FR-338) and an
 * Anytime chore has no deadline to miss (FR-328). An up-for-grabs chore carries
 * by the identical rule, once for the household rather than once per profile
 * (FR-366), because it has one unassigned occurrence to carry.
 *
 * An occurrence resolved TODAY is still placed on today — a chore due Tuesday
 * and ticked Friday is recorded on Friday and Friday's count includes it
 * (SC-308).
 *
 * The bound is FR-357's, stated as arithmetic in `dates.ts`. The Completed Date
 * open occurrence is exempt: that occurrence IS the cursor, so bounding it
 * would put a neglected chore on no reachable screen, leave nothing able to
 * resolve it, and stop any next occurrence ever being scheduled (R316). That
 * mode has at most one open occurrence and cannot accumulate.
 */
export function carryForwardPass(task: Task, context: TaskContext): BoardOccurrence[] {
  if (task.routine || task.startsOn === null) return [];
  const { todayDate } = context.options;
  return assigneeIdsOf(task)
    .flatMap((assigneeId) => carryCandidatesOf(task, context, assigneeId))
    .filter((part) => isDrawnOn(task, context, part, todayDate))
    .map((part) => occurrenceOf(task, context, part));
}

/**
 * The past-dated occurrences of one assignee that could still be outstanding.
 * The bound is applied here, as FR-357's inequality rather than as a range, and
 * the cursor arm never reaches it — that is the R316 exemption, in one place.
 */
function carryCandidatesOf(
  task: Task,
  context: TaskContext,
  assigneeId: string | null,
): OccurrencePart[] {
  if (task.renewAfterAmount !== null) return cursorCarryCandidates(task, context, assigneeId);
  const { todayDate } = context.options;
  return ruleCarryCandidates(task, context, assigneeId).filter(
    (part) => part.scheduledDate !== null && withinCarryBound(part.scheduledDate, todayDate),
  );
}

function ruleCarryCandidates(
  task: Task,
  context: TaskContext,
  assigneeId: string | null,
): OccurrencePart[] {
  const { todayDate } = context.options;
  return pastRuleDates(task, todayDate, context.options.zone).map((date) => ({
    assigneeId,
    scheduledDate: date,
    slot: null,
    cyclePrev: null,
    displayedOn: todayDate,
    isLate: true,
  }));
}

/** The bounded walk's dates: a one-off's own date, or the rule's, before today. */
function pastRuleDates(task: Task, todayDate: string, zone: string): string[] {
  const range = carryWalkRangeOf(todayDate);
  if (task.startsOn === null) return [];
  if (task.rrule === null) {
    return task.startsOn >= range.start && task.startsOn <= range.end ? [task.startsOn] : [];
  }
  return ruleDatesIn(parseRule(task.rrule), task.startsOn, range, zone);
}

/**
 * The cursor chain's late shapes: the open occurrence when its date has passed,
 * and any cycle settled today whose own date was earlier (which the tail has
 * since moved past, so nothing else would place it on today).
 */
function cursorCarryCandidates(
  task: Task,
  context: TaskContext,
  assigneeId: string | null,
): OccurrencePart[] {
  const { todayDate } = context.options;
  const late = openPartsOf(task, context, assigneeId)
    .filter((part) => part.scheduledDate !== null && part.scheduledDate < todayDate)
    .map((part) => ({ ...part, displayedOn: todayDate, isLate: true }));
  const settledToday = chainRowsOf(task, context)
    .filter(
      (row) =>
        row.assigneeId === assigneeId &&
        row.resolvedOn === todayDate &&
        row.occurrenceDate !== null &&
        row.occurrenceDate < todayDate,
    )
    .map((row) => ({
      assigneeId,
      scheduledDate: row.occurrenceDate,
      slot: null,
      cyclePrev: row.cyclePrev,
      displayedOn: todayDate,
      isLate: true,
    }));
  return [...late, ...settledToday];
}

/* ------------------------------------------------------------- helpers -- */

/** Zero assignee rows means up for grabs: one occurrence, belonging to nobody. */
function assigneeIdsOf(task: Task): (string | null)[] {
  if (task.assignees.length === 0) return [null];
  return task.assignees.map((one) => one.categoryId);
}

/** Does the task's rule (or its single date) fall on the displayed day? */
function ruleMatchesDisplayedDate(task: Task, context: TaskContext): boolean {
  const { displayedDate, zone } = context.options;
  if (task.startsOn === null) return false;
  if (task.rrule === null) return task.startsOn === displayedDate;
  const range = { start: displayedDate, end: displayedDate };
  return ruleDatesIn(parseRule(task.rrule), task.startsOn, range, zone).length > 0;
}

/** The open occurrence of one chain, as a part — empty when there is none. */
function openPartsOf(
  task: Task,
  context: TaskContext,
  assigneeId: string | null,
): OccurrencePart[] {
  const tail =
    context.cursors.find(
      (one) => one.taskId === task.id && one.assigneeId === assigneeId,
    ) ?? null;
  const open = openOccurrence(task, tail, chainStartedOnOf(task, assigneeId, context.options.zone));
  if (open === null) return [];
  return [
    {
      assigneeId,
      scheduledDate: open.date,
      slot: null,
      cyclePrev: tail?.tailId ?? null,
      displayedOn: open.date,
      isLate: false,
    },
  ];
}

/**
 * The day a chain is seeded from: the assignee's own join date, or the task's
 * for an up-for-grabs task's household chain — so adding somebody to a chore
 * whose due date was six months ago starts them today (R309).
 */
function chainStartedOnOf(task: Task, assigneeId: string | null, zone: string): string {
  const row = task.assignees.find((one) => one.categoryId === assigneeId);
  return localDateOf(zone, Date.parse(row?.createdAt ?? task.createdAt));
}

function chainRowsOf(task: Task, context: TaskContext): readonly TaskResolution[] {
  return context.resolutions.filter((row) => row.taskId === task.id);
}

/**
 * An occurrence not scheduled on the day being drawn is drawn there while it is
 * outstanding, and on the day it was resolved — never in between.
 */
function isDrawnOn(
  task: Task,
  context: TaskContext,
  part: OccurrencePart,
  date: string,
): boolean {
  const row = resolutionAt(context.index, keyOf(task, part));
  return row === null || row.resolvedOn === date;
}

function keyOf(task: Task, part: OccurrencePart) {
  return {
    taskId: task.id,
    assigneeId: part.assigneeId,
    occurrenceDate: part.scheduledDate,
    slot: part.slot,
    cyclePrev: part.cyclePrev,
  };
}

function occurrenceOf(task: Task, context: TaskContext, part: OccurrencePart): BoardOccurrence {
  const row = resolutionAt(context.index, keyOf(task, part));
  return {
    taskId: task.id,
    assigneeId: part.assigneeId,
    scheduledDate: part.scheduledDate,
    slot: part.slot,
    cyclePrev: part.cyclePrev,
    displayedDate: part.displayedOn,
    isLate: part.isLate,
    summary: task.summary,
    description: task.description,
    emoji: task.emoji,
    routine: task.routine,
    upForGrabs: task.upForGrabs,
    trackHabit: task.trackHabit,
    dueTime: task.dueTime,
    dueAt: dueAtOf(task, part.scheduledDate, context.options.zone),
    isRepeating: task.rrule !== null || task.renewAfterAmount !== null,
    taskCreatedAt: task.createdAt,
    state: row?.status ?? "unresolved",
    creditedCategoryId: row?.categoryId ?? null,
    // The value as it is NOW, for the chip (004 FR-403); what a completion
    // earned is the ledger's, read by the trigger at that moment (FR-409).
    rewardPoints: task.rewardPoints,
  };
}

/** An all-day, Anytime or routine occurrence carries no clock instant (FR-327). */
function dueAtOf(task: Task, scheduledDate: string | null, zone: string): string | null {
  if (task.dueTime === null || scheduledDate === null) return null;
  return new Date(dueInstantOf(scheduledDate, task.dueTime, zone)).toISOString();
}
