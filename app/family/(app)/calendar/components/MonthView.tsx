"use client";

import type { SpanSegment } from "@/lib/family/calendar/month";
import type { PaletteColor } from "@/lib/family/colors";
import type { Occurrence, TimeFormat } from "@/lib/family/types";

import { MonthCell } from "./MonthCell";
import type { MonthCellModel } from "./useMonthOccurrences";

/**
 * The Month view's grid (011 FR-1109).
 *
 * The reference calls it "a grid of the current month in standard calendar
 * format" [VERIFIED](44738510847259) and "a general overview of scheduled
 * events" [VERIFIED](36625171368987). No image of it exists anywhere in the
 * corpus (R1101), so what is reproduced here is the documented behaviour — the
 * capacities, the overflow, the spans and the navigation — and not a look.
 *
 * **Whole weeks, and as many rows as the month needs**: four, five or six. The
 * leading and trailing cells belong to the neighbouring months and are drawn as
 * such, which is what "standard calendar format" means everywhere.
 *
 * **Spans are drawn on the row, not in the cells.** A multi-day event is one
 * connected bar [VERIFIED](44738510847259, 36625171368987), and a grid that
 * wraps cannot draw one rectangle across a row break — so each row carries the
 * segments that cross it, positioned by column (R1109). Drawing them inside
 * cells would break the bar into per-day chips, which is exactly what the
 * reference says it is not.
 *
 * **No drag** (spec Assumption 6): nothing documents a month event as
 * draggable, and the shipped drag layer hit-tests one-dimensionally across a
 * single row of day columns. A cell is a door to its day.
 */

/** Sunday-first labels; the household's start-of-week rotates them. */
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/**
 * The month on show, in words. UTC so a plain date cannot slide across
 * midnight — the shipped `celebrations.ts` idiom.
 */
const MONTH_NAME = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "long",
  year: "numeric",
});

/**
 * Which month this grid IS, derived from the cells rather than passed in.
 *
 * The grid runs from the week containing the 1st to the week containing the
 * last day, so up to a third of the cells belong to a neighbour — and the
 * month is simply the one the in-month cells share. Deriving it here rather
 * than taking an `anchorDate` prop means the heading cannot disagree with what
 * is drawn, which is the failure mode every other label in this app has had at
 * least once.
 */
function monthNameOf(rows: readonly MonthCellModel[][]): string {
  for (const row of rows) {
    for (const cell of row) {
      if (cell.inMonth) return MONTH_NAME.format(new Date(`${cell.date}T00:00:00Z`));
    }
  }
  return "";
}

const SEGMENT =
  "pointer-events-auto flex h-5 min-w-0 items-center overflow-hidden whitespace-nowrap px-2 " +
  "text-(length:--fam-fs-small) text-(--fam-text-primary)";

export interface MonthViewProps {
  rows: MonthCellModel[][];
  segments: readonly SpanSegment[];
  /** The household-local date of the first cell — what a column index means. */
  startDate: string;
  todayDate: string | null;
  /** The household's start-of-week, so the headings match the columns. */
  startWeekOn: 0 | 1;
  zone: string;
  timeFormat: TimeFormat;
  colorsById: Readonly<Record<string, PaletteColor>>;
  /** FR-1113: a cell is a door to its day. */
  onOpenDay: (date: string) => void;
  /** FR-1111: the day's full list, from the overflow control. */
  onOpenList: (date: string) => void;
  onOpen: (occurrence: Occurrence) => void;
}

export function MonthView({
  rows,
  segments,
  todayDate,
  startWeekOn,
  zone,
  timeFormat,
  colorsById,
  onOpenDay,
  onOpenList,
  onOpen,
}: MonthViewProps) {
  const headings = headingsFor(startWeekOn);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Which month you are looking at. The Day and Week views answer that in
          their day headers ("Thu 10"), so this view was the only one with no
          answer anywhere on screen — the operator's ask: "the user needs to
          know which month theyre viewing so lets put that above the days text".
          Unlike the weekday row below it this is NOT decoration: it is the only
          thing naming the month, so it is a real heading and stays readable. */}
      <p
        aria-live="polite"
        // `pt-2` because it sat hard against the row above it, and the
        // SECONDARY ink because the weekday headings under it are secondary —
        // a month and the days inside it are one heading block, so two inks
        // read as two ranks (the operator, holding it next to the row below:
        // "it needs space above it" and "should be the same color as the days
        // text").
        className="shrink-0 px-(--fam-edge-inset) pt-2 pb-1 font-(family-name:--fam-font-serif) text-(length:--fam-fs-section) text-(--fam-text-secondary)"
      >
        {monthNameOf(rows)}
      </p>
      {/* The weekday headings are decoration for a screen reader: every cell's
          own control already carries its full date, so reading "Sun" before
          each one would be noise. */}
      <div
        aria-hidden="true"
        className="grid shrink-0 border-b border-(--fam-hairline)"
        style={{ gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }}
      >
        {headings.map((label) => (
          <div
            key={label}
            className="py-1 text-center font-(family-name:--fam-font-serif) text-(length:--fam-fs-day-header) text-(--fam-text-secondary)"
          >
            {label}
          </div>
        ))}
      </div>

      {/* Deliberately NOT `role="grid"`. That role promises two-dimensional
          arrow-key navigation, which this view does not implement; claiming it
          would tell assistive technology something untrue, and an earlier
          draft that did also produced an invalid structure (rows whose cells
          were not their own children). A labelled group of dated controls is
          both honest and navigable. */}
      <div role="group" aria-label="Month" className="flex min-h-0 flex-1 flex-col">
        {rows.map((row, rowIndex) => (
          <div key={row[0].date} className="relative flex min-h-0 flex-1 flex-col">
            <div
              className="grid min-h-0 flex-1"
              style={{ gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }}
            >
              {row.map((cell) => (
                <MonthCell
                  key={cell.date}
                  cell={cell}
                  isToday={cell.date === todayDate}
                  zone={zone}
                  timeFormat={timeFormat}
                  colorsById={colorsById}
                  onOpenDay={onOpenDay}
                  onOpenList={onOpenList}
                  onOpen={onOpen}
                />
              ))}
            </div>

            {/* The row's spanning bars, over the cells and out of their flow —
                one bar per event per row, never a chip per day (FR-1112). */}
            <div className="pointer-events-none absolute inset-x-0 top-6 flex flex-col gap-0.5">
              {segments
                .filter((segment) => segment.row === rowIndex)
                .map((segment) => (
                  <div
                    key={`${segment.eventId}:${segment.occurrenceDate}:${segment.row}`}
                    className="grid"
                    style={{ gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }}
                  >
                    <button
                      type="button"
                      onClick={() => onOpenDay(segment.occurrenceDate)}
                      style={{
                        gridColumnStart: segment.startColumn + 1,
                        gridColumnEnd: segment.endColumn + 2,
                        backgroundColor: "var(--fam-pill-btn-bg)",
                        borderTopLeftRadius: segment.continuesLeft ? 0 : "9999px",
                        borderBottomLeftRadius: segment.continuesLeft ? 0 : "9999px",
                        borderTopRightRadius: segment.continuesRight ? 0 : "9999px",
                        borderBottomRightRadius: segment.continuesRight ? 0 : "9999px",
                      }}
                      className={SEGMENT}
                    >
                      {/* A continued bar repeats the name: a household reading
                          the second week must not have to look up to the first. */}
                      {segment.continuesLeft ? `← ${segment.summary}` : segment.summary}
                    </button>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** The column headings, rotated to the household's own first day. */
function headingsFor(startWeekOn: 0 | 1): string[] {
  return startWeekOn === 0
    ? [...WEEKDAY_LABELS]
    : [...WEEKDAY_LABELS.slice(1), WEEKDAY_LABELS[0]];
}
