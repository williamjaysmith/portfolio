import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { INK_DARK, PALETTE, inkOn, mixWithWhite, type PaletteColor } from "@/lib/family/colors";
import { resolutionKeyOf } from "@/lib/family/tasks/resolutions";
import type { BoardOccurrence } from "@/lib/family/types";

import { TaskCard, occurrenceKeyOf } from "../TaskCard";

/**
 * T041 — the card's states (FR-348, FR-349, FR-358, FR-360), the two taps it
 * distinguishes (FR-352), and what it must NOT show (FR-321).
 *
 * The card is dumb: every value it draws arrives as a prop, so these tests pin
 * the rendering rules and nothing else. The one thing it COMPUTES is
 * `--fam-task-ink`, and it has to: `tokens.css` says so in as many words,
 * because six of the twenty accents flip to white ink at full strength and
 * none of them does at 40 %, which no stylesheet can decide (FR-398).
 */

const SUNSHINE = PALETTE[1]; // #FBD97E — pale: dark ink at both tints
const BLUE = PALETTE[13]; // #2178AF — dark: white ink at full strength
const TODAY = "2026-09-04";

function occurrence(overrides: Partial<BoardOccurrence> = {}): BoardOccurrence {
  return {
    rewardPoints: null,
    taskId: "task-brush",
    assigneeId: "cleo",
    scheduledDate: TODAY,
    slot: "morning",
    cyclePrev: null,
    displayedDate: TODAY,
    isLate: false,
    summary: "Brush teeth",
    description: "Two minutes, top and bottom",
    emoji: "🪥",
    routine: true,
    upForGrabs: false,
    trackHabit: true,
    dueTime: null,
    dueAt: null,
    isRepeating: true,
    taskCreatedAt: "2026-08-01T12:00:00.000Z",
    state: "unresolved",
    creditedCategoryId: null,
    ...overrides,
  };
}

function renderCard(
  one: BoardOccurrence,
  accent: PaletteColor | null = SUNSHINE,
  extra: { progress?: { complete: number; total: number } | null; busy?: boolean } = {},
) {
  const onOpen = vi.fn();
  const onResolve = vi.fn();
  render(
    <TaskCard
      occurrence={one}
      accent={accent}
      progress={extra.progress ?? null}
      busy={extra.busy ?? false}
      onOpen={onOpen}
      onResolve={onResolve}
    />,
  );
  return { onOpen, onResolve };
}

/**
 * The card's BODY — the control that opens details (FR-352). It is addressed
 * by its accessible name, which is the title alone; the circle beside it is
 * named for its action, so the two are never confusable.
 */
function body(name: string = "Brush teeth"): HTMLElement {
  return screen.getByRole("button", { name });
}

/** The card itself: the tinted surface the body and the circle both sit on. */
function card(): HTMLElement {
  const root = body().closest("[data-task-card]");
  if (root === null) throw new Error("the card body is not inside a card root");
  return root as HTMLElement;
}

describe("occurrenceKeyOf", () => {
  it("is the store's own five-column occurrence identity (FR-353)", () => {
    const one = occurrence({ cyclePrev: "res-7" });
    expect(occurrenceKeyOf(one)).toBe(
      resolutionKeyOf({
        taskId: one.taskId,
        assigneeId: one.assigneeId,
        occurrenceDate: one.scheduledDate,
        slot: one.slot,
        cyclePrev: one.cyclePrev,
      }),
    );
  });

  it("separates a routine's two slots on one day", () => {
    expect(occurrenceKeyOf(occurrence({ slot: "morning" }))).not.toBe(
      occurrenceKeyOf(occurrence({ slot: "evening" })),
    );
  });
});

describe("TaskCard", () => {
  it("shows the emoji and the title, and never the description (FR-320, FR-321)", () => {
    renderCard(occurrence());

    expect(screen.getByText("Brush teeth")).toBeInTheDocument();
    expect(screen.getByText("🪥")).toBeInTheDocument();
    expect(screen.queryByText("Two minutes, top and bottom")).not.toBeInTheDocument();
  });

  it("draws an incomplete card at the 40 % tint with ink chosen against it (FR-349, FR-398)", () => {
    renderCard(occurrence(), SUNSHINE);

    expect(card()).toHaveAttribute("data-state", "unresolved");
    expect(card().className).toContain("fam-tint-40");
    expect(card().style.getPropertyValue("--fam-task-ink")).toBe(
      inkOn(mixWithWhite(SUNSHINE, 0.4)),
    );
    expect(card().style.getPropertyValue("--profile")).toBe(SUNSHINE);
  });

  it("darkens a completed card to the full accent, ink re-chosen (FR-349, FR-398)", () => {
    renderCard(occurrence({ state: "complete", creditedCategoryId: "cleo" }), BLUE);

    expect(card()).toHaveAttribute("data-state", "complete");
    expect(card().className).toContain("fam-tint-100");
    // Blue at full strength takes white ink; at 40 % it takes dark — one card,
    // two fills, two answers, and only `inkOn` can give them (FR-398).
    expect(card().style.getPropertyValue("--fam-task-ink")).toBe(inkOn(BLUE));
  });

  it("cross-fades declaratively, so reduced motion collapses it (FR-349, FR-397)", () => {
    // tokens.css collapses every declarative transition inside `.family` AND
    // the duration token itself; a script-driven fade would opt out of both.
    renderCard(occurrence());
    expect(card().className).toContain("transition-colors");
    expect(card().className).toContain("duration-(--fam-task-fade-ms)");
  });

  it("marks a carried-forward occurrence late (FR-358)", () => {
    renderCard(occurrence({ isLate: true, scheduledDate: "2026-09-01", routine: false }));
    expect(card()).toHaveAttribute("data-late", "true");
  });

  it("shows the date it was DUE on the late card, not the day it is drawn on (T063, US3-1)", () => {
    // Drawn on today, due on the 1st: the badge names the 1st, because that is
    // the occurrence's own identity and the reason it is here at all.
    renderCard(
      occurrence({ isLate: true, scheduledDate: "2026-09-01", displayedDate: TODAY, routine: false }),
    );
    const badge = card().querySelector("[data-late-badge]");
    expect(badge).not.toBeNull();
    expect(badge).toHaveTextContent("Sep 1");
  });

  it("draws no late badge on an occurrence due the day it is drawn on", () => {
    renderCard(occurrence({ routine: false }));
    expect(card().querySelector("[data-late-badge]")).toBeNull();
  });

  it("never marks an anytime chore late, however long it sits (FR-328)", () => {
    renderCard(occurrence({ routine: false, scheduledDate: null, slot: null, isLate: false }));
    expect(card()).not.toHaveAttribute("data-late");
  });

  it("marks a skipped occurrence distinctly (FR-360, FR-361)", () => {
    renderCard(occurrence({ state: "skipped" }));
    expect(card()).toHaveAttribute("data-state", "skipped");
  });

  it("renders neutrally with no accent — Up for Grabs belongs to nobody (FR-308)", () => {
    renderCard(occurrence({ assigneeId: null, upForGrabs: true, routine: false }), null);

    expect(card()).toHaveAttribute("data-variant", "neutral");
    expect(card().className).not.toContain("fam-tint-40");
    expect(card().style.getPropertyValue("--fam-task-ink")).toBe(INK_DARK);
    expect(card().style.getPropertyValue("--profile")).toBe("");
  });

  it("opens details on a tap of the body and resolves on a tap of the circle (FR-352)", () => {
    const one = occurrence();
    const { onOpen, onResolve } = renderCard(one);

    fireEvent.click(body());
    expect(onOpen).toHaveBeenCalledWith(one);
    expect(onResolve).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Complete Brush teeth" }));
    expect(onResolve).toHaveBeenCalledWith(one);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("keeps the body a focusable control at the card's own minimum height (FR-397)", () => {
    renderCard(occurrence());

    expect(body().tagName).toBe("BUTTON");
    expect(body().className).toContain("min-h-(--fam-task-card-min-h)");
  });

  it("shows a routine's own progress for the displayed day (FR-312)", () => {
    renderCard(occurrence(), SUNSHINE, { progress: { complete: 1, total: 3 } });

    expect(screen.getByText("1/3")).toBeInTheDocument();
    expect(body("Brush teeth, 1 of 3 complete")).toBeInTheDocument();
  });

  it("shows no per-routine progress on a chore", () => {
    renderCard(occurrence({ routine: false, slot: null }), SUNSHINE, { progress: null });
    expect(screen.queryByText(/^\d+\/\d+$/)).not.toBeInTheDocument();
  });

  it("passes the busy state down to the circle while a write is in flight (FR-393)", () => {
    renderCard(occurrence(), SUNSHINE, { busy: true });

    expect(body()).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Complete Brush teeth" })).toHaveAttribute(
      "aria-busy",
      "true",
    );
  });

  describe("the star chip (FR-403, SC-418)", () => {
    function chip(): HTMLElement | null {
      const found = document.querySelector("[data-star-chip]");
      return found instanceof HTMLElement ? found : null;
    }

    it("draws a gold star chip reading 5 beside the title of a card worth 5", () => {
      renderCard(occurrence({ rewardPoints: 5 }));

      const drawn = chip();
      expect(drawn).not.toBeNull();
      expect(drawn).toHaveTextContent("5");
      // Beside the TITLE, inside the body control — where the photograph puts
      // it — rather than out at the card's edge with the late pill.
      expect(drawn?.closest("button")).toBe(body("Brush teeth, worth 5 stars"));
    });

    it("folds the value into the body's accessible name, said once", () => {
      renderCard(occurrence({ rewardPoints: 5 }));

      expect(body("Brush teeth, worth 5 stars")).toBeInTheDocument();
      // The chip itself is hidden, so the digits are not read a second time
      // after the name has already said them.
      expect(chip()).toHaveAttribute("aria-hidden", "true");
    });

    it("draws no chip on a card worth nothing — null and 0 alike (FR-402)", () => {
      renderCard(occurrence({ rewardPoints: null }));
      expect(chip()).toBeNull();
      expect(body("Brush teeth")).toBeInTheDocument();

      cleanup();

      renderCard(occurrence({ rewardPoints: 0 }));
      expect(chip()).toBeNull();
      expect(body("Brush teeth")).toBeInTheDocument();
    });

    it("says the value after the marks the card already spoke", () => {
      renderCard(occurrence({ rewardPoints: 5 }), SUNSHINE, {
        progress: { complete: 1, total: 3 },
      });

      expect(body("Brush teeth, 1 of 3 complete, worth 5 stars")).toBeInTheDocument();
    });
  });
});
