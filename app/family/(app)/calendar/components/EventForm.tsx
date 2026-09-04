"use client";

import { useEffect } from "react";

import type { FieldErrors } from "@/lib/family/errors";
import { WEEKDAYS, type Category, type EventInput, type Weekday } from "@/lib/family/types";

import { useFamily } from "../../components/FamilyProvider";
import { FIELD, FieldError, LABEL } from "../../components/settings/CategoryFields";
import { useModalDialog } from "../../components/useModalDialog";
import {
  useEventForm,
  type EventFormSeed,
  type EventFormState,
  type RepeatKind,
  type SubmitOutcome,
} from "./useEventForm";

/**
 * Create or edit an event (T046) — the fields of FR-259 in FR-259's order:
 * title; the all-day switch with start and end; repeat and repeat-until; one
 * combined Profiles-and-Labels picker (FR-260); location; notes (FR-221).
 *
 * Deliberately absent: invited emails (FR-229), reminders (FR-230), the
 * photo/voice/email input row (FR-261), and any timezone picker (FR-224).
 *
 * The commit is the caller's: `useCalendarEditor` passes an `onSubmit` that
 * wraps the real action in `withActor(...)` so punch-in happens on demand at
 * the moment of the write (FR-248/270/275), and that may answer `null` when
 * the pipeline was abandoned with nothing written (see `SubmitOutcome`).
 */

export interface EventFormProps {
  mode: "create" | "edit";
  seed?: EventFormSeed;
  onSubmit: (input: EventInput) => Promise<SubmitOutcome>;
  onClose: () => void;
}

/** Sunday-first to match `WKST=SU` and the household's default week. */
const WEEKDAY_LABELS: Record<Weekday, string> = {
  SU: "Sunday",
  MO: "Monday",
  TU: "Tuesday",
  WE: "Wednesday",
  TH: "Thursday",
  FR: "Friday",
  SA: "Saturday",
};

/** FR-231's exact four choices — no interval, no count (FR-232). */
const REPEAT_OPTIONS: { value: RepeatKind; label: string }[] = [
  { value: "never", label: "Never" },
  { value: "daily", label: "Every day" },
  { value: "weekly", label: "Every week on chosen weekdays" },
  { value: "monthly", label: "Every month on the date" },
];

function repeatKindOf(value: string): RepeatKind {
  return REPEAT_OPTIONS.find((option) => option.value === value)?.value ?? "never";
}

/** The first non-empty message list — a shape-dependent field has two possible keys. */
function messagesFor(errors: FieldErrors, ...keys: string[]): string[] | undefined {
  for (const key of keys) {
    const messages = errors[key];
    if (messages && messages.length > 0) return messages;
  }
  return undefined;
}

const SWITCH_ROW = "flex min-h-[44px] items-center gap-3 text-(length:--fam-fs-body)";

/**
 * The all-day switch and the start/end controls it governs (US2-3): timed
 * shows date + time per edge; all-day swaps the time boxes away and keeps the
 * dates. The end always carries its OWN date (FR-222) so a Friday 22:00 →
 * Saturday 01:00 event is entered plainly; the hook keeps it defaulted to the
 * start's until it is set apart.
 */
function TimesFieldset({ form }: { form: EventFormState }) {
  const { draft, set, setStartDate, errors } = form;
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="sr-only">When</legend>
      <label className={SWITCH_ROW}>
        <input
          type="checkbox"
          role="switch"
          checked={draft.allDay}
          onChange={(event) => set("allDay", event.target.checked)}
          className="h-5 w-5"
        />
        All day
      </label>
      <div className="flex flex-wrap gap-3">
        <label className={LABEL}>
          Start date
          <input
            type="date"
            value={draft.startDate}
            onChange={(event) => setStartDate(event.target.value)}
            required
            className={FIELD}
          />
        </label>
        {draft.allDay ? null : (
          <label className={LABEL}>
            Start time
            <input
              type="time"
              value={draft.startTime}
              onChange={(event) => set("startTime", event.target.value)}
              required
              className={FIELD}
            />
          </label>
        )}
      </div>
      <FieldError messages={messagesFor(errors, "startDate", "startsAt")} />
      <div className="flex flex-wrap gap-3">
        <label className={LABEL}>
          End date
          <input
            type="date"
            value={draft.endDate}
            onChange={(event) => set("endDate", event.target.value)}
            required
            className={FIELD}
          />
        </label>
        {draft.allDay ? null : (
          <label className={LABEL}>
            End time
            <input
              type="time"
              value={draft.endTime}
              onChange={(event) => set("endTime", event.target.value)}
              required
              className={FIELD}
            />
          </label>
        )}
      </div>
      <FieldError messages={messagesFor(errors, "endDate", "endsAt")} />
    </fieldset>
  );
}

/**
 * FR-231/232: the four choices, weekday boxes for weekly only, and an
 * optional "repeats until" date for every repeating kind — never a count.
 * Refusals about the repeat (empty weekdays, until before the start) arrive
 * under the single `repeat` key, shown once here.
 */
function RepeatFieldset({ form }: { form: EventFormState }) {
  const { draft, set, setRepeatKind, toggleWeekday, errors } = form;
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="sr-only">Repeat</legend>
      <label className={LABEL}>
        Repeats
        <select
          value={draft.repeatKind}
          onChange={(event) => setRepeatKind(repeatKindOf(event.target.value))}
          className={FIELD}
        >
          {REPEAT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      {draft.repeatKind === "weekly" ? (
        <fieldset className="flex flex-wrap gap-x-4 gap-y-1">
          <legend className="text-(length:--fam-fs-small) text-(--fam-text-muted)">On</legend>
          {WEEKDAYS.map((day) => (
            <label key={day} className={SWITCH_ROW}>
              <input
                type="checkbox"
                checked={draft.weekdays.includes(day)}
                onChange={() => toggleWeekday(day)}
                className="h-5 w-5"
              />
              {WEEKDAY_LABELS[day]}
            </label>
          ))}
        </fieldset>
      ) : null}
      {draft.repeatKind === "never" ? null : (
        <label className={LABEL}>
          Repeats until (optional)
          <input
            type="date"
            value={draft.until}
            onChange={(event) => set("until", event.target.value)}
            className={FIELD}
          />
        </label>
      )}
      <FieldError messages={errors.repeat} />
    </fieldset>
  );
}

/**
 * One combined picker for Profiles and Labels (FR-260), listed in the
 * household's draw order — the same order the submitted ids carry, which is
 * the stripe draw order (FR-227). Zero selections is a valid event (FR-213).
 */
function CategoryPicker({
  form,
  categories,
}: {
  form: EventFormState;
  categories: readonly Category[];
}) {
  const { draft, toggleCategory, errors } = form;
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="text-(length:--fam-fs-small) text-(--fam-text-muted)">
        Profiles & Labels
      </legend>
      <div className="flex flex-wrap gap-2">
        {categories.map((category) => (
          <label
            key={category.id}
            className="flex min-h-[44px] items-center gap-2 rounded-full border border-(--fam-hairline) px-3 text-(length:--fam-fs-body)"
          >
            <input
              type="checkbox"
              checked={draft.categoryIds.includes(category.id)}
              onChange={() => toggleCategory(category.id)}
              className="h-5 w-5"
            />
            <span
              aria-hidden="true"
              className="h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: category.color }}
            />
            {category.label}
          </label>
        ))}
      </div>
      <FieldError messages={errors.categoryIds} />
    </fieldset>
  );
}

export function EventForm({ mode, seed, onSubmit, onClose }: EventFormProps) {
  const { categories, settings } = useFamily();

  // Hands the keyboard back to whatever opened the dialog once it goes away —
  // the CategoryForm reasoning (SC-009); the form is unmounted, not closed,
  // so nothing else restores focus. Runs before `useModalDialog` takes it.
  useEffect(() => {
    const opener = document.activeElement;
    return () => {
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, []);
  const dialogRef = useModalDialog(true);

  const form = useEventForm({
    seed,
    categories,
    householdTimezone: settings.timezone,
    onSubmit,
    onClose,
  });

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    await form.submit();
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="event-form-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className="m-auto w-[min(92vw,34rem)] rounded-(--fam-radius-modal) bg-(--fam-app-bg) p-6 text-(--fam-text-primary) backdrop:bg-black/30"
    >
      <h2
        id="event-form-title"
        className="font-(family-name:--fam-font-serif) text-(length:--fam-fs-title)"
      >
        {mode === "create" ? "Add an event" : "Edit event"}
      </h2>

      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
        <label className={LABEL}>
          Title
          <input
            value={form.draft.summary}
            onChange={(event) => form.set("summary", event.target.value)}
            maxLength={120}
            required
            className={FIELD}
          />
          <FieldError messages={form.errors.summary} />
        </label>

        <TimesFieldset form={form} />
        <RepeatFieldset form={form} />
        <CategoryPicker form={form} categories={categories} />

        <label className={LABEL}>
          Location (optional)
          <input
            value={form.draft.location}
            onChange={(event) => form.set("location", event.target.value)}
            maxLength={200}
            className={FIELD}
          />
          <FieldError messages={form.errors.location} />
        </label>

        <label className={LABEL}>
          Notes (optional)
          <textarea
            value={form.draft.notes}
            onChange={(event) => form.set("notes", event.target.value)}
            maxLength={2000}
            rows={3}
            className={`${FIELD} py-2`}
          />
          <FieldError messages={form.errors.description} />
        </label>

        <p
          role="alert"
          className="empty:hidden text-(length:--fam-fs-body) text-(--fam-text-primary)"
        >
          {form.message}
        </p>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] rounded-full border border-(--fam-hairline) px-5 text-(length:--fam-fs-body) font-medium"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={form.pending}
            className="min-h-[44px] rounded-full bg-(--fam-primary-blue) px-5 text-(length:--fam-fs-body) font-medium text-white disabled:opacity-60"
          >
            Save
          </button>
        </div>
      </form>
    </dialog>
  );
}
