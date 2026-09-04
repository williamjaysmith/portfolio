/**
 * Database row shapes for the `family` schema (snake_case, exactly as
 * PostgREST returns them) and the mappers to the camelCase domain types.
 *
 * Keep the selected column lists here too, so no query ever uses `select('*')`
 * — the column set is part of the privacy contract (nothing PIN-related is
 * ever selected; it does not exist on `categories` at all).
 */

import type { PaletteColor } from "./colors";
import type {
  AvatarKind,
  Category,
  Density,
  Event,
  EventException,
  EventTimes,
  ExceptionAction,
  Household,
  HouseholdSettings,
  RenewUnit,
  ResolutionStatus,
  Role,
  Task,
  TaskAssignee,
  TaskBoxItem,
  TaskCursor,
  TaskResolution,
  TextSize,
  TimeFormat,
  TimeOfDay,
  WeekStart,
} from "./types";

export interface HouseholdRow {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface CategoryRow {
  id: string;
  household_id: string;
  label: string;
  color: string;
  is_profile: boolean;
  avatar_kind: AvatarKind | null;
  avatar_id: string | null;
  avatar_path: string | null;
  birthday: string | null;
  dietary_prefs: string | null;
  role: Role;
  user_id: string | null;
  emoji: string | null;
  show_on_tasks: boolean;
  sort_order: number | string;
  has_pin: boolean;
  created_at: string;
  updated_at: string;
}

export interface HouseholdSettingsRow {
  household_id: string;
  show_name_not_date: boolean;
  time_format: TimeFormat;
  start_week_on: WeekStart;
  punch_out_minutes: number;
  text_size: TextSize;
  density: Density;
  timezone: string;
  updated_at: string;
}

export interface EventRow {
  id: string;
  household_id: string;
  summary: string;
  description: string | null;
  location: string | null;
  all_day: boolean;
  starts_at: string | null;
  ends_at: string | null;
  start_date: string | null;
  end_date: string | null;
  timezone: string;
  rrule: string | null;
  countdown_enabled: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface EventCategoryRow {
  event_id: string;
  category_id: string;
  household_id: string;
  position: number;
  created_at: string;
}

export interface EventExceptionRow {
  id: string;
  household_id: string;
  event_id: string;
  occurrence_date: string;
  action: ExceptionAction;
  summary: string | null;
  description: string | null;
  location: string | null;
  starts_at: string | null;
  ends_at: string | null;
  start_date: string | null;
  end_date: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * The week read always embeds the ordered links and EVERY exception with each
 * event row — that totality is what makes a moved occurrence findable (R206).
 */
export interface EventWithRelationsRow extends EventRow {
  event_categories: EventCategoryRow[];
  event_exceptions: EventExceptionRow[];
}

export const HOUSEHOLD_COLUMNS = "id, name, created_at, updated_at";

export const CATEGORY_COLUMNS =
  "id, household_id, label, color, is_profile, avatar_kind, avatar_id, avatar_path, " +
  "birthday, dietary_prefs, role, user_id, emoji, show_on_tasks, sort_order, has_pin, " +
  "created_at, updated_at";

export const SETTINGS_COLUMNS =
  "household_id, show_name_not_date, time_format, start_week_on, punch_out_minutes, " +
  "text_size, density, timezone, updated_at";

export const EVENT_COLUMNS =
  "id, household_id, summary, description, location, all_day, starts_at, ends_at, " +
  "start_date, end_date, timezone, rrule, countdown_enabled, created_by, updated_by, " +
  "created_at, updated_at";

export const EVENT_CATEGORY_COLUMNS = "event_id, category_id, household_id, position, created_at";

export const EVENT_EXCEPTION_COLUMNS =
  "id, household_id, event_id, occurrence_date, action, summary, description, location, " +
  "starts_at, ends_at, start_date, end_date, created_by, updated_by, created_at, updated_at";

/**
 * The events select with its two embeds, as one joined array rather than two
 * adjacent template literals.
 *
 * It was written as `` `…event_categories(${…}), ` + `event_exceptions(${…})` ``
 * and that shipped broken: the production bundler folded the two literals and
 * dropped the `), ` between them, so every client-side week read returned
 * PGRST100 while dev and the server render — unminified — were fine. Joining a
 * list has no adjacent-literal seam to lose.
 */
export function eventsSelect(): string {
  return [
    EVENT_COLUMNS,
    `event_categories(${EVENT_CATEGORY_COLUMNS})`,
    `event_exceptions(${EVENT_EXCEPTION_COLUMNS})`,
  ].join(",");
}

export function toHousehold(row: HouseholdRow): Household {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    householdId: row.household_id,
    label: row.label,
    // The domain constraint guarantees this; the cast keeps the type honest
    // without re-validating on every read.
    color: row.color as PaletteColor,
    isProfile: row.is_profile,
    avatarKind: row.avatar_kind,
    avatarId: row.avatar_id,
    avatarPath: row.avatar_path,
    birthday: row.birthday,
    dietaryPrefs: row.dietary_prefs,
    role: row.role,
    userId: row.user_id,
    emoji: row.emoji,
    showOnTasks: row.show_on_tasks,
    // `numeric` arrives as a string from PostgREST.
    sortOrder: Number(row.sort_order),
    hasPin: row.has_pin,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toSettings(row: HouseholdSettingsRow): HouseholdSettings {
  return {
    householdId: row.household_id,
    showNameNotDate: row.show_name_not_date,
    timeFormat: row.time_format,
    startWeekOn: row.start_week_on,
    punchOutMinutes: row.punch_out_minutes,
    textSize: row.text_size,
    density: row.density,
    timezone: row.timezone,
    updatedAt: row.updated_at,
  };
}

// The event_time_shape CHECK guarantees exactly one populated pair per
// all_day; the casts keep the type honest without re-validating on every read.
function toEventTimes(row: EventRow): EventTimes {
  if (row.all_day) {
    return { allDay: true, startDate: row.start_date as string, endDate: row.end_date as string };
  }
  return { allDay: false, startsAt: row.starts_at as string, endsAt: row.ends_at as string };
}

// exception_time_shape: pairs arrive whole and at most one shape; both pairs
// absent = the occurrence keeps the series' time.
function toExceptionTimes(row: EventExceptionRow): EventTimes | null {
  if (row.starts_at !== null) {
    return { allDay: false, startsAt: row.starts_at, endsAt: row.ends_at as string };
  }
  if (row.start_date !== null) {
    return { allDay: true, startDate: row.start_date, endDate: row.end_date as string };
  }
  return null;
}

export function toEventException(row: EventExceptionRow): EventException {
  return {
    id: row.id,
    eventId: row.event_id,
    householdId: row.household_id,
    occurrenceDate: row.occurrence_date,
    action: row.action,
    summary: row.summary,
    description: row.description,
    location: row.location,
    times: toExceptionTimes(row),
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toEvent(row: EventWithRelationsRow): Event {
  return {
    id: row.id,
    householdId: row.household_id,
    summary: row.summary,
    description: row.description,
    location: row.location,
    times: toEventTimes(row),
    timezone: row.timezone,
    rrule: row.rrule,
    countdownEnabled: row.countdown_enabled,
    // PostgREST embed order is unspecified; `position` is the draw order (FR-227).
    categoryIds: [...row.event_categories]
      .sort((a, b) => a.position - b.position)
      .map((link) => link.category_id),
    exceptions: [...row.event_exceptions]
      .sort((a, b) => a.occurrence_date.localeCompare(b.occurrence_date))
      .map(toEventException),
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/* ------------------------------------------------------------------------- *
 * Tasks (Phase 3 — specs/003-family-tasks)
 * ------------------------------------------------------------------------- */

/** `reward_points` is absent by design — nothing this phase reads it (FR-329, SC-319). */
export interface TaskRow {
  id: string;
  household_id: string;
  summary: string;
  description: string | null;
  emoji: string | null;
  routine: boolean;
  up_for_grabs: boolean;
  track_habit: boolean;
  starts_on: string | null;
  due_time: string | null;
  times_of_day: TimeOfDay[];
  rrule: string | null;
  renew_after_amount: number | null;
  renew_after_unit: RenewUnit | null;
  renew_until: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskAssigneeRow {
  household_id: string;
  task_id: string;
  category_id: string;
  sort_order: number | string;
  streak_count: number;
  streak_through: string | null;
  created_at: string;
}

/** The board read embeds a task's assignees with their streak pair (R314). */
export interface TaskWithAssigneesRow extends TaskRow {
  task_assignees: TaskAssigneeRow[];
}

export interface TaskResolutionRow {
  id: string;
  household_id: string;
  task_id: string;
  occurrence_date: string | null;
  occurrence_slot: TimeOfDay | null;
  assignee_id: string | null;
  category_id: string | null;
  cycle_prev: string | null;
  status: ResolutionStatus;
  resolved_on: string;
  resolved_at: string;
  created_by: string | null;
  created_at: string;
}

/** `family.task_cursors` — a view, so it has no id of its own beyond the tail's. */
export interface TaskCursorRow {
  household_id: string;
  task_id: string;
  assignee_id: string | null;
  tail_id: string;
  tail_resolved_on: string;
}

/** `reward_points` is absent by design (FR-377, SC-319). */
export interface TaskBoxItemRow {
  id: string;
  household_id: string;
  summary: string;
  emoji: string | null;
  routine: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export const TASK_COLUMNS =
  "id, household_id, summary, description, emoji, routine, up_for_grabs, track_habit, " +
  "starts_on, due_time, times_of_day, rrule, renew_after_amount, renew_after_unit, " +
  "renew_until, created_by, updated_by, created_at, updated_at";

export const TASK_ASSIGNEE_COLUMNS =
  "household_id, task_id, category_id, sort_order, streak_count, streak_through, created_at";

export const TASK_RESOLUTION_COLUMNS =
  "id, household_id, task_id, occurrence_date, occurrence_slot, assignee_id, category_id, " +
  "cycle_prev, status, resolved_on, resolved_at, created_by, created_at";

export const TASK_CURSOR_COLUMNS =
  "household_id, task_id, assignee_id, tail_id, tail_resolved_on";

export const TASK_BOX_COLUMNS =
  "id, household_id, summary, emoji, routine, created_by, updated_by, created_at, updated_at";

/**
 * The tasks select with its one embed, built as a joined list rather than
 * adjacent template literals — the production bundler folds those and drops the
 * separator between them, which shipped as PGRST100 on every client-side read
 * (see `eventsSelect`).
 */
export function tasksSelect(): string {
  return [TASK_COLUMNS, `task_assignees(${TASK_ASSIGNEE_COLUMNS})`].join(",");
}

function toTaskAssignee(row: TaskAssigneeRow): TaskAssignee {
  return {
    taskId: row.task_id,
    householdId: row.household_id,
    categoryId: row.category_id,
    // `numeric` arrives as a string from PostgREST.
    sortOrder: Number(row.sort_order),
    streakCount: row.streak_count,
    streakThrough: row.streak_through,
    createdAt: row.created_at,
  };
}

/**
 * PostgREST renders `time` as `HH:MM:SS`; the domain type is the `HH:MM` wall
 * clock the action wrote, and validation admits no seconds (FR-326).
 */
function toDueTime(value: string | null): string | null {
  return value === null ? null : value.slice(0, 5);
}

export function toTask(row: TaskWithAssigneesRow): Task {
  return {
    id: row.id,
    householdId: row.household_id,
    summary: row.summary,
    description: row.description,
    emoji: row.emoji,
    routine: row.routine,
    upForGrabs: row.up_for_grabs,
    trackHabit: row.track_habit,
    startsOn: row.starts_on,
    dueTime: toDueTime(row.due_time),
    timesOfDay: [...row.times_of_day],
    rrule: row.rrule,
    renewAfterAmount: row.renew_after_amount,
    renewAfterUnit: row.renew_after_unit,
    renewUntil: row.renew_until,
    // PostgREST embed order is unspecified and the expander's output order
    // follows this one, so it is pinned rather than inherited.
    assignees: [...row.task_assignees]
      .sort((a, b) => a.category_id.localeCompare(b.category_id))
      .map(toTaskAssignee),
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toTaskResolution(row: TaskResolutionRow): TaskResolution {
  return {
    id: row.id,
    householdId: row.household_id,
    taskId: row.task_id,
    occurrenceDate: row.occurrence_date,
    occurrenceSlot: row.occurrence_slot,
    assigneeId: row.assignee_id,
    categoryId: row.category_id,
    cyclePrev: row.cycle_prev,
    status: row.status,
    resolvedOn: row.resolved_on,
    resolvedAt: row.resolved_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

export function toTaskCursor(row: TaskCursorRow): TaskCursor {
  return {
    householdId: row.household_id,
    taskId: row.task_id,
    assigneeId: row.assignee_id,
    tailId: row.tail_id,
    tailResolvedOn: row.tail_resolved_on,
  };
}

export function toTaskBoxItem(row: TaskBoxItemRow): TaskBoxItem {
  return {
    id: row.id,
    householdId: row.household_id,
    summary: row.summary,
    emoji: row.emoji,
    routine: row.routine,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
