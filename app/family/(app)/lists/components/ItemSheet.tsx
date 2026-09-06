"use client";

import { ArrowDown, ArrowUp } from "lucide-react";

import { ActionFailure } from "@/lib/family/errors";
import type { ListItem } from "@/lib/family/types";
import { listItemTextSchema, parseOrThrow, sectionNameSchema } from "@/lib/family/validation";

import { FormFooter } from "../../components/FormFooter";
import { settleSubmit, useSubmission, type Settled, type SubmitOutcome } from "../../components/formSubmit";
import { FIELD, FieldError, LABEL } from "../../components/settings/CategoryFields";
import { useDraft } from "../../components/useDraft";
import { useModalDialog } from "../../components/useModalDialog";

/**
 * An item's sheet (005 R510; FR-522, FR-529, FR-541), opened by tapping its
 * text: the text to correct, a Section chooser (None, each existing section, or
 * a new name), **Move up** / **Move down** — the keyboard's reorder, one write
 * each — and **Delete** outright, as the phone app's "x" does (360041476692).
 *
 * Save sends one `updateListItem` with what changed; Move and Delete are the
 * board's writes and close nothing — the sheet re-reads the live item. A
 * refusal is shown here, where the tap happened.
 */

/** The chooser's "make a new section" option. */
const NEW_SECTION = "__new__";
const NO_SECTION = "";

export interface ItemPatch {
  text?: string;
  section?: string | null;
}

export interface ItemSheetProps {
  item: ListItem;
  listName: string;
  /** The list's existing sections, for the chooser. */
  sections: readonly string[];
  canMoveUp: boolean;
  canMoveDown: boolean;
  /** FR-537: one of this item's writes is in flight. */
  busy: boolean;
  /** A refused Move or Delete, shown here. */
  notice: string | null;
  onSave: (patch: ItemPatch) => Promise<SubmitOutcome>;
  onMove: (direction: -1 | 1) => void;
  onDelete: () => void;
  onClose: () => void;
}

interface ItemDraft {
  text: string;
  /** `NO_SECTION`, an existing section, or `NEW_SECTION`. */
  choice: string;
  newSection: string;
}

/** What the chooser's state means for the row's `section`. */
function sectionOf(draft: ItemDraft): string | null {
  if (draft.choice === NO_SECTION) return null;
  if (draft.choice === NEW_SECTION) return parseOrThrow(sectionNameSchema, draft.newSection);
  return draft.choice;
}

/** Only what changed travels (FR-522); nothing changed is a refusal, not a write. */
function patchOf(draft: ItemDraft, item: ListItem): ItemPatch {
  const text = parseOrThrow(listItemTextSchema, draft.text);
  const section = sectionOf(draft);
  const patch: ItemPatch = {};
  if (text !== item.text) patch.text = text;
  if (section !== item.section) patch.section = section;
  if (patch.text === undefined && patch.section === undefined) {
    throw new ActionFailure("VALIDATION", "Nothing to change.", { text: ["Nothing to change."] });
  }
  return patch;
}

const SECONDARY =
  "flex min-h-(--fam-touch) items-center gap-2 rounded-full bg-(--fam-btn-secondary-bg) px-4 " +
  "text-(length:--fam-fs-body) font-medium disabled:opacity-50";

export function ItemSheet({
  item,
  listName,
  sections,
  canMoveUp,
  canMoveDown,
  busy,
  notice,
  onSave,
  onMove,
  onDelete,
  onClose,
}: ItemSheetProps) {
  const dialogRef = useModalDialog(true, true);
  const { draft, set } = useDraft<ItemDraft>(() => ({
    text: item.text,
    choice: item.section ?? NO_SECTION,
    newSection: "",
  }));
  const submission = useSubmission(onClose);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    await submission.submit((): Promise<Settled> => settleSubmit(() => patchOf(draft, item), onSave));
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="item-sheet-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className="m-auto w-[min(92vw,30rem)] rounded-(--fam-radius-modal) bg-(--fam-app-bg) p-6 text-(--fam-text-primary) backdrop:bg-black/30"
    >
      <h2 id="item-sheet-title" className="font-(family-name:--fam-font-serif) text-(length:--fam-fs-title)">
        {item.text}
      </h2>
      <p className="text-(length:--fam-fs-small) text-(--fam-text-secondary)">{listName}</p>

      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label className={LABEL}>
            Item
            <input value={draft.text} onChange={(event) => set("text", event.target.value)} maxLength={200} className={FIELD} />
          </label>
          <FieldError messages={submission.errors.text} />
        </div>

        <div className="flex flex-col gap-1">
          <label className={LABEL}>
            Section
            <select value={draft.choice} onChange={(event) => set("choice", event.target.value)} className={FIELD}>
              <option value={NO_SECTION}>No section</option>
              {sections.map((section) => (
                <option key={section} value={section}>
                  {section}
                </option>
              ))}
              <option value={NEW_SECTION}>New section…</option>
            </select>
          </label>
          {draft.choice === NEW_SECTION ? (
            <label className={LABEL}>
              New section name
              <input
                value={draft.newSection}
                onChange={(event) => set("newSection", event.target.value)}
                maxLength={60}
                className={FIELD}
              />
            </label>
          ) : null}
          <FieldError messages={submission.errors.section} />
        </div>

        {/* FR-541: the keyboard's reorder — one row up or down, over a header too. */}
        <div className="flex flex-wrap gap-2" role="group" aria-label="Move">
          <button type="button" onClick={() => onMove(-1)} disabled={!canMoveUp || busy} className={SECONDARY}>
            <ArrowUp aria-hidden="true" size={20} />
            Move up
          </button>
          <button type="button" onClick={() => onMove(1)} disabled={!canMoveDown || busy} className={SECONDARY}>
            <ArrowDown aria-hidden="true" size={20} />
            Move down
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={busy}
            className={`${SECONDARY} ml-auto text-(--fam-danger)`}
          >
            Delete
          </button>
        </div>

        {notice === null ? null : (
          <p role="alert" className="text-(length:--fam-fs-small) text-(--fam-danger)">
            {notice}
          </p>
        )}

        <FormFooter errors={submission.errors} message={submission.message} pending={submission.pending || busy} onClose={onClose} />
      </form>
    </dialog>
  );
}
