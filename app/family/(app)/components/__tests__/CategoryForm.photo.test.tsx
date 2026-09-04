import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AVATAR_LABELS } from "@/lib/family/avatars";

import { ok } from "./action-result";
import { makeCategory, makeContext, stubDialog, withFamily } from "./family-test-utils";

const updateCategory = vi.fn();
vi.mock("@/lib/family/actions/categories", () => ({
  createCategory: vi.fn(),
  updateCategory: (...args: unknown[]) => updateCategory(...args),
}));

const { CategoryForm } = await import("../settings/CategoryForm");

/**
 * Regression: a profile whose avatar is an uploaded PHOTO shows "no
 * illustration" in the picker, because a photo is not one of the built-in
 * animals. Submitting that as `avatar: null` would delete the photo the family
 * uploaded — losing data nobody asked to lose (constitution §VI).
 */
describe("CategoryForm — an untouched avatar is left alone", () => {
  beforeEach(() => {
    stubDialog();
    updateCategory.mockReset().mockResolvedValue(ok(makeCategory()));
  });

  const withPhoto = makeCategory({
    id: "p1",
    label: "Alex",
    avatarKind: "photo",
    avatarPath: "household-1/p1.webp",
    avatarId: null,
  });

  function renderEdit(existing = withPhoto) {
    const context = makeContext({ categories: [existing, makeCategory({ id: "p2", label: "Sam" })] });
    render(
      withFamily(
        context,
        <CategoryForm mode="edit" kind="profile" existing={existing} onClose={vi.fn()} />,
      ),
    );
  }

  it("omits `avatar` entirely when the picker was never used, so the photo survives", async () => {
    renderEdit();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(updateCategory).toHaveBeenCalled());
    const [, patch] = updateCategory.mock.calls[0] as [string, Record<string, unknown>];
    expect("avatar" in patch && patch.avatar !== undefined).toBe(false);
  });

  it("still clears the avatar when someone deliberately picks 'no avatar'", async () => {
    renderEdit();
    fireEvent.click(screen.getByRole("radio", { name: "No avatar — use initials" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(updateCategory).toHaveBeenCalled());
    const [, patch] = updateCategory.mock.calls[0] as [string, Record<string, unknown>];
    expect(patch.avatar).toBeNull();
  });

  it("replaces the photo when an illustration is chosen instead", async () => {
    renderEdit();
    fireEvent.click(screen.getByRole("radio", { name: AVATAR_LABELS.fox }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(updateCategory).toHaveBeenCalled());
    const [, patch] = updateCategory.mock.calls[0] as [string, Record<string, unknown>];
    expect(patch.avatar).toEqual({ kind: "illustration", id: "fox" });
  });

  it("leaves an existing illustration in place when nothing is touched", async () => {
    renderEdit(makeCategory({ id: "p1", label: "Alex", avatarKind: "illustration", avatarId: "bear" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(updateCategory).toHaveBeenCalled());
    const [, patch] = updateCategory.mock.calls[0] as [string, Record<string, unknown>];
    expect(patch.avatar).toEqual({ kind: "illustration", id: "bear" });
  });
});
