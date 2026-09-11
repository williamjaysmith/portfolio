"use client";

import type { FieldErrors } from "@/lib/family/errors";

import { AvatarPicker } from "./AvatarPicker";
import type { CategoryFormState } from "./useCategoryForm";

/**
 * The fields that differ between a Profile and a Label. Profiles and Labels
 * are one record type (FR-019), so the difference is entirely in what is shown.
 */

// An empty input is identified by its outline alone, so the outline is a
// control boundary and needs 3:1 — the hairline (1.17:1) is decoration.
// `min-w-0` on the INPUT as well as on its label: a native date or time control
// carries a UA minimum width of its own, which `w-full` does not override. Safari
// sizes those controls wider than Chrome, so this is what stops them spilling out
// of a narrow modal on the phone — the case that cannot be reproduced here.
export const FIELD =
  "min-h-[44px] w-full min-w-0 rounded-xl border border-(--fam-control-border) bg-(--fam-app-bg) px-3 text-(length:--fam-fs-control) text-(--fam-text-primary) disabled:opacity-60";
// `min-w-0` is load-bearing, not tidiness. A flex or grid item defaults to
// `min-width: auto`, which refuses to shrink below its content's intrinsic
// width — and a NATIVE date or time input is intrinsically wide (wider still on
// iOS Safari, where the operator found this). Without it those fields overflow
// their column and draw on top of the one beside them: "on add event start
// date/end time selections … the options overlay on mobile", and the same in
// the meal sheet. With it they shrink to their share of the row.
export const LABEL =
  "flex min-w-0 flex-col gap-1 text-(length:--fam-fs-small) text-(--fam-text-muted)";

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
