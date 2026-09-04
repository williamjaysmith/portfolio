import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock, type MockedFunction } from "vitest";

import {
  prefetchTaskWeek,
  useTaskCarryForward,
  useTaskCursors,
  useTaskResolutions,
  useTasks,
} from "@/lib/family/queries";
import { expandTaskDay } from "@/lib/family/tasks/expand";
import type { Task, TaskAssignee, TaskCursor, TaskResolution } from "@/lib/family/types";

import {
  useBoardOccurrences,
  type UseBoardOccurrencesOptions,
} from "@/app/family/(app)/tasks/components/useBoardOccurrences";

/**
 * T039 / R317: the board's one data path, as memo layers that invalidate
 * independently — the four cached reads (R314) → `expandTaskDay` → and then a
 * BRANCH, with the counters hanging off the unfiltered occurrence list and
 * everything a filter can touch below it.
 *
 * The four queries are mocked; expansion and the counters run for real. The
 * standing assertion that no filter and no search query can move a number
 * lands at T068, which is the first point at which there is a switch to toggle
 * — until then `tasks-counters.test.ts` carries it at the pure-function level.
 * What is asserted here is that the counters are computed from a list no
 * caller is ever handed, so there is nothing to pass the filtered one to.
 */

vi.mock("@/lib/family/queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/family/queries")>();
  return {
    ...actual,
    useTasks: vi.fn(),
    useTaskResolutions: vi.fn(),
    useTaskCarryForward: vi.fn(),
    useTaskCursors: vi.fn(),
    prefetchTaskWeek: vi.fn(() => Promise.resolve()),
  };
});

vi.mock("@/lib/family/tasks/expand", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/family/tasks/expand")>();
  return { ...actual, expandTaskDay: vi.fn(actual.expandTaskDay) };
});

const HOUSEHOLD = "household-1";
const ZONE = "America/Chicago";
/** A Friday; the Sunday-started week containing it begins 2026-08-30. */
const TODAY = "2026-09-04";
const WEEK_START = "2026-08-30";
const ANA = "profile-ana";
const BEN = "profile-ben";
const ROUTINE = "task-routine";
const CHORE = "task-chore";
const GRABS = "task-grabs";

function assigneeOf(taskId: string, categoryId: string): TaskAssignee {
  return {
    taskId,
    householdId: HOUSEHOLD,
    categoryId,
    sortOrder: 1000,
    streakCount: 0,
    streakThrough: null,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

function taskOf(overrides: Partial<Task> & Pick<Task, "id">): Task {
  return {
    householdId: HOUSEHOLD,
    summary: "Take out the bins",
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
    assignees: [assigneeOf(overrides.id, ANA)],
    createdBy: null,
    updatedBy: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

/** Ana's twice-daily routine, her one dated chore, and one that belongs to nobody. */
const FIXTURE_TASKS: Task[] = [
  taskOf({
    id: ROUTINE,
    summary: "Brush teeth",
    routine: true,
    trackHabit: true,
    timesOfDay: ["morning", "evening"],
    rrule: "FREQ=DAILY;INTERVAL=1",
    startsOn: "2026-08-01",
  }),
  taskOf({ id: CHORE }),
  taskOf({ id: GRABS, summary: "Feed the cat", upForGrabs: true, assignees: [] }),
];

function resolutionOf(overrides: Partial<TaskResolution> & Pick<TaskResolution, "id">): TaskResolution {
  return {
    householdId: HOUSEHOLD,
    taskId: ROUTINE,
    occurrenceDate: TODAY,
    occurrenceSlot: null,
    assigneeId: ANA,
    categoryId: ANA,
    cyclePrev: null,
    status: "complete",
    resolvedOn: TODAY,
    resolvedAt: `${TODAY}T12:00:00.000Z`,
    createdBy: ANA,
    createdAt: `${TODAY}T12:00:00.000Z`,
    ...overrides,
  };
}

/** Ana ticked the morning slot and skipped the bins (FR-360: a skip leaves the total). */
const FIXTURE_RESOLUTIONS: TaskResolution[] = [
  resolutionOf({ id: "res-morning", occurrenceSlot: "morning" }),
  resolutionOf({ id: "res-bins", taskId: CHORE, status: "skipped" }),
];

interface QueryStub<T> {
  data?: T;
  isPending?: boolean;
  error?: Error | null;
}

/** One React Query result, stubbed down to the three fields the board reads. */
function stub<T extends (...args: never[]) => unknown>(
  hook: MockedFunction<T>,
  value: QueryStub<unknown>,
): void {
  const mock = hook as unknown as Mock<() => unknown>;
  mock.mockReturnValue({
    data: value.data,
    isPending: value.isPending ?? false,
    error: value.error ?? null,
  });
}

function stubReads(overrides: {
  tasks?: QueryStub<Task[]>;
  resolutions?: QueryStub<TaskResolution[]>;
  carry?: QueryStub<TaskResolution[]>;
  cursors?: QueryStub<TaskCursor[]>;
} = {}): void {
  stub(vi.mocked(useTasks), overrides.tasks ?? { data: FIXTURE_TASKS });
  stub(vi.mocked(useTaskResolutions), overrides.resolutions ?? { data: FIXTURE_RESOLUTIONS });
  stub(vi.mocked(useTaskCarryForward), overrides.carry ?? { data: [] });
  stub(vi.mocked(useTaskCursors), overrides.cursors ?? { data: [] });
}

function optionsOf(
  overrides: Partial<UseBoardOccurrencesOptions> = {},
): UseBoardOccurrencesOptions {
  return {
    householdId: HOUSEHOLD,
    displayedDate: TODAY,
    todayDate: TODAY,
    zone: ZONE,
    startWeekOn: 0,
    ...overrides,
  };
}

function renderBoard(initialProps: UseBoardOccurrencesOptions) {
  const queryClient = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  return {
    queryClient,
    ...renderHook((options: UseBoardOccurrencesOptions) => useBoardOccurrences(options), {
      wrapper,
      initialProps,
    }),
  };
}

describe("useBoardOccurrences — the four reads (R314)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubReads();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keys the definitions and the cursor tail by the household alone", () => {
    renderBoard(optionsOf({ initialTasks: FIXTURE_TASKS, initialCursors: [] }));

    expect(vi.mocked(useTasks)).toHaveBeenCalledWith(HOUSEHOLD, FIXTURE_TASKS);
    expect(vi.mocked(useTaskCursors)).toHaveBeenCalledWith(HOUSEHOLD, []);
  });

  it("keys the resolutions by the week containing the displayed day", () => {
    const { rerender } = renderBoard(optionsOf());

    expect(vi.mocked(useTaskResolutions)).toHaveBeenLastCalledWith(
      HOUSEHOLD,
      WEEK_START,
      undefined,
    );

    // Stepping inside the week costs no fetch; stepping across it moves the key.
    rerender(optionsOf({ displayedDate: "2026-09-05" }));
    expect(vi.mocked(useTaskResolutions)).toHaveBeenLastCalledWith(HOUSEHOLD, WEEK_START, undefined);

    rerender(optionsOf({ displayedDate: "2026-09-06" }));
    expect(vi.mocked(useTaskResolutions)).toHaveBeenLastCalledWith(
      HOUSEHOLD,
      "2026-09-06",
      undefined,
    );
  });

  it("enables the carry tail only while the displayed day IS today (FR-357, US3-3)", () => {
    const { rerender } = renderBoard(optionsOf());

    expect(vi.mocked(useTaskCarryForward)).toHaveBeenLastCalledWith(
      HOUSEHOLD,
      TODAY,
      0,
      true,
      undefined,
    );

    rerender(optionsOf({ displayedDate: "2026-09-03" }));

    expect(vi.mocked(useTaskCarryForward)).toHaveBeenLastCalledWith(
      HOUSEHOLD,
      TODAY,
      0,
      false,
      undefined,
    );
  });

  it("expands the week's resolutions and the carry tail as one set", () => {
    const carried = resolutionOf({
      id: "res-late",
      taskId: CHORE,
      occurrenceDate: "2026-08-20",
      resolvedOn: TODAY,
    });
    stubReads({ carry: { data: [carried] } });

    renderBoard(optionsOf());

    const [, resolutions] = vi.mocked(expandTaskDay).mock.calls[0];
    expect(resolutions.map((one) => one.id)).toEqual(["res-morning", "res-bins", "res-late"]);
  });
});

describe("useBoardOccurrences — the memo chain", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubReads();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("expands once per mounted day, in the household's zone", () => {
    const { rerender } = renderBoard(optionsOf());

    expect(vi.mocked(expandTaskDay)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(expandTaskDay).mock.calls[0][3]).toEqual({
      displayedDate: TODAY,
      todayDate: TODAY,
      zone: ZONE,
    });

    rerender(optionsOf());
    expect(vi.mocked(expandTaskDay)).toHaveBeenCalledTimes(1);
  });

  it("re-expands when the displayed day moves, and keeps the list's identity when it does not", () => {
    const { result, rerender } = renderBoard(optionsOf());
    const first = result.current.occurrences;

    rerender(optionsOf());
    expect(result.current.occurrences).toBe(first);

    rerender(optionsOf({ displayedDate: "2026-09-05" }));
    expect(vi.mocked(expandTaskDay)).toHaveBeenCalledTimes(2);
    expect(result.current.occurrences).not.toBe(first);
  });

  it("draws the day's occurrences, skipped ones included (FR-361 hides them, not this)", () => {
    const { result } = renderBoard(optionsOf());

    expect(
      result.current.occurrences.map((one) => [one.taskId, one.slot, one.state]),
    ).toEqual([
      [ROUTINE, "morning", "complete"],
      [ROUTINE, "evening", "unresolved"],
      [CHORE, null, "skipped"],
      [GRABS, null, "unresolved"],
    ]);
  });
});

describe("useBoardOccurrences — the counters branch (R317, FR-305)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubReads();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("counts a Profile's day off the unfiltered list, less every skipped occurrence", () => {
    const { result } = renderBoard(optionsOf());

    // Two routine slots plus the skipped chore: the skip leaves the total.
    expect(result.current.counters.column(ANA)).toEqual({ complete: 1, total: 2 });
  });

  it("gives a Profile with nothing to do a zero-of-zero column (FR-316)", () => {
    const { result } = renderBoard(optionsOf());

    expect(result.current.counters.column(BEN)).toEqual({ complete: 0, total: 0 });
  });

  it("scopes a routine's own progress to that routine on the displayed day (FR-312)", () => {
    const { result } = renderBoard(optionsOf());

    expect(result.current.counters.routine(ROUTINE, ANA)).toEqual({ complete: 1, total: 2 });
    expect(result.current.counters.routine(CHORE, ANA)).toEqual({ complete: 0, total: 0 });
  });

  it("counts Up for Grabs without a Profile at all (FR-308)", () => {
    const { result } = renderBoard(optionsOf());

    expect(result.current.counters.upForGrabs).toBe(1);
  });

  it("hands no caller a list the counters were not computed from", () => {
    // R317 as a shape: the counters are closures over the unfiltered list, and
    // the only list the board can render is the one below the filter layer, so
    // "pass the filtered list to the counters" is not a mistake anyone can make.
    const { result } = renderBoard(optionsOf());

    expect(Object.keys(result.current)).toEqual([
      "occurrences",
      "counters",
      "isPending",
      "error",
    ]);
    expect(typeof result.current.counters.column).toBe("function");
  });

  it("keeps the counter closures stable while the occurrences are", () => {
    const { result, rerender } = renderBoard(optionsOf());
    const first = result.current.counters;

    rerender(optionsOf());

    expect(result.current.counters).toBe(first);
  });
});

describe("useBoardOccurrences — pending, errors and warming", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubReads();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("reports the first fetch as pending, with no occurrences to draw", () => {
    stubReads({ tasks: { data: undefined, isPending: true } });
    const { result } = renderBoard(optionsOf());

    expect(result.current.isPending).toBe(true);
    expect(result.current.occurrences).toEqual([]);
    expect(result.current.counters.upForGrabs).toBe(0);
  });

  it("never waits on the carry tail it deliberately disabled", () => {
    // A disabled React Query stays `pending` for ever; a pinned past day would
    // otherwise show a loading state that can never resolve.
    stubReads({ carry: { data: undefined, isPending: true } });
    const { result } = renderBoard(optionsOf({ displayedDate: "2026-09-03" }));

    expect(result.current.isPending).toBe(false);
  });

  it("waits on the carry tail while it IS enabled", () => {
    stubReads({ carry: { data: undefined, isPending: true } });
    const { result } = renderBoard(optionsOf());

    expect(result.current.isPending).toBe(true);
  });

  it("surfaces the first failing read", () => {
    const failure = new Error("tasks unavailable");
    stubReads({ resolutions: { data: [], error: failure } });
    const { result } = renderBoard(optionsOf());

    expect(result.current.error).toBe(failure);
  });

  it("warms the neighbouring weeks once the displayed day settles", () => {
    vi.useFakeTimers();
    const { queryClient } = renderBoard(optionsOf());
    expect(vi.mocked(prefetchTaskWeek)).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(400);
    });

    const starts = vi
      .mocked(prefetchTaskWeek)
      .mock.calls.map(([, , weekStartDate]) => weekStartDate)
      .sort();
    expect(starts).toEqual(["2026-08-23", "2026-09-06"]);
    for (const [client, householdId] of vi.mocked(prefetchTaskWeek).mock.calls) {
      expect(client).toBe(queryClient);
      expect(householdId).toBe(HOUSEHOLD);
    }
  });

  it("never warms a week the reader stepped past before it settled", () => {
    vi.useFakeTimers();
    const { rerender } = renderBoard(optionsOf());

    act(() => {
      vi.advanceTimersByTime(100);
    });
    rerender(optionsOf({ displayedDate: "2026-09-13" }));
    act(() => {
      vi.advanceTimersByTime(400);
    });

    const starts = vi
      .mocked(prefetchTaskWeek)
      .mock.calls.map(([, , weekStartDate]) => weekStartDate)
      .sort();
    expect(starts).toEqual(["2026-09-06", "2026-09-20"]);
  });
});
