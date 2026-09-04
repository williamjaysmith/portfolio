import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
  type MockedFunction,
} from "vitest";

import { completeTaskOccurrence } from "@/lib/family/actions/tasks";
import { PALETTE } from "@/lib/family/colors";
import { fail } from "@/lib/family/errors";
import {
  useTaskCarryForward,
  useTaskCursors,
  useTaskResolutions,
  useTasks,
} from "@/lib/family/queries";
import type {
  BoardOccurrence,
  Category,
  Task,
  TaskAssignee,
  TaskResolution,
  TimeOfDay,
} from "@/lib/family/types";

import { FabActionProvider, useFabAction } from "../../../components/FabAction";
import type { FamilyContextValue } from "../../../components/FamilyProvider";
import {
  makeCategory,
  makeContext,
  stubDialog,
  withFamily,
} from "../../../components/__tests__/family-test-utils";
import {
  boardColumnsOf,
  boardNoticeOf,
  boardSeedsOf,
  TasksBoard,
  type TasksBoardProps,
} from "../TasksBoard";
import { UP_FOR_GRABS_COLUMN_ID } from "../UpForGrabsColumn";

/**
 * T046 — the board orchestrator: the anchor, the geometry, the memo chain, the
 * toggles and the one resolve path, assembled.
 *
 * The four reads are stubbed and everything below them runs for real, so what
 * this file proves is the wiring rather than the expansion (which is
 * `tasks-expand.test.ts`'s) or the counters (`tasks-counters.test.ts`'s):
 *
 *   - Up for Grabs first, then one column per Profile shown on this tab, and
 *     none at all for a Profile whose Show on Tasks switch is off (FR-301,
 *     FR-308, FR-313);
 *   - Previous / Today / Next opening on today (FR-303);
 *   - a tap on the circle reaching the one `withActor` write, and a tap on the
 *     card BODY opening details instead (FR-348, FR-352);
 *   - a refusal shown in the household's words and nothing painted (FR-351,
 *     FR-393);
 *   - the column a claim lands in agreeing with the count above it, which is
 *     the one place the membership rule could drift from `columnCountersOf`
 *     (R318, FR-367).
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

vi.mock("@/lib/family/actions/tasks", () => ({
  completeTaskOccurrence: vi.fn(),
  unresolveTaskOccurrence: vi.fn(),
}));

const completeMock = completeTaskOccurrence as Mock;

const HOUSEHOLD = "household-1";
/** Friday 2026-09-04, 13:00 in the household's zone — the Afternoon window. */
const NOW = new Date("2026-09-04T18:00:00Z");
const TODAY = "2026-09-04";
const TODAY_IN_WORDS = "Friday, September 4, 2026";
const YESTERDAY_IN_WORDS = "Thursday, September 3, 2026";

const CLEO = "11111111-1111-4111-8111-111111111111";
const BEN = "33333333-3333-4333-8333-333333333333";
const ANA = "44444444-4444-4444-8444-444444444444";
const DANA = "55555555-5555-4555-8555-555555555555";

const CAT_CHORE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const BIN_CHORE = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const GRABS_CHORE = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const ROUTINE = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const HIDDEN_CHORE = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

function profile(id: string, label: string, overrides: Partial<Category> = {}): Category {
  return makeCategory({ id, label, color: PALETTE[1], role: "member", ...overrides });
}

/** Dana is on the household but switched off for this tab (FR-313). */
const CATEGORIES: Category[] = [
  profile(CLEO, "Cleo"),
  profile(BEN, "Ben"),
  profile(ANA, "Ana", { role: "parent" }),
  profile(DANA, "Dana", { showOnTasks: false }),
  makeCategory({ id: "label-bins", label: "Bin day", isProfile: false }),
];

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
    summary: "Feed the cat",
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
    assignees: [assigneeOf(overrides.id, CLEO)],
    createdBy: null,
    updatedBy: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const FIXTURE_TASKS: Task[] = [
  taskOf({ id: CAT_CHORE, summary: "Feed the cat", description: "Half a tin." }),
  taskOf({
    id: BIN_CHORE,
    summary: "Take out trash",
    assignees: [assigneeOf(BIN_CHORE, BEN)],
  }),
  taskOf({
    id: GRABS_CHORE,
    summary: "Empty the dishwasher",
    upForGrabs: true,
    assignees: [],
  }),
  taskOf({
    id: HIDDEN_CHORE,
    summary: "Water the plants",
    assignees: [assigneeOf(HIDDEN_CHORE, DANA)],
  }),
  taskOf({
    id: ROUTINE,
    summary: "Brush teeth",
    routine: true,
    timesOfDay: ["morning"],
    rrule: "FREQ=DAILY;INTERVAL=1",
    startsOn: "2026-08-01",
  }),
];

/** Ben claimed the household's up-for-grabs chore (FR-367). */
const CLAIM: TaskResolution = {
  id: "res-claim",
  householdId: HOUSEHOLD,
  taskId: GRABS_CHORE,
  occurrenceDate: TODAY,
  occurrenceSlot: null,
  assigneeId: null,
  categoryId: BEN,
  cyclePrev: null,
  status: "complete",
  resolvedOn: TODAY,
  resolvedAt: `${TODAY}T12:00:00.000Z`,
  createdBy: BEN,
  createdAt: `${TODAY}T12:00:00.000Z`,
};

interface QueryStub<T> {
  data?: T;
  isPending?: boolean;
  error?: Error | null;
}

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

function stubReads(resolutions: TaskResolution[] = []): void {
  stub(vi.mocked(useTasks), { data: FIXTURE_TASKS });
  stub(vi.mocked(useTaskResolutions), { data: resolutions });
  stub(vi.mocked(useTaskCarryForward), { data: [] });
  stub(vi.mocked(useTaskCursors), { data: [] });
}

function boardProps(overrides: Partial<TasksBoardProps> = {}): TasksBoardProps {
  return {
    initialDate: TODAY,
    initialWindow: "afternoon" satisfies TimeOfDay,
    initialTasks: FIXTURE_TASKS,
    initialResolutions: [],
    initialCarry: [],
    initialCursors: [],
    ...overrides,
  };
}

/** Reads back whatever the mounted board registered with the shell's FAB. */
function FabProbe() {
  const action = useFabAction();
  return <p data-testid="fab">{action === null ? "none" : action.label}</p>;
}

function renderBoard(options: { context?: Partial<FamilyContextValue> } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const context = makeContext({ categories: CATEGORIES, ...options.context });
  const view = render(
    <QueryClientProvider client={client}>
      {withFamily(
        context,
        <FabActionProvider>
          <TasksBoard {...boardProps()} />
          <FabProbe />
        </FabActionProvider>,
      )}
    </QueryClientProvider>,
  );
  return { ...view, client };
}

/** The columns in the order the board draws them. */
function columnIds(): string[] {
  return Array.from(document.querySelectorAll("[data-column]")).map(
    (column) => column.getAttribute("data-column") ?? "",
  );
}

function column(name: string): HTMLElement {
  return screen.getByRole("region", { name });
}

async function press(name: string): Promise<void> {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name }));
  });
}

beforeAll(() => {
  stubDialog();
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  stubReads();
  completeMock.mockResolvedValue({ ok: true, data: null });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("TasksBoard", () => {
  it("draws Up for Grabs first, then a column per Profile shown on this tab", () => {
    renderBoard();

    // Dana's Show on Tasks switch is off, so she has no column on any device
    // (FR-313); the Label is not a person and never had one (FR-323).
    expect(columnIds()).toEqual([UP_FOR_GRABS_COLUMN_ID, CLEO, BEN, ANA]);
    expect(screen.queryByRole("region", { name: "Dana" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Bin day" })).not.toBeInTheDocument();
    // Her task keeps existing; it is simply drawn nowhere, and never in
    // somebody else's column.
    expect(screen.queryByText("Water the plants")).not.toBeInTheDocument();
  });

  it("stretches the columns on show to share the board (FR-394)", () => {
    renderBoard();
    // Unmeasured, the board still draws every column it has, in equal tracks:
    // `--fam-task-col-w` is what the fit divides by, never a drawn width.
    expect(document.querySelector("[data-board]")?.getAttribute("style")).toContain(
      "repeat(4, minmax(0, 1fr))",
    );
    expect(column("Cleo").className).toContain("w-full");
  });

  it("holds only that Profile's own tasks (US1-1)", () => {
    renderBoard();

    expect(within(column("Cleo")).getByText("Feed the cat")).toBeInTheDocument();
    expect(within(column("Cleo")).queryByText("Take out trash")).not.toBeInTheDocument();
    expect(within(column("Ben")).getByText("Take out trash")).toBeInTheDocument();
    expect(
      within(column("Up for Grabs")).getByText("Empty the dishwasher"),
    ).toBeInTheDocument();
  });

  it("opens on today and steps one day at a time (FR-303)", async () => {
    renderBoard();
    expect(screen.getByText(TODAY_IN_WORDS)).toBeInTheDocument();

    await press("Previous day");
    expect(screen.getByText(YESTERDAY_IN_WORDS)).toBeInTheDocument();

    await press("Today");
    expect(screen.getByText(TODAY_IN_WORDS)).toBeInTheDocument();
  });

  it("shows the clock's own section and keeps the others behind their toggles (US1-2)", async () => {
    renderBoard();
    const cleo = column("Cleo");

    // 13:00 is Afternoon, so the morning routine is hidden until its own
    // toggle is switched on — and only in this column (FR-306, FR-307).
    expect(within(cleo).queryByText("Brush teeth")).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.click(within(cleo).getByRole("button", { name: "Morning" }));
    });

    expect(within(column("Cleo")).getByText("Brush teeth")).toBeInTheDocument();
    expect(within(column("Ben")).queryByText("Brush teeth")).not.toBeInTheDocument();
  });

  it("sends a circle tap through the one commit path (FR-348, R323)", async () => {
    renderBoard();

    await press("Complete Feed the cat");

    expect(completeMock).toHaveBeenCalledTimes(1);
    expect(completeMock).toHaveBeenCalledWith({
      occurrence: {
        taskId: CAT_CHORE,
        assigneeId: CLEO,
        occurrenceDate: TODAY,
        slot: null,
        cyclePrev: null,
      },
    });
    // Pessimistic: nothing on the card changed, because nothing was stored on
    // the client (FR-393).
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens details from the card body and never from the circle (FR-352, US1-8)", async () => {
    renderBoard();

    await press("Complete Feed the cat");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await press("Feed the cat");

    const details = screen.getByRole("dialog");
    expect(within(details).getByRole("heading", { name: /Feed the cat/ })).toBeInTheDocument();
    expect(within(details).getByText("Half a tin.")).toBeInTheDocument();

    await press("Close");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("says whose task it is when the server refuses, and stores nothing (FR-351)", async () => {
    const message = "That's Ben's task — only Ben or a parent can do it.";
    renderBoard({ context: { withActor: async () => fail("FORBIDDEN", message) } });

    await press("Complete Take out trash");

    expect(screen.getByRole("alert")).toHaveTextContent(message);
    expect(completeMock).not.toHaveBeenCalled();

    // A refusal belongs to the tap that earned it, not to the next card.
    await press("Feed the cat");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("puts a claimed up-for-grabs occurrence in the crediting column, count included", () => {
    stubReads([CLAIM]);
    renderBoard();

    // The drawn column and the counter above it read the same membership rule
    // (R318): if the board re-implemented it, one of these two moves.
    expect(within(column("Ben")).getByText("Empty the dishwasher")).toBeInTheDocument();
    expect(
      within(column("Up for Grabs")).queryByText("Empty the dishwasher"),
    ).not.toBeInTheDocument();
    expect(
      within(screen.getByRole("group", { name: "Ben" })).getByText("1/2"),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("group", { name: "Up for Grabs" })).getByText("0"),
    ).toBeInTheDocument();
  });

  it("registers the shell's create control while it is mounted", () => {
    renderBoard();
    expect(screen.getByTestId("fab")).toHaveTextContent("Add Task");
  });

  it("keeps the page from scrolling sideways at any width (FR-394, SC-315)", () => {
    renderBoard();
    const board = document.querySelector("[data-board]");
    expect(board?.className).toContain("fam-board");
  });
});

describe("boardSeedsOf (R314)", () => {
  const props = boardProps({
    initialResolutions: [CLAIM],
    initialCarry: [CLAIM],
  });

  it("seeds the unwindowed reads always, and the windowed ones on their own day", () => {
    const seeds = boardSeedsOf(props, { displayedDate: TODAY, todayDate: TODAY }, 0);
    expect(seeds).toEqual({
      initialTasks: FIXTURE_TASKS,
      initialCursors: [],
      initialResolutions: [CLAIM],
      initialCarry: [CLAIM],
    });
  });

  it("still seeds the week the server fetched when the day moves inside it", () => {
    // 2026-09-04 is a Friday; 2026-09-02 sits in the same Sunday-started week.
    const seeds = boardSeedsOf(props, { displayedDate: "2026-09-02", todayDate: TODAY }, 0);
    expect(seeds.initialResolutions).toEqual([CLAIM]);
  });

  it("withholds the week's rows once the board has stepped out of that week", () => {
    const seeds = boardSeedsOf(props, { displayedDate: "2026-09-14", todayDate: TODAY }, 0);
    expect(seeds.initialResolutions).toBeUndefined();
    // The definitions and the chain tails are not windowed at all, so they
    // seed their one key whatever day is on screen.
    expect(seeds.initialTasks).toEqual(FIXTURE_TASKS);
    expect(seeds.initialCursors).toEqual([]);
  });

  it("withholds the carry tail once today is no longer the day it was fetched for", () => {
    // Midnight has passed with the board open: the tail's key rolled with it.
    const seeds = boardSeedsOf(props, { displayedDate: "2026-09-05", todayDate: "2026-09-05" }, 0);
    expect(seeds.initialCarry).toBeUndefined();
  });
});

describe("boardNoticeOf", () => {
  const quiet = {
    error: null,
    gone: false,
    detailsOpen: false,
    resolveNotice: null,
    own: null,
  };

  it("says nothing when there is nothing to say", () => {
    expect(boardNoticeOf(quiet)).toBeNull();
  });

  it("puts a failed read first, in the household's words", () => {
    expect(boardNoticeOf({ ...quiet, error: new Error("relation does not exist") })).toBe(
      "Today's tasks could not be loaded.",
    );
  });

  it("reports a task that left the board under an open sheet (FR-393)", () => {
    expect(boardNoticeOf({ ...quiet, gone: true })).toBe("That task is no longer here.");
  });

  it("shows the board's own message ahead of a stale refusal", () => {
    expect(boardNoticeOf({ ...quiet, own: "Adding tasks comes with the task form." })).toBe(
      "Adding tasks comes with the task form.",
    );
  });

  it("leaves a refusal to the sheet while the sheet is open (FR-351)", () => {
    const refusal = { ...quiet, resolveNotice: "That's Ben's task." };
    expect(boardNoticeOf(refusal)).toBe("That's Ben's task.");
    expect(boardNoticeOf({ ...refusal, detailsOpen: true })).toBeNull();
  });
});

describe("boardColumnsOf (R318)", () => {
  const mine: BoardOccurrence = {
    taskId: CAT_CHORE,
    assigneeId: CLEO,
    scheduledDate: TODAY,
    slot: null,
    cyclePrev: null,
    displayedDate: TODAY,
    isLate: false,
    summary: "Feed the cat",
    description: null,
    emoji: null,
    routine: false,
    upForGrabs: false,
    trackHabit: false,
    dueTime: null,
    dueAt: null,
    isRepeating: false,
    taskCreatedAt: "2026-08-01T12:00:00.000Z",
    state: "unresolved",
    creditedCategoryId: null,
  };
  const unclaimed: BoardOccurrence = { ...mine, assigneeId: null, upForGrabs: true };
  const claimed: BoardOccurrence = {
    ...unclaimed,
    state: "complete",
    creditedCategoryId: BEN,
  };

  it("gives every shown Profile a column, empty or not (FR-316)", () => {
    expect(boardColumnsOf([], [CLEO, BEN])).toEqual({
      upForGrabs: [],
      byProfile: { [CLEO]: [], [BEN]: [] },
    });
  });

  it("partitions by the chain's owner, then by the Profile a claim credited", () => {
    const columns = boardColumnsOf([mine, unclaimed, claimed], [CLEO, BEN]);
    expect(columns.byProfile[CLEO]).toEqual([mine]);
    // The claim moved it out of Up for Grabs and into Ben's column (FR-367) —
    // the same rule `columnCountersOf` counts by, so the two cannot disagree.
    expect(columns.byProfile[BEN]).toEqual([claimed]);
    expect(columns.upForGrabs).toEqual([unclaimed]);
  });

  it("draws nothing for a Profile with no column, rather than elsewhere (FR-313)", () => {
    const columns = boardColumnsOf([mine], [BEN]);
    expect(columns.byProfile).toEqual({ [BEN]: [] });
    expect(columns.upForGrabs).toEqual([]);
  });
});
