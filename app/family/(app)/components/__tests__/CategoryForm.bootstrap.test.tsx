import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fail, ok } from "./action-result";
import { makeCategory, makeContext, stubDialog, withFamily } from "./family-test-utils";

const createCategory = vi.fn();
vi.mock("@/lib/family/actions/categories", () => ({
  createCategory: (...args: unknown[]) => createCategory(...args),
  updateCategory: vi.fn(),
}));

const { CategoryForm } = await import("../settings/CategoryForm");

/**
 * D6, the bootstrap rule. A household with no parent profile has nobody who
 * can punch in — nobody has a PIN, and nobody could set one against a profile
 * that does not exist. So creating the FIRST profile must not be routed
 * through the punch-in gate, or a fresh household is a permanent dead end.
 *
 * The server still decides: `requireParentOrBootstrap()` only allows this
 * while the household genuinely has no parent, and forces the new profile to
 * be one.
 */
describe("CategoryForm — the first profile in an empty household", () => {
  beforeEach(() => {
    stubDialog();
    createCategory.mockReset().mockResolvedValue(ok(makeCategory()));
  });

  /** No actor, and the punch-in sheet can only be cancelled: `withActor` refuses. */
  function emptyHousehold() {
    return makeContext({
      categories: [],
      actor: null,
      withActor: vi.fn(async () => fail("NO_ACTOR")),
    });
  }

  it("creates the profile even though no actor can exist yet", async () => {
    const onClose = vi.fn();
    render(
      withFamily(
        emptyHousehold(),
        <CategoryForm mode="create" kind="profile" forceParent onClose={onClose} />,
      ),
    );

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Alex" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(createCategory).toHaveBeenCalled());
    const [input] = createCategory.mock.calls[0] as [{ label: string; role: string; isProfile: boolean }];
    expect(input.label).toBe("Alex");
    expect(input.role).toBe("parent");
    expect(input.isProfile).toBe(true);
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("does not route the bootstrap save through the punch-in gate", async () => {
    const context = emptyHousehold();
    render(
      withFamily(
        context,
        <CategoryForm mode="create" kind="profile" forceParent onClose={vi.fn()} />,
      ),
    );

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Alex" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(createCategory).toHaveBeenCalled());
    expect(context.withActor).not.toHaveBeenCalled();
  });

  it("still demands an actor once the household has a parent", async () => {
    const parent = makeCategory({ id: "p1", label: "Alex", role: "parent" });
    const context = makeContext({
      categories: [parent],
      actor: null,
      withActor: vi.fn(async () => fail("NO_ACTOR")),
    });
    render(
      withFamily(context, <CategoryForm mode="create" kind="profile" onClose={vi.fn()} />),
    );

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Kit" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(context.withActor).toHaveBeenCalled());
    expect(createCategory).not.toHaveBeenCalled();
  });
});
