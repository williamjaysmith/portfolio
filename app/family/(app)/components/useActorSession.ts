"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { extendActor, getActor, punchOut as punchOutAction } from "@/lib/family/actions/punch-in";
import type { ActorSession } from "@/lib/family/types";

/**
 * The punch-in lifetime on this device (FR-013, D12).
 *
 * "Idle" means nobody has touched the tablet — not that nobody has saved
 * anything — so the heartbeat listens to interaction. The server owns the real
 * expiry (the cookie's); this timer runs slightly ahead of it so the interface
 * never claims someone is punched in after the cookie has lapsed.
 */

/** Fire the local timer this far before the cookie actually expires. */
const CLIENT_LEAD_MS = 2000;
/** At most one extension request per this interval, however busy the tablet is. */
const HEARTBEAT_MIN_GAP_MS = 30_000;

export interface ActorSessionState {
  actor: ActorSession | null;
  setActor: (actor: ActorSession | null) => void;
  /** Push the expiry forward; `force` skips the throttle after a real change. */
  extend: (force: boolean) => Promise<void>;
  punchOut: () => Promise<void>;
}

export function useActorSession(initialActor: ActorSession | null): ActorSessionState {
  const [actor, setActor] = useState<ActorSession | null>(initialActor);
  const lastExtendRef = useRef(0);

  const clearLocally = useCallback(() => {
    setActor(null);
    void punchOutAction();
  }, []);

  useEffect(() => {
    if (!actor) return;
    const delay = Math.max(0, actor.ttlSeconds * 1000 - CLIENT_LEAD_MS);
    const timer = setTimeout(clearLocally, delay);
    return () => clearTimeout(timer);
  }, [actor, clearLocally]);

  const extend = useCallback(
    async (force: boolean) => {
      if (!actor) return;
      const now = Date.now();
      if (!force) {
        if (now - lastExtendRef.current < HEARTBEAT_MIN_GAP_MS) return;
        // Only bother the server in the second half of the window.
        const remaining = new Date(actor.expiresAt).getTime() - now;
        if (remaining > actor.ttlSeconds * 500) return;
      }
      lastExtendRef.current = now;
      const result = await extendActor();
      setActor(result.ok ? result.data : null);
    },
    [actor],
  );

  useEffect(() => {
    if (!actor) return;
    const onInteraction = () => void extend(false);
    const options = { capture: true, passive: true } as const;
    document.addEventListener("pointerdown", onInteraction, options);
    document.addEventListener("keydown", onInteraction, options);
    return () => {
      document.removeEventListener("pointerdown", onInteraction, { capture: true });
      document.removeEventListener("keydown", onInteraction, { capture: true });
    };
  }, [actor, extend]);

  // A backgrounded tab's timers are unreliable, so re-ask the server on return.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState !== "visible") return;
      void getActor().then((result) => {
        if (result.ok) setActor(result.data);
      });
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  const punchOut = useCallback(async () => {
    setActor(null);
    await punchOutAction();
  }, []);

  return { actor, setActor, extend, punchOut };
}
