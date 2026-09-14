import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import FamilyError from "../error";

/**
 * The boundary that replaces Next's "Application error: a client-side exception
 * has occurred" on every `/family` screen.
 *
 * **Why `vi.stubGlobal` and not a spy.** `vi.spyOn(window.location, "reload")`
 * throws `Cannot redefine property` under this repo's jsdom — measured, not
 * assumed — and a real navigation in a test would take the suite with it.
 * Replacing the whole `location` object is the shape that works here.
 */

function chunkError(): Error & { digest?: string } {
  const error = new Error("Failed to load chunk static/chunks/9f2a.js");
  error.name = "ChunkLoadError";
  return error;
}

const HREF = "https://x.dev/family/calendar";

let replace: ReturnType<typeof vi.fn>;

beforeEach(() => {
  sessionStorage.clear();
  replace = vi.fn();
  vi.stubGlobal("location", { href: HREF, replace });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("the /family error boundary", () => {
  it("shows a recovery screen instead of the framework default", () => {
    render(<FamilyError error={new TypeError("x.map is not a function")} reset={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "Something went wrong" })).toBeInTheDocument();
  });

  /**
   * The whole reason the boundary was added: the household's phone has no
   * devtools, so an error that is not on the screen cannot be reported.
   */
  it("puts the actual error on screen, where it can be read off the device", () => {
    const error = Object.assign(new TypeError("x.map is not a function"), { digest: "abc123" });
    render(<FamilyError error={error} reset={vi.fn()} />);
    expect(screen.getByText(/TypeError: x\.map is not a function/)).toBeInTheDocument();
    expect(screen.getByText(/abc123/)).toBeInTheDocument();
  });

  it("offers the framework's own retry", () => {
    const reset = vi.fn();
    render(<FamilyError error={new Error("nope")} reset={reset} />);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("reloads by hand with a cache-busting URL", () => {
    render(<FamilyError error={new Error("nope")} reset={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Reload the app" }));
    expect(replace).toHaveBeenCalledTimes(1);
    expect(String(replace.mock.calls[0][0])).toMatch(/\/family\/calendar\?reload=\d+/);
  });

  /** The one error the page cannot recover from in place. */
  it("reloads itself on a chunk failure, without being asked", () => {
    render(<FamilyError error={chunkError()} reset={vi.fn()} />);
    expect(replace).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("heading", { name: "Updating the app…" })).toBeInTheDocument();
  });

  it("does not auto-reload on an ordinary error — that would hide the report", () => {
    render(<FamilyError error={new TypeError("x.map is not a function")} reset={vi.fn()} />);
    expect(replace).not.toHaveBeenCalled();
  });

  /**
   * **The loop guard.** A home-screen app has no address bar, so a reload loop
   * leaves the household no way to stop it and no way to read what happened.
   */
  it("auto-reloads only once per session", () => {
    const { unmount } = render(<FamilyError error={chunkError()} reset={vi.fn()} />);
    expect(replace).toHaveBeenCalledTimes(1);
    unmount();

    render(<FamilyError error={chunkError()} reset={vi.fn()} />);
    expect(replace).toHaveBeenCalledTimes(1);
    // Second time round it falls through to the screen, with the buttons.
    expect(screen.getByRole("heading", { name: "Something went wrong" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reload the app" })).toBeInTheDocument();
  });

  /** No storage means no guard, and an unguarded auto-reload is worse than none. */
  it("refuses to auto-reload when sessionStorage is unavailable", () => {
    vi.spyOn(window.sessionStorage, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    render(<FamilyError error={chunkError()} reset={vi.fn()} />);
    expect(replace).not.toHaveBeenCalled();
  });

  it("logs the error, since a standalone app has no console the family can reach", () => {
    render(<FamilyError error={chunkError()} reset={vi.fn()} />);
    expect(console.error).toHaveBeenCalledWith(
      "[family] uncaught error",
      "ChunkLoadError",
      expect.stringContaining("Failed to load chunk"),
      "",
    );
  });
});
