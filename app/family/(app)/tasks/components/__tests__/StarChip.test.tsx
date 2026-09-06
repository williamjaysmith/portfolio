import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StarChip, starsWorthOf } from "../StarChip";

/**
 * T025 — FR-403's gold star chip, as a leaf.
 *
 * The chip is dumb: it is handed the task's stored value and draws the pill or
 * nothing. The ONE rule it owns — a value of `null` or `0` is "worth nothing"
 * and draws no chip (FR-402) — is asserted here on both the drawn half and the
 * spoken half, because the two must agree: a card that shows a chip the name
 * does not mention, or names a value the face does not show, says two
 * different things to two audiences. Where the chip is drawn and how its value
 * reaches the card's accessible name is `TaskCard.test.tsx`'s.
 */

function chip(): HTMLElement | null {
  const found = document.querySelector("[data-star-chip]");
  return found instanceof HTMLElement ? found : null;
}

function drawnChip(): HTMLElement {
  const found = chip();
  if (found === null) throw new Error("no star chip rendered");
  return found;
}

describe("StarChip (FR-403, SC-418)", () => {
  it("draws the value with a filled gold star at 5", () => {
    render(<StarChip count={5} />);

    expect(drawnChip()).toHaveTextContent("5");
    const star = drawnChip().querySelector("svg");
    expect(star).not.toBeNull();
    // Filled, not outlined — the photograph's "⭐ 10" is a solid star — and
    // inked with the verified palette gold rather than the card's own ink.
    expect(star).toHaveAttribute("fill", "currentColor");
    expect(star?.getAttribute("class")).toContain("text-(--fam-star-gold)");
  });

  it("draws nothing at all on a card worth nothing — null and 0 alike (FR-402)", () => {
    const { rerender } = render(<StarChip count={null} />);
    expect(chip()).toBeNull();

    rerender(<StarChip count={0} />);
    expect(chip()).toBeNull();
  });

  it("is hidden from the reading order, because the card's name says the value once", () => {
    render(<StarChip count={5} />);

    expect(drawnChip()).toHaveAttribute("aria-hidden", "true");
  });

  it("consumes the shipped badge geometry rather than a second pill (R406, R414)", () => {
    render(<StarChip count={5} />);
    const className = drawnChip().className;

    // One badge shape for the late mark, the streak and the chip, so a card
    // carrying more than one reads as one family of marks (Assumption 17).
    expect(className).toContain("h-(--fam-task-badge-h)");
    expect(className).toContain("rounded-(--fam-task-badge-r)");
    expect(className).toContain("px-(--fam-task-badge-pad)");
    expect(className).toContain("border-(--fam-task-ink)");
  });
});

describe("starsWorthOf", () => {
  it("names the value the way the card's accessible name folds it in", () => {
    expect(starsWorthOf(5)).toBe("worth 5 stars");
  });

  it("says one star in the singular", () => {
    expect(starsWorthOf(1)).toBe("worth 1 star");
  });

  it("has nothing to say for a card worth nothing — the same rule as the drawn half", () => {
    expect(starsWorthOf(null)).toBeNull();
    expect(starsWorthOf(0)).toBeNull();
  });
});
