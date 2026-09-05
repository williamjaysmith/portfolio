import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ColumnPager, columnsInWords, pageStartOf, useColumnPage } from "../ColumnPager";

/**
 * T075 — the board's own pager (FR-396, R320).
 *
 * Three tiers, mirroring `WeekPager`'s split. The tiling is pure and is tested
 * as a table: where a page may start, and what the person on the phone is told
 * is on screen. The window is a hook and is driven with `renderHook`, because
 * clamping on READ — rather than correcting with an effect — is precisely what
 * makes a rotation land on a legal page in the same render. Above both, one RTL
 * pass drives real pointer events through framer-motion's pan, which is the
 * only way to prove that a swipe pages once, that a vertical gesture is left to
 * the column's own scroll, and that a board which fits wraps nothing around
 * itself at all.
 *
 * The three swipe DECISIONS are not re-tested here: they are
 * `lib/family/swipe.ts`'s and are asserted in `swipe.test.ts`, shared with the
 * calendar. What is asserted here is that this pager binds to them.
 *
 * jsdom needs `isPrimary` on every pointer event — framer's pan session drops
 * non-primary pointers, and jsdom's `PointerEvent` defaults it to false.
 */

const POINTER = { pointerId: 1, isPrimary: true, button: 0, buttons: 1, pointerType: "touch" };

interface Point {
  x: number;
  y: number;
}

/** framer reports one move per animation frame; two nested frames separate them. */
async function settle(): Promise<void> {
  await act(async () => {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
  });
}

async function swipe(node: Element, from: Point, path: readonly Point[]): Promise<void> {
  await act(async () => {
    fireEvent.pointerDown(node, { ...POINTER, clientX: from.x, clientY: from.y });
  });
  let last = from;
  for (const point of path) {
    await act(async () => {
      fireEvent.pointerMove(window, { ...POINTER, clientX: point.x, clientY: point.y });
    });
    await settle();
    last = point;
  }
  await act(async () => {
    fireEvent.pointerUp(window, { ...POINTER, buttons: 0, clientX: last.x, clientY: last.y });
  });
  await settle();
}

function renderPager(options: { paged?: boolean; suspended?: boolean } = {}) {
  const onPage = vi.fn();
  render(
    <ColumnPager
      paged={options.paged ?? true}
      suspended={options.suspended}
      onPage={onPage}
      visibleLabels={["Up for Grabs"]}
    >
      <div data-testid="strip">Up for Grabs</div>
    </ColumnPager>,
  );
  return { onPage, strip: screen.getByTestId("strip") };
}

describe("pageStartOf", () => {
  it("keeps a whole window on screen, so the last page is never a gap", () => {
    // Four columns, two fit: the last legal start is 2, not 3.
    expect(pageStartOf(3, 4, 2)).toBe(2);
    expect(pageStartOf(2, 4, 2)).toBe(2);
  });

  it("clamps at Up for Grabs rather than wrapping round (FR-396)", () => {
    expect(pageStartOf(-1, 4, 1)).toBe(0);
    expect(pageStartOf(0, 4, 1)).toBe(0);
  });

  it("clamps at the far end rather than wrapping round", () => {
    expect(pageStartOf(99, 4, 1)).toBe(3);
  });

  it("is 0 when every column already fits", () => {
    expect(pageStartOf(2, 3, 4)).toBe(0);
  });

  it("survives a perRow of zero, which a board mid-unmount can report", () => {
    expect(pageStartOf(2, 4, 0)).toBe(2);
  });
});

describe("columnsInWords", () => {
  it("names one column, two columns and many", () => {
    expect(columnsInWords(["Cleo"])).toBe("Cleo");
    expect(columnsInWords(["Cleo", "Bea"])).toBe("Cleo and Bea");
    expect(columnsInWords(["Up for Grabs", "Cleo", "Bea"])).toBe("Up for Grabs, Cleo and Bea");
  });

  it("says nothing about no columns", () => {
    expect(columnsInWords([])).toBe("");
  });
});

describe("useColumnPage: which columns are on screen", () => {
  it("opens on Up for Grabs and shows one column on a phone (FR-396, US4-14)", () => {
    const { result } = renderHook(() =>
      useColumnPage({ columnCount: 4, perRow: 1, mode: "pager" }),
    );

    expect(result.current).toMatchObject({ paged: true, start: 0, end: 1 });
  });

  it("steps ONE column per swipe, so each reveals exactly one more profile", () => {
    const { result } = renderHook(() =>
      useColumnPage({ columnCount: 4, perRow: 1, mode: "pager" }),
    );

    act(() => result.current.step(1));
    expect(result.current).toMatchObject({ start: 1, end: 2 });
    act(() => result.current.step(1));
    expect(result.current).toMatchObject({ start: 2, end: 3 });
    act(() => result.current.step(-1));
    expect(result.current).toMatchObject({ start: 1, end: 2 });
  });

  it("does not page past either end", () => {
    const { result } = renderHook(() =>
      useColumnPage({ columnCount: 2, perRow: 1, mode: "pager" }),
    );

    act(() => result.current.step(-1));
    expect(result.current.start).toBe(0);
    act(() => result.current.step(1));
    act(() => result.current.step(1));
    expect(result.current.start).toBe(1);
  });

  it("is not paged at all when every column fits — the wall tablet", () => {
    const { result } = renderHook(() =>
      useColumnPage({ columnCount: 4, perRow: 4, mode: "grid" }),
    );

    expect(result.current).toMatchObject({ paged: false, start: 0, end: 4 });
  });

  it("is not paged when the columns WRAP instead (FR-395's portrait tablet)", () => {
    const { result } = renderHook(() =>
      useColumnPage({ columnCount: 4, perRow: 2, mode: "grid" }),
    );

    // Every column is drawn; the second row is the grid's business, not the
    // pager's — the wrap is a consequence of the fit, not a separate layout.
    expect(result.current).toMatchObject({ paged: false, start: 0, end: 4 });
  });

  it("lands on a legal page in the same render when the viewport changes", () => {
    const { result, rerender } = renderHook(
      (input: { columnCount: number; perRow: number }) =>
        useColumnPage({ ...input, mode: "pager" as const }),
      { initialProps: { columnCount: 4, perRow: 1 } },
    );

    act(() => result.current.step(1));
    act(() => result.current.step(1));
    act(() => result.current.step(1));
    expect(result.current.start).toBe(3);

    // The phone is turned: three columns now fit, so the only legal start is 1.
    rerender({ columnCount: 4, perRow: 3 });
    expect(result.current).toMatchObject({ start: 1, end: 4 });
  });
});

describe("ColumnPager", () => {
  it("pages one column later on a swipe left (FR-396)", async () => {
    const { onPage, strip } = renderPager();
    await swipe(strip, { x: 300, y: 400 }, [
      { x: 280, y: 402 },
      { x: 220, y: 404 },
      { x: 160, y: 404 },
    ]);
    expect(onPage.mock.calls).toEqual([[1]]);
  });

  it("pages one column earlier on a swipe right", async () => {
    const { onPage, strip } = renderPager();
    await swipe(strip, { x: 160, y: 400 }, [
      { x: 190, y: 400 },
      { x: 260, y: 398 },
    ]);
    expect(onPage.mock.calls).toEqual([[-1]]);
  });

  it("leaves a vertical gesture to the column's own scroll (FR-394, SC-315)", async () => {
    const { onPage, strip } = renderPager();
    await swipe(strip, { x: 200, y: 600 }, [
      { x: 202, y: 560 },
      { x: 204, y: 400 },
    ]);
    expect(onPage).not.toHaveBeenCalled();
  });

  it("stands down while a press-and-hold reorder owns the pointer (T076)", async () => {
    const { onPage, strip } = renderPager({ suspended: true });
    await swipe(strip, { x: 300, y: 400 }, [
      { x: 200, y: 402 },
      { x: 100, y: 404 },
    ]);
    expect(onPage).not.toHaveBeenCalled();
  });

  it("says which columns are on screen (FR-397)", () => {
    renderPager();
    expect(screen.getByRole("status")).toHaveTextContent("Showing Up for Grabs");
  });

  it("pages from the keyboard too, so the swipe is not the only way (FR-397)", () => {
    const { onPage } = renderPager();
    const group = screen.getByRole("group", { name: "Profile columns" });

    fireEvent.keyDown(group, { key: "ArrowRight" });
    fireEvent.keyDown(group, { key: "ArrowLeft" });
    fireEvent.keyDown(group, { key: "a" });

    expect(onPage.mock.calls).toEqual([[1], [-1]]);
  });

  it("wraps nothing around a board that fits — no group, no live region", () => {
    renderPager({ paged: false });

    expect(screen.getByTestId("strip")).toBeInTheDocument();
    expect(screen.queryByRole("group")).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
  });
});
