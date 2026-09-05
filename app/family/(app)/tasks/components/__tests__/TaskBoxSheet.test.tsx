import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import {
  createTaskBoxItem,
  deleteTaskBoxItem,
  updateTaskBoxItem,
} from "@/lib/family/actions/task-box";
import { fail } from "@/lib/family/errors";
import { useTaskBox } from "@/lib/family/queries";
import type { TaskBoxItem } from "@/lib/family/types";

import type { FamilyContextValue } from "../../../components/FamilyProvider";
import { ok } from "../../../components/__tests__/action-result";
import {
  makeActor,
  makeCategory,
  makeContext,
  stubDialog,
  withFamily,
} from "../../../components/__tests__/family-test-utils";
import { matchingTemplates, TaskBoxSheet } from "../TaskBoxSheet";

/**
 * T072 — the Task Box sheet: FR-376's two sections and its own search box,
 * FR-378's pre-filled create form, and FR-380/FR-381's three-field edit and
 * warned deletion.
 *
 * What is pinned here:
 *   - **Chores and Routines are separate sections** (FR-376), each listing the
 *     templates of its own type;
 *   - the sheet's **own** search box filters those templates by title as it is
 *     typed — a different control from the board's task search (FR-386);
 *   - choosing a template hands back the ordinary create form's seed carrying
 *     the template's **title, emoji and type and nothing else**, so the
 *     assignment and the schedule are empty and still required (FR-378, US4-10,
 *     SC-318) — and it is a seed rather than a call, because adding from a
 *     template is not an action;
 *   - the template edit offers **exactly three fields** and no star value
 *     anywhere on the surface (FR-380, SC-319, US4-11);
 *   - the delete **warns first** that it cannot be undone, and says that tasks
 *     already made from the template are unaffected (FR-381, US4-12);
 *   - both writes go through `withActor`, and a refusal is shown in the sheet
 *     rather than swallowed (FR-393);
 *   - FR-389's affordance: a member sees no Edit and no Delete — while the
 *     server, not this component, is the gate.
 */

vi.mock("@/lib/family/queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/family/queries")>();
  return { ...actual, useTaskBox: vi.fn() };
});

vi.mock("@/lib/family/actions/task-box", () => ({
  createTaskBoxItem: vi.fn(),
  updateTaskBoxItem: vi.fn(),
  deleteTaskBoxItem: vi.fn(),
}));

const taskBoxMock = useTaskBox as Mock;
const createMock = createTaskBoxItem as Mock;
const updateMock = updateTaskBoxItem as Mock;
const deleteMock = deleteTaskBoxItem as Mock;

const VACUUM = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TRASH = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const TEETH = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function template(overrides: Partial<TaskBoxItem> & { id: string }): TaskBoxItem {
  return {
    householdId: "household-1",
    summary: "Vacuum",
    emoji: null,
    routine: false,
    createdBy: null,
    updatedBy: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const TEMPLATES: TaskBoxItem[] = [
  template({ id: VACUUM, summary: "Vacuum" }),
  template({ id: TRASH, summary: "Take out trash" }),
  template({ id: TEETH, summary: "Brush teeth", emoji: "🪥", routine: true }),
];

interface ReadState {
  data?: TaskBoxItem[];
  isPending?: boolean;
  isError?: boolean;
}

function renderSheet(read: ReadState = {}, contextOverrides = {}) {
  taskBoxMock.mockReturnValue({
    data: read.data ?? TEMPLATES,
    isPending: read.isPending ?? false,
    isError: read.isError ?? false,
  });
  const onChoose = vi.fn();
  const onClose = vi.fn();
  // The shipped interceptor, reduced to what this sheet needs from it: it runs
  // the action and hands the result back untouched.
  const withActor: FamilyContextValue["withActor"] = vi.fn((run) => run());
  render(
    withFamily(
      makeContext({
        categories: [makeCategory({ id: "ana", label: "Ana", role: "parent" })],
        actor: makeActor("parent", { profileId: "ana" }),
        withActor,
        ...contextOverrides,
      }),
      <TaskBoxSheet onChoose={onChoose} onClose={onClose} />,
    ),
  );
  return { onChoose, onClose, withActor };
}

/** The section a heading names, so membership is asserted per section. */
function section(name: string): HTMLElement {
  return screen.getByRole("region", { name });
}

function searchFor(text: string): void {
  fireEvent.change(screen.getByLabelText("Search the Task Box"), { target: { value: text } });
}

beforeEach(() => {
  vi.clearAllMocks();
  stubDialog();
  createMock.mockResolvedValue(ok(template({ id: VACUUM })));
  updateMock.mockResolvedValue(ok(template({ id: VACUUM })));
  deleteMock.mockResolvedValue(ok(null));
});

describe("matchingTemplates — the sheet's own filter (FR-376)", () => {
  it("keeps everything when the box is blank or only spaces", () => {
    expect(matchingTemplates(TEMPLATES, "")).toEqual(TEMPLATES);
    expect(matchingTemplates(TEMPLATES, "   ")).toEqual(TEMPLATES);
  });

  it("matches part of a title, ignoring case", () => {
    expect(matchingTemplates(TEMPLATES, "TRA").map((item) => item.id)).toEqual([TRASH]);
    expect(matchingTemplates(TEMPLATES, "teeth").map((item) => item.id)).toEqual([TEETH]);
  });

  it("matches nothing when nothing matches", () => {
    expect(matchingTemplates(TEMPLATES, "zzz")).toEqual([]);
  });
});

describe("TaskBoxSheet — the two sections and the search (FR-376, US4-9)", () => {
  it("lists chores and routines in sections of their own", () => {
    renderSheet();

    expect(within(section("Chores")).getByRole("button", { name: "Vacuum" })).toBeTruthy();
    expect(within(section("Chores")).getByRole("button", { name: "Take out trash" })).toBeTruthy();
    expect(within(section("Routines")).getByRole("button", { name: "Brush teeth" })).toBeTruthy();
    expect(within(section("Chores")).queryByRole("button", { name: "Brush teeth" })).toBeNull();
  });

  it("filters both sections as the search box is typed, and clearing restores them", () => {
    renderSheet();

    searchFor("teeth");
    expect(screen.queryByRole("button", { name: "Vacuum" })).toBeNull();
    expect(screen.getByRole("button", { name: "Brush teeth" })).toBeTruthy();

    searchFor("");
    expect(screen.getByRole("button", { name: "Vacuum" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Brush teeth" })).toBeTruthy();
  });

  it("says so while the templates are still loading", () => {
    renderSheet({ data: undefined, isPending: true });
    expect(screen.getByText(/Loading the Task Box/i)).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Chores" })).toBeNull();
  });

  it("says so when they cannot be read at all", () => {
    renderSheet({ data: undefined, isError: true });
    expect(screen.getByText(/couldn’t be loaded/i)).toBeTruthy();
  });

  it("says when a search matches no template at all", () => {
    renderSheet();
    searchFor("zzz");
    expect(screen.getByText(/Nothing matches that search/i)).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Chores" })).toBeNull();
  });

  it("says the box is empty rather than showing two empty headings", () => {
    renderSheet({ data: [] });
    expect(screen.getByText(/nothing in the Task Box yet/i)).toBeTruthy();
  });
});

describe("choosing a template opens the pre-filled create form (FR-378, US4-10, SC-318)", () => {
  it("hands back the title, the emoji and the type — and no assignment or schedule", () => {
    const { onChoose } = renderSheet();

    fireEvent.click(screen.getByRole("button", { name: "Brush teeth" }));

    expect(onChoose).toHaveBeenCalledTimes(1);
    expect(onChoose).toHaveBeenCalledWith({ summary: "Brush teeth", emoji: "🪥", type: "routine" });
  });

  it("a chore without an emoji seeds a blank one and the chore type", () => {
    const { onChoose } = renderSheet();

    fireEvent.click(screen.getByRole("button", { name: "Take out trash" }));

    expect(onChoose).toHaveBeenCalledWith({
      summary: "Take out trash",
      emoji: "",
      type: "chore",
    });
  });

  it("writes nothing: adding from a template is not an action", () => {
    const { withActor } = renderSheet();
    fireEvent.click(screen.getByRole("button", { name: "Vacuum" }));
    expect(withActor).not.toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
  });
});

describe("editing a template offers three fields and no fourth (FR-380, SC-319, US4-11)", () => {
  it("offers the title, the emoji and the type, and nothing star-shaped", () => {
    renderSheet();

    fireEvent.click(screen.getByRole("button", { name: "Edit Vacuum" }));

    expect(screen.getByLabelText("Title")).toBeTruthy();
    expect(screen.getByLabelText("Emoji")).toBeTruthy();
    expect(screen.getByLabelText("Routine")).toBeTruthy();
    expect(screen.queryByText(/star|reward|point/i)).toBeNull();
    // Three inputs, and no fourth: the star value FR-380 does not ship.
    expect(within(screen.getByRole("form", { name: "Edit Vacuum" })).getAllByRole("textbox")).toHaveLength(2);
  });

  it("saves the three fields through withActor and closes the editor", async () => {
    const { withActor } = renderSheet();

    fireEvent.click(screen.getByRole("button", { name: "Edit Vacuum" }));
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Hoover" } });
    fireEvent.change(screen.getByLabelText("Emoji"), { target: { value: "🧹" } });
    fireEvent.click(screen.getByLabelText("Routine"));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1));
    expect(updateMock).toHaveBeenCalledWith({
      id: VACUUM,
      patch: { summary: "Hoover", emoji: "🧹", routine: true },
    });
    expect(withActor).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByLabelText("Title")).toBeNull());
  });

  it("a blank emoji is stored as none", async () => {
    renderSheet();

    fireEvent.click(screen.getByRole("button", { name: "Edit Brush teeth" }));
    fireEvent.change(screen.getByLabelText("Emoji"), { target: { value: "  " } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1));
    expect(updateMock.mock.calls[0][0].patch.emoji).toBeNull();
  });

  it("shows a refusal in the sheet and keeps the editor open (FR-393)", async () => {
    updateMock.mockResolvedValue(fail("FORBIDDEN", "Only a parent can change this."));
    renderSheet();

    fireEvent.click(screen.getByRole("button", { name: "Edit Vacuum" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Only a parent can change this.")).toBeTruthy();
    expect(screen.getByLabelText("Title")).toBeTruthy();
  });
});

describe("deleting a template warns first (FR-381, US4-12)", () => {
  it("asks before it writes, and says the deletion cannot be undone", () => {
    renderSheet();

    fireEvent.click(screen.getByRole("button", { name: "Delete Vacuum" }));

    expect(screen.getByText(/can’t be undone|cannot be undone/i)).toBeTruthy();
    // FR-381's other half, said where it will be read.
    expect(screen.getByText(/tasks already made from it/i)).toBeTruthy();
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it("confirming deletes with `confirm: true` through withActor", async () => {
    const { withActor } = renderSheet();

    fireEvent.click(screen.getByRole("button", { name: "Delete Vacuum" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete for good" }));

    await waitFor(() => expect(deleteMock).toHaveBeenCalledWith({ id: VACUUM, confirm: true }));
    expect(withActor).toHaveBeenCalledTimes(1);
  });

  it("backing out of the warning writes nothing", () => {
    renderSheet();

    fireEvent.click(screen.getByRole("button", { name: "Delete Vacuum" }));
    fireEvent.click(screen.getByRole("button", { name: "Keep it" }));

    expect(deleteMock).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Edit Vacuum" })).toBeTruthy();
  });
});

describe("FR-389's affordance: managing templates is a parent's", () => {
  it("a member is offered neither Edit nor Delete, but may still add from one", () => {
    const { onChoose } = renderSheet(
      {},
      {
        actor: makeActor("member", { profileId: "cleo" }),
        categories: [
          makeCategory({ id: "ana", label: "Ana", role: "parent" }),
          makeCategory({ id: "cleo", label: "Cleo", role: "member" }),
        ],
      },
    );

    expect(screen.queryByRole("button", { name: "Edit Vacuum" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Delete Vacuum" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Vacuum" }));
    expect(onChoose).toHaveBeenCalledTimes(1);
  });
});

describe("making a template here (FR-389, FR-377, SC-319)", () => {
  it("offers the same three fields, blank, and no fourth", () => {
    renderSheet();

    fireEvent.click(screen.getByRole("button", { name: "New template" }));

    const form = within(screen.getByRole("form", { name: "New template" }));
    expect(screen.getByLabelText("Title")).toHaveValue("");
    expect(screen.getByLabelText("Emoji")).toHaveValue("");
    expect(screen.getByLabelText("Routine")).not.toBeChecked();
    expect(form.getAllByRole("textbox")).toHaveLength(2);
    expect(screen.queryByText(/star|reward|point/i)).toBeNull();
  });

  it("creates through withActor with exactly the three fields", async () => {
    const { withActor } = renderSheet();

    fireEvent.click(screen.getByRole("button", { name: "New template" }));
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Water the plants" } });
    fireEvent.click(screen.getByLabelText("Routine"));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(createMock).toHaveBeenCalledTimes(1));
    expect(createMock).toHaveBeenCalledWith({
      summary: "Water the plants",
      emoji: null,
      routine: true,
    });
    expect(withActor).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole("form", { name: "New template" })).toBeNull());
  });

  it("backing out writes nothing", () => {
    renderSheet();

    fireEvent.click(screen.getByRole("button", { name: "New template" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(createMock).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "New template" })).toBeTruthy();
  });

  it("a member is not offered it at all — the server refuses either way", () => {
    renderSheet(
      {},
      {
        actor: makeActor("member", { profileId: "cleo" }),
        categories: [
          makeCategory({ id: "ana", label: "Ana", role: "parent" }),
          makeCategory({ id: "cleo", label: "Cleo", role: "member" }),
        ],
      },
    );

    expect(screen.queryByRole("button", { name: "New template" })).toBeNull();
  });
});
