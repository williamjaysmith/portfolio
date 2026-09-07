/**
 * 008 T017: what makes one reminder the same reminder as another (R808).
 *
 * These keys are the client-side twin of migration 036's two partial unique
 * indexes. The tests exist to keep the two in step: the browser dismisses by
 * key, the database claims by index, and a disagreement between them shows up
 * as a device dismissing one thing and being sent another.
 */

import { describe, expect, it } from "vitest";

import { reminderKeyOf, sameReminder, type ReminderIdentity } from "../../notifications/identity";

const EVENT: ReminderIdentity = {
  subjectKind: "event",
  subjectId: "event-1",
  occurrenceDate: "2026-09-09",
  fireAtMs: Date.parse("2026-09-09T16:20:00.000Z"),
};

const COMPLETION: ReminderIdentity = {
  subjectKind: "task_done",
  subjectId: "task-1",
  occurrenceDate: "2026-09-09",
  fireAtMs: Date.parse("2026-09-09T17:00:00.000Z"),
};

describe("a scheduled reminder", () => {
  it("is the same reminder as itself", () => {
    expect(sameReminder(EVENT, { ...EVENT })).toBe(true);
  });

  it("is a DIFFERENT reminder once the event moves, so the new time reminds", () => {
    const moved = { ...EVENT, fireAtMs: EVENT.fireAtMs + 60 * 60_000 };
    expect(sameReminder(EVENT, moved)).toBe(false);
  });

  it("tells the two halves of one occurrence apart", () => {
    // "As it starts" and "ten minutes before" are two reminders for one event.
    const atTime = { ...EVENT, fireAtMs: EVENT.fireAtMs + 10 * 60_000 };
    expect(sameReminder(EVENT, atTime)).toBe(false);
  });

  it("tells two occurrences of one series apart", () => {
    expect(sameReminder(EVENT, { ...EVENT, occurrenceDate: "2026-09-16" })).toBe(false);
  });

  it("tells a due chore from an event, even at the same instant", () => {
    expect(sameReminder(EVENT, { ...EVENT, subjectKind: "task_due" })).toBe(false);
  });
});

describe("a completion", () => {
  it("ignores the instant, so an un-tick and a re-tick say nothing twice", () => {
    const reTicked = { ...COMPLETION, fireAtMs: COMPLETION.fireAtMs + 60 * 60_000 };
    expect(sameReminder(COMPLETION, reTicked)).toBe(true);
  });

  it("still tells one day's occurrence from the next", () => {
    expect(sameReminder(COMPLETION, { ...COMPLETION, occurrenceDate: "2026-09-10" })).toBe(false);
  });

  it("still tells two chores apart", () => {
    expect(sameReminder(COMPLETION, { ...COMPLETION, subjectId: "task-2" })).toBe(false);
  });
});

describe("the key itself", () => {
  it("is stable across calls, which is what a dismissal set depends on", () => {
    expect(reminderKeyOf(EVENT)).toBe(reminderKeyOf({ ...EVENT }));
  });

  it("never collides across the three kinds", () => {
    const keys = (["event", "task_due", "task_done"] as const).map((subjectKind) =>
      reminderKeyOf({ ...EVENT, subjectKind }),
    );
    expect(new Set(keys).size).toBe(3);
  });
});
