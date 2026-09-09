"use client";

import { useCallback, useState } from "react";

import type { PaletteColor } from "@/lib/family/colors";
import type { Occurrence, TimeFormat, WeekStart } from "@/lib/family/types";

import type { EditTarget } from "./event-drafts";
import { MonthDayList } from "./MonthDayList";
import { MonthView } from "./MonthView";
import { occurrenceOnDay } from "./occurrence-on-day";
import { useMonthOccurrences } from "./useMonthOccurrences";

/**
 * The Month view, and everything only it needs (011).
 *
 * **This component IS the condition.** It mounts only while Month is showing,
 * so `useMonthOccurrences` — and the 35-to-42-day read behind it — happens then
 * and at no other time. An earlier version called that hook unconditionally
 * from the screen's model, which meant the WEEK view fetched and expanded a
 * whole month on every calendar load, while a comment two lines above claimed
 * it did not. That is the shipped `useTaskBox` idiom this project already has a
 * name for: mounting is the `enabled`.
 *
 * It opens an event through `openTarget` rather than the editor's `openDetails`
 * for the same reason the countdown list and the search do: the editor resolves
 * a tapped occurrence against the WEEK's cached rows, and a month cell's day is
 * routinely outside that window. This component holds the month's own rows, so
 * it builds the target itself (009 R909).
 */

export interface MonthBodyProps {
  householdId: string;
  /** Any day of the month being shown. */
  anchorDate: string;
  zone: string;
  startWeekOn: WeekStart;
  todayDate: string | null;
  timeFormat: TimeFormat;
  colorsById: Readonly<Record<string, PaletteColor>>;
  /** FR-1113: a cell is a door to its day. */
  onOpenDay: (date: string) => void;
  /** Details for an event this component already holds. */
  onOpenTarget: (target: EditTarget) => void;
  /** The screen's chrome, drawn above the grid (FR-1116). */
  previewBar: React.ReactNode;
  /** The screen's own notices, so the month reports failures where the week does. */
  notices: React.ReactNode;
}

const NO_OCCURRENCES: Occurrence[] = [];

export function MonthBody({
  householdId,
  anchorDate,
  zone,
  startWeekOn,
  todayDate,
  timeFormat,
  colorsById,
  onOpenDay,
  onOpenTarget,
  previewBar,
  notices,
}: MonthBodyProps) {
  const month = useMonthOccurrences({ householdId, anchorDate, zone, startWeekOn });
  const [dayList, setDayList] = useState<string | null>(null);
  const closeList = useCallback(() => setDayList(null), []);

  const dayOccurrences =
    dayList === null
      ? NO_OCCURRENCES
      : (month.rows.flat().find((cell) => cell.date === dayList)?.all ?? NO_OCCURRENCES);

  const open = useCallback(
    (occurrence: Occurrence) => {
      const target = occurrenceOnDay(
        month.events,
        occurrence.eventId,
        occurrence.occurrenceDate,
        zone,
      );
      if (target !== null) onOpenTarget(target);
    },
    [month.events, zone, onOpenTarget],
  );

  return (
    <>
      {previewBar}
      {notices}
      <MonthView
        rows={month.rows}
        segments={month.segments}
        startDate={month.window.startDate}
        todayDate={todayDate}
        startWeekOn={startWeekOn}
        zone={zone}
        timeFormat={timeFormat}
        colorsById={colorsById}
        onOpenDay={onOpenDay}
        onOpenList={setDayList}
        onOpen={open}
      />

      {dayList === null ? null : (
        <MonthDayList
          date={dayList}
          occurrences={dayOccurrences}
          zone={zone}
          timeFormat={timeFormat}
          onOpen={(occurrence) => {
            closeList();
            open(occurrence);
          }}
          onClose={closeList}
        />
      )}
    </>
  );
}
