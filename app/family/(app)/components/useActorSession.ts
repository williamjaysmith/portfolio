"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { extendActor, getActor, punchOut as punchOutAction } from "@/lib/family/actions/punch-in";
import type { ActorSession } from "@/lib/family/types";

import { callAction, useSessionRecovery } from "./action-client";

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

/** The widest TTL one actor has been given — their punch-out window. */
interface PunchOutWindow {
  profileId: string | null;
  seconds: number;
}

function windowFor(seen: PunchOutWindow, session: ActorSession | null): PunchOutWindow {
  if (!session) return { profileId: null, seconds: 0 };
  // A different person is a different window; the same person's window can
  // only have grown (the household's punch-out setting changing upwards).
  const seconds =
    seen.profileId === session.profileId
      ? Math.max(seen.seconds, session.ttlSeconds)
      : session.ttlSeconds;
  return { profileId: session.profileId, seconds };
}

/**
 * Is it worth spending a request on this tap? Only in the second half of the
 * window, and never more than once per `HEARTBEAT_MIN_GAP_MS` (D12).
 *
 * The comparison is against the whole window, not the last `ttlSeconds` seen:
 * after a `getActor()` resync that number is the time *remaining*, so measuring
 * against half of it would refuse to extend precisely when the session is
 * nearly gone and somebody is still tapping.
 */
function worthExtending(
  actor: ActorSession,
  windowSeconds: number,
  now: number,
  lastExtend: number,
): boolean {
  if (now - lastExtend < HEARTBEAT_MIN_GAP_MS) return false;
  const remaining = new Date(actor.expiresAt).getTime() - now;
  return remaining <= Math.max(windowSeconds, actor.ttlSeconds) * 500;
}

export interface ActorSessionState {
  actor: ActorSession | null;
  setActor: (actor: ActorSession | null) => void;
  /** Push the expiry forward; `force` skips the throttle after a real change. */
  extend: (force: boolean) => Promise<void>;
  punchOut: () => Promise<void>;
}

export function useActorSession(initialActor: ActorSession | null): ActorSessionState {
  const [actor, setActorState] = useState<ActorSession | null>(initialActor);
  const lastExtendRef = useRef(0);
  const windowRef = useRef<PunchOutWindow>(windowFor({ profileId: null, seconds: 0 }, initialActor));
  const signedOut = useSessionRecovery();

  const setActor = useCallback((session: ActorSession | null) => {
    windowRef.current = windowFor(windowRef.current, session);
    setActorState(session);
  }, []);

  const clearLocally = useCallback(() => {
    setActor(null);
    void callAction(() => punchOutAction());
  }, [setActor]);

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
      if (!force && !worthExtending(actor, windowRef.current.seconds, now, lastExtendRef.current)) {
        return;
      }
      lastExtendRef.current = now;

      const result = await callAction(() => extendActor());
      if (result.ok) {
        setActor(result.data);
        return;
      }
      // Only the server saying "nobody is punched in" ends the session. A
      // moment of UNAVAILABLE must not punch somebody out mid-task; the next
      // real mutation will meet the same NO_ACTOR and re-prompt properly.
      if (result.error === "NO_ACTOR") setActor(null);
      else signedOut(result);
    },
    [actor, setActor, signedOut],
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
      void callAction(() => getActor()).then((result) => {
        if (result.ok) setActor(result.data);
        else signedOut(result);
      });
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [setActor, signedOut]);

  const punchOut = useCallback(async () => {
    setActor(null);
    await callAction(() => punchOutAction());
  }, [setActor]);

  return { actor, setActor, extend, punchOut };
}
