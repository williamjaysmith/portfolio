"use client";

import { useState } from "react";

import type { FieldErrors } from "@/lib/family/errors";
import { taskRepeatChoiceOf } from "@/lib/family/tasks/repeat";
import {
  WEEKDAYS,
  type Category,
  type RenewUnit,
  type Task,
  type TaskRepeatChoice,
  type TimeOfDay,
  type Weekday,
} from "@/lib/family/types";
import { parseOrThrow, taskInputSchema, type TaskInput } from "@/lib/family/validation";

import {
  settleSubmit,
  toggled,
  useSubmission,
  type Settled,
  type SubmitOutcome,
} from "../../components/formSubmit";

/**
 * Draft state + submit machinery for the task form (T053).
 *
 * The draft speaks the FORM's vocabulary — a type toggle, a repeat mode, a
 * number and a unit laid flat — and `draftToTaskInput` translates it into the
 * contract's `TaskInput` exactly once, at submit. The rrule string never
 * appears here: the client sends the structured `TaskRepeatChoice` and the
 * server-side emitter is the sole producer of rule text (R201/R301).
 *
 * Validation is the SAME schema the action runs (`taskInputSchema`), so a
 * refusal the server would give lands against its field before the network is
 * touched, and the two layers cannot disagree (FR-330). Nothing else is
 * pre-checked: FR-350's rule is that the server is the gate.
 *
 * **A chore's due date and a routine's first day are one field**, because they
 * are one column (`tasks.starts_on`). The toggle swaps which controls are
 * offered, not which record is being built.
 */

/** FR-317's one discriminator, as the toggle spells it. */
export type TaskTypeChoice = "chore" | "routine";

/** FR-339's two mutually exclusive chore repeats, plus not repeating at all. */
export type ChoreRepeatMode = "never" | "scheduled" | "completed";

/** FR-342: "Immediately" is a delay of zero, not the absence of one. */
export type DelayChoice = "immediately" | "custom";

export interface TaskDraft {
  summary: string;
  emoji: string;
  description: string;
  /** The picked Profile ids; the submitted order is the household's draw order. */
  assigneeIds: string[];
  type: TaskTypeChoice;
  /** Chores only (FR-365). */
  upForGrabs: boolean;
  /** Routines only (FR-337). */
  trackHabit: boolean;
  /** `tasks.starts_on`: a chore's due date, a routine's first day. `""` = Anytime. */
  startsOn: string;
  /** `HH:MM` household wall clock; `""` = an all-day chore (FR-325, FR-326). */
  dueTime: string;
  repeatMode: ChoreRepeatMode;
  /** "Every [N]" — kept as text so a half-typed number is not silently repaired. */
  interval: string;
  /** The unit that "Every [N]" counts; a routine offers day and week only (FR-334). */
  unit: RenewUnit;
  /** The position within the week — a real submitted field for the weekly kind alone. */
  weekdays: Weekday[];
  /** `""` = the repeat never ends (FR-346). */
  until: string;
  delay: DelayChoice;
  renewAmount: string;
  renewUnit: RenewUnit;
  /** A routine's slots (FR-335); a chore carries none. */
  timesOfDay: TimeOfDay[];
  /** FR-379, and a create-time choice only. */
  saveToTaskBox: boolean;
  /**
   * 004 FR-401's star value as typed — text, so a half-typed number is not
   * silently repaired. `""` is none; `starsOf` sends a number or null (FR-402).
   */
  rewardPoints: string;
}

/** Prefill — the task being edited (T057), or a Task Box template (T072). */
export type TaskFormSeed = Partial<TaskDraft>;

/**
 * What the caller's commit hands back. A result is shown or closed on as usual;
 * `null` means there is nothing for the form to show — the pipeline was
 * abandoned before any write, or the caller already took the outcome over
 * (FR-393's "no longer exists" closes the form itself).
 */
export type TaskSubmitOutcome = SubmitOutcome;

/** 017's `task_slots_shape` spells this order out; the form emits it. */
const SLOT_ORDER = ["morning", "afternoon", "evening"] as const satisfies readonly TimeOfDay[];

function blankDraft(): TaskDraft {
  return {
    summary: "",
    emoji: "",
    description: "",
    assigneeIds: [],
    type: "chore",
    upForGrabs: false,
    trackHabit: false,
    startsOn: "",
    dueTime: "",
    repeatMode: "never",
    interval: "1",
    unit: "day",
    weekdays: [],
    until: "",
    delay: "immediately",
    renewAmount: "1",
    renewUnit: "day",
    timesOfDay: [],
    saveToTaskBox: false,
    rewardPoints: "",
  };
}

/** Blank optional text means "not set", stored as NULL. */
function orNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * A typed number as the schema will judge it. A blank or malformed box yields
 * `NaN`, which `taskInputSchema` refuses against its own field rather than
 * being quietly rounded into a value nobody chose.
 */
function intOf(value: string): number {
  return value.trim() === "" ? Number.NaN : Number(value);
}

/**
 * The star value as the schema will judge it (004 FR-402): a blank box is none,
 * and anything else is sent as a NUMBER — never as the typed text, which the
 * schema refuses — so `0` and blank both reach the store as null, and a
 * malformed entry is refused against its own field rather than repaired.
 * Shared with the Task Box's template form, which holds the same field.
 */
export function starsOf(value: string): number | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : Number(trimmed);
}

/** The reverse, for a pre-fill: a stored value as the text the box shows. */
export function starsTextOf(value: number | null): string {
  return value === null ? "" : String(value);
}

/** Sunday-first, matching `WKST=SU` — a stable order however the boxes were ticked. */
function sortedWeekdays(days: readonly Weekday[]): Weekday[] {
  return [...days].sort((a, b) => WEEKDAYS.indexOf(a) - WEEKDAYS.indexOf(b));
}

function sortedSlots(slots: readonly TimeOfDay[]): TimeOfDay[] {
  return SLOT_ORDER.filter((slot) => slots.includes(slot));
}

/** "Every [N] + a unit", the shape a routine and a Scheduled Date chore share. */
function ruleRepeatOf(draft: TaskDraft, until: string | null): TaskRepeatChoice {
  const interval = intOf(draft.interval);
  if (draft.unit === "week") {
    return { kind: "weekly", interval, weekdays: sortedWeekdays(draft.weekdays), until };
  }
  if (draft.unit === "month") return { kind: "monthly", interval, until };
  return { kind: "daily", interval, until };
}

/**
 * FR-334 and FR-339–FR-346. A routine always repeats on a rule; a chore picks
 * one of the two modes, or neither.
 */
function repeatOf(draft: TaskDraft): TaskRepeatChoice {
  const until = draft.until === "" ? null : draft.until;
  if (draft.type === "routine") return ruleRepeatOf(draft, until);
  if (draft.repeatMode === "never") return { kind: "never" };
  if (draft.repeatMode === "scheduled") return ruleRepeatOf(draft, until);
  return {
    kind: "after_completion",
    amount: draft.delay === "immediately" ? 0 : intOf(draft.renewAmount),
    unit: draft.renewUnit,
    until,
  };
}

/**
 * The draft as `createTask` expects it. The four chore sub-types are not a
 * field (FR-325): Timed is a date and a time, All-day is a date alone, Anytime
 * is neither, and Late is never written at all.
 */
function draftToTaskInput(
  draft: TaskDraft,
  orderedAssigneeIds: string[],
  mode: TaskFormMode,
): TaskInput {
  const routine = draft.type === "routine";
  return {
    summary: draft.summary,
    description: orNull(draft.description),
    emoji: orNull(draft.emoji),
    routine,
    assigneeIds: orderedAssigneeIds,
    upForGrabs: !routine && draft.upForGrabs,
    trackHabit: routine && draft.trackHabit,
    startsOn: draft.startsOn === "" ? null : draft.startsOn,
    dueTime: routine || draft.dueTime === "" ? null : draft.dueTime,
    timesOfDay: routine ? sortedSlots(draft.timesOfDay) : [],
    repeat: repeatOf(draft),
    rewardPoints: starsOf(draft.rewardPoints),
    // "Save to task box" is a create-time choice, and `updateTask` refuses it.
    ...(mode === "create" ? { saveToTaskBox: draft.saveToTaskBox } : {}),
  };
}

/**
 * A stored task as the draft that would have produced it, so the edit form
 * shows the repeat the task actually has rather than offering "doesn't repeat"
 * over a weekly chore. The decode of the rule itself is `taskRepeatChoiceOf`,
 * shared with `updateTask`'s merge.
 */
export function taskDraftOf(task: Task, zone: string): TaskFormSeed {
  const repeat = taskRepeatChoiceOf(task, zone);
  return {
    summary: task.summary,
    emoji: task.emoji ?? "",
    description: task.description ?? "",
    assigneeIds: [...task.assignees]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((one) => one.categoryId),
    type: task.routine ? "routine" : "chore",
    upForGrabs: task.upForGrabs,
    trackHabit: task.trackHabit,
    startsOn: task.startsOn ?? "",
    dueTime: task.dueTime ?? "",
    timesOfDay: [...task.timesOfDay],
    rewardPoints: starsTextOf(task.rewardPoints),
    ...repeatSeedOf(repeat),
  };
}

/** The repeat's own draft fields — the reverse of `repeatOf`, field by field. */
function repeatSeedOf(repeat: TaskRepeatChoice): TaskFormSeed {
  if (repeat.kind === "never") return { repeatMode: "never" };
  const until = repeat.until ?? "";
  if (repeat.kind === "after_completion") {
    return {
      repeatMode: "completed",
      delay: repeat.amount === 0 ? "immediately" : "custom",
      renewAmount: String(repeat.amount),
      renewUnit: repeat.unit,
      until,
    };
  }
  return {
    repeatMode: "scheduled",
    interval: String(repeat.interval),
    unit: repeat.kind === "weekly" ? "week" : repeat.kind === "monthly" ? "month" : "day",
    weekdays: repeat.kind === "weekly" ? [...repeat.weekdays] : [],
    until,
  };
}

/**
 * Validate locally with the action's own schema, then hand the parsed input to
 * the caller (`settleSubmit`). A refusal is what the form must show, leaving
 * every other entry exactly as typed (FR-330, US2-4).
 */
function validateAndSubmit(draft: TaskDraft, options: UseTaskFormOptions): Promise<Settled> {
  const orderedIds = options.profiles
    .filter((profile) => draft.assigneeIds.includes(profile.id))
    .map((profile) => profile.id);
  return settleSubmit(
    () => parseOrThrow(taskInputSchema, draftToTaskInput(draft, orderedIds, options.mode)),
    options.onSubmit,
  );
}

export type TaskFormMode = "create" | "edit";

export interface UseTaskFormOptions {
  mode: TaskFormMode;
  seed?: TaskFormSeed;
  /** The Profiles this task may be given to, in the household's draw order (FR-313, FR-323). */
  profiles: readonly Category[];
  /**
   * The commit — the board routes it through `withActor(...)` to the real
   * action so punch-in arrives at the moment of the write; tests drive a mock.
   */
  onSubmit: (input: TaskInput) => Promise<TaskSubmitOutcome>;
  onClose: () => void;
}

export interface TaskFormState {
  draft: TaskDraft;
  set: <K extends keyof TaskDraft>(key: K, value: TaskDraft[K]) => void;
  toggleAssignee: (id: string) => void;
  toggleWeekday: (day: Weekday) => void;
  toggleSlot: (slot: TimeOfDay) => void;
  errors: FieldErrors;
  message: string | null;
  pending: boolean;
  submit: () => Promise<void>;
}

export function useTaskForm(options: UseTaskFormOptions): TaskFormState {
  const [draft, setDraft] = useState<TaskDraft>(() => ({ ...blankDraft(), ...options.seed }));
  const { errors, message, pending, submit: run } = useSubmission(options.onClose);

  function set<K extends keyof TaskDraft>(key: K, value: TaskDraft[K]): void {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function toggleAssignee(id: string): void {
    setDraft((current) => ({ ...current, assigneeIds: toggled(current.assigneeIds, id) }));
  }

  function toggleWeekday(day: Weekday): void {
    setDraft((current) => ({ ...current, weekdays: toggled(current.weekdays, day) }));
  }

  function toggleSlot(slot: TimeOfDay): void {
    setDraft((current) => ({ ...current, timesOfDay: toggled(current.timesOfDay, slot) }));
  }

  const submit = (): Promise<void> => run(() => validateAndSubmit(draft, options));

  return {
    draft,
    set,
    toggleAssignee,
    toggleWeekday,
    toggleSlot,
    errors,
    message,
    pending,
    submit,
  };
}
