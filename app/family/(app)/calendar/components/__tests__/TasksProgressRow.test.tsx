import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import {
  useTaskCarryForward,
  useTaskCursors,
  useTaskResolutions,
  useTasks,
} from "@/lib/family/queries";
import { columnCountersOf } from "@/lib/family/tasks/counters";
import { expandTaskDay } from "@/lib/family/tasks/expand";
import type { Category, Task, TaskAssignee, TaskResolution } from "@/lib/family/types";

import {
  makeCategory,
  makeContext,
  withFamily,
} from "../../../components/__tests__/family-test-utils";
import { TasksProgressRow } from "../TasksProgressRow";

/**
 * 009 T041/T042 — Tasks Progress in the preview bar (FR-911, FR-912, SC-907,
 * SC-908).
 *
 * The two claims worth proving are the ones a second implementation would
 * silently break: the numbers are `counters.ts`'s OWN, computed from the same
 * expansion the board uses (so this test derives its expectations rather than
 * hard-coding them), and the row follows the device's VISIBLE Profiles rather
 * than the household.
 *
 * The reads are stubbed at `lib/family/queries`, the shipped board-test idiom,
 * so no query client and no network is involved.
 */

vi.mock("@/lib/family/queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/family/queries")>();
  return {
    ...actual,
    useTasks: vi.fn(),
    useTaskResolutions: vi.fn(),
    useTaskCarryForward: vi.fn(),
    useTaskCursors: vi.fn(),
  };
});

const ZONE = "America/Chicago";
const TODAY = "2026-09-07";
const HOUSEHOLD = "household-1";
const ANA = "11111111-1111-4111-8111-111111111111";
const CLEO = "22222222-2222-4222-8222-222222222222";

function assigneeOf(taskId: string, categoryId: string): TaskAssignee {
  return {
    taskId,
    categoryId,
    householdId: HOUSEHOLD,
    sortOrder: 1000,
    streakCount: 0,
    streakThrough: null,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

function taskOf(id: string, categoryId: string, summary: string): Task {
  return {
    id,
    rewardPoints: null,
    householdId: HOUSEHOLD,
    summary,
    description: null,
    emoji: null,
    routine: false,
    upForGrabs: false,
    trackHabit: false,
    startsOn: TODAY,
    dueTime: null,
    timesOfDay: [],
    rrule: null,
    renewAfterAmount: null,
    renewAfterUnit: null,
    renewUntil: null,
    assignees: [assigneeOf(id, categoryId)],
    createdBy: null,
    updatedBy: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

/** Ana has three chores today, Cleo one. */
const TASKS: Task[] = [
  taskOf("task-1", ANA, "Feed the cat"),
  taskOf("task-2", ANA, "Homework"),
  taskOf("task-3", ANA, "Tidy room"),
  taskOf("task-4", CLEO, "Take out trash"),
];

/** Ana finished one of hers. */
const RESOLUTIONS: TaskResolution[] = [
  {
    id: "res-1",
    householdId: HOUSEHOLD,
    taskId: "task-1",
    occurrenceDate: TODAY,
    occurrenceSlot: null,
    assigneeId: ANA,
    categoryId: ANA,
    cyclePrev: null,
    status: "complete",
    resolvedOn: TODAY,
    resolvedAt: "2026-09-07T14:00:00.000Z",
    createdBy: ANA,
    createdAt: "2026-09-07T14:00:00.000Z",
  },
];

function stub(hook: unknown, data: unknown): void {
  (hook as Mock).mockReturnValue({ data, isPending: false, error: null });
}

const ana = makeCategory({ id: ANA, label: "Ana", sortOrder: 1000 });
const cleo = makeCategory({ id: CLEO, label: "Cleo", role: "member", sortOrder: 2000 });

function renderRow(profiles: Category[], hiddenIds: Set<string> = new Set()): void {
  render(
    withFamily(
      makeContext({
        householdId: HOUSEHOLD,
        categories: profiles,
        hiddenIds,
        // `makeContext` derives `visibleProfiles` from the categories alone, so
        // the hidden set has to be applied here — the same filter the provider
        // itself runs (001 FR-033).
        visibleProfiles: profiles.filter((profile) => !hiddenIds.has(profile.id)),
      }),
      <TasksProgressRow todayDate={TODAY} zone={ZONE} />,
    ),
  );
}

/** What the Tasks board itself would say for the same fixtures (FR-912). */
function boardCountersFor(profileId: string): string {
  const occurrences = expandTaskDay(TASKS, RESOLUTIONS, [], {
    displayedDate: TODAY,
    todayDate: TODAY,
    zone: ZONE,
  });
  const counters = columnCountersOf(occurrences, profileId);
  return `${counters.complete}/${counters.total}`;
}

describe("TasksProgressRow", () => {
  beforeEach(() => {
    stub(vi.mocked(useTasks), TASKS);
    stub(vi.mocked(useTaskResolutions), RESOLUTIONS);
    stub(vi.mocked(useTaskCarryForward), []);
    stub(vi.mocked(useTaskCursors), []);
  });

  it("names each visible Profile and their completed-of-total", () => {
    renderRow([ana, cleo]);

    const row = screen.getByRole("list", { name: "Tasks Progress" });
    expect(row).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("Ana", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("Cleo", { exact: false })).toBeInTheDocument();
  });

  it("reports EXACTLY what the Tasks board's own counters say (FR-912, SC-907)", () => {
    renderRow([ana, cleo]);

    // Derived, never hard-coded: if a second counting rule ever appears, this
    // test fails rather than agreeing with it.
    expect(screen.getByText(boardCountersFor(ANA))).toBeInTheDocument();
    expect(screen.getByText(boardCountersFor(CLEO))).toBeInTheDocument();
    // And the board says 1/3 and 0/1 for these fixtures.
    expect(boardCountersFor(ANA)).toBe("1/3");
    expect(boardCountersFor(CLEO)).toBe("0/1");
  });

  it("drops a Profile hidden on this device (FR-911, SC-908)", () => {
    renderRow([ana, cleo], new Set([CLEO]));

    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.queryByText("Cleo", { exact: false })).toBeNull();
  });

  it("draws no row at all when every Profile is hidden", () => {
    const { container } = render(
      withFamily(
        makeContext({
          householdId: HOUSEHOLD,
          categories: [ana, cleo],
          hiddenIds: new Set([ANA, CLEO]),
          visibleProfiles: [],
        }),
        <TasksProgressRow todayDate={TODAY} zone={ZONE} />,
      ),
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("reads a Profile with no chores as none rather than as complete", () => {
    const ben = makeCategory({ id: "33333333-3333-4333-8333-333333333333", label: "Ben", sortOrder: 3000 });
    renderRow([ben]);
    expect(screen.getByText("0/0")).toBeInTheDocument();
  });
});

describe("the switch is the mount (R905, T042)", () => {
  it("issues no task read when the row is not rendered", () => {
    for (const hook of [useTasks, useTaskResolutions, useTaskCarryForward, useTaskCursors]) {
      (hook as Mock).mockClear();
    }

    // The calendar with Tasks Progress off renders no TasksProgressRow at all.
    // Nothing else in the tree calls a task read, so "off" costs zero requests
    // — which is the whole reason mounting is the `enabled` rather than a flag.
    render(withFamily(makeContext({ householdId: HOUSEHOLD, categories: [ana] }), <div />));

    for (const hook of [useTasks, useTaskResolutions, useTaskCarryForward, useTaskCursors]) {
      expect(hook as Mock).not.toHaveBeenCalled();
    }
  });

  it("issues them the moment it is rendered", () => {
    for (const hook of [useTasks, useTaskResolutions, useTaskCarryForward, useTaskCursors]) {
      (hook as Mock).mockClear();
      stub(vi.mocked(hook), []);
    }
    stub(vi.mocked(useTasks), TASKS);

    renderRow([ana]);

    for (const hook of [useTasks, useTaskResolutions, useTaskCarryForward, useTaskCursors]) {
      expect(hook as Mock).toHaveBeenCalled();
    }
  });
});
