"use client";

import { useCallback, useState } from "react";

import { addDays, localDateOf, weekAnchorOf } from "@/lib/family/calendar/dates";
import type { WeekStart } from "@/lib/family/types";

import { useNow } from "../../components/Clock";

/**
 * The displayed window as a two-state anchor (FR-210, R210).
 *
 * While `kind` is `"today"` the window is DERIVED from Phase 1's shared clock
 * store (`useNow`, minute resolution — no timer of this hook's own) converted
 * to the household's zone (FR-284), so midnight rolls today's marker and the
 * window itself with no effect code and no reload. A `"pinned"` anchor carries
 * an absolute first day and derives NOTHING from the clock, which makes
 * FR-210's qualifier — never yank a person who has navigated away — a property
 * of the type rather than an `if`.
 *
 * The window is `columns` days wide starting AT the anchor, and paging moves
 * the anchor by exactly `columns` days. That is the whole navigation model:
 * three columns step three days, seven step seven, so consecutive pages abut
 * — no day is skipped between them and none is shown twice. The arrows, the
 * swipe (`WeekPager`) and the drag's edge-hold all take that one step, so
 * "one page later" means a single thing across the view.
 */

/** `today` follows the clock; `pinned` is navigation and ignores it. */
export type WeekAnchor = { kind: "today" } | { kind: "pinned"; date: string };

export interface UseWeekAnchorOptions {
  /** Household IANA zone (FR-284) — the window rolls on ITS midnight, not the device's. */
  zone: string;
  startWeekOn: WeekStart;
  /** Visible day columns (FR-277/278) — the window's width AND its paging step. */
  columns: number;
  /**
   * The server-rendered first day (R207), shown only until the client clock's
   * first publish — `useNow` is `null` while hydrating.
   */
  initialAnchorDate: string;
}

export interface WeekAnchorState {
  anchor: WeekAnchor;
  /** Leftmost displayed day (`YYYY-MM-DD`) — always defined. */
  anchorDate: string;
  /** Household-local date of now; `null` during server render and first paint. */
  todayDate: string | null;
  /** FR-281: back to the live window, which begins on today. */
  goToToday: () => void;
  /** FR-279/281: one page later (`1`) or earlier (`-1`) — exactly `columns` days. */
  page: (direction: -1 | 1) => void;
}

const TODAY: WeekAnchor = { kind: "today" };

export function useWeekAnchor(options: UseWeekAnchorOptions): WeekAnchorState {
  const { zone, startWeekOn, columns, initialAnchorDate } = options;
  const now = useNow();
  const [anchor, setAnchor] = useState<WeekAnchor>(TODAY);

  const todayDate = now === null ? null : localDateOf(zone, now.getTime());
  const anchorDate = deriveAnchorDate(anchor, todayDate, startWeekOn, initialAnchorDate);

  const goToToday = useCallback(() => setAnchor(TODAY), []);

  // No start-of-week snap on the way out: a page must land exactly where it
  // aimed, or the window would drift and repeat days it has already shown.
  const page = useCallback(
    (direction: -1 | 1) => {
      setAnchor({ kind: "pinned", date: addDays(anchorDate, direction * columns) });
    },
    [anchorDate, columns],
  );

  return { anchor, anchorDate, todayDate, goToToday, page };
}

/** A pinned window is absolute; the live one begins on today, or on the server's date until it ticks. */
function deriveAnchorDate(
  anchor: WeekAnchor,
  todayDate: string | null,
  startWeekOn: WeekStart,
  initialAnchorDate: string,
): string {
  if (anchor.kind === "pinned") return anchor.date;
  return todayDate === null ? initialAnchorDate : weekAnchorOf(todayDate, startWeekOn);
}
