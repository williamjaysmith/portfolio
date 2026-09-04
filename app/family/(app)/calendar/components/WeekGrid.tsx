import type { WeekLayout } from "@/lib/family/calendar/layout";
import type { PaletteColor } from "@/lib/family/colors";
import type { Occurrence, TimeFormat } from "@/lib/family/types";

import { DayColumn } from "./DayColumn";
import { headerGridTemplate } from "./WeekHeader";

/**
 * The hour-ruled body of the FR-201 grid (T030): the vertically scrolling
 * viewport (FR-280) holding the 24-row hour ruler in its gutter and one
 * `DayColumn` per visible date. The one scroll also serves FR-216: the
 * canvas spans the full midnight-to-midnight day, so every event a full day
 * holds — all twelve of the fixture's — is reachable by scrolling; layout
 * collapses simultaneity into "+n more" instead (FR-285), never scroll.
 *
 * Rows take their height from `--fam-hour-row-h`; T027 measures that same
 * rendered row to build the `LayoutMetrics` the segment positions in
 * `layout` were computed from, so token and pixel positions agree by
 * construction. T033 owns the container's size and the FR-290 follow-scroll.
 */

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

function hourLabel(hour: number, timeFormat: TimeFormat): string {
  if (timeFormat === "24h") return `${String(hour).padStart(2, "0")}:00`;
  const meridiem = hour < 12 ? "AM" : "PM";
  const twelve = hour % 12 === 0 ? 12 : hour % 12;
  return `${twelve} ${meridiem}`;
}

export interface WeekGridProps {
  /** The visible slice's consecutive household-local dates (FR-289). */
  columnDates: readonly string[];
  /** Household-local today; `null` before the clock's first publish. */
  todayDate: string | null;
  /** Everything `layoutWeek` computed for this slice. */
  layout: WeekLayout;
  /** Category id → palette colour, for the fills in draw order (FR-227). */
  colorsById: Readonly<Record<string, PaletteColor>>;
  /** Household IANA zone (FR-219/284). */
  zone: string;
  timeFormat: TimeFormat;
  /**
   * Callback ref to the scrolling hour viewport — T027's measurement target
   * and the FR-290 follow-scroll's node, composed by `WeekView` (T033/T034).
   */
  viewportRef?: (node: HTMLDivElement | null) => void;
  /** Every viewport scroll, manual or not — `useFollowScroll` tells them apart. */
  onViewportScroll?: () => void;
  /** FR-256: a block or "+n more" row press opens that occurrence's details. */
  onOpen?: (occurrence: Occurrence) => void;
  /** FR-254/255: a tap on empty grid — the column's date and the 15-minute slot's wall minutes. */
  onSlotTap?: (date: string, minutes: number) => void;
}

export function WeekGrid({
  columnDates,
  todayDate,
  layout,
  colorsById,
  zone,
  timeFormat,
  viewportRef,
  onViewportScroll,
  onOpen,
  onSlotTap,
}: WeekGridProps) {
  return (
    <div ref={viewportRef} onScroll={onViewportScroll} className="min-h-0 flex-1 overflow-y-auto">
      <div className="grid" style={headerGridTemplate(columnDates.length)}>
        {/* The hour gutter: labels sit ON their hour lines (translated up),
            decorative for assistive tech — blocks carry their own times. */}
        <div aria-hidden="true" className="text-right">
          {HOURS.map((hour) => (
            <div key={hour} className="h-(--fam-hour-row-h) pr-2">
              <span
                className={`block text-(length:--fam-fs-body) text-(--fam-text-secondary) tabular-nums ${
                  hour === 0 ? "" : "-translate-y-1/2"
                }`}
              >
                {hourLabel(hour, timeFormat)}
              </span>
            </div>
          ))}
        </div>

        {columnDates.map((date, columnIndex) => (
          <DayColumn
            key={date}
            date={date}
            todayDate={todayDate}
            zone={zone}
            timeFormat={timeFormat}
            segments={layout.timed.filter((segment) => segment.columnIndex === columnIndex)}
            overflow={layout.overflow.filter((group) => group.columnIndex === columnIndex)}
            colorsById={colorsById}
            onOpen={onOpen}
            onSlotTap={onSlotTap}
          />
        ))}
      </div>
    </div>
  );
}
