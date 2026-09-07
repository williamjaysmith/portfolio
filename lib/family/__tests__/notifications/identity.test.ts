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
  // A completion names its RESOLUTION row, not its task.
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
  it("is the resolution row itself, so nothing else about it can collide", () => {
    // Keyed on (task, date) this used to be right; it is not any more. A routine
    // can be completed in two slots on one day and an Anytime chore has no date
    // at all, so the pair swallowed one announcement and lost the other. The row
    // id is unique by construction, which is what a browser's Set needs.
    expect(reminderKeyOf(COMPLETION)).toBe("task_done:task-1");
  });

  it("ignores the instant, so a re-render of the same row says nothing twice", () => {
    const later = { ...COMPLETION, fireAtMs: COMPLETION.fireAtMs + 60 * 60_000 };
    expect(same(COMPLETION, later)).toBe(true);
  });

  it("ignores the date, because the row already identifies the occurrence", () => {
    expect(same(COMPLETION, { ...COMPLETION, occurrenceDate: "2026-09-10" })).toBe(true);
    expect(same(COMPLETION, { ...COMPLETION, occurrenceDate: null })).toBe(true);
  });

  it("tells two resolution rows apart, which is how a re-tick announces again", () => {
    expect(same(COMPLETION, { ...COMPLETION, subjectId: "resolution-2" })).toBe(false);
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
