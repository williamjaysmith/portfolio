import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Scope } from "@/lib/family/types";

import { stubDialog } from "./family-test-utils";
import { ScopeDialog, type ScopeDialogMode } from "../ScopeDialog";

/**
 * T048 — the FR-237/250 same-wording rule (R213's jsdom tier): one component
 * serves edit, delete and drag, and the three option strings are byte-identical
 * in every mode; FR-287 removes "This event" when categories change; FR-242's
 * segment wording appears on "All events" after a split.
 *
 * FR-238 (no scope question for a non-repeating event) is a CALLER contract,
 * not a branch here: the dialog is never mounted for a one-off, so it has no
 * repeat-ness input and no non-repeating rendering to cover. The callers'
 * suites (form commit, delete flow, drag drop pipeline) own that assertion.
 */

const MODES: readonly ScopeDialogMode[] = ["edit", "delete", "move"];

/** FR-237's Clarified strings, asserted verbatim. */
const EXPECTED_OPTIONS = ["This event", "This and future events", "All events"] as const;

function renderDialog(overrides: Partial<Parameters<typeof ScopeDialog>[0]> = {}) {
  const onChoose = vi.fn<(scope: Scope) => void>();
  const onCancel = vi.fn<() => void>();
  render(<ScopeDialog mode="edit" onChoose={onChoose} onCancel={onCancel} {...overrides} />);
  return { onChoose, onCancel };
}

function optionNames(): string[] {
  return screen
    .getAllByRole("radio")
    .map((radio) => (radio as HTMLInputElement).labels?.[0]?.textContent?.trim() ?? "");
}

describe("ScopeDialog", () => {
  beforeEach(() => {
    stubDialog();
  });

  it.each(MODES)(
    "offers exactly 'This event' / 'This and future events' / 'All events' in %s mode (FR-237/250)",
    (mode) => {
      renderDialog({ mode });

      expect(optionNames()).toEqual([...EXPECTED_OPTIONS]);
      for (const label of EXPECTED_OPTIONS) {
        expect(screen.getByRole("radio", { name: label })).toBeInTheDocument();
      }
    },
  );

  it("titles the dialog by action while the question stays identical", () => {
    const titles: Record<ScopeDialogMode, string> = {
      edit: "Edit repeating event",
      delete: "Delete repeating event",
      move: "Move repeating event",
    };
    for (const mode of MODES) {
      const { unmount } = render(
        <ScopeDialog mode={mode} onChoose={vi.fn()} onCancel={vi.fn()} />,
      );
      expect(screen.getByRole("heading", { name: titles[mode] })).toBeInTheDocument();
      expect(screen.getByText("Which events should this apply to?")).toBeInTheDocument();
      unmount();
    }
  });

  it("groups the options as a radio group with 'This event' preselected", () => {
    renderDialog();

    expect(
      screen.getByRole("radiogroup", { name: "Which events should this apply to?" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "This event" })).toBeChecked();
  });

  it("does not offer 'This event' when categories are among the changed fields (FR-287, US2-18)", () => {
    renderDialog({ categoriesChanged: true });

    expect(optionNames()).toEqual(["This and future events", "All events"]);
    expect(screen.queryByRole("radio", { name: "This event" })).not.toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "This and future events" })).toBeChecked();
  });

  it("warns on 'All events' that a split repeat reaches only its own part (FR-242)", () => {
    // Split history is deliberately not stored (no lineage column), so the
    // caveat is worded to hold either way and is always shown rather than
    // hidden behind a signal the app cannot observe.
    render(<ScopeDialog mode="edit" onChoose={vi.fn()} onCancel={vi.fn()} />);

    // The note describes the option without changing its FR-237 name.
    expect(screen.getByRole("radio", { name: "All events" })).toHaveAccessibleDescription(
      "If this repeat was ever split by a \u201cthis and future\u201d change, this reaches only the part this event belongs to.",
    );
    expect(screen.getByRole("radio", { name: "This event" })).toHaveAccessibleDescription("");
  });

  it("reports the selected scope through onChoose", () => {
    const { onChoose, onCancel } = renderDialog({ mode: "delete" });

    fireEvent.click(screen.getByRole("radio", { name: "This and future events" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(onChoose).toHaveBeenCalledExactlyOnceWith("this_and_future");
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("cancels without choosing, from the button and from Escape alike", () => {
    const { onChoose, onCancel } = renderDialog({ mode: "move" });

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);

    // Escape reaches the <dialog> as a cancel event.
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
    expect(onCancel).toHaveBeenCalledTimes(2);
    expect(onChoose).not.toHaveBeenCalled();
  });
});

/**
 * 006 T007 — the noun (FR-629): the Meals tab asks the same question about
 * meals, in the spec's exact words, and the calendar's call sites — which pass
 * no noun — read exactly as they did.
 */
describe("ScopeDialog — the meal noun", () => {
  beforeEach(stubDialog);

  it("reads This meal / This and future meals / All meals, titled for the action", () => {
    render(<ScopeDialog mode="delete" noun="meal" onChoose={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "Delete repeating meal" })).toBeInTheDocument();
    expect(screen.getByText("Which meals should this apply to?")).toBeInTheDocument();
    expect(screen.getAllByRole("radio").map((radio) => radio.closest("label")?.textContent?.trim())).toEqual([
      "This meal",
      "This and future meals",
      "All meals",
    ]);
    expect(screen.getByText(/reaches only the part this meal belongs to/)).toBeInTheDocument();
  });

  it("defaults to the event, so the calendar's wording is untouched", () => {
    render(<ScopeDialog mode="edit" onChoose={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "Edit repeating event" })).toBeInTheDocument();
    expect(screen.getByText("Which events should this apply to?")).toBeInTheDocument();
  });
});
