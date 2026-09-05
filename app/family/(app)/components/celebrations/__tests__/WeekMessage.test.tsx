import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { WeekCelebration } from "../../../tasks/components/useWeekCelebrations";
import { WeekMessage } from "../WeekMessage";

/**
 * T050 — FR-440's Amazing / Strong Week message on the board (R408): the copy
 * names the Profile and the routine, the message is a polite live region, a
 * tap dismisses it and so does its own clock a few seconds on, and its motion
 * collapses to nothing under a reduced-motion preference while the message
 * itself — content, not decoration — still shows (FR-445).
 *
 * `useWeekCelebrations` decides WHAT shows and WHEN; this file guards only
 * how one message looks, sounds and ends.
 */

// The shipped reduced-motion hook is framer-motion's; the test steers it and
// leaves the rest of the library real (the StarConfetti pattern).
const motionPreference = vi.hoisted(() => ({ reduced: false as boolean | null }));

vi.mock("framer-motion", async (importOriginal) => {
  const actual = await importOriginal<typeof import("framer-motion")>();
  return { ...actual, useReducedMotion: () => motionPreference.reduced };
});

/** The message's own clock: "after a few seconds" (T050), pinned here so it cannot drift. */
const DISMISS_MS = 6000;

const AMAZING: WeekCelebration = {
  key: "brush-teeth:ana:2026-08-30",
  verdict: "amazing",
  profileName: "Ana",
  routineName: "Brush teeth",
  weekStart: "2026-08-30",
};

const STRONG: WeekCelebration = {
  key: "read-a-book:ben:2026-08-30",
  verdict: "strong",
  profileName: "Ben",
  routineName: "Read a book",
  weekStart: "2026-08-30",
};

function bodyIn(container: HTMLElement): HTMLElement | null {
  return container.querySelector<HTMLElement>("[data-week-message-body]");
}

describe("WeekMessage", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    motionPreference.reduced = false;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("says Amazing week for a routine completed every scheduled day", () => {
    render(<WeekMessage message={AMAZING} onDismiss={vi.fn()} />);

    expect(screen.getByText("Amazing week, Ana! Brush teeth every day.")).toBeInTheDocument();
  });

  it("says Strong week for a routine missed exactly once", () => {
    render(<WeekMessage message={STRONG} onDismiss={vi.fn()} />);

    expect(
      screen.getByText("Strong week, Ben! Read a book almost every day."),
    ).toBeInTheDocument();
  });

  it("is a polite live region carrying the verdict", () => {
    render(<WeekMessage message={AMAZING} onDismiss={vi.fn()} />);

    const region = screen.getByRole("status");
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region).toHaveAttribute("data-verdict", "amazing");
    expect(region).toHaveTextContent("Amazing week, Ana! Brush teeth every day.");
  });

  it("is dismissed by a tap on the message, which is a real button at the touch target (FR-445)", () => {
    const onDismiss = vi.fn();
    render(<WeekMessage message={AMAZING} onDismiss={onDismiss} />);

    const button = screen.getByRole("button", { name: /Amazing week, Ana!/ });
    expect(button.tagName).toBe("BUTTON");
    expect(button.className).toContain("min-h-(--fam-touch)");

    fireEvent.click(button);

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("dismisses itself after a few seconds, and not a moment before", () => {
    const onDismiss = vi.fn();
    render(<WeekMessage message={AMAZING} onDismiss={onDismiss} />);

    act(() => {
      vi.advanceTimersByTime(DISMISS_MS - 1);
    });
    expect(onDismiss).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("stops its clock when unmounted early — a tap already dismissed it", () => {
    const onDismiss = vi.fn();
    const { unmount } = render(<WeekMessage message={AMAZING} onDismiss={onDismiss} />);

    unmount();
    act(() => {
      vi.advanceTimersByTime(DISMISS_MS);
    });

    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("restarts its clock for the next message in the queue", () => {
    const onDismiss = vi.fn();
    const { rerender } = render(<WeekMessage message={AMAZING} onDismiss={onDismiss} />);

    act(() => {
      vi.advanceTimersByTime(4000);
    });
    rerender(<WeekMessage message={STRONG} onDismiss={onDismiss} />);
    act(() => {
      vi.advanceTimersByTime(DISMISS_MS - 4000);
    });
    expect(onDismiss).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("keeps its clock when the parent re-renders with a new onDismiss, and calls the latest", () => {
    const stale = vi.fn();
    const fresh = vi.fn();
    const { rerender } = render(<WeekMessage message={AMAZING} onDismiss={stale} />);

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    rerender(<WeekMessage message={AMAZING} onDismiss={fresh} />);
    act(() => {
      vi.advanceTimersByTime(DISMISS_MS - 3000);
    });

    expect(fresh).toHaveBeenCalledTimes(1);
    expect(stale).not.toHaveBeenCalled();
  });

  it("enters with motion when motion is allowed", () => {
    const { container } = render(<WeekMessage message={AMAZING} onDismiss={vi.fn()} />);

    // framer paints `initial` inline on the first render: the body starts unseen.
    expect(bodyIn(container)?.style.opacity).toBe("0");
  });

  it("collapses its motion under a reduced-motion preference but still shows the message (FR-445)", () => {
    motionPreference.reduced = true;
    const onDismiss = vi.fn();
    const { container } = render(<WeekMessage message={AMAZING} onDismiss={onDismiss} />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Amazing week, Ana! Brush teeth every day.",
    );
    expect(bodyIn(container)?.style.opacity).not.toBe("0");

    // The clock is the message's, not the motion's: it still ends on its own.
    act(() => {
      vi.advanceTimersByTime(DISMISS_MS);
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("treats the not-yet-read preference (`null`) as motion allowed, like the shipped hook's users", () => {
    motionPreference.reduced = null;
    const { container } = render(<WeekMessage message={AMAZING} onDismiss={vi.fn()} />);

    expect(bodyIn(container)?.style.opacity).toBe("0");
  });
});
