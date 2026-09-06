"use client";

import { useState } from "react";

import type { Scope } from "@/lib/family/types";

import { useModalDialog } from "./useModalDialog";

/**
 * The three-scope question for a repeating record — ONE component serving
 * edit, delete and drag so the wording can never drift between them (002
 * FR-237, FR-250; 006 FR-629). Only the dialog's title names the action; the
 * question line and the three option strings are byte-identical in every mode.
 *
 * Phase 6 generalised it by a **noun**: the calendar asks about events, the
 * Meals tab about meals, and the strings differ in that one word and nothing
 * else — "This meal / This and future meals / All meals" is the spec's exact
 * wording, as the event strings were Phase 2's. The default is the event,
 * so every shipped call site reads as it did.
 *
 * Caller contract (FR-238): this dialog is never mounted for a non-repeating
 * record. The caller holds the occurrence and knows whether it repeats; a
 * one-off takes no scope, the server rejects one, and so no scope question
 * exists to ask. This component therefore assumes a repeat and offers no
 * "not repeating" branch.
 *
 * FR-287: when the pending change touches the event's Profiles or Labels,
 * "This event" is not offered — categories change at series scope only.
 * FR-242: when the series was split by an earlier "this and future" change,
 * the "All" row says it reaches only this segment, so the household meets the
 * rule in the wording rather than in a surprise.
 */

export type ScopeDialogMode = "edit" | "delete" | "move";

/** What the repeating thing is called — the one word the strings vary by. */
export type ScopeNoun = "event" | "meal";

export interface ScopeDialogProps {
  mode: ScopeDialogMode;
  /** "event" unless a board says otherwise; the calendar's call sites pass nothing. */
  noun?: ScopeNoun;
  /** FR-287 — the change includes Profiles/Labels, so "This event" is not offered. */
  categoriesChanged?: boolean;
  onChoose: (scope: Scope) => void;
  onCancel: () => void;
}

/** The dialog's name varies by action; the question and options never do. */
const VERBS: Record<ScopeDialogMode, string> = {
  edit: "Edit",
  delete: "Delete",
  move: "Move",
};

interface ScopeWords {
  title: string;
  question: string;
  options: ReadonlyArray<{ scope: Scope; label: string }>;
  splitNote: string;
}

/** FR-237's exact strings (and FR-629's, for meals) — shared verbatim by edit, delete and drag. */
function wordsOf(noun: ScopeNoun, mode: ScopeDialogMode): ScopeWords {
  const one = noun;
  const many = `${noun}s`;
  return {
    title: `${VERBS[mode]} repeating ${one}`,
    question: `Which ${many} should this apply to?`,
    options: [
      { scope: "this", label: `This ${one}` },
      { scope: "this_and_future", label: `This and future ${many}` },
      { scope: "all", label: `All ${many}` },
    ],
    splitNote:
      `If this repeat was ever split by a “this and future” change, this ` +
      `reaches only the part this ${one} belongs to.`,
  };
}

const SPLIT_NOTE_ID = "scope-dialog-split-note";

export function ScopeDialog({
  mode,
  noun = "event",
  categoriesChanged = false,
  onChoose,
  onCancel,
}: ScopeDialogProps) {
  const [scope, setScope] = useState<Scope>(categoriesChanged ? "this_and_future" : "this");
  const dialogRef = useModalDialog(true, "input:checked");
  const words = wordsOf(noun, mode);

  const offered = categoriesChanged
    ? words.options.filter((option) => option.scope !== "this")
    : words.options;

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
        {words.title}
      </h2>

      <p
        id="scope-dialog-question"
        className="mt-3 text-(length:--fam-fs-body) text-(--fam-text-secondary)"
      >
        {words.question}
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
                {words.splitNote}
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
