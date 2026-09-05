import { act, renderHook } from "@testing-library/react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useSectionToggles } from "@/app/family/(app)/tasks/components/useSectionToggles";
import type { UseSectionTogglesOptions } from "@/app/family/(app)/tasks/components/useSectionToggles";

/**
 * FR-306 / FR-307 / Assumption 10 / R322: the four section switches per column.
 *
 * The automatic selection is a DERIVATION of the same shared clock the day
 * anchor rides — midnight–noon Morning, noon–18:00 Afternoon, 18:00–midnight
 * Evening, each boundary belonging to the later window — read in the
 * household's zone. Chores is not a time of day: it starts on and composes
 * with any of them, and the four are independent switches, so any combination
 * including none is legal.
 *
 * A manual change is a per-column override that dies at the next automatic
 * boundary with NO timer: the overrides are stored against the window they
 * were made under, so when the derived window changes they simply stop being
 * read. They are deliberately not persisted — they expire at a boundary they
 * were about to lose anyway.
 *
 * The clock: America/Chicago is CDT (UTC-5) on these dates, so 16:59Z is 11:59
 * and 17:00Z is noon. Tokyo reads the same instants six hours into the next
 * window, which is what keeps the household zone honest.
 */

const LATE_MORNING = new Date("2026-09-05T16:59:00Z"); // 11:59 Chicago
const NOON = new Date("2026-09-05T17:00:20Z"); // 12:00 Chicago
const LATE_AFTERNOON = new Date("2026-09-05T22:59:00Z"); // 17:59 Chicago
const SIX = new Date("2026-09-05T23:00:20Z"); // 18:00 Chicago
const MIDNIGHT = new Date("2026-09-06T05:00:20Z"); // 00:00 Chicago

const CHICAGO: UseSectionTogglesOptions = {
  zone: "America/Chicago",
  initialWindow: "morning",
};

const CLEO = "profile-cleo";
const BEN = "profile-ben";

/** Move the mocked clock and let the shared store publish the new minute. */
async function moveClockTo(instant: Date): Promise<void> {
  vi.setSystemTime(instant);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1100);
  });
}

describe("useSectionToggles", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(LATE_MORNING);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("selects the clock's time-of-day section and starts Chores on", () => {
    const { result } = renderHook(() => useSectionToggles(CHICAGO));

    expect(result.current.activeWindow).toBe("morning");
    expect(result.current.sectionsFor(CLEO)).toEqual({
      morning: true,
      afternoon: false,
      evening: false,
      chores: true,
    });
  });

  it("gives each automatic boundary to the later window", async () => {
    const { result } = renderHook(() => useSectionToggles(CHICAGO));
    expect(result.current.activeWindow).toBe("morning"); // 11:59

    await moveClockTo(NOON);
    expect(result.current.activeWindow).toBe("afternoon");
    expect(result.current.sectionsFor(CLEO).morning).toBe(false);
    expect(result.current.sectionsFor(CLEO).afternoon).toBe(true);

    await moveClockTo(LATE_AFTERNOON);
    expect(result.current.activeWindow).toBe("afternoon"); // 17:59

    await moveClockTo(SIX);
    expect(result.current.activeWindow).toBe("evening");

    await moveClockTo(MIDNIGHT);
    expect(result.current.activeWindow).toBe("morning");
    expect(result.current.sectionsFor(CLEO).evening).toBe(false);
  });

  it("reads the household zone, not the device's", () => {
    // 11:59 in Chicago is 01:59 the next day in Tokyo — still Morning there,
    // so the window must be read from the household zone to differ. At 18:00
    // Chicago (23:00Z) Tokyo is 08:00 the next morning: Evening vs Morning.
    vi.setSystemTime(SIX);
    const chicago = renderHook(() => useSectionToggles(CHICAGO));
    const tokyo = renderHook(() =>
      useSectionToggles({ zone: "Asia/Tokyo", initialWindow: "morning" }),
    );

    expect(chicago.result.current.activeWindow).toBe("evening");
    expect(tokyo.result.current.activeWindow).toBe("morning");
  });

  it("treats the four as independent switches — any combination, including none", () => {
    const { result } = renderHook(() => useSectionToggles(CHICAGO));

    act(() => result.current.toggleSection(CLEO, "evening"));
    // Turning Evening on does not turn Morning off: this is not one choice.
    expect(result.current.sectionsFor(CLEO)).toEqual({
      morning: true,
      afternoon: false,
      evening: true,
      chores: true,
    });

    act(() => result.current.toggleSection(CLEO, "morning"));
    act(() => result.current.toggleSection(CLEO, "evening"));
    act(() => result.current.toggleSection(CLEO, "chores"));
    // All four off is legal (FR-307).
    expect(result.current.sectionsFor(CLEO)).toEqual({
      morning: false,
      afternoon: false,
      evening: false,
      chores: false,
    });

    act(() => result.current.toggleSection(CLEO, "afternoon"));
    act(() => result.current.toggleSection(CLEO, "chores"));
    // Chores composes with a time of day rather than competing with it.
    expect(result.current.sectionsFor(CLEO)).toEqual({
      morning: false,
      afternoon: true,
      evening: false,
      chores: true,
    });
  });

  it("keeps every column's switches to itself", () => {
    // One board-wide toggle set would make a parent unable to expand one
    // child's evening without expanding everyone's (R322).
    const { result } = renderHook(() => useSectionToggles(CHICAGO));

    act(() => result.current.toggleSection(CLEO, "evening"));

    expect(result.current.sectionsFor(CLEO).evening).toBe(true);
    expect(result.current.sectionsFor(BEN).evening).toBe(false);
    expect(result.current.sectionsFor(BEN).morning).toBe(true);
  });

  it("holds an override across clock ticks inside the same window", async () => {
    const { result } = renderHook(() => useSectionToggles(CHICAGO));

    act(() => result.current.toggleSection(CLEO, "morning")); // collapse Morning
    await moveClockTo(new Date("2026-09-05T16:59:40Z")); // still 11:59
    expect(result.current.sectionsFor(CLEO).morning).toBe(false);
  });

  it("lets the automatic selection re-assert at the next boundary", async () => {
    // Assumption 10: a wall tablet someone poked at breakfast is showing the
    // afternoon's tasks by the afternoon — with no timer having fired.
    const { result } = renderHook(() => useSectionToggles(CHICAGO));

    act(() => result.current.toggleSection(CLEO, "morning")); // off
    act(() => result.current.toggleSection(CLEO, "evening")); // on
    act(() => result.current.toggleSection(CLEO, "chores")); // off
    act(() => result.current.toggleSection(BEN, "evening")); // on
    expect(result.current.sectionsFor(CLEO)).toEqual({
      morning: false,
      afternoon: false,
      evening: true,
      chores: false,
    });

    await moveClockTo(NOON);

    // Every column's overrides died together, including the Chores one.
    expect(result.current.sectionsFor(CLEO)).toEqual({
      morning: false,
      afternoon: true,
      evening: false,
      chores: true,
    });
    expect(result.current.sectionsFor(BEN)).toEqual({
      morning: false,
      afternoon: true,
      evening: false,
      chores: true,
    });
  });

  it("starts an override made after a boundary from the new automatic base", async () => {
    const { result } = renderHook(() => useSectionToggles(CHICAGO));

    act(() => result.current.toggleSection(CLEO, "evening")); // on, under Morning
    await moveClockTo(NOON);
    act(() => result.current.toggleSection(CLEO, "morning")); // on, under Afternoon

    expect(result.current.sectionsFor(CLEO)).toEqual({
      morning: true,
      afternoon: true,
      evening: false,
      chores: true,
    });
  });

  it("persists nothing — the override map is component state that expires", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const { result, unmount } = renderHook(() => useSectionToggles(CHICAGO));

    act(() => result.current.toggleSection(CLEO, "morning"));
    expect(setItem).not.toHaveBeenCalled();
    unmount();

    const remounted = renderHook(() => useSectionToggles(CHICAGO));
    expect(remounted.result.current.sectionsFor(CLEO).morning).toBe(true);
  });

  it("serves the server-computed window until the client clock publishes", () => {
    // `useNow` is null on the server and through hydration; without the
    // server's own reading the wall tablet would paint Morning at 8pm and
    // then flip.
    function Probe() {
      const { activeWindow, sectionsFor } = useSectionToggles({
        zone: "America/Chicago",
        initialWindow: "evening",
      });
      const sections = sectionsFor(CLEO);
      return createElement("output", null, `${activeWindow}|${sections.evening}|${sections.chores}`);
    }

    expect(renderToStaticMarkup(createElement(Probe))).toContain("evening|true|true");
  });

  it("adds no timer of its own — the boundary is a derived value, not an event", () => {
    const { result } = renderHook(() => useSectionToggles(CHICAGO));

    act(() => result.current.toggleSection(CLEO, "evening"));

    expect(vi.getTimerCount()).toBe(1);
  });
});
