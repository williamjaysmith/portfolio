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

import { createReward, deleteReward, updateReward } from "@/lib/family/actions/rewards";
import { PALETTE } from "@/lib/family/colors";
import { fail } from "@/lib/family/errors";
import { useRedemptions, useRewards, useStarBalances } from "@/lib/family/queries";
import type { Category, Redemption, Reward, StarBalance } from "@/lib/family/types";

import { FabActionProvider, useFabAction } from "../../../components/FabAction";
import type { FamilyContextValue } from "../../../components/FamilyProvider";
import { showsChipRow } from "../../../components/nav";
import {
  makeActor,
  makeCategory,
  makeContext,
  stubDialog,
  withFamily,
} from "../../../components/__tests__/family-test-utils";
import { RewardsBoard, type RewardsBoardProps } from "../RewardsBoard";
import { resetRewardFilters } from "../useRewardFilters";

/**
 * 004 T032 — the Rewards tab's chassis (FR-422, SC-417, R409): the Tasks
 * board's geometry, pager and strip with different columns.
 *
 * The three reads are stubbed and everything below them runs for real, so what
 * this file proves is the wiring rather than the column (`RewardColumn.test`)
 * or the card (`RewardCard.test`):
 *
 *   - one column per visible Profile in the household's order, none for a
 *     Label, none for Up for Grabs, and the balance from the view on each
 *     header (FR-413, FR-422);
 *   - the pager taking over at seven columns on a measured wall tablet, and the
 *     shell's chip row absent on this route (FR-422, FR-396);
 *   - the per-device Redeemed switch bringing the muted cards in (FR-425, FR-426);
 *   - the create form from the shell's control and the edit form from details,
 *     every commit through `withActor` and the shipped actions (FR-415, FR-418,
 *     FR-419), a refusal shown in the household's words and a `NOT_FOUND`
 *     closing the surface rather than recreating what another device deleted.
 */

vi.mock("@/lib/family/queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/family/queries")>();
  return {
    ...actual,
    useRewards: vi.fn(),
    useStarBalances: vi.fn(),
    useRedemptions: vi.fn(),
  };
});

vi.mock("@/lib/family/actions/rewards", () => ({
  createReward: vi.fn(),
  updateReward: vi.fn(),
  deleteReward: vi.fn(),
}));

const createMock = createReward as Mock;
const updateMock = updateReward as Mock;
const deleteMock = deleteReward as Mock;

const HOUSEHOLD = "household-1";

const CLEO = "11111111-1111-4111-8111-111111111111";
const BEN = "33333333-3333-4333-8333-333333333333";
const ANA = "44444444-4444-4444-8444-444444444444";

const COOKIES = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const MOVIE = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ICE_CREAM = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function profile(id: string, label: string, overrides: Partial<Category> = {}): Category {
  return makeCategory({ id, label, color: PALETTE[1], role: "member", ...overrides });
}

/** Three Profiles in the household's order, and a Label that is nobody (FR-414). */
const CATEGORIES: Category[] = [
  profile(CLEO, "Cleo"),
  profile(BEN, "Ben"),
  profile(ANA, "Ana", { role: "parent" }),
  makeCategory({ id: "label-bins", label: "Bin day", isProfile: false }),
];

function rewardOf(overrides: Partial<Reward> & Pick<Reward, "id" | "name">): Reward {
  return {
    householdId: HOUSEHOLD,
    description: null,
    emoji: null,
    pointValue: 20,
    respawnOnRedemption: false,
    categoryIds: [CLEO],
    createdBy: null,
    updatedBy: null,
    createdAt: "2026-08-01T12:00:00.000Z",
    updatedAt: "2026-08-01T12:00:00.000Z",
    ...overrides,
  };
}

/**
 * The seed's three (R413), with one twist: Cleo has already redeemed the
 * one-time Ice cream, so her column has a muted card to show behind the switch
 * and Ben's still has the live one (FR-417, FR-425).
 */
const FIXTURE_REWARDS: Reward[] = [
  rewardOf({
    id: COOKIES,
    name: "Bake cookies",
    emoji: "🍪",
    description: "A whole tray.",
    pointValue: 20,
    respawnOnRedemption: true,
    categoryIds: [CLEO],
  }),
  rewardOf({
    id: MOVIE,
    name: "Movie night",
    emoji: "🍿",
    pointValue: 15,
    categoryIds: [BEN, CLEO],
    createdAt: "2026-08-02T12:00:00.000Z",
  }),
  rewardOf({
    id: ICE_CREAM,
    name: "Ice cream",
    emoji: "🍨",
    pointValue: 25,
    categoryIds: [ANA, BEN, CLEO],
    createdAt: "2026-08-03T12:00:00.000Z",
  }),
];

/** Cleo 15, Ben 40; Ana has no row, which the tab reads as 0 (R402). */
const FIXTURE_BALANCES: StarBalance[] = [
  { categoryId: CLEO, balance: 15 },
  { categoryId: BEN, balance: 40 },
];

const CLEO_ICE_CREAM: Redemption = {
  id: "redemption-1",
  householdId: HOUSEHOLD,
  rewardId: ICE_CREAM,
  categoryId: CLEO,
  pointValue: 25,
  rewardName: "Ice cream",
  redeemedOn: "2026-09-27",
  redeemedAt: "2026-09-27T20:00:00.000Z",
  redeemedBy: CLEO,
  reversedAt: null,
  reversedBy: null,
};

interface QueryStub<T> {
  data?: T;
  error?: Error | null;
}

function stub<T extends (...args: never[]) => unknown>(
  hook: MockedFunction<T>,
  value: QueryStub<unknown>,
): void {
  const mock = hook as unknown as Mock<() => unknown>;
  mock.mockReturnValue({ data: value.data, isPending: false, error: value.error ?? null });
}

function stubReads(): void {
  stub(vi.mocked(useRewards), { data: FIXTURE_REWARDS });
  stub(vi.mocked(useStarBalances), { data: FIXTURE_BALANCES });
  stub(vi.mocked(useRedemptions), { data: [CLEO_ICE_CREAM] });
}

function boardProps(): RewardsBoardProps {
  return {
    initialRewards: FIXTURE_REWARDS,
    initialBalances: FIXTURE_BALANCES,
    initialRedemptions: [CLEO_ICE_CREAM],
  };
}

/** Reads back what the mounted tab registered with the shell's FAB, and runs it as the Fab does. */
function FabProbe() {
  const action = useFabAction();
  return (
    <button type="button" data-testid="fab" onClick={() => action?.run()}>
      {action?.label ?? "none"}
    </button>
  );
}

function renderBoard(options: { context?: Partial<FamilyContextValue> } = {}) {
  const context = makeContext({ categories: CATEGORIES, ...options.context });
  return render(
    withFamily(
      context,
      <FabActionProvider>
        <RewardsBoard {...boardProps()} />
        <FabProbe />
      </FabActionProvider>,
    ),
  );
}

/** The columns in the order the tab draws them. */
function columnIds(): string[] {
  return Array.from(document.querySelectorAll("[data-column]")).map(
    (column) => column.getAttribute("data-column") ?? "",
  );
}

function column(name: string): HTMLElement {
  return screen.getByRole("region", { name });
}

/** The cards in one column, by title, in drawn order. */
function cardTitlesIn(name: string): string[] {
  return Array.from(column(name).querySelectorAll("[data-reward-title]")).map(
    (title) => title.textContent ?? "",
  );
}

/** `screen`, or `within(...)` of one dialog when two share a button's name. */
type Root = Pick<ReturnType<typeof within>, "getByRole">;

async function press(name: string | RegExp, root: Root = screen): Promise<void> {
  await act(async () => {
    fireEvent.click(root.getByRole("button", { name }));
  });
}

/** Edit and Delete are parent-only affordances (FR-419). */
const AS_PARENT = { actor: makeActor("parent", { profileId: ANA, label: "Ana" }) };

/* ------------------------------------------------------ the measured board -- */

/** The wall tablet: a 1880 px board, and the token probe resolving to 400 px (tasks-layout.test.ts). */
const BOARD_WIDTH = 1880;
const PROBE_WIDTH = 400;

/**
 * jsdom lays nothing out, so every `getBoundingClientRect` is zero and the
 * geometry stays unmeasured. This makes the board node and the hook's own
 * probe report real widths — the probe is recognised by the token it is sized
 * with, the one thing `useBoardGeometry` guarantees about it.
 */
function stubLayout(): void {
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (
    this: Element,
  ): DOMRect {
    const width =
      this instanceof HTMLElement && this.style.width === "var(--fam-task-col-w)"
        ? PROBE_WIDTH
        : BOARD_WIDTH;
    return {
      width,
      height: 0,
      top: 0,
      left: 0,
      right: width,
      bottom: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect;
  });
  Object.defineProperty(window, "innerWidth", { value: 1920, configurable: true });
  Object.defineProperty(window, "innerHeight", { value: 1080, configurable: true });
}

/** Seven Profiles, so the wall tablet's four-column fit must page (FR-396). */
const SEVEN: Category[] = ["Ana", "Ben", "Cleo", "Dana", "Eli", "Fay", "Gus"].map((label, index) =>
  profile(`${index + 1}`.repeat(8) + "-0000-4000-8000-000000000000", label),
);

beforeAll(() => {
  stubDialog();
});

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  resetRewardFilters();
  stubReads();
  createMock.mockResolvedValue({ ok: true, data: null });
  updateMock.mockResolvedValue({ ok: true, data: null });
  deleteMock.mockResolvedValue({ ok: true, data: null });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("RewardsBoard", () => {
  describe("the columns (FR-413, FR-422)", () => {
    it("draws one column per Profile in the household's order, and none for a Label", () => {
      renderBoard();

      expect(columnIds()).toEqual([CLEO, BEN, ANA]);
      expect(screen.queryByRole("region", { name: "Bin day" })).not.toBeInTheDocument();
      // Nobody's rewards: there is no Up for Grabs on this tab (R409).
      expect(screen.queryByRole("region", { name: "Up for Grabs" })).not.toBeInTheDocument();
    });

    it("leaves out a Profile this device has hidden, as the Tasks tab does (FR-426)", () => {
      const [cleo, , ana] = CATEGORIES;
      renderBoard({ context: { visibleProfiles: [cleo, ana] } });

      expect(columnIds()).toEqual([CLEO, ANA]);
    });

    it("heads each column with the view's balance, and 0 for a Profile with no row", () => {
      renderBoard();

      expect(within(column("Cleo")).getByLabelText("Balance: 15 stars")).toBeInTheDocument();
      expect(within(column("Ben")).getByLabelText("Balance: 40 stars")).toBeInTheDocument();
      expect(within(column("Ana")).getByLabelText("Balance: 0 stars")).toBeInTheDocument();
    });

    it("hands every column the same rewards, and each keeps its own Profile's (FR-417)", () => {
      renderBoard();

      // Cleo: Movie night is affordable and comes first; Ice cream is her
      // standing one-time redemption and has no live card (FR-425, FR-427).
      expect(cardTitlesIn("Cleo")).toEqual(["Movie night", "Bake cookies"]);
      // Ben is eligible for both one-time rewards and can afford both.
      expect(cardTitlesIn("Ben")).toEqual(["Movie night", "Ice cream"]);
      expect(cardTitlesIn("Ana")).toEqual(["Ice cream"]);
    });

    it("stretches every column across the board while unmeasured (FR-394)", () => {
      renderBoard();

      expect(document.querySelector("[data-board]")?.getAttribute("style")).toContain(
        "repeat(3, minmax(0, 1fr))",
      );
      expect(document.querySelector("[data-board]")?.className).toContain("fam-board");
      expect(screen.queryByRole("group", { name: "Profile columns" })).not.toBeInTheDocument();
    });

    it("says so when every Profile is hidden on this device", () => {
      renderBoard({ context: { visibleProfiles: [] } });

      expect(columnIds()).toEqual([]);
      expect(screen.getByText("Every Profile is hidden on this device.")).toBeInTheDocument();
    });
  });

  describe("the pager and the chip row (FR-396, FR-422)", () => {
    it("pages four at a time at seven columns on a measured wall tablet", async () => {
      stubLayout();
      renderBoard({ context: { categories: SEVEN, visibleProfiles: SEVEN } });

      expect(columnIds()).toEqual(SEVEN.slice(0, 4).map((one) => one.id));
      const pager = screen.getByRole("group", { name: "Profile columns" });
      expect(screen.getByRole("status")).toHaveTextContent("Showing Ana, Ben, Cleo and Dana");

      await act(async () => {
        fireEvent.keyDown(pager, { key: "ArrowRight" });
      });

      expect(columnIds()).toEqual(SEVEN.slice(1, 5).map((one) => one.id));
    });

    it("declines the shell's profile chip row on its route", () => {
      expect(showsChipRow("/family/rewards")).toBe(false);
    });
  });

  describe("the Redeemed switch (FR-425, FR-426)", () => {
    it("starts off, and brings in the muted cards when turned on", async () => {
      renderBoard();

      const toggle = screen.getByRole("switch", { name: "Redeemed" });
      expect(toggle).toHaveAttribute("aria-checked", "false");
      expect(within(column("Cleo")).queryByText("Redeemed on Sep 27")).not.toBeInTheDocument();

      await act(async () => {
        fireEvent.click(toggle);
      });

      expect(screen.getByRole("switch", { name: "Redeemed" })).toHaveAttribute(
        "aria-checked",
        "true",
      );
      // Cleo's history joins her column, below the live cards; nobody else's moves.
      expect(cardTitlesIn("Cleo")).toEqual(["Movie night", "Bake cookies", "Ice cream"]);
      expect(within(column("Cleo")).getByText("Redeemed on Sep 27")).toBeInTheDocument();
      expect(column("Cleo").querySelector("[data-state='redeemed']")).not.toBeNull();
      expect(cardTitlesIn("Ben")).toEqual(["Movie night", "Ice cream"]);
    });

    it("remembers the choice on this device", async () => {
      renderBoard();

      await act(async () => {
        fireEvent.click(screen.getByRole("switch", { name: "Redeemed" }));
      });

      expect(JSON.parse(localStorage.getItem("family:reward-filters:v1") ?? "{}")).toEqual({
        redeemed: true,
      });
      expect(screen.queryByText(/won.t be remembered/)).not.toBeInTheDocument();
    });

    it("says when the choice cannot be remembered (constitution §VI)", async () => {
      vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
        throw new Error("quota");
      });
      renderBoard();

      await act(async () => {
        fireEvent.click(screen.getByRole("switch", { name: "Redeemed" }));
      });

      // The switch still works for the session…
      expect(within(column("Cleo")).getByText("Redeemed on Sep 27")).toBeInTheDocument();
      // …and the tab says it will be forgotten.
      expect(screen.getByText(/won.t be remembered/)).toBeInTheDocument();
    });
  });

  describe("the write surface (FR-415, FR-418, FR-419)", () => {
    it("registers the shell's create control while it is mounted", () => {
      renderBoard();
      expect(screen.getByTestId("fab")).toHaveTextContent("Add Reward");
    });

    it("opens the create form from the shell's control and creates through withActor", async () => {
      const withActor = vi.fn(async (run: () => Promise<unknown>) => run());
      renderBoard({ context: { ...AS_PARENT, withActor: withActor as FamilyContextValue["withActor"] } });

      await press("Add Reward");
      const form = screen.getByRole("dialog");
      expect(within(form).getByRole("heading", { name: "Add a reward" })).toBeInTheDocument();

      fireEvent.change(within(form).getByLabelText("Title"), { target: { value: "Zoo trip" } });
      fireEvent.change(within(form).getByLabelText("Star cost"), { target: { value: "50" } });
      fireEvent.click(
        within(within(form).getByRole("group", { name: "Eligible Profiles" })).getByRole(
          "checkbox",
          { name: "Cleo" },
        ),
      );
      await press("Save", within(form));

      expect(withActor).toHaveBeenCalledTimes(1);
      expect(createMock).toHaveBeenCalledTimes(1);
      expect(createMock.mock.calls[0][0]).toEqual({
        name: "Zoo trip",
        description: null,
        emoji: null,
        pointValue: 50,
        respawnOnRedemption: false,
        categoryIds: [CLEO],
      });
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("offers the whole household's Profiles, not only the columns on this device", async () => {
      const [cleo] = CATEGORIES;
      renderBoard({ context: { ...AS_PARENT, visibleProfiles: [cleo] } });

      await press("Add Reward");
      const picker = screen.getByRole("group", { name: "Eligible Profiles" });

      expect(within(picker).getByRole("checkbox", { name: "Ben" })).toBeInTheDocument();
      expect(within(picker).getByRole("checkbox", { name: "Ana" })).toBeInTheDocument();
      expect(within(picker).queryByRole("checkbox", { name: "Bin day" })).toBeNull();
    });

    it("opens details from a card's body, and the edit form pre-filled from there", async () => {
      renderBoard({ context: AS_PARENT });

      await press(/^Bake cookies/, within(column("Cleo")));
      const details = screen.getByRole("dialog");
      expect(within(details).getByRole("heading", { name: /Bake cookies/ })).toBeInTheDocument();
      expect(within(details).getByText("A whole tray.")).toBeInTheDocument();

      await press("Edit", within(details));

      expect(screen.getByRole("heading", { name: "Edit reward" })).toBeInTheDocument();
      expect(screen.getByLabelText("Title")).toHaveValue("Bake cookies");
      expect(screen.getByLabelText("Star cost")).toHaveValue(20);
      expect(screen.getByRole("switch", { name: "Renew after redeeming" })).toBeChecked();
    });

    it("sends an edit as a patch over the stored reward, through withActor", async () => {
      renderBoard({ context: AS_PARENT });
      await press(/^Bake cookies/, within(column("Cleo")));
      await press("Edit");

      fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Bake more cookies" } });
      await press("Save");

      expect(updateMock).toHaveBeenCalledTimes(1);
      expect(updateMock.mock.calls[0][0]).toEqual({
        id: COOKIES,
        patch: {
          name: "Bake more cookies",
          description: "A whole tray.",
          emoji: "🍪",
          pointValue: 20,
          respawnOnRedemption: true,
          categoryIds: [CLEO],
        },
      });
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("deletes after the confirmation, with confirm true, and closes the details", async () => {
      renderBoard({ context: AS_PARENT });
      await press(/^Bake cookies/, within(column("Cleo")));
      await press("Delete");

      expect(deleteMock).not.toHaveBeenCalled();
      await press("Delete for good");

      expect(deleteMock).toHaveBeenCalledWith({ id: COOKIES, confirm: true });
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("shows a refused delete where the tap happened, and keeps the details open", async () => {
      const message = "Only a parent can change rewards.";
      deleteMock.mockResolvedValue(fail("FORBIDDEN", message));
      renderBoard({ context: AS_PARENT });
      await press(/^Bake cookies/, within(column("Cleo")));
      await press("Delete");
      await press("Delete for good");

      const details = screen.getByRole("dialog");
      expect(within(details).getByRole("alert")).toHaveTextContent(message);
    });

    it("closes the edit form and says so when another device deleted it first", async () => {
      updateMock.mockResolvedValue(fail("NOT_FOUND"));
      renderBoard({ context: AS_PARENT });
      await press(/^Bake cookies/, within(column("Cleo")));
      await press("Edit");

      fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Gone" } });
      await press("Save");

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(screen.getByRole("alert")).toHaveTextContent("That reward is no longer here.");
    });

    it("closes the details and says so when the delete finds nothing (FR-393)", async () => {
      deleteMock.mockResolvedValue(fail("NOT_FOUND"));
      renderBoard({ context: AS_PARENT });
      await press(/^Bake cookies/, within(column("Cleo")));
      await press("Delete");
      await press("Delete for good");

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(screen.getByRole("alert")).toHaveTextContent("That reward is no longer here.");
    });

    it("shows a refused create in the form, and leaves it open", async () => {
      createMock.mockResolvedValue(fail("FORBIDDEN"));
      renderBoard({ context: { actor: makeActor("member", { profileId: CLEO, label: "Cleo" }) } });

      await press("Add Reward");
      fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Zoo trip" } });
      fireEvent.change(screen.getByLabelText("Star cost"), { target: { value: "50" } });
      fireEvent.click(screen.getByRole("checkbox", { name: "Cleo" }));
      await press("Save");

      const form = screen.getByRole("dialog");
      expect(within(form).getByRole("alert")).toHaveTextContent(/parent/i);
    });

    it("offers a member neither Edit nor Delete — the affordance, not the gate", async () => {
      renderBoard({ context: { actor: makeActor("member", { profileId: CLEO, label: "Cleo" }) } });
      await press(/^Bake cookies/, within(column("Cleo")));

      expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
    });
  });

  it("says once when a read fails, in the household's words", () => {
    stub(vi.mocked(useRewards), { data: undefined, error: new Error("relation does not exist") });
    renderBoard();

    expect(screen.getByRole("alert")).toHaveTextContent("Rewards could not be loaded.");
    expect(screen.queryByText("relation does not exist")).not.toBeInTheDocument();
  });
});
