import { describe, it, expect } from "vitest";
import {
  routes,
  stops,
  getRoute,
  isNative,
  homeRoutes,
  directionsUrl,
} from "@/lib/colectivo";

describe("colectivo data", () => {
  it("defines exactly the four routes", () => {
    expect(routes.map((r) => r.id).sort()).toEqual([
      "chicago",
      "kegs",
      "madison",
      "milwaukee",
    ]);
  });

  it("every stopId in every route exists in the stops map", () => {
    for (const route of routes) {
      for (const id of route.stopIds) {
        expect(stops[id], `${id} missing from stops`).toBeDefined();
      }
    }
  });
});

describe("helpers", () => {
  it("getRoute returns the matching route", () => {
    expect(getRoute("madison")?.label).toBe("Madison");
    expect(getRoute("chicago")?.id).toBe("chicago");
  });

  it("isNative is true only when the stop is in the route's stopIds", () => {
    const madison = getRoute("madison")!;
    const firstMadisonStop = madison.stopIds[0];
    expect(isNative(firstMadisonStop, "madison")).toBe(true);
    expect(isNative("does-not-exist", "madison")).toBe(false);
  });

  it("homeRoutes returns every route whose defaults include the stop", () => {
    const madison = getRoute("madison")!;
    const id = madison.stopIds[0];
    const result = homeRoutes(id).map((r) => r.id);
    expect(result).toContain("madison");
  });

  it("directionsUrl encodes the address and routes from current location", () => {
    const url = directionsUrl("702 N Midvale Blvd, Madison, WI");
    expect(url).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=702%20N%20Midvale%20Blvd%2C%20Madison%2C%20WI&travelmode=driving",
    );
  });
});
