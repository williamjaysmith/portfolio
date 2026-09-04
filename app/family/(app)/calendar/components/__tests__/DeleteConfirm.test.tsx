import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { stubDialog } from "../../../components/__tests__/family-test-utils";
import { DeleteConfirm, type DeleteConfirmProps } from "../DeleteConfirm";

/**
 * T049 — FR-258/US2-11/SC-212: every delete asks first; the copy is final —
 * the verb is "Delete", never "Remove", and no undo, restore or trash is
 * promised anywhere because none exists. The component is presentational:
 * confirmation and dismissal leave through callbacks, the parent owns the
 * actual delete.
 */

function renderConfirm(overrides: Partial<DeleteConfirmProps> = {}) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(
    <DeleteConfirm
      summary="Piano"
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...overrides}
    />,
  );
  return { onConfirm, onCancel };
}

describe("DeleteConfirm", () => {
  beforeEach(() => {
    stubDialog();
  });

  it("asks before anything is deleted, naming the event (FR-258)", () => {
    renderConfirm();

    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Delete\s+“Piano”\?/ }),
    ).toBeInTheDocument();
    expect(dialog).toHaveTextContent(/final/i);
  });

  it("confirms with the word Delete, never Remove, and promises no way back (SC-212)", () => {
    renderConfirm();

    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
    const text = screen.getByRole("alertdialog").textContent ?? "";
    expect(text).not.toMatch(/remove/i);
    expect(text).not.toMatch(/undo/i);
    expect(text).not.toMatch(/restore/i);
    expect(text).not.toMatch(/trash/i);
  });

  it("keeps the affected wording generic — no category or profile talk", () => {
    renderConfirm();

    const text = screen.getByRole("alertdialog").textContent ?? "";
    expect(text).not.toMatch(/categor/i);
    expect(text).not.toMatch(/profile/i);
    expect(text).not.toMatch(/label/i);
  });

  it("hands confirmation to the parent once, and only on Delete", () => {
    const { onConfirm, onCancel } = renderConfirm();

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("cancels through the Cancel button and through Escape, deleting nothing", () => {
    const { onConfirm, onCancel } = renderConfirm();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);

    // Escape arrives as the dialog's native cancel event.
    fireEvent(screen.getByRole("alertdialog"), new Event("cancel", { cancelable: true }));
    expect(onCancel).toHaveBeenCalledTimes(2);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("locks the Delete button while the parent's delete is in flight", () => {
    const { onConfirm } = renderConfirm({ pending: true });

    const button = screen.getByRole("button", { name: "Delete" });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("opens with focus on Cancel, Phase 1's dialog idiom", () => {
    renderConfirm();

    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
  });
});
