"use client";

import { useCallback, useMemo, useState } from "react";

import { localDateOf } from "@/lib/family/calendar/dates";
import { shiftWeek, weekDatesOf, weekLabelOf } from "@/lib/family/meals/week";
import type { WeekStart } from "@/lib/family/types";

import { useNow } from "../../components/Clock";

/**
 * The Meals tab's week (006 FR-603, R606): the seven dates on show from the
 * household's start day, the arrows and Today. **The shown week is held, not
 * derived from the clock** (spec edge case "the date rolls over at midnight
 * with the grid open"): today's marker moves with the household clock, the
 * week stays where it was put, and Today brings the new week. The first
 * paint anchors on the server's today so there is no flicker.
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
  const [anchor, setAnchor] = useState(initialToday);

  const dates = useMemo(() => weekDatesOf(anchor, startWeekOn), [anchor, startWeekOn]);
  const page = useCallback((direction: -1 | 1) => setAnchor((current) => shiftWeek(current, direction)), []);
  const today = useCallback(() => setAnchor(todayDate), [todayDate]);

  return { dates, label: weekLabelOf(dates), todayDate, isCurrentWeek: dates.includes(todayDate), page, today };
}
