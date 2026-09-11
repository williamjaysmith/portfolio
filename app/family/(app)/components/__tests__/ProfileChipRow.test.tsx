import { act, render, renderHook, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { localDateOf } from "@/lib/family/calendar/dates";
import { PALETTE } from "@/lib/family/colors";
import {
  useTaskCarryForward,
  useTaskCursors,
  useTaskResolutions,
  useTasks,
} from "@/lib/family/queries";
import { columnCountersOf, type TaskCounters } from "@/lib/family/tasks/counters";
import { expandTaskDay } from "@/lib/family/tasks/expand";
import type { Task, TaskAssignee, TaskResolution } from "@/lib/family/types";

import {
  resetCountdownSwitches,
  useCountdownSwitches,
} from "../../calendar/components/useCountdownSwitches";
import { ProfileChip } from "../ProfileChip";
import { ProfileChipRow } from "../ProfileChipRow";
import { makeCategory, makeContext, withFamily } from "./family-test-utils";

/**
 * The reads are stubbed at `lib/family/queries`, the shipped board-test idiom,
 * so no query client and no network is involved. `ProfileChipRow` mounts them
 * now that the counts live on the chips (014), which is why every row test
 * needs this and none did before.
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

/**
 * The counts are behind a per-device switch again (the Filter sheet's **Task
 * progress**), off by default — so a test that wants a count has to ask for it
 * exactly as a reader does. Done through the hook's own setter rather than by
 * writing localStorage, so the store's shape stays the store's business.
 */
function switchCountsOn(): void {
  const { result } = renderHook(() => useCountdownSwitches());
  act(() => result.current.set("taskProgress", true));
}

const ZONE = "America/Chicago";
const HOUSEHOLD = "household-1";
const ANA = "11111111-1111-4111-8111-111111111111";
const CLEO = "22222222-2222-4222-8222-222222222222";
const TASK_READS = [useTasks, useTaskResolutions, useTaskCarryForward, useTaskCursors];

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

function taskOf(id: string, categoryId: string, summary: string, startsOn: string): Task {
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
    startsOn,
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

function stub(hook: unknown, data: unknown): void {
  (hook as Mock).mockReturnValue({ data, isPending: false, error: null });
}

/**
 * Every row test needs the reads to answer SOMETHING, because the row mounts
 * them now. An empty household of chores is the right default: it exercises the
 * counting path without any test that is not about counts having to care.
 */
beforeEach(() => {
  for (const hook of TASK_READS) stub(vi.mocked(hook), []);
  resetCountdownSwitches();
  localStorage.clear();
});

/**
 * FR-032/FR-036/FR-039/FR-911/FR-912: each chip is the person's face on their
 * own colour, with today's chore count in the pill's lighter body where the
 * NAME used to be. The operator asked for that on 2026-09-10 — "we know who it
 * is" — and for 009's separate Tasks Progress row to go with it.
 *
 * The name is `sr-only` rather than gone: `Avatar` is `aria-hidden`, so
 * dropping it altogether would leave the chip announcing a bare "1/4" and the
 * row a focus stop saying nothing about who is in it (SC-009), and colour would
 * become the only carrier (FR-039).
 */
describe("ProfileChip", () => {
  const counters = (complete: number, total: number): TaskCounters => ({ complete, total });

  it("sets the profile colour once, for both tints to derive from", () => {
    const category = makeCategory({ label: "Sam", color: PALETTE[8] });
    const { container } = render(<ProfileChip category={category} counters={counters(1, 4)} />);

    const chip = container.querySelector(".fam-profile");
    expect(chip).toHaveStyle({ "--profile": PALETTE[8] });
    expect(container.querySelector(".fam-tint-40")).toBeInTheDocument();
    expect(container.querySelector(".fam-tint-100")).toBeInTheDocument();
  });

  it("draws the count where the name used to be, and names the person only for a screen reader", () => {
    const category = makeCategory({ label: "Sam", avatarKind: "illustration", avatarId: "fox" });
    const { container } = render(<ProfileChip category={category} counters={counters(1, 4)} />);

    const name = screen.getByText("Sam");
    expect(name.className).toContain("sr-only");
    expect(screen.getByText("1/4")).toBeInTheDocument();
    // The whole chip reads "Sam" then "1/4" and nothing else — no visible name.
    expect(container.textContent).toBe("Sam1/4");
  });

  /**
   * The slot is reserved from the first paint (--fam-chip-count-w). A chip that
   * showed nothing and then grew would shift every chip to its right, which is
   * the layout shift 012 spent the phone's CLS budget removing.
   */
  it("reserves the count's slot before the clock and the reads land", () => {
    const category = makeCategory({ label: "Sam", avatarKind: "illustration", avatarId: "fox" });
    const { container } = render(<ProfileChip category={category} counters={null} />);

    const slot = container.querySelector("[aria-hidden='true'].box-content");
    expect(slot).toBeInTheDocument();
    expect(slot?.className).toContain("w-(--fam-chip-count-w)");
    expect(screen.queryByText(/\d+\/\d+/)).not.toBeInTheDocument();
  });

  it("falls back to initials when there is no avatar", () => {
    render(<ProfileChip category={makeCategory({ label: "Alex Smith" })} counters={null} />);
    expect(screen.getByText("AS")).toBeInTheDocument();
  });

  /**
   * With **Task progress** off the chip is the bare circle: no body, no slot,
   * and no 40 % tint — a pill tint behind a circle shows as a faint square halo
   * at the circle's corners.
   *
   * `undefined` and `null` mean different things here and the distinction is
   * load-bearing: `null` reserves the slot because a count is coming, while
   * `undefined` says none ever will.
   */
  it("is just the circle when this device wants no count", () => {
    const category = makeCategory({ label: "Sam", avatarKind: "illustration", avatarId: "fox" });
    const { container } = render(<ProfileChip category={category} />);

    expect(container.querySelector("[aria-hidden='true'].box-content")).toBeNull();
    expect(container.querySelector(".fam-tint-40")).toBeNull();
    // The name survives: without it a countless chip announces as nothing at
    // all, since `Avatar` is deliberately aria-hidden (FR-039, SC-009).
    expect(screen.getByText("Sam").className).toContain("sr-only");
    expect(container.textContent).toBe("Sam");
  });

  /**
   * The cap is SQUARE — one token for both axes — which is what makes it a
   * circle at any text scale, and what stopped a photograph squaring off
   * against the straight cap edge the operator reported from their phone.
   */
  it("clips the face inside a circle the chip's own height across", () => {
    const category = makeCategory({ label: "Sam", avatarKind: "illustration", avatarId: "fox" });
    const { container } = render(<ProfileChip category={category} counters={counters(1, 4)} />);

    const cap = container.querySelector(".fam-tint-100");
    expect(cap?.className).toContain("h-(--fam-chip-h)");
    expect(cap?.className).toContain("w-(--fam-chip-h)");
    expect(cap?.className).toContain("rounded-full");
    expect(cap?.className).toContain("overflow-hidden");
  });
});

describe("ProfileChipRow", () => {
  const alex = makeCategory({ id: "a", label: "Alex" });
  const kit = makeCategory({ id: "k", label: "Kit", role: "member" });

  it("prompts a parent to add the family when nobody exists (spec edge case)", () => {
    render(withFamily(makeContext({ categories: [] }), <ProfileChipRow />));
    expect(screen.getByText(/Nobody.s here yet/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "add the family in Settings" })).toBeInTheDocument();
  });

  it("renders a chip per profile", () => {
    const context = makeContext({ categories: [alex, kit] });
    render(withFamily(context, <ProfileChipRow />));

    expect(screen.getByText("Alex")).toBeInTheDocument();
    expect(screen.getByText("Kit")).toBeInTheDocument();
  });

  /**
   * SC-009: this is the one region in the shell that scrolls sideways. On a
   * phone the people past the right edge can only be reached by scrolling it,
   * so it has to be able to take focus — and to say what it is when it does.
   */
  it("is a named region the keyboard can reach and scroll", () => {
    const context = makeContext({ categories: [alex, kit] });
    render(withFamily(context, <ProfileChipRow />));

    const scroller = screen.getByRole("group", { name: "Family" });
    expect(scroller).toHaveAttribute("tabindex", "0");
    expect(scroller.className).toContain("overflow-x-auto");
  });

  it("leaves out profiles hidden on this device (FR-033)", () => {
    const context = makeContext({
      categories: [alex, kit],
      hiddenIds: new Set(["k"]),
      visibleProfiles: [alex],
    });
    render(withFamily(context, <ProfileChipRow />));

    expect(screen.getByText("Alex")).toBeInTheDocument();
    expect(screen.queryByText("Kit")).not.toBeInTheDocument();
  });

  it("does not put labels in the chip row", () => {
    const holidays = makeCategory({ id: "h", label: "Holidays", isProfile: false, emoji: "🎉" });
    const context = makeContext({ categories: [alex, holidays] });
    render(withFamily(context, <ProfileChipRow />));

    expect(screen.queryByText("Holidays")).not.toBeInTheDocument();
  });
});

/**
 * 009's T041/T042 guarantees, moved with the counts (FR-911, FR-912, SC-907,
 * SC-908). They were `TasksProgressRow`'s and that component is gone; the two
 * claims are unchanged and a second implementation would still silently break
 * them, so they are asserted here rather than retired.
 *
 * The day is the real clock's, because `ProfileChipRow` derives today from
 * `useNow` — so the fixtures are anchored to it rather than to a fixed date.
 */
describe("the counts on the chips (009 FR-911, FR-912)", () => {
  const today = localDateOf(ZONE, Date.now());
  /** Ana has three chores today, Cleo one; Ana finished one of hers. */
  const TASKS: Task[] = [
    taskOf("task-1", ANA, "Feed the cat", today),
    taskOf("task-2", ANA, "Homework", today),
    taskOf("task-3", ANA, "Tidy room", today),
    taskOf("task-4", CLEO, "Take out trash", today),
  ];
  const RESOLUTIONS: TaskResolution[] = [
    {
      id: "res-1",
      householdId: HOUSEHOLD,
      taskId: "task-1",
      occurrenceDate: today,
      occurrenceSlot: null,
      assigneeId: ANA,
      categoryId: ANA,
      cyclePrev: null,
      status: "complete",
      resolvedOn: today,
      resolvedAt: `${today}T14:00:00.000Z`,
      createdBy: ANA,
      createdAt: `${today}T14:00:00.000Z`,
    },
  ];

  const ana = makeCategory({ id: ANA, label: "Ana", sortOrder: 1000 });
  const cleo = makeCategory({ id: CLEO, label: "Cleo", role: "member", sortOrder: 2000 });

  /** What the Tasks board itself would say for the same fixtures (FR-912). */
  function boardCountersFor(profileId: string): string {
    const occurrences = expandTaskDay(TASKS, RESOLUTIONS, [], {
      displayedDate: today,
      todayDate: today,
      zone: ZONE,
    });
    const counters = columnCountersOf(occurrences, profileId);
    return `${counters.complete}/${counters.total}`;
  }

  beforeEach(() => {
    stub(vi.mocked(useTasks), TASKS);
    stub(vi.mocked(useTaskResolutions), RESOLUTIONS);
    stub(vi.mocked(useTaskCarryForward), []);
    stub(vi.mocked(useTaskCursors), []);
    switchCountsOn();
  });

  it("reports EXACTLY what the Tasks board's own counters say (FR-912, SC-907)", () => {
    render(
      withFamily(
        makeContext({
          householdId: HOUSEHOLD,
          categories: [ana, cleo],
        }),
        <ProfileChipRow />,
      ),
    );

    // Derived, never hard-coded: if a second counting rule ever appears, this
    // test fails rather than agreeing with it.
    expect(screen.getByText(boardCountersFor(ANA))).toBeInTheDocument();
    expect(screen.getByText(boardCountersFor(CLEO))).toBeInTheDocument();
    // And the board says 1/3 and 0/1 for these fixtures.
    expect(boardCountersFor(ANA)).toBe("1/3");
    expect(boardCountersFor(CLEO)).toBe("0/1");
  });

  it("drops a hidden Profile's count with the Profile (FR-911, SC-908)", () => {
    render(
      withFamily(
        makeContext({
          householdId: HOUSEHOLD,
          categories: [ana, cleo],
          hiddenIds: new Set([CLEO]),
          visibleProfiles: [ana],
        }),
        <ProfileChipRow />,
      ),
    );

    expect(screen.getByText("1/3")).toBeInTheDocument();
    expect(screen.queryByText("0/1")).toBeNull();
  });

  it("reads a Profile with no chores as none rather than as complete", () => {
    const ben = makeCategory({
      id: "33333333-3333-4333-8333-333333333333",
      label: "Ben",
      sortOrder: 3000,
    });
    render(
      withFamily(
        makeContext({ householdId: HOUSEHOLD, categories: [ben] }),
        <ProfileChipRow />,
      ),
    );

    expect(screen.getByText("0/0")).toBeInTheDocument();
  });
});

/**
 * R905's mount rule survives 014, but what mounts the reads changed: it was the
 * per-device Tasks Progress switch and it is now the household clock. The claim
 * still worth pinning is the negative one — nothing issues a task read unless
 * the counting child is on screen.
 */
describe("mounting is the `enabled` (R905)", () => {
  it("issues no task read when the chip row is not rendered", () => {
    for (const hook of TASK_READS) (hook as Mock).mockClear();

    render(
      withFamily(
        makeContext({ householdId: HOUSEHOLD, categories: [makeCategory({ id: ANA })] }),
        <div />,
      ),
    );

    for (const hook of TASK_READS) expect(hook as Mock).not.toHaveBeenCalled();
  });

  it("issues no task read while this device has the counts switched off", () => {
    for (const hook of TASK_READS) (hook as Mock).mockClear();

    render(
      withFamily(
        makeContext({
          householdId: HOUSEHOLD,
          categories: [makeCategory({ id: ANA, label: "Ana" })],
        }),
        <ProfileChipRow />,
      ),
    );

    // The faces are on screen; the counts are not asked for. This is what makes
    // the switch worth more than a preference — the row is in the SHELL, so a
    // read issued here is a read paid for on Lists and Meals too.
    expect(screen.getByText("Ana")).toBeInTheDocument();
    for (const hook of TASK_READS) expect(hook as Mock).not.toHaveBeenCalled();
  });

  it("issues them the moment the counts are switched on", () => {
    for (const hook of TASK_READS) {
      (hook as Mock).mockClear();
      stub(vi.mocked(hook), []);
    }
    switchCountsOn();

    render(
      withFamily(
        makeContext({
          householdId: HOUSEHOLD,
          categories: [makeCategory({ id: ANA })],
        }),
        <ProfileChipRow />,
      ),
    );

    for (const hook of TASK_READS) expect(hook as Mock).toHaveBeenCalled();
  });
});
