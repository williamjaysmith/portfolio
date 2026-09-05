import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LateBadge } from "../LateBadge";

/**
 * T061 — FR-358's late treatment.
 *
 * Two things are load-bearing and neither is decoration. The badge shows the
 * date the occurrence was DUE, not the day it is drawn on, because a carried
 * occurrence's own date is its identity (FR-357). And it is drawn in the ochre
 * late tokens rather than in `--fam-danger`, because a red pill on a card reads
 * as "delete this" — which is the one thing tapping it must not mean.
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
  it("shows the date the occurrence was DUE, not the day it is drawn on", () => {
    render(<LateBadge dueDate="2026-09-01" late />);
    expect(badge()).toHaveTextContent("Sep 1");
  });

  it("says the whole date to a screen reader, and marks it as late", () => {
    render(<LateBadge dueDate="2026-09-01" late />);
    expect(screen.getByText("Late — due September 1, 2026")).toHaveClass("sr-only");
  });

  it("carries the year with it, so a chore carried across New Year still reads", () => {
    render(<LateBadge dueDate="2025-12-30" late />);
    expect(badge()).toHaveTextContent("Dec 30");
    expect(screen.getByText(/December 30, 2025/)).toBeInTheDocument();
  });

  it("is drawn in the late tokens and NOT in the destructive colour", () => {
    render(<LateBadge dueDate="2026-09-01" late />);
    const className = badge().className;
    for (const token of TOKENS) expect(className).toContain(token);
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
