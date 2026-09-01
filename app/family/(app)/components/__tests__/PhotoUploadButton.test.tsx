import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { makeCategory, makeContext, withFamily } from "./family-test-utils";

vi.mock("@/lib/family/actions/avatars", () => ({
  uploadAvatar: vi.fn(),
  removeAvatar: vi.fn(),
}));

const { PhotoUploadButton } = await import("../settings/PhotoUploadButton");

const profile = makeCategory({ id: "p1", label: "Alex" });

function renderButton(overrides: Partial<{ hasPhoto: boolean; disabled: boolean }> = {}) {
  const category = overrides.hasPhoto
    ? makeCategory({ id: "p1", label: "Alex", avatarKind: "photo", avatarPath: "h/p1.webp" })
    : profile;
  render(
    withFamily(
      makeContext(),
      <PhotoUploadButton profile={category} disabled={overrides.disabled ?? false} />,
    ),
  );
}

/**
 * WCAG 2.4.7 (SC-009): the only focusable element here is the file input, and
 * it is `sr-only` — clipped to a 1px box, where no focus ring can be seen. The
 * indicator has to live on the visible label instead, or tabbing onto this
 * control produces no visible change at all.
 */
describe("PhotoUploadButton", () => {
  it("puts the focus indicator on the visible label, not on the clipped input", () => {
    renderButton();
    const input = screen.getByLabelText("Upload photo");

    expect(input).toHaveClass("sr-only");
    const label = input.closest("label");
    expect(label).toHaveClass("has-[:focus-visible]:ring-2");
    expect(label?.className).toContain("has-[:focus-visible]:ring-(--fam-text-primary)");
  });

  it("offers a replacement and a removal once there is a photo", () => {
    renderButton({ hasPhoto: true });

    expect(screen.getByLabelText("Replace photo")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove photo" })).toBeInTheDocument();
  });

  it("has nothing to remove before a photo is uploaded", () => {
    renderButton();

    expect(screen.getByLabelText("Upload photo")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove photo" })).toBeNull();
  });

  it("is disabled, not hidden, for a punched-in child (FR-015)", () => {
    renderButton({ hasPhoto: true, disabled: true });

    expect(screen.getByLabelText("Replace photo")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Remove photo" })).toBeDisabled();
  });
});
