import { describe, it, expect, beforeEach } from "vitest";
import {
  createBrowserBackend,
  createMemoryBackend,
} from "@/lib/colectivo-storage";

describe("memory backend", () => {
  it("round-trips route state", () => {
    const b = createMemoryBackend();
    expect(b.loadRoute("madison")).toBeNull();
    b.saveRoute("madison", { order: ["a", "b"], delivered: ["a"] });
    expect(b.loadRoute("madison")).toEqual({ order: ["a", "b"], delivered: ["a"] });
  });

  it("clears a single route without touching notes", () => {
    const b = createMemoryBackend();
    b.saveRoute("madison", { order: ["a"], delivered: [] });
    b.saveNotes({ a: "hi" });
    b.clearRoute("madison");
    expect(b.loadRoute("madison")).toBeNull();
    expect(b.loadNotes()).toEqual({ a: "hi" });
  });
});

describe("browser backend", () => {
  beforeEach(() => localStorage.clear());

  it("persists route state to localStorage", () => {
    const b = createBrowserBackend();
    b.saveRoute("chicago", { order: ["x"], delivered: [] });
    expect(JSON.parse(localStorage.getItem("colectivo:route:chicago")!)).toEqual({
      order: ["x"],
      delivered: [],
    });
  });

  it("returns null for corrupt JSON instead of throwing", () => {
    localStorage.setItem("colectivo:route:madison", "{not valid json");
    const b = createBrowserBackend();
    expect(b.loadRoute("madison")).toBeNull();
  });

  it("persists notes under colectivo:notes", () => {
    const b = createBrowserBackend();
    b.saveNotes({ hilldale: "glass counter" });
    expect(b.loadNotes()).toEqual({ hilldale: "glass counter" });
  });
});
