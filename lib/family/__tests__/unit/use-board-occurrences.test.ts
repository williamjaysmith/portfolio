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
import { visibleTaskOccurrences } from "@/lib/family/tasks/visibility";
import type {
  Task,
  TaskAssignee,
  TaskCursor,
  TaskFilters,
  TaskResolution,
} from "@/lib/family/types";

import {
  resetDeviceVisibility,
  useDeviceVisibility,
} from "@/app/family/(app)/components/useDeviceVisibility";
import {
  useBoardOccurrences,
  type UseBoardOccurrencesOptions,
} from "@/app/family/(app)/tasks/components/useBoardOccurrences";
import {
  resetTaskFilters,
  useTaskFilters,
} from "@/app/family/(app)/tasks/components/useTaskFilters";

/**
 * T039 / R317: the board's one data path, as memo layers that invalidate
 * independently — the four cached reads (R314) → `expandTaskDay` → and then a
 * BRANCH, with the counters hanging off the unfiltered occurrence list and
 * everything a filter can touch below it.
 *
 * The four queries are mocked; expansion, the counters and the filter rule all
 * run for real. T068 closes the loop: the two per-device stores and the search
 * `query` now have something to move, so the standing assertion lands here —
 * toggling any switch, hiding any Profile or typing any string re-runs ONE
 * memo, the filter layer, and cannot reach the counters at all (FR-384,
 * FR-386, SC-310, SC-320). It holds because of where the branch is, not
 * because anything remembered to check.
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

vi.mock("@/lib/family/tasks/visibility", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/family/tasks/visibility")>();
  return { ...actual, visibleTaskOccurrences: vi.fn(actual.visibleTaskOccurrences) };
});

/** Both per-device stores are module state; no case inherits another's. */
beforeEach(() => {
  localStorage.clear();
  resetTaskFilters();
  resetDeviceVisibility();
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

/** Move one of the four switches, from outside the board, as the sheet does. */
function setSwitch(key: keyof TaskFilters, on: boolean): void {
  const { result } = renderHook(() => useTaskFilters());
  act(() => result.current.setFilter(key, on));
}

/** Hide one Profile in the shipped per-device category store (FR-383). */
function hideProfile(id: string): void {
  const { result } = renderHook(() => useDeviceVisibility());
  act(() => result.current.setHidden(id, true));
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

  it("draws the day's occurrences, less what the Skipped switch hides (FR-361)", () => {
    const { result } = renderBoard(optionsOf());

    // The expander still produced the skipped chore (R315); the filter layer,
    // whose Skipped switch starts OFF, is what leaves it off the board.
    expect(result.current.occurrences.map((one) => [one.taskId, one.slot, one.state])).toEqual([
      [ROUTINE, "morning", "complete"],
      [ROUTINE, "evening", "unresolved"],
      [GRABS, null, "unresolved"],
    ]);
    const [expanded] = vi.mocked(visibleTaskOccurrences).mock.calls[0];
    expect(expanded.map((one) => one.taskId)).toContain(CHORE);
  });

  it("reveals the skipped one, and only it, when the switch goes on (US3-6)", () => {
    const { result } = renderBoard(optionsOf());
    setSwitch("skipped", true);

    expect(result.current.occurrences.map((one) => [one.taskId, one.slot, one.state])).toEqual([
      [ROUTINE, "morning", "complete"],
      [ROUTINE, "evening", "unresolved"],
      [CHORE, null, "skipped"],
      [GRABS, null, "unresolved"],
    ]);
  });
});

/**
 * T068 — the standing assertion. The filter layer sits BELOW the counter
 * branch, so every one of these cases proves the same structural fact twice:
 * the drawn list moved, and the numbers did not.
 */
describe("useBoardOccurrences — the filter layer, below the counters (T068)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubReads();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("reads both per-device stores and the query as ONE call (R319)", () => {
    setSwitch("skipped", true);
    hideProfile(BEN);
    renderBoard(optionsOf({ query: "brush" }));

    expect(vi.mocked(visibleTaskOccurrences)).toHaveBeenCalledTimes(1);
    const [, hiddenIds, filters, query] = vi.mocked(visibleTaskOccurrences).mock.calls[0];
    expect([...hiddenIds]).toEqual([BEN]);
    expect(filters).toEqual({ completed: true, late: true, skipped: true, upForGrabs: true });
    expect(query).toBe("brush");
  });

  it("treats an unsupplied query as no query at all", () => {
    renderBoard(optionsOf());

    expect(vi.mocked(visibleTaskOccurrences).mock.calls[0][3]).toBe("");
  });

  it("re-runs one memo on a switch, and cannot reach the counters (FR-384, SC-310)", () => {
    const { result } = renderBoard(optionsOf());
    const counters = result.current.counters;
    const expansions = vi.mocked(expandTaskDay).mock.calls.length;

    setSwitch("completed", false);

    expect(result.current.occurrences.map((one) => one.state)).toEqual([
      "unresolved",
      "unresolved",
    ]);
    expect(vi.mocked(expandTaskDay).mock.calls.length).toBe(expansions);
    expect(result.current.counters).toBe(counters);
    expect(result.current.counters.column(ANA)).toEqual({ complete: 1, total: 2 });
    expect(result.current.counters.upForGrabs).toBe(1);
  });

  it("re-runs one memo on a typed query, and cannot reach the counters (FR-386, SC-320)", () => {
    const { result, rerender } = renderBoard(optionsOf());
    const counters = result.current.counters;
    const expansions = vi.mocked(expandTaskDay).mock.calls.length;

    rerender(optionsOf({ query: "cat" }));

    // Search reaches every column, Up for Grabs included, and finds it there.
    expect(result.current.occurrences.map((one) => one.taskId)).toEqual([GRABS]);
    expect(vi.mocked(expandTaskDay).mock.calls.length).toBe(expansions);
    expect(result.current.counters).toBe(counters);
    expect(result.current.counters.column(ANA)).toEqual({ complete: 1, total: 2 });
    expect(result.current.counters.upForGrabs).toBe(1);
  });

  it("re-runs one memo when a Profile is hidden, and cannot reach the counters", () => {
    const { result } = renderBoard(optionsOf());
    const counters = result.current.counters;

    hideProfile(ANA);

    expect(result.current.occurrences.map((one) => one.taskId)).toEqual([GRABS]);
    expect(result.current.counters).toBe(counters);
    expect(result.current.counters.column(ANA)).toEqual({ complete: 1, total: 2 });
  });

  it("hides the Up for Grabs column's cards without moving its count (FR-308)", () => {
    const { result } = renderBoard(optionsOf());

    setSwitch("upForGrabs", false);

    expect(result.current.occurrences.map((one) => one.taskId)).toEqual([ROUTINE, ROUTINE]);
    expect(result.current.counters.upForGrabs).toBe(1);
  });

  it("clears every filter back to the whole day from one Show all", () => {
    const { result } = renderBoard(optionsOf());
    setSwitch("completed", false);

    const { result: store } = renderHook(() => useTaskFilters());
    act(() => store.current.showAll());

    expect(result.current.occurrences.map((one) => one.taskId)).toEqual([
      ROUTINE,
      ROUTINE,
      CHORE,
      GRABS,
    ]);
  });

  it("keeps the filtered list's identity while nothing filterable changes", () => {
    const { result, rerender } = renderBoard(optionsOf());
    const first = result.current.occurrences;

    rerender(optionsOf());

    expect(result.current.occurrences).toBe(first);
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

  it("names the two lists apart, so neither can be mistaken for the other", () => {
    // R317 as a shape. The drawn slice and the whole day are BOTH returned,
    // because the columns own numbers this hook cannot pre-compute for them —
    // FR-305's ring and FR-312's indicator are per Profile, FR-308's count is
    // the Up for Grabs column's — and the only defence against one of them
    // counting the filtered list is that the filtered list is not called
    // "all". `TasksBoard.test.tsx` holds the standing board-level assertion
    // that no number moves under a filter or a query.
    const { result } = renderBoard(optionsOf({ query: "cat" }));

    expect(Object.keys(result.current)).toEqual([
      "occurrences",
      "allOccurrences",
      "counters",
      "isPending",
      "error",
    ]);
    expect(result.current.occurrences.map((one) => one.taskId)).toEqual([GRABS]);
    expect(result.current.allOccurrences.map((one) => one.taskId)).toEqual([
      ROUTINE,
      ROUTINE,
      CHORE,
      GRABS,
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
