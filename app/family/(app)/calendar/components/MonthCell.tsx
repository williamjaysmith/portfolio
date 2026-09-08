"use client";

import type { PaletteColor } from "@/lib/family/colors";
import type { Occurrence, TimeFormat } from "@/lib/family/types";

import type { MonthCellModel } from "./useMonthOccurrences";

/**
 * One day of the month grid (011 FR-1110, FR-1111, FR-1113).
 *
 * The capacity is the reference's own, and it is not a simple truncation: a
 * cell holds **three** events, and at **four or more** it shows **two** plus an
 * indicator of how many more [VERIFIED](48026687853083). The step down from
 * three to two is why `cellFillFor` is a tested function rather than a `slice`
 * here.
 *
 * The overflow control is a **"+ More"** [VERIFIED](360033104791) which opens
 * that date's full list. This one says how many, because a household deciding
 * whether to look wants the number.
 *
 * The cell itself is a door to its day (FR-1113, spec Assumption 5): the
 * source says a day cell opens the Week view, but that sentence was fetched
 * from the article's mobile-app portion and the phone app has no Day view to
 * offer — which is very likely why it says Week. This project has one.
 */

const CHIP =
  "flex w-full min-w-0 items-center gap-1 overflow-hidden whitespace-nowrap rounded-(--fam-radius-pill) " +
  "px-1 text-left text-(length:--fam-fs-small) text-(--fam-text-primary)";

export interface MonthCellProps {
  cell: MonthCellModel;
  isToday: boolean;
  zone: string;
  timeFormat: TimeFormat;
  colorsById: Readonly<Record<string, PaletteColor>>;
  onOpenDay: (date: string) => void;
  onOpenList: (date: string) => void;
  onOpen: (occurrence: Occurrence) => void;
}

export function MonthCell({
  cell,
  isToday,
  zone,
  timeFormat,
  colorsById,
  onOpenDay,
  onOpenList,
  onOpen,
}: MonthCellProps) {
  const numeral = Number(cell.date.slice(8, 10));

  return (
    <div
      role="gridcell"
      aria-current={isToday ? "date" : undefined}
      className={`flex min-h-0 min-w-0 flex-col gap-0.5 border-b border-r border-(--fam-hairline) p-1 ${
        cell.inMonth ? "" : "opacity-50"
      }`}
    >
      <button
        type="button"
        onClick={() => onOpenDay(cell.date)}
        aria-label={`Open ${cell.date}`}
        className={`self-start rounded-full px-1.5 text-(length:--fam-fs-small) tabular-nums ${
          isToday
            ? "bg-(--fam-primary-blue) font-medium text-white"
            : "text-(--fam-text-secondary)"
        }`}
      >
        {numeral}
      </button>

      {/* Spanning bars are drawn on the ROW, above this cell, so that a
          multi-day event stays one bar (FR-1112). The room they need is the
          row's; this list starts below it. */}
      <ul className="flex min-h-0 flex-col gap-0.5 overflow-hidden">
        {cell.timed.slice(0, cell.shown).map((occurrence) => (
          <li key={`${occurrence.eventId}:${occurrence.occurrenceDate}`}>
            <button type="button" onClick={() => onOpen(occurrence)} className={CHIP}>
              <span
                aria-hidden="true"
                className="size-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: colorOf(occurrence, colorsById) }}
              />
              <span className="shrink-0 tabular-nums text-(--fam-text-secondary)">
                {startInWords(occurrence, zone, timeFormat)}
              </span>
              <span className="min-w-0 truncate">{occurrence.summary}</span>
            </button>
          </li>
        ))}
      </ul>

      {cell.hidden > 0 ? (
        <button
          type="button"
          onClick={() => onOpenList(cell.date)}
          aria-label={`${cell.hidden} more on ${cell.date}`}
          className="self-start px-1 text-(length:--fam-fs-small) font-medium text-(--fam-text-muted)"
        >
          {`+${cell.hidden} more`}
        </button>
      ) : null}
    </div>
  );
}

/** The first assigned Profile's colour, or the hairline when it has none. */
function colorOf(
  occurrence: Occurrence,
  colorsById: Readonly<Record<string, PaletteColor>>,
): string {
  const first = occurrence.categoryIds[0];
  return (first === undefined ? undefined : colorsById[first]) ?? "var(--fam-hairline)";
}

/** A start time short enough for a cell — no minutes on the hour. */
function startInWords(occurrence: Occurrence, zone: string, timeFormat: TimeFormat): string {
  if (occurrence.times.allDay) return "";
  const at = new Date(occurrence.times.startsAt);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hour: "numeric",
    minute: at.getMinutes() === 0 ? undefined : "2-digit",
    hour12: timeFormat === "12h",
  }).format(at);
  return parts.replace(" ", "").toLowerCase();
}
