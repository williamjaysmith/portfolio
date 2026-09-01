import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ActorSession } from "@/lib/family/types";

import { fail, ok } from "./action-result";
import { makeActor } from "./family-test-utils";

const punchIn = vi.fn();
const punchOut = vi.fn();
const getActor = vi.fn();
const extendActor = vi.fn();

vi.mock("@/lib/family/actions/punch-in", () => ({
  punchIn: (...args: unknown[]) => punchIn(...args),
  punchOut: () => punchOut(),
  getActor: () => getActor(),
  extendActor: () => extendActor(),
}));

const { useActorSession } = await import("../useActorSession");

/**
 * FR-013 and D12: the actor lives as long as somebody is touching the tablet,
 * the interface never claims a session the cookie has already lost, and the
 * heartbeat stays cheap enough to run on every tap.
 */

/** Less than half the window left — the heartbeat's "worth asking" case. */
function staleActor(): ActorSession {
  return makeActor("parent", {
    ttlSeconds: 180,
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  });
}

/** Most of the window left — the heartbeat should leave the server alone. */
function freshActor(): ActorSession {
  return makeActor("parent", {
    ttlSeconds: 180,
    expiresAt: new Date(Date.now() + 170_000).toISOString(),
  });
}

function tapTheTablet(): void {
  document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
}

describe("useActorSession", () => {
  beforeEach(() => {
    punchOut.mockReset();
    punchOut.mockResolvedValue(ok(null));
    getActor.mockReset();
    getActor.mockResolvedValue(ok(null));
    extendActor.mockReset();
    extendActor.mockResolvedValue(fail("UNAVAILABLE"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts from the session the server handed the shell", () => {
    const actor = freshActor();
    const { result } = renderHook(() => useActorSession(actor));

    expect(result.current.actor).toBe(actor);
    expect(extendActor).not.toHaveBeenCalled();
  });

  it("forgets the actor just before the cookie does, and clears the cookie too", () => {
    vi.useFakeTimers();
    const actor = makeActor("parent", { ttlSeconds: 180 });
    const { result } = renderHook(() => useActorSession(actor));

    // 2s of lead time: the interface must never outlive the server's truth.
    act(() => {
      vi.advanceTimersByTime(177_999);
    });
    expect(result.current.actor).toBe(actor);
    expect(punchOut).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.actor).toBeNull();
    expect(punchOut).toHaveBeenCalledTimes(1);
  });

  it("extends on demand after a real change and adopts the new window", async () => {
    const extended = makeActor("parent", {
      ttlSeconds: 180,
      expiresAt: new Date(Date.now() + 180_000).toISOString(),
    });
    extendActor.mockResolvedValue(ok(extended));
    const { result } = renderHook(() => useActorSession(freshActor()));

    await act(async () => {
      await result.current.extend(true);
    });

    expect(extendActor).toHaveBeenCalledTimes(1);
    expect(result.current.actor).toBe(extended);
  });

  it("leaves the server alone while more than half the window remains", async () => {
    const actor = freshActor();
    const { result } = renderHook(() => useActorSession(actor));

    await act(async () => {
      await result.current.extend(false);
    });

    expect(extendActor).not.toHaveBeenCalled();
    expect(result.current.actor).toBe(actor);
  });

  it("asks once, then throttles the rest of the tapping", async () => {
    extendActor.mockResolvedValue(ok(staleActor()));
    const { result } = renderHook(() => useActorSession(staleActor()));

    await act(async () => {
      await result.current.extend(false);
    });
    expect(extendActor).toHaveBeenCalledTimes(1);

    // The refreshed session is still in its second half, so only the 30s gap
    // can be what stops this one.
    await act(async () => {
      await result.current.extend(false);
    });
    expect(extendActor).toHaveBeenCalledTimes(1);
  });

  it("does not extend for a change made with nobody punched in (bootstrap)", async () => {
    const { result } = renderHook(() => useActorSession(null));

    await act(async () => {
      await result.current.extend(true);
    });

    expect(extendActor).not.toHaveBeenCalled();
  });

  it("drops the actor when the server refuses to extend", async () => {
    extendActor.mockResolvedValue(fail("NO_ACTOR"));
    const { result } = renderHook(() => useActorSession(staleActor()));

    await act(async () => {
      await result.current.extend(true);
    });

    expect(result.current.actor).toBeNull();
  });

  it("punches out at once", async () => {
    const { result } = renderHook(() => useActorSession(freshActor()));

    await act(async () => {
      await result.current.punchOut();
    });

    expect(result.current.actor).toBeNull();
    expect(punchOut).toHaveBeenCalledTimes(1);
  });

  it("treats a tap anywhere on the tablet as a heartbeat", async () => {
    extendActor.mockResolvedValue(ok(staleActor()));
    renderHook(() => useActorSession(staleActor()));

    await act(async () => {
      tapTheTablet();
    });

    expect(extendActor).toHaveBeenCalledTimes(1);
  });

  it("ignores taps when nobody is punched in", async () => {
    const { result } = renderHook(() => useActorSession(null));

    await act(async () => {
      tapTheTablet();
    });

    expect(extendActor).not.toHaveBeenCalled();
    expect(result.current.actor).toBeNull();
  });

  it("re-asks the server when the tablet comes back to the foreground", async () => {
    const restored = staleActor();
    getActor.mockResolvedValue(ok(restored));
    const { result } = renderHook(() => useActorSession(null));

    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(getActor).toHaveBeenCalledTimes(1);
    expect(result.current.actor).toBe(restored);
  });

  it("keeps the actor when the foreground resync cannot reach the house", async () => {
    const actor = staleActor();
    getActor.mockResolvedValue(fail("UNAVAILABLE"));
    const { result } = renderHook(() => useActorSession(actor));

    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(getActor).toHaveBeenCalledTimes(1);
    expect(result.current.actor).toBe(actor);
  });

  it("does not ask while the tablet is still hidden", async () => {
    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    renderHook(() => useActorSession(null));

    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(getActor).not.toHaveBeenCalled();
    visibility.mockRestore();
  });

  it("stops listening on unmount — a wall tablet runs for weeks", () => {
    extendActor.mockResolvedValue(ok(staleActor()));
    const removeListener = vi.spyOn(document, "removeEventListener");
    const { unmount } = renderHook(() => useActorSession(staleActor()));

    unmount();

    const removed = removeListener.mock.calls.map(([type]) => type);
    expect(removed).toContain("pointerdown");
    expect(removed).toContain("keydown");
    expect(removed).toContain("visibilitychange");
    removeListener.mockRestore();

    tapTheTablet();
    document.dispatchEvent(new Event("visibilitychange"));
    expect(extendActor).not.toHaveBeenCalled();
    expect(getActor).not.toHaveBeenCalled();
  });
});
