"use client";

import { useState } from "react";

import type { TaskScope } from "@/lib/family/types";

import { useModalDialog } from "../../components/useModalDialog";

/**
 * FR-347's scope question for a repeating task (T054), with the reference's own
 * **asymmetry**: a repeating chore is offered all three scopes, while a routine
 * is offered "this and all future ones" and "all of them" only — a routine's
 * single occurrence is removed with **Skip**, which writes the very record a
 * "this occurrence" delete would (FR-359, FR-364), so a second control for one
 * write would be two names for one thing.
 *
 * **Caller contract**: this dialog is never mounted for a task that does not
 * repeat. A one-off takes no scope, the server refuses one, and so no question
 * exists to ask (contracts §deleteTask).
 *
 * The copy states what "all future" **keeps**, not only what it removes: every
 * earlier occurrence survives and so does every stored resolution. Without that
 * sentence a parent reads it as "everything from the beginning", which is the
 * one reading the action does not implement. On a **Completed Date** chore
 * "this one" carries its own note, because deleting one occurrence there writes
 * a skip, which ADVANCES the cycle by the configured delay (FR-362) — the
 * opposite of the "this kills the chore for ever" a parent will assume.
 *
 * Purely presentational: the parent owns the `deleteTask` call and the
 * confirmation that follows this question. Modality is Phase 1's dialog idiom.
 */

export interface DeleteScopeDialogProps {
  /** The tapped occurrence's title, quoted in the question. */
  summary: string;
  /** FR-347: a routine is not offered "this one". */
  routine: boolean;
  /**
   * FR-362: a Completed Date chore, whose "this one" ADVANCES the cycle rather
   * than ending the chore — the reading a parent will otherwise assume.
   */
  cursorMode?: boolean;
  onChoose: (scope: TaskScope) => void;
  onCancel: () => void;
}

const SCOPE_LABELS: ReadonlyArray<{ scope: TaskScope; label: string }> = [
  { scope: "this", label: "This one" },
  { scope: "this_and_future", label: "This and all future ones" },
  { scope: "all", label: "All of them" },
];

const FUTURE_NOTE_ID = "task-scope-future-note";
const THIS_NOTE_ID = "task-scope-this-note";

/** Only the two scopes that carry a note describe one. */
function describedBy(scope: TaskScope, cursorMode: boolean): string | undefined {
  if (scope === "this_and_future") return FUTURE_NOTE_ID;
  return scope === "this" && cursorMode ? THIS_NOTE_ID : undefined;
}

const BUTTON = "min-h-(--fam-touch) rounded-full px-5 text-(length:--fam-fs-body) font-medium";

export function DeleteScopeDialog({
  summary,
  routine,
  cursorMode = false,
  onChoose,
  onCancel,
}: DeleteScopeDialogProps) {
  const offered = routine
    ? SCOPE_LABELS.filter((option) => option.scope !== "this")
    : SCOPE_LABELS;
  // The narrowest scope on offer — never one the person was not shown.
  const [scope, setScope] = useState<TaskScope>(routine ? "this_and_future" : "this");
  const dialogRef = useModalDialog(true, "input:checked");

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="task-scope-title"
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      className="m-auto w-[min(92vw,30rem)] rounded-(--fam-radius-modal) bg-(--fam-app-bg) p-6 text-(--fam-text-primary) backdrop:bg-black/30"
    >
      <h2
        id="task-scope-title"
        className="font-(family-name:--fam-font-serif) text-(length:--fam-fs-title)"
      >
        Delete &ldquo;{summary}&rdquo;?
      </h2>

      <p
        id="task-scope-question"
        className="mt-3 text-(length:--fam-fs-body) text-(--fam-text-secondary)"
      >
        Which of these should this apply to?
      </p>

      <div role="radiogroup" aria-labelledby="task-scope-question" className="mt-4">
        {offered.map(({ scope: value, label }) => (
          <div key={value}>
            <label className="flex min-h-(--fam-touch) cursor-pointer items-center gap-3 rounded-lg px-2 text-(length:--fam-fs-body)">
              <input
                type="radio"
                name="task-scope"
                value={value}
                checked={scope === value}
                onChange={() => setScope(value)}
                aria-describedby={describedBy(value, cursorMode)}
                className="size-5 accent-(--fam-primary-blue)"
              />
              {label}
            </label>
            {value === "this" && cursorMode ? (
              <p
                id={THIS_NOTE_ID}
                className="mb-1 pl-10 pr-2 text-(length:--fam-fs-small) text-(--fam-text-secondary)"
              >
                This one is skipped, so the next one is still scheduled &mdash; after the usual
                delay, counted from today.
              </p>
            ) : null}
            {value === "this_and_future" ? (
              <p
                id={FUTURE_NOTE_ID}
                className="mb-1 pl-10 pr-2 text-(length:--fam-fs-small) text-(--fam-text-secondary)"
              >
                Every earlier one stays, and so does everything already ticked off.
              </p>
            ) : null}
          </div>
        ))}
      </div>

      {routine ? (
        <p className="mt-2 text-(length:--fam-fs-small) text-(--fam-text-secondary)">
          Use Skip to remove a single day of a routine.
        </p>
      ) : null}

      <div className="mt-5 flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className={`${BUTTON} border border-(--fam-hairline)`}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => onChoose(scope)}
          className={`${BUTTON} bg-(--fam-primary-blue) text-white`}
        >
          Continue
        </button>
      </div>
    </dialog>
  );
}
