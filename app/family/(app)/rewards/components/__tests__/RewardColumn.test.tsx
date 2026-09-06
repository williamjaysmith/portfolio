import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PALETTE } from "@/lib/family/colors";
import type { Category, Redemption, Reward } from "@/lib/family/types";

import { makeCategory } from "../../../components/__tests__/family-test-utils";
import { rewardCardKeyOf, type RewardCardTarget } from "../RewardCard";
import { RewardColumn } from "../RewardColumn";

/**
 * 004 T033 — one Profile's Rewards column (FR-413, FR-422, FR-425–FR-427).
 *
 * The column is handed the household's rewards and redemptions and ONE
 * number — the view's balance, read above by `balanceOf` — and draws: the
 * header (avatar, name, the balance pill, negative kept honest), the live cards
 * this Profile is eligible for in `orderRewardCards` order, and — only while
 * the Redeemed switch is on — one muted card per STANDING redemption, most
 * recent first, under every live card. A one-time reward with a standing
 * redemption has no live card at all (FR-425); a renewing one keeps its live
 * card above its history (FR-426).
 */

const CLEO = "11111111-1111-4111-8111-111111111111";
const BEN = "33333333-3333-4333-8333-333333333333";

const CATEGORY: Category = makeCategory({
  id: CLEO,
  label: "Cleo",
  color: PALETTE[1],
  role: "member",
});

let sequence = 0;

function reward(overrides: Partial<Reward> = {}): Reward {
  sequence += 1;
  return {
    id: `reward-${sequence}`,
    householdId: "household-1",
    name: `Reward ${sequence}`,
    description: null,
    emoji: null,
    pointValue: 20,
    respawnOnRedemption: false,
    categoryIds: [CLEO],
    createdBy: null,
    updatedBy: null,
    createdAt: `2026-08-0${sequence}T12:00:00.000Z`,
    updatedAt: `2026-08-0${sequence}T12:00:00.000Z`,
    ...overrides,
  };
}

function redemption(of: Reward, overrides: Partial<Redemption> = {}): Redemption {
  sequence += 1;
  return {
    id: `redemption-${sequence}`,
    householdId: "household-1",
    rewardId: of.id,
    categoryId: CLEO,
    pointValue: of.pointValue,
    rewardName: of.name,
    redeemedOn: "2026-09-27",
    redeemedAt: "2026-09-27T20:00:00.000Z",
    redeemedBy: CLEO,
    reversedAt: null,
    reversedBy: null,
    ...overrides,
  };
}

interface RenderOptions {
  rewards?: readonly Reward[];
  redemptions?: readonly Redemption[];
  balance?: number;
  showRedeemed?: boolean;
  busyKeys?: ReadonlySet<string>;
}

function renderColumn(options: RenderOptions = {}) {
  const onOpen = vi.fn<(target: RewardCardTarget) => void>();
  const onRedeem = vi.fn<(target: RewardCardTarget) => void>();
  render(
    <RewardColumn
      category={CATEGORY}
      rewards={options.rewards ?? []}
      redemptions={options.redemptions ?? []}
      balance={options.balance ?? 15}
      showRedeemed={options.showRedeemed ?? false}
      busyKeys={options.busyKeys}
      onOpen={onOpen}
      onRedeem={onRedeem}
    />,
  );
  return { onOpen, onRedeem };
}

/** The cards in the order the column draws them, by title. */
function cardTitles(): string[] {
  return screen
    .getAllByRole("listitem")
    .map((item) => item.querySelector("[data-reward-title]")?.textContent ?? "");
}

function cardStates(): string[] {
  return screen.getAllByRole("listitem").map((item) => item.getAttribute("data-state") ?? "");
}

describe("RewardColumn", () => {
  describe("header (FR-413, FR-422)", () => {
    it("shows the avatar, the name and the balance pill reading the view's number", () => {
      renderColumn({ balance: 55 });
      const header = screen.getByRole("group", { name: "Cleo" });
      expect(within(header).getByText("C")).toBeInTheDocument();
      expect(within(header).getByText("Cleo")).toBeInTheDocument();
      const pill = within(header).getByLabelText("Balance: 55 stars");
      expect(pill).toHaveTextContent("55");
    });

    it("shows a negative balance honestly rather than clamping it (FR-413)", () => {
      renderColumn({ balance: -5 });
      const pill = screen.getByLabelText("Balance: minus 5 stars");
      expect(pill).toHaveTextContent("-5");
    });

    it("reads one star in the singular", () => {
      renderColumn({ balance: 1 });
      expect(screen.getByLabelText("Balance: 1 star")).toBeInTheDocument();
    });

    it("is a section named for the Profile, carrying the column id the board pages by", () => {
      renderColumn();
      const section = screen.getByRole("region", { name: "Cleo" });
      expect(section).toHaveAttribute("data-column", CLEO);
    });
  });

  describe("cards (FR-422, FR-427)", () => {
    it("lists only the rewards this Profile is eligible for, in FR-427's order", () => {
      const affordableDear = reward({ name: "Ice cream", pointValue: 10 });
      const dear = reward({ name: "Bike", pointValue: 200 });
      const affordableCheap = reward({ name: "Sticker", pointValue: 5 });
      const cheapish = reward({ name: "Movie night", pointValue: 30 });
      const bensOnly = reward({ name: "Ben's thing", pointValue: 1, categoryIds: [BEN] });
      renderColumn({
        rewards: [dear, affordableDear, cheapish, bensOnly, affordableCheap],
        balance: 15,
      });

      expect(cardTitles()).toEqual(["Sticker", "Ice cream", "Movie night", "Bike"]);
      expect(cardStates()).toEqual(["redeem", "redeem", "bar", "bar"]);
      expect(screen.queryByText("Ben's thing")).not.toBeInTheDocument();
    });

    it("breaks a tie on cost by creation order", () => {
      const later = reward({ name: "Later", pointValue: 50, createdAt: "2026-08-20T00:00:00.000Z" });
      const earlier = reward({ name: "Earlier", pointValue: 50, createdAt: "2026-08-10T00:00:00.000Z" });
      renderColumn({ rewards: [later, earlier], balance: 0 });
      expect(cardTitles()).toEqual(["Earlier", "Later"]);
    });

    it("says so when this Profile has nothing to save for, instead of vanishing (FR-422)", () => {
      renderColumn({ rewards: [reward({ categoryIds: [BEN] })] });
      expect(screen.getByText("No rewards for Cleo yet")).toBeInTheDocument();
      expect(screen.queryAllByRole("listitem")).toHaveLength(0);
    });

    it("draws every card in this column's Profile and hands taps up with that Profile (FR-417)", () => {
      const cookies = reward({ name: "Cookies", pointValue: 10 });
      const { onOpen, onRedeem } = renderColumn({ rewards: [cookies], balance: 15 });

      fireEvent.click(screen.getByRole("button", { name: "Cookies" }));
      expect(onOpen.mock.calls[0]?.[0]).toEqual({
        reward: cookies,
        categoryId: CLEO,
        redemption: null,
      });

      fireEvent.click(screen.getByRole("button", { name: "Redeem Cookies for 10 stars" }));
      expect(onRedeem.mock.calls[0]?.[0]).toEqual({
        reward: cookies,
        categoryId: CLEO,
        redemption: null,
      });
    });

    it("marks the one card whose write is in flight, and no other (FR-441)", () => {
      const cookies = reward({ name: "Cookies", pointValue: 10 });
      const cake = reward({ name: "Cake", pointValue: 10 });
      renderColumn({
        rewards: [cookies, cake],
        balance: 15,
        busyKeys: new Set([rewardCardKeyOf({ reward: cookies, categoryId: CLEO })]),
      });
      expect(screen.getByRole("button", { name: "Redeem Cookies for 10 stars" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Redeem Cake for 10 stars" })).toBeEnabled();
    });
  });

  describe("redeemed (FR-425, FR-426)", () => {
    it("removes a redeemed one-time reward from the column while the switch is off", () => {
      const movie = reward({ name: "Movie night" });
      const cookies = reward({ name: "Cookies", respawnOnRedemption: true });
      renderColumn({
        rewards: [movie, cookies],
        redemptions: [redemption(movie)],
        showRedeemed: false,
      });
      expect(cardTitles()).toEqual(["Cookies"]);
    });

    it("shows it as one muted card, last, while the switch is on", () => {
      const movie = reward({ name: "Movie night" });
      const cookies = reward({ name: "Cookies", respawnOnRedemption: true });
      const standing = redemption(movie);
      const { onOpen } = renderColumn({
        rewards: [movie, cookies],
        redemptions: [standing],
        showRedeemed: true,
      });
      expect(cardTitles()).toEqual(["Cookies", "Movie night"]);
      expect(cardStates()).toEqual(["bar", "redeemed"]);
      expect(screen.getByText("Redeemed on Sep 27")).toBeInTheDocument();

      fireEvent.click(
        screen.getByRole("button", { name: "Movie night, Redeemed on September 27, 2026" }),
      );
      expect(onOpen.mock.calls[0]?.[0]).toEqual({
        reward: movie,
        categoryId: CLEO,
        redemption: standing,
      });
    });

    it("keeps a renewing reward's live card above its history, most recent first (FR-426)", () => {
      const cookies = reward({ name: "Cookies", respawnOnRedemption: true, pointValue: 10 });
      const older = redemption(cookies, {
        redeemedOn: "2026-09-20",
        redeemedAt: "2026-09-20T20:00:00.000Z",
      });
      const newer = redemption(cookies, {
        redeemedOn: "2026-09-27",
        redeemedAt: "2026-09-27T20:00:00.000Z",
      });
      renderColumn({
        rewards: [cookies],
        redemptions: [older, newer],
        balance: 15,
        showRedeemed: true,
      });
      expect(cardStates()).toEqual(["redeem", "redeemed", "redeemed"]);
      const dates = screen.getAllByText(/^Redeemed on/).map((node) => node.textContent);
      expect(dates).toEqual(["Redeemed on Sep 27", "Redeemed on Sep 20"]);
    });

    it("draws no history for a reversed redemption, and the one-time card comes back (FR-431)", () => {
      const movie = reward({ name: "Movie night" });
      renderColumn({
        rewards: [movie],
        redemptions: [redemption(movie, { reversedAt: "2026-09-28T00:00:00.000Z" })],
        showRedeemed: true,
      });
      expect(cardTitles()).toEqual(["Movie night"]);
      expect(cardStates()).toEqual(["bar"]);
    });

    it("draws only THIS Profile's history, and nothing for a redemption whose reward is gone", () => {
      const movie = reward({ name: "Movie night", categoryIds: [CLEO, BEN] });
      const gone = reward({ name: "Deleted" });
      renderColumn({
        rewards: [movie],
        redemptions: [redemption(movie, { categoryId: BEN }), redemption(gone)],
        showRedeemed: true,
      });
      expect(cardTitles()).toEqual(["Movie night"]);
      expect(cardStates()).toEqual(["bar"]);
    });

    it("keeps a Profile's history after their eligibility was edited away (FR-421's spirit)", () => {
      const movie = reward({ name: "Movie night", categoryIds: [BEN] });
      renderColumn({ rewards: [movie], redemptions: [redemption(movie)], showRedeemed: true });
      expect(cardTitles()).toEqual(["Movie night"]);
      expect(cardStates()).toEqual(["redeemed"]);
    });
  });
});
