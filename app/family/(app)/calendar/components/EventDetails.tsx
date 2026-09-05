"use client";

import { useRef } from "react";

import { localDateOf } from "@/lib/family/calendar/dates";
import type {
  Category,
  EventTimes,
  Occurrence,
  RepeatChoice,
  TimeFormat,
  Weekday,
} from "@/lib/family/types";

import { useModalDialog } from "../../components/useModalDialog";
import { DetailRow } from "../../components/DetailRow";

/**
 * The event-details surface (T047, FR-256): tapping a block or a "+n more"
 * row opens this dialog showing the occurrence's title, its TRUE date and
 * time (an FR-218 min-height block is drawn taller than its span — the label
 * here never is), the repeat description in words, the assigned Profiles and
 * Labels by name and colour (FR-227 draw order), location and notes. A field
 * the event does not carry simply does not render, and the reference's
 * invitees, reminders and countdown rows do not exist here at all
 * (FR-229/230/228).
 *
 * Editing is reached from this view only — the Edit button, never a gesture
 * on the block (FR-257) — and deleting continues into the parent's flow
 * (scope, then `DeleteConfirm` — FR-258). Purely presentational: every write
 * intent leaves through a callback prop; no action is imported.
 *
 * The repeat arrives as the structured `RepeatChoice`, not a rule string:
 * clients never see rrule text (R201) and the recurrence internals are
 * boundary-sealed behind `lib/family/calendar/` — the wiring layer supplies
 * the choice, this component only puts it into words. A monthly rule's
 * day-of-month is every original occurrence date's day-of-month, so the
 * tapped occurrence's exception key carries it.
 *
 * Modality is Phase 1's dialog idiom (`DeleteDialog.tsx`): native
 * `showModal()` for the focus trap, Escape routed through `onCancel` to the
 * `onClose` callback, and the opener refocused on unmount.
 */

const WEEKDAY_NAMES: Record<Weekday, string> = {
  SU: "Sunday",
  MO: "Monday",
  TU: "Tuesday",
  WE: "Wednesday",
  TH: "Thursday",
  FR: "Friday",
  SA: "Saturday",
};

/** "Monday", "Monday and Tuesday", "Monday, Wednesday and Friday". */
function listInWords(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/** 1 → "1st", 22 → "22nd", 13 → "13th" — the monthly rule's spoken date. */
function ordinalOf(day: number): string {
  const mod100 = day % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${day}th`;
  const mod10 = day % 10;
  if (mod10 === 1) return `${day}st`;
  if (mod10 === 2) return `${day}nd`;
  if (mod10 === 3) return `${day}rd`;
  return `${day}th`;
}

/**
 * A plain household-local `YYYY-MM-DD` in words. Formatted in UTC on purpose:
 * a plain date has no zone, and running it through the household zone would
 * shift it across midnight.
 */
function plainDateInWords(date: string, weekday?: "long"): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday,
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00Z`));
}

function instantDateInWords(ms: number, zone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(ms);
}

function instantTimeInWords(ms: number, zone: string, timeFormat: TimeFormat): string {
  const options: Intl.DateTimeFormatOptions =
    timeFormat === "24h"
      ? { timeZone: zone, hourCycle: "h23", hour: "2-digit", minute: "2-digit" }
      : { timeZone: zone, hour: "numeric", minute: "2-digit", hour12: true };
  return new Intl.DateTimeFormat("en-US", options).format(ms);
}

/**
 * The occurrence's TRUE span (FR-218/FR-256): stored times, whatever height
 * the grid drew. A midnight-crosser names both dates; an all-day range names
 * its inclusive end date (FR-225).
 */
function whenInWords(times: EventTimes, zone: string, timeFormat: TimeFormat): string {
  if (times.allDay) {
    const range =
      times.startDate === times.endDate
        ? plainDateInWords(times.startDate, "long")
        : `${plainDateInWords(times.startDate, "long")} – ${plainDateInWords(times.endDate, "long")}`;
    return `${range} · All day`;
  }
  const startMs = Date.parse(times.startsAt);
  const endMs = Date.parse(times.endsAt);
  const start = `${instantDateInWords(startMs, zone)}, ${instantTimeInWords(startMs, zone, timeFormat)}`;
  const end =
    localDateOf(zone, startMs) === localDateOf(zone, endMs)
      ? instantTimeInWords(endMs, zone, timeFormat)
      : `${instantDateInWords(endMs, zone)}, ${instantTimeInWords(endMs, zone, timeFormat)}`;
  return `${start} – ${end}`;
}

/** FR-256's repeat description in words; `null` when the event never repeats. */
function repeatInWords(repeat: RepeatChoice, occurrenceDate: string): string | null {
  if (repeat.kind === "never") return null;
  const until = repeat.until ? ` until ${plainDateInWords(repeat.until)}` : "";
  if (repeat.kind === "daily") return `Every day${until}`;
  if (repeat.kind === "weekly") {
    const days = listInWords(repeat.weekdays.map((day) => WEEKDAY_NAMES[day]));
    return `Every week on ${days}${until}`;
  }
  return `Every month on the ${ordinalOf(Number(occurrenceDate.slice(8)))}${until}`;
}

/** Resolve category ids in draw order (FR-227); unknown ids drop out. */
function assignedOf(
  categoryIds: readonly string[],
  categories: readonly Category[],
): Category[] {
  const byId = new Map(categories.map((category) => [category.id, category]));
  return categoryIds
    .map((id) => byId.get(id))
    .filter((category): category is Category => category !== undefined);
}


export interface EventDetailsProps {
  /** The tapped occurrence — effective fields, any override already merged. */
  occurrence: Occurrence;
  /** The series' repeat, structured (never a rule string); `{ kind: "never" }` on a one-off. */
  repeat: RepeatChoice;
  /** The household's categories, to resolve ids to name + colour. */
  categories: readonly Category[];
  /** Household IANA zone — the one zone every render works in (FR-219/284). */
  zone: string;
  timeFormat: TimeFormat;
  /** FR-257: editing is reached from here only. */
  onEdit: () => void;
  /** Continues into the parent's delete flow — confirmation is FR-258's job there. */
  onDelete: () => void;
  onClose: () => void;
}

export function EventDetails({
  occurrence,
  repeat,
  categories,
  zone,
  timeFormat,
  onEdit,
  onDelete,
  onClose,
}: EventDetailsProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useModalDialog(true, closeRef);

  const repeatText = repeatInWords(repeat, occurrence.occurrenceDate);
  const assigned = assignedOf(occurrence.categoryIds, categories);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="event-details-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className="m-auto w-[min(92vw,30rem)] rounded-(--fam-radius-modal) bg-(--fam-app-bg) p-6 text-(--fam-text-primary) backdrop:bg-black/30"
    >
      <h2
        id="event-details-title"
        className="font-(family-name:--fam-font-serif) text-(length:--fam-fs-title)"
      >
        {occurrence.summary}
      </h2>

      <p className="mt-2 text-(length:--fam-fs-body) text-(--fam-text-secondary) tabular-nums">
        {whenInWords(occurrence.times, zone, timeFormat)}
      </p>

      {repeatText ? <DetailRow label="Repeats">{repeatText}</DetailRow> : null}

      {assigned.length > 0 ? (
        <ul aria-label="Assigned to" className="mt-3 flex flex-wrap gap-2">
          {assigned.map((category) => (
            <li
              key={category.id}
              className="flex min-h-[28px] items-center gap-2 rounded-full border border-(--fam-hairline) px-3 text-(length:--fam-fs-body)"
            >
              <span
                aria-hidden
                className="size-3 shrink-0 rounded-full"
                style={{ backgroundColor: category.color }}
              />
              {category.label}
            </li>
          ))}
        </ul>
      ) : null}

      {occurrence.location ? <DetailRow label="Location">{occurrence.location}</DetailRow> : null}

      {occurrence.description ? (
        <DetailRow label="Notes">
          <span className="whitespace-pre-wrap">{occurrence.description}</span>
        </DetailRow>
      ) : null}

      <div className="mt-5 flex justify-end gap-3">
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className="min-h-[44px] rounded-full border border-(--fam-hairline) px-5 text-(length:--fam-fs-body) font-medium"
        >
          Close
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="min-h-[44px] rounded-full border border-(--fam-hairline) px-5 text-(length:--fam-fs-body) font-medium text-(--fam-danger)"
        >
          Delete
        </button>
        <button
          type="button"
          onClick={onEdit}
          className="min-h-[44px] rounded-full bg-(--fam-text-primary) px-5 text-(length:--fam-fs-body) font-medium text-(--fam-app-bg)"
        >
          Edit
        </button>
      </div>
    </dialog>
  );
}
