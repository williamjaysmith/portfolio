import { describe, expect, it } from "vitest";

import { cacheBustedUrl, isChunkLoadError } from "../../recovery";

/**
 * What `app/family/error.tsx` decides with. The boundary reloads itself for a
 * chunk failure and for nothing else, so a false positive here would silently
 * reload on a real bug — hiding the very report the boundary exists to produce.
 */

describe("isChunkLoadError", () => {
  it("recognises Turbopack's error, which is what this project builds with", () => {
    const error = new Error("Failed to load chunk static/chunks/abc123.js");
    error.name = "ChunkLoadError";
    expect(isChunkLoadError(error)).toBe(true);
  });

  it("recognises webpack's wording, in case the build drops --turbopack", () => {
    const error = new Error("Loading chunk 472 failed.\n(missing: https://x/_next/chunk.js)");
    error.name = "ChunkLoadError";
    expect(isChunkLoadError(error)).toBe(true);
  });

  /** The name is the stable signal across bundlers; the message is the fallback. */
  it("accepts the name alone, whatever the message says", () => {
    const error = new Error("something else entirely");
    error.name = "ChunkLoadError";
    expect(isChunkLoadError(error)).toBe(true);
  });

  it("accepts the message alone, if the name was lost in serialisation", () => {
    expect(isChunkLoadError({ message: "Failed to load chunk 12" })).toBe(true);
  });

  /**
   * Duck-typed on purpose: what reaches an error boundary is not guaranteed to
   * be a same-realm `Error`, and a serialised one deserves the same handling.
   */
  it("does not require a real Error instance", () => {
    expect(isChunkLoadError({ name: "ChunkLoadError" })).toBe(true);
  });

  it("leaves an ordinary application error alone", () => {
    expect(isChunkLoadError(new TypeError("Cannot read properties of undefined"))).toBe(false);
    expect(isChunkLoadError(new Error("Expected a #RRGGBB colour"))).toBe(false);
  });

  it("is not fooled by the word chunk on its own", () => {
    expect(isChunkLoadError(new Error("chunked upload failed"))).toBe(false);
  });

  it("survives the things that are not errors at all", () => {
    expect(isChunkLoadError(null)).toBe(false);
    expect(isChunkLoadError(undefined)).toBe(false);
    expect(isChunkLoadError("ChunkLoadError")).toBe(false);
    expect(isChunkLoadError(0)).toBe(false);
  });
});

describe("cacheBustedUrl", () => {
  it("adds a stamp the cache has never seen", () => {
    expect(cacheBustedUrl("https://x.dev/family/calendar", 1_700_000_000_000)).toBe(
      "https://x.dev/family/calendar?reload=1700000000000",
    );
  });

  it("replaces its own stamp rather than stacking them up", () => {
    const once = cacheBustedUrl("https://x.dev/family/tasks?reload=1", 2);
    expect(cacheBustedUrl(once, 3)).toBe("https://x.dev/family/tasks?reload=3");
  });

  it("keeps any other query the route was carrying", () => {
    expect(cacheBustedUrl("https://x.dev/family/calendar?view=week", 5)).toBe(
      "https://x.dev/family/calendar?view=week&reload=5",
    );
  });

  it("keeps the path, so a reload lands on the tab it started from", () => {
    expect(cacheBustedUrl("https://x.dev/family/lists", 7)).toContain("/family/lists");
  });
});
