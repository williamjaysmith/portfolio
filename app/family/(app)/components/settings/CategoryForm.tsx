"use client";

import { useState } from "react";

import { createCategory, updateCategory } from "@/lib/family/actions/categories";
import type { FieldErrors } from "@/lib/family/errors";
import { isLastParent } from "@/lib/family/permissions";
import type { Category } from "@/lib/family/types";

import { useFamily } from "../FamilyProvider";
import { useModalDialog } from "../useModalDialog";
import { FIELD, FieldError, LABEL, LabelFields, ProfileFields } from "./CategoryFields";
import { ColorPicker } from "./ColorPicker";
import { draftToInput, useCategoryForm } from "./useCategoryForm";

/**
 * Create or edit a Profile or a Label (FR-020, FR-023, FR-024, FR-025).
 *
 * The kind decides which fields exist; the same rule is enforced again by the
 * validation layer and a third time by the database CHECK constraints.
 */

export interface CategoryFormProps {
  mode: "create" | "edit";
  kind: "profile" | "label";
  existing?: Category;
  /** Bootstrap: the first person in a household is always a parent (D6). */
  forceParent?: boolean;
  onClose: () => void;
}

function FormFooter({ pending, onCancel }: { pending: boolean; onCancel: () => void }) {
  return (
    <div className="flex justify-end gap-3">
      <button
        type="button"
        onClick={onCancel}
        className="min-h-[44px] rounded-full border border-(--fam-hairline) px-5 text-(length:--fam-fs-body) font-medium"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={pending}
        className="min-h-[44px] rounded-full bg-(--fam-primary-blue) px-5 text-(length:--fam-fs-body) font-medium text-white disabled:opacity-60"
      >
        Save
      </button>
    </div>
  );
}

export function CategoryForm({ mode, kind, existing, forceParent, onClose }: CategoryFormProps) {
  const { categories, profiles, withActor } = useFamily();
  const dialogRef = useModalDialog(true);
  const isProfile = kind === "profile";

  const form = useCategoryForm(existing, Boolean(forceParent));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const lockedAsParent =
    Boolean(forceParent) ||
    (existing ? existing.role === "parent" && isLastParent(existing, profiles) : false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setPending(true);
    setErrors({});
    setMessage(null);

    const input = draftToInput(form.draft, isProfile);
    const result = await withActor(() =>
      mode === "create"
        ? createCategory({ ...input, isProfile })
        : updateCategory(existing?.id ?? "", input),
    );

    setPending(false);
    if (result.ok) {
      onClose();
      return;
    }
    setErrors(result.fieldErrors ?? {});
    setMessage(result.message);
  }

  const kindLabel = isProfile ? "Profile" : "Label";

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="category-form-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className="m-auto w-[min(92vw,34rem)] rounded-(--fam-radius-modal) bg-(--fam-app-bg) p-6 text-(--fam-text-primary) backdrop:bg-black/30"
    >
      <h2
        id="category-form-title"
        className="font-(family-name:--fam-font-serif) text-(length:--fam-fs-title)"
      >
        {mode === "create" ? `Add a ${kindLabel}` : `Edit ${existing?.label ?? kindLabel}`}
      </h2>

      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
        <label className={LABEL}>
          {isProfile ? "Name" : "Label name"}
          <input
            value={form.draft.label}
            onChange={(event) => form.set("label", event.target.value)}
            maxLength={40}
            required
            className={FIELD}
          />
          <FieldError messages={errors.label} />
        </label>

        <fieldset className="flex flex-col gap-1">
          <legend className="text-(length:--fam-fs-small) text-(--fam-text-muted)">Colour</legend>
          <ColorPicker
            value={form.draft.color}
            onChange={(color) => form.set("color", color)}
            usedBy={categories}
            excludeId={existing?.id}
          />
          <FieldError messages={errors.color} />
        </fieldset>

        {isProfile ? (
          <ProfileFields
            form={form}
            errors={errors}
            lockedAsParent={lockedAsParent}
            bootstrap={Boolean(forceParent)}
          />
        ) : (
          <LabelFields form={form} errors={errors} />
        )}

        <p role="alert" className="empty:hidden text-(length:--fam-fs-body) text-(--fam-text-primary)">
          {message}
        </p>

        <FormFooter pending={pending} onCancel={onClose} />
      </form>
    </dialog>
  );
}
