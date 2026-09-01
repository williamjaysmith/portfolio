"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCallback } from "react";

import { fail, type ActionResult } from "@/lib/family/errors";

/**
 * Calling a server action from the tablet.
 *
 * Two failures the shell must never let pass quietly: the transport dying —
 * a server action whose promise *rejects* rather than answering — and the
 * sign-in session going away underneath a household that is still on screen.
 */

/** Where a lost session sends the tablet (contracts → error handling). */
const SIGN_IN_PATH = "/family/sign-in";

/**
 * Wrap a server-action call so a dropped connection is an ordinary refusal.
 *
 * The spec's offline edge case asks for a clear "can't reach the house"; an
 * unhandled rejection instead leaves the control that made the call pending
 * for good, which is the one outcome nobody can recover from on a wall tablet.
 */
export async function callAction<T>(run: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await run();
  } catch {
    return fail("UNAVAILABLE");
  }
}

/**
 * `NOT_AUTHENTICATED` means the Supabase session expired while the app was
 * open. Everything on screen is stale from that moment, so the cache goes and
 * the tablet returns to sign-in rather than showing household data nobody is
 * signed in to see (spec edge case "a session expires while the app is open";
 * contracts → "Session expires mid-action").
 *
 * Returns whether it took the result over, so callers can stop.
 */
export function useSessionRecovery(): (result: ActionResult<unknown>) => boolean {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useCallback(
    (result: ActionResult<unknown>) => {
      if (result.ok || result.error !== "NOT_AUTHENTICATED") return false;
      queryClient.clear();
      router.replace(SIGN_IN_PATH);
      return true;
    },
    [queryClient, router],
  );
}
