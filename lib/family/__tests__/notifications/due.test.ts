/**
 * 008 T021: the due-computation (FR-812, FR-813, FR-821, R802, SC-814).
 *
 * The biggest test in the phase, because this is the one function both readers
 * call: the browser to draw a banner, the server to send a push. If it is
 * wrong, the wall and the phone are wrong together and in the same way.
 *
 * Occurrences are produced by `expandWindow` rather than written by hand, so
 * these exercise the real composition — including a moved occurrence, a
 * skipped one, and the daylight-saving boundary where a weekly series' UTC
 * instant shifts by an hour but its household-local time does not.
 */

import { describe, expect, it } from "vitest";

import { expandWindow } from "../../calendar/expand";
import {
  MAX_STALENESS_MS,
  eventReminders,
  isCurrent,
  remindersDueNow,
  type DueReminder,
} from "../../notifications/due";
import { NOTIFICATION_DEFAULTS, type NotificationSettings } from "../../notifications/settings";
import { viewWindowOf, type DateWindow } from "../../calendar/dates";
import type { Event, EventException, EventTimes } from "../../types";

const ZONE = "America/Chicago";

/** Generous windows: these tests are about reminders, not about paging. */
const SEPTEMBER: DateWindow = viewWindowOf("2026-09-01", 30, ZONE);
const NOVEMBER: DateWindow = viewWindowOf("2026-10-25", 15, ZONE);

let nextId = 0;

function event(patch: Partial<Event> & { times: EventTimes }): Event {
  nextId += 1;
  return {
    id: `event-${nextId}`,
    householdId: "household-1",
    summary: "Swim lesson",
    description: null,
    location: null,
    timezone: ZONE,
    rrule: null,
    countdownEnabled: false,
    categoryIds: [],
    reminder: { mode: "inherit" },
    exceptions: [],
    createdBy: null,
    updatedBy: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    ...patch,
  };
}

function exception(patch: Partial<EventException> & { eventId: string; occurrenceDate: string }): EventException {
  nextId += 1;
  return {
    id: `exception-${nextId}`,
    householdId: "household-1",
    action: "override",
    summary: null,
    description: null,
    location: null,
    times: null,
    reminder: null,
    createdBy: null,
    updatedBy: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    ...patch,
  };
}

/** The whole pipeline, the way both readers use it. */
function remindersFor(
  events: Event[],
  settings: NotificationSettings = NOTIFICATION_DEFAULTS,
  window: DateWindow = SEPTEMBER,
): DueReminder[] {
  return eventReminders(expandWindow(events, window, ZONE), events, settings, ZONE);
}

function firingTimes(reminders: DueReminder[]): string[] {
  return reminders.map((reminder) => new Date(reminder.identity.fireAtMs).toISOString());
}

// 2026-09-09 16:30 UTC is 11:30 in Chicago (CDT, UTC−5).
const SWIM: EventTimes = {
  allDay: false,
  startsAt: "2026-09-09T16:30:00.000Z",
  endsAt: "2026-09-09T17:30:00.000Z",
};

describe("a household's default", () => {
  it("reminds ten minutes before, and says so", () => {
    const reminders = remindersFor([event({ times: SWIM })]);
    expect(reminders).toHaveLength(1);
    expect(firingTimes(reminders)).toEqual(["2026-09-09T16:20:00.000Z"]);
    expect(reminders[0]).toMatchObject({ title: "Swim lesson", body: "in 10 minutes" });
  });

  it("gives two reminders for one event when both switches are on", () => {
    const both: NotificationSettings = { ...NOTIFICATION_DEFAULTS, eventAtTime: true };
    const reminders = remindersFor([event({ times: SWIM })], both);

    expect(firingTimes(reminders)).toEqual([
      "2026-09-09T16:20:00.000Z",
      "2026-09-09T16:30:00.000Z",
    ]);
    expect(reminders.map((entry) => entry.body)).toEqual(["in 10 minutes", "Starting now"]);
    // Two reminders, two identities — each is claimed and dismissed on its own.
    expect(reminders[0].identity.fireAtMs).not.toBe(reminders[1].identity.fireAtMs);
  });

  it("says nothing when the household asked for nothing", () => {
    const silent: NotificationSettings = {
      ...NOTIFICATION_DEFAULTS,
      eventAtTime: false,
      eventBefore: false,
    };
    expect(remindersFor([event({ times: SWIM })], silent)).toEqual([]);
  });

  it("phrases a custom lead in the words a person would use", () => {
    const twoHours: NotificationSettings = { ...NOTIFICATION_DEFAULTS, eventBeforeMinutes: 120 };
    expect(remindersFor([event({ times: SWIM })], twoHours)[0].body).toBe("in 2 hours");

    const aDay: NotificationSettings = { ...NOTIFICATION_DEFAULTS, eventBeforeMinutes: 1440 };
    expect(remindersFor([event({ times: SWIM })], aDay)[0].body).toBe("in 1 day");
  });
});

describe("an event with its own reminder", () => {
  it("keeps its own when the household's default changes", () => {
    const own = event({ times: SWIM, reminder: { mode: "custom", atTime: false, beforeMinutes: 120 } });
    const changed: NotificationSettings = { ...NOTIFICATION_DEFAULTS, eventBeforeMinutes: 30 };

    expect(firingTimes(remindersFor([own], changed))).toEqual(["2026-09-09T14:30:00.000Z"]);
  });

  it("says nothing when it chose silence, however loud the household is", () => {
    const loud: NotificationSettings = { ...NOTIFICATION_DEFAULTS, eventAtTime: true };
    expect(remindersFor([event({ times: SWIM, reminder: { mode: "none" } })], loud)).toEqual([]);
  });
});

describe("an all-day event", () => {
  it("reminds from the start of its day, in the household's zone", () => {
    const holiday = event({
      summary: "Bank holiday",
      times: { allDay: true, startDate: "2026-09-07", endDate: "2026-09-07" },
      reminder: { mode: "custom", atTime: true, beforeMinutes: null },
    });
    // Midnight on 7 September in Chicago (CDT, UTC−5) is 05:00 UTC.
    expect(firingTimes(remindersFor([holiday]))).toEqual(["2026-09-07T05:00:00.000Z"]);
  });

  it("counts a lead time back from that same midnight", () => {
    const holiday = event({
      summary: "Bank holiday",
      times: { allDay: true, startDate: "2026-09-07", endDate: "2026-09-07" },
      reminder: { mode: "custom", atTime: false, beforeMinutes: 60 },
    });
    expect(firingTimes(remindersFor([holiday]))).toEqual(["2026-09-07T04:00:00.000Z"]);
  });
});

describe("a repeating event", () => {
  const weekly = () =>
    event({
      summary: "Piano",
      times: SWIM,
      rrule: "FREQ=WEEKLY;INTERVAL=1;WKST=SU;BYDAY=WE",
    });

  it("reminds for every occurrence in the window, each with its own identity", () => {
    const reminders = remindersFor([weekly()]);
    expect(firingTimes(reminders)).toEqual([
      "2026-09-09T16:20:00.000Z",
      "2026-09-16T16:20:00.000Z",
      "2026-09-23T16:20:00.000Z",
      "2026-09-30T16:20:00.000Z",
    ]);
    expect(new Set(reminders.map((entry) => entry.identity.occurrenceDate)).size).toBe(4);
  });

  it("says nothing for a skipped occurrence", () => {
    const series = weekly();
    series.exceptions = [
      exception({ eventId: series.id, occurrenceDate: "2026-09-16", action: "skip" }),
    ];
    const dates = remindersFor([series]).map((entry) => entry.identity.occurrenceDate);
    expect(dates).not.toContain("2026-09-16");
    expect(dates).toHaveLength(3);
  });

  it("reminds at the NEW time when an occurrence is moved, and not the old one", () => {
    const series = weekly();
    series.exceptions = [
      exception({
        eventId: series.id,
        occurrenceDate: "2026-09-16",
        times: {
          allDay: false,
          startsAt: "2026-09-16T20:00:00.000Z",
          endsAt: "2026-09-16T21:00:00.000Z",
        },
      }),
    ];
    const moved = remindersFor([series]).find(
      (entry) => entry.identity.occurrenceDate === "2026-09-16",
    );
    expect(moved && firingTimes([moved])).toEqual(["2026-09-16T19:50:00.000Z"]);
  });

  it("lets one occurrence be silent while its siblings remind", () => {
    const series = weekly();
    series.exceptions = [
      exception({
        eventId: series.id,
        occurrenceDate: "2026-09-16",
        summary: "Piano (recital week)",
        reminder: { mode: "none" },
      }),
    ];
    const dates = remindersFor([series]).map((entry) => entry.identity.occurrenceDate);
    expect(dates).toEqual(["2026-09-09", "2026-09-23", "2026-09-30"]);
  });
});

describe("the household's timezone, across a daylight-saving change", () => {
  it("holds the local time steady while the UTC instant moves an hour", () => {
    // 08:00 in Chicago: CDT (UTC−5) before 1 November, CST (UTC−6) after.
    const series = event({
      summary: "School run",
      times: {
        allDay: false,
        startsAt: "2026-10-28T13:00:00.000Z",
        endsAt: "2026-10-28T13:30:00.000Z",
      },
      rrule: "FREQ=WEEKLY;INTERVAL=1;WKST=SU;BYDAY=WE",
    });

    const reminders = remindersFor([series], NOTIFICATION_DEFAULTS, NOVEMBER);
    expect(firingTimes(reminders)).toEqual([
      "2026-10-28T12:50:00.000Z", // 07:50 CDT
      "2026-11-04T13:50:00.000Z", // 07:50 CST — an hour later in UTC, the same on the wall
    ]);

    const localTimes = reminders.map((entry) =>
      new Date(entry.identity.fireAtMs).toLocaleTimeString("en-US", {
        timeZone: ZONE,
        hour: "numeric",
        minute: "2-digit",
      }),
    );
    expect(localTimes).toEqual(["7:50 AM", "7:50 AM"]);
  });
});

describe("where a reminder lands when it is acted on", () => {
  it("points at the day the occurrence is drawn on, not the day it repeats from", () => {
    const series = event({
      times: SWIM,
      rrule: "FREQ=WEEKLY;INTERVAL=1;WKST=SU;BYDAY=WE",
    });
    const paths = new Set(remindersFor([series]).map((entry) => entry.path));
    expect(paths).toEqual(
      new Set([
        "/family/calendar?on=2026-09-09",
        "/family/calendar?on=2026-09-16",
        "/family/calendar?on=2026-09-23",
        "/family/calendar?on=2026-09-30",
      ]),
    );
  });
});

describe("filtering by the clock", () => {
  const reminders = remindersFor([event({ times: SWIM })]);
  const fireAt = Date.parse("2026-09-09T16:20:00.000Z");

  it("shows nothing before the moment arrives", () => {
    expect(remindersDueNow(reminders, fireAt - 60_000)).toEqual([]);
  });

  it("shows it at the moment, and fourteen minutes later", () => {
    expect(remindersDueNow(reminders, fireAt)).toHaveLength(1);
    expect(remindersDueNow(reminders, fireAt + 14 * 60_000)).toHaveLength(1);
  });

  it("stops showing it once it is more than fifteen minutes old", () => {
    expect(remindersDueNow(reminders, fireAt + 16 * 60_000)).toEqual([]);
  });

  it("shows nothing at all to a tablet that was asleep all morning", () => {
    const morning = [1, 2, 3].map((hours) => fireAt + hours * 60 * 60_000);
    expect(morning.flatMap((now) => remindersDueNow(reminders, now))).toEqual([]);
  });
});

describe("isCurrent", () => {
  const fireAt = Date.parse("2026-09-09T16:20:00.000Z");

  it("does not show a moment that has not arrived", () => {
    expect(isCurrent(fireAt, fireAt - 1)).toBe(false);
  });

  it("stops exactly at fifteen minutes", () => {
    expect(isCurrent(fireAt, fireAt + MAX_STALENESS_MS)).toBe(true);
    expect(isCurrent(fireAt, fireAt + MAX_STALENESS_MS + 1)).toBe(false);
  });
});

describe("an occurrence whose series is missing", () => {
  it("is skipped rather than guessed at", () => {
    const series = event({ times: SWIM });
    const occurrences = expandWindow([series], SEPTEMBER, ZONE);
    expect(eventReminders(occurrences, [], NOTIFICATION_DEFAULTS, ZONE)).toEqual([]);
  });
});
