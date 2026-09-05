"use client";

import { useCallback, useState, type Dispatch, type SetStateAction } from "react";

import type { ActionResult } from "@/lib/family/errors";

import type { SubmitOutcome } from "./formSubmit";

/**
 * The state a board's write surface moves through — which dialog is open, and
 * the one line a refused or vanished write leaves behind — shared by the Tasks
 * board's editor (003 T057) and the Rewards tab's (004 T032), so the two do
 * not carry a second copy of how a surface opens, closes and reports.
 *
 * What the surfaces ARE is each board's own discriminated union; this holds
 * one of them and knows nothing about its arms. `open` clears the notice
 * because a message belongs to the write that earned it, not to the next
 * dialog; `close` leaves the notice standing, because a refused write's line
 * is read after its dialog has gone.
 */
export interface WriteSurface<S> {
  surface: S;
  notice: string | null;
  /** Open a surface, clearing whatever the last write left behind. */
  open: (next: S) => void;
  /** Move within an open surface (a step inside one dialog) without touching the notice. */
  setSurface: Dispatch<SetStateAction<S>>;
  setNotice: (notice: string | null) => void;
  close: () => void;
  clearNotice: () => void;
  /** FR-393: the row left before the write landed — close, and say so. */
  reportGone: () => void;
}

export function useWriteSurface<S>(closed: S, goneMessage: string): WriteSurface<S> {
  const [surface, setSurface] = useState<S>(closed);
  const [notice, setNotice] = useState<string | null>(null);

  const open = useCallback((next: S) => {
    setNotice(null);
    setSurface(next);
  }, []);
  const close = useCallback(() => setSurface(closed), [closed]);
  const clearNotice = useCallback(() => setNotice(null), []);
  const reportGone = useCallback(() => {
    setSurface(closed);
    setNotice(goneMessage);
  }, [closed, goneMessage]);

  return { surface, notice, open, setSurface, setNotice, close, clearNotice, reportGone };
}

/**
 * The edit commit both boards share: the patch goes through the caller's
 * `withActor`, and a `NOT_FOUND` — another device deleted the row first —
 * closes the surface and says so rather than recreating what is gone (FR-393).
 * The form is then handed `null`: nothing to show, because the board has
 * already said it.
 */
export async function settleEdit(
  run: () => Promise<ActionResult<unknown>>,
  onGone: () => void,
): Promise<SubmitOutcome> {
  const outcome = await run();
  if (outcome.ok || outcome.error !== "NOT_FOUND") return outcome;
  onGone();
  return null;
}
