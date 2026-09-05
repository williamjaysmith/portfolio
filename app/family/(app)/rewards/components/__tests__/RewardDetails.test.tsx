import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { PALETTE } from "@/lib/family/colors";
import type { ActorSession, Category, Redemption, Reward } from "@/lib/family/types";

import {
  makeActor,
  makeCategory,
  stubDialog,
} from "../../../components/__tests__/family-test-utils";
import { RewardDetails } from "../RewardDetails";

/**
 * 004 T035 — the reward details view a tap on a card's BODY opens (FR-415,
 * FR-418, FR-419, FR-425, FR-431).
 *
 * Two rules are load-bearing and each is asserted rather than assumed:
 *
 *   - Edit and Delete are affordances over `permissions.can` (FR-419): a
 *     parent's, and drawn only once the board gives them somewhere to go;
 *     Delete sits behind a confirmation that says it cannot be undone and that
 *     spent stars stay spent (FR-418, FR-421);
 *   - Unredeem is drawn on a redeemed card only, and only when the board has
 *     wired it (T043) — the server, not this sheet, decides who may (FR-424).
 */

const CLEO = "11111111-1111-4111-8111-111111111111";
const BEN = "33333333-3333-4333-8333-333333333333";
const ANA = "44444444-4444-4444-8444-444444444444";

function profile(id: string, label: string, overrides: Partial<Category> = {}): Category {
  return makeCategory({ id, label, color: PALETTE[1], role: "member", ...overrides });
}

const CATEGORIES: Category[] = [
  profile(CLEO, "Cleo"),
  profile(BEN, "Ben"),
  profile(ANA, "Ana", { role: "parent" }),
  makeCategory({ id: "label-1", label: "Pets", isProfile: false, emoji: "🐾" }),
];

function reward(overrides: Partial<Reward> = {}): Reward {
  return {
    id: "reward-cookies",
    householdId: "household-1",
    name: "Bake cookies",
    description: "A whole tray, and you pick the recipe.",
    emoji: "🍪",
    pointValue: 20,
    respawnOnRedemption: true,
    categoryIds: [BEN, CLEO],
    createdBy: null,
    updatedBy: null,
    createdAt: "2026-08-01T12:00:00.000Z",
    updatedAt: "2026-08-01T12:00:00.000Z",
    ...overrides,
  };
}

function redemption(overrides: Partial<Redemption> = {}): Redemption {
  return {
    id: "redemption-1",
    householdId: "household-1",
    rewardId: "reward-cookies",
    categoryId: CLEO,
    pointValue: 15,
    rewardName: "Bake cookies",
    redeemedOn: "2026-09-27",
    redeemedAt: "2026-09-27T20:00:00.000Z",
    redeemedBy: ANA,
    reversedAt: null,
    reversedBy: null,
    ...overrides,
  };
}

interface RenderOptions {
  reward?: Reward;
  redemption?: Redemption | null;
  actor?: ActorSession | null;
  busy?: boolean;
  notice?: string | null;
  writable?: boolean;
  unredeemable?: boolean;
}

function renderDetails(options: RenderOptions = {}) {
  const onEdit = vi.fn();
  const onDelete = vi.fn();
  const onUnredeem = vi.fn();
  const onClose = vi.fn();
  render(
    <RewardDetails
      reward={options.reward ?? reward()}
      categories={CATEGORIES}
      redemption={options.redemption ?? null}
      actor={options.actor ?? null}
      busy={options.busy}
      notice={options.notice ?? null}
      onEdit={options.writable ? onEdit : undefined}
      onDelete={options.writable ? onDelete : undefined}
      onUnredeem={options.unredeemable ? onUnredeem : undefined}
      onClose={onClose}
    />,
  );
  return { onEdit, onDelete, onUnredeem, onClose };
}

const PARENT = makeActor("parent", { profileId: ANA, label: "Ana" });
const MEMBER = makeActor("member", { profileId: CLEO, label: "Cleo" });

beforeAll(() => {
  stubDialog();
});

describe("RewardDetails", () => {
  it("shows the title, emoji, description, cost, renewal and eligible Profiles (FR-415)", () => {
    renderDetails();
    expect(screen.getByRole("heading", { name: /Bake cookies/ })).toBeInTheDocument();
    expect(screen.getByText("🍪")).toBeInTheDocument();
    expect(screen.getByText("A whole tray, and you pick the recipe.")).toBeInTheDocument();
    expect(screen.getByText("20 stars")).toBeInTheDocument();
    expect(screen.getByText("Renews after redeeming")).toBeInTheDocument();
    expect(screen.getByText("Yes")).toBeInTheDocument();
    // In the household's order, Profiles only, and nobody who is not eligible.
    const eligible = screen.getByRole("list", { name: "Eligible Profiles" });
    expect(eligible).toHaveTextContent(/^CleoBen$/);
    expect(screen.queryByText("Ana")).not.toBeInTheDocument();
    expect(screen.queryByText("Pets")).not.toBeInTheDocument();
  });

  it("says a one-time reward does not renew, and omits an absent description", () => {
    renderDetails({ reward: reward({ respawnOnRedemption: false, description: null }) });
    expect(screen.getByText("No")).toBeInTheDocument();
    expect(screen.queryByText("Description")).not.toBeInTheDocument();
  });

  it("names the cost in the singular for one star", () => {
    renderDetails({ reward: reward({ pointValue: 1 }) });
    expect(screen.getByText("1 star")).toBeInTheDocument();
  });

  it("reads a redeemed card's day and the cost AS IT WAS, not the reward's current cost (FR-425, FR-428)", () => {
    renderDetails({ reward: reward({ pointValue: 50 }), redemption: redemption({ pointValue: 15 }) });
    expect(
      screen.getByText("Redeemed on September 27, 2026 for 15 stars by Ana"),
    ).toBeInTheDocument();
    expect(screen.getByText("50 stars")).toBeInTheDocument();
  });

  it("says who redeemed it only when the redeemer is still known", () => {
    renderDetails({ redemption: redemption({ redeemedBy: null }) });
    expect(screen.getByText("Redeemed on September 27, 2026 for 15 stars")).toBeInTheDocument();
  });

  describe("Edit and Delete (FR-418, FR-419)", () => {
    it("are drawn for a parent once the board has wired them", () => {
      renderDetails({ actor: PARENT, writable: true });
      expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
    });

    it("are not drawn for a member, nor for nobody, even when wired", () => {
      renderDetails({ actor: MEMBER, writable: true });
      expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
    });

    it("are not drawn for a parent the board has given nowhere to go", () => {
      renderDetails({ actor: PARENT, writable: false });
      expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
    });

    it("hands Edit to the board", () => {
      const { onEdit } = renderDetails({ actor: PARENT, writable: true });
      fireEvent.click(screen.getByRole("button", { name: "Edit" }));
      expect(onEdit).toHaveBeenCalledTimes(1);
    });

    it("asks before deleting, saying it cannot be undone and that spent stars stay spent (FR-418, FR-421)", () => {
      const { onDelete } = renderDetails({ actor: PARENT, writable: true });
      fireEvent.click(screen.getByRole("button", { name: "Delete" }));
      expect(onDelete).not.toHaveBeenCalled();

      const warning = screen.getByText(/Delete “Bake cookies”\?/);
      expect(warning).toHaveTextContent(/can’t be undone/);
      expect(warning).toHaveTextContent(/stars already spent on it stay spent/i);

      fireEvent.click(screen.getByRole("button", { name: "Delete for good" }));
      expect(onDelete).toHaveBeenCalledTimes(1);
    });

    it("lets a parent keep the reward from the confirmation", () => {
      const { onDelete } = renderDetails({ actor: PARENT, writable: true });
      fireEvent.click(screen.getByRole("button", { name: "Delete" }));
      fireEvent.click(screen.getByRole("button", { name: "Keep it" }));
      expect(onDelete).not.toHaveBeenCalled();
      expect(screen.queryByText(/Delete “Bake cookies”\?/)).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
    });

    it("holds the confirmation's Delete while a write is in flight", () => {
      renderDetails({ actor: PARENT, writable: true, busy: true });
      fireEvent.click(screen.getByRole("button", { name: "Delete" }));
      expect(screen.getByRole("button", { name: "Delete for good" })).toBeDisabled();
    });
  });

  describe("Unredeem (FR-431)", () => {
    it("is drawn on a redeemed card once the board has wired it, whoever is punched in", () => {
      const { onUnredeem } = renderDetails({
        redemption: redemption(),
        unredeemable: true,
        actor: MEMBER,
      });
      fireEvent.click(screen.getByRole("button", { name: "Unredeem" }));
      expect(onUnredeem).toHaveBeenCalledTimes(1);
    });

    it("is not drawn on a live card, even when wired", () => {
      renderDetails({ unredeemable: true, actor: PARENT });
      expect(screen.queryByRole("button", { name: "Unredeem" })).not.toBeInTheDocument();
    });

    it("is not drawn on a redeemed card the board has not wired", () => {
      renderDetails({ redemption: redemption(), actor: PARENT });
      expect(screen.queryByRole("button", { name: "Unredeem" })).not.toBeInTheDocument();
    });

    it("is held while a write is in flight", () => {
      renderDetails({ redemption: redemption(), unredeemable: true, busy: true });
      const button = screen.getByRole("button", { name: "Unredeem" });
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute("aria-busy", "true");
    });
  });

  it("shows a refusal where the tap happened (FR-424)", () => {
    renderDetails({ notice: "That is Ben's reward. A parent can redeem it for him." });
    expect(screen.getByRole("alert")).toHaveTextContent("That is Ben's reward.");
  });

  it("closes from the Close button and from Escape", () => {
    const { onClose } = renderDetails();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent(screen.getByRole("dialog", { hidden: true }), new Event("cancel", { cancelable: true }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("is a modal dialog labelled by its title, with every control at least 44 points tall (FR-445)", () => {
    renderDetails({ actor: PARENT, writable: true, redemption: redemption(), unredeemable: true });
    const dialog = screen.getByRole("dialog", { hidden: true });
    expect(dialog).toHaveAttribute("aria-labelledby", "reward-details-title");
    for (const button of screen.getAllByRole("button")) {
      expect(button).toHaveClass("min-h-(--fam-touch)");
    }
  });
});
