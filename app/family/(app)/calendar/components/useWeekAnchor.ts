"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";

import { localDateOf, weekAnchorOf } from "@/lib/family/calendar/dates";
import { anchorForToday, pagedAnchor, type CalendarView } from "@/lib/family/calendar/views";
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
 * A reminder's banner links to the day it belongs to, so the anchor can also
 * be SEEDED from the URL — `?on=YYYY-MM-DD` (008 R815). It is read once, in the
 * `useState` initialiser, and never looked at again: a parameter that kept
 * asserting itself would fight the pager on every render, and the person who
 * arrived from a banner is free to page away from the day it sent them to.
 * An absent or unparseable value simply means today, exactly as before.
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
   * 011 R1106: which view is paging. The anchor's TYPE, its `?on=` seed and
   * `openAt` are identical across views — only the STEP and the live
   * derivation differ, so this hook is parameterised rather than duplicated.
   * A week steps by its columns; a day by a day; a month by a calendar month,
   * which is the one step a day count cannot express.
   */
  view?: CalendarView;
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
  /**
   * 009 FR-909/FR-916: pin the window to a NAMED day, for a surface that
   * already knows which one — a countdown's target, or a search result's date.
   *
   * Distinct from `?on=`, which is 008's cross-ROUTE seed read once on mount:
   * both of this phase's callers are on the calendar tab already, so they move
   * the anchor in place rather than navigating, and the back button keeps
   * meaning what it means.
   */
  openAt: (date: string) => void;
}

const TODAY: WeekAnchor = { kind: "today" };

export function useWeekAnchor(options: UseWeekAnchorOptions): WeekAnchorState {
  const { zone, startWeekOn, columns, initialAnchorDate } = options;
  const view = options.view ?? "week";
  const now = useNow();
  const openOn = useOpenOn();
  const [anchor, setAnchor] = useState<WeekAnchor>(() => anchorFor(openOn));

  const todayDate = now === null ? null : localDateOf(zone, now.getTime());
  const anchorDate = deriveAnchorDate(anchor, todayDate, startWeekOn, initialAnchorDate, view);

  const goToToday = useCallback(() => setAnchor(TODAY), []);

  // No start-of-week snap on the way out: a page must land exactly where it
  // aimed, or the window would drift and repeat days it has already shown.
  //
  // 011 R1106: the STEP is the view's — `pagedAnchor` owns which unit each one
  // moves in, so a month's 28-to-31 days never becomes a day count here.
  const page = useCallback(
    (direction: -1 | 1) => {
      setAnchor({ kind: "pinned", date: pagedAnchor(view, anchorDate, direction, { columns }) });
    },
    [view, anchorDate, columns],
  );

  const openAt = useCallback((date: string) => setAnchor({ kind: "pinned", date }), []);

  return { anchor, anchorDate, todayDate, goToToday, page, openAt };
}

/**
 * `?on=` accepts a plain household-local date and nothing else. It is checked
 * for shape AND for being a real date, so `?on=2026-02-31` is today rather than
 * a window onto the 3rd of March: this value comes off a URL, which anybody can
 * type.
 */
const ON_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * `useSearchParams` is typed as always returning params, but returns null when
 * there is no router above it — which is true of every unit test that renders
 * the week without one, and would otherwise turn a missing provider into a
 * crash on the calendar rather than a missing parameter.
 */
function useOpenOn(): string | null {
  const params = useSearchParams();
  return params ? params.get("on") : null;
}

function anchorFor(openOn: string | null): WeekAnchor {
  if (openOn === null || !ON_DATE.test(openOn)) return TODAY;
  const parsed = new Date(`${openOn}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== openOn) return TODAY;
  return { kind: "pinned", date: openOn };
}

/** A pinned window is absolute; the live one begins on today, or on the server's date until it ticks. */
function deriveAnchorDate(
  anchor: WeekAnchor,
  todayDate: string | null,
  startWeekOn: WeekStart,
  initialAnchorDate: string,
  view: CalendarView,
): string {
  if (anchor.kind === "pinned") return anchor.date;
  if (todayDate === null) return initialAnchorDate;
  // 011 R1106: only the WEEK snaps through its own start-of-week rule. A day
  // is today; a month anchors on today too, and derives its grid's own first
  // day from it — so the anchor stays one date whatever the view.
  return anchorForToday(view, todayDate, weekAnchorOf(todayDate, startWeekOn));
}
