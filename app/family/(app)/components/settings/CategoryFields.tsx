"use client";

import type { FieldErrors } from "@/lib/family/errors";

import { AvatarPicker } from "./AvatarPicker";
import type { CategoryFormState } from "./useCategoryForm";

/**
 * The fields that differ between a Profile and a Label. Profiles and Labels
 * are one record type (FR-019), so the difference is entirely in what is shown.
 */

export const FIELD =
  "min-h-[44px] w-full rounded-xl border border-(--fam-hairline) bg-(--fam-app-bg) px-3 text-(length:--fam-fs-body) text-(--fam-text-primary) disabled:opacity-60";
export const LABEL = "flex flex-col gap-1 text-(length:--fam-fs-small) text-(--fam-text-muted)";

export function FieldError({ messages }: { messages?: string[] }) {
  if (!messages || messages.length === 0) return null;
  return (
    <span role="alert" className="text-(length:--fam-fs-small) text-(--fam-danger)">
      {messages[0]}
    </span>
  );
}

export interface FieldsProps {
  form: CategoryFormState;
  errors: FieldErrors;
}

export function LabelFields({ form, errors }: FieldsProps) {
  return (
    <label className={LABEL}>
      Emoji (optional)
      <input
        value={form.draft.emoji}
        onChange={(event) => form.set("emoji", event.target.value)}
        maxLength={8}
        className={FIELD}
      />
      <FieldError messages={errors.emoji} />
    </label>
  );
}

export interface ProfileFieldsProps extends FieldsProps {
  /** The only parent cannot be demoted, and the first person is always a parent. */
  lockedAsParent: boolean;
  bootstrap: boolean;
}

export function ProfileFields({ form, errors, lockedAsParent, bootstrap }: ProfileFieldsProps) {
  const { draft, set } = form;

  return (
    <>
      <fieldset className="flex flex-col gap-1">
        <legend className="text-(length:--fam-fs-small) text-(--fam-text-muted)">Avatar</legend>
        <AvatarPicker
          value={draft.avatarId}
          onChange={(value) => {
            set("avatarId", value);
            set("avatarTouched", true);
          }}
        />
        <FieldError messages={errors.avatar} />
      </fieldset>

      <label className={LABEL}>
        Birthday (optional)
        <input
          type="date"
          value={draft.birthday}
          onChange={(event) => set("birthday", event.target.value)}
          className={FIELD}
        />
        <FieldError messages={errors.birthday} />
      </label>

      <label className={LABEL}>
        Dietary notes (optional)
        <textarea
          value={draft.dietaryPrefs}
          onChange={(event) => set("dietaryPrefs", event.target.value)}
          maxLength={280}
          rows={2}
          className={`${FIELD} py-2`}
        />
        <FieldError messages={errors.dietaryPrefs} />
      </label>

      <fieldset className="flex flex-col gap-1">
        <legend className="text-(length:--fam-fs-small) text-(--fam-text-muted)">Role</legend>
        <div className="flex gap-4">
          {(["parent", "member"] as const).map((option) => (
            <label key={option} className="flex min-h-[44px] items-center gap-2">
              <input
                type="radio"
                name="role"
                value={option}
                checked={draft.role === option}
                disabled={lockedAsParent}
                onChange={() => set("role", option)}
              />
              <span className="text-(length:--fam-fs-body) capitalize">{option}</span>
            </label>
          ))}
        </div>
        {lockedAsParent ? (
          <p className="text-(length:--fam-fs-small) text-(--fam-text-secondary)">
            {bootstrap
              ? "You're the first — this person will be a parent."
              : "The only parent can't be demoted."}
          </p>
        ) : null}
        <FieldError messages={errors.role} />
      </fieldset>

      <label className="flex min-h-[44px] items-center gap-3 text-(length:--fam-fs-body)">
        <input
          type="checkbox"
          role="switch"
          checked={draft.showOnTasks}
          onChange={(event) => set("showOnTasks", event.target.checked)}
          className="h-5 w-5"
        />
        Show on Tasks tab
      </label>
    </>
  );
}
