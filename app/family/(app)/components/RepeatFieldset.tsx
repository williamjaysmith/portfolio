"use client";

import type { FieldErrors } from "@/lib/family/errors";
import { WEEKDAYS, type RepeatChoice, type Weekday } from "@/lib/family/types";

import { FIELD, FieldError, LABEL } from "./settings/CategoryFields";

/**
 * The repeat control (002 FR-231/FR-232; 006 FR-627): the four choices —
 * Never, Every day, Every week on chosen weekdays, Every month on the date —
 * weekday boxes for weekly only, and an optional "repeats until" date for
 * every repeating kind, never a count. Refusals about the repeat (empty
 * weekdays, until before the start) arrive under the single `repeat` key and
 * are shown once here.
 *
 * Extracted from the calendar's event form in Phase 6 so the Meals tab mounts
 * the same control (R608): it reads a `RepeatDraft` — the three fields and
 * the three setters — which the event form's state already satisfies and the
 * meal form's does too. No form-specific knowledge lives here.
 */

export type RepeatKind = RepeatChoice["kind"];

/** The slice of a form's draft and setters this control reads and writes. */
export interface RepeatDraft {
  draft: { repeatKind: RepeatKind; weekdays: readonly Weekday[]; until: string };
  setRepeatKind: (kind: RepeatKind) => void;
  toggleWeekday: (day: Weekday) => void;
  /** The form's generic setter, narrowed to the one key this control writes. */
  set: (key: "until", value: string) => void;
  errors: FieldErrors;
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
const REPEAT_OPTIONS: ReadonlyArray<{ value: RepeatKind; label: string }> = [
  { value: "never", label: "Never" },
  { value: "daily", label: "Every day" },
  { value: "weekly", label: "Every week on chosen weekdays" },
  { value: "monthly", label: "Every month on the date" },
];

export function repeatKindOf(value: string): RepeatKind {
  return REPEAT_OPTIONS.find((option) => option.value === value)?.value ?? "never";
}

const SWITCH_ROW = "flex min-h-[44px] items-center gap-3 text-(length:--fam-fs-body)";

export function RepeatFieldset({ form }: { form: RepeatDraft }) {
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
