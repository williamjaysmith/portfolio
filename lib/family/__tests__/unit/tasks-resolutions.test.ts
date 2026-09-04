import { describe, expect, it } from "vitest";
import {
  resolutionAt,
  resolutionIndexOf,
  resolutionKeyOf,
  resolutionStateOf,
} from "@/lib/family/tasks/resolutions";
import type { OccurrenceKey, TaskResolution } from "@/lib/family/types";

const ANA = "11111111-1111-4111-8111-111111111111";
const BEN = "22222222-2222-4222-8222-222222222222";
const TASK = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function resolution(overrides: Partial<TaskResolution> = {}): TaskResolution {
  return {
    id: "res-1",
    householdId: "house",
    taskId: TASK,
    occurrenceDate: "2026-09-04",
    occurrenceSlot: null,
    assigneeId: ANA,
    categoryId: ANA,
    cyclePrev: null,
    status: "complete",
    resolvedOn: "2026-09-04",
    resolvedAt: "2026-09-04T12:00:00.000Z",
    createdBy: ANA,
    createdAt: "2026-09-04T12:00:00.000Z",
    ...overrides,
  };
}

function key(overrides: Partial<OccurrenceKey> = {}): OccurrenceKey {
  return {
    taskId: TASK,
    assigneeId: ANA,
    occurrenceDate: "2026-09-04",
    slot: null,
    cyclePrev: null,
    ...overrides,
  };
}

describe("resolutionKeyOf — the store's five uniqueness columns, exactly", () => {
  it("is stable and order-independent of how the key was built", () => {
    expect(resolutionKeyOf(key())).toBe(resolutionKeyOf({ ...key() }));
  });

  it("treats an absent cyclePrev and an explicit null as the same key", () => {
    const withoutField: OccurrenceKey = {
      taskId: TASK,
      assigneeId: ANA,
      occurrenceDate: "2026-09-04",
      slot: null,
    };
    expect(resolutionKeyOf(withoutField)).toBe(resolutionKeyOf(key({ cyclePrev: null })));
  });

  it("separates every column, so a null in one never reads as a value in another", () => {
    const nullAssignee = resolutionKeyOf(key({ assigneeId: null, occurrenceDate: ANA }));
    const nullDate = resolutionKeyOf(key({ assigneeId: ANA, occurrenceDate: null }));
    expect(nullAssignee).not.toBe(nullDate);
  });

  it("distinguishes the four columns that make two occurrences different", () => {
    const base = resolutionKeyOf(key());
    expect(resolutionKeyOf(key({ assigneeId: BEN }))).not.toBe(base);
    expect(resolutionKeyOf(key({ occurrenceDate: "2026-09-05" }))).not.toBe(base);
    expect(resolutionKeyOf(key({ slot: "morning" }))).not.toBe(base);
    expect(resolutionKeyOf(key({ cyclePrev: "res-0" }))).not.toBe(base);
  });
});

describe("resolutionIndexOf / resolutionStateOf", () => {
  it("reads unresolved for an occurrence with no row — absence IS outstanding", () => {
    const index = resolutionIndexOf([]);
    expect(resolutionStateOf(index, key())).toBe("unresolved");
    expect(resolutionAt(index, key())).toBeNull();
  });

  it("reads back both stored statuses", () => {
    const index = resolutionIndexOf([
      resolution({ id: "a", status: "complete" }),
      resolution({ id: "b", status: "skipped", assigneeId: BEN, categoryId: BEN }),
    ]);
    expect(resolutionStateOf(index, key())).toBe("complete");
    expect(resolutionStateOf(index, key({ assigneeId: BEN }))).toBe("skipped");
  });

  it("gives each assignee their own resolution of the same date (FR-324)", () => {
    const index = resolutionIndexOf([resolution({ assigneeId: ANA, categoryId: ANA })]);
    expect(resolutionStateOf(index, key({ assigneeId: ANA }))).toBe("complete");
    expect(resolutionStateOf(index, key({ assigneeId: BEN }))).toBe("unresolved");
  });

  it("gives each slot of a routine its own resolution (FR-335)", () => {
    const index = resolutionIndexOf([
      resolution({ occurrenceSlot: "morning" }),
      resolution({ id: "res-2", occurrenceSlot: "evening", status: "skipped" }),
    ]);
    expect(resolutionStateOf(index, key({ slot: "morning" }))).toBe("complete");
    expect(resolutionStateOf(index, key({ slot: "evening" }))).toBe("skipped");
    expect(resolutionStateOf(index, key({ slot: "afternoon" }))).toBe("unresolved");
  });

  it("keeps two Immediately cycles on one date apart by cyclePrev (R308)", () => {
    const index = resolutionIndexOf([
      resolution({ id: "cycle-1", cyclePrev: null }),
      resolution({ id: "cycle-2", cyclePrev: "cycle-1" }),
    ]);
    expect(resolutionAt(index, key({ cyclePrev: null }))?.id).toBe("cycle-1");
    expect(resolutionAt(index, key({ cyclePrev: "cycle-1" }))?.id).toBe("cycle-2");
    // The cycle this one would schedule is not resolved yet.
    expect(resolutionStateOf(index, key({ cyclePrev: "cycle-2" }))).toBe("unresolved");
  });

  it("finds an Anytime chore's undated resolution on any displayed day (FR-328)", () => {
    const index = resolutionIndexOf([resolution({ occurrenceDate: null })]);
    expect(resolutionStateOf(index, key({ occurrenceDate: null }))).toBe("complete");
    expect(resolutionStateOf(index, key({ occurrenceDate: "2026-09-04" }))).toBe("unresolved");
  });
});

describe("the up-for-grabs asymmetry (R315)", () => {
  it("looks an unclaimed occurrence up with a null assignee, IGNORING the credit", () => {
    // The claim credits Ana, but the occurrence belongs to the household chain:
    // the credit is what a resolution establishes, not what identifies it.
    const index = resolutionIndexOf([resolution({ assigneeId: null, categoryId: ANA })]);
    const householdKey = key({ assigneeId: null });

    expect(resolutionStateOf(index, householdKey)).toBe("complete");
    expect(resolutionAt(index, householdKey)?.categoryId).toBe(ANA);
    // Nobody's own column key reaches it — there is one chain, not one per profile.
    expect(resolutionStateOf(index, key({ assigneeId: ANA }))).toBe("unresolved");
    expect(resolutionStateOf(index, key({ assigneeId: BEN }))).toBe("unresolved");
  });

  it("finds a household-wide skip crediting nobody (FR-363, FR-368)", () => {
    const index = resolutionIndexOf([
      resolution({ assigneeId: null, categoryId: null, status: "skipped" }),
    ]);
    expect(resolutionStateOf(index, key({ assigneeId: null }))).toBe("skipped");
    expect(resolutionAt(index, key({ assigneeId: null }))?.categoryId).toBeNull();
  });
});
