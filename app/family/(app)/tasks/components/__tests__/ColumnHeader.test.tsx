import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PALETTE } from "@/lib/family/colors";
import { starsTodayOf } from "@/lib/family/rewards/stars";
import type { Category, StarEntry, StarEntryKind } from "@/lib/family/types";

import { ColumnHeader } from "../ColumnHeader";
import type { SectionToggles } from "../useSectionToggles";

/**
 * 004 T027 — FR-407's star pill on a Profile's column header, beside the
 * completed-of-total pill the photograph pairs it with ("✓ 2/20 · ⭐ 10").
 *
 * The header is a leaf: it is handed the day's number and draws it, exactly as
 * it is handed FR-305's counters and draws those. So the three numbers the
 * task names — 15 after a 5 + 10 day, 5 after a retraction, 0 with none — are
 * produced here by the SAME `starsTodayOf` the board's counters memo runs
 * (`use-board-occurrences.test.ts`), and what this file proves is that the
 * number reaching the header is the number a person sees and hears. Where the
 * pill is NOT drawn — the Up for Grabs column — is `TasksBoard.test.tsx`'s.
 */

const CLEO = "11111111-1111-4111-8111-111111111111";
const TODAY = "2026-09-04";

const ALL_ON: SectionToggles = { morning: true, afternoon: true, evening: true, chores: true };

const CATEGORY: Category = {
  id: CLEO,
  householdId: "household-1",
  label: "Cleo",
  color: PALETTE[1],
  isProfile: true,
  avatarKind: null,
  avatarId: null,
  avatarPath: null,
  birthday: null,
  dietaryPrefs: null,
  role: "member",
  userId: null,
  emoji: null,
  showOnTasks: true,
  sortOrder: 1,
  hasPin: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

let sequence = 0;

/** One of Cleo's ledger rows for today — a credit, or the retraction of one. */
function entry(kind: StarEntryKind, amount: number): StarEntry {
  sequence += 1;
  return {
    id: `entry-${sequence}`,
    householdId: "household-1",
    categoryId: CLEO,
    amount,
    kind,
    earnedOn: TODAY,
    resolutionId: `resolution-${sequence}`,
    redemptionId: null,
    summary: "Brush teeth",
    createdBy: CLEO,
    enteredOn: TODAY,
    createdAt: `${TODAY}T12:00:00.000Z`,
  };
}

function renderHeader(entries: readonly StarEntry[]) {
  render(
    <ColumnHeader
      category={CATEGORY}
      counters={{ complete: 1, total: 3 }}
      starsToday={starsTodayOf(entries, CLEO, TODAY)}
      toggles={ALL_ON}
      onToggleSection={vi.fn()}
    />,
  );
}

function header(): HTMLElement {
  return screen.getByRole("group", { name: "Cleo" });
}

function starPill(): HTMLElement {
  const found = header().querySelector("[data-star-pill]");
  if (!(found instanceof HTMLElement)) throw new Error("no star pill rendered");
  return found;
}

describe("ColumnHeader — the star pill (FR-407)", () => {
  it("reads 15 after a 5 + 10 day, beside the completed-of-total pill (US1-3, US1-5)", () => {
    renderHeader([entry("credit", 5), entry("credit", 10)]);

    expect(within(header()).getByLabelText("15 stars earned")).toHaveTextContent("15");
    // Beside, not below: the two pills share one row, as the photograph has them.
    const count = within(header()).getByLabelText("1 of 3 complete");
    expect(starPill().parentElement).toBe(count.parentElement);
    expect(starPill().className).toBe(count.className);
  });

  it("drops to 5 after a retraction — the un-tick's reversing entry (US1-4, FR-408)", () => {
    renderHeader([entry("credit", 5), entry("credit", 10), entry("retraction", -10)]);

    expect(within(header()).getByLabelText("5 stars earned")).toHaveTextContent("5");
  });

  it("reads 0 with none, and still draws the pill", () => {
    renderHeader([]);

    // A header with no star pill would read as broken rather than as a day
    // with nothing earned yet — the same reasoning as FR-316's 0/0.
    expect(within(header()).getByLabelText("0 stars earned")).toHaveTextContent("0");
  });

  it("says star, singular, for exactly one", () => {
    renderHeader([entry("credit", 1)]);

    expect(within(header()).getByLabelText("1 star earned")).toHaveTextContent("1");
  });

  it("draws a filled gold star that the label already speaks for", () => {
    renderHeader([entry("credit", 10)]);

    const star = starPill().querySelector("svg");
    expect(star).not.toBeNull();
    expect(star).toHaveAttribute("fill", "currentColor");
    expect(star).toHaveAttribute("aria-hidden", "true");
    expect(star?.getAttribute("class")).toContain("text-(--fam-star-gold)");
  });
});
