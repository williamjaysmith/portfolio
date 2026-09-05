import { describe, expect, it } from "vitest";
import { addDelay, openOccurrence, type CursorTask } from "@/lib/family/tasks/cursor";
import type { TaskCursor } from "@/lib/family/types";

function task(overrides: Partial<CursorTask> = {}): CursorTask {
  return {
    startsOn: "2026-09-04",
    renewAfterAmount: 14,
    renewAfterUnit: "day",
    renewUntil: null,
    ...overrides,
  };
}

function tail(resolvedOn: string): TaskCursor {
  return {
    householdId: "house",
    taskId: "task-1",
    assigneeId: "ana",
    tailId: "res-1",
    tailResolvedOn: resolvedOn,
  };
}

describe("addDelay — plain-date arithmetic, never instants (R309)", () => {
  it("adds days", () => {
    expect(addDelay("2026-09-04", 14, "day")).toBe("2026-09-18");
    expect(addDelay("2026-12-28", 7, "day")).toBe("2027-01-04");
  });

  it("adds weeks as seven days each", () => {
    expect(addDelay("2026-09-04", 1, "week")).toBe("2026-09-11");
    expect(addDelay("2026-09-04", 3, "week")).toBe("2026-09-25");
  });

  it("adds calendar months", () => {
    expect(addDelay("2026-09-04", 1, "month")).toBe("2026-10-04");
    expect(addDelay("2026-09-04", 6, "month")).toBe("2027-03-04");
    expect(addDelay("2026-12-15", 1, "month")).toBe("2027-01-15");
  });

  it("CLAMPS a month to the last day of the target month — the opposite answer to rule mode", () => {
    // A rule may legitimately be silent in a month; a cursor must always land
    // somewhere or the chore is lost.
    expect(addDelay("2026-01-31", 1, "month")).toBe("2026-02-28");
    expect(addDelay("2028-01-31", 1, "month")).toBe("2028-02-29");
    expect(addDelay("2026-03-31", 1, "month")).toBe("2026-04-30");
    expect(addDelay("2026-08-31", 6, "month")).toBe("2027-02-28");
  });

  it("treats 0 as Immediately, in every unit and with no special case", () => {
    expect(addDelay("2026-09-04", 0, "day")).toBe("2026-09-04");
    expect(addDelay("2026-09-04", 0, "week")).toBe("2026-09-04");
    expect(addDelay("2026-09-04", 0, "month")).toBe("2026-09-04");
  });
});

describe("openOccurrence — derived from the chain tail, never stored (FR-343, R309)", () => {
  it("is the tail's resolution date plus the delay", () => {
    expect(openOccurrence(task({ renewAfterAmount: 14 }), tail("2026-08-21"), "2026-01-01")).toEqual(
      { date: "2026-09-04" },
    );
    expect(
      openOccurrence(
        task({ renewAfterAmount: 1, renewAfterUnit: "month" }),
        tail("2026-01-31"),
        "2026-01-01",
      ),
    ).toEqual({ date: "2026-02-28" });
  });

  it("counts from the day it was RESOLVED, not the day it was due (FR-354)", () => {
    // Due 2026-08-01, ticked late on 2026-08-21: the next one is 14 days after
    // the tick, which is what "two weeks after it was last done" means.
    expect(openOccurrence(task(), tail("2026-08-21"), "2026-01-01")).toEqual({
      date: "2026-09-04",
    });
  });

  it("schedules the next cycle on the SAME date when the delay is Immediately", () => {
    expect(
      openOccurrence(task({ renewAfterAmount: 0 }), tail("2026-09-04"), "2026-01-01"),
    ).toEqual({ date: "2026-09-04" });
  });

  it("seeds a chain with no tail from max(startsOn, chainStartedOn)", () => {
    // The chore's own due date, when the assignee has been on it longer.
    expect(openOccurrence(task({ startsOn: "2026-09-04" }), null, "2026-01-01")).toEqual({
      date: "2026-09-04",
    });
  });

  it("starts an assignee added to an old chore TODAY, not six months late", () => {
    expect(openOccurrence(task({ startsOn: "2026-03-04" }), null, "2026-09-04")).toEqual({
      date: "2026-09-04",
    });
  });

  it("falls back to the chain's start when the task carries no date at all", () => {
    expect(openOccurrence(task({ startsOn: null }), null, "2026-09-04")).toEqual({
      date: "2026-09-04",
    });
  });

  it("suppresses everything past Repeats until, seeded or derived (FR-346)", () => {
    const bounded = task({ renewUntil: "2026-09-03" });
    expect(openOccurrence(bounded, tail("2026-08-21"), "2026-01-01")).toBeNull();
    expect(openOccurrence(bounded, null, "2026-01-01")).toBeNull();
    // On the boundary date itself it still exists — `until` is inclusive.
    expect(openOccurrence(task({ renewUntil: "2026-09-04" }), null, "2026-01-01")).toEqual({
      date: "2026-09-04",
    });
  });

  it("is total: a task that is not a Completed Date chore has no open occurrence", () => {
    expect(openOccurrence(task({ renewAfterAmount: null }), null, "2026-09-04")).toBeNull();
    expect(openOccurrence(task({ renewAfterAmount: null }), tail("2026-08-21"), "2026-09-04")).toBeNull();
    expect(openOccurrence(task({ renewAfterUnit: null }), null, "2026-09-04")).toBeNull();
  });
});
