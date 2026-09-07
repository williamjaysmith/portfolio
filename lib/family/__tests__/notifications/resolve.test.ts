/**
 * 008 T015: the household's default and one event's override, resolved into
 * the reminder actually in force (FR-808, FR-809, R809).
 *
 * The two-level model is the reference's own [VERIFIED](32083277890075): a
 * calendar-wide default, and a per-event reminder that overrides it. What the
 * sources do NOT say is whether "deliberately silent" is expressible, so this
 * project gives it a name — `none` — and these tests pin the difference
 * between silence and inheritance, which is the whole reason the mode column
 * exists (spec Assumption 4).
 */

import { describe, expect, it } from "vitest";

import {
  householdReminder,
  isSilent,
  occurrenceReminder,
  reminderInForce,
} from "../../notifications/resolve";
import type { NotificationSettings } from "../../notifications/settings";
import type { Event, EventException } from "../../types";

const REMINDS_BEFORE: NotificationSettings = {
  eventAtTime: false,
  eventBefore: true,
  eventBeforeMinutes: 10,
  taskDue: true,
  taskCompleted: false,
};

const SILENT_HOUSEHOLD: NotificationSettings = {
  ...REMINDS_BEFORE,
  eventAtTime: false,
  eventBefore: false,
};

function exception(patch: Partial<EventException>): EventException {
  return {
    id: "exception-1",
    eventId: "event-1",
    householdId: "household-1",
    occurrenceDate: "2026-09-16",
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

function series(patch: Partial<Event> = {}): Event {
  return {
    id: "event-1",
    householdId: "household-1",
    summary: "Piano",
    description: null,
    location: null,
    times: { allDay: false, startsAt: "2026-09-09T21:30:00.000Z", endsAt: "2026-09-09T22:15:00.000Z" },
    timezone: "America/Chicago",
    rrule: "FREQ=WEEKLY;INTERVAL=1;WKST=SU;BYDAY=WE",
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

describe("householdReminder", () => {
  it("reads the two independent switches as one reminder", () => {
    expect(householdReminder(REMINDS_BEFORE)).toEqual({ atTime: false, beforeMinutes: 10 });
  });

  it("lets a household have both, which is what two independent toggles mean", () => {
    expect(householdReminder({ ...REMINDS_BEFORE, eventAtTime: true })).toEqual({
      atTime: true,
      beforeMinutes: 10,
    });
  });

  it("is silent when both are off, and keeps the minutes it would use", () => {
    expect(householdReminder(SILENT_HOUSEHOLD)).toEqual({ atTime: false, beforeMinutes: null });
  });
});

describe("reminderInForce", () => {
  it("follows the household when the event inherits", () => {
    expect(reminderInForce(REMINDS_BEFORE, { mode: "inherit" })).toEqual({
      atTime: false,
      beforeMinutes: 10,
    });
  });

  it("says nothing when the event chose silence, however loud the household is", () => {
    const loud: NotificationSettings = { ...REMINDS_BEFORE, eventAtTime: true };
    expect(reminderInForce(loud, { mode: "none" })).toEqual({ atTime: false, beforeMinutes: null });
    expect(isSilent(reminderInForce(loud, { mode: "none" }))).toBe(true);
  });

  it("uses the event's own choice, and does not blend it with the household's", () => {
    const both: NotificationSettings = { ...REMINDS_BEFORE, eventAtTime: true };
    expect(reminderInForce(both, { mode: "custom", atTime: false, beforeMinutes: 120 })).toEqual({
      atTime: false,
      beforeMinutes: 120,
    });
  });

  it("lets an event ask for both halves of its own", () => {
    expect(
      reminderInForce(SILENT_HOUSEHOLD, { mode: "custom", atTime: true, beforeMinutes: 30 }),
    ).toEqual({ atTime: true, beforeMinutes: 30 });
  });

  it("moves an inheriting event when the household changes, and leaves an overridden one", () => {
    const before = reminderInForce(REMINDS_BEFORE, { mode: "inherit" });
    const own = reminderInForce(REMINDS_BEFORE, { mode: "custom", atTime: false, beforeMinutes: 120 });

    const changed: NotificationSettings = { ...REMINDS_BEFORE, eventBeforeMinutes: 30 };

    expect(reminderInForce(changed, { mode: "inherit" })).not.toEqual(before);
    expect(reminderInForce(changed, { mode: "inherit" })).toEqual({ atTime: false, beforeMinutes: 30 });
    expect(reminderInForce(changed, { mode: "custom", atTime: false, beforeMinutes: 120 })).toEqual(own);
  });

  it("treats silence and inheritance as different things", () => {
    expect(reminderInForce(REMINDS_BEFORE, { mode: "none" })).not.toEqual(
      reminderInForce(REMINDS_BEFORE, { mode: "inherit" }),
    );
  });
});

describe("occurrenceReminder", () => {
  it("takes the series' own when the occurrence has no exception", () => {
    const event = series({ reminder: { mode: "custom", atTime: true, beforeMinutes: null } });
    expect(occurrenceReminder(event, "2026-09-09")).toEqual({
      mode: "custom",
      atTime: true,
      beforeMinutes: null,
    });
  });

  it("lets one occurrence override its series", () => {
    const event = series({
      reminder: { mode: "custom", atTime: true, beforeMinutes: null },
      exceptions: [exception({ reminder: { mode: "none" } })],
    });
    expect(occurrenceReminder(event, "2026-09-16")).toEqual({ mode: "none" });
    // …and leaves every other occurrence alone.
    expect(occurrenceReminder(event, "2026-09-09")).toEqual({
      mode: "custom",
      atTime: true,
      beforeMinutes: null,
    });
  });

  it("inherits from the series when the exception's reminder is null", () => {
    const event = series({
      reminder: { mode: "custom", atTime: false, beforeMinutes: 45 },
      exceptions: [exception({ summary: "Moved", reminder: null })],
    });
    expect(occurrenceReminder(event, "2026-09-16")).toEqual({
      mode: "custom",
      atTime: false,
      beforeMinutes: 45,
    });
  });
});
