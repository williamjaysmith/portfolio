"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { localDateOf } from "@/lib/family/calendar/dates";

import { useNow } from "../../components/Clock";
import { wallMinutesOf } from "./NowLine";

/**
 * T034: the FR-290 follow-scroll (US1-15, Assumption 42). While the grid is
 * untouched, its vertical scroll FOLLOWS the household zone's current time —
 * the now line held about a third of the viewport's height from the top, so
 * the wall shows now and the hours ahead at any hour of the day. A manual
 * scroll of the hours pauses the following; the next household-zone day
 * rollover (FR-210) or a Today activation (FR-281) resumes it.
 *
 * The pause is DERIVED, not effect-driven: pausing records the household
 * date it happened on, and the grid follows exactly when there is no pause
 * or the recorded date is no longer today — so midnight resumes the follow
 * with no timer and no effect of this hook's own, the same shape as
 * `useWeekAnchor`'s pinning (R210; the clock is Phase 1's shared minute
 * store). A pause landed before the clock's first publish (sub-second, first
 * paint) records the sentinel and lifts at that publish — before the clock
 * there was nothing to follow away from.
 *
 * Its own repositioning also fires the viewport's scroll event, so the last
 * programmatic offset is remembered and `onScroll` treats a matching offset
 * as its own write, never a hand on the grid. The target is pre-clamped to
 * the canvas so the browser writes exactly what was asked and the echo
 * always matches.
 *
 * jsdom carve-out (constitution §II): the DOM wiring — that WeekGrid's real
 * viewport scrolls — is verified by running the app (T035); this hook's
 * pause/resume/positioning logic is what the unit suite drives with an
 * injected node and scale.
 */

/** The now line sits this fraction of the viewport down from the top. */
const ANCHOR_FRACTION = 1 / 3;

/** A pause recorded before the clock's first publish — see the header note. */
const BEFORE_FIRST_PUBLISH = "";

/**
 * FR-290's arithmetic: the scroll offset that puts `wallMinutes` a third of
 * the viewport from the top, clamped into the canvas's real scroll range.
 */
export function followScrollTop(
  wallMinutes: number,
  pxPerMinute: number,
  viewportHeightPx: number,
  contentHeightPx: number,
): number {
  const ideal = wallMinutes * pxPerMinute - viewportHeightPx * ANCHOR_FRACTION;
  const max = Math.max(0, contentHeightPx - viewportHeightPx);
  return Math.min(Math.max(ideal, 0), max);
}

export interface UseFollowScrollOptions {
  /** Household IANA zone (FR-284) — the day that rollovers resume on is ITS day. */
  zone: string;
  /** Measured vertical scale (`LayoutMetrics.pxPerMinute`); `null` until T027 measures. */
  pxPerMinute: number | null;
}

export interface FollowScrollState {
  /** Attach to the scrolling hour viewport (compose with T027's geometry ref). */
  viewportRef: (node: HTMLElement | null) => void;
  /** Wire to the viewport's scroll event; it tells a hand from its own writes. */
  onScroll: () => void;
  /** True while the grid follows the clock (FR-290). */
  following: boolean;
  /** FR-281: a Today activation resumes the following. */
  resume: () => void;
}

export function useFollowScroll(options: UseFollowScrollOptions): FollowScrollState {
  const { zone, pxPerMinute } = options;
  const now = useNow();
  // The node lives in a REF (the compiler treats state values as immutable,
  // and scrolling IS mutation); the epoch is the render-visible "a viewport
  // (re)attached" signal that re-runs the positioning effect.
  const nodeRef = useRef<HTMLElement | null>(null);
  const [attachEpoch, setAttachEpoch] = useState(0);
  /** The household date a manual scroll paused on; `null` = following. */
  const [pausedOnDate, setPausedOnDate] = useState<string | null>(null);
  const programmaticTop = useRef<number | null>(null);

  const todayDate = now === null ? null : localDateOf(zone, now.getTime());
  const wallMinutes = now === null ? null : wallMinutesOf(zone, now.getTime());
  const following =
    pausedOnDate === null || (todayDate !== null && todayDate !== pausedOnDate);

  const viewportRef = useCallback((next: HTMLElement | null) => {
    programmaticTop.current = null;
    nodeRef.current = next;
    setAttachEpoch((epoch) => epoch + 1);
  }, []);

  // The one DOM write: reposition whenever the minute, the measurement, the
  // attachment or the following state moves — never while paused or unmeasured.
  useEffect(() => {
    const node = nodeRef.current;
    if (!following || node === null || pxPerMinute === null || wallMinutes === null) return;
    const target = followScrollTop(wallMinutes, pxPerMinute, node.clientHeight, node.scrollHeight);
    programmaticTop.current = target;
    node.scrollTop = target;
  }, [following, attachEpoch, pxPerMinute, wallMinutes]);

  const onScroll = useCallback(() => {
    const node = nodeRef.current;
    if (node === null) return;
    const own = programmaticTop.current;
    // Sub-pixel: browsers round scrollTop, so an exact compare would misfire.
    if (own !== null && Math.abs(node.scrollTop - own) < 1) return;
    setPausedOnDate(todayDate ?? BEFORE_FIRST_PUBLISH);
  }, [todayDate]);

  const resume = useCallback(() => {
    setPausedOnDate(null);
  }, []);

  return { viewportRef, onScroll, following, resume };
}
