import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Category, Task, TaskAssignee, TaskResolution, TimeOfDay } from "@/lib/family/types";

import {
  prevWeekStartOf,
  resetWeekCelebrations,
  useWeekCelebrations,
  type UseWeekCelebrationsOptions,
} from "@/app/family/(app)/tasks/components/useWeekCelebrations";

/**
 * 004 T049 — FR-440 / SC-415 / R408: on the household week's rollover, every
 * tracked routine × assignee is judged over the PREVIOUS week with
 * `weekVerdictOf`, the denominator being the routine's own scheduled days
 * (`scheduledDaysInWeek`, through `family-tasks-core`) and a day reading as
 * completed only when every occurrence of that routine for that person on it
 * is complete; a skipped day is neither completed nor missed.
 *
 * One message at a time, Profile-major in household order; `dismiss()` advances
 * the queue and remembers the key per device under
 * `family:week-celebrations:v1` — a small bounded store, oldest evicted, with an
 * in-memory fallback when storage refuses — so each message shows once per
 * device. The judgement waits for the previous week's read to settle and is
 * re-run when the week start changes.
 */

const ZONE = "America/Chicago";
const HOUSEHOLD = "00000000-0000-4000-8000-000000000000";
const STORAGE_KEY = "family:week-celebrations:v1";
/** The documented bound of the shown-keys store. */
const MAX_SHOWN_KEYS = 200;

const ANA = "11111111-1111-4111-8111-111111111111";
const BEN = "22222222-2222-4222-8222-222222222222";
const CLEO = "33333333-3333-4333-8333-333333333333";
const CHORES_LABEL = "44444444-4444-4444-8444-444444444444";

const BRUSH = "brush-teeth";
const READ = "read-a-book";

/** Sunday-start weeks (startWeekOn 0). The live week begins on the 6th. */
const THIS_WEEK = "2026-09-06";
const PREV_WEEK = "2026-08-30";
const PREV_DAYS = [
  "2026-08-30",
  "2026-08-31",
  "2026-09-01",
  "2026-09-02",
  "2026-09-03",
  "2026-09-04",
  "2026-09-05",
];
const NEXT_WEEK = "2026-09-13";
const THIS_DAYS = [
  "2026-09-06",
  "2026-09-07",
  "2026-09-08",
  "2026-09-09",
  "2026-09-10",
  "2026-09-11",
  "2026-09-12",
];

type WeekCategory = Pick<Category, "id" | "label" | "isProfile">;

function profile(id: string, label: string): WeekCategory {
  return { id, label, isProfile: true };
}

const CATEGORIES: WeekCategory[] = [
  profile(ANA, "Ana"),
  profile(BEN, "Ben"),
  profile(CLEO, "Cleo"),
  { id: CHORES_LABEL, label: "Chores", isProfile: false },
];

function assignee(taskId: string, categoryId: string): TaskAssignee {
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

function routine(id: string, summary: string, overrides: Partial<Task> = {}): Task {
  return {
    id,
    householdId: HOUSEHOLD,
    summary,
    description: null,
    emoji: null,
    routine: true,
    upForGrabs: false,
    trackHabit: true,
    startsOn: "2026-08-01",
    dueTime: null,
    timesOfDay: ["morning"],
    rrule: "FREQ=DAILY;INTERVAL=1",
    renewAfterAmount: null,
    renewAfterUnit: null,
    renewUntil: null,
    rewardPoints: null,
    assignees: [assignee(id, ANA)],
    createdBy: null,
    updatedBy: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

let nextId = 0;

function resolved(
  taskId: string,
  profileId: string,
  date: string,
  status: "complete" | "skipped",
  slot: TimeOfDay | null = "morning",
): TaskResolution {
  nextId += 1;
  return {
    id: `res-${nextId}`,
    householdId: HOUSEHOLD,
    taskId,
    occurrenceDate: date,
    occurrenceSlot: slot,
    assigneeId: profileId,
    categoryId: status === "complete" ? profileId : null,
    cyclePrev: null,
    status,
    resolvedOn: date,
    resolvedAt: `${date}T12:00:00.000Z`,
    createdBy: profileId,
    createdAt: `${date}T12:00:00.000Z`,
  };
}

/** Every listed day complete for one routine and one person. */
function completedOn(taskId: string, profileId: string, days: readonly string[]): TaskResolution[] {
  return days.map((day) => resolved(taskId, profileId, day, "complete"));
}

function options(overrides: Partial<UseWeekCelebrationsOptions> = {}): UseWeekCelebrationsOptions {
  return {
    zone: ZONE,
    weekStartDate: THIS_WEEK,
    startWeekOn: 0,
    prevWeekResolutions: [],
    tasks: [routine(BRUSH, "Brush teeth")],
    categories: CATEGORIES,
    ...overrides,
  };
}

function storedKeys(): unknown {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw === null ? null : JSON.parse(raw);
}

describe("prevWeekStartOf — the week the board fetches and the hook judges", () => {
  it("is seven days before the household week holding the given day", () => {
    expect(prevWeekStartOf(THIS_WEEK, 0)).toBe(PREV_WEEK);
    expect(prevWeekStartOf("2026-09-09", 0)).toBe(PREV_WEEK); // a Wednesday of the live week
    expect(prevWeekStartOf("2026-09-09", 1)).toBe("2026-08-31"); // Monday-start weeks
  });
});

describe("useWeekCelebrations — the verdict (FR-440, SC-415)", () => {
  beforeEach(() => {
    localStorage.clear();
    resetWeekCelebrations();
  });

  it("shows Amazing Week when every scheduled day of the previous week was completed", () => {
    const { result } = renderHook(() =>
      useWeekCelebrations(options({ prevWeekResolutions: completedOn(BRUSH, ANA, PREV_DAYS) })),
    );

    expect(result.current.message).toEqual({
      key: `${BRUSH}:${ANA}:${PREV_WEEK}`,
      verdict: "amazing",
      profileName: "Ana",
      routineName: "Brush teeth",
      weekStart: PREV_WEEK,
    });
  });

  it("shows Strong Week when exactly one scheduled day was missed", () => {
    const { result } = renderHook(() =>
      useWeekCelebrations(
        options({ prevWeekResolutions: completedOn(BRUSH, ANA, PREV_DAYS.slice(1)) }),
      ),
    );

    expect(result.current.message?.verdict).toBe("strong");
  });

  it("shows nothing when two days were missed", () => {
    const { result } = renderHook(() =>
      useWeekCelebrations(
        options({ prevWeekResolutions: completedOn(BRUSH, ANA, PREV_DAYS.slice(2)) }),
      ),
    );

    expect(result.current.message).toBeNull();
  });

  it("reads a skipped day as neither: one skipped and the rest completed is Amazing", () => {
    const { result } = renderHook(() =>
      useWeekCelebrations(
        options({
          prevWeekResolutions: [
            resolved(BRUSH, ANA, PREV_DAYS[0], "skipped"),
            ...completedOn(BRUSH, ANA, PREV_DAYS.slice(1)),
          ],
        }),
      ),
    );

    expect(result.current.message?.verdict).toBe("amazing");
  });

  it("counts a day completed only when EVERY slot that day is complete", () => {
    const twoSlots = routine(BRUSH, "Brush teeth", { timesOfDay: ["morning", "evening"] });
    const bothSlots = PREV_DAYS.flatMap((day) => [
      resolved(BRUSH, ANA, day, "complete", "morning"),
      resolved(BRUSH, ANA, day, "complete", "evening"),
    ]);

    // Sunday's evening left undone: the day is missed, the week is Strong.
    const oneLeftOpen = bothSlots.filter(
      (row) => !(row.occurrenceDate === PREV_DAYS[0] && row.occurrenceSlot === "evening"),
    );
    const open = renderHook(() =>
      useWeekCelebrations(options({ tasks: [twoSlots], prevWeekResolutions: oneLeftOpen })),
    );
    expect(open.result.current.message?.verdict).toBe("strong");

    // Sunday's evening skipped instead: the day is skipped — neither — and the week is Amazing.
    const oneSkipped = [
      ...oneLeftOpen,
      resolved(BRUSH, ANA, PREV_DAYS[0], "skipped", "evening"),
    ];
    const skipped = renderHook(() =>
      useWeekCelebrations(options({ tasks: [twoSlots], prevWeekResolutions: oneSkipped })),
    );
    expect(skipped.result.current.message?.verdict).toBe("amazing");
  });

  it("judges the routine over its OWN scheduled days — one that began mid-week", () => {
    const fromThursday = routine(BRUSH, "Brush teeth", { startsOn: "2026-09-03" });
    const { result } = renderHook(() =>
      useWeekCelebrations(
        options({
          tasks: [fromThursday],
          prevWeekResolutions: completedOn(BRUSH, ANA, PREV_DAYS.slice(4)),
        }),
      ),
    );

    expect(result.current.message?.verdict).toBe("amazing");
  });

  it("judges tracked routines only — an untracked routine and a chore earn nothing", () => {
    const untracked = routine(BRUSH, "Brush teeth", { trackHabit: false });
    const chore = routine(READ, "Read a book", { routine: false, timesOfDay: [] });
    const { result } = renderHook(() =>
      useWeekCelebrations(
        options({
          tasks: [untracked, chore],
          prevWeekResolutions: [
            ...completedOn(BRUSH, ANA, PREV_DAYS),
            ...PREV_DAYS.map((day) => resolved(READ, ANA, day, "complete", null)),
          ],
        }),
      ),
    );

    expect(result.current.message).toBeNull();
  });

  it("skips an assignee who is not a Profile of the household — a Label, or one since deleted", () => {
    const shared = routine(BRUSH, "Brush teeth", {
      assignees: [assignee(BRUSH, CHORES_LABEL), assignee(BRUSH, "gone")],
    });
    const { result } = renderHook(() =>
      useWeekCelebrations(
        options({
          tasks: [shared],
          prevWeekResolutions: [
            ...completedOn(BRUSH, CHORES_LABEL, PREV_DAYS),
            ...completedOn(BRUSH, "gone", PREV_DAYS),
          ],
        }),
      ),
    );

    expect(result.current.message).toBeNull();
  });

  it("waits for the previous week's read to settle before judging", () => {
    const { result, rerender } = renderHook(
      (props: UseWeekCelebrationsOptions) => useWeekCelebrations(props),
      { initialProps: options({ prevWeekResolutions: undefined }) },
    );
    expect(result.current.message).toBeNull();

    rerender(options({ prevWeekResolutions: completedOn(BRUSH, ANA, PREV_DAYS) }));

    expect(result.current.message?.verdict).toBe("amazing");
  });

  it("anchors the week with startWeekOn, so a date inside the live week judges the same week", () => {
    const { result } = renderHook(() =>
      useWeekCelebrations(
        options({
          weekStartDate: "2026-09-09", // a Wednesday of the live week
          prevWeekResolutions: completedOn(BRUSH, ANA, PREV_DAYS),
        }),
      ),
    );

    expect(result.current.message?.weekStart).toBe(PREV_WEEK);
  });
});

describe("useWeekCelebrations — the queue and the per-device memory", () => {
  beforeEach(() => {
    localStorage.clear();
    resetWeekCelebrations();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /** Ana: Amazing on Brush, Strong on Read; Ben: Amazing on Brush; Cleo: nothing. */
  function threeMessages(): Partial<UseWeekCelebrationsOptions> {
    const brush = routine(BRUSH, "Brush teeth", {
      assignees: [assignee(BRUSH, ANA), assignee(BRUSH, BEN), assignee(BRUSH, CLEO)],
    });
    const read = routine(READ, "Read a book");
    return {
      tasks: [brush, read],
      prevWeekResolutions: [
        ...completedOn(BRUSH, ANA, PREV_DAYS),
        ...completedOn(READ, ANA, PREV_DAYS.slice(1)),
        ...completedOn(BRUSH, BEN, PREV_DAYS),
        ...completedOn(BRUSH, CLEO, PREV_DAYS.slice(3)),
      ],
    };
  }

  it("shows one message at a time, Profile-major in household order, and dismiss advances", () => {
    const { result } = renderHook(() => useWeekCelebrations(options(threeMessages())));

    expect(result.current.message).toMatchObject({ profileName: "Ana", routineName: "Brush teeth" });

    act(() => result.current.dismiss());
    expect(result.current.message).toMatchObject({
      profileName: "Ana",
      routineName: "Read a book",
      verdict: "strong",
    });

    act(() => result.current.dismiss());
    expect(result.current.message).toMatchObject({ profileName: "Ben", routineName: "Brush teeth" });

    act(() => result.current.dismiss());
    expect(result.current.message).toBeNull();
  });

  it("dismissing with nothing showing is a no-op", () => {
    const { result } = renderHook(() => useWeekCelebrations(options()));

    act(() => result.current.dismiss());

    expect(result.current.message).toBeNull();
    expect(storedKeys()).toBeNull();
  });

  it("remembers a dismissed key under family:week-celebrations:v1, so it shows once per device", () => {
    const first = renderHook(() =>
      useWeekCelebrations(options({ prevWeekResolutions: completedOn(BRUSH, ANA, PREV_DAYS) })),
    );
    act(() => first.result.current.dismiss());
    expect(storedKeys()).toEqual([`${BRUSH}:${ANA}:${PREV_WEEK}`]);
    first.unmount();

    // A reload: the module forgets, storage does not.
    resetWeekCelebrations();
    const second = renderHook(() =>
      useWeekCelebrations(options({ prevWeekResolutions: completedOn(BRUSH, ANA, PREV_DAYS) })),
    );

    expect(second.result.current.message).toBeNull();
  });

  it("is bounded: the oldest key is evicted once the store is full", () => {
    const old = Array.from({ length: MAX_SHOWN_KEYS }, (_, i) => `old:${i}`);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(old));

    const { result } = renderHook(() =>
      useWeekCelebrations(options({ prevWeekResolutions: completedOn(BRUSH, ANA, PREV_DAYS) })),
    );
    act(() => result.current.dismiss());

    const stored = storedKeys() as string[];
    expect(stored).toHaveLength(MAX_SHOWN_KEYS);
    expect(stored[0]).toBe("old:1");
    expect(stored.at(-1)).toBe(`${BRUSH}:${ANA}:${PREV_WEEK}`);
    expect(result.current.message).toBeNull();
  });

  it("treats a corrupt stored value as nothing shown, without crashing", () => {
    localStorage.setItem(STORAGE_KEY, "{not json");

    const { result } = renderHook(() =>
      useWeekCelebrations(options({ prevWeekResolutions: completedOn(BRUSH, ANA, PREV_DAYS) })),
    );

    expect(result.current.message?.verdict).toBe("amazing");
  });

  it("keeps working for the session when storage refuses the write", () => {
    vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    const { result } = renderHook(() => useWeekCelebrations(options(threeMessages())));

    act(() => result.current.dismiss());
    expect(result.current.message).toMatchObject({ routineName: "Read a book" });

    act(() => result.current.dismiss());
    act(() => result.current.dismiss());
    expect(result.current.message).toBeNull();
  });

  it("re-judges when the week rolls over — a new week is a new key", () => {
    const { result, rerender } = renderHook(
      (props: UseWeekCelebrationsOptions) => useWeekCelebrations(props),
      { initialProps: options({ prevWeekResolutions: completedOn(BRUSH, ANA, PREV_DAYS) }) },
    );
    act(() => result.current.dismiss());
    expect(result.current.message).toBeNull();

    // Midnight on Saturday: the live week is now the 13th's, and the previous
    // week's read is the 6th's — pending first, then settled.
    rerender(options({ weekStartDate: NEXT_WEEK, prevWeekResolutions: undefined }));
    expect(result.current.message).toBeNull();

    rerender(
      options({ weekStartDate: NEXT_WEEK, prevWeekResolutions: completedOn(BRUSH, ANA, THIS_DAYS) }),
    );
    expect(result.current.message).toEqual({
      key: `${BRUSH}:${ANA}:${THIS_WEEK}`,
      verdict: "amazing",
      profileName: "Ana",
      routineName: "Brush teeth",
      weekStart: THIS_WEEK,
    });
  });
});
