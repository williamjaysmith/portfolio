"use client";

import { useSyncExternalStore } from "react";

import type { TimeFormat } from "@/lib/family/types";

/**
 * The wall clock in the top bar (FR-031).
 *
 * A module-level store ticks once a second but only publishes a new snapshot
 * when the minute changes, so the shell re-renders 60× less often than it
 * would with a naive interval — and the date rolls over at midnight without a
 * reload. `useSyncExternalStore` keeps this out of an effect, which
 * `react-hooks/set-state-in-effect` forbids.
 */

let current: Date | null = null;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function sameMinute(a: Date, b: Date): boolean {
  return (
    a.getMinutes() === b.getMinutes() &&
    a.getHours() === b.getHours() &&
    a.getDate() === b.getDate() &&
    a.getMonth() === b.getMonth() &&
    a.getFullYear() === b.getFullYear()
  );
}

function tick(): void {
  const next = new Date();
  if (current && sameMinute(current, next)) return;
  current = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  // First mount after an idle period: re-read the clock rather than serving
  // whatever `getSnapshot` last cached.
  if (listeners.size === 0) current = new Date();
  listeners.add(listener);
  timer ??= setInterval(tick, 1000);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

/** Cached: returning a fresh Date on every call would loop forever. */
function getSnapshot(): Date | null {
  current ??= new Date();
  return current;
}

/** The server has no clock the client will agree with, so it renders nothing. */
function getServerSnapshot(): Date | null {
  return null;
}

/** Current time at minute resolution; `null` during server render and first paint. */
export function useNow(): Date | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** "8:00 AM" (no leading zero) or "08:00". */
function formatTime(date: Date, format: TimeFormat): string {
  const minutes = String(date.getMinutes()).padStart(2, "0");
  if (format === "24h") return `${String(date.getHours()).padStart(2, "0")}:${minutes}`;

  const hour24 = date.getHours();
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${minutes} ${hour24 < 12 ? "AM" : "PM"}`;
}

/** "Wed, Mar 22" — the top bar's alternative to the household name. */
export function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export interface ClockProps {
  format: TimeFormat;
}

export function Clock({ format }: ClockProps) {
  const now = useNow();
  return (
    <span
      // Announcing every minute would be noise; the time is available on demand.
      aria-live="off"
      className="font-medium text-(length:--fam-fs-clock) text-(--fam-text-primary) tabular-nums"
    >
      {now ? formatTime(now, format) : " "}
    </span>
  );
}
