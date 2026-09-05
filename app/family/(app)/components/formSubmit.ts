import { useState } from "react";

import { ActionFailure, type ActionResult, type FieldErrors } from "@/lib/family/errors";

/**
 * The submit path every `/family` form hook shares — the calendar's
 * `useEventForm` (002 T042) and the board's `useTaskForm` (003 T053) — so the
 * two do not carry a second copy of how a refusal is shown.
 *
 * A form validates LOCALLY with the action's own module first (the same
 * schema the server will run, so nothing is sent that would be refused), then
 * hands the parsed input to the caller's commit. Either step can refuse, and
 * both refusals reach the form as one shape: the message to show, and the
 * field errors to place, leaving every other entry exactly as typed (FR-262,
 * FR-330). A commit that never happened — a dismissed punch-in — is
 * `abandoned`, with nothing to show at all.
 */

/** What a form's commit returns: the action's result, or `null` when nothing was sent. */
export type SubmitOutcome = ActionResult<unknown> | null;

/** How a submit settled: saved and done, refused with what to show, or abandoned with nothing to show. */
export type Settled =
  | { kind: "saved" }
  | { kind: "abandoned" }
  | { kind: "refused"; message: string; fieldErrors?: FieldErrors };

/** A multi-select's one gesture: in the list → out of it, out → appended. */
export function toggled<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

/**
 * `parse` throws the action module's `ActionFailure` on a local refusal;
 * anything else it throws is a bug and is rethrown.
 */
export async function settleSubmit<Input>(
  parse: () => Input,
  onSubmit: (input: Input) => Promise<SubmitOutcome>,
): Promise<Settled> {
  let input: Input;
  try {
    input = parse();
  } catch (error) {
    if (error instanceof ActionFailure) {
      return { kind: "refused", message: error.message, fieldErrors: error.fieldErrors };
    }
    throw error;
  }

  const outcome = await onSubmit(input);
  if (outcome === null) return { kind: "abandoned" };
  if (outcome.ok) return { kind: "saved" };
  return { kind: "refused", message: outcome.message, fieldErrors: outcome.fieldErrors };
}

/** The form-side setters a settled submit lands on. */
interface SettledSink {
  setErrors: (errors: FieldErrors) => void;
  setMessage: (message: string | null) => void;
  onClose: () => void;
}

/** Saved closes the form; refused shows the refusal; abandoned shows nothing. */
function applySettled(settled: Settled, sink: SettledSink): void {
  if (settled.kind === "saved") {
    sink.onClose();
    return;
  }
  if (settled.kind === "refused") {
    sink.setErrors(settled.fieldErrors ?? {});
    sink.setMessage(settled.message);
  }
}

export interface Submission {
  errors: FieldErrors;
  message: string | null;
  pending: boolean;
  /** Runs one validate-and-commit, clearing the last refusal first. */
  submit: (run: () => Promise<Settled>) => Promise<void>;
}

/**
 * The state a submit moves through — pending, then either closed or showing
 * a refusal — held once for both form hooks. The draft itself stays theirs.
 */
export function useSubmission(onClose: () => void): Submission {
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(run: () => Promise<Settled>): Promise<void> {
    setPending(true);
    setErrors({});
    setMessage(null);
    const settled = await run();
    setPending(false);
    applySettled(settled, { setErrors, setMessage, onClose });
  }

  return { errors, message, pending, submit };
}
