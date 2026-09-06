import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { StarConfetti } from "../StarConfetti";

/**
 * T042 — FR-438's gold star shower (R408, R416; 07 §4.13, §7.1): a fixed,
 * full-viewport, decoration-only layer of filled `--fam-star-gold` stars that
 * fall once, end on their own, and are **nothing** under a reduced-motion
 * preference.
 *
 * The scatter is derived from each sprite's index, never from `Math.random`,
 * so the same call renders the same stars twice — which is what lets a test
 * read positions off the DOM at all. Durations are the stylesheet's
 * `--fam-sprite-*` numbers (reward-tokens.test.ts guards those); this file
 * guards that the component keeps the same clock.
 */

// The shipped reduced-motion hook is framer-motion's; the test steers it and
// leaves the rest of the library real, so the sprites render as they ship.
const motionPreference = vi.hoisted(() => ({ reduced: false as boolean | null }));

vi.mock("framer-motion", async (importOriginal) => {
  const actual = await importOriginal<typeof import("framer-motion")>();
  return { ...actual, useReducedMotion: () => motionPreference.reduced };
});

/** The stagger's ceiling plus the longest fall — when the last sprite has faded (07 §7.1). */
const TOTAL_MS = 1500 + 4000;

/** The sprite-size formula tokens.css prescribes, `--t` being the sprite's own point in [0, 1]. */
const SIZE_FORMULA =
  "calc(var(--fam-sprite-min) + (var(--fam-sprite-max) - var(--fam-sprite-min)) * var(--t))";

function spritesIn(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>("[data-sprite]"));
}

function layerIn(container: HTMLElement): HTMLElement | null {
  return container.querySelector<HTMLElement>("[data-star-confetti]");
}

describe("StarConfetti", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    motionPreference.reduced = false;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("scatters ~80 filled gold stars by default (07 §7.1's density)", () => {
    const { container } = render(<StarConfetti onDone={vi.fn()} />);

    const sprites = spritesIn(container);
    expect(sprites.length).toBeGreaterThanOrEqual(60);
    expect(sprites.length).toBeLessThanOrEqual(90);
    for (const sprite of sprites) {
      const star = sprite.querySelector("svg");
      expect(star?.getAttribute("fill")).toBe("currentColor");
      expect(sprite.className).toContain("text-(--fam-star-gold)");
    }
  });

  it("mounts exactly `count` sprites when told how many", () => {
    const { container } = render(<StarConfetti onDone={vi.fn()} count={12} />);

    expect(spritesIn(container)).toHaveLength(12);
  });

  it("is decoration: hidden from assistive tech, off the pointer, fixed over the whole viewport", () => {
    const { container } = render(<StarConfetti onDone={vi.fn()} count={12} />);

    const layer = layerIn(container);
    expect(layer).not.toBeNull();
    expect(layer?.getAttribute("aria-hidden")).toBe("true");
    expect(layer?.className).toContain("pointer-events-none");
    expect(layer?.className).toContain("fixed");
    expect(layer?.className).toContain("inset-0");
    expect(layer?.hasAttribute("inert")).toBe(true);
  });

  it("sizes every sprite between the token bounds and spreads them across the width", () => {
    const { container } = render(<StarConfetti onDone={vi.fn()} count={24} />);

    const lefts = new Set<string>();
    for (const sprite of spritesIn(container)) {
      expect(sprite.style.width).toBe(SIZE_FORMULA);
      const t = Number(sprite.style.getPropertyValue("--t"));
      expect(t).toBeGreaterThanOrEqual(0);
      expect(t).toBeLessThan(1);
      const left = Number.parseFloat(sprite.style.left);
      expect(sprite.style.left.endsWith("%")).toBe(true);
      expect(left).toBeGreaterThanOrEqual(0);
      expect(left).toBeLessThan(100);
      lefts.add(sprite.style.left);
    }
    // A scatter, not a column: the sprites do not share one x.
    expect(lefts.size).toBeGreaterThan(1);
  });

  it("is deterministic: the same scatter on every render, with no Math.random", () => {
    const random = vi.spyOn(Math, "random");
    const first = render(<StarConfetti onDone={vi.fn()} count={16} />);
    const before = spritesIn(first.container).map((sprite) => sprite.getAttribute("style"));
    first.unmount();

    const second = render(<StarConfetti onDone={vi.fn()} count={16} />);
    const after = spritesIn(second.container).map((sprite) => sprite.getAttribute("style"));

    expect(after).toEqual(before);
    expect(random).not.toHaveBeenCalled();
  });

  it("reports done once the last sprite has fallen, and not a moment before", () => {
    const onDone = vi.fn();
    render(<StarConfetti onDone={onDone} count={12} />);

    act(() => {
      vi.advanceTimersByTime(TOTAL_MS - 1);
    });
    expect(onDone).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("stops its clock when unmounted early", () => {
    const onDone = vi.fn();
    const { unmount } = render(<StarConfetti onDone={onDone} count={12} />);

    unmount();
    act(() => {
      vi.advanceTimersByTime(TOTAL_MS);
    });
    expect(onDone).not.toHaveBeenCalled();
  });

  it("keeps its clock when the parent re-renders with a new onDone, and calls the latest", () => {
    const stale = vi.fn();
    const fresh = vi.fn();
    const { rerender } = render(<StarConfetti onDone={stale} count={12} />);

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    rerender(<StarConfetti onDone={fresh} count={12} />);
    act(() => {
      vi.advanceTimersByTime(TOTAL_MS - 3000);
    });

    expect(fresh).toHaveBeenCalledTimes(1);
    expect(stale).not.toHaveBeenCalled();
  });

  it("renders nothing under a reduced-motion preference and is done at once (FR-438, FR-445)", () => {
    motionPreference.reduced = true;
    const onDone = vi.fn();
    const { container } = render(<StarConfetti onDone={onDone} count={12} />);

    expect(layerIn(container)).toBeNull();
    expect(spritesIn(container)).toHaveLength(0);
    expect(container).toBeEmptyDOMElement();

    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("treats the not-yet-read preference (`null`) as motion allowed, like the shipped hook's users", () => {
    motionPreference.reduced = null;
    const { container } = render(<StarConfetti onDone={vi.fn()} count={12} />);

    expect(spritesIn(container)).toHaveLength(12);
  });
});
