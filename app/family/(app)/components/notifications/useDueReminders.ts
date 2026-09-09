"use client";

import { expandWindow } from "@/lib/family/calendar/expand";
import { diffDays, localDateOf, viewWindowOf } from "@/lib/family/calendar/dates";
import { completionNotices } from "@/lib/family/notifications/completions";
import {
  eventReminders,
  remindersDueNow,
  taskReminders,
  type DueReminder,
} from "@/lib/family/notifications/due";
import { notificationSettingsOf } from "@/lib/family/notifications/settings";
import { reminderKeyOf } from "@/lib/family/notifications/identity";
import {
  reminderHorizonOf,
  useReminderHorizon,
  useTaskResolutions,
  useTasks,
} from "@/lib/family/queries";
import { expandTaskDay } from "@/lib/family/tasks/expand";
import { weekStartOf } from "@/lib/family/calendar/dates";

import { useNow } from "../Clock";
import { useAfterLoad } from "./useAfterLoad";
import { createDeviceKeySet } from "../useDeviceKeySet";
import { useFamily } from "../FamilyProvider";
import type {
  Category,
  Event,
  HouseholdSettings,
  Task,
  TaskResolution,
} from "@/lib/family/types";

/**
 * What this screen should be showing right now (008 FR-814–FR-817).
 *
 * Three things meet here and nothing else happens: the shell's minute clock
 * (`useNow`, Phase 1), the banner's own horizon read, and the pure
 * due-computation. Everything difficult is in `lib/family/notifications/**` and
 * is unit-tested there; this hook is the wiring.
 *
 * **"Shown once" is a per-device convention, not a guarantee.** The keys live in
 * this browser's storage, and there are two places that gives way, both of which
 * the specification states rather than hides:
 *
 *   - clearing site data, a private window or a second browser profile can
 *     re-show a reminder that is still inside its fifteen-minute window;
 *   - two tabs each draw their own banner, and dismissing one does not dismiss
 *     the other — a banner is a thing on a screen, not a state in the household.
 *
 * Both were a database unique index while this phase had Web Push in it. Losing
 * that is the honest cost of the household deciding it did not want push.
 */

/** Keys of reminders this device has already put on screen. */
const shown = createDeviceKeySet("family:reminders-shown:v1");

export interface DueRemindersState {
  /** Everything due now that this device has not already shown. */
  reminders: DueReminder[];
  /**
   * A stable identity for THIS set of reminders, so a caller can tell a new
   * banner from a re-render of the same one — which is what the chime needs,
   * and what a `reminders.length` check would get wrong when one reminder
   * replaces another in the same minute.
   */
  key: string;
  /** Marks them shown, so they do not come back on the next minute's tick. */
  dismiss: () => void;
}

/** Everything the three sources need, gathered once so the hook stays readable. */
interface Ingredients {
  nowMs: number;
  today: string;
  settings: HouseholdSettings;
  events: readonly Event[];
  tasks: readonly Task[];
  resolutions: readonly TaskResolution[];
  categories: readonly Category[];
  actorId: string | null;
}

/**
 * The three sources, combined. Pure, and outside the hook on purpose: this is
 * the part with the branches, and keeping it here means the hook itself reads
 * as the list of things it subscribes to.
 */
function gather(input: Ingredients): DueReminder[] {
  const { settings, nowMs, today } = input;
  const notifications = notificationSettingsOf(settings);
  const nameOf = (id: string | null) =>
    input.categories.find((category) => category.id === id)?.label ?? null;

  const bounds = reminderHorizonOf(settings.timezone, nowMs);
  const days = diffDays(bounds.startDate, bounds.endDate) + 1;
  const window = viewWindowOf(bounds.startDate, days, settings.timezone);
  const occurrences = expandWindow(input.events, window, settings.timezone);

  const board = expandTaskDay(input.tasks, input.resolutions, [], {
    displayedDate: today,
    todayDate: today,
    zone: settings.timezone,
  });

  return [
    ...eventReminders(occurrences, input.events, notifications, settings.timezone),
    ...taskReminders(board, notifications, nameOf),
    ...completionNotices(input.resolutions, summaryOf(input.tasks), notifications, {
      nameOf,
      actorId: input.actorId,
    }),
  ];
}

const NOTHING: DueRemindersState = { reminders: [], key: "", dismiss: () => {} };


/**
 * The two task reads the banner needs, and the two conditions under which it
 * needs them (012).
 *
 * **The setting.** Only `notifyTaskDue` and `notifyTaskCompleted` can produce a
 * task reminder (008 FR-818, FR-819). With both off there is nothing these
 * reads could feed — and this hook runs in the SHELL, so without the gate they
 * were two queries on every page of every tab for a feature the household had
 * switched off.
 *
 * **The clock.** The resolutions read is keyed by the week containing today, so
 * before the browser publishes a clock there is no week to ask for. The
 * placeholder that stood here was not inert: it FETCHED, every load of every
 * tab, the resolutions of the week of 1 January 1970 — a round trip that can
 * only ever return the undated rows, thrown away a tick later when the real
 * week arrived. Waiting is also what the horizon read beside it already does,
 * and for the same stated reason: nothing here can be computed before the
 * clock, so nothing here should compete with hydration.
 *
 * Extracted rather than inlined because adding the conditions put
 * `useDueReminders` over its cognitive budget, and the gate is its own idea.
 */
function useTaskReads(
  householdId: string,
  settings: HouseholdSettings,
  today: string | null,
) {
  const wanted = (settings.notifyTaskDue || settings.notifyTaskCompleted) && today !== null;
  const weekStart = today === null ? UNASKED_WEEK : weekStartOf(today, settings.startWeekOn);
  return {
    tasks: useTasks(householdId, undefined, wanted),
    resolutions: useTaskResolutions(householdId, weekStart, undefined, wanted),
  };
}

/**
 * The cache key the resolutions read carries while it is disabled. It is never
 * fetched — `wanted` is false for exactly as long as it is in use — and exists
 * only because a query key is not optional.
 */
const UNASKED_WEEK = "1970-01-01";

export function useDueReminders(): DueRemindersState {
  const { household, settings, categories, actor } = useFamily();
  const now = useNow();
  // The banner's own read waits for `load`. It reads the whole reminder horizon
  // from the app shell, so without this it competes with hydration on every
  // route — and a banner about something ten minutes away is never worth that.
  const loaded = useAfterLoad();
  const nowMs = !loaded || now === null ? null : now.getTime();
  const today = nowMs === null ? null : localDateOf(settings.timezone, nowMs);

  const horizon = useReminderHorizon(household.id, settings.timezone, nowMs);
  // The board's task reads, reused rather than duplicated: both are already
  // household-wide and keyed by household alone (Phase 3 R314), so the banner
  // shares the cache entry the Tasks tab fills and adds no read of its own.
  const { tasks, resolutions } = useTaskReads(household.id, settings, today);
  const { keys } = shown.useKeys();

  // Nothing to draw until the browser has a clock and the horizon has answered.
  if (nowMs === null || today === null || horizon.data === undefined) return NOTHING;

  const all = gather({
    nowMs,
    today,
    settings,
    events: horizon.data,
    tasks: tasks.data ?? [],
    resolutions: resolutions.data ?? [],
    categories,
    actorId: actor?.profileId ?? null,
  });

  const reminders = remindersDueNow(all, nowMs).filter(
    (reminder) => !keys.has(reminderKeyOf(reminder.identity)),
  );

  return {
    reminders,
    key: reminders.map((reminder) => reminderKeyOf(reminder.identity)).join("|"),
    dismiss: () => {
      for (const reminder of reminders) shown.add(reminderKeyOf(reminder.identity));
    },
  };
}

/** A task's summary by id — what a completion notice needs and a resolution lacks. */
function summaryOf(tasks: readonly Task[]) {
  return (taskId: string) => tasks.find((task) => task.id === taskId)?.summary ?? null;
}

/** Test seam. */
export function resetShownReminders(): void {
  shown.reset();
}
