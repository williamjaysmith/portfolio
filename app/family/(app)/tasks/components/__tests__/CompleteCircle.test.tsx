import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";

import { PALETTE } from "@/lib/family/colors";

import { CompleteCircle } from "../CompleteCircle";

/**
 * T041 — FR-348's circle: a white circle to the right of the name while it is
 * outstanding, a disc in the credited Profile's own accent under a white check
 * once it is done.
 *
 * Every colour here is a token, and deliberately so. `--fam-profile-deep` is
 * the accent's own channels scaled toward black (FR-398's "how much deeper",
 * never another hue) and `task-tokens.test.ts` already proves it carries a
 * white checkmark at 4.5:1 across all twenty accents — so this suite asserts
 * that the circle CONSUMES those tokens rather than re-deriving anything, and
 * the arithmetic stays proved in one place (T038 owns `tokens.css`).
 */

const BLUE = PALETTE[13];

function renderCircle(overrides: Partial<ComponentProps<typeof CompleteCircle>> = {}) {
  const onToggle = vi.fn();
  render(
    <CompleteCircle
      state="unresolved"
      accent={BLUE}
      summary="Brush teeth"
      onToggle={onToggle}
      {...overrides}
    />,
  );
  return { onToggle };
}

function circle(name: string | RegExp = /Brush teeth/): HTMLElement {
  return screen.getByRole("button", { name });
}

function disc(): HTMLElement {
  const drawn = circle().querySelector("[data-disc]");
  if (drawn === null) throw new Error("the circle draws no disc");
  return drawn as HTMLElement;
}

describe("CompleteCircle", () => {
  it("draws a white circle edged in the card's own ink while unresolved (FR-348)", () => {
    renderCircle();

    expect(circle("Complete Brush teeth")).toHaveAttribute("data-state", "unresolved");
    // White on a 40 % tint is 1.13:1, so the edge is what makes the circle
    // exist at all — and it is the ink TaskCard already chose for this fill.
    expect(disc().className).toContain("bg-(--fam-app-bg)");
    expect(disc().className).toContain("border-(--fam-task-ink)");
  });

  it("fills the disc with the deepened accent under a white check when complete (FR-348)", () => {
    renderCircle({ state: "complete" });

    expect(circle("Mark Brush teeth incomplete")).toHaveAttribute("data-state", "complete");
    expect(disc().className).toContain("bg-(--fam-profile-deep)");
    expect(disc().querySelector("svg")).not.toBeNull();
  });

  it("falls back to the card ink when there is no accent to deepen (FR-308)", () => {
    // Up for Grabs belongs to nobody, so `--fam-profile-deep` is not declared
    // anywhere above this circle — a completed disc there would be invisible.
    renderCircle({ state: "complete", accent: null });
    expect(disc().className).not.toContain("--fam-profile-deep");
    expect(disc().className).toContain("bg-(--fam-task-ink)");
  });

  it("marks a skipped occurrence as neither outstanding nor complete (FR-360)", () => {
    renderCircle({ state: "skipped" });

    expect(circle()).toHaveAttribute("data-state", "skipped");
    expect(disc().querySelector("svg")).not.toBeNull();
  });

  it("keeps a hit area larger than the drawn circle (FR-397)", () => {
    renderCircle();

    // The token itself is `max(var(--fam-touch), …)`, so the floor travels with
    // the token rather than being restated here.
    expect(circle().className).toContain("h-(--fam-task-circle-hit)");
    expect(circle().className).toContain("w-(--fam-task-circle-hit)");
    expect(disc().className).toContain("h-(--fam-task-circle-d)");
  });

  it("reports a tap so the board can pick the verb this state implies", () => {
    const { onToggle } = renderCircle({ accent: null });

    fireEvent.click(circle("Complete Brush teeth"));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("refuses a second tap while the first write is in flight (FR-393)", () => {
    const { onToggle } = renderCircle({ busy: true });

    expect(circle()).toHaveAttribute("aria-busy", "true");
    fireEvent.click(circle());
    expect(onToggle).not.toHaveBeenCalled();
  });

  it("is always rendered — permission is the server's answer, not a hidden control (FR-350)", () => {
    // There is deliberately no permission prop: FR-350 forbids hiding the
    // control as the mechanism, and FR-351's refusal arrives as a message.
    renderCircle();
    expect(screen.getAllByRole("button", { name: /Brush teeth/ })).toHaveLength(1);
  });
});
