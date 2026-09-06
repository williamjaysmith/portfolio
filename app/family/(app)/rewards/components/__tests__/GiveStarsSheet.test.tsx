import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// The real `fail`, not the test helper's: only this one carries `fieldErrors`,
// which is what the server's `P0004` re-wording actually looks like.
import { fail } from "@/lib/family/errors";
import { balanceMapOf, beforeAndAfterOf } from "@/lib/family/rewards/stars";
import type { Category, StarBalance } from "@/lib/family/types";

import { ok } from "../../../components/__tests__/action-result";
import { makeCategory, stubDialog } from "../../../components/__tests__/family-test-utils";
import { GiveStarsSheet, type GiveStarsSheetProps } from "../GiveStarsSheet";

/**
 * 004 T046 — the Give-stars sheet (FR-434, FR-435, FR-436, SC-412), driven
 * against a mocked `onSubmit` (the board hands it `adjustStars` through
 * `withActor`).
 *
 * What is pinned here:
 *   - the picker offers PROFILES only — a Label among what is passed in is
 *     simply not offered (FR-414, FR-434);
 *   - the before-and-after table IS `beforeAndAfterOf` over the balances the
 *     tab holds, one row per chosen Profile in the household's order, for two
 *     Profiles and a negative amount; a row that would end below zero is
 *     flagged and Confirm is held while any is (FR-436, SC-412);
 *   - the submitted shape is the contract's — the ids in the household's
 *     order and the amount as a NUMBER — and a success closes the sheet;
 *   - the server's refusal — `P0004` re-worded against `amount`, naming the
 *     Profile — is shown at the amount field with the sheet left open;
 *   - the schema's own refusals land before the network: nobody chosen, a
 *     blank, 0, and a number past 500;
 *   - and an abandoned punch-in shows nothing.
 */

const CLEO = "11111111-1111-4111-8111-111111111111";
const BEN = "33333333-3333-4333-8333-333333333333";
const ANA = "44444444-4444-4444-8444-444444444444";

/** The whole household, Label included — what the board passes is `profiles`, but a careless caller might not. */
const HOUSEHOLD: Category[] = [
  makeCategory({ id: CLEO, label: "Cleo", role: "member", sortOrder: 1000 }),
  makeCategory({ id: BEN, label: "Ben", role: "member", sortOrder: 2000 }),
  makeCategory({ id: ANA, label: "Ana", sortOrder: 3000 }),
  // FR-414: a Label has no balance and is never given stars.
  makeCategory({ id: "label-bins", label: "Bin day", isProfile: false, sortOrder: 4000 }),
];

/** Cleo 15, Ben 40; Ana has no row, which the tab reads as 0 (R402). */
const BALANCES: StarBalance[] = [
  { categoryId: CLEO, balance: 15 },
  { categoryId: BEN, balance: 40 },
];

function renderSheet(overrides: Partial<GiveStarsSheetProps> = {}) {
  const onSubmit = vi.fn().mockResolvedValue(ok([]));
  const onClose = vi.fn();
  render(
    <GiveStarsSheet
      profiles={overrides.profiles ?? HOUSEHOLD}
      balances={overrides.balances ?? balanceMapOf(BALANCES)}
      onSubmit={overrides.onSubmit ?? onSubmit}
      onClose={overrides.onClose ?? onClose}
    />,
  );
  return { onSubmit, onClose };
}

function picker(): HTMLElement {
  return screen.getByRole("group", { name: "Profiles" });
}

function choose(name: string): void {
  fireEvent.click(within(picker()).getByRole("checkbox", { name }));
}

function typeAmount(value: string): void {
  fireEvent.change(screen.getByLabelText("Stars"), { target: { value } });
}

async function confirm(): Promise<void> {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
  });
}

/**
 * Submit past the browser's own range check, which jsdom also runs: on a real
 * device the native bubble comes first; what is pinned is the schema's refusal.
 */
async function submitForm(): Promise<void> {
  const form = screen.getByRole("dialog").querySelector("form");
  await act(async () => {
    fireEvent.submit(form as HTMLFormElement);
  });
}

/** What a screen reader would be told: the alerts with something in them (the footer's line is always mounted). */
function spokenAlerts(): string[] {
  return screen
    .queryAllByRole("alert")
    .map((alert) => alert.textContent ?? "")
    .filter((text) => text !== "");
}

/** One drawn row of the table, as a person reads it. */
interface DrawnRow {
  name: string;
  before: string;
  after: string;
  belowZero: boolean;
}

/** The table's body rows in drawn order. */
function tableRows(): DrawnRow[] {
  const table = screen.getByRole("table", { name: "Before and after" });
  return within(table)
    .getAllByRole("row")
    .filter((row) => row.querySelector("td") !== null)
    .map((row) => {
      const cells = Array.from(row.querySelectorAll("td")).map((cell) => cell.textContent ?? "");
      return {
        name: cells[0],
        before: cells[1],
        // The number alone — a flagged row says "Below zero" beside it.
        after: row.querySelector("[data-after]")?.textContent ?? "",
        belowZero: row.getAttribute("data-below-zero") === "true",
      };
    });
}

beforeAll(() => {
  stubDialog();
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GiveStarsSheet", () => {
  describe("the Profiles (FR-414, FR-434)", () => {
    it("offers every Profile in the household's order, and never a Label", () => {
      renderSheet();

      expect(within(picker()).getAllByRole("checkbox")).toHaveLength(3);
      expect(within(picker()).getByRole("checkbox", { name: "Cleo" })).toBeInTheDocument();
      expect(within(picker()).getByRole("checkbox", { name: "Ben" })).toBeInTheDocument();
      expect(within(picker()).getByRole("checkbox", { name: "Ana" })).toBeInTheDocument();
      expect(within(picker()).queryByRole("checkbox", { name: "Bin day" })).toBeNull();
    });

    it("asks for a Profile before anything is sent", async () => {
      const { onSubmit } = renderSheet();
      typeAmount("5");

      await confirm();

      expect(onSubmit).not.toHaveBeenCalled();
      expect(within(picker()).getByRole("alert")).toHaveTextContent("Choose at least one Profile.");
    });
  });

  describe("the before-and-after table (FR-434, FR-436, SC-412)", () => {
    it("shows nothing to compare until a Profile is chosen", () => {
      renderSheet();

      expect(screen.queryByRole("table")).toBeNull();
      expect(screen.getByText("Choose a Profile to see the change.")).toBeInTheDocument();
    });

    it("equals beforeAndAfterOf for two Profiles and a negative amount, and flags the row below zero", () => {
      renderSheet();
      choose("Ben");
      choose("Cleo");
      typeAmount("-20");

      // The ids in the household's order, whatever order they were ticked in.
      const expected = beforeAndAfterOf(balanceMapOf(BALANCES), [CLEO, BEN], -20);
      expect(expected.rows.map((row) => row.belowZero)).toEqual([true, false]);
      expect(tableRows()).toEqual([
        { name: "Cleo", before: "15", after: "-5", belowZero: true },
        { name: "Ben", before: "40", after: "20", belowZero: false },
      ]);
      expect(tableRows().map((row) => Number(row.after))).toEqual(
        expected.rows.map((row) => row.after),
      );
      // FR-436: the write will be refused, so the sheet does not offer it.
      expect(screen.getByRole("button", { name: "Confirm" })).toBeDisabled();
    });

    it("reads 0 for a Profile with no row, and moves with the amount", () => {
      renderSheet();
      choose("Ana");
      typeAmount("3");

      expect(tableRows()).toEqual([{ name: "Ana", before: "0", after: "3", belowZero: false }]);
      expect(screen.getByRole("button", { name: "Confirm" })).toBeEnabled();

      typeAmount("-1");
      expect(tableRows()).toEqual([{ name: "Ana", before: "0", after: "-1", belowZero: true }]);
      expect(screen.getByRole("button", { name: "Confirm" })).toBeDisabled();
    });

    it("shows before as after while the amount box is blank or half-typed", () => {
      renderSheet();
      choose("Cleo");

      expect(tableRows()).toEqual([{ name: "Cleo", before: "15", after: "15", belowZero: false }]);

      typeAmount("-");
      expect(tableRows()).toEqual([{ name: "Cleo", before: "15", after: "15", belowZero: false }]);
    });
  });

  describe("the commit (FR-434, FR-436)", () => {
    it("sends the chosen ids in the household's order and the amount as a number, and closes on success", async () => {
      const { onSubmit, onClose } = renderSheet();
      choose("Ben");
      choose("Cleo");
      typeAmount("-10");

      await confirm();

      expect(onSubmit).toHaveBeenCalledTimes(1);
      expect(onSubmit).toHaveBeenCalledWith({ categoryIds: [CLEO, BEN], amount: -10 });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("shows the server's refusal at the amount field, naming the Profile, and stays open", async () => {
      const message = "That would leave Cleo below zero.";
      const onSubmit = vi.fn().mockResolvedValue(fail("VALIDATION", message, { amount: [message] }));
      const { onClose } = renderSheet({ onSubmit });
      choose("Cleo");
      // The table is clean — the balance moved on another device (FR-436's race).
      typeAmount("-10");

      await confirm();

      expect(onSubmit).toHaveBeenCalledTimes(1);
      const field = screen.getByLabelText("Stars").closest("[data-field='amount']");
      expect(field).not.toBeNull();
      expect(within(field as HTMLElement).getByRole("alert")).toHaveTextContent(message);
      // Said once, at the field — not repeated on the footer's line.
      expect(spokenAlerts()).toEqual([message]);
      expect(onClose).not.toHaveBeenCalled();
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("shows a refusal with no field on the footer's line", async () => {
      const onSubmit = vi.fn().mockResolvedValue(fail("FORBIDDEN"));
      const { onClose } = renderSheet({ onSubmit });
      choose("Cleo");
      typeAmount("5");

      await confirm();

      expect(screen.getByRole("alert")).toHaveTextContent("Only a parent can change this.");
      expect(onClose).not.toHaveBeenCalled();
    });

    it("shows nothing when the punch-in was dismissed", async () => {
      const onSubmit = vi.fn().mockResolvedValue(null);
      const { onClose } = renderSheet({ onSubmit });
      choose("Cleo");
      typeAmount("5");

      await confirm();

      expect(onSubmit).toHaveBeenCalledTimes(1);
      expect(spokenAlerts()).toEqual([]);
      expect(onClose).not.toHaveBeenCalled();
    });

    it.each([
      ["", "Enter a whole number of stars."],
      ["0", "Enter a number other than 0."],
      ["2.5", "Enter a whole number of stars."],
      ["501", "Stars must be between -500 and 500."],
    ])("refuses %j at the amount field before anything is sent", async (typed, expected) => {
      const { onSubmit } = renderSheet();
      choose("Cleo");
      typeAmount(typed);

      await submitForm();

      expect(onSubmit).not.toHaveBeenCalled();
      const field = screen.getByLabelText("Stars").closest("[data-field='amount']");
      expect(within(field as HTMLElement).getByRole("alert")).toHaveTextContent(expected);
    });

    it("closes on Cancel and on Escape without sending anything", async () => {
      const { onSubmit, onClose } = renderSheet();

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
      });
      expect(onClose).toHaveBeenCalledTimes(1);

      await act(async () => {
        fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
      });
      expect(onClose).toHaveBeenCalledTimes(2);
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });
});
