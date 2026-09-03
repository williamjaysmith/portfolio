"use client";

import { useCallback, useState } from "react";

import {
  addDays,
  diffDays,
  localDateOf,
  sliceStarts,
  weekStartOf,
} from "@/lib/family/calendar/dates";
import type { WeekStart } from "@/lib/family/types";

import { useNow } from "../../components/Clock";

/**
 * The displayed week as a two-state anchor (FR-210, R210).
 *
 * While `kind` is `"today"` the shown week is DERIVED from Phase 1's shared
 * clock store (`useNow`, minute resolution — no timer of this hook's own)
 * converted to the household's zone (FR-284), so midnight rolls today's
 * marker and — at a week boundary — the week itself with no effect code and
 * no reload. A `"pinned"` anchor carries an absolute week start and derives
 * NOTHING from the clock, which makes FR-210's qualifier — never yank a
 * person who has navigated away — a property of the type rather than an `if`.
 *
 * The slice (FR-289) follows the same shape: `null` means "the slice
 * containing today", resolved at render, so Today (FR-281) restores it by
 * state alone and a fresh mount starts on it; a number is the person's own
 * navigation and is preserved — clamped, never reset — across midnight,
 * rotation and week steps.
 */

/** `today` follows the clock; `pinned` is navigation and ignores it. */
export type WeekAnchor = { kind: "today" } | { kind: "pinned"; weekStart: string };

export interface UseWeekAnchorOptions {
  /** Household IANA zone (FR-284) — weeks roll on ITS midnight, not the device's. */
  zone: string;
  startWeekOn: WeekStart;
  /** Visible day columns (FR-277/278); fixes the slice tiling (FR-289). */
  columns: number;
  /**
   * The server-rendered current week (R207), shown only until the client
   * clock's first publish — `useNow` is `null` while hydrating.
   */
  initialWeekStart: string;
}

export interface WeekAnchorState {
  anchor: WeekAnchor;
  /** First day (`YYYY-MM-DD`) of the displayed week — always defined. */
  weekStart: string;
  /** Household-local date of now; `null` during server render and first paint. */
  todayDate: string | null;
  /** Index into `sliceStarts(columns)`, clamped to the current tiling. */
  sliceIndex: number;
  sliceCount: number;
  /** FR-281: back to the live week and the slice containing today. */
  goToToday: () => void;
  /** FR-281: step a whole anchored week, pinning it (R210). */
  goToPreviousWeek: () => void;
  goToNextWeek: () => void;
  /** Cross-week slice paging (R211): pin a week, optionally landing on a slice. */
  pinWeek: (weekStart: string, sliceIndex?: number) => void;
  /** Same-week slice swipe — never pins (R210). */
  setSliceIndex: (index: number) => void;
}

const TODAY: WeekAnchor = { kind: "today" };

export function useWeekAnchor(options: UseWeekAnchorOptions): WeekAnchorState {
  const { zone, startWeekOn, columns, initialWeekStart } = options;
  const now = useNow();
  const [anchor, setAnchor] = useState<WeekAnchor>(TODAY);
  const [chosenSlice, setChosenSlice] = useState<number | null>(null);

  const todayDate = now === null ? null : localDateOf(zone, now.getTime());
  const weekStart = deriveWeekStart(anchor, todayDate, startWeekOn, initialWeekStart);
  const starts = sliceStarts(columns);
  const sliceIndex = resolveSlice(chosenSlice, starts, columns, weekStart, todayDate);

  const goToToday = useCallback(() => {
    setAnchor(TODAY);
    setChosenSlice(null);
  }, []);

  const pinWeek = useCallback(
    (target: string, slice?: number) => {
      setAnchor({ kind: "pinned", weekStart: weekStartOf(target, startWeekOn) });
      if (slice !== undefined) setChosenSlice(slice);
    },
    [startWeekOn],
  );

  const goToPreviousWeek = useCallback(
    () => pinWeek(addDays(weekStart, -7)),
    [pinWeek, weekStart],
  );
  const goToNextWeek = useCallback(() => pinWeek(addDays(weekStart, 7)), [pinWeek, weekStart]);

  const setSliceIndex = useCallback((index: number) => setChosenSlice(index), []);

  return {
    anchor,
    weekStart,
    todayDate,
    sliceIndex,
    sliceCount: starts.length,
    goToToday,
    goToPreviousWeek,
    goToNextWeek,
    pinWeek,
    setSliceIndex,
  };
}

/** A pinned week is absolute; the live week is the clock's, or the server's until it ticks. */
function deriveWeekStart(
  anchor: WeekAnchor,
  todayDate: string | null,
  startWeekOn: WeekStart,
  initialWeekStart: string,
): string {
  if (anchor.kind === "pinned") return anchor.weekStart;
  return todayDate === null ? initialWeekStart : weekStartOf(todayDate, startWeekOn);
}

/**
 * `null` chases today (first matching slice when the pulled-back last slice
 * overlaps — R211); a chosen index is honoured but clamped to the tiling.
 * Today outside the displayed week — or not yet known — lands on slice 0.
 */
function resolveSlice(
  chosen: number | null,
  starts: number[],
  columns: number,
  weekStart: string,
  todayDate: string | null,
): number {
  if (chosen !== null) return Math.min(Math.max(chosen, 0), starts.length - 1);
  if (todayDate === null) return 0;
  const offset = diffDays(weekStart, todayDate);
  const index = starts.findIndex((start) => start <= offset && offset < start + columns);
  return index === -1 ? 0 : index;
}
