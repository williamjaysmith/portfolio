import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TaskSearch } from "../TaskSearch";

/**
 * T069 — FR-386's search control, on its own.
 *
 * The control owns nothing. The query string lives in `TasksBoard` (R319:
 * search is component state, never a store), so everything here is about the
 * box being a faithful window onto that state: it reports each keystroke, it
 * draws whatever the board hands back, and its clear reports the empty string
 * rather than emptying itself. What the query DOES to the board is
 * `tasks-visibility.test.ts`'s table and `TasksBoard.test.tsx`'s SC-320 case.
 */

function box(): HTMLElement {
  return screen.getByRole("searchbox", { name: "Search tasks" });
}

describe("TaskSearch (FR-386)", () => {
  it("reports every keystroke to the board, which owns the query", () => {
    const onChange = vi.fn();
    render(<TaskSearch value="" onChange={onChange} />);

    fireEvent.change(box(), { target: { value: "trash" } });

    expect(onChange).toHaveBeenCalledWith("trash");
  });

  it("draws the board's query and never a copy of its own", () => {
    const { rerender } = render(<TaskSearch value="trash" onChange={vi.fn()} />);
    expect(box()).toHaveValue("trash");

    rerender(<TaskSearch value="bin" onChange={vi.fn()} />);
    expect(box()).toHaveValue("bin");
  });

  it("offers a clear only while there is something to clear", () => {
    const onChange = vi.fn();
    const { rerender } = render(<TaskSearch value="" onChange={onChange} />);
    expect(screen.queryByRole("button", { name: "Clear search" })).toBeNull();

    rerender(<TaskSearch value="trash" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));

    // Clearing is the board restoring every card (SC-320), so it goes back the
    // same way a keystroke does.
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("keeps both of its controls on the touch floor (FR-397)", () => {
    render(<TaskSearch value="trash" onChange={vi.fn()} />);

    expect(box().className).toContain("min-h-(--fam-touch)");
    const clear = screen.getByRole("button", { name: "Clear search" });
    expect(clear.className).toContain("min-h-(--fam-touch)");
    expect(clear.className).toContain("min-w-(--fam-touch)");
  });
});
