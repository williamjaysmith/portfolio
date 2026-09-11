import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LateBadge, lateSpokenOf } from "../LateBadge";

/**
 * T061 — FR-358's late treatment.
 *
 * **The printed date is gone and the spoken one is not.** A carried
 * occurrence's own date is its identity (FR-357), but the operator asked for
 * the pill to say one word: *"doesnt need to say the date because you can see
 * date when you click on it, it can just say late"*. So the date moved to
 * `lateSpokenOf`, which the CARD folds into its own accessible name — the badge
 * now sits inside a button carrying an explicit `aria-label`, and anything
 * inside such a button is announced by nobody.
 *
 * The colours themselves are proved in `task-tokens.test.ts`, which reads the
 * declarations out of `tokens.css` (T038 owns that file). This suite asserts
 * that the badge CONSUMES those tokens and re-derives nothing.
 */

const TOKENS = ["bg-(--fam-late-fill)", "text-(--fam-late-ink)", "border-(--fam-late-edge)"];

function badge(): HTMLElement {
  const found = document.querySelector("[data-late-badge]");
  if (!(found instanceof HTMLElement)) throw new Error("no late badge rendered");
  return found;
}

describe("LateBadge (FR-358, US3-1)", () => {
  it("says one word, and prints no date", () => {
    render(<LateBadge dueDate="2026-09-01" late />);
    expect(badge()).toHaveTextContent("Late");
    // The width this buys is the whole point: on a phone the card had 224px and
    // wanted 289px, and "· Sep 1" was part of what it wanted it for.
    expect(badge().textContent).toBe("Late");
    expect(screen.queryByText(/Sep/)).toBeNull();
  });

  it("is hidden from the reading order, because the card speaks for it", () => {
    render(<LateBadge dueDate="2026-09-01" late />);
    expect(badge()).toHaveAttribute("aria-hidden", "true");
  });

  it("is drawn in the late tokens and re-derives nothing", () => {
    render(<LateBadge dueDate="2026-09-01" late />);
    const className = badge().className;
    for (const token of TOKENS) expect(className).toContain(token);
    // `--fam-late-fill` IS `--fam-danger` now (the operator's call, recorded in
    // tokens.css), but the badge must still reach it through the late token so
    // the two can be told apart again without touching this component.
    expect(className).not.toContain("danger");
  });

  it("draws nothing at all on an occurrence that is not late", () => {
    render(<LateBadge dueDate="2026-09-01" late={false} />);
    expect(document.querySelector("[data-late-badge]")).toBeNull();
  });

  it("draws nothing on an anytime chore, however long it sits (FR-328, US3-4)", () => {
    // An anytime chore has no date at all, so it is structurally incapable of
    // showing one — the badge cannot be applied to it by mistake.
    render(<LateBadge dueDate={null} late />);
    expect(document.querySelector("[data-late-badge]")).toBeNull();
  });
});

/**
 * The spoken half, which the card folds into its own name. It lives beside the
 * badge so the date format and the "an anytime chore is never late" rule cannot
 * drift apart from the thing they describe.
 */
describe("lateSpokenOf", () => {
  it("says the whole date, so nothing is lost by the pill going quiet", () => {
    expect(lateSpokenOf("2026-09-01", true)).toBe("Late — due September 1, 2026");
  });

  it("carries the year, so a chore carried across New Year still reads", () => {
    expect(lateSpokenOf("2025-12-30", true)).toBe("Late — due December 30, 2025");
  });

  it("says nothing under exactly the conditions the badge draws nothing", () => {
    expect(lateSpokenOf("2026-09-01", false)).toBeNull();
    expect(lateSpokenOf(null, true)).toBeNull();
  });
});
