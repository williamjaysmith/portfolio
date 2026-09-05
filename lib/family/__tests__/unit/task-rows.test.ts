import { describe, expect, it } from "vitest";
import {
  TASK_ASSIGNEE_COLUMNS,
  TASK_BOX_COLUMNS,
  TASK_COLUMNS,
  TASK_CURSOR_COLUMNS,
  TASK_RESOLUTION_COLUMNS,
  tasksSelect,
  toTask,
  toTaskBoxItem,
  toTaskCursor,
  toTaskResolution,
  type TaskAssigneeRow,
  type TaskWithAssigneesRow,
} from "@/lib/family/rows";

const ANA = "11111111-1111-4111-8111-111111111111";
const BEN = "22222222-2222-4222-8222-222222222222";

function assigneeRow(overrides: Partial<TaskAssigneeRow> = {}): TaskAssigneeRow {
  return {
    household_id: "house",
    task_id: "task-1",
    category_id: ANA,
    sort_order: "1000",
    streak_count: 0,
    streak_through: null,
    created_at: "2026-09-01T10:00:00.000Z",
    ...overrides,
  };
}

function taskRow(overrides: Partial<TaskWithAssigneesRow> = {}): TaskWithAssigneesRow {
  return {
    id: "task-1",
    household_id: "house",
    summary: "Take out trash",
    description: null,
    emoji: null,
    routine: false,
    up_for_grabs: false,
    track_habit: false,
    starts_on: "2026-09-04",
    due_time: null,
    times_of_day: [],
    rrule: null,
    renew_after_amount: null,
    renew_after_unit: null,
    renew_until: null,
    created_by: null,
    updated_by: null,
    created_at: "2026-09-01T10:00:00.000Z",
    updated_at: "2026-09-01T10:00:00.000Z",
    task_assignees: [],
    ...overrides,
  };
}

describe("task column lists (no select('*'))", () => {
  const lists = {
    TASK_COLUMNS,
    TASK_ASSIGNEE_COLUMNS,
    TASK_RESOLUTION_COLUMNS,
    TASK_CURSOR_COLUMNS,
    TASK_BOX_COLUMNS,
  };

  it("names every column explicitly and never uses a star", () => {
    for (const [name, list] of Object.entries(lists)) {
      expect(list, name).not.toContain("*");
      expect(list.split(", ").length, name).toBeGreaterThan(1);
    }
  });

  it("never selects the reserved star value (FR-329, SC-319)", () => {
    expect(TASK_COLUMNS).not.toContain("reward_points");
    expect(TASK_BOX_COLUMNS).not.toContain("reward_points");
  });

  it("keeps the two created_at columns the derivations depend on", () => {
    // FR-311 breaks the chore order's ties by creation order; cursor.ts reads
    // the assignee row's created_at as chainStartedOn.
    expect(TASK_COLUMNS.split(", ")).toContain("created_at");
    expect(TASK_ASSIGNEE_COLUMNS.split(", ")).toContain("created_at");
  });

  it("embeds the assignees with their streak pair, separator intact", () => {
    const select = tasksSelect();
    expect(select).toContain(`,task_assignees(${TASK_ASSIGNEE_COLUMNS})`);
    expect(select.startsWith(TASK_COLUMNS)).toBe(true);
    expect(select).toContain("streak_count");
  });
});

describe("toTask", () => {
  it("maps every field and orders the embedded assignees deterministically", () => {
    const task = toTask(
      taskRow({
        task_assignees: [
          assigneeRow({ category_id: BEN, sort_order: "2000", streak_count: 3, streak_through: "2026-09-03" }),
          assigneeRow({ category_id: ANA }),
        ],
      }),
    );

    expect(task.assignees.map((one) => one.categoryId)).toEqual([ANA, BEN]);
    expect(task.assignees[1]).toEqual({
      taskId: "task-1",
      householdId: "house",
      categoryId: BEN,
      sortOrder: 2000,
      streakCount: 3,
      streakThrough: "2026-09-03",
      createdAt: "2026-09-01T10:00:00.000Z",
    });
    expect(task.startsOn).toBe("2026-09-04");
    expect(task.upForGrabs).toBe(false);
  });

  it("reads a wall-clock due time back as HH:MM (FR-326)", () => {
    expect(toTask(taskRow({ due_time: "18:00:00" })).dueTime).toBe("18:00");
    expect(toTask(taskRow({ due_time: null })).dueTime).toBeNull();
  });

  it("carries a routine's slots and a cursor chore's delay triple", () => {
    const routine = toTask(
      taskRow({ routine: true, times_of_day: ["morning", "evening"], rrule: "FREQ=DAILY;INTERVAL=1" }),
    );
    expect(routine.timesOfDay).toEqual(["morning", "evening"]);
    expect(routine.rrule).toBe("FREQ=DAILY;INTERVAL=1");

    const cursor = toTask(
      taskRow({ renew_after_amount: 0, renew_after_unit: "day", renew_until: "2026-12-31" }),
    );
    // 0 IS "Immediately" and must survive as 0, never as a falsy null.
    expect(cursor.renewAfterAmount).toBe(0);
    expect(cursor.renewAfterUnit).toBe("day");
    expect(cursor.renewUntil).toBe("2026-12-31");
  });
});

describe("toTaskResolution / toTaskCursor / toTaskBoxItem", () => {
  it("keeps the credited Profile separate from the chain owner and the actor", () => {
    const resolution = toTaskResolution({
      id: "res-1",
      household_id: "house",
      task_id: "task-1",
      occurrence_date: "2026-09-01",
      occurrence_slot: null,
      assignee_id: null,
      category_id: ANA,
      cycle_prev: "res-0",
      status: "complete",
      resolved_on: "2026-09-04",
      resolved_at: "2026-09-04T09:00:00.000Z",
      created_by: BEN,
      created_at: "2026-09-04T09:00:00.000Z",
    });

    expect(resolution.assigneeId).toBeNull();
    expect(resolution.categoryId).toBe(ANA);
    expect(resolution.createdBy).toBe(BEN);
    expect(resolution.occurrenceDate).toBe("2026-09-01");
    expect(resolution.resolvedOn).toBe("2026-09-04");
    expect(resolution.cyclePrev).toBe("res-0");
  });

  it("maps the cursor view's tail", () => {
    expect(
      toTaskCursor({
        household_id: "house",
        task_id: "task-1",
        assignee_id: ANA,
        tail_id: "res-9",
        tail_resolved_on: "2026-08-21",
      }),
    ).toEqual({
      householdId: "house",
      taskId: "task-1",
      assigneeId: ANA,
      tailId: "res-9",
      tailResolvedOn: "2026-08-21",
    });
  });

  it("maps a template's three fields and its attribution", () => {
    const item = toTaskBoxItem({
      id: "box-1",
      household_id: "house",
      summary: "Brush teeth",
      emoji: "🪥",
      routine: true,
      created_by: null,
      updated_by: null,
      created_at: "2026-09-01T10:00:00.000Z",
      updated_at: "2026-09-01T10:00:00.000Z",
    });
    expect(item.summary).toBe("Brush teeth");
    expect(item.emoji).toBe("🪥");
    expect(item.routine).toBe(true);
  });
});
