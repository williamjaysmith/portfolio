"use client";

import { MINUTES_PER_DAY } from "@/lib/family/week-geometry";

import { useNow } from "../../components/Clock";

/**
 * FR-208 (T032): the current-time indicator — a 2pt coral bar across today's
 * column with a dot at its gutter edge, drawn above the event blocks.
 *
 * The PARENT decides "today's column only" by rendering this inside exactly
 * that column (`DayColumn` does); this component only positions itself.
 * Position derives from Phase 1's shared minute-resolution clock store
 * (`useNow`) — no timer of its own, so the bar moves once a minute with no
 * reload and rolls to the next column at midnight when `todayDate` above
 * moves (US1-3/4). During server render and first paint `useNow` is `null`
 * and nothing is drawn — the server has no clock the client would agree with.
 *
 * Vertical placement is wall-clock minutes in the HOUSEHOLD zone (FR-284)
 * as a fraction of the 24-row canvas, matching layout.ts's ruler exactly.
 * Decorative for assistive tech: the top bar's clock announces the time.
 */

const wallFormatters = new Map<string, Intl.DateTimeFormat>();

function wallFormatterFor(zone: string): Intl.DateTimeFormat {
  const cached = wallFormatters.get(zone);
  if (cached) return cached;
  // h23 pins midnight to "00"; construction is the expensive part, cache it.
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hourCycle: "h23",
    hour: "2-digit",
    minute: "2-digit",
  });
  wallFormatters.set(zone, formatter);
  return formatter;
}

/**
 * Wall minutes since the household zone's midnight — an instant→wall READ.
 * Shared with the FR-290 follow-scroll (`useFollowScroll`), which must place
 * the same line at the same y; two conversions could disagree by a minute.
 */
export function wallMinutesOf(zone: string, instantMs: number): number {
  const text = wallFormatterFor(zone).format(instantMs); // "HH:MM"
  return Number(text.slice(0, 2)) * 60 + Number(text.slice(3, 5));
}

export interface NowLineProps {
  /** Household IANA zone (FR-284) — never the device's. */
  zone: string;
}

export function NowLine({ zone }: NowLineProps) {
  const now = useNow();
  if (now === null) return null;

  const minutes = wallMinutesOf(zone, now.getTime());
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 z-10"
      style={{ top: `${(minutes / MINUTES_PER_DAY) * 100}%` }}
    >
      <div className="h-(--fam-nowline-w) w-full -translate-y-1/2 bg-(--fam-accent-coral)" />
      <div className="absolute top-0 left-0 size-(--fam-nowline-dot) -translate-x-1/2 -translate-y-1/2 rounded-full bg-(--fam-accent-coral)" />
    </div>
  );
}
