/**
 * The three verdicts behind this phase's celebrations, and nothing else
 * decides when one plays (004 R408): the whole-list emoji rain (FR-439), the
 * Amazing / Strong Week message (FR-440) and the redemption modal's copy
 * (FR-432, FR-433).
 *
 * Every one is pure so that "once, on this device, never on a skip, never
 * under reduced motion" is a unit test rather than a screen recording. The
 * components are mounted by the board or the tab IN RESPONSE TO THE LOCAL
 * WRITE'S SUCCESS, never to a realtime refetch — another device's change
 * arrives as data, and data never mounts a celebration (Assumption 12).
 *
 * `listCompletesWith` is judged from the counters AS THEY STOOD BEFORE THE
 * WRITE, so it cannot race the refetch that repaints the board; the verb rule
 * — a skip never asks — is the caller's (T048), because a skip is not a
 * completion and the question is only ever put for one.
 *
 * Framework-free and pure: no React, no storage, no clock — the household day
 * shown for a redemption is the one the database stored (FR-433).
 */

import type { TaskCounters } from "../tasks/counters";
import type { BoardOccurrence, Redemption } from "../types";

/** One routine's week for one Profile, as household-local `YYYY-MM-DD` days. */
export interface WeekOutcome {
  /** The days the routine was scheduled that week — the denominator (FR-440). */
  scheduledDays: readonly string[];
  /** The scheduled days every occurrence of which was completed. */
  completedDays: readonly string[];
  /** The scheduled days with a skip on them — neither completed nor missed. */
  skippedDays: readonly string[];
}

/** FR-440's two tiers, or nothing. */
export type WeekVerdict = "amazing" | "strong" | null;

/** The redemption modal's two lines (FR-432); the emoji is the reward's own. */
export interface RedemptionCelebration {
  /** "Great work! <Reward> redeemed" */
  title: string;
  /** "By <Profile> for N stars on <Month D, YYYY>" */
  subtitle: string;
}

/** A routine scheduled fewer times than this can never earn Strong (FR-440). */
const STRONG_WEEK_MIN_SCHEDULED = 3;

/** A plain household-local date in words, formatted in UTC so it cannot slide across midnight. */
const LONG_DATE = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "long",
  day: "numeric",
  year: "numeric",
});

/**
 * FR-439: does completing THIS occurrence finish its Profile's list for the
 * displayed day? `counters` are `columnCountersOf` over the UNFILTERED list
 * (R317), so a card a filter hides still counts, and a skipped one already
 * does not (FR-360). `inFlightLocal` is the number of this device's own
 * completions for that Profile still queued or writing, so two quick taps on
 * the last two outstanding cards fire once, on the second (SC-414).
 *
 * False for anything but an outstanding occurrence in a Profile's column: an
 * already-complete one (an undo), a skipped one (an un-skip), an unclaimed
 * Up for Grabs one (nobody's list, FR-368).
 */
export function listCompletesWith(
  counters: TaskCounters,
  occurrence: BoardOccurrence,
  inFlightLocal = 0,
): boolean {
  if (occurrence.state !== "unresolved" || occurrence.assigneeId === null) return false;
  return counters.total - counters.complete - inFlightLocal === 1;
}

/**
 * FR-440 verbatim, with SC-415's reading of a skip: a scheduled day is
 * completed, skipped or missed; a skipped day is NEITHER completed nor missed.
 * Amazing needs every non-skipped day completed and at least one completed;
 * Strong needs exactly one missed day of a routine scheduled at least three
 * times that week — so a routine scheduled twice never earns it. A day that is
 * both completed and skipped (a two-slot routine with one slot skipped) reads
 * as skipped, as the streak rule reads it (FR-373).
 */
export function weekVerdictOf(outcome: WeekOutcome): WeekVerdict {
  const completed = new Set(outcome.completedDays);
  const skipped = new Set(outcome.skippedDays);
  const scheduled = [...new Set(outcome.scheduledDays)];
  const counted = scheduled.filter((day) => !skipped.has(day));
  const missed = counted.filter((day) => !completed.has(day)).length;

  if (missed === 0) return counted.length > 0 ? "amazing" : null;
  if (missed === 1 && scheduled.length >= STRONG_WEEK_MIN_SCHEDULED) return "strong";
  return null;
}

/** The per-device "shown once" key: one per routine, Profile and household week (FR-440). */
export function weekCelebrationKey(routineId: string, profileId: string, weekStart: string): string {
  return `${routineId}:${profileId}:${weekStart}`;
}

/**
 * FR-432's two lines from the returned row. The Profile named is the one
 * redeemed FOR, not the actor (a parent may redeem on a child's behalf,
 * FR-424); the cost is the stored one (FR-428); the day is `redeemedOn`, the
 * household's day of the redemption as the trigger wrote it (FR-433) — a
 * plain date, so it is put into words without a zone.
 */
export function redemptionCelebration(
  redemption: Redemption,
  profileName: string,
): RedemptionCelebration {
  const stars = redemption.pointValue === 1 ? "1 star" : `${redemption.pointValue} stars`;
  const day = LONG_DATE.format(new Date(`${redemption.redeemedOn}T00:00:00Z`));
  return {
    title: `Great work! ${redemption.rewardName} redeemed`,
    subtitle: `By ${profileName} for ${stars} on ${day}`,
  };
}
