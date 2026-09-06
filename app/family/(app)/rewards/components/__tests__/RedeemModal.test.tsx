import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { unredeemReward } from "@/lib/family/actions/rewards";
import { fail } from "@/lib/family/errors";
import { redemptionCelebration } from "@/lib/family/rewards/celebrations";
import type { Redemption } from "@/lib/family/types";

import type { FamilyContextValue } from "../../../components/FamilyProvider";
import { makeContext, stubDialog, withFamily } from "../../../components/__tests__/family-test-utils";
import { RedeemModal, type RedeemModalProps } from "../RedeemModal";

/**
 * 004 T041 — the photographed redeem modal (FR-432, FR-433, FR-438, FR-445;
 * 07 §4.13): "Great work! <Reward> redeemed", "By <Profile> for N stars on
 * <Month D, YYYY>", a primary Done and a secondary Unredeem, over a backdrop
 * that is WARMED rather than dimmed while the gold stars fall.
 *
 * The two lines are `redemptionCelebration`'s and are pinned against it here
 * so the modal cannot drift from the copy the pure function was tested for.
 * Unredeem goes through `useRedeem` — the tab's one commit path — and this
 * file proves that path from the tap: `withActor`, then `unredeemReward` with
 * the redemption's id alone, and the modal closing on success and staying
 * open, refusal shown, on anything else.
 *
 * The shower is `StarConfetti`'s (T042); what is proved here is where and
 * when it is mounted: once, as the dialog's own child, only while the shower
 * lasts, and never under reduced motion — with the wash tied to its lifetime.
 */

vi.mock("@/lib/family/actions/rewards", () => ({
  redeemReward: vi.fn(),
  unredeemReward: vi.fn(),
}));

// The shipped reduced-motion hook is framer-motion's; the test steers it and
// leaves the rest of the library real, so the entrance and the sprites render
// as they ship.
const motionPreference = vi.hoisted(() => ({ reduced: false as boolean | null }));

vi.mock("framer-motion", async (importOriginal) => {
  const actual = await importOriginal<typeof import("framer-motion")>();
  return { ...actual, useReducedMotion: () => motionPreference.reduced };
});

const unredeemMock = unredeemReward as Mock;

const CLEO = "11111111-1111-4111-8111-111111111111";
const COOKIES = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

/** The stagger's ceiling plus the longest fall — when the last sprite has faded (StarConfetti.test). */
const SHOWER_MS = 1500 + 4000;

const WASH_CLASS = "backdrop:bg-(--fam-redeem-wash)";

function redemption(overrides: Partial<Redemption> = {}): Redemption {
  return {
    id: "redemption-1",
    householdId: "household-1",
    rewardId: COOKIES,
    categoryId: CLEO,
    pointValue: 20,
    rewardName: "Bake cookies",
    redeemedOn: "2026-03-22",
    redeemedAt: "2026-03-23T01:30:00.000Z",
    redeemedBy: CLEO,
    reversedAt: null,
    reversedBy: null,
    ...overrides,
  };
}

interface RenderOptions {
  props?: Partial<RedeemModalProps>;
  withActor?: FamilyContextValue["withActor"];
}

function renderModal(options: RenderOptions = {}) {
  const onClose = vi.fn();
  const props: RedeemModalProps = {
    redemption: redemption(),
    emoji: "🍪",
    profileName: "Ella",
    onClose,
    ...options.props,
  };
  const context = makeContext(options.withActor === undefined ? {} : { withActor: options.withActor });
  const view = render(withFamily(context, <RedeemModal {...props} />));
  return { onClose, ...view };
}

function dialog(): HTMLElement {
  return screen.getByRole("dialog", { hidden: true });
}

function confettiLayers(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>("[data-star-confetti]"));
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
  motionPreference.reduced = false;
  unredeemMock.mockResolvedValue({
    ok: true,
    data: redemption({ reversedAt: "2026-03-23T01:35:00.000Z", reversedBy: CLEO }),
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("RedeemModal", () => {
  describe("the copy (FR-432, FR-433)", () => {
    it("reads the two lines from the redemption, exactly as redemptionCelebration writes them", () => {
      renderModal();
      const expected = redemptionCelebration(redemption(), "Ella");

      expect(screen.getByRole("heading", { name: expected.title })).toBeInTheDocument();
      expect(screen.getByText(expected.subtitle)).toBeInTheDocument();
      // Pinned in words too, so a drift in the pure function is caught here as well.
      expect(expected.title).toBe("Great work! Bake cookies redeemed");
      expect(expected.subtitle).toBe("By Ella for 20 stars on March 22, 2026");
    });

    it("names the Profile redeemed FOR and the cost as it was stored, not the reward's (FR-424, FR-428)", () => {
      renderModal({ props: { redemption: redemption({ pointValue: 1, rewardName: "Sticker" }), profileName: "Ben" } });

      expect(screen.getByRole("heading", { name: "Great work! Sticker redeemed" })).toBeInTheDocument();
      expect(screen.getByText("By Ben for 1 star on March 22, 2026")).toBeInTheDocument();
    });

    it("draws the reward's emoji large, as decoration, and nothing when it has none", () => {
      const { unmount } = renderModal();
      const emoji = document.querySelector("[data-redeem-emoji]");
      expect(emoji).toHaveTextContent("🍪");
      expect(emoji).toHaveAttribute("aria-hidden", "true");
      expect(emoji?.className).toContain("text-(length:--fam-redeem-emoji)");
      unmount();

      renderModal({ props: { emoji: null } });
      expect(document.querySelector("[data-redeem-emoji]")).toBeNull();
    });
  });

  describe("the frame (FR-445; 07 §4.13)", () => {
    it("is a modal dialog labelled by its title, at the photographed box on the reward tokens", () => {
      renderModal();
      const frame = dialog();

      expect(frame).toHaveAttribute("aria-labelledby", "redeem-modal-title");
      expect(frame.className).toContain("rounded-(--fam-redeem-modal-r)");
      expect(frame.className).toContain("var(--fam-redeem-modal-w)");
      expect(frame.className).toContain("p-(--fam-redeem-modal-pad)");
      // The height is a target the content may exceed, so it sits on the body
      // inside the frame as a minimum, never on the frame as a clip.
      expect(frame.firstElementChild?.className).toContain("min-h-(--fam-redeem-modal-h)");
    });

    it("offers a primary Done and a secondary Unredeem, each at least 44 points tall", () => {
      renderModal();
      const done = screen.getByRole("button", { name: "Done" });
      const unredeem = screen.getByRole("button", { name: "Unredeem" });

      // The heights are the [SAMPLED] 76 / 72 units floored at --fam-touch in tokens.css.
      expect(done).toHaveClass("min-h-(--fam-redeem-btn-h)");
      expect(done).toHaveClass("bg-(--fam-primary-blue)");
      expect(unredeem).toHaveClass("min-h-(--fam-redeem-btn-secondary-h)");
      expect(unredeem).toHaveClass("bg-(--fam-btn-secondary-bg)");
      // Done is the primary: it comes first and holds the initial focus.
      const buttons = screen.getAllByRole("button").map((button) => button.textContent);
      expect(buttons).toEqual(["Done", "Unredeem"]);
      expect(done).toHaveFocus();
    });

    it("closes from Done and from Escape", () => {
      const { onClose } = renderModal();

      fireEvent.click(screen.getByRole("button", { name: "Done" }));
      expect(onClose).toHaveBeenCalledTimes(1);

      fireEvent(dialog(), new Event("cancel", { cancelable: true }));
      expect(onClose).toHaveBeenCalledTimes(2);
    });
  });

  describe("Unredeem through the one commit path (FR-431)", () => {
    it("puts the redemption back through withActor with its id alone, and closes", async () => {
      const withActor = vi.fn(async (run: () => Promise<unknown>) => run());
      const { onClose } = renderModal({ withActor: withActor as FamilyContextValue["withActor"] });

      await press("Unredeem");

      expect(withActor).toHaveBeenCalledTimes(1);
      expect(unredeemMock).toHaveBeenCalledTimes(1);
      expect(unredeemMock).toHaveBeenCalledWith({ redemptionId: "redemption-1" });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("stays open and shows a refusal where the tap happened", async () => {
      const message = "That's Cleo's reward — only Cleo or a parent can redeem it.";
      unredeemMock.mockResolvedValue(fail("FORBIDDEN", message));
      const { onClose } = renderModal();

      await press("Unredeem");

      expect(onClose).not.toHaveBeenCalled();
      expect(screen.getByRole("alert")).toHaveTextContent(message);
    });

    it("stays open and says nothing when the punch-in sheet is dismissed", async () => {
      const { onClose } = renderModal({ withActor: async () => fail("NO_ACTOR") });

      await press("Unredeem");

      expect(unredeemMock).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("holds the button while the write is in flight", async () => {
      let settle: (value: unknown) => void = () => undefined;
      unredeemMock.mockReturnValue(
        new Promise((resolve) => {
          settle = resolve;
        }),
      );
      renderModal();

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Unredeem" }));
      });
      const button = screen.getByRole("button", { name: "Unredeem" });
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute("aria-busy", "true");

      await act(async () => {
        settle({ ok: true, data: redemption() });
      });
    });
  });

  describe("the shower and the wash (FR-438, R408)", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    it("mounts the stars once, as the dialog's own child, and warms the backdrop while they fall", () => {
      renderModal();

      const layers = confettiLayers();
      expect(layers).toHaveLength(1);
      // A direct child of <dialog>: outside the animated wrapper (a transformed
      // ancestor would shrink the fixed layer to the modal) and inside the top
      // layer (a sibling outside would paint under the dialog's backdrop).
      expect(layers[0].parentElement).toBe(dialog());
      expect(dialog().className).toContain(WASH_CLASS);
    });

    it("ends the wash with the last sprite, and does not dim in its place", () => {
      renderModal();

      act(() => {
        vi.advanceTimersByTime(SHOWER_MS - 1);
      });
      expect(confettiLayers()).toHaveLength(1);
      expect(dialog().className).toContain(WASH_CLASS);

      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(confettiLayers()).toHaveLength(0);
      expect(dialog().className).not.toContain(WASH_CLASS);
      // "NOT dimmed — the screen behind stays bright" (07 §4.13).
      expect(dialog().className).not.toContain("backdrop:bg-black");
      expect(dialog().className).toContain("backdrop:bg-transparent");
      // The modal itself stays until Done.
      expect(screen.getByRole("heading", { name: /Great work!/ })).toBeInTheDocument();
    });

    it("mounts no stars and no wash under a reduced-motion preference (FR-438, FR-445)", () => {
      motionPreference.reduced = true;
      renderModal();

      act(() => {
        vi.advanceTimersByTime(0);
      });
      expect(confettiLayers()).toHaveLength(0);
      expect(document.querySelectorAll("[data-sprite]")).toHaveLength(0);
      expect(dialog().className).not.toContain(WASH_CLASS);
      // The modal's copy is untouched: the celebration collapses to nothing, not to less.
      expect(screen.getByRole("heading", { name: /Great work!/ })).toBeInTheDocument();
    });

    it("does not restart the shower when the parent re-renders", () => {
      const { rerender } = renderModal();
      act(() => {
        vi.advanceTimersByTime(3000);
      });

      rerender(
        withFamily(
          makeContext(),
          <RedeemModal redemption={redemption()} emoji="🍪" profileName="Ella" onClose={vi.fn()} />,
        ),
      );
      expect(confettiLayers()).toHaveLength(1);

      act(() => {
        vi.advanceTimersByTime(SHOWER_MS - 3000);
      });
      expect(confettiLayers()).toHaveLength(0);
    });
  });
});
