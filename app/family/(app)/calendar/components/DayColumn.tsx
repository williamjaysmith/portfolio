"use client";

import type { OverflowGroup, TimedSegment } from "@/lib/family/calendar/layout";
import type { PaletteColor } from "@/lib/family/colors";
import type { TimeFormat } from "@/lib/family/types";

import { useNow } from "../../components/Clock";
import { EventBlock, fillsOf } from "./EventBlock";
import { MoreOverflow } from "./MoreOverflow";
import { NowLine } from "./NowLine";

/**
 * One day column of the FR-201 grid (T030): 24 token-height hour cells with
 * the half-hour hairline, the column's positioned `EventBlock`s and
 * "+n more" groups from `layout.ts`, and — in today's column only — the
 * `NowLine` drawn above the blocks (FR-208).
 *
 * Weekend columns wash with the weekend token (FR-215); Saturday and Sunday
 * are weekend whatever day the household starts its week on. Past events dim
 * at minute granularity (FR-215): an event is past once its true end instant
 * is at or before now, judged from the OCCURRENCE's stored times — so a
 * midnight-crosser's earlier segment stays undimmed while the event is still
 * running in the next column (FR-217, one event). The minute tick is Phase
 * 1's shared clock store — no timer of this component's own.
 */

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

/** `YYYY-MM-DD` → 0 (Sunday) … 6 — a plain-date fact, no zone involved. */
function weekdayOf(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

function isWeekend(date: string): boolean {
  const weekday = weekdayOf(date);
  return weekday === 0 || weekday === 6;
}

/** FR-215 at minute granularity: ended at or before the shared clock's now. */
function isPast(segment: TimedSegment, nowMs: number | null): boolean {
  const times = segment.occurrence.times;
  if (nowMs === null || times.allDay) return false;
  return Date.parse(times.endsAt) <= nowMs;
}

export interface DayColumnProps {
  /** This column's household-local date, `YYYY-MM-DD`. */
  date: string;
  /** Household-local today; `null` before the clock's first publish. */
  todayDate: string | null;
  /** Household IANA zone (FR-219/284). */
  zone: string;
  timeFormat: TimeFormat;
  /** This column's timed segments from `layoutWeek` (already positioned). */
  segments: readonly TimedSegment[];
  /** This column's "+n more" groups from `layoutWeek` (FR-285). */
  overflow: readonly OverflowGroup[];
  /** Category id → palette colour, for the fills in draw order (FR-227). */
  colorsById: Readonly<Record<string, PaletteColor>>;
}

export function DayColumn({
  date,
  todayDate,
  zone,
  timeFormat,
  segments,
  overflow,
  colorsById,
}: DayColumnProps) {
  const now = useNow();
  const nowMs = now === null ? null : now.getTime();

  return (
    <div
      className={`relative border-l border-(--fam-hairline) ${
        isWeekend(date) ? "bg-(--fam-weekend-shade)" : ""
      }`}
    >
      {HOURS.map((hour) => (
        <div key={hour} className="relative h-(--fam-hour-row-h) border-b border-(--fam-hairline)">
          <div
            aria-hidden="true"
            className="absolute inset-x-0 top-(--fam-halfhour-y) h-px bg-(--fam-hairline)"
          />
        </div>
      ))}

      {segments.map((segment) => (
        <EventBlock
          key={`${segment.occurrence.eventId}:${segment.occurrence.occurrenceDate}`}
          segment={segment}
          fills={fillsOf(segment.occurrence.categoryIds, colorsById)}
          dimmed={isPast(segment, nowMs)}
          zone={zone}
          timeFormat={timeFormat}
        />
      ))}

      {overflow.map((group) => (
        <MoreOverflow
          key={`${group.date}:${group.top}`}
          group={group}
          zone={zone}
          timeFormat={timeFormat}
        />
      ))}

      {date === todayDate ? <NowLine zone={zone} /> : null}
    </div>
  );
}
