"use client";

import { useState } from "react";

import type { Scope } from "@/lib/family/types";

import { useModalDialog } from "../../components/useModalDialog";

/**
 * The three-scope question for a repeating event — ONE component serving
 * edit, delete and drag so the wording can never drift between them (FR-237,
 * FR-250). Only the dialog's title names the action; the question line and
 * the three option strings are byte-identical in every mode.
 *
 * Caller contract (FR-238): this dialog is never mounted for a non-repeating
 * event. The caller holds the occurrence and knows whether it repeats; a
 * one-off takes no scope, the server rejects one, and so no scope question
 * exists to ask. This component therefore assumes a repeat and offers no
 * "not repeating" branch.
 *
 * FR-287: when the pending change touches the event's Profiles or Labels,
 * "This event" is not offered — categories change at series scope only.
 * FR-242: when the series was split by an earlier "this and future" change,
 * the "All events" row says it reaches only this segment, so the household
 * meets the rule in the wording rather than in a surprise.
 */

export type ScopeDialogMode = "edit" | "delete" | "move";

export interface ScopeDialogProps {
  mode: ScopeDialogMode;
  /** FR-287 — the change includes Profiles/Labels, so "This event" is not offered. */
  categoriesChanged?: boolean;
  onChoose: (scope: Scope) => void;
  onCancel: () => void;
}

/** The dialog's name varies by action; the question and options never do. */
const TITLES: Record<ScopeDialogMode, string> = {
  edit: "Edit repeating event",
  delete: "Delete repeating event",
  move: "Move repeating event",
};

/** FR-237's exact strings — shared verbatim by edit, delete and drag. */
const SCOPE_LABELS: ReadonlyArray<{ scope: Scope; label: string }> = [
  { scope: "this", label: "This event" },
  { scope: "this_and_future", label: "This and future events" },
  { scope: "all", label: "All events" },
];

const SPLIT_NOTE_ID = "scope-dialog-split-note";

export function ScopeDialog({
  mode,
  categoriesChanged = false,
  onChoose,
  onCancel,
}: ScopeDialogProps) {
  const [scope, setScope] = useState<Scope>(categoriesChanged ? "this_and_future" : "this");
  const dialogRef = useModalDialog(true, "input:checked");

  const offered = categoriesChanged
    ? SCOPE_LABELS.filter((option) => option.scope !== "this")
    : SCOPE_LABELS;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="scope-dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      className="m-auto w-[min(92vw,30rem)] rounded-(--fam-radius-modal) bg-(--fam-app-bg) p-6 text-(--fam-text-primary) backdrop:bg-black/30"
    >
      <h2
        id="scope-dialog-title"
        className="font-(family-name:--fam-font-serif) text-(length:--fam-fs-title)"
      >
        {TITLES[mode]}
      </h2>

      <p
        id="scope-dialog-question"
        className="mt-3 text-(length:--fam-fs-body) text-(--fam-text-secondary)"
      >
        Which events should this apply to?
      </p>

      <div role="radiogroup" aria-labelledby="scope-dialog-question" className="mt-4">
        {offered.map(({ scope: value, label }) => (
          <div key={value}>
            <label className="flex min-h-(--fam-touch) cursor-pointer items-center gap-3 rounded-lg px-2 text-(length:--fam-fs-body)">
              <input
                type="radio"
                name="scope"
                value={value}
                checked={scope === value}
                onChange={() => setScope(value)}
                aria-describedby={value === "all" ? SPLIT_NOTE_ID : undefined}
                className="size-5 accent-(--fam-primary-blue)"
              />
              {label}
            </label>
            {value === "all" ? (
              <p
                id={SPLIT_NOTE_ID}
                className="mb-1 pl-10 pr-2 text-(length:--fam-fs-small) text-(--fam-text-secondary)"
              >
                If this repeat was ever split by a &ldquo;this and future&rdquo; change, this
                reaches only the part this event belongs to.
              </p>
            ) : null}
          </div>
        ))}
      </div>

      <div className="mt-5 flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="min-h-(--fam-touch) rounded-full border border-(--fam-hairline) px-5 text-(length:--fam-fs-body) font-medium"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => onChoose(scope)}
          className="min-h-(--fam-touch) rounded-full bg-(--fam-primary-blue) px-5 text-(length:--fam-fs-body) font-medium text-white"
        >
          Continue
        </button>
      </div>
    </dialog>
  );
}
