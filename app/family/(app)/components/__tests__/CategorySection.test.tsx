import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PALETTE } from "@/lib/family/colors";
import type { ActionResult } from "@/lib/family/errors";
import type { Category } from "@/lib/family/types";

import type { FamilyContextValue } from "../FamilyProvider";
import { fail, ok } from "./action-result";
import { makeActor, makeCategory, makeContext, stubDialog, withFamily } from "./family-test-utils";

const reorderCategories = vi.fn<(orderedIds: string[]) => Promise<ActionResult<null>>>();

vi.mock("@/lib/family/actions/categories", () => ({
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
  deleteCategory: vi.fn(),
  reorderCategories: (orderedIds: string[]) => reorderCategories(orderedIds),
}));

// CategoryRow renders PinRow and PhotoUploadButton, which reach these modules.
vi.mock("@/lib/family/actions/pins", () => ({
  setProfilePin: vi.fn(),
  clearProfilePin: vi.fn(),
}));

vi.mock("@/lib/family/actions/avatars", () => ({
  uploadAvatar: vi.fn(),
  removeAvatar: vi.fn(),
  signAvatarUrls: vi.fn(),
}));

// DeleteDialog counts the affected events (002 FR-274) and the affected tasks
// (003 FR-391) through React Query; both reads are stubbed here, where the
// dialog's copy is not the subject.
vi.mock("@/lib/family/queries", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/family/queries")>()),
  useCategoryEventCount: () => ({ data: 0, isError: false }),
  useCategoryTaskCounts: () => ({ data: { losingAnAssignee: 0, deleted: 0 }, isError: false }),
}));

const { CategorySection } = await import("../settings/CategorySection");

const alex = makeCategory({ id: "p1", label: "Alex", role: "parent", color: PALETTE[13] });
const sam = makeCategory({ id: "p2", label: "Sam", role: "parent", color: PALETTE[8] });
const kit = makeCategory({ id: "p3", label: "Kit", role: "member", color: PALETTE[16] });
const holidays = makeCategory({
  id: "l1",
  label: "Holidays",
  isProfile: false,
  emoji: "🎉",
  color: PALETTE[0],
});
const school = makeCategory({
  id: "l2",
  label: "School",
  isProfile: false,
  emoji: "🎒",
  color: PALETTE[10],
});

/** One household: three people then two labels, in sort order. */
const HOUSEHOLD: Category[] = [alex, sam, kit, holidays, school];

const parentActor = makeActor("parent", { profileId: "p1", label: "Alex" });
const memberActor = makeActor("member", { profileId: "p3", label: "Kit" });

function renderSection(
  kind: "profile" | "label",
  overrides: Partial<FamilyContextValue> = {},
): void {
  const context = makeContext({ categories: HOUSEHOLD, actor: parentActor, ...overrides });
  render(withFamily(context, <CategorySection kind={kind} />));
}

/**
 * FR-019/FR-025: Profiles and Labels are one record type shown as two lists,
 * and reordering is by button so a child on a tablet can do it (SC-009).
 */
describe("CategorySection", () => {
  beforeEach(() => {
    stubDialog();
    reorderCategories.mockReset().mockResolvedValue(ok(null));
  });

  it("keeps people and labels in separate lists, each with its own add button", () => {
    const context = makeContext({ categories: HOUSEHOLD, actor: parentActor });
    render(
      withFamily(
        context,
        <>
          <CategorySection kind="profile" />
          <CategorySection kind="label" />
        </>,
      ),
    );

    const profiles = screen.getByRole("region", { name: "Profiles" });
    const labels = screen.getByRole("region", { name: "Labels" });

    expect(within(profiles).getByRole("button", { name: "Add a Profile" })).toBeEnabled();
    expect(within(profiles).getAllByRole("listitem")).toHaveLength(3);
    expect(within(profiles).getByText("Alex")).toBeInTheDocument();
    expect(within(profiles).queryByText("Holidays")).not.toBeInTheDocument();

    expect(within(labels).getByRole("button", { name: "Add a Label" })).toBeEnabled();
    expect(within(labels).getAllByRole("listitem")).toHaveLength(2);
    expect(within(labels).getByText("School")).toBeInTheDocument();
    expect(within(labels).queryByText("Alex")).not.toBeInTheDocument();
  });

  it("shows each person's name and role, and marks who is punched in", () => {
    renderSection("profile");
    const [alexRow, samRow, kitRow] = screen.getAllByRole("listitem");

    expect(within(alexRow).getByText("Alex")).toBeInTheDocument();
    expect(within(alexRow).getByText("parent")).toBeInTheDocument();
    expect(within(alexRow).getByText("You")).toBeInTheDocument();

    expect(within(samRow).getByText("parent")).toBeInTheDocument();
    expect(within(samRow).queryByText("You")).not.toBeInTheDocument();
    expect(within(kitRow).getByText("member")).toBeInTheDocument();
  });

  it("does not offer a move that would fall off the end of the list", () => {
    renderSection("profile");

    expect(screen.getByRole("button", { name: "Move Alex up" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move Alex down" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Move Sam up" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Move Kit up" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Move Kit down" })).toBeDisabled();
  });

  it("sends the whole household's order when a person moves, so the lists cannot interleave", async () => {
    renderSection("profile");
    fireEvent.click(screen.getByRole("button", { name: "Move Sam up" }));

    await waitFor(() => expect(reorderCategories).toHaveBeenCalledTimes(1));
    expect(reorderCategories.mock.calls[0][0]).toEqual(["p2", "p1", "p3", "l1", "l2"]);
  });

  it("keeps the labels ahead of the people when a label moves", async () => {
    renderSection("label");
    fireEvent.click(screen.getByRole("button", { name: "Move School up" }));

    await waitFor(() => expect(reorderCategories).toHaveBeenCalledTimes(1));
    expect(reorderCategories.mock.calls[0][0]).toEqual(["l2", "l1", "p1", "p2", "p3"]);
  });

  it("moves a person down by swapping them with the next one", async () => {
    renderSection("profile");
    fireEvent.click(screen.getByRole("button", { name: "Move Alex down" }));

    await waitFor(() => expect(reorderCategories).toHaveBeenCalledTimes(1));
    expect(reorderCategories.mock.calls[0][0]).toEqual(["p2", "p1", "p3", "l1", "l2"]);
  });

  it("says why a refused reorder did not happen", async () => {
    reorderCategories.mockResolvedValue(fail("FORBIDDEN"));
    renderSection("profile");
    fireEvent.click(screen.getByRole("button", { name: "Move Sam up" }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Only a parent can change this."),
    );
  });

  it("disables every control for a punched-in child rather than hiding it (FR-015)", () => {
    renderSection("profile", { actor: memberActor });
    const region = screen.getByRole("region", { name: "Profiles" });

    const buttons = within(region).getAllByRole("button");
    expect(buttons.length).toBeGreaterThanOrEqual(16);
    for (const button of buttons) expect(button).toBeDisabled();
    for (const input of within(region).getAllByLabelText("Upload photo")) {
      expect(input).toBeDisabled();
    }
    expect(within(region).getAllByRole("listitem")).toHaveLength(3);
  });

  it("gives a child one reason for the whole section", () => {
    renderSection("label", { actor: memberActor });
    expect(screen.getAllByText("Parents only")).toHaveLength(1);
  });

  it("says an empty Profiles list is empty", () => {
    renderSection("profile", { categories: [holidays] });

    expect(screen.getByText("No one yet.")).toBeInTheDocument();
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });

  it("says an empty Labels list is empty, in label words", () => {
    renderSection("label", { categories: [alex] });

    expect(screen.getByText("No labels yet.")).toBeInTheDocument();
    expect(screen.queryByText("No one yet.")).not.toBeInTheDocument();
  });

  it("warns that the first person will be a parent, and locks the role (D6)", () => {
    renderSection("profile", { categories: [kit], actor: null });
    expect(screen.getByText(/this person will be a parent/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Add a Profile" }));
    const role = screen.getByRole("radio", { name: "parent" });

    expect(screen.getByRole("heading", { name: "Add a Profile" })).toBeInTheDocument();
    expect(role).toBeChecked();
    expect(role).toBeDisabled();
  });

  /**
   * The D6 bootstrap window only makes people. Before a parent exists, "Add a
   * Label" would dead-end at a punch-in nobody can complete — and the action,
   * reached directly, coerces the Label into a parent profile rather than
   * writing an incoherent row. So the button waits.
   */
  it("waits for the first person before offering to add a label", () => {
    const context = makeContext({ categories: [], actor: null });
    render(withFamily(context, <CategorySection kind="label" />));

    expect(screen.getByRole("button", { name: "Add a Label" })).toBeDisabled();
    expect(screen.getByText("Add the first person before adding labels.")).toBeInTheDocument();
  });

  it("offers labels again as soon as the household has a parent", () => {
    const parent = makeCategory({ id: "p1", label: "Alex", role: "parent" });
    const context = makeContext({ categories: [parent], actor: null });
    render(withFamily(context, <CategorySection kind="label" />));

    expect(screen.getByRole("button", { name: "Add a Label" })).toBeEnabled();
    expect(
      screen.queryByText("Add the first person before adding labels."),
    ).not.toBeInTheDocument();
  });

  it("does not claim a parent-less household when one already has a parent", () => {
    renderSection("profile");
    expect(screen.queryByText(/this person will be a parent/)).not.toBeInTheDocument();
  });

  it("confirms before deleting, naming who goes", () => {
    renderSection("profile");
    fireEvent.click(within(screen.getAllByRole("listitem")[1]).getByRole("button", { name: "Delete" }));

    const dialog = screen.getByRole("alertdialog");
    expect(within(dialog).getByRole("heading", { name: "Delete Sam?" })).toBeInTheDocument();
  });

  it("edits the person whose row was tapped", () => {
    renderSection("profile");
    fireEvent.click(within(screen.getAllByRole("listitem")[2]).getByRole("button", { name: "Edit" }));

    expect(screen.getByRole("heading", { name: "Edit Kit" })).toBeInTheDocument();
  });
});
