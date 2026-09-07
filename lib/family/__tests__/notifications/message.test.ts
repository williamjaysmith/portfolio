/**
 * 008 T023/T025: the words a reminder says (FR-814, FR-818, FR-819), and the
 * household's defaults (FR-807).
 *
 * The completion's shape is checked against the reference's own documented
 * example — a real push banner reading "Olivia dried the dinner dishes"
 * [VERIFIED](54930439904923). It is the one notification anywhere in Skylight
 * that names a person, and the spec's own acceptance scenario asks for "Cleo
 * finished Practice piano".
 */

import { describe, expect, it } from "vitest";

import {
  eventReminderMessage,
  leadPhrase,
  taskDoneMessage,
  taskDueMessage,
} from "../../notifications/message";
import {
  MAX_LEAD_MINUTES,
  NOTIFICATION_DEFAULTS,
  notificationSettingsOf,
} from "../../notifications/settings";
import type { HouseholdSettings } from "../../types";

describe("leadPhrase", () => {
  it("keeps the three presets in the words they are offered in", () => {
    expect(leadPhrase(10)).toBe("10 minutes");
    expect(leadPhrase(30)).toBe("30 minutes");
    expect(leadPhrase(60)).toBe("1 hour");
  });

  it("turns stored minutes back into the unit a person chose", () => {
    expect(leadPhrase(120)).toBe("2 hours");
    expect(leadPhrase(1440)).toBe("1 day");
    expect(leadPhrase(MAX_LEAD_MINUTES)).toBe("7 days");
  });

  it("leaves an awkward custom value in minutes rather than inventing a compound", () => {
    expect(leadPhrase(90)).toBe("90 minutes");
    expect(leadPhrase(1)).toBe("1 minute");
  });
});

describe("eventReminderMessage", () => {
  it("says the event is starting when it fires at the event's own time", () => {
    expect(eventReminderMessage("Swim lesson", null)).toEqual({
      title: "Swim lesson",
      body: "Starting now",
    });
  });

  it("says how long there is when it fires ahead", () => {
    expect(eventReminderMessage("Swim lesson", 10)).toEqual({
      title: "Swim lesson",
      body: "in 10 minutes",
    });
  });
});

describe("taskDueMessage", () => {
  it("names whose chore it is", () => {
    expect(taskDueMessage("Practice piano", "Cleo")).toEqual({
      title: "Practice piano",
      body: "Cleo — due now",
    });
  });

  it("names nobody for an up-for-grabs chore, rather than inventing an owner", () => {
    expect(taskDueMessage("Sort the recycling", null)).toEqual({
      title: "Sort the recycling",
      body: "Due now",
    });
  });
});

describe("taskDoneMessage", () => {
  it("reads as the reference's own banner does — the person, the verb, the thing", () => {
    expect(taskDoneMessage("Practice piano", "Cleo").title).toBe("Cleo finished Practice piano");
  });
});

describe("the household's five choices", () => {
  it("defaults a fresh household to FR-807's values", () => {
    expect(NOTIFICATION_DEFAULTS).toEqual({
      eventAtTime: false,
      eventBefore: true,
      eventBeforeMinutes: 10,
      taskDue: true,
      taskCompleted: false,
    });
  });

  it("caps a lead time at seven days, the same number migration 034 carries", () => {
    expect(MAX_LEAD_MINUTES).toBe(7 * 24 * 60);
  });

  it("narrows a settings row to the five, and reads nothing else from it", () => {
    const settings = {
      householdId: "household-1",
      showNameNotDate: true,
      timeFormat: "12h",
      startWeekOn: 0,
      punchOutMinutes: 3,
      textSize: "medium",
      density: "roomy",
      timezone: "America/Chicago",
      notifyEventAtTime: true,
      notifyEventBefore: false,
      notifyEventBeforeMinutes: 45,
      notifyTaskDue: false,
      notifyTaskCompleted: true,
      updatedAt: "2026-01-01T00:00:00.000Z",
    } satisfies HouseholdSettings;

    expect(notificationSettingsOf(settings)).toEqual({
      eventAtTime: true,
      eventBefore: false,
      eventBeforeMinutes: 45,
      taskDue: false,
      taskCompleted: true,
    });
  });
});
