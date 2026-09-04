"use client";

import type { MouseEvent } from "react";

import type { OverflowGroup, TimedSegment } from "@/lib/family/calendar/layout";
import type { PaletteColor } from "@/lib/family/colors";
import type { Occurrence, TimeFormat } from "@/lib/family/types";

import { useNow } from "../../components/Clock";
import { DragPreviewBlock } from "./DragPreviewBlock";
import { EventBlock, fillsOf } from "./EventBlock";
import { MoreOverflow } from "./MoreOverflow";
import { NowLine } from "./NowLine";
import { DragSurfaceContext, dragGhostOf, useDragSurface } from "./useEventDrag";

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
 *
 * Two taps leave this column (T050): a block or "+n more" row reports its
 * occurrence through `onOpen` (details, FR-256), and a tap on EMPTY grid
 * reports the 15-minute slot under the finger through `onSlotTap` — FR-254's
 * second way to create, a plain tap, never a long press. The blocks sit
 * above the hour cells as siblings, so a tap on a block never reaches a
 * cell and a cell tap is empty grid by construction. (The drag layer eats
 * the click a finished drag ends with, so a drop on empty grid never opens
 * the create form — T055's swallow, T057's guarantee.)
 *
 * A live drag adds one thing to the column: the snapped ghost of the dragged
 * block when the candidate lands HERE (T056), which is also R208's pending
 * overlay — it stays through the write, so the block is never drawn back at
 * its old time while the new one is in flight. The drag surface arrives by
 * context, so a read-only grid is unchanged.
 */

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

/** FR-255's slot: an hour cell splits into four quarters. */
const SLOTS_PER_HOUR = 4;
const SLOT_MINUTES = 60 / SLOTS_PER_HOUR;

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

/**
 * FR-255: the 15-minute slot under a tap on an hour cell, from the tap's
 * offset within the cell. A cell with no measured height (jsdom, keyboard
 * activation) yields the hour's first quarter.
 */
function slotMinutesOf(hour: number, event: MouseEvent<HTMLElement>): number {
  const rect = event.currentTarget.getBoundingClientRect();
  const fraction = rect.height > 0 ? (event.clientY - rect.top) / rect.height : 0;
  const quarter = Math.min(SLOTS_PER_HOUR - 1, Math.max(0, Math.floor(fraction * SLOTS_PER_HOUR)));
  return hour * 60 + quarter * SLOT_MINUTES;
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
  /** FR-256: a block or row press opens that occurrence's details. */
  onOpen?: (occurrence: Occurrence) => void;
  /** FR-254/255: a tap on empty grid — this date, wall minutes of the 15-minute slot. */
  onSlotTap?: (date: string, minutes: number) => void;
}

export function DayColumn({
  date,
  todayDate,
  zone,
  timeFormat,
  segments,
  overflow,
  colorsById,
  onOpen,
  onSlotTap,
}: DayColumnProps) {
  const now = useNow();
  const nowMs = now === null ? null : now.getTime();
  const ghost = dragGhostOf(useDragSurface(), date);

  return (
    <div
      className={`relative border-l border-(--fam-hairline) ${
        isWeekend(date) ? "bg-(--fam-weekend-shade)" : ""
      }`}
    >
      {HOURS.map((hour) => (
        <div
          key={hour}
          data-hour={hour}
          onClick={onSlotTap ? (event) => onSlotTap(date, slotMinutesOf(hour, event)) : undefined}
          className="relative h-(--fam-hour-row-h) border-b border-(--fam-hairline)"
        >
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
          onOpen={onOpen}
        />
      ))}

      {overflow.map((group) => (
        <MoreOverflow
          key={`${group.date}:${group.top}`}
          group={group}
          zone={zone}
          timeFormat={timeFormat}
          onOpen={onOpen}
        />
      ))}

      {ghost === null ? null : (
        // The ghost is a COPY, not a second handle: inside it the drag surface
        // is absent, so its block registers no gesture and does not dim
        // itself as the source — the real block, dimmed in place, is that.
        <DragSurfaceContext.Provider value={null}>
          <DragPreviewBlock
            occurrence={ghost.occurrence}
            placement={ghost.placement}
            date={date}
            fills={fillsOf(ghost.occurrence.categoryIds, colorsById)}
            metrics={ghost.metrics}
            zone={zone}
            timeFormat={timeFormat}
          />
        </DragSurfaceContext.Provider>
      )}

      {date === todayDate ? <NowLine zone={zone} /> : null}
    </div>
  );
}
