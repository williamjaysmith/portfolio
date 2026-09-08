"use client";

import { useRef } from "react";

import type { Occurrence, TimeFormat } from "@/lib/family/types";

import { useModalDialog } from "../../components/useModalDialog";

/**
 * One day's full list of events (011 FR-1111).
 *
 * What the Month cell's "+ More" opens [VERIFIED](360033104791): "tapping it
 * opens that date's full event list". It exists because the cell holds three
 * and the day may hold nine.
 *
 * It lists **everything on the day**, spans included — somebody asking what is
 * on a day means all of it, not only the half the cell had room for and not
 * only the timed half. Choosing a row opens that event's own details, which is
 * the shipped door (`[P2]` FR-256).
 */

const ROW =
  "flex min-h-(--fam-touch) w-full items-center gap-3 rounded-(--fam-radius-pill) px-3 text-left " +
  "text-(length:--fam-fs-body) text-(--fam-text-primary)";

export interface MonthDayListProps {
  date: string;
  occurrences: readonly Occurrence[];
  zone: string;
  timeFormat: TimeFormat;
  onOpen: (occurrence: Occurrence) => void;
  onClose: () => void;
}

export function MonthDayList({
  date,
  occurrences,
  zone,
  timeFormat,
  onOpen,
  onClose,
}: MonthDayListProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useModalDialog(true, closeRef);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="month-day-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className="m-auto w-[min(92vw,26rem)] rounded-(--fam-radius-modal) bg-(--fam-app-bg) p-6 text-(--fam-text-primary) backdrop:bg-black/30"
    >
      <h2
        id="month-day-title"
        className="font-(family-name:--fam-font-serif) text-(length:--fam-fs-title)"
      >
        {dayInWords(date)}
      </h2>

      {occurrences.length === 0 ? (
        <p className="mt-3 text-(length:--fam-fs-body) text-(--fam-text-secondary)">
          Nothing on this day.
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-1">
          {occurrences.map((occurrence) => (
            <li key={`${occurrence.eventId}:${occurrence.occurrenceDate}`}>
              <button type="button" onClick={() => onOpen(occurrence)} className={ROW}>
                <span className="w-20 shrink-0 tabular-nums text-(--fam-text-secondary)">
                  {whenInWords(occurrence, zone, timeFormat)}
                </span>
                <span className="min-w-0 truncate">{occurrence.summary}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-5 flex justify-end">
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className="flex min-h-(--fam-touch) items-center rounded-full bg-(--fam-pill-btn-bg) px-4 font-medium text-(length:--fam-fs-pill) text-(--fam-text-muted)"
        >
          Close
        </button>
      </div>
    </dialog>
  );
}

function dayInWords(date: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date(`${date}T00:00:00Z`));
}

function whenInWords(occurrence: Occurrence, zone: string, timeFormat: TimeFormat): string {
  if (occurrence.times.allDay) return "All day";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hour: "numeric",
    minute: "2-digit",
    hour12: timeFormat === "12h",
  }).format(new Date(occurrence.times.startsAt));
}
