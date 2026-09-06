import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// The real `fail`, not the test helper's: only this one carries `fieldErrors`,
// which is what a VALIDATION result from the server actually looks like.
import { fail } from "@/lib/family/errors";
import type { Category, Reward } from "@/lib/family/types";
import type { RewardInput } from "@/lib/family/validation";

import { ok } from "../../../components/__tests__/action-result";
import { makeCategory, stubDialog } from "../../../components/__tests__/family-test-utils";
import { RewardForm, type RewardFormProps } from "../RewardForm";
import { rewardDraftOf } from "../useRewardForm";

/**
 * T036 — the create/edit reward form, driven against a mocked `onSubmit` (the
 * board hands it the real actions through `withActor`).
 *
 * What is pinned here:
 *   - FR-415's six fields in FR-415's order: title, description, emoji, star
 *     cost, Renew after redeeming, eligible Profiles;
 *   - the eligibility picker listing PROFILES only — a Label among what is
 *     passed in is simply not offered (FR-414, FR-415);
 *   - refusals landing against their field with every other entry preserved
 *     (FR-415, FR-416): an empty title, no eligible Profile, a cost outside
 *     1–500 or not a whole number — each once, in the field's own slot;
 *   - the submitted shape being the contract's `RewardInput` — the cost as a
 *     NUMBER, blank optionals as null, the ids in the household's order;
 *   - the edit form pre-filled from a stored reward (`rewardDraftOf`);
 *   - and the settle path: saved closes, refused shows, abandoned shows nothing.
 */

const ANA = "11111111-1111-4111-8111-111111111111";
const CLEO = "22222222-2222-4222-8222-222222222222";
const BEN = "33333333-3333-4333-8333-333333333333";
const BIN_DAY = "44444444-4444-4444-8444-444444444444";
/** A Profile deleted on another device — no longer among those offered. */
const GONE = "66666666-6666-4666-8666-666666666666";

/** The whole household, Label included — what a careless caller might pass. */
const HOUSEHOLD: Category[] = [
  makeCategory({ id: ANA, label: "Ana", sortOrder: 1000 }),
  makeCategory({ id: CLEO, label: "Cleo", role: "member", sortOrder: 2000 }),
  makeCategory({ id: BEN, label: "Ben", role: "member", sortOrder: 3000 }),
  // FR-414: a Label has no balance and is never eligible.
  makeCategory({ id: BIN_DAY, label: "Bin day", isProfile: false, sortOrder: 4000 }),
];

const COST_RANGE = "Cost must be a whole number from 1 to 500.";
const CHOOSE_A_PROFILE = "Choose at least one Profile.";

/** A stored reward, for the edit form's pre-fill. */
function rewardOf(overrides: Partial<Reward> = {}): Reward {
  return {
    id: "55555555-5555-4555-8555-555555555555",
    householdId: "household-1",
    name: "Movie night",
    description: "Pick the film and the snacks.",
    emoji: "🍿",
    pointValue: 15,
    respawnOnRedemption: true,
    categoryIds: [CLEO, BEN],
    createdBy: null,
    updatedBy: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function renderForm(overrides: Partial<RewardFormProps> = {}) {
  const onSubmit = vi.fn().mockResolvedValue(ok(null));
  const onClose = vi.fn();
  render(
    <RewardForm
      mode={overrides.mode ?? "create"}
      seed={overrides.seed}
      profiles={overrides.profiles ?? HOUSEHOLD}
      onSubmit={overrides.onSubmit ?? onSubmit}
      onClose={overrides.onClose ?? onClose}
    />,
  );
  return { onSubmit, onClose };
}

function type(field: HTMLElement, value: string): void {
  fireEvent.change(field, { target: { value } });
}

function clickSave(): void {
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
}

function submitted(onSubmit: ReturnType<typeof vi.fn>): RewardInput {
  return onSubmit.mock.calls[0][0] as RewardInput;
}

function pick(name: string): void {
  fireEvent.click(screen.getByRole("checkbox", { name }));
}

/** The minimum a valid reward needs: a title, a cost, one Profile. */
function fillMinimal(): void {
  type(screen.getByLabelText("Title"), "Bake cookies");
  type(screen.getByLabelText("Star cost"), "20");
  pick("Cleo");
}

/**
 * Submits past the browser's own range check, which a real device runs first
 * on a `type="number"` box. Under test is the schema's refusal — the same slot
 * a server refusal lands in — not the browser's tooltip.
 */
function submitPastNativeChecks(): void {
  const form = screen.getByLabelText("Title").closest("form");
  if (form === null) throw new Error("The form is not there.");
  fireEvent.submit(form);
}

/** The cost field's own block — the label, the guidance and the refusal slot. */
function costBlock(): HTMLElement {
  const block = screen.getByLabelText("Star cost").closest("div");
  if (block === null) throw new Error("The cost field has no block of its own.");
  return block;
}

function eligibilityGroup(): HTMLElement {
  return screen.getByRole("group", { name: "Eligible Profiles" });
}

function expectBefore(earlier: HTMLElement, later: HTMLElement): void {
  const position = earlier.compareDocumentPosition(later);
  expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
}

describe("RewardForm", () => {
  beforeEach(() => {
    stubDialog();
  });

  /** FR-415's six fields, in FR-415's order, read off the rendered document. */
  it("lays the six fields out in FR-415's order", () => {
    renderForm();
    const order = [
      screen.getByLabelText("Title"),
      screen.getByLabelText("Description (optional)"),
      screen.getByLabelText("Emoji (optional)"),
      screen.getByLabelText("Star cost"),
      screen.getByRole("switch", { name: "Renew after redeeming" }),
      eligibilityGroup(),
    ];
    for (let i = 1; i < order.length; i += 1) expectBefore(order[i - 1], order[i]);
    expect(screen.getByRole("heading", { name: "Add a reward" })).toBeInTheDocument();
  });

  it("puts the range beside the cost, as the field's own description (FR-416)", () => {
    renderForm();
    const cost = screen.getByLabelText("Star cost");
    expect(cost).toHaveAttribute("type", "number");
    expect(cost).toHaveAttribute("min", "1");
    expect(cost).toHaveAttribute("max", "500");
    expect(cost).toHaveAccessibleDescription(/1 to 500/);
  });

  describe("the eligibility picker offers Profiles only (FR-414, FR-415)", () => {
    it("lists the Profiles passed in and never a Label", () => {
      renderForm();
      const picker = eligibilityGroup();
      expect(within(picker).getByRole("checkbox", { name: "Ana" })).toBeInTheDocument();
      expect(within(picker).getByRole("checkbox", { name: "Cleo" })).toBeInTheDocument();
      expect(within(picker).getByRole("checkbox", { name: "Ben" })).toBeInTheDocument();
      expect(within(picker).queryByRole("checkbox", { name: "Bin day" })).toBeNull();
      // Nothing is pre-chosen: a reward is for whoever the parent says (FR-415).
      const boxes = within(picker).getAllByRole<HTMLInputElement>("checkbox");
      expect(boxes.every((box) => !box.checked)).toBe(true);
    });

    it("submits the chosen ids in the household's order, whatever the click order", async () => {
      const { onSubmit } = renderForm();
      type(screen.getByLabelText("Title"), "Ice cream");
      type(screen.getByLabelText("Star cost"), "25");
      pick("Ben");
      pick("Ana");
      clickSave();

      await waitFor(() => expect(onSubmit).toHaveBeenCalled());
      expect(submitted(onSubmit).categoryIds).toEqual([ANA, BEN]);
    });

    it("a second tap on a chosen Profile takes them back out", async () => {
      const { onSubmit } = renderForm();
      fillMinimal();
      pick("Ana");
      pick("Ana");
      clickSave();

      await waitFor(() => expect(onSubmit).toHaveBeenCalled());
      expect(submitted(onSubmit).categoryIds).toEqual([CLEO]);
    });
  });

  describe("what is sent is the contract's RewardInput", () => {
    it("sends a NUMBER cost, a boolean switch, and null for blank optionals", async () => {
      const { onSubmit } = renderForm();
      fillMinimal();
      clickSave();

      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
      expect(submitted(onSubmit)).toEqual({
        name: "Bake cookies",
        description: null,
        emoji: null,
        pointValue: 20,
        respawnOnRedemption: false,
        categoryIds: [CLEO],
      });
    });

    it("carries every optional that was given, trimmed", async () => {
      const { onSubmit } = renderForm();
      fillMinimal();
      type(screen.getByLabelText("Description (optional)"), "  Choose any recipe.  ");
      type(screen.getByLabelText("Emoji (optional)"), "🍪");
      fireEvent.click(screen.getByRole("switch", { name: "Renew after redeeming" }));
      clickSave();

      await waitFor(() => expect(onSubmit).toHaveBeenCalled());
      expect(submitted(onSubmit)).toMatchObject({
        description: "Choose any recipe.",
        emoji: "🍪",
        respawnOnRedemption: true,
      });
    });
  });

  describe("refusals land against their field and keep the rest (FR-415, FR-416)", () => {
    it("refuses an empty title locally, before the network is touched", async () => {
      const { onSubmit } = renderForm();
      type(screen.getByLabelText("Star cost"), "20");
      pick("Cleo");
      type(screen.getByLabelText("Description (optional)"), "with sprinkles");
      clickSave();

      await waitFor(() => expect(screen.getByText("Title is required.")).toBeInTheDocument());
      expect(onSubmit).not.toHaveBeenCalled();
      expect(screen.getByLabelText("Description (optional)")).toHaveValue("with sprinkles");
      expect(screen.getByRole("checkbox", { name: "Cleo" })).toBeChecked();
    });

    it("refuses a reward with no eligible Profile, on the picker itself (FR-415)", async () => {
      const { onSubmit } = renderForm();
      type(screen.getByLabelText("Title"), "Bake cookies");
      type(screen.getByLabelText("Star cost"), "20");
      clickSave();

      await waitFor(() =>
        expect(within(eligibilityGroup()).getByRole("alert")).toHaveTextContent(CHOOSE_A_PROFILE),
      );
      expect(onSubmit).not.toHaveBeenCalled();
      expect(screen.getByLabelText("Title")).toHaveValue("Bake cookies");
      expect(screen.getByLabelText("Star cost")).toHaveValue(20);
    });

    it.each(["", "0", "501", "-3", "2.5"])(
      "refuses a cost of %p locally against its own field, once, and keeps everything else",
      async (value) => {
        const { onSubmit } = renderForm();
        fillMinimal();
        type(screen.getByLabelText("Star cost"), value);
        submitPastNativeChecks();

        await waitFor(() =>
          expect(within(costBlock()).getByRole("alert")).toHaveTextContent(COST_RANGE),
        );
        // Field-anchored, so the form-level line does not say it a second time.
        const said = screen.getAllByRole("alert").filter((one) => one.textContent === COST_RANGE);
        expect(said).toHaveLength(1);
        expect(onSubmit).not.toHaveBeenCalled();
        expect(screen.getByLabelText("Title")).toHaveValue("Bake cookies");
        expect(screen.getByRole("checkbox", { name: "Cleo" })).toBeChecked();
      },
    );

    it("refuses more than one emoji, on the emoji field", async () => {
      const { onSubmit } = renderForm();
      fillMinimal();
      type(screen.getByLabelText("Emoji (optional)"), "🍪🍪");
      clickSave();

      await waitFor(() =>
        expect(screen.getByText("Emoji must be a single emoji.")).toBeInTheDocument(),
      );
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it("shows a server refusal against the field the server named", async () => {
      const onSubmit = vi
        .fn()
        .mockResolvedValue(fail("VALIDATION", "Nope.", { pointValue: [COST_RANGE] }));
      renderForm({ onSubmit });
      fillMinimal();
      clickSave();

      await waitFor(() =>
        expect(within(costBlock()).getByRole("alert")).toHaveTextContent(COST_RANGE),
      );
      expect(screen.getByLabelText("Star cost")).toHaveValue(20);
      expect(screen.getByLabelText("Title")).toHaveValue("Bake cookies");
    });

    it("shows a refusal with no field on the form's own line and stays open (FR-419)", async () => {
      const onSubmit = vi.fn().mockResolvedValue(fail("FORBIDDEN"));
      const { onClose } = renderForm({ onSubmit });
      fillMinimal();
      clickSave();

      await waitFor(() =>
        expect(screen.getByRole("alert")).toHaveTextContent("Only a parent can change this."),
      );
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe("how a submit settles", () => {
    it("closes on a save", async () => {
      const { onClose } = renderForm();
      fillMinimal();
      clickSave();
      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    });

    it("shows nothing and stays open when the commit was abandoned", async () => {
      const onSubmit = vi.fn().mockResolvedValue(null);
      const { onClose } = renderForm({ onSubmit });
      fillMinimal();
      clickSave();

      await waitFor(() => expect(onSubmit).toHaveBeenCalled());
      expect(onClose).not.toHaveBeenCalled();
      expect(screen.getByRole("alert")).toBeEmptyDOMElement();
      expect(screen.getByLabelText("Title")).toHaveValue("Bake cookies");
    });

    it("closes without submitting when Cancel is pressed", () => {
      const { onSubmit, onClose } = renderForm();
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
      expect(onClose).toHaveBeenCalled();
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });

  describe("the edit form is pre-filled from the reward (FR-418)", () => {
    it("shows every stored field as it is, under an edit heading", () => {
      renderForm({ mode: "edit", seed: rewardDraftOf(rewardOf()) });

      expect(screen.getByRole("heading", { name: "Edit reward" })).toBeInTheDocument();
      expect(screen.getByLabelText("Title")).toHaveValue("Movie night");
      expect(screen.getByLabelText("Description (optional)")).toHaveValue(
        "Pick the film and the snacks.",
      );
      expect(screen.getByLabelText("Emoji (optional)")).toHaveValue("🍿");
      expect(screen.getByLabelText("Star cost")).toHaveValue(15);
      expect(screen.getByRole("switch", { name: "Renew after redeeming" })).toBeChecked();
      expect(screen.getByRole("checkbox", { name: "Cleo" })).toBeChecked();
      expect(screen.getByRole("checkbox", { name: "Ben" })).toBeChecked();
      expect(screen.getByRole("checkbox", { name: "Ana" })).not.toBeChecked();
    });

    it("a reward with no description or emoji edits as blank fields", () => {
      const seed = rewardDraftOf(rewardOf({ description: null, emoji: null }));
      renderForm({ mode: "edit", seed });
      expect(screen.getByLabelText("Description (optional)")).toHaveValue("");
      expect(screen.getByLabelText("Emoji (optional)")).toHaveValue("");
    });

    it("submits the whole reward as it now stands, for the caller to patch with", async () => {
      const { onSubmit } = renderForm({ mode: "edit", seed: rewardDraftOf(rewardOf()) });
      type(screen.getByLabelText("Star cost"), "30");
      pick("Ben");
      clickSave();

      await waitFor(() => expect(onSubmit).toHaveBeenCalled());
      expect(submitted(onSubmit)).toEqual({
        name: "Movie night",
        description: "Pick the film and the snacks.",
        emoji: "🍿",
        pointValue: 30,
        respawnOnRedemption: true,
        categoryIds: [CLEO],
      });
    });

    it("refuses an edit that empties the eligible Profiles (FR-415)", async () => {
      const { onSubmit } = renderForm({ mode: "edit", seed: rewardDraftOf(rewardOf()) });
      pick("Cleo");
      pick("Ben");
      clickSave();

      await waitFor(() =>
        expect(within(eligibilityGroup()).getByRole("alert")).toHaveTextContent(CHOOSE_A_PROFILE),
      );
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it("drops an eligible id that is no longer one of the Profiles offered", async () => {
      // The Profile was deleted on another device; the seed still names them.
      const seed = rewardDraftOf(rewardOf({ categoryIds: [CLEO, GONE] }));
      const { onSubmit } = renderForm({ mode: "edit", seed });
      clickSave();

      await waitFor(() => expect(onSubmit).toHaveBeenCalled());
      expect(submitted(onSubmit).categoryIds).toEqual([CLEO]);
    });
  });
});
