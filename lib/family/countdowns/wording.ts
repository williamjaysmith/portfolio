/**
 * What a countdown SAYS (009 spec Assumption 3, FR-902, FR-906).
 *
 * The reference's literal chip text is `[UNKNOWN]` in every fetched source —
 * the dossier is explicit that "Vacation 48 days" appears verbatim nowhere,
 * and that "48 days" against "in 48 days" against a numeral badge is not
 * known. So this is ours, and it is in ONE module because the bar's chip, the
 * full list and the event's own details all say it and must agree: three
 * places wording the same number is how a household ends up reading "2 days"
 * on the wall and "in 2 days" in a popup.
 *
 * The wording is chosen for the wall display's actual reader — a child, at a
 * distance, who cannot yet read a date. Hence the number first and the shortest
 * true phrase: "13 days", not "in 13 days' time".
 */

import type { CountdownState } from "./days";

/**
 * The number of days as a phrase: "13 days", "1 day", "Today", "Passed".
 *
 * `Today` is a word and not a zero because counting down to zero and then into
 * negatives reads worse than either (Assumption 5). `Passed` is only ever seen
 * in an event's own details — FR-905 takes a past countdown off the bar the day
 * after — because an event that WAS a countdown did not stop having been one.
 */
export function countdownPhrase(state: CountdownState, days: number): string {
  if (state === "today") return "Today";
  if (state === "past") return "Passed";
  return days === 1 ? "1 day" : `${days} days`;
}

/**
 * The bar's chip and the full list's row: the event's name, then how far away.
 * The name is first because on a bar of several the household is looking for
 * WHICH one before it looks at the number.
 */
export function countdownChipLabel(summary: string, phrase: string): string {
  return `${summary} · ${phrase}`;
}

/** The line under an event's own title (FR-906). The title is already above it. */
export function countdownDetailLabel(phrase: string): string {
  return `Countdown · ${phrase}`;
}
