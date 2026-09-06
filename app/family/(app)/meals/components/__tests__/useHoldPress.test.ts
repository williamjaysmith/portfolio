import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PointerEvent as ReactPointerEvent } from "react";

import { useHoldPress } from "../useHoldPress";

/**
 * 006 FR-623's press-and-hold on a cell: a hold that completes fires once and
 * consumes the click that follows; a press that moves or lifts early fires
 * nothing; a cell unmounted mid-press fires nothing later.
 */

const press = (x = 10, y = 10) => ({ isPrimary: true, clientX: x, clientY: y, pointerId: 1, currentTarget: { setPointerCapture: () => undefined, releasePointerCapture: () => undefined } }) as unknown as ReactPointerEvent<HTMLElement>;

describe("useHoldPress", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("fires the hold once the timer runs, and consumes the click that follows", () => {
    const onHold = vi.fn();
    const { result } = renderHook(() => useHoldPress(onHold));
    act(() => result.current.onPointerDown(press()));
    act(() => vi.advanceTimersByTime(1000));
    expect(onHold).toHaveBeenCalledTimes(1);
    expect(result.current.consumeClick()).toBe(true);
    expect(result.current.consumeClick()).toBe(false);
  });

  it("fires nothing when the press lifts early or moves away", () => {
    const onHold = vi.fn();
    const { result } = renderHook(() => useHoldPress(onHold));
    act(() => result.current.onPointerDown(press()));
    act(() => result.current.onPointerUp());
    act(() => vi.advanceTimersByTime(1000));
    act(() => result.current.onPointerDown(press()));
    act(() => result.current.onPointerMove(press(80, 10)));
    act(() => vi.advanceTimersByTime(1000));
    expect(onHold).not.toHaveBeenCalled();
  });

  it("fires nothing after the cell has gone", () => {
    const onHold = vi.fn();
    const { result, unmount } = renderHook(() => useHoldPress(onHold));
    act(() => result.current.onPointerDown(press()));
    unmount();
    act(() => vi.advanceTimersByTime(1000));
    expect(onHold).not.toHaveBeenCalled();
  });
});
