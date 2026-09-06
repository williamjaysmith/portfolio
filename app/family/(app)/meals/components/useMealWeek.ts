"use client";

import { useCallback, useMemo, useState } from "react";

import { localDateOf } from "@/lib/family/calendar/dates";
import { shiftWeek, weekDatesOf, weekLabelOf } from "@/lib/family/meals/week";
import type { WeekStart } from "@/lib/family/types";

import { useNow } from "../../components/Clock";

/**
 * The week the grid shows (006 FR-602, FR-603, R606): the household's week
 * around today, moved whole weeks by the arrows, brought back by Today. Today
 * itself comes from the household clock in the household's zone; before the
 * clock's first publish the server's date carries the first paint, so the grid
 * never opens on an empty week. The date rolls over live at midnight (the
 * calendar's FR-210): the marker moves, and the shown week stays put until
 * Today is pressed.
 */

export interface MealWeek {
  /** The seven dates on show, from the household's start day. */
  dates: string[];
  label: string;
  /** Household-local today. */
  todayDate: string;
  isCurrentWeek: boolean;
  page: (direction: -1 | 1) => void;
  today: () => void;
}

export interface UseMealWeekOptions {
  zone: string;
  startWeekOn: WeekStart;
  /** The server's household-local today, for the first paint. */
  initialToday: string;
}

export function useMealWeek({ zone, startWeekOn, initialToday }: UseMealWeekOptions): MealWeek {
  const now = useNow();
  const todayDate = now === null ? initialToday : localDateOf(zone, now.getTime());
  const [offset, setOffset] = useState(0);

  const dates = useMemo(() => weekDatesOf(shiftWeek(todayDate, offset), startWeekOn), [todayDate, offset, startWeekOn]);
  const page = useCallback((direction: -1 | 1) => setOffset((current) => current + direction), []);
  const today = useCallback(() => setOffset(0), []);

  return { dates, label: weekLabelOf(dates), todayDate, isCurrentWeek: offset === 0, page, today };
}
