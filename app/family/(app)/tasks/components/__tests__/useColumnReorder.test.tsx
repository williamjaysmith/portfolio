import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Reorder } from "@/lib/family/tasks/reorder";

import {
  householdOrderOf,
  previewed,
  reorderKeyStepOf,
  useListReorder,
} from "../useColumnReorder";

/**
 * T076 — press-and-hold reordering, both of the board's lists (FR-309, FR-310,
 * FR-397, R321).
 *
 * The pure half is a table: FR-309's reconstruction rule, which is the one that
 * silently reorders or drops Labels when it is wrong, and the arrow-key mapping
 * each list's own axis gives.
 *
 * The gesture half is driven for real, because everything that can go wrong
 * about it only exists once there is a gesture: a press that moves before the
 * hold completes belongs to the scroll or to the paging swipe and must commit
 * nothing; a press that does not land on the handle is not a drag at all; and a
 * list this person may not reorder must not respond to either.
 *
 * jsdom lays nothing out, so every rect is zero and "which row is the pointer
 * over" would always answer "the first". The rects below are therefore stubbed
 * from each row's CURRENT position among its siblings — which is what makes the
 * drag preview part of the test rather than beside it.
 */

const ROW_HEIGHT = 100;

interface Harness {
  ids: readonly string[];
  enabled?: boolean;
  keyboard?: boolean;
  onDrop: (move: Reorder, movedId: string) => void;
}

function ReorderHarness({ ids, enabled = true, keyboard = true, onDrop }: Harness) {
  const items = ids.map((id, index) => ({ id, sortOrder: (index + 1) * 1000 }));
  const reorder = useListReorder({
    items,
    axis: "vertical",
    rowSelector: "[data-row]",
    handleSelector: "[data-handle]",
    labelOf: (id) => id.toUpperCase(),
    enabled,
    keyboard,
    onDrop,
  });

  return (
    <div {...reorder.containerProps} data-testid="container">
      {previewed(items, reorder.order, (one) => one.id).map((item) => (
        <div key={item.id} data-row={item.id}>
          <button type="button" data-handle>
            {item.id}
          </button>
        </div>
      ))}
      <p data-testid="say">{reorder.announcement}</p>
    </div>
  );
}

/** Each element's rect from where it currently sits among its siblings. */
function stubLayout(): void {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
    this: HTMLElement,
  ) {
    const siblings = this.parentElement === null ? [] : [...this.parentElement.children];
    const index = Math.max(0, siblings.indexOf(this));
    const top = index * ROW_HEIGHT;
    return {
      top,
      bottom: top + ROW_HEIGHT,
      left: 0,
      right: 200,
      width: 200,
      height: ROW_HEIGHT,
      x: 0,
      y: top,
      toJSON: () => ({}),
    } as DOMRect;
  });
}

function setup(options: Partial<Harness> = {}) {
  const onDrop = vi.fn();
  render(
    <ReorderHarness ids={options.ids ?? ["a", "b", "c"]} onDrop={onDrop} {...options} />,
  );
  return { onDrop, container: screen.getByTestId("container") };
}

/** Press the handle of `id`, wait out the hold, and report whether it armed. */
function press(id: string, at = 0): void {
  const handle = screen.getByText(id);
  fireEvent.pointerDown(handle, { clientX: 10, clientY: at * ROW_HEIGHT + 10 });
}

function hold(): void {
  act(() => {
    vi.advanceTimersByTime(500);
  });
}

describe("householdOrderOf: FR-309's reconstruction rule", () => {
  it("re-emits the WHOLE household order, moving only the ids the board draws", () => {
    // A Label sits between two Profiles the board never shows it beside.
    const all = ["ana", "bin-day", "bea", "cleo"];

    expect(householdOrderOf(all, ["cleo", "ana", "bea"])).toEqual([
      "cleo",
      "bin-day",
      "ana",
      "bea",
    ]);
  });

  it("leaves a hidden Profile exactly where it was (FR-313, FR-383)", () => {
    const all = ["ana", "hidden", "bea"];

    expect(householdOrderOf(all, ["bea", "ana"])).toEqual(["bea", "hidden", "ana"]);
  });

  it("returns the household order untouched when the drawn list is not a subset", () => {
    // A stale id would otherwise be spliced in and a real one dropped.
    expect(householdOrderOf(["ana", "bea"], ["bea", "ghost"])).toEqual(["ana", "bea"]);
  });

  it("is the identity when nothing moved", () => {
    expect(householdOrderOf(["ana", "bea"], ["ana", "bea"])).toEqual(["ana", "bea"]);
  });
});

describe("reorderKeyStepOf", () => {
  it("moves the columns with Left and Right, and nothing else", () => {
    expect(reorderKeyStepOf("ArrowRight", "horizontal")).toBe(1);
    expect(reorderKeyStepOf("ArrowLeft", "horizontal")).toBe(-1);
    expect(reorderKeyStepOf("ArrowDown", "horizontal")).toBeNull();
  });

  it("moves a section's routines with Up and Down, and nothing else", () => {
    expect(reorderKeyStepOf("ArrowDown", "vertical")).toBe(1);
    expect(reorderKeyStepOf("ArrowUp", "vertical")).toBe(-1);
    expect(reorderKeyStepOf("ArrowRight", "vertical")).toBeNull();
  });
});

describe("previewed", () => {
  const rows = [{ id: "a" }, { id: "b" }];

  it("paints the stored order when nothing is in flight", () => {
    expect(previewed(rows, null, (one) => one.id)).toBe(rows);
  });

  it("paints the drop's preview while a row is carried", () => {
    expect(previewed(rows, ["b", "a"], (one) => one.id)).toEqual([{ id: "b" }, { id: "a" }]);
  });

  it("falls back to the stored order when the preview names a row that is gone", () => {
    expect(previewed(rows, ["b", "ghost"], (one) => one.id)).toBe(rows);
  });
});

describe("useListReorder: the press-and-hold gesture", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    stubLayout();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("picks a row up after the hold, carries it, and drops it there", () => {
    const { onDrop, container } = setup();

    press("a", 0);
    hold();
    expect(screen.getByTestId("say")).toHaveTextContent("A, position 1 of 3. Picked up.");

    fireEvent.pointerMove(container, { clientX: 10, clientY: 2 * ROW_HEIGHT + 10 });
    fireEvent.pointerUp(container, { clientX: 10, clientY: 2 * ROW_HEIGHT + 10 });

    expect(onDrop).toHaveBeenCalledTimes(1);
    expect(onDrop.mock.calls[0][0].order).toEqual(["b", "c", "a"]);
    expect(onDrop.mock.calls[0][1]).toBe("a");
  });

  it("writes ONE row per drop, never a renumber (R321)", () => {
    const { onDrop, container } = setup();

    press("a", 0);
    hold();
    fireEvent.pointerMove(container, { clientX: 10, clientY: ROW_HEIGHT + 10 });
    fireEvent.pointerUp(container, { clientX: 10, clientY: ROW_HEIGHT + 10 });

    expect(onDrop.mock.calls[0][0].writes).toHaveLength(1);
  });

  it("gives the gesture up when it moves before the hold completes", () => {
    const { onDrop, container } = setup();

    press("a", 0);
    // A scroll, or the board's own paging swipe — not this list's gesture.
    fireEvent.pointerMove(container, { clientX: 90, clientY: 40 });
    hold();
    fireEvent.pointerMove(container, { clientX: 10, clientY: 2 * ROW_HEIGHT + 10 });
    fireEvent.pointerUp(container, { clientX: 10, clientY: 2 * ROW_HEIGHT + 10 });

    expect(onDrop).not.toHaveBeenCalled();
  });

  it("ignores a press that did not land on the handle (FR-309's name)", () => {
    const { onDrop, container } = setup();

    fireEvent.pointerDown(screen.getByTestId("say"), { clientX: 10, clientY: 10 });
    hold();
    fireEvent.pointerMove(container, { clientX: 10, clientY: 2 * ROW_HEIGHT + 10 });
    fireEvent.pointerUp(container, { clientX: 10, clientY: 2 * ROW_HEIGHT + 10 });

    expect(onDrop).not.toHaveBeenCalled();
  });

  it("does nothing at all for a person this list is not open to (FR-389)", () => {
    const { onDrop, container } = setup({ enabled: false });

    press("a", 0);
    hold();
    fireEvent.pointerMove(container, { clientX: 10, clientY: 2 * ROW_HEIGHT + 10 });
    fireEvent.pointerUp(container, { clientX: 10, clientY: 2 * ROW_HEIGHT + 10 });
    fireEvent.keyDown(screen.getByText("a"), { key: "Enter" });

    expect(onDrop).not.toHaveBeenCalled();
  });

  it("a cancelled pointer leaves the list alone", () => {
    const { onDrop, container } = setup();

    press("a", 0);
    hold();
    fireEvent.pointerMove(container, { clientX: 10, clientY: 2 * ROW_HEIGHT + 10 });
    fireEvent.pointerCancel(container);
    fireEvent.pointerUp(container, { clientX: 10, clientY: 2 * ROW_HEIGHT + 10 });

    expect(onDrop).not.toHaveBeenCalled();
  });

  it("says nothing was written when the row is dropped where it already was", () => {
    const { onDrop } = setup();

    press("b", 1);
    hold();
    fireEvent.pointerUp(screen.getByTestId("container"), { clientX: 10, clientY: ROW_HEIGHT + 10 });

    expect(onDrop).not.toHaveBeenCalled();
    expect(screen.getByTestId("say")).toHaveTextContent("B stayed where it was.");
  });
});

describe("useListReorder: the keyboard path (FR-397)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    stubLayout();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("picks up, moves and drops through the SAME reducer the pointer uses", () => {
    const { onDrop } = setup();
    const handle = screen.getByText("a");

    fireEvent.keyDown(handle, { key: "Enter" });
    fireEvent.keyDown(handle, { key: "ArrowDown" });
    expect(screen.getByTestId("say")).toHaveTextContent("A, position 2 of 3");
    fireEvent.keyDown(handle, { key: "Enter" });

    expect(onDrop).toHaveBeenCalledTimes(1);
    expect(onDrop.mock.calls[0][0].order).toEqual(["b", "a", "c"]);
  });

  it("does not walk a row off either end of the list", () => {
    const { onDrop } = setup();
    const handle = screen.getByText("a");

    fireEvent.keyDown(handle, { key: " " });
    fireEvent.keyDown(handle, { key: "ArrowUp" });
    fireEvent.keyDown(handle, { key: " " });

    expect(onDrop).not.toHaveBeenCalled();
  });

  it("puts the row back on Escape, writing nothing", () => {
    const { onDrop } = setup();
    const handle = screen.getByText("a");

    fireEvent.keyDown(handle, { key: "Enter" });
    fireEvent.keyDown(handle, { key: "ArrowDown" });
    fireEvent.keyDown(handle, { key: "Escape" });

    expect(onDrop).not.toHaveBeenCalled();
    expect(screen.getByTestId("say")).toHaveTextContent("A, position 1 of 3. Put back.");
  });

  it("leaves Enter alone on a list whose rows have their own action (FR-352)", () => {
    const { onDrop } = setup({ keyboard: false });
    const handle = screen.getByText("a");

    fireEvent.keyDown(handle, { key: "Enter" });
    fireEvent.keyDown(handle, { key: "ArrowDown" });
    fireEvent.keyDown(handle, { key: "Enter" });

    expect(onDrop).not.toHaveBeenCalled();
  });
});
