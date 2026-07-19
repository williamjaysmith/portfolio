import { describe, it, expect } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { getRoute } from "@/lib/colectivo";
import { createMemoryBackend } from "@/lib/colectivo-storage";
import { useRouteState } from "@/app/colectivo/routes/useRouteState";

const madison = getRoute("madison")!;

describe("useRouteState", () => {
  it("becomes ready with the default order", () => {
    const backend = createMemoryBackend();
    const { result } = renderHook(() => useRouteState(madison, backend));
    expect(result.current.ready).toBe(true);
    expect(result.current.state.order).toEqual(madison.stopIds);
  });

  it("persists a reorder to the backend", () => {
    const backend = createMemoryBackend();
    const { result } = renderHook(() => useRouteState(madison, backend));
    const [a, , c] = madison.stopIds;
    act(() => result.current.reorder(a, c));
    expect(backend.loadRoute("madison")?.order[2]).toBe(a);
  });

  it("reset restores defaults but keeps notes", () => {
    const backend = createMemoryBackend();
    const { result } = renderHook(() => useRouteState(madison, backend));
    act(() => result.current.setNote(madison.stopIds[0], "glass counter"));
    act(() => result.current.reorder(madison.stopIds[0], madison.stopIds[2]));
    act(() => result.current.reset());
    expect(result.current.state.order).toEqual(madison.stopIds);
    expect(result.current.notes[madison.stopIds[0]]).toBe("glass counter");
    expect(backend.loadNotes()[madison.stopIds[0]]).toBe("glass counter");
  });

  it("exportNotes formats saved notes as text", () => {
    const backend = createMemoryBackend();
    const { result } = renderHook(() => useRouteState(madison, backend));
    act(() => result.current.setNote("hilldale", "glass counter"));
    expect(result.current.exportNotes()).toContain("Colectivo Hilldale");
    expect(result.current.exportNotes()).toContain("glass counter");
  });
});
