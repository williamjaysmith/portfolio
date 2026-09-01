"use client";

import { useCallback, useRef, useState } from "react";

import { fail, type ActionResult } from "@/lib/family/errors";
import type { ActorSession } from "@/lib/family/types";

import { callAction, useSessionRecovery } from "./action-client";

/**
 * The bridge between a control that wants to change something and the
 * punch-in sheet (US2, contracts → error-handling).
 *
 * `openPunchIn()` returns a promise the sheet resolves, so a caller can simply
 * await "who is here?" and carry on with the action they were already trying
 * to perform.
 */

export interface PunchInPrompt {
  sheetOpen: boolean;
  openPunchIn: () => Promise<ActorSession | null>;
  resolveSheet: (actor: ActorSession | null) => void;
  withActor: <T>(run: () => Promise<ActionResult<T>>) => Promise<ActionResult<T>>;
}

export interface PunchInPromptOptions {
  actor: ActorSession | null;
  setActor: (actor: ActorSession | null) => void;
  onSuccess: () => void;
}

export function usePunchInPrompt({ actor, setActor, onSuccess }: PunchInPromptOptions): PunchInPrompt {
  const [sheetOpen, setSheetOpen] = useState(false);
  const resolverRef = useRef<((actor: ActorSession | null) => void) | null>(null);
  const signedOut = useSessionRecovery();

  const openPunchIn = useCallback(
    () =>
      new Promise<ActorSession | null>((resolve) => {
        resolverRef.current = resolve;
        setSheetOpen(true);
      }),
    [],
  );

  const resolveSheet = useCallback(
    (session: ActorSession | null) => {
      setSheetOpen(false);
      if (session) setActor(session);
      const resolver = resolverRef.current;
      resolverRef.current = null;
      resolver?.(session);
    },
    [setActor],
  );

  const withActor = useCallback(
    async <T,>(run: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> => {
      if (!actor && !(await openPunchIn())) return fail("NO_ACTOR");

      let result = await callAction(run);
      // The cookie can lapse between render and submit: ask once more, then retry.
      if (!result.ok && result.error === "NO_ACTOR") {
        setActor(null);
        if (!(await openPunchIn())) return result;
        result = await callAction(run);
      }
      // A PIN cannot fix a signed-out session, so that one failure is not the
      // caller's to report: the shell empties the cache and leaves for sign-in.
      if (result.ok) onSuccess();
      else signedOut(result);
      return result;
    },
    [actor, openPunchIn, setActor, onSuccess, signedOut],
  );

  return { sheetOpen, openPunchIn, resolveSheet, withActor };
}
