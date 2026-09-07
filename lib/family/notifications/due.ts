/**
 * THE due-computation (008 R802): given the household's settings, its events
 * and an instant, which reminders are due?
 *
 * This module is the phase's centre of gravity, and it has exactly TWO
 * independent readers:
 *
 *   * the BROWSER, which draws the banner from occurrences it already holds —
 *     so the wall display needs no server, no realtime message and no delivery
 *     record to say that the swim lesson is in ten minutes;
 *   * the SERVER SCAN, which claims and sends what is due to devices that are
 *     not looking.
 *
 * Neither knows about the other, and because there is one implementation of
 * "due" they cannot disagree. Everything here is pure: no clock is read, no
 * storage is touched, and `now` always arrives as an argument.
 *
 * Occurrences arrive already expanded by `expandWindow` (Phase 2's one
 * expansion entry point, R206), so this module never touches the recurrence
 * engine and a moved or skipped occurrence is already handled before it is
 * asked about.
 */

import { localDateOf, zoneMidnightMs } from "../calendar/dates";
import type { Event, EventTimes, Occurrence, ReminderInForce } from "../types";
import { reminderKeyOf, type ReminderIdentity } from "./identity";
import { eventReminderMessage } from "./message";
import { isSilent, occurrenceReminder, reminderInForce } from "./resolve";
import type { NotificationSettings } from "./settings";
import { inWindow, isCurrent, type RunWindow } from "./window";

/** One reminder that will fire, with everything needed to show or send it. */
export interface DueReminder {
  identity: ReminderIdentity;
  title: string;
  body: string;
  /** Where acting on it lands (FR-825, R815). */
  path: string;
}

/**
 * The instant an occurrence starts.
 *
 * An ALL-DAY event has no clock time, so a lead time would have nothing to
 * count back from. It reminds from the start of its first day in the
 * household's zone, and a lead time counts back from that same moment
 * (FR-813). The reference never addresses this [UNKNOWN]; the alternative is
 * that an all-day event cannot remind at all, which is worse (Assumption 8).
 */
function startInstantOf(times: EventTimes, zone: string): number {
  return times.allDay ? zoneMidnightMs(zone, times.startDate) : Date.parse(times.startsAt);
}

/** The household-local day an occurrence is drawn on — where a tap should land. */
function renderDateOf(times: EventTimes, zone: string): string {
  return times.allDay ? times.startDate : localDateOf(zone, Date.parse(times.startsAt));
}

/**
 * The instants one reminder produces for one occurrence: none, one, or both.
 *
 * Both is a real case, not a defensive one — the household's two switches are
 * independent [VERIFIED](45795554249371), so "as it starts" AND "ten minutes
 * before" is a configuration a household can choose. The two get different
 * identities (their instants differ), so each is claimed and dismissed alone.
 */
function firingsOf(reminder: ReminderInForce, startMs: number): { fireAtMs: number; lead: number | null }[] {
  const firings: { fireAtMs: number; lead: number | null }[] = [];
  if (reminder.atTime) firings.push({ fireAtMs: startMs, lead: null });
  if (reminder.beforeMinutes !== null) {
    firings.push({ fireAtMs: startMs - reminder.beforeMinutes * 60_000, lead: reminder.beforeMinutes });
  }
  return firings;
}

/**
 * Every reminder the given occurrences would produce, at any time — the
 * moments, not the judgement about whether they have arrived. Filtering is
 * `remindersDueNow` (the banner) or `remindersInWindow` (the scan), so that
 * "what does this event ask for" and "is it time" stay separable and separately
 * testable.
 *
 * Occurrences whose event is missing from `events` are skipped rather than
 * guessed at: it means the caller fetched an occurrence without its series,
 * and inventing a household default for it would be a silent wrong answer.
 */
export function eventReminders(
  occurrences: readonly Occurrence[],
  events: readonly Event[],
  settings: NotificationSettings,
  zone: string,
): DueReminder[] {
  const byId = new Map(events.map((event) => [event.id, event]));
  const reminders: DueReminder[] = [];

  for (const occurrence of occurrences) {
    const event = byId.get(occurrence.eventId);
    if (event === undefined) continue;

    const inForce = reminderInForce(settings, occurrenceReminder(event, occurrence.occurrenceDate));
    if (isSilent(inForce)) continue;

    const startMs = startInstantOf(occurrence.times, zone);
    const path = `/family/calendar?on=${renderDateOf(occurrence.times, zone)}`;

    for (const { fireAtMs, lead } of firingsOf(inForce, startMs)) {
      const { title, body } = eventReminderMessage(occurrence.summary, lead);
      reminders.push({
        identity: {
          subjectKind: "event",
          subjectId: occurrence.eventId,
          occurrenceDate: occurrence.occurrenceDate,
          fireAtMs,
        },
        title,
        body,
        path,
      });
    }
  }

  return reminders.sort(byFiringThenKey);
}

/** Deterministic order — the instant, then the key — so renders and claims are stable. */
function byFiringThenKey(left: DueReminder, right: DueReminder): number {
  if (left.identity.fireAtMs !== right.identity.fireAtMs) {
    return left.identity.fireAtMs - right.identity.fireAtMs;
  }
  return reminderKeyOf(left.identity).localeCompare(reminderKeyOf(right.identity));
}

/**
 * What a screen should be showing right now (FR-817): arrived, and not more
 * than fifteen minutes old. The browser's filter — it has a clock and no
 * memory of a last run.
 */
export function remindersDueNow(reminders: readonly DueReminder[], nowMs: number): DueReminder[] {
  return reminders.filter((reminder) => isCurrent(reminder.identity.fireAtMs, nowMs));
}

/** What one scan should claim and send (FR-829). The server's filter. */
export function remindersInWindow(
  reminders: readonly DueReminder[],
  window: RunWindow,
): DueReminder[] {
  return reminders.filter((reminder) => inWindow(reminder.identity.fireAtMs, window));
}
