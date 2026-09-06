import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { fail, ok } from "./action-result";
import { settleEdit, useWriteSurface } from "../useWriteSurface";

/**
 * The write-surface state both boards share (003 T057's editor, 004 T032's):
 * which dialog is open, the one line a write leaves behind, and the edit
 * commit's FR-393 arm — a `NOT_FOUND` closes the surface and says so rather
 * than recreating what another device already deleted.
 */

type Surface = { kind: "closed" } | { kind: "create" } | { kind: "edit"; id: string };

const CLOSED: Surface = { kind: "closed" };
const GONE = "That thing is no longer here.";

describe("useWriteSurface", () => {
  it("starts closed with nothing to say", () => {
    const { result } = renderHook(() => useWriteSurface<Surface>(CLOSED, GONE));
    expect(result.current.surface).toEqual(CLOSED);
    expect(result.current.notice).toBeNull();
  });

  it("opening a surface clears the last write's notice", () => {
    const { result } = renderHook(() => useWriteSurface<Surface>(CLOSED, GONE));

    act(() => result.current.setNotice("Refused."));
    expect(result.current.notice).toBe("Refused.");

    act(() => result.current.open({ kind: "edit", id: "row-1" }));
    expect(result.current.surface).toEqual({ kind: "edit", id: "row-1" });
    expect(result.current.notice).toBeNull();
  });

  it("closing leaves the notice where it is, and clearing leaves the surface", () => {
    const { result } = renderHook(() => useWriteSurface<Surface>(CLOSED, GONE));

    act(() => result.current.open({ kind: "create" }));
    act(() => result.current.setNotice("Refused."));
    act(() => result.current.close());
    expect(result.current.surface).toEqual(CLOSED);
    expect(result.current.notice).toBe("Refused.");

    act(() => result.current.open({ kind: "create" }));
    act(() => result.current.setNotice("Refused again."));
    act(() => result.current.clearNotice());
    expect(result.current.surface).toEqual({ kind: "create" });
    expect(result.current.notice).toBeNull();
  });

  it("reportGone closes the surface and says the row has gone (FR-393)", () => {
    const { result } = renderHook(() => useWriteSurface<Surface>(CLOSED, GONE));

    act(() => result.current.open({ kind: "edit", id: "row-1" }));
    act(() => result.current.reportGone());

    expect(result.current.surface).toEqual(CLOSED);
    expect(result.current.notice).toBe(GONE);
  });

  it("hands back stable callbacks, so they are safe in a memo's dependencies", () => {
    const { result, rerender } = renderHook(() => useWriteSurface<Surface>(CLOSED, GONE));
    const first = result.current;
    rerender();
    expect(result.current.open).toBe(first.open);
    expect(result.current.close).toBe(first.close);
    expect(result.current.clearNotice).toBe(first.clearNotice);
    expect(result.current.reportGone).toBe(first.reportGone);
  });
});

describe("settleEdit", () => {
  it("hands a success back to the form untouched", async () => {
    const onGone = vi.fn();
    await expect(settleEdit(() => Promise.resolve(ok({ id: "row-1" })), onGone)).resolves.toEqual(
      ok({ id: "row-1" }),
    );
    expect(onGone).not.toHaveBeenCalled();
  });

  it("hands any other refusal back for the form to show", async () => {
    const onGone = vi.fn();
    const refused = fail("FORBIDDEN");
    await expect(settleEdit(() => Promise.resolve(refused), onGone)).resolves.toBe(refused);
    expect(onGone).not.toHaveBeenCalled();
  });

  it("on NOT_FOUND reports the row gone and gives the form nothing to show", async () => {
    const onGone = vi.fn();
    await expect(settleEdit(() => Promise.resolve(fail("NOT_FOUND")), onGone)).resolves.toBeNull();
    expect(onGone).toHaveBeenCalledTimes(1);
  });
});
