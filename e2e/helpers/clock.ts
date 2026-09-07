import type { Page } from "@playwright/test";

/**
 * 008 — pinning the browser's own clock for the reminder journeys, the way
 * harness.md §5 requires: **by minutes or hours, never by days.** The
 * signed-in session is a token minted by a server running on the real clock;
 * a browser whose `Date` believes it is days away decides that token has
 * expired and loops asking for a new one. Every reminder in this phase fires
 * within a horizon of at most seven days and is judged stale after fifteen
 * minutes (FR-817), so nothing this suite tests ever needs more than an hour
 * of pinning — `pinForward` refuses more, structurally, rather than trusting
 * every call site to remember why.
 *
 * `page.clock` (Playwright's own fake clock, installed for the whole browser
 * context) replaces `Date`, `setTimeout` and `setInterval` — which is exactly
 * what the shell's minute clock (`useNow`, `app/family/(app)/components/
 * Clock.tsx`) is built on, so pinning the page's clock is pinning the app's.
 */

/** Comfortably more than any reminder in this phase needs; nowhere near "days". */
const MAX_JUMP_MS = 3 * 60 * 60 * 1000;

/**
 * Install the fake clock at (essentially) real "now", before this page
 * navigates anywhere. Installing before the first `goto` — Playwright's own
 * recommendation — means the sign-in session and every timer already
 * scheduled by the app is set up against a clock that has not yet been
 * touched, and only diverges from real time once a journey asks it to.
 */
export async function installClock(page: Page): Promise<void> {
  await page.clock.install({ time: Date.now() });
}

/** The browser's own idea of "now", in milliseconds — read directly, never parsed from text. */
export function nowMs(page: Page): Promise<number> {
  return page.evaluate(() => Date.now());
}

/**
 * Jump the pinned clock forward by `ms` and let its due timers catch up —
 * `useNow`'s minute tick among them — so the shell notices without a reload.
 */
export async function pinForward(page: Page, ms: number): Promise<void> {
  if (ms <= 0 || ms > MAX_JUMP_MS) {
    throw new Error(
      `pinForward: ${ms}ms is outside the hours-not-days window this suite allows (harness.md §5)`,
    );
  }
  await page.clock.fastForward(ms);
}

/** "14:06" — a moment in the household's zone, in the 24-hour shape the event form's time fields take. */
export function wallTime(ms: number, zone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hourCycle: "h23",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(ms));
  const of = (type: string): string => parts.find((part) => part.type === type)?.value ?? "00";
  return `${of("hour")}:${of("minute")}`;
}
