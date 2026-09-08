/**
 * Which countdowns hold the visible positions (009 FR-908, SC-903).
 *
 * The reference says active countdowns "rotate through the first position"
 * when space is limited [VERIFIED](40459070511515), and says nothing about how
 * fast, in what order, or whether it can be stopped. So what is verified is the
 * behaviour and what is ours is the shape of it (spec Assumption 6).
 *
 * Pure, and a FUNCTION OF A STEP NUMBER rather than a thing that ticks: the
 * component owns one interval and asks this module what to draw. That is what
 * makes "every active countdown reaches the first position" a property with a
 * unit test rather than something you have to watch a wall display to believe.
 *
 * Two invariants the tests pin:
 *   - when everything fits, the order NEVER changes — a bar that shuffles
 *     three countdowns nobody is scrolling past is motion for its own sake;
 *   - when it does not fit, every countdown reaches index 0 within one full
 *     cycle, so nothing is permanently hidden behind a busier week.
 */

import type { CountdownStatus } from "./target";

/** Whether the row needs to move at all — everything fitting is the common case. */
export function rotates(total: number, slots: number): boolean {
  return slots > 0 && total > slots;
}

/**
 * The `slots` countdowns visible at `step`, starting from `step % total`.
 *
 * `step` is a plain counter the caller increments; it is taken modulo the list
 * length here, so a caller that never resets it — and one whose list shrinks
 * under it — both stay in range. That is deliberate: the list changes when an
 * event is edited on another device, and an index that outran it would blank
 * the bar until the next tick.
 */
export function rotationAt(
  countdowns: readonly CountdownStatus[],
  slots: number,
  step: number,
): CountdownStatus[] {
  if (countdowns.length === 0 || slots <= 0) return [];
  if (!rotates(countdowns.length, slots)) return countdowns.slice(0, slots);

  const start = ((step % countdowns.length) + countdowns.length) % countdowns.length;
  const shown: CountdownStatus[] = [];
  for (let offset = 0; offset < slots; offset += 1) {
    shown.push(countdowns[(start + offset) % countdowns.length]);
  }
  return shown;
}
