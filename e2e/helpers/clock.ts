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
 * How much of the household's day a reminder journey needs left in front of it.
 *
 * These journeys put an event a few minutes out and end it half an hour later,
 * then read the wall time of both ends into the form's `time` fields — which
 * carry no date. Run them close enough to midnight and the end wraps to
 * "00:14" against a start of "23:44", the form says *"The end must be after
 * the start"*, and every later assertion fails with an event that was never
 * saved. It failed exactly that way at 23:32 on 2026-09-10 and would have
 * failed every night in that hour.
 */
const MIDNIGHT_CLEARANCE_MS = 90 * 60 * 1000;

/** Milliseconds left in the household's own day. */
function msLeftInDay(atMs: number, zone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hourCycle: "h23",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(atMs));
  const of = (type: string): number => Number(parts.find((part) => part.type === type)?.value ?? "0");
  const elapsed = (of("hour") * 60 + of("minute")) * 60_000 + of("second") * 1000;
  return 24 * 60 * 60_000 - elapsed;
}

/**
 * Install the fake clock at (essentially) real "now", before this page
 * navigates anywhere. Installing before the first `goto` — Playwright's own
 * recommendation — means the sign-in session and every timer already
 * scheduled by the app is set up against a clock that has not yet been
 * touched, and only diverges from real time once a journey asks it to.
 *
 * **Pass `zone` and it will also step back off midnight**, by however little
 * it takes to leave `MIDNIGHT_CLEARANCE_MS` of the household's day in front of
 * the journey — at most that, and never a whole day, so harness.md §5's rule
 * still holds. Backwards is the safe direction for the session: the token was
 * minted on the real clock, and a browser that believes it is slightly earlier
 * sees that token as further from expiry, never past it.
 */
export async function installClock(page: Page, zone?: string): Promise<void> {
  const now = Date.now();
  if (zone === undefined) {
    await page.clock.install({ time: now });
    return;
  }
  const left = msLeftInDay(now, zone);
  const back = left >= MIDNIGHT_CLEARANCE_MS ? 0 : MIDNIGHT_CLEARANCE_MS - left;
  await page.clock.install({ time: now - back });
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
