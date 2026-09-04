import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  SlicePager,
  beginsOnBlock,
  swipeAxisOf,
  swipeStepOf,
  travelOf,
  type SwipeAxis,
} from "../SlicePager";

/**
 * T060 — the FR-279 slice swipe.
 *
 * Two tiers, per R213. The decisions are pure functions and are tested as
 * such: the FR-280 axis lock, the release step's direction and threshold, and
 * the FR-252 travel collapse. Above them, one RTL pass drives real pointer
 * events through framer-motion's pan on the mounted pager, which is what
 * proves the three rules that only exist once a gesture is real — the lock
 * holds for the whole gesture, a swipe pages EXACTLY once however far it
 * travels, and a press that begins on a block pages not at all (Assumption
 * 44: the drag layer owns those).
 *
 * jsdom needs `isPrimary` on every pointer event — framer's pan session drops
 * non-primary pointers, and jsdom's `PointerEvent` defaults it to false.
 */

const POINTER = { pointerId: 1, isPrimary: true, button: 0, buttons: 1, pointerType: "touch" };

interface Point {
  x: number;
  y: number;
}

/**
 * framer's pan session reports each move on its own animation frame, and one
 * frame reports only the LAST move it saw — so the gesture's steps have to be
 * separated by real frames or the lock would be judged on a coalesced jump.
 * Two nested frames: the inner one cannot run before framer's own step for
 * the frame the move landed in.
 */
async function settle(): Promise<void> {
  await act(async () => {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
  });
}

/** One whole gesture: press on `node`, move through `path`, release. */
async function swipe(node: Element, from: Point, path: readonly Point[]): Promise<void> {
  await act(async () => {
    fireEvent.pointerDown(node, { ...POINTER, clientX: from.x, clientY: from.y });
  });
  let last = from;
  for (const point of path) {
    await act(async () => {
      fireEvent.pointerMove(window, { ...POINTER, clientX: point.x, clientY: point.y });
    });
    await settle();
    last = point;
  }
  await act(async () => {
    fireEvent.pointerUp(window, { ...POINTER, buttons: 0, clientX: last.x, clientY: last.y });
  });
  await settle();
}

function renderPager() {
  const onPage = vi.fn();
  render(
    <SlicePager onPage={onPage}>
      <div data-testid="band">Mon Tue Wed</div>
      <button type="button">Piano</button>
    </SlicePager>,
  );
  return { onPage, band: screen.getByTestId("band"), block: screen.getByRole("button") };
}

const UNLOCKED: SwipeAxis = "unlocked";

describe("swipeAxisOf", () => {
  it("stays unlocked until the displacement is worth claiming (FR-280)", () => {
    expect(swipeAxisOf(UNLOCKED, { x: 9, y: 0 })).toBe("unlocked");
    expect(swipeAxisOf(UNLOCKED, { x: 0, y: -9 })).toBe("unlocked");
  });

  it("claims the gesture horizontally only when the horizontal dominates", () => {
    expect(swipeAxisOf(UNLOCKED, { x: -14, y: 4 })).toBe("horizontal");
    expect(swipeAxisOf(UNLOCKED, { x: 4, y: 14 })).toBe("vertical");
  });

  it("leaves an equal diagonal to the hour scroll (FR-280)", () => {
    expect(swipeAxisOf(UNLOCKED, { x: -20, y: 20 })).toBe("vertical");
  });

  it("never re-locks once the gesture has an axis", () => {
    expect(swipeAxisOf("vertical", { x: -200, y: 12 })).toBe("vertical");
    expect(swipeAxisOf("horizontal", { x: 4, y: 200 })).toBe("horizontal");
  });
});

describe("swipeStepOf", () => {
  it("pages later for a swipe left and earlier for a swipe right (FR-279)", () => {
    expect(swipeStepOf("horizontal", -60)).toBe(1);
    expect(swipeStepOf("horizontal", 60)).toBe(-1);
  });

  it("does not page a release that never travelled far enough", () => {
    expect(swipeStepOf("horizontal", -40)).toBeNull();
    expect(swipeStepOf("horizontal", 40)).toBeNull();
  });

  it("does not page a gesture the hour scroll owns", () => {
    expect(swipeStepOf("vertical", -400)).toBeNull();
    expect(swipeStepOf(UNLOCKED, -400)).toBeNull();
  });
});

describe("travelOf", () => {
  it("follows the finger, capped so the strip cannot run off the page", () => {
    expect(travelOf(-30, false)).toBe(-30);
    expect(travelOf(-4000, false)).toBe(-72);
    expect(travelOf(4000, null)).toBe(72);
  });

  it("collapses to an instant jump under reduced motion (FR-252)", () => {
    expect(travelOf(-30, true)).toBe(0);
    expect(travelOf(4000, true)).toBe(0);
  });
});

describe("beginsOnBlock", () => {
  it("is true for a press anywhere inside a block's control (Assumption 44)", () => {
    const block = document.createElement("button");
    const label = document.createElement("span");
    block.append(label);
    expect(beginsOnBlock(block)).toBe(true);
    expect(beginsOnBlock(label)).toBe(true);
  });

  it("is false for the empty grid, the ruler and the header band", () => {
    expect(beginsOnBlock(document.createElement("div"))).toBe(false);
    expect(beginsOnBlock(null)).toBe(false);
  });
});

describe("SlicePager", () => {
  it("pages one slice later on a swipe left (FR-279)", async () => {
    const { onPage, band } = renderPager();
    await swipe(band, { x: 300, y: 200 }, [
      { x: 280, y: 202 },
      { x: 220, y: 204 },
      { x: 160, y: 204 },
    ]);
    expect(onPage.mock.calls).toEqual([[1]]);
  });

  it("pages one slice earlier on a swipe right (FR-279)", async () => {
    const { onPage, band } = renderPager();
    await swipe(band, { x: 160, y: 200 }, [
      { x: 190, y: 200 },
      { x: 260, y: 198 },
    ]);
    expect(onPage.mock.calls).toEqual([[-1]]);
  });

  it("advances exactly one slice however far the swipe travels (FR-279)", async () => {
    const { onPage, band } = renderPager();
    await swipe(band, { x: 900, y: 300 }, [
      { x: 800, y: 300 },
      { x: 600, y: 302 },
      { x: 400, y: 304 },
      { x: 200, y: 306 },
      { x: 20, y: 308 },
    ]);
    expect(onPage.mock.calls).toEqual([[1]]);
  });

  it("leaves a vertical gesture to the hour scroll (FR-280)", async () => {
    const { onPage, band } = renderPager();
    await swipe(band, { x: 300, y: 400 }, [
      { x: 302, y: 380 },
      { x: 304, y: 300 },
    ]);
    expect(onPage).not.toHaveBeenCalled();
  });

  it("keeps the axis it locked, so a vertical scroll never pages late (FR-280)", async () => {
    const { onPage, band } = renderPager();
    await swipe(band, { x: 300, y: 400 }, [
      { x: 302, y: 386 },
      { x: 100, y: 384 },
      { x: 40, y: 384 },
    ]);
    expect(onPage).not.toHaveBeenCalled();
  });

  it("does not page a swipe that gives up before the threshold", async () => {
    const { onPage, band } = renderPager();
    await swipe(band, { x: 300, y: 200 }, [
      { x: 285, y: 200 },
      { x: 270, y: 200 },
    ]);
    expect(onPage).not.toHaveBeenCalled();
  });

  it("ignores a gesture that begins on a block — that movement is a drag (Assumption 44)", async () => {
    const { onPage, block } = renderPager();
    await swipe(block, { x: 300, y: 200 }, [
      { x: 200, y: 202 },
      { x: 100, y: 204 },
    ]);
    expect(onPage).not.toHaveBeenCalled();
  });

  it("renders its children as the grid strip", () => {
    const { band } = renderPager();
    expect(band).toHaveTextContent("Mon Tue Wed");
  });
});
