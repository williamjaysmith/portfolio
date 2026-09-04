"use client";

import { useState } from "react";

import { createCategory, updateCategory } from "@/lib/family/actions/categories";
import type { ActionResult, FieldErrors } from "@/lib/family/errors";
import { isLastParent } from "@/lib/family/permissions";
import type { Category, CategoryInput } from "@/lib/family/types";

import { useFamily, type FamilyContextValue } from "../FamilyProvider";
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

/**
 * The save, and whether it has to go through the punch-in gate.
 *
 * D6: the FIRST profile in a household with no parent is created without an
 * actor, because nobody can punch in yet — no profile exists to hold a PIN.
 * Routing that through `withActor` would open a picker with nobody in it and
 * leave a fresh household permanently unable to add anyone.
 * `requireParentOrBootstrap()` on the server is still the real gate: it allows
 * an actor-less create only while the household has no parent, and forces the
 * new record to be a parent profile.
 */
function saveCategory(
  args: {
    mode: "create" | "edit";
    isProfile: boolean;
    bootstrap: boolean;
    existingId: string | undefined;
    input: Omit<CategoryInput, "isProfile">;
  },
  withActor: FamilyContextValue["withActor"],
): Promise<ActionResult<Category>> {
  const run = () =>
    args.mode === "create"
      ? createCategory({ ...args.input, isProfile: args.isProfile })
      : updateCategory(args.existingId ?? "", args.input);

  return args.bootstrap ? run() : withActor(run);
}

/** The one parent left cannot be demoted, and the first person is always one. */
function roleIsLocked(
  forceParent: boolean,
  existing: Category | undefined,
  profiles: readonly Category[],
): boolean {
  if (forceParent) return true;
  if (!existing) return false;
  return existing.role === "parent" && isLastParent(existing, profiles);
}

function dialogTitle(
  mode: "create" | "edit",
  isProfile: boolean,
  existing: Category | undefined,
): string {
  const kindLabel = isProfile ? "Profile" : "Label";
  if (mode === "create") return `Add a ${kindLabel}`;
  return `Edit ${existing?.label ?? kindLabel}`;
}

export function CategoryForm({ mode, kind, existing, forceParent, onClose }: CategoryFormProps) {
  const { categories, profiles, withActor } = useFamily();

  const dialogRef = useModalDialog(true, true);
  const isProfile = kind === "profile";

  const form = useCategoryForm(existing, Boolean(forceParent));
  const nameFieldLabel = isProfile ? "Name" : "Label name";
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const bootstrap = Boolean(forceParent);
  const lockedAsParent = roleIsLocked(bootstrap, existing, profiles);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setPending(true);
    setErrors({});
    setMessage(null);

    const result = await saveCategory(
      {
        mode,
        isProfile,
        bootstrap,
        existingId: existing?.id,
        input: draftToInput(form.draft, isProfile),
      },
      withActor,
    );

    setPending(false);
    if (result.ok) {
      onClose();
      return;
    }
    setErrors(result.fieldErrors ?? {});
    setMessage(result.message);
  }

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
        {dialogTitle(mode, isProfile, existing)}
      </h2>

      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
        <label className={LABEL}>
          {nameFieldLabel}
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
            bootstrap={bootstrap}
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
