/**
 * The household's five reminder choices, narrowed away from the rest of its
 * settings (008 FR-802..FR-807).
 *
 * Why a projection and not just passing `HouseholdSettings` around: the
 * due-computation is the piece of this phase that most needs to be easy to
 * test exhaustively, and a function that takes five booleans is easier to
 * cover than one that takes a row with a timezone, a text size and a density
 * it never reads.
 *
 * These choices are HOUSEHOLD-WIDE and never per person. Every documented
 * Skylight reminder is an unaddressed pop-up on a shared display
 * [VERIFIED](36836043247131); the reference has no per-person routing at all;
 * and this project knows who somebody is only while they are punched in
 * (spec Assumption 2).
 */

import type { HouseholdSettings } from "../types";

export interface NotificationSettings {
  /** A calendar reminder as the event begins. */
  eventAtTime: boolean;
  /** A calendar reminder ahead of the event. */
  eventBefore: boolean;
  /** How far ahead, ALWAYS in minutes (R810). Meaningful only while `eventBefore`. */
  eventBeforeMinutes: number;
  /** A reminder when a chore that carries a TIME falls due (FR-818). */
  taskDue: boolean;
  /** An announcement of who finished what (FR-819). */
  taskCompleted: boolean;
}

/**
 * Seven days, in minutes — the ceiling on any lead time.
 *
 * The reference documents no ceiling at all: one rendering of the control is a
 * free 1–120 minute field [VERIFIED](36836043247131) and another is presets
 * plus a minutes/hours/days picker [VERIFIED](45795554249371), and the dossier
 * declines to reconcile them. Beyond a week a "reminder" is a different
 * feature, so this project drew the line here (spec Assumption 5). Migration
 * 034 carries the same number as a CHECK.
 */
export const MAX_LEAD_MINUTES = 10_080;

/**
 * What a household that has never opened Settings gets (FR-807).
 *
 * No fetched source documents a factory default for any of the four
 * [UNKNOWN]. These are ours (spec Assumption 6), chosen so that a household
 * is reminded of its events without configuring anything and is not told
 * about every completed chore. Migration 034 is the authority; this constant
 * exists so a test can say so, and so a client render before the first read
 * shows the same thing the database would.
 */
export const NOTIFICATION_DEFAULTS: NotificationSettings = {
  eventAtTime: false,
  eventBefore: true,
  eventBeforeMinutes: 10,
  taskDue: true,
  taskCompleted: false,
};

export function notificationSettingsOf(settings: HouseholdSettings): NotificationSettings {
  return {
    eventAtTime: settings.notifyEventAtTime,
    eventBefore: settings.notifyEventBefore,
    eventBeforeMinutes: settings.notifyEventBeforeMinutes,
    taskDue: settings.notifyTaskDue,
    taskCompleted: settings.notifyTaskCompleted,
  };
}
