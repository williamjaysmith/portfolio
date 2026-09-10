"use client";

import { useCallback, useMemo, useState } from "react";

import { localDateOf } from "@/lib/family/calendar/dates";
import { shiftWindow, windowDatesOf, windowLabelOf } from "@/lib/family/meals/window";

import { useNow } from "../../components/Clock";

/**
 * The Meals tab's window (013 FR-1301–FR-1308): the days on show, the arrows and
 * Today.
 *
 * **One state, where there were two.** It replaces `useMealWeek`, which held a
 * seven-day household week paged ±7 by the arrows, while `useColumnPage` held
 * which slice of those seven was visible and paged one column at a time by swipe.
 * On the wall tablet all seven fit and the two agreed. On a phone two fit and
 * they did not: the arrows moved seven days while two were on screen, so five
 * days per step were reachable only by an unlabelled gesture. See
 * `lib/family/meals/window.ts` for why making them agree cannot work.
 *
 * **The window is HELD, not derived from the clock** — 006's rule, kept
 * deliberately, and the subtlest thing here. `todayDate` is recomputed from the
 * household clock on every render, so the marker moves at midnight. `anchor` is
 * *initialised* from the server's today and then left alone, so the window does
 * not move under somebody who is mid-plan when the date rolls. `today()`
 * re-anchors on demand, on the new today.
 *
 * That distinction is one line and invisible to any test that cannot cross
 * midnight — which is every browser test, because the e2e clock helper refuses
 * jumps over three hours (009). Its guarantee lives in this hook's own suite.
 *
 * **`columns` is measured, never assumed.** It arrives from `useBoardGeometry`'s
 * `layout.perRow`, which sizes against `--fam-meal-cell-w`. The Calendar measures
 * a different token and genuinely fits a different number at the same width, so
 * the two tabs share this arithmetic and not their measuring.
 *
 * Note what is absent: `startWeekOn`. It no longer decides anything here (013
 * R1305) and keeps every other meaning it has — the anchored week the Tasks board
 * reads resolutions by, the star week beside it, `weekStartOf` everywhere else.
 * Taking it out of this signature is how that stays true rather than becoming a
 * silently ignored argument.
 */

export interface MealWindow {
  /** The days on show, in order, beginning with the anchor. */
  dates: string[];
  /** What the window is called — a day range, never a week's name. */
  label: string;
  /** Household-local today, which follows the clock. */
  todayDate: string;
  /** True while the window begins on today, so Today has nothing to do. */
  isLiveWindow: boolean;
  /** One window later (`1`) or earlier (`-1`) — exactly the width on show. */
  page: (direction: -1 | 1) => void;
  /** Back to the window beginning today. */
  today: () => void;
}

export interface UseMealWindowOptions {
  zone: string;
  /** The server's household-local today, for the first paint. */
  initialToday: string;
  /** How many whole day columns the grid measured (FR-1301). */
  columns: number;
}

export function useMealWindow({ zone, initialToday, columns }: UseMealWindowOptions): MealWindow {
  const now = useNow();
  const todayDate = now === null ? initialToday : localDateOf(zone, now.getTime());
  const [anchor, setAnchor] = useState(initialToday);

  const dates = useMemo(() => windowDatesOf(anchor, columns), [anchor, columns]);

  const page = useCallback(
    (direction: -1 | 1) => setAnchor((current) => shiftWindow(current, columns, direction)),
    [columns],
  );
  const today = useCallback(() => setAnchor(todayDate), [todayDate]);

  return {
    dates,
    label: windowLabelOf(dates),
    todayDate,
    // The window begins on today — not merely contains it. Containing today was
    // the old `isCurrentWeek`, and under a window anchored on today the two come
    // apart: page forward at seven columns and today is still on screen while
    // the window is no longer the live one, so Today must stay offered.
    isLiveWindow: dates[0] === todayDate,
    page,
    today,
  };
}
