"use client";

import { useId } from "react";

import type { Category, RenewUnit, TimeOfDay, Weekday } from "@/lib/family/types";
import { WEEKDAYS } from "@/lib/family/types";

import { useFamily } from "../../components/FamilyProvider";
import { FIELD, FieldError, LABEL } from "../../components/settings/CategoryFields";
import { useModalDialog } from "../../components/useModalDialog";
import {
  useTaskForm,
  type TaskFormMode,
  type TaskFormSeed,
  type TaskFormState,
  type TaskSubmitOutcome,
} from "./useTaskForm";
import type { TaskInput } from "@/lib/family/validation";

/**
 * Create or edit a task (T053) — FR-330's fields in FR-330's order: title,
 * emoji, description, assignment, task type, the type's own scheduling fields,
 * Up for Grabs (chores only), Track Habit (routines only), "Save to task box" —
 * and after them all, Phase 4's one addition, the Stars field (004 FR-401).
 *
 * **The type toggle swaps the schedule, not the record.** A chore offers a due
 * date and a due time, plus one of two mutually exclusive repeats — Scheduled
 * Date (Every [N] + day/week/month + a position within the unit) or Completed
 * Date (After → Immediately or a custom delay). A routine offers a first day,
 * its own every-N-days-or-weekly repeat, and the Morning / Afternoon / Evening
 * selection of which at least one must be chosen (FR-333, FR-334, US2-7).
 *
 * **The assignment picker lists Profiles only** and withdraws any Profile whose
 * *Show on Tasks tab* switch is off, because such a Profile has no column on
 * any device (FR-313, FR-323, US2-6). A Label is never offered.
 *
 * **The Stars field is one field, on both types** (004 FR-401, SC-401): a whole
 * number 0–500 where blank and 0 alike mean no stars, with the reference's
 * guidance beside it (FR-402). It is `StarsField` below, and the Task Box's
 * template form mounts the same component for its fourth field.
 *
 * The commit is the caller's: `TasksBoard` passes an `onSubmit` that wraps the
 * real action in `withActor(...)`, so punch-in happens at the moment of the
 * write and may answer `null` when the pipeline was abandoned.
 */

export interface TaskFormProps {
  mode: TaskFormMode;
  seed?: TaskFormSeed;
  onSubmit: (input: TaskInput) => Promise<TaskSubmitOutcome>;
  onClose: () => void;
  /**
   * FR-376's **Add → Task Box**: given on the create surface only, it is what
   * makes the Task Box reachable from the tab's one create control. An edit is
   * an edit of an existing task and offers no template shortcut.
   */
  onOpenTaskBox?: () => void;
}

const WEEKDAY_LABELS: Record<Weekday, string> = {
  SU: "Sunday",
  MO: "Monday",
  TU: "Tuesday",
  WE: "Wednesday",
  TH: "Thursday",
  FR: "Friday",
  SA: "Saturday",
};

/** FR-302's three windows, in the canonical order 017's CHECK spells out. */
const SLOTS: { slot: TimeOfDay; label: string }[] = [
  { slot: "morning", label: "Morning" },
  { slot: "afternoon", label: "Afternoon" },
  { slot: "evening", label: "Evening" },
];

const UNIT_LABELS: Record<RenewUnit, string> = { day: "Days", week: "Weeks", month: "Months" };

/** A routine repeats every so many days, or weekly — never monthly (FR-334). */
const ROUTINE_UNITS: RenewUnit[] = ["day", "week"];
const CHORE_UNITS: RenewUnit[] = ["day", "week", "month"];

const SWITCH_ROW = "flex min-h-(--fam-touch) items-center gap-3 text-(length:--fam-fs-body)";
const CHIP =
  "flex min-h-(--fam-touch) items-center gap-2 rounded-full border border-(--fam-hairline) px-3 text-(length:--fam-fs-body)";
const LEGEND = "text-(length:--fam-fs-small) text-(--fam-text-muted)";
const NOTE = "text-(length:--fam-fs-small) text-(--fam-text-secondary)";

/** 004 FR-402's guidance — the reference's own range, put beside the field. */
const STARS_GUIDANCE =
  "Blank or 0 means no stars. A handful for a daily routine, up to a hundred for a big chore.";

function unitOf(value: string): RenewUnit {
  if (value === "week" || value === "month") return value;
  return "day";
}

/** The day of the month a monthly repeat lands on — derived from the anchor, never sent. */
function dayOfMonthOf(startsOn: string): string {
  const day = startsOn.slice(8, 10);
  return day === "" ? "" : String(Number(day));
}

function Switch({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className={SWITCH_ROW}>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-5 w-5"
      />
      {label}
    </label>
  );
}

/**
 * 004 FR-401/FR-402: the star value, as text in and text out — the draft holds
 * what was typed and its translator (`starsOf`) sends a number or nothing. The
 * browser's own range check runs first on a real device; the schema's refusal,
 * when it comes, lands in this block's own slot.
 */
export function StarsField({
  value,
  onChange,
  errors,
}: {
  value: string;
  onChange: (value: string) => void;
  /** The field's refusal, where the surface anchors refusals per field. */
  errors?: string[];
}) {
  const helpId = useId();
  return (
    <div className="flex flex-col gap-1">
      <label className={LABEL}>
        Stars
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={500}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-describedby={helpId}
          className={FIELD}
        />
      </label>
      <p id={helpId} className={NOTE}>
        {STARS_GUIDANCE}
      </p>
      <FieldError messages={errors} />
    </div>
  );
}

/**
 * FR-313 / FR-323 / US2-6: the Profiles this task may be given to. A Label is
 * absent because a task is never given to one, and a Profile switched off the
 * Tasks tab is absent because it has no column to appear in.
 */
function AssignmentPicker({
  form,
  profiles,
}: {
  form: TaskFormState;
  profiles: readonly Category[];
}) {
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className={LEGEND}>Assign to</legend>
      <div className="flex flex-wrap gap-2">
        {profiles.map((profile) => (
          <label key={profile.id} className={CHIP}>
            <input
              type="checkbox"
              checked={form.draft.assigneeIds.includes(profile.id)}
              onChange={() => form.toggleAssignee(profile.id)}
              className="h-5 w-5"
            />
            <span
              aria-hidden="true"
              className="size-3 shrink-0 rounded-full"
              style={{ backgroundColor: profile.color }}
            />
            {profile.label}
          </label>
        ))}
      </div>
      <FieldError messages={form.errors.assigneeIds} />
    </fieldset>
  );
}

/** FR-317's one discriminator, and the only control that changes what is below it. */
function TypeToggle({ form }: { form: TaskFormState }) {
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className={LEGEND}>Task type</legend>
      <div className="flex flex-wrap gap-2">
        {(["chore", "routine"] as const).map((value) => (
          <label key={value} className={CHIP}>
            <input
              type="radio"
              name="task-type"
              checked={form.draft.type === value}
              onChange={() => form.set("type", value)}
              className="size-5 accent-(--fam-primary-blue)"
            />
            {value === "chore" ? "Chore" : "Routine"}
          </label>
        ))}
      </div>
      <FieldError messages={form.errors.routine} />
    </fieldset>
  );
}

function WeekdayBoxes({ form }: { form: TaskFormState }) {
  return (
    <fieldset className="flex flex-wrap gap-x-4 gap-y-1">
      <legend className={LEGEND}>On these days</legend>
      {WEEKDAYS.map((day) => (
        <label key={day} className={SWITCH_ROW}>
          <input
            type="checkbox"
            checked={form.draft.weekdays.includes(day)}
            onChange={() => form.toggleWeekday(day)}
            className="h-5 w-5"
          />
          {WEEKDAY_LABELS[day]}
        </label>
      ))}
    </fieldset>
  );
}

/**
 * "Every [N] + a unit", and the position within that unit. For the weekly kind
 * the position is a real submitted field — the weekdays, more than one allowed.
 * For the monthly kind it is the day of the month, shown READ-ONLY because the
 * emitter derives `BYMONTHDAY` from the anchor and never accepts one.
 */
function EveryFieldset({ form, units }: { form: TaskFormState; units: readonly RenewUnit[] }) {
  const { draft } = form;
  return (
    <>
      <div className="flex flex-wrap gap-3">
        <label className={LABEL}>
          Repeat every
          <input
            type="number"
            min={1}
            max={99}
            value={draft.interval}
            onChange={(event) => form.set("interval", event.target.value)}
            className={FIELD}
          />
        </label>
        <label className={LABEL}>
          Repeat unit
          <select
            value={draft.unit}
            onChange={(event) => form.set("unit", unitOf(event.target.value))}
            className={FIELD}
          >
            {units.map((unit) => (
              <option key={unit} value={unit}>
                {UNIT_LABELS[unit]}
              </option>
            ))}
          </select>
        </label>
      </div>
      {draft.unit === "week" ? <WeekdayBoxes form={form} /> : null}
      {draft.unit === "month" ? (
        <>
          <label className={LABEL}>
            On day of the month
            <input readOnly value={dayOfMonthOf(draft.startsOn)} className={FIELD} />
          </label>
          <p className={NOTE}>
            A month without that date is skipped &mdash; every 3 months from the 31st can leave a
            six-month gap.
          </p>
        </>
      ) : null}
    </>
  );
}

function UntilField({ form }: { form: TaskFormState }) {
  return (
    <label className={LABEL}>
      Repeats until (optional)
      <input
        type="date"
        value={form.draft.until}
        onChange={(event) => form.set("until", event.target.value)}
        className={FIELD}
      />
    </label>
  );
}

/**
 * FR-342–FR-346: the next one is scheduled from the day this one was DONE.
 * Both notes are the two things that are right but not obvious (R303).
 */
function CompletedDateFields({ form }: { form: TaskFormState }) {
  const { draft } = form;
  return (
    <>
      <fieldset className="flex flex-wrap gap-2">
        <legend className={LEGEND}>After</legend>
        {(["immediately", "custom"] as const).map((value) => (
          <label key={value} className={CHIP}>
            <input
              type="radio"
              name="task-delay"
              checked={draft.delay === value}
              onChange={() => form.set("delay", value)}
              className="size-5 accent-(--fam-primary-blue)"
            />
            {value === "immediately" ? "Immediately" : "Custom"}
          </label>
        ))}
      </fieldset>
      {draft.delay === "custom" ? (
        <div className="flex flex-wrap gap-3">
          <label className={LABEL}>
            After how long
            <input
              type="number"
              min={0}
              max={99}
              value={draft.renewAmount}
              onChange={(event) => form.set("renewAmount", event.target.value)}
              className={FIELD}
            />
          </label>
          <label className={LABEL}>
            Delay unit
            <select
              value={draft.renewUnit}
              onChange={(event) => form.set("renewUnit", unitOf(event.target.value))}
              className={FIELD}
            >
              {CHORE_UNITS.map((unit) => (
                <option key={unit} value={unit}>
                  {UNIT_LABELS[unit]}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}
      <p className={NOTE}>
        Changing this moves the next one the next time the board is read, and it can land in the
        past. The due date is only used until this has been done once.
      </p>
      <UntilField form={form} />
    </>
  );
}

/** FR-339: the two repeats are chosen between, never combined. */
function ChoreRepeatFieldset({ form }: { form: TaskFormState }) {
  const { draft } = form;
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className={LEGEND}>Repeat</legend>
      <div className="flex flex-wrap gap-2">
        {(["never", "scheduled", "completed"] as const).map((value) => (
          <label key={value} className={CHIP}>
            <input
              type="radio"
              name="task-repeat-mode"
              checked={draft.repeatMode === value}
              onChange={() => form.set("repeatMode", value)}
              className="size-5 accent-(--fam-primary-blue)"
            />
            {value === "never" ? "Doesn't repeat" : null}
            {value === "scheduled" ? "On a schedule" : null}
            {value === "completed" ? "After it's completed" : null}
          </label>
        ))}
      </div>
      {draft.repeatMode === "scheduled" ? (
        <>
          <EveryFieldset form={form} units={CHORE_UNITS} />
          <UntilField form={form} />
        </>
      ) : null}
      {draft.repeatMode === "completed" ? <CompletedDateFields form={form} /> : null}
      <FieldError messages={form.errors.repeat} />
    </fieldset>
  );
}

/**
 * FR-325's three sub-types, none of which is a field: Timed is a date and a
 * time, All-day is a date alone, Anytime is neither — and an Anytime chore
 * cannot repeat, which the repeat's own refusal says.
 */
function ChoreSchedule({ form }: { form: TaskFormState }) {
  return (
    <>
      <div className="flex flex-wrap gap-3">
        <label className={LABEL}>
          Due date
          <input
            type="date"
            value={form.draft.startsOn}
            onChange={(event) => form.set("startsOn", event.target.value)}
            className={FIELD}
          />
        </label>
        <label className={LABEL}>
          Due time (optional)
          <input
            type="time"
            value={form.draft.dueTime}
            onChange={(event) => form.set("dueTime", event.target.value)}
            className={FIELD}
          />
        </label>
      </div>
      <p className={NOTE}>Leave the date empty for something with no particular day.</p>
      <FieldError messages={form.errors.startsOn} />
      <FieldError messages={form.errors.dueTime} />
      <ChoreRepeatFieldset form={form} />
    </>
  );
}

/** FR-333/FR-335: a routine has a first day, a rule, and at least one slot. */
function RoutineSchedule({ form }: { form: TaskFormState }) {
  return (
    <>
      <label className={LABEL}>
        Starts on
        <input
          type="date"
          value={form.draft.startsOn}
          onChange={(event) => form.set("startsOn", event.target.value)}
          className={FIELD}
        />
      </label>
      <FieldError messages={form.errors.startsOn} />
      <EveryFieldset form={form} units={ROUTINE_UNITS} />
      <UntilField form={form} />
      <fieldset className="flex flex-wrap gap-2">
        <legend className={LEGEND}>Times of day</legend>
        {SLOTS.map(({ slot, label }) => (
          <label key={slot} className={CHIP}>
            <input
              type="checkbox"
              checked={form.draft.timesOfDay.includes(slot)}
              onChange={() => form.toggleSlot(slot)}
              className="h-5 w-5"
            />
            {label}
          </label>
        ))}
      </fieldset>
      <FieldError messages={form.errors.timesOfDay} />
      <FieldError messages={form.errors.repeat} />
    </>
  );
}

function ScheduleFieldset({ form }: { form: TaskFormState }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className={LEGEND}>Schedule</legend>
      {form.draft.type === "routine" ? (
        <RoutineSchedule form={form} />
      ) : (
        <ChoreSchedule form={form} />
      )}
    </fieldset>
  );
}

export function TaskForm({ mode, seed, onSubmit, onClose, onOpenTaskBox }: TaskFormProps) {
  const { profiles } = useFamily();
  const dialogRef = useModalDialog(true, true);

  // FR-313: a Profile switched off the Tasks tab is withdrawn from the picker,
  // which is a household rule and not this device's own filter (FR-383).
  const assignable = profiles.filter((profile) => profile.showOnTasks);

  const form = useTaskForm({ mode, seed, profiles: assignable, onSubmit, onClose });

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    await form.submit();
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="task-form-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className="m-auto w-[min(92vw,34rem)] rounded-(--fam-radius-modal) bg-(--fam-app-bg) p-6 text-(--fam-text-primary) backdrop:bg-black/30"
    >
      <div className="flex items-center justify-between gap-3">
        <h2
          id="task-form-title"
          className="font-(family-name:--fam-font-serif) text-(length:--fam-fs-title)"
        >
          {mode === "create" ? "Add a task" : "Edit task"}
        </h2>
        {/* FR-376: Add → Task Box, from the create surface only. */}
        {onOpenTaskBox === undefined ? null : (
          <button
            type="button"
            onClick={onOpenTaskBox}
            className="min-h-(--fam-touch) rounded-full bg-(--fam-pill-btn-bg) px-4 text-(length:--fam-fs-pill) font-medium text-(--fam-text-muted)"
          >
            Task Box
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label className={LABEL}>
            Title
            <input
              value={form.draft.summary}
              onChange={(event) => form.set("summary", event.target.value)}
              maxLength={120}
              className={FIELD}
            />
          </label>
          <FieldError messages={form.errors.summary} />
        </div>

        <div className="flex flex-col gap-1">
          <label className={LABEL}>
            Emoji (optional)
            <input
              value={form.draft.emoji}
              onChange={(event) => form.set("emoji", event.target.value)}
              maxLength={16}
              className={FIELD}
            />
          </label>
          <FieldError messages={form.errors.emoji} />
        </div>

        <div className="flex flex-col gap-1">
          <label className={LABEL}>
            Description (optional)
            <textarea
              value={form.draft.description}
              onChange={(event) => form.set("description", event.target.value)}
              maxLength={2000}
              rows={3}
              className={`${FIELD} py-2`}
            />
          </label>
          <FieldError messages={form.errors.description} />
        </div>

        <AssignmentPicker form={form} profiles={assignable} />
        <TypeToggle form={form} />
        <ScheduleFieldset form={form} />

        {form.draft.type === "chore" ? (
          <div className="flex flex-col gap-1">
            <Switch
              label="Up for Grabs"
              checked={form.draft.upForGrabs}
              onChange={(value) => form.set("upForGrabs", value)}
            />
            <FieldError messages={form.errors.upForGrabs} />
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <Switch
              label="Track Habit"
              checked={form.draft.trackHabit}
              onChange={(value) => form.set("trackHabit", value)}
            />
            <FieldError messages={form.errors.trackHabit} />
          </div>
        )}

        {mode === "create" ? (
          <Switch
            label="Save to task box"
            checked={form.draft.saveToTaskBox}
            onChange={(value) => form.set("saveToTaskBox", value)}
          />
        ) : null}

        {/* 004 FR-401: after the fields Phase 3 shipped, on both types. */}
        <StarsField
          value={form.draft.rewardPoints}
          onChange={(value) => form.set("rewardPoints", value)}
          errors={form.errors.rewardPoints}
        />

        <p
          role="alert"
          className="empty:hidden text-(length:--fam-fs-body) text-(--fam-text-primary)"
        >
          {/* A field-anchored refusal is shown at its field; repeating it here
              would say the same sentence twice. */}
          {Object.keys(form.errors).length > 0 ? null : form.message}
        </p>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="min-h-(--fam-touch) rounded-full border border-(--fam-hairline) px-5 text-(length:--fam-fs-body) font-medium"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={form.pending}
            className="min-h-(--fam-touch) rounded-full bg-(--fam-primary-blue) px-5 text-(length:--fam-fs-body) font-medium text-white disabled:opacity-60"
          >
            Save
          </button>
        </div>
      </form>
    </dialog>
  );
}
