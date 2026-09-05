import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { stubDialog } from "../../../components/__tests__/family-test-utils";
import { DeleteScopeDialog } from "../DeleteScopeDialog";

/**
 * T054 — FR-347's scope question, and the ASYMMETRY the reference actually has:
 * a repeating chore is offered all three scopes; a routine is offered "all
 * future" and "all" only, because a routine's single occurrence is removed with
 * Skip — which writes the same record a "this occurrence" delete would (FR-359,
 * FR-364). A one-off is asked nothing at all, which is the caller's contract:
 * the server refuses a scope on a task that does not repeat.
 *
 * The copy is the subject here, not the plumbing: "all future" has to say what
 * it KEEPS, or a parent reads it as "everything from the beginning".
 */

function renderDialog(routine: boolean, cursorMode = false) {
  const onChoose = vi.fn();
  const onCancel = vi.fn();
  render(
    <DeleteScopeDialog
      summary="Take out the trash"
      routine={routine}
      cursorMode={cursorMode}
      onChoose={onChoose}
      onCancel={onCancel}
    />,
  );
  return { onChoose, onCancel };
}

describe("DeleteScopeDialog", () => {
  beforeEach(() => {
    stubDialog();
  });

  it("offers a repeating chore all three scopes (FR-347)", () => {
    renderDialog(false);
    expect(screen.getByRole("radio", { name: "This one" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "This and all future ones" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "All of them" })).toBeInTheDocument();
  });

  it("offers a routine two, because Skip removes a single day instead (FR-359)", () => {
    renderDialog(true);
    expect(screen.queryByRole("radio", { name: "This one" })).toBeNull();
    expect(screen.getByRole("radio", { name: "This and all future ones" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "All of them" })).toBeInTheDocument();
    expect(screen.getByText(/use Skip to remove a single day/i)).toBeInTheDocument();
  });

  it("says what 'all future' keeps, rather than only what it removes", () => {
    renderDialog(false);
    expect(
      screen.getByText(/every earlier one stays, and so does everything already ticked off/i),
    ).toBeInTheDocument();
  });

  /**
   * FR-362: on a Completed Date chore "this one" writes a skip, which ADVANCES
   * the cycle — the opposite of the reading a parent will otherwise assume.
   */
  it("says that deleting one of a Completed Date chore still schedules the next", () => {
    renderDialog(false, true);
    expect(screen.getByText(/the next one is still scheduled/i)).toBeInTheDocument();
  });

  it("says nothing of the sort on a Scheduled Date chore, where it is not true", () => {
    renderDialog(false);
    expect(screen.queryByText(/the next one is still scheduled/i)).toBeNull();
  });

  it("names the task it is about", () => {
    renderDialog(false);
    expect(
      screen.getByRole("heading", { name: "Delete \u201cTake out the trash\u201d?" }),
    ).toBeInTheDocument();
  });

  it("answers with the chosen scope, and defaults to the narrowest one offered", () => {
    const { onChoose } = renderDialog(false);
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(onChoose).toHaveBeenCalledWith("this");
  });

  it("defaults a routine to 'all future', since 'this one' is not offered", () => {
    const { onChoose } = renderDialog(true);
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(onChoose).toHaveBeenCalledWith("this_and_future");
  });

  it("passes on a chosen scope other than the default", () => {
    const { onChoose } = renderDialog(false);
    fireEvent.click(screen.getByRole("radio", { name: "All of them" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(onChoose).toHaveBeenCalledWith("all");
  });

  it("cancels without choosing anything", () => {
    const { onChoose, onCancel } = renderDialog(false);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalled();
    expect(onChoose).not.toHaveBeenCalled();
  });
});
