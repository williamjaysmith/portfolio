import type { CSSProperties } from "react";

import type { AllDayBar, AllDayLayout } from "@/lib/family/calendar/layout";
import { eventInk, type PaletteColor } from "@/lib/family/colors";
import type { Occurrence } from "@/lib/family/types";

import { fillsOf, stripeBackground } from "./EventBlock";
import { headerGridTemplate } from "./WeekHeader";

/**
 * The all-day band above the hour grid (T029): ONE spanning bar per all-day
 * event across every visible day it covers (FR-206) — never a per-day
 * repeat. Lanes and spans arrive computed from `layout.ts`; this component
 * draws them into a CSS grid whose columns mirror the day columns (hour
 * gutter first, like `WeekHeader`).
 *
 * FR-207: the band GROWS with its lanes up to three rows, then scrolls, so
 * no all-day event is ever unreachable. A bar cut by the window edge keeps
 * its title on the visible portion (spec edge case): the title renders in
 * every bar and the cut edge is drawn square instead of rounded.
 *
 * Colour is the block mechanism verbatim (FR-211/212/213/214): solid single
 * category, stripes with the title on the leftmost solid segment, neutral
 * with a thin border for none — ink from `colors.ts` against the first fill.
 * Past all-day bars (ended before today) dim like past blocks (FR-215).
 *
 * Each bar is a focusable button whose press opens the occurrence's details
 * (FR-256), reported through `onOpen` like a block's. Rows are the band's
 * token height or the FR-263 touch floor, whichever is taller — so a bar is
 * never a control too small to tap.
 */

export interface AllDayBandProps {
  /** The displayed window's consecutive household-local dates. */
  columnDates: readonly string[];
  layout: AllDayLayout;
  /** Category id → palette colour, for the fills in draw order (FR-227). */
  colorsById: Readonly<Record<string, PaletteColor>>;
  /** Household-local today; `null` before the clock's first publish. */
  todayDate: string | null;
  /** FR-256: a bar press opens that occurrence's details. Absent = read-only. */
  onOpen?: (occurrence: Occurrence) => void;
}

/** One lane: the [ESTIMATED] pill token, never under the touch floor. */
const LANE_HEIGHT = "max(var(--fam-allday-h), var(--fam-touch))";

function fillStyle(fills: readonly PaletteColor[]): CSSProperties {
  if (fills.length === 1) return { backgroundColor: fills[0] };
  return fills.length > 1 ? { backgroundImage: stripeBackground(fills) } : {};
}

// A window-edge cut is a cut, not an end: square that edge (FR-206).
function clippedEdgeStyle(bar: AllDayBar): CSSProperties {
  const style: CSSProperties = {};
  if (bar.clippedStart) {
    style.borderTopLeftRadius = 0;
    style.borderBottomLeftRadius = 0;
  }
  if (bar.clippedEnd) {
    style.borderTopRightRadius = 0;
    style.borderBottomRightRadius = 0;
  }
  return style;
}

function barStyle(bar: AllDayBar, fills: readonly PaletteColor[]): CSSProperties {
  return {
    // +2: CSS grid lines are 1-based and line 1 opens the hour-gutter spacer.
    gridColumn: `${bar.startColumn + 2} / ${bar.endColumn + 3}`,
    gridRow: bar.lane + 1,
    color: eventInk(fills),
    ...fillStyle(fills),
    ...clippedEdgeStyle(bar),
  };
}

/** FR-215: an all-day event whose inclusive end date has passed is dimmed. */
function isPast(bar: AllDayBar, todayDate: string | null): boolean {
  const times = bar.occurrence.times;
  return todayDate !== null && times.allDay && times.endDate < todayDate;
}

export function AllDayBand({ columnDates, layout, colorsById, todayDate, onOpen }: AllDayBandProps) {
  return (
    <div
      // FR-207: grow to three lanes, scroll past that.
      className="grid content-start gap-y-1 overflow-y-auto"
      style={{
        ...headerGridTemplate(columnDates.length),
        gridAutoRows: LANE_HEIGHT,
        maxHeight: `calc(3 * ${LANE_HEIGHT} + 2 * var(--fam-event-gap))`,
      }}
    >
      {layout.bars.map((bar) => {
        const fills = fillsOf(bar.occurrence.categoryIds, colorsById);
        return (
          <button
            key={`${bar.occurrence.eventId}:${bar.occurrence.occurrenceDate}`}
            type="button"
            onClick={() => onOpen?.(bar.occurrence)}
            style={barStyle(bar, fills)}
            className={`mx-(--fam-event-inset) flex items-center overflow-hidden rounded-(--fam-allday-r) px-3 text-left font-medium text-(length:--fam-fs-allday) ${
              fills.length === 0
                ? "border bg-(--fam-event-neutral-fill) border-(--fam-event-neutral-border)"
                : ""
            } ${isPast(bar, todayDate) ? "opacity-(--fam-past-dim)" : ""}`}
          >
            <span
              className="truncate"
              // FR-212: the title sits on a solid run of the first colour.
              style={fills.length > 1 ? { backgroundColor: fills[0] } : undefined}
            >
              {bar.occurrence.summary}
            </span>
          </button>
        );
      })}
    </div>
  );
}
