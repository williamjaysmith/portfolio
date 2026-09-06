"use client";

import { ActionFailure } from "@/lib/family/errors";
import type { FieldErrors } from "@/lib/family/errors";
import { matchSection } from "@/lib/family/lists/grouping";
import type { List, ListItem } from "@/lib/family/types";
import { parseOrThrow, sectionNameSchema } from "@/lib/family/validation";

import { FormFooter } from "../../components/FormFooter";
import { settleSubmit, toggled, useSubmission, type Settled, type SubmitOutcome } from "../../components/formSubmit";
import { FIELD, FieldError, LABEL } from "../../components/settings/CategoryFields";
import { useDraft } from "../../components/useDraft";
import { useModalDialog } from "../../components/useModalDialog";

/**
 * Add section / Move items, and Rename (005 R510; FR-528, FR-529, FR-533;
 * 44739335665051 — "select 'Add Section,' type the section name… At least one
 * item must exist", "select multiple items, then use a 'Move' button"). One
 * sheet, two modes: **add** takes a name and at least one of the list's items;
 * **rename** takes the new name for an existing section. The name is matched
 * against the list's sections the way the action will match it (FR-529), so
 * the sheet can say "joins Dairy" before anything is sent.
 *
 * The commit is the caller's — `sectionItems` or `renameSection` through the
 * item queue — and a refusal is shown here, where the tap happened.
 */

export type SectionSheetMode = { kind: "add" } | { kind: "rename"; from: string };

export interface SectionSubmit {
  name: string;
  /** Add mode only: the chosen items. */
  itemIds: string[];
}

export interface SectionSheetProps {
  list: List;
  mode: SectionSheetMode;
  /** The list's items, for the checklist (add mode). */
  items: readonly ListItem[];
  /** The list's existing sections, for the match note. */
  sections: readonly string[];
  onSubmit: (input: SectionSubmit) => Promise<SubmitOutcome>;
  onClose: () => void;
}

interface SectionDraft {
  name: string;
  itemIds: string[];
}

const CHOOSE_AN_ITEM = "Choose at least one item.";
const CHECK_ROW = "flex min-h-(--fam-touch) cursor-pointer items-center gap-3 text-(length:--fam-fs-body)";
const NOTE = "text-(length:--fam-fs-small) text-(--fam-text-secondary)";

function validate(draft: SectionDraft, mode: SectionSheetMode): SectionSubmit {
  const name = parseOrThrow(sectionNameSchema, draft.name);
  if (mode.kind === "add" && draft.itemIds.length === 0) {
    throw new ActionFailure("VALIDATION", CHOOSE_AN_ITEM, { itemIds: [CHOOSE_AN_ITEM] });
  }
  return { name, itemIds: mode.kind === "add" ? draft.itemIds : [] };
}

/** FR-529: what the typed name will become — an existing section's spelling, or itself. */
function matchNoteOf(sections: readonly string[], name: string, mode: SectionSheetMode): string | null {
  const others = mode.kind === "rename" ? sections.filter((one) => one !== mode.from) : sections;
  const matched = matchSection(others, name);
  if (matched === null || matched === name.trim()) return null;
  return mode.kind === "add" ? `The items join ${matched}.` : `${mode.from} merges into ${matched}.`;
}

function ItemChecklist({
  items,
  chosen,
  onToggle,
  errors,
}: {
  items: readonly ListItem[];
  chosen: readonly string[];
  onToggle: (id: string) => void;
  errors: FieldErrors;
}) {
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="text-(length:--fam-fs-small) text-(--fam-text-muted)">Items</legend>
      <ul className="flex max-h-[40vh] flex-col overflow-y-auto">
        {items.map((item) => (
          <li key={item.id}>
            <label className={CHECK_ROW}>
              <input type="checkbox" checked={chosen.includes(item.id)} onChange={() => onToggle(item.id)} className="h-5 w-5" />
              <span className="min-w-0 flex-1 truncate">{item.text}</span>
              {item.section === null ? null : <span className={NOTE}>{item.section}</span>}
            </label>
          </li>
        ))}
      </ul>
      <FieldError messages={errors.itemIds} />
    </fieldset>
  );
}

export function SectionSheet({ list, mode, items, sections, onSubmit, onClose }: SectionSheetProps) {
  const dialogRef = useModalDialog(true, true);
  const { draft, set, update } = useDraft<SectionDraft>(
    () => ({ name: mode.kind === "rename" ? mode.from : "", itemIds: [] }),
  );
  const submission = useSubmission(onClose);
  const note = matchNoteOf(sections, draft.name, mode);

  function toggleItem(id: string): void {
    update((current) => ({ ...current, itemIds: toggled(current.itemIds, id) }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    await submission.submit((): Promise<Settled> => settleSubmit(() => validate(draft, mode), onSubmit));
  }

  const title = mode.kind === "add" ? `Add a section to ${list.name}` : `Rename ${mode.from}`;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="section-sheet-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className="m-auto w-[min(92vw,30rem)] rounded-(--fam-radius-modal) bg-(--fam-app-bg) p-6 text-(--fam-text-primary) backdrop:bg-black/30"
    >
      <h2 id="section-sheet-title" className="font-(family-name:--fam-font-serif) text-(length:--fam-fs-title)">
        {title}
      </h2>
      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label className={LABEL}>
            Section name
            <input value={draft.name} onChange={(event) => set("name", event.target.value)} maxLength={60} className={FIELD} />
          </label>
          {note === null ? null : <p className={NOTE}>{note}</p>}
          <FieldError messages={submission.errors.name} />
        </div>
        {mode.kind === "add" ? (
          <ItemChecklist items={items} chosen={draft.itemIds} onToggle={toggleItem} errors={submission.errors} />
        ) : null}
        <FormFooter errors={submission.errors} message={submission.message} pending={submission.pending} onClose={onClose} />
      </form>
    </dialog>
  );
}
