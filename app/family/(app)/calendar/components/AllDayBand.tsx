import type { CSSProperties } from "react";

import type { AllDayBar, AllDayLayout } from "@/lib/family/calendar/layout";
import { eventInk, type PaletteColor } from "@/lib/family/colors";

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
 * no all-day event is ever unreachable. A bar cut by the slice edge keeps
 * its title on the visible portion (spec edge case): the title renders in
 * every bar and the cut edge is drawn square instead of rounded.
 *
 * Colour is the block mechanism verbatim (FR-211/212/213/214): solid single
 * category, stripes with the title on the leftmost solid segment, neutral
 * with a thin border for none — ink from `colors.ts` against the first fill.
 * Past all-day bars (ended before today) dim like past blocks (FR-215).
 *
 * Bars are not yet controls: the tap-for-details surface lands with T047,
 * which turns each bar into a ≥44pt button (FR-263) — nothing interactive
 * is rendered here until it can actually do something.
 */

export interface AllDayBandProps {
  /** The visible slice's consecutive household-local dates (FR-289). */
  columnDates: readonly string[];
  layout: AllDayLayout;
  /** Category id → palette colour, for the fills in draw order (FR-227). */
  colorsById: Readonly<Record<string, PaletteColor>>;
  /** Household-local today; `null` before the clock's first publish. */
  todayDate: string | null;
}

function fillStyle(fills: readonly PaletteColor[]): CSSProperties {
  if (fills.length === 1) return { backgroundColor: fills[0] };
  return fills.length > 1 ? { backgroundImage: stripeBackground(fills) } : {};
}

// A slice-edge cut is a cut, not an end: square that edge (FR-206).
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

export function AllDayBand({ columnDates, layout, colorsById, todayDate }: AllDayBandProps) {
  return (
    <div
      // FR-207: grow to three lanes, scroll past that.
      className="grid content-start gap-y-1 overflow-y-auto"
      style={{
        ...headerGridTemplate(columnDates.length),
        gridAutoRows: "var(--fam-allday-h)",
        maxHeight: "calc(3 * var(--fam-allday-h) + 2 * var(--fam-event-gap))",
      }}
    >
      {layout.bars.map((bar) => {
        const fills = fillsOf(bar.occurrence.categoryIds, colorsById);
        return (
          <div
            key={`${bar.occurrence.eventId}:${bar.occurrence.occurrenceDate}`}
            style={barStyle(bar, fills)}
            className={`mx-(--fam-event-inset) flex items-center overflow-hidden rounded-(--fam-allday-r) px-3 font-medium text-(length:--fam-fs-allday) ${
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
          </div>
        );
      })}
    </div>
  );
}
