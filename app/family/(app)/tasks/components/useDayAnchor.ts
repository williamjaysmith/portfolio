"use client";

import { useCallback, useState } from "react";

import { addDays, localDateOf } from "@/lib/family/calendar/dates";

import { useNow } from "../../components/Clock";

/**
 * The displayed day as a two-state anchor (FR-315, R322).
 *
 * While `kind` is `"today"` the day is DERIVED from Phase 1's shared clock
 * store (`useNow`, minute resolution — no timer of this hook's own) converted
 * to the household's zone (FR-284), so at midnight the displayed day, the
 * carry read's key and everything the counters are computed from roll over
 * with no effect code, no reload and no interaction (SC-314). A `"pinned"`
 * anchor carries an absolute date and derives NOTHING from the clock, which
 * makes FR-315's qualifier — never pull away a person who has navigated — a
 * property of the type rather than an `if`.
 *
 * It is deliberately NOT `useWeekAnchor` with `columns: 1`: that hook's state
 * is a week start tiled into slices and its arrows step a page, which here
 * would be a lie maintained on both sides. What is shared is the date
 * arithmetic itself.
 */

/** `today` follows the clock; `pinned` is navigation and ignores it. */
export type DayAnchor = { kind: "today" } | { kind: "pinned"; date: string };

export interface UseDayAnchorOptions {
  /** Household IANA zone (FR-284) — the board rolls on ITS midnight, not the device's. */
  zone: string;
  /**
   * The server-rendered household-local date (R314), shown only until the
   * client clock's first publish — `useNow` is `null` while hydrating, and the
   * wall tablet's first paint must be the board rather than a loading state.
   */
  initialDate: string;
}

export interface DayAnchorState {
  anchor: DayAnchor;
  /** The day the board renders (`YYYY-MM-DD`) — always defined. */
  displayedDate: string;
  /** Household-local date of now; the FR-357 carry read's key, so it rolls at midnight. */
  todayDate: string;
  /** FR-357: the carry tail belongs on today only — pinning today's own date is still navigation. */
  isToday: boolean;
  /** FR-303: back to the live day. */
  goToToday: () => void;
  /** FR-303: Next (`1`) or Previous (`-1`) — one day, pinned absolutely. */
  step: (direction: -1 | 1) => void;
}

const TODAY: DayAnchor = { kind: "today" };

export function useDayAnchor(options: UseDayAnchorOptions): DayAnchorState {
  const { zone, initialDate } = options;
  const now = useNow();
  const [anchor, setAnchor] = useState<DayAnchor>(TODAY);

  const todayDate = now === null ? initialDate : localDateOf(zone, now.getTime());
  const displayedDate = anchor.kind === "pinned" ? anchor.date : todayDate;

  const goToToday = useCallback(() => setAnchor(TODAY), []);

  const step = useCallback(
    (direction: -1 | 1) => {
      setAnchor({ kind: "pinned", date: addDays(displayedDate, direction) });
    },
    [displayedDate],
  );

  // Compared by date, not by `anchor.kind`: a person who tapped Previous then
  // Next is on today's date but has still navigated, and at midnight that
  // pinned day stops being today while the anchor does not move.
  return { anchor, displayedDate, todayDate, isToday: displayedDate === todayDate, goToToday, step };
}
