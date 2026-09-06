import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { stubDialog } from "./family-test-utils";
import { ConfirmDialog } from "../ConfirmDialog";

/**
 * 005 T031 — the Lists tab's confirmation (FR-512, FR-521, constitution §VI):
 * the caller's title, body and verb; Keep it focused first; Escape keeps; the
 * confirming button locks while pending.
 */

describe("ConfirmDialog", () => {
  beforeAll(stubDialog);

  it("says what will be lost and what will be kept, in the caller's words", () => {
    render(
      <ConfirmDialog
        title="Delete “Party” and its 4 items?"
        body="This can't be undone. Nothing else is affected."
        confirmLabel="Delete for good"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    const dialog = screen.getByRole("alertdialog", { name: "Delete “Party” and its 4 items?" });
    expect(dialog).toHaveAccessibleDescription("This can't be undone. Nothing else is affected.");
    expect(screen.getByRole("button", { name: "Delete for good" })).toBeInTheDocument();
  });

  it("focuses Keep it first, and routes Escape to onCancel", () => {
    const onCancel = vi.fn();
    render(
      <ConfirmDialog title="Clear 3 completed items from Grocery List?" body="…" confirmLabel="Clear 3 items" onConfirm={vi.fn()} onCancel={onCancel} />,
    );
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Keep it" }));
    fireEvent(screen.getByRole("alertdialog"), new Event("cancel", { bubbles: false, cancelable: true }));
    expect(onCancel).toHaveBeenCalled();
  });

  it("confirms from the confirming button, and locks it while pending", () => {
    const onConfirm = vi.fn();
    const { rerender } = render(
      <ConfirmDialog title="Delete “Party”?" body="…" confirmLabel="Delete for good" onConfirm={onConfirm} onCancel={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Delete for good" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    rerender(
      <ConfirmDialog title="Delete “Party”?" body="…" confirmLabel="Delete for good" pending onConfirm={onConfirm} onCancel={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: "Delete for good" })).toBeDisabled();
  });
});
