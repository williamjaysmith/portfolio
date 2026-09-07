/**
 * THE due-computation (008 R802): given the household's settings, its events
 * and an instant, which reminders are due?
 *
 * This module is the phase's centre of gravity. It has one reader — the
 * browser, drawing a banner on a page somebody has open — and that is the whole
 * of the delivery surface: nothing reaches a device with no page open, by
 * design (spec Assumption 15).
 *
 * It was written for two readers, the browser and a server scan that pushed to
 * phones. The scan is gone, but the shape it forced is worth keeping:
 * everything here is pure, no clock is read, no storage is touched, and `now`
 * always arrives as an argument. That is what makes the whole engine testable.
 *
 * Occurrences arrive already expanded by `expandWindow` (Phase 2's one
 * expansion entry point, R206), so this module never touches the recurrence
 * engine and a moved or skipped occurrence is already handled before it is
 * asked about.
 */

import { localDateOf, zoneMidnightMs } from "../calendar/dates";
import type {
  BoardOccurrence,
  Event,
  EventTimes,
  Occurrence,
  ReminderInForce,
} from "../types";
import { reminderKeyOf, type ReminderIdentity } from "./identity";
import { eventReminderMessage, taskDueMessage } from "./message";
import { isSilent, occurrenceReminder, reminderInForce } from "./resolve";
import type { NotificationSettings } from "./settings";

/**
 * How stale a reminder may be and still be worth putting on a screen.
 *
 * The reference says nothing about a device that was asleep [UNKNOWN]. A wall
 * tablet that wakes at nine and shows a pile of banners for seven o'clock is a
 * failure, not a feature, so anything more than fifteen minutes past is dropped
 * (spec Assumption 10).
 */
export const MAX_STALENESS_MS = 15 * 60 * 1000;

/**
 * Whether a reminder's moment has arrived and has not gone stale.
 *
 * This lived in a `window.ts` alongside the server scan's run-window
 * arithmetic. With no scan there is no window — a browser has a clock and no
 * memory of a last run — so the one surviving rule sits with its only caller.
 */
export function isCurrent(fireAtMs: number, nowMs: number): boolean {
  return fireAtMs <= nowMs && nowMs - fireAtMs <= MAX_STALENESS_MS;
}

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


/**
 * A chore falling due (008 FR-818, R812).
 *
 * The predicate is one line and needs no new data: a chore that carries a TIME,
 * and nothing else. `family.tasks.due_time` is already a wall clock in the
 * household's zone, null on an anytime chore, and a routine carries
 * `times_of_day` slots instead of a due time — so `routine === false` with a
 * `dueAt` says exactly what the reference says, which is that a notification
 * "will only appear for those chores that are due at a specific time"
 * [VERIFIED](36836043247131).
 *
 * A chore that is already resolved says nothing: it has been done or skipped,
 * and reminding about it would be wrong in both directions.
 *
 * "A late chore reminds once, not once a day" (FR-818) needs no special case at
 * all. `dueAt` is the occurrence's OWN due instant, not the day it is drawn on,
 * so a chore carried forward from yesterday has a `fireAtMs` a day old and the
 * staleness rule drops it. The behaviour falls out of the identity rather than
 * being coded.
 */
export function taskReminders(
  occurrences: readonly BoardOccurrence[],
  settings: NotificationSettings,
  nameOf: (categoryId: string | null) => string | null,
): DueReminder[] {
  if (!settings.taskDue) return [];

  const reminders: DueReminder[] = [];
  for (const occurrence of occurrences) {
    if (occurrence.routine || occurrence.dueAt === null) continue;
    if (occurrence.state !== "unresolved") continue;

    const { title, body } = taskDueMessage(occurrence.summary, nameOf(occurrence.assigneeId));
    reminders.push({
      identity: {
        subjectKind: "task_due",
        subjectId: occurrence.taskId,
        occurrenceDate: occurrence.scheduledDate,
        fireAtMs: Date.parse(occurrence.dueAt),
      },
      title,
      body,
      path: "/family/tasks",
    });
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

/** What a screen should be showing right now (FR-817). */
export function remindersDueNow(reminders: readonly DueReminder[], nowMs: number): DueReminder[] {
  return reminders.filter((reminder) => isCurrent(reminder.identity.fireAtMs, nowMs));
}
