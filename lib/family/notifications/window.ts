/**
 * How far back a reminder is still worth showing, and what one run of the scan
 * considers (008 FR-817, FR-829, R803).
 *
 * The reference says nothing about a device that was asleep [UNKNOWN]. A wall
 * tablet that wakes at nine in the morning and shows a pile of banners for
 * seven o'clock is a failure, not a feature, so this project drops anything
 * more than fifteen minutes past (spec Assumption 10).
 *
 * The arithmetic lives here, away from the scheduler, precisely so it can be
 * tested: an hour-long outage is a thing you can write a test about and not a
 * thing you can arrange.
 */

/** Fifteen minutes. Older than this and a reminder is not worth showing. */
export const MAX_STALENESS_MS = 15 * 60 * 1000;

export interface RunWindow {
  /** Exclusive: a reminder exactly at `fromMs` belonged to the previous run. */
  fromMs: number;
  /** Inclusive: the instant this run was started. */
  toMs: number;
}

/**
 * The window one run considers: everything since the last successful run, but
 * never more than `MAX_STALENESS_MS`.
 *
 * `null` — the first run ever, or a deployment that has forgotten — is treated
 * as a full window rather than as "everything since the epoch", so a fresh
 * install does not send a year of history to somebody's phone.
 *
 * A `lastRunMs` in the FUTURE is clamped to `nowMs`, giving an empty window.
 * Clocks do go backwards (a corrected server, a daylight-saving misconfigured
 * host), and the correct answer to "the last run was in the future" is to send
 * nothing this minute, not to invert the window and send everything.
 */
export function runWindowOf(lastRunMs: number | null, nowMs: number): RunWindow {
  const earliest = nowMs - MAX_STALENESS_MS;
  if (lastRunMs === null) return { fromMs: earliest, toMs: nowMs };
  return { fromMs: Math.min(Math.max(lastRunMs, earliest), nowMs), toMs: nowMs };
}

/** Whether an instant falls in the window: `(fromMs, toMs]`. */
export function inWindow(instantMs: number, window: RunWindow): boolean {
  return instantMs > window.fromMs && instantMs <= window.toMs;
}

/**
 * Whether a reminder is still worth putting on a screen right now.
 *
 * This is the BANNER's test, and it is deliberately not `inWindow`: a browser
 * has no "last run" to remember, only a clock. A moment in the future has not
 * arrived; a moment more than fifteen minutes past is not worth showing.
 */
export function isCurrent(fireAtMs: number, nowMs: number): boolean {
  return fireAtMs <= nowMs && nowMs - fireAtMs <= MAX_STALENESS_MS;
}
