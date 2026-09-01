import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AVATAR_LABELS } from "@/lib/family/avatars";
import { PALETTE, PALETTE_NAMES } from "@/lib/family/colors";
// The real `fail`, not the test helper's: only this one carries `fieldErrors`,
// which is what a VALIDATION result from the server actually looks like.
import { fail } from "@/lib/family/errors";
import type { Category } from "@/lib/family/types";

import type { FamilyContextValue } from "../FamilyProvider";
import { ok } from "./action-result";
import { makeCategory, makeContext, stubDialog, withFamily } from "./family-test-utils";

const createCategory = vi.fn();
const updateCategory = vi.fn();
vi.mock("@/lib/family/actions/categories", () => ({
  createCategory: (...args: unknown[]) => createCategory(...args),
  updateCategory: (...args: unknown[]) => updateCategory(...args),
}));

const { CategoryForm } = await import("../settings/CategoryForm");

interface FormOptions {
  mode?: "create" | "edit";
  kind?: "profile" | "label";
  existing?: Category;
  forceParent?: boolean;
  context?: FamilyContextValue;
}

function renderForm(options: FormOptions = {}) {
  const onClose = vi.fn();
  render(
    withFamily(
      options.context ?? makeContext(),
      <CategoryForm
        mode={options.mode ?? "create"}
        kind={options.kind ?? "profile"}
        existing={options.existing}
        forceParent={options.forceParent}
        onClose={onClose}
      />,
    ),
  );
  return onClose;
}

function type(field: HTMLElement, value: string): void {
  fireEvent.change(field, { target: { value } });
}

function clickSave(): void {
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
}

describe("CategoryForm", () => {
  beforeEach(() => {
    stubDialog();
    createCategory.mockReset().mockResolvedValue(ok(makeCategory()));
    updateCategory.mockReset().mockResolvedValue(ok(makeCategory()));
  });

  /**
   * FR-019 / FR-023: one record type, two shapes. The split lives in three
   * places — this form, the Zod schemas, and the database CHECK constraints —
   * and they have to agree, so the form must never offer a field the row
   * cannot hold.
   */
  describe("which fields exist", () => {
    it("asks a profile for the things only a person has", () => {
      renderForm({ kind: "profile" });

      expect(screen.getByRole("heading", { name: "Add a Profile" })).toBeInTheDocument();
      expect(screen.getByLabelText("Name")).toBeInTheDocument();
      expect(screen.getByRole("radiogroup", { name: "Colour" })).toBeInTheDocument();
      expect(screen.getByRole("radiogroup", { name: "Avatar" })).toBeInTheDocument();
      expect(screen.getByLabelText("Birthday (optional)")).toBeInTheDocument();
      expect(screen.getByLabelText("Dietary notes (optional)")).toBeInTheDocument();
      expect(screen.getByRole("radio", { name: "parent" })).toBeInTheDocument();
      expect(screen.getByRole("radio", { name: "member" })).toBeInTheDocument();
      expect(screen.getByRole("switch", { name: "Show on Tasks tab" })).toBeInTheDocument();
    });

    it("never offers a profile an emoji", () => {
      renderForm({ kind: "profile" });
      expect(screen.queryByLabelText("Emoji (optional)")).toBeNull();
    });

    it("offers a label an emoji and nothing person-shaped", () => {
      renderForm({ kind: "label" });

      expect(screen.getByRole("heading", { name: "Add a Label" })).toBeInTheDocument();
      expect(screen.getByLabelText("Label name")).toBeInTheDocument();
      expect(screen.getByLabelText("Emoji (optional)")).toBeInTheDocument();
      expect(screen.queryByRole("radiogroup", { name: "Avatar" })).toBeNull();
      expect(screen.queryByLabelText("Birthday (optional)")).toBeNull();
      expect(screen.queryByLabelText("Dietary notes (optional)")).toBeNull();
      expect(screen.queryByRole("radio", { name: "parent" })).toBeNull();
      expect(screen.queryByRole("radio", { name: "member" })).toBeNull();
    });
  });

  describe("creating", () => {
    it("saves the typed name, the chosen colour and the picked illustration", async () => {
      const onClose = renderForm({ kind: "profile" });

      type(screen.getByLabelText("Name"), "Kit");
      fireEvent.click(screen.getByRole("radio", { name: PALETTE_NAMES[PALETTE[5]] }));
      fireEvent.click(screen.getByRole("radio", { name: AVATAR_LABELS.bunny }));
      clickSave();

      await waitFor(() => expect(createCategory).toHaveBeenCalledTimes(1));
      expect(createCategory).toHaveBeenCalledWith(
        expect.objectContaining({
          isProfile: true,
          label: "Kit",
          color: PALETTE[5],
          avatar: { kind: "illustration", id: "bunny" },
        }),
      );
      await waitFor(() => expect(onClose).toHaveBeenCalled());
    });

    /**
     * Blank means "not set". An empty string would be a value, and the DB
     * CHECKs reject a label that carries person fields — or a birthday of "".
     */
    it("sends untouched optional text as null, not as an empty string", async () => {
      renderForm({ kind: "profile" });

      type(screen.getByLabelText("Name"), "Kit");
      type(screen.getByLabelText("Dietary notes (optional)"), "   ");
      clickSave();

      await waitFor(() => expect(createCategory).toHaveBeenCalledTimes(1));
      expect(createCategory).toHaveBeenCalledWith(
        expect.objectContaining({ birthday: null, dietaryPrefs: null, emoji: null }),
      );
    });

    it("sends a label with no emoji as null, and never a person's fields", async () => {
      renderForm({ kind: "label" });

      type(screen.getByLabelText("Label name"), "Holidays");
      clickSave();

      await waitFor(() => expect(createCategory).toHaveBeenCalledTimes(1));
      expect(createCategory).toHaveBeenCalledWith({
        isProfile: false,
        label: "Holidays",
        color: PALETTE[0],
        avatar: null,
        emoji: null,
        birthday: null,
        dietaryPrefs: null,
        role: "member",
        showOnTasks: true,
      });
    });

    it("keeps the emoji a label was given", async () => {
      renderForm({ kind: "label" });

      type(screen.getByLabelText("Label name"), "Holidays");
      type(screen.getByLabelText("Emoji (optional)"), "🎉");
      clickSave();

      await waitFor(() =>
        expect(createCategory).toHaveBeenCalledWith(expect.objectContaining({ emoji: "🎉" })),
      );
    });

    /**
     * Every mutating control goes through the punch-in interceptor, so a save
     * with nobody punched in opens the sheet instead of reaching the action.
     */
    it("goes through the actor interceptor rather than calling the action itself", async () => {
      const context = makeContext({ withActor: async () => fail("NO_ACTOR") });
      const onClose = renderForm({ kind: "profile", context });

      type(screen.getByLabelText("Name"), "Kit");
      clickSave();

      expect(await screen.findByText("Punch in to make changes.")).toBeInTheDocument();
      expect(createCategory).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe("editing", () => {
    const alex = makeCategory({
      id: "p1",
      label: "Alex",
      color: PALETTE[13],
      avatarKind: "illustration",
      avatarId: "fox",
      birthday: "2015-04-02",
      dietaryPrefs: "No peanuts",
      role: "member",
      showOnTasks: false,
    });
    const sam = makeCategory({ id: "p2", label: "Sam", color: PALETTE[8], role: "parent" });

    it("opens on the saved values", () => {
      renderForm({ mode: "edit", kind: "profile", existing: alex, context: makeContext({ categories: [alex, sam] }) });

      expect(screen.getByRole("heading", { name: "Edit Alex" })).toBeInTheDocument();
      expect(screen.getByLabelText("Name")).toHaveValue("Alex");
      expect(screen.getByLabelText("Birthday (optional)")).toHaveValue("2015-04-02");
      expect(screen.getByLabelText("Dietary notes (optional)")).toHaveValue("No peanuts");
      expect(screen.getByRole("radio", { name: AVATAR_LABELS.fox })).toBeChecked();
      expect(screen.getByRole("radio", { name: "member" })).toBeChecked();
      expect(screen.getByRole("switch", { name: "Show on Tasks tab" })).not.toBeChecked();
    });

    /** An uploaded photo is not an illustration key, so no illustration is preselected. */
    it("does not present an uploaded photo as one of the built-in illustrations", () => {
      const photo = makeCategory({
        id: "p3",
        label: "Sam",
        avatarKind: "photo",
        avatarId: null,
        avatarPath: "household-1/p3.webp",
      });
      renderForm({ mode: "edit", kind: "profile", existing: photo, context: makeContext({ categories: [photo, sam] }) });

      expect(screen.getByRole("radio", { name: /No avatar/ })).toBeChecked();
      for (const label of Object.values(AVATAR_LABELS)) {
        expect(screen.getByRole("radio", { name: label })).not.toBeChecked();
      }
    });

    it("updates the row it was opened on, and creates nothing", async () => {
      const onClose = renderForm({
        mode: "edit",
        kind: "profile",
        existing: alex,
        context: makeContext({ categories: [alex, sam] }),
      });

      type(screen.getByLabelText("Name"), "Alexandra");
      clickSave();

      await waitFor(() => expect(updateCategory).toHaveBeenCalledTimes(1));
      expect(updateCategory).toHaveBeenCalledWith(
        "p1",
        expect.objectContaining({ label: "Alexandra", birthday: "2015-04-02" }),
      );
      expect(createCategory).not.toHaveBeenCalled();
      await waitFor(() => expect(onClose).toHaveBeenCalled());
    });

    it("carries a promotion and the other edited fields through to the save", async () => {
      renderForm({
        mode: "edit",
        kind: "profile",
        existing: alex,
        context: makeContext({ categories: [alex, sam] }),
      });

      fireEvent.click(screen.getByRole("radio", { name: "parent" }));
      fireEvent.click(screen.getByRole("switch", { name: "Show on Tasks tab" }));
      type(screen.getByLabelText("Birthday (optional)"), "2016-01-05");
      clickSave();

      await waitFor(() => expect(updateCategory).toHaveBeenCalledTimes(1));
      expect(updateCategory).toHaveBeenCalledWith(
        "p1",
        expect.objectContaining({
          role: "parent",
          showOnTasks: true,
          birthday: "2016-01-05",
          dietaryPrefs: "No peanuts",
        }),
      );
    });
  });

  /** A rejected save has to say which field was wrong, and keep the work on screen. */
  describe("when the server rejects the input", () => {
    it("puts the field message beside its own field and leaves the form open", async () => {
      createCategory.mockResolvedValue(
        fail("VALIDATION", undefined, { label: ["Name must be 40 characters or fewer."] }),
      );
      const onClose = renderForm({ kind: "profile" });
      const nameField = screen.getByLabelText("Name");

      type(nameField, "Kit");
      clickSave();

      const message = await screen.findByText("Name must be 40 characters or fewer.");
      expect(nameField.closest("label")).toContainElement(message);
      expect(screen.getByText("Some of that didn't look right — check the highlighted fields.")).toBeInTheDocument();
      expect(onClose).not.toHaveBeenCalled();
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("clears a stale field message when the next save succeeds", async () => {
      createCategory.mockResolvedValueOnce(
        fail("VALIDATION", undefined, { color: ["Pick one of the household colours."] }),
      );
      const onClose = renderForm({ kind: "profile" });

      type(screen.getByLabelText("Name"), "Kit");
      clickSave();
      expect(await screen.findByText("Pick one of the household colours.")).toBeInTheDocument();

      clickSave();
      await waitFor(() => expect(onClose).toHaveBeenCalled());
      expect(screen.queryByText("Pick one of the household colours.")).toBeNull();
    });
  });

  /** D6 bootstrap, and the last-parent rule the database also enforces. */
  describe("the role radios", () => {
    it("locks the first person in a household to parent and says why", async () => {
      renderForm({ kind: "profile", forceParent: true });

      expect(screen.getByRole("radio", { name: "parent" })).toBeChecked();
      expect(screen.getByRole("radio", { name: "parent" })).toBeDisabled();
      expect(screen.getByRole("radio", { name: "member" })).toBeDisabled();
      expect(screen.getByText(/this person will be a parent/)).toBeInTheDocument();

      type(screen.getByLabelText("Name"), "Alex");
      clickSave();

      await waitFor(() =>
        expect(createCategory).toHaveBeenCalledWith(
          expect.objectContaining({ role: "parent", isProfile: true }),
        ),
      );
    });

    it("refuses to demote the only parent, and says why", () => {
      const alex = makeCategory({ id: "p1", label: "Alex", role: "parent" });
      const kit = makeCategory({ id: "p2", label: "Kit", color: PALETTE[16], role: "member" });
      renderForm({
        mode: "edit",
        kind: "profile",
        existing: alex,
        context: makeContext({ categories: [alex, kit] }),
      });

      expect(screen.getByRole("radio", { name: "parent" })).toBeDisabled();
      expect(screen.getByRole("radio", { name: "member" })).toBeDisabled();
      expect(screen.getByText(/only parent can.t be demoted/)).toBeInTheDocument();
    });

    it("allows the change once a second parent exists", () => {
      const alex = makeCategory({ id: "p1", label: "Alex", role: "parent" });
      const sam = makeCategory({ id: "p2", label: "Sam", color: PALETTE[8], role: "parent" });
      renderForm({
        mode: "edit",
        kind: "profile",
        existing: alex,
        context: makeContext({ categories: [alex, sam] }),
      });

      expect(screen.getByRole("radio", { name: "member" })).toBeEnabled();
      expect(screen.queryByText(/can.t be demoted/)).toBeNull();
    });
  });

  describe("backing out", () => {
    it("closes without saving anything", () => {
      const onClose = renderForm({ kind: "profile" });

      type(screen.getByLabelText("Name"), "Kit");
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(createCategory).not.toHaveBeenCalled();
      expect(updateCategory).not.toHaveBeenCalled();
    });

    /**
     * SC-009: the form is unmounted rather than closed, so nothing hands the
     * keyboard back by itself — focus lands on <body> and the next Tab restarts
     * from the top of the document.
     */
    it("gives the keyboard back to the control that opened it", () => {
      function Harness() {
        const [open, setOpen] = useState(false);
        return withFamily(
          makeContext(),
          <>
            <button type="button" onClick={() => setOpen(true)}>
              Add a Profile
            </button>
            {open ? (
              <CategoryForm mode="create" kind="profile" onClose={() => setOpen(false)} />
            ) : null}
          </>,
        );
      }

      render(<Harness />);
      const opener = screen.getByRole("button", { name: "Add a Profile" });
      opener.focus();
      fireEvent.click(opener);

      // Stand in for `showModal()`, which jsdom does not implement: in a browser
      // opening the dialog is what takes the keyboard off the button.
      screen.getByLabelText("Name").focus();
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

      expect(screen.queryByRole("dialog")).toBeNull();
      expect(opener).toHaveFocus();
    });

    /** Escape closes the native dialog; the owner has to hear about it too. */
    it("tells its owner when the dialog is dismissed with Escape", () => {
      const onClose = renderForm({ kind: "profile" });

      const dismissed = fireEvent(
        screen.getByRole("dialog"),
        new Event("cancel", { bubbles: false, cancelable: true }),
      );

      expect(dismissed).toBe(false);
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(createCategory).not.toHaveBeenCalled();
    });
  });
});
