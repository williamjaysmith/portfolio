import { describe, it, expect } from "vitest";
import type { RouteDef, Stop } from "@/lib/colectivo";
import {
  reconcile,
  moveStop,
  addStop,
  removeStop,
  toggleDelivered,
} from "@/lib/colectivo-state";

const stops: Record<string, Stop> = {
  a: { id: "a", name: "A", address: "1" },
  b: { id: "b", name: "B", address: "2" },
  c: { id: "c", name: "C", address: "3" },
  x: { id: "x", name: "X", address: "9" }, // from another route
};

const route: RouteDef = { id: "madison", label: "Madison", short: "MAD", color: "#000", stopIds: ["a", "b", "c"] };

describe("reconcile", () => {
  it("uses the default order when nothing is saved", () => {
    expect(reconcile(route, stops, null)).toEqual({ order: ["a", "b", "c"], delivered: [] });
  });

  it("keeps a saved custom order", () => {
    const saved = { order: ["c", "a", "b"], delivered: [] };
    expect(reconcile(route, stops, saved).order).toEqual(["c", "a", "b"]);
  });

  it("drops saved ids that no longer exist in the stops map", () => {
    const saved = { order: ["a", "gone", "b", "c"], delivered: ["gone"] };
    const result = reconcile(route, stops, saved);
    expect(result.order).toEqual(["a", "b", "c"]);
    expect(result.delivered).toEqual([]);
  });

  it("appends newly-added native stops missing from the saved order", () => {
    const saved = { order: ["b", "a"], delivered: [] }; // "c" added to defaults since save
    expect(reconcile(route, stops, saved).order).toEqual(["b", "a", "c"]);
  });

  it("appends newly-added native stops even when a stale id was also dropped", () => {
    const saved = { order: ["b", "gone"], delivered: [] }; // "gone" stale, "a" and "c" new natives
    const result = reconcile(route, stops, saved);
    expect(result.order).toEqual(["b", "a", "c"]);
  });

  it("keeps saved out-of-route (added) stops that still exist", () => {
    const saved = { order: ["a", "x", "b", "c"], delivered: [] };
    expect(reconcile(route, stops, saved).order).toEqual(["a", "x", "b", "c"]);
  });

  it("filters delivered down to ids still present in order", () => {
    const saved = { order: ["a", "b", "c"], delivered: ["b", "gone"] };
    expect(reconcile(route, stops, saved).delivered).toEqual(["b"]);
  });
});

describe("operations", () => {
  const base = { order: ["a", "b", "c"], delivered: [] as string[] };

  it("moveStop reorders active over target", () => {
    expect(moveStop(base, "a", "c").order).toEqual(["b", "c", "a"]);
  });

  it("addStop appends to the bottom when not present", () => {
    expect(addStop(base, "x").order).toEqual(["a", "b", "c", "x"]);
  });

  it("addStop is a no-op if the stop is already present", () => {
    expect(addStop(base, "a").order).toEqual(["a", "b", "c"]);
  });

  it("removeStop removes from order and delivered", () => {
    const s = { order: ["a", "x", "b"], delivered: ["x"] };
    expect(removeStop(s, "x")).toEqual({ order: ["a", "b"], delivered: [] });
  });

  it("toggleDelivered adds then removes an id", () => {
    const once = toggleDelivered(base, "b");
    expect(once.delivered).toEqual(["b"]);
    expect(toggleDelivered(once, "b").delivered).toEqual([]);
  });
});
