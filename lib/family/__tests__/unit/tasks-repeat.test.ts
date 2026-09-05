import { describe, expect, it } from "vitest";

import { taskRepeatChoiceOf, type RepeatSource } from "@/lib/family/tasks/repeat";

/**
 * A stored task's repeat, read back as the structured choice a form submits
 * (FR-334, FR-339–FR-346). This is the one direction the browser is allowed to
 * take — only the server ever EMITS rule text (R201/R301) — and it exists
 * because the edit form must show the repeat a task actually has rather than
 * offering "doesn't repeat" over a weekly chore and destroying it on save.
 *
 * `zone` is consulted only for the instant form of `UNTIL`, which tasks never
 * write (their `UNTIL` is a plain date) but a rule authored elsewhere could
 * carry — so the function stays total rather than throwing on one.
 */

const ZONE = "America/Chicago";

function source(overrides: Partial<RepeatSource> = {}): RepeatSource {
  return {
    rrule: null,
    renewAfterAmount: null,
    renewAfterUnit: null,
    renewUntil: null,
    ...overrides,
  };
}

describe("taskRepeatChoiceOf", () => {
  it("reads a task with neither mode populated as `never`", () => {
    expect(taskRepeatChoiceOf(source(), ZONE)).toEqual({ kind: "never" });
  });

  it("reads a daily rule with its interval", () => {
    expect(taskRepeatChoiceOf(source({ rrule: "FREQ=DAILY;INTERVAL=2" }), ZONE)).toEqual({
      kind: "daily",
      interval: 2,
      until: null,
    });
  });

  it("reads a weekly rule with every weekday it names", () => {
    expect(
      taskRepeatChoiceOf(source({ rrule: "FREQ=WEEKLY;INTERVAL=2;WKST=SU;BYDAY=MO,WE" }), ZONE),
    ).toEqual({ kind: "weekly", interval: 2, weekdays: ["MO", "WE"], until: null });
  });

  /** BYMONTHDAY is derived from the anchor, so it is not part of the choice. */
  it("reads a monthly rule without its BYMONTHDAY", () => {
    expect(
      taskRepeatChoiceOf(source({ rrule: "FREQ=MONTHLY;INTERVAL=3;BYMONTHDAY=31" }), ZONE),
    ).toEqual({ kind: "monthly", interval: 3, until: null });
  });

  it("carries a date-form UNTIL through as a plain household-local date", () => {
    expect(
      taskRepeatChoiceOf(source({ rrule: "FREQ=DAILY;INTERVAL=1;UNTIL=20261215" }), ZONE),
    ).toMatchObject({ until: "2026-12-15" });
  });

  /** Never written by a task, but read without throwing if one turns up. */
  it("reads an instant-form UNTIL as the household-local date it admits", () => {
    expect(
      taskRepeatChoiceOf(
        source({ rrule: "FREQ=WEEKLY;INTERVAL=1;UNTIL=20261216T055959Z;BYDAY=TU" }),
        ZONE,
      ),
    ).toMatchObject({ until: "2026-12-15" });
  });

  it("reads the cursor mode as `after_completion`, with zero meaning Immediately", () => {
    expect(
      taskRepeatChoiceOf(
        source({ renewAfterAmount: 0, renewAfterUnit: "day", renewUntil: null }),
        ZONE,
      ),
    ).toEqual({ kind: "after_completion", amount: 0, unit: "day", until: null });
  });

  it("carries the cursor mode's own end date", () => {
    expect(
      taskRepeatChoiceOf(
        source({ renewAfterAmount: 2, renewAfterUnit: "week", renewUntil: "2026-12-15" }),
        ZONE,
      ),
    ).toEqual({ kind: "after_completion", amount: 2, unit: "week", until: "2026-12-15" });
  });

  /** 017 makes the two modes exclusive; a half-written row still reads as `never`. */
  it("ignores a delay with no unit rather than inventing one", () => {
    expect(taskRepeatChoiceOf(source({ renewAfterAmount: 3 }), ZONE)).toEqual({ kind: "never" });
  });
});
