/**
 * How wide THIS device drew the week last time (012).
 *
 * The column count is measured, and a server cannot measure. So the calendar's
 * server render has always seeded `DEFAULT_COLUMN_COUNT` days and let a
 * narrower device correct itself after mounting — which costs a phone three
 * things on every single load:
 *
 *   1. the grid paints seven columns and then re-lays-out to three, a layout
 *      shift of 0.18 measured on the production build at 390px — the app's
 *      largest, and the one thing on this tab that actually looks broken;
 *   2. the seven days of events the server fetched are seeded into a cache
 *      entry keyed by a window the device never displays, so they are read,
 *      serialised, shipped and dropped;
 *   3. the client then fetches its own three-day window, one round trip that
 *      the seed existed to avoid.
 *
 * A cookie is the only channel a browser has to tell a server something before
 * the server renders, so the measured count rides in one. It is a HINT, never
 * a fact: a rotated tablet or a resized window makes it wrong for exactly one
 * paint, which is what every load does today, so a stale cookie is never worse
 * than no cookie. The measurement remains the truth.
 *
 * What it carries is a small integer between three and seven. Nothing is
 * identifying, so nothing here touches constitution §VII.
 */

import { MAX_COLUMN_COUNT, MIN_COLUMN_COUNT } from "../week-geometry";

/** Read by the calendar's server render, written by the mounted grid. */
export const COLUMNS_COOKIE = "family_columns";

/**
 * A year. The value is re-asserted on every load that measures something
 * different, so the only thing the lifetime decides is whether a device that
 * has not opened the calendar in months gets one more shifted paint.
 */
const COLUMNS_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * The count a cookie is claiming, or `null` when it claims nothing usable.
 *
 * Out-of-range and non-integer values are REFUSED rather than clamped: a
 * cookie is client-supplied, and the honest reading of "14" from a device that
 * can only ever measure three to seven is that it did not come from this app.
 * The caller then falls back to the default, which is exactly what it did
 * before any of this existed.
 */
export function parseColumnCount(raw: string | undefined | null): number | null {
  if (raw === undefined || raw === null || raw.trim() === "") return null;
  const value = Number(raw);
  if (!Number.isInteger(value)) return null;
  if (value < MIN_COLUMN_COUNT || value > MAX_COLUMN_COUNT) return null;
  return value;
}

/**
 * The `document.cookie` assignment that remembers `columnCount` for this
 * device. A string rather than a write so the rule is testable without a DOM
 * and the one caller stays a one-liner.
 *
 * `SameSite=Lax` and the `/family` path keep it off every other request this
 * origin makes; there is no `Secure`, for the reason `actor.ts` states — the
 * local stack is plain HTTP and Safari drops `Secure` cookies there.
 */
export function columnCookieString(columnCount: number): string {
  const parts = [
    `${COLUMNS_COOKIE}=${columnCount}`,
    "Path=/family",
    `Max-Age=${COLUMNS_COOKIE_MAX_AGE}`,
    "SameSite=Lax",
  ];
  return parts.join("; ");
}
