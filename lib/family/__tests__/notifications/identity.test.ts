/**
 * 008 T017: what makes one reminder the same reminder as another (R808).
 *
 * With no server and no delivery table, this key is the only definition of
 * "the same reminder" the feature has. It carries FR-816 (a dismissed banner
 * does not come back) and FR-819's "not for an un-ticking" on its own, so
 * these tests are load-bearing rather than incidental.
 */

import { describe, expect, it } from "vitest";

import { reminderKeyOf, type ReminderIdentity } from "../../notifications/identity";

/** The banner compares keys, so the tests do too. */
const same = (a: ReminderIdentity, b: ReminderIdentity) => reminderKeyOf(a) === reminderKeyOf(b);

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
    expect(same(EVENT, { ...EVENT })).toBe(true);
  });

  it("is a DIFFERENT reminder once the event moves, so the new time reminds", () => {
    const moved = { ...EVENT, fireAtMs: EVENT.fireAtMs + 60 * 60_000 };
    expect(same(EVENT, moved)).toBe(false);
  });

  it("tells the two halves of one occurrence apart", () => {
    // "As it starts" and "ten minutes before" are two reminders for one event.
    const atTime = { ...EVENT, fireAtMs: EVENT.fireAtMs + 10 * 60_000 };
    expect(same(EVENT, atTime)).toBe(false);
  });

  it("tells two occurrences of one series apart", () => {
    expect(same(EVENT, { ...EVENT, occurrenceDate: "2026-09-16" })).toBe(false);
  });

  it("tells a due chore from an event, even at the same instant", () => {
    expect(same(EVENT, { ...EVENT, subjectKind: "task_due" })).toBe(false);
  });
});

describe("a completion", () => {
  it("ignores the instant, so an un-tick and a re-tick say nothing twice", () => {
    const reTicked = { ...COMPLETION, fireAtMs: COMPLETION.fireAtMs + 60 * 60_000 };
    expect(same(COMPLETION, reTicked)).toBe(true);
  });

  it("still tells one day's occurrence from the next", () => {
    expect(same(COMPLETION, { ...COMPLETION, occurrenceDate: "2026-09-10" })).toBe(false);
  });

  it("still tells two chores apart", () => {
    expect(same(COMPLETION, { ...COMPLETION, subjectId: "task-2" })).toBe(false);
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
