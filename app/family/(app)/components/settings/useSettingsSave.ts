"use client";

import { useState } from "react";

import type { ActionResult, FieldErrors } from "@/lib/family/errors";

/**
 * The save half of a settings form: the four pieces of state every section
 * needs, and the one submit path they all follow.
 *
 * Both settings sections had this written out — clear the errors, run the
 * action through `withActor`, say "Saved" or surface the field errors — and a
 * third would have copied it again. The action itself and the draft stay with
 * the section; only the plumbing is here.
 *
 * `submit` never throws: an action that fails comes back as `ok: false`, which
 * is the whole point of `ActionResult`, so a caller only has to render what it
 * is given.
 */

export interface SettingsSave {
  errors: FieldErrors;
  /** The action's own words when it refused; null when nothing has failed. */
  message: string | null;
  /** "Saved" after a successful write, for the polite live region. */
  status: string | null;
  pending: boolean;
  submit: (run: () => Promise<ActionResult<unknown>>) => Promise<void>;
}

export function useSettingsSave(): SettingsSave {
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(run: () => Promise<ActionResult<unknown>>): Promise<void> {
    setPending(true);
    setErrors({});
    setMessage(null);
    setStatus(null);

    const result = await run();
    setPending(false);

    if (result.ok) {
      setStatus("Saved");
      return;
    }
    setErrors(result.fieldErrors ?? {});
    setMessage(result.message);
  }

  return { errors, message, status, pending, submit };
}
