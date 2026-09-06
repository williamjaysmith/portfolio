"use client";

import type { List, ListKind } from "@/lib/family/types";
import type { ListInput } from "@/lib/family/validation";

import { FormFooter } from "../../components/FormFooter";
import { FIELD, FieldError, LABEL } from "../../components/settings/CategoryFields";
import { ColorPicker } from "../../components/settings/ColorPicker";
import { useModalDialog } from "../../components/useModalDialog";
import { useListForm, type ListFormMode, type ListFormSeed, type ListSubmitOutcome } from "./useListForm";

/**
 * Create or edit a list (005 T030 — FR-509, FR-510, FR-511, FR-514): the three
 * fields the reference edits — Title, List Type, Color (37275069922971) — and
 * the one this project adds, Parents only (Assumption 5), on the shipped form
 * path.
 *
 * **List type is three radio pills** in the device's order: To do, Grocery,
 * Other (FR-510). It changes nothing this phase and says so.
 *
 * **Colour is the settings `ColorPicker`**: the same twenty swatches, one tab
 * stop, and the same duplicate warning — here against the OTHER lists, since a
 * list's colour is how its card is told apart at a glance.
 *
 * The commit is the caller's: the board passes an `onSubmit` that wraps the
 * real action in `withActor(...)`, so punch-in happens at the moment of the
 * write. Who may save is the server's decision (FR-534).
 */

export interface ListFormProps {
  mode: ListFormMode;
  /** The list being edited, as `listDraftOf` spells it; absent on create. */
  seed?: ListFormSeed;
  /** The household's lists, for the colour picker's duplicate warning. */
  lists: readonly List[];
  /** The list being edited — it does not clash with itself. */
  excludeId?: string;
  onSubmit: (input: ListInput) => Promise<ListSubmitOutcome>;
  onClose: () => void;
}

const KINDS: readonly { kind: ListKind; label: string }[] = [
  { kind: "to_do", label: "To do" },
  { kind: "grocery", label: "Grocery" },
  { kind: "other", label: "Other" },
];

const LEGEND = "text-(length:--fam-fs-small) text-(--fam-text-muted)";
const NOTE = "text-(length:--fam-fs-small) text-(--fam-text-secondary)";
const SWITCH_ROW = "flex min-h-(--fam-touch) items-center gap-3 text-(length:--fam-fs-body)";

/** A radio pill: the shipped pill idiom, checked in the primary ink. */
const KIND_PILL =
  "flex min-h-(--fam-touch) cursor-pointer items-center rounded-full bg-(--fam-pill-btn-bg) px-4 " +
  "text-(length:--fam-fs-pill) font-medium text-(--fam-text-muted) " +
  "has-checked:bg-(--fam-text-primary) has-checked:text-(--fam-app-bg)";

/** FR-510: the type labels the list; nothing hangs on it yet. */
const KIND_NOTE = "A Grocery list is where recipe ingredients will land later; the type changes nothing else.";

/** FR-514's one consequence, said where the switch is set. */
const PARENTS_ONLY_NOTE = "Shown only while a parent is punched in on the device.";

export function ListForm({ mode, seed, lists, excludeId, onSubmit, onClose }: ListFormProps) {
  const dialogRef = useModalDialog(true, true);
  const form = useListForm({ seed, onSubmit, onClose });
  const usedBy = lists.map((list) => ({ id: list.id, label: list.name, color: list.color, emoji: null }));

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    await form.submit();
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="list-form-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className="m-auto w-[min(92vw,34rem)] rounded-(--fam-radius-modal) bg-(--fam-app-bg) p-6 text-(--fam-text-primary) backdrop:bg-black/30"
    >
      <h2 id="list-form-title" className="font-(family-name:--fam-font-serif) text-(length:--fam-fs-title)">
        {mode === "create" ? "Add a list" : "Edit list"}
      </h2>

      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label className={LABEL}>
            Name
            <input
              value={form.draft.name}
              onChange={(event) => form.set("name", event.target.value)}
              maxLength={120}
              className={FIELD}
            />
          </label>
          <FieldError messages={form.errors.name} />
        </div>

        <fieldset className="flex flex-col gap-1">
          <legend className={LEGEND}>List type</legend>
          <div className="flex flex-wrap gap-2">
            {KINDS.map(({ kind, label }) => (
              <label key={kind} className={KIND_PILL}>
                <input
                  type="radio"
                  name="list-kind"
                  value={kind}
                  checked={form.draft.kind === kind}
                  onChange={() => form.set("kind", kind)}
                  className="sr-only"
                />
                {label}
              </label>
            ))}
          </div>
          <p className={NOTE}>{KIND_NOTE}</p>
          <FieldError messages={form.errors.kind} />
        </fieldset>

        <fieldset className="flex flex-col gap-1">
          <legend className={LEGEND}>Colour</legend>
          <ColorPicker
            value={form.draft.color}
            onChange={(color) => form.set("color", color)}
            usedBy={usedBy}
            excludeId={excludeId}
          />
          <FieldError messages={form.errors.color} />
        </fieldset>

        <div className="flex flex-col gap-1">
          <label className={SWITCH_ROW}>
            <input
              type="checkbox"
              role="switch"
              checked={form.draft.parentsOnly}
              onChange={(event) => form.set("parentsOnly", event.target.checked)}
              className="h-5 w-5"
            />
            Parents only
          </label>
          <p className={NOTE}>{PARENTS_ONLY_NOTE}</p>
          <FieldError messages={form.errors.parentsOnly} />
        </div>

        <FormFooter errors={form.errors} message={form.message} pending={form.pending} onClose={onClose} />
      </form>
    </dialog>
  );
}
