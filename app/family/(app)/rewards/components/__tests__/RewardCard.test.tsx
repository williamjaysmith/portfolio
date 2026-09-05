import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { INK_DARK, INK_LIGHT, PALETTE, type PaletteColor } from "@/lib/family/colors";
import type { Redemption, Reward } from "@/lib/family/types";

import {
  RewardCard,
  redeemedOnLabelOf,
  rewardCardKeyOf,
  starsInWords,
  type RewardCardTarget,
} from "../RewardCard";

/**
 * 004 T034 — one reward card in one Profile's column (FR-423, FR-425).
 *
 * The card is dumb: the balance, the cost and the standing redemption all
 * arrive as props and the card only chooses between its three faces —
 * `rewardProgressOf`'s bar below the cost, the Redeem button at or above it,
 * never both (FR-423), and the muted "Redeemed on" card that offers nothing
 * but its details (FR-425). The three balances the task names — below, at and
 * above the cost — are each pinned here, as is a balance below zero, which
 * FR-413 says is shown honestly rather than clamped away.
 */

const SUNSHINE = PALETTE[1]; // #FBD97E — pale: dark ink at full strength
const BLUE = PALETTE[13]; // #2178AF — dark: white ink at full strength
const CLEO = "11111111-1111-4111-8111-111111111111";
const BEN = "33333333-3333-4333-8333-333333333333";

function reward(overrides: Partial<Reward> = {}): Reward {
  return {
    id: "reward-cookies",
    householdId: "household-1",
    name: "Bake cookies",
    description: "A whole tray, and you pick the recipe.",
    emoji: "🍪",
    pointValue: 20,
    respawnOnRedemption: true,
    categoryIds: [CLEO, BEN],
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
    rewardName: "Movie night",
    redeemedOn: "2026-09-27",
    redeemedAt: "2026-09-28T01:30:00.000Z",
    redeemedBy: CLEO,
    reversedAt: null,
    reversedBy: null,
    ...overrides,
  };
}

interface RenderOptions {
  reward?: Reward;
  balance?: number;
  accent?: PaletteColor;
  redemption?: Redemption | null;
  busy?: boolean;
}

function renderCard(options: RenderOptions = {}) {
  const onOpen = vi.fn<(target: RewardCardTarget) => void>();
  const onRedeem = vi.fn<(target: RewardCardTarget) => void>();
  render(
    <ul>
      <RewardCard
        reward={options.reward ?? reward()}
        categoryId={CLEO}
        accent={options.accent ?? SUNSHINE}
        balance={options.balance ?? 15}
        redemption={options.redemption ?? null}
        busy={options.busy ?? false}
        onOpen={onOpen}
        onRedeem={onRedeem}
      />
    </ul>,
  );
  return { onOpen, onRedeem };
}

/** The tinted surface everything sits on. */
function card(): HTMLElement {
  const root = screen.getByRole("listitem");
  if (!root.hasAttribute("data-reward-card")) throw new Error("the list item is not a card root");
  return root;
}

function bar(): HTMLElement {
  const found = card().querySelector<HTMLElement>("[data-reward-bar]");
  if (found === null) throw new Error("no bar on the card");
  return found;
}

describe("rewardCardKeyOf", () => {
  it("names one reward in one Profile's column, so two columns never share a key (FR-417)", () => {
    const cleo = rewardCardKeyOf({ reward: reward(), categoryId: CLEO });
    const ben = rewardCardKeyOf({ reward: reward(), categoryId: BEN });
    expect(cleo).not.toBe(ben);
    expect(cleo).toBe(rewardCardKeyOf({ reward: reward(), categoryId: CLEO }));
  });
});

describe("redeemedOnLabelOf", () => {
  it("reads the household day short on the card and long where there is room (FR-425, FR-433)", () => {
    expect(redeemedOnLabelOf("2026-09-27", "short")).toBe("Redeemed on Sep 27");
    expect(redeemedOnLabelOf("2026-09-27", "long")).toBe("Redeemed on September 27, 2026");
  });

  it("never shifts a plain date across midnight", () => {
    expect(redeemedOnLabelOf("2026-01-01", "long")).toBe("Redeemed on January 1, 2026");
  });
});

describe("starsInWords", () => {
  it("counts one star and many", () => {
    expect(starsInWords(1)).toBe("1 star");
    expect(starsInWords(20)).toBe("20 stars");
    expect(starsInWords(0)).toBe("0 stars");
  });
});

describe("RewardCard", () => {
  it("shows the emoji and the title, and never the description (FR-415, FR-423)", () => {
    renderCard();
    expect(screen.getByText("🍪")).toBeInTheDocument();
    expect(screen.getByText("Bake cookies")).toBeInTheDocument();
    expect(screen.queryByText(/whole tray/)).not.toBeInTheDocument();
  });

  it("draws a card without an emoji when the reward has none", () => {
    renderCard({ reward: reward({ emoji: null }) });
    expect(screen.getByText("Bake cookies")).toBeInTheDocument();
    expect(card().querySelector("[data-reward-emoji]")).toBeNull();
  });

  describe("below the cost", () => {
    it("draws the bar with the balance over the cost centred on it, and no Redeem button (FR-420, FR-423)", () => {
      renderCard({ balance: 15 });
      expect(card()).toHaveAttribute("data-state", "bar");
      expect(bar()).toHaveAttribute("data-filled", "0.75");
      expect(screen.getAllByText("☆ 15/20").length).toBeGreaterThan(0);
      expect(screen.queryByRole("button", { name: /^Redeem/ })).not.toBeInTheDocument();
    });

    it("says the bar's reading in the body control's name (FR-423)", () => {
      renderCard({ balance: 15 });
      expect(screen.getByRole("button", { name: "Bake cookies, ☆ 15/20" })).toBeInTheDocument();
    });

    it("keeps a negative balance honest: an empty bar with the number as it is (FR-413)", () => {
      renderCard({ balance: -5 });
      expect(bar()).toHaveAttribute("data-filled", "0");
      expect(screen.getByRole("button", { name: "Bake cookies, ☆ -5/20" })).toBeInTheDocument();
    });

    it("inks the label over the fill against the full-strength accent, and over the track in the card's ink (FR-398)", () => {
      renderCard({ balance: 15, accent: BLUE });
      const fill = bar().querySelector<HTMLElement>("[data-reward-bar-fill]");
      const overFill = bar().querySelector<HTMLElement>("[data-reward-bar-label='fill']");
      const overTrack = bar().querySelector<HTMLElement>("[data-reward-bar-label='track']");
      expect(fill?.style.width).toBe("75%");
      expect(overFill?.style.color).toBe(hexToRgb(INK_LIGHT));
      expect(overFill?.style.clipPath).toBe("inset(0 25% 0 0)");
      expect(overTrack?.style.color).toBe(hexToRgb(INK_DARK));
    });
  });

  describe("at the cost", () => {
    it("draws the Redeem button naming the cost, and no bar (FR-423)", () => {
      renderCard({ balance: 20 });
      expect(card()).toHaveAttribute("data-state", "redeem");
      expect(card().querySelector("[data-reward-bar]")).toBeNull();
      const redeem = screen.getByRole("button", { name: "Redeem Bake cookies for 20 stars" });
      expect(redeem).toHaveTextContent("Redeem");
      expect(redeem).toHaveTextContent("20");
      expect(redeem).toHaveClass("min-h-(--fam-touch)");
    });

    it("names the body control by the title alone, so the two controls are never confusable", () => {
      renderCard({ balance: 20 });
      expect(screen.getByRole("button", { name: "Bake cookies" })).toBeInTheDocument();
    });

    it("hands the tap on Redeem to the board with the reward and the Profile (FR-424)", () => {
      const { onRedeem, onOpen } = renderCard({ balance: 20 });
      fireEvent.click(screen.getByRole("button", { name: "Redeem Bake cookies for 20 stars" }));
      expect(onRedeem).toHaveBeenCalledTimes(1);
      expect(onRedeem.mock.calls[0]?.[0]).toEqual({
        reward: reward(),
        categoryId: CLEO,
        redemption: null,
      });
      expect(onOpen).not.toHaveBeenCalled();
    });

    it("disables Redeem while this card's write is in flight (FR-441)", () => {
      renderCard({ balance: 20, busy: true });
      const redeem = screen.getByRole("button", { name: "Redeem Bake cookies for 20 stars" });
      expect(redeem).toBeDisabled();
      expect(redeem).toHaveAttribute("aria-busy", "true");
    });
  });

  describe("above the cost", () => {
    it("draws the Redeem button and not a full bar (FR-423)", () => {
      renderCard({ balance: 25 });
      expect(card()).toHaveAttribute("data-state", "redeem");
      expect(card().querySelector("[data-reward-bar]")).toBeNull();
      expect(screen.getByRole("button", { name: "Redeem Bake cookies for 20 stars" })).toBeInTheDocument();
    });

    it("reads one star in the singular", () => {
      renderCard({ balance: 3, reward: reward({ pointValue: 1 }) });
      expect(screen.getByRole("button", { name: "Redeem Bake cookies for 1 star" })).toBeInTheDocument();
    });
  });

  describe("redeemed", () => {
    it("is muted, reads the household day it was redeemed on, and offers nothing but its details (FR-425)", () => {
      const { onOpen, onRedeem } = renderCard({ balance: 100, redemption: redemption() });
      expect(card()).toHaveAttribute("data-state", "redeemed");
      expect(card()).toHaveClass("opacity-(--fam-past-dim)");
      expect(card().querySelector("[data-reward-bar]")).toBeNull();
      expect(screen.queryByRole("button", { name: /^Redeem / })).not.toBeInTheDocument();
      expect(screen.getByText("Redeemed on Sep 27")).toBeInTheDocument();

      const body = screen.getByRole("button", {
        name: "Bake cookies, Redeemed on September 27, 2026",
      });
      fireEvent.click(body);
      expect(onOpen).toHaveBeenCalledTimes(1);
      expect(onOpen.mock.calls[0]?.[0]).toEqual({
        reward: reward(),
        categoryId: CLEO,
        redemption: redemption(),
      });
      expect(onRedeem).not.toHaveBeenCalled();
    });
  });

  it("opens details from the body on a live card, without redeeming (FR-423)", () => {
    const { onOpen, onRedeem } = renderCard({ balance: 15 });
    fireEvent.click(screen.getByRole("button", { name: "Bake cookies, ☆ 15/20" }));
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onOpen.mock.calls[0]?.[0]).toEqual({ reward: reward(), categoryId: CLEO, redemption: null });
    expect(onRedeem).not.toHaveBeenCalled();
  });
});

/** jsdom serialises inline colours as `rgb(r, g, b)`. */
function hexToRgb(hex: string): string {
  const value = Number.parseInt(hex.slice(1), 16);
  return `rgb(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255})`;
}
