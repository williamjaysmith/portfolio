"use client";

import { useId } from "react";

import type { Category } from "@/lib/family/types";
import type { RewardInput } from "@/lib/family/validation";

import { FormFooter } from "../../components/FormFooter";
import { ProfileMultiSelect } from "../../components/ProfileMultiSelect";
import { FIELD, FieldError, LABEL } from "../../components/settings/CategoryFields";
import { useModalDialog } from "../../components/useModalDialog";
import {
  useRewardForm,
  type RewardDraft,
  type RewardFormMode,
  type RewardFormSeed,
  type RewardFormState,
  type RewardSubmitOutcome,
} from "./useRewardForm";

/**
 * Create or edit a reward (004 T036) — FR-415's six fields in FR-415's order:
 * title, description, emoji, star cost, Renew after redeeming, eligible
 * Profiles. The task form's shape with a reward's fields, on the same
 * `formSubmit` path, so the two read alike.
 *
 * **The eligibility picker lists Profiles only** (FR-414, FR-415). A Label has
 * no balance and nobody to redeem for, so a Label among what is passed in is
 * simply not offered; at least one Profile must be chosen, and the refusal
 * lands on the picker itself. The Profiles are the caller's — the board passes
 * the household's — so which Profiles are offered is decided once, where the
 * columns are.
 *
 * **The cost is one number, 1–500** (FR-416), with the range beside it and the
 * one thing that is right but not obvious: changing it later moves every
 * card's progress at once, because progress is the balance against the cost
 * and never a per-reward counter (FR-420).
 *
 * The commit is the caller's: the board passes an `onSubmit` that wraps the
 * real action in `withActor(...)`, so punch-in happens at the moment of the
 * write and may answer `null` when the pipeline was abandoned. Who may save
 * is the server's decision (FR-419); this form only shows what it says.
 */

export interface RewardFormProps {
  mode: RewardFormMode;
  /** The reward being edited, as `rewardDraftOf` spells it; absent on create. */
  seed?: RewardFormSeed;
  /** The household's Profiles, in its order. A Label among them is never offered. */
  profiles: readonly Category[];
  onSubmit: (input: RewardInput) => Promise<RewardSubmitOutcome>;
  onClose: () => void;
}

const SWITCH_ROW = "flex min-h-(--fam-touch) items-center gap-3 text-(length:--fam-fs-body)";
const LEGEND = "text-(length:--fam-fs-small) text-(--fam-text-muted)";
const NOTE = "text-(length:--fam-fs-small) text-(--fam-text-secondary)";

/** FR-416's range, and FR-420's consequence of editing it, beside the field. */
const COST_GUIDANCE =
  "A whole number from 1 to 500. Changing it later moves every card's progress at once.";

/** FR-430's one consequence, said where the switch is set. */
const RENEW_NOTE =
  "On, it can be redeemed again as soon as there are enough stars. " +
  "Off, it is redeemed once per Profile.";

/** The draft's free-text fields — the three the same control draws. */
type TextKey = {
  [K in keyof RewardDraft]: RewardDraft[K] extends string ? K : never;
}[keyof RewardDraft];

/**
 * One text field bound to the draft by its key: the label, the box (a
 * textarea when `rows` is given), an optional note under it, and the field's
 * own refusal slot.
 */
function TextField({
  form,
  field,
  label,
  maxLength,
  rows,
  note,
}: {
  form: RewardFormState;
  field: Exclude<TextKey, "pointValue">;
  label: string;
  maxLength: number;
  rows?: number;
  note?: string;
}) {
  const value = form.draft[field];
  const onChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void =>
    form.set(field, event.target.value);
  return (
    <div className="flex flex-col gap-1">
      <label className={LABEL}>
        {label}
        {rows === undefined ? (
          <input value={value} onChange={onChange} maxLength={maxLength} className={FIELD} />
        ) : (
          <textarea
            value={value}
            onChange={onChange}
            maxLength={maxLength}
            rows={rows}
            className={`${FIELD} py-2`}
          />
        )}
      </label>
      {note === undefined ? null : <p className={NOTE}>{note}</p>}
      <FieldError messages={form.errors[field]} />
    </div>
  );
}

/**
 * FR-416: the cost as text in and text out — the draft holds what was typed
 * and its translator sends a number. The browser's own range check runs first
 * on a real device; the schema's refusal, when it comes, lands in this block's
 * own slot.
 */
function CostField({ form }: { form: RewardFormState }) {
  const helpId = useId();
  return (
    <div className="flex flex-col gap-1">
      <label className={LABEL}>
        Star cost
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={500}
          value={form.draft.pointValue}
          onChange={(event) => form.set("pointValue", event.target.value)}
          aria-describedby={helpId}
          className={FIELD}
        />
      </label>
      <p id={helpId} className={NOTE}>
        {COST_GUIDANCE}
      </p>
      <FieldError messages={form.errors.pointValue} />
    </div>
  );
}

export function RewardForm({ mode, seed, profiles, onSubmit, onClose }: RewardFormProps) {
  const dialogRef = useModalDialog(true, true);

  // FR-414: a Label is never eligible, whatever the caller passed.
  const eligible = profiles.filter((profile) => profile.isProfile);

  const form = useRewardForm({ seed, profiles: eligible, onSubmit, onClose });

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    await form.submit();
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="reward-form-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className="m-auto w-[min(92vw,34rem)] rounded-(--fam-radius-modal) bg-(--fam-app-bg) p-6 text-(--fam-text-primary) backdrop:bg-black/30"
    >
      <h2
        id="reward-form-title"
        className="font-(family-name:--fam-font-serif) text-(length:--fam-fs-title)"
      >
        {mode === "create" ? "Add a reward" : "Edit reward"}
      </h2>

      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
        <TextField form={form} field="name" label="Title" maxLength={120} />
        {/* FR-415: shown in the details view, never on the card. */}
        <TextField
          form={form}
          field="description"
          label="Description (optional)"
          maxLength={2000}
          rows={3}
          note="Shown when the reward is opened, not on its card."
        />
        <TextField form={form} field="emoji" label="Emoji (optional)" maxLength={16} />

        <CostField form={form} />

        <div className="flex flex-col gap-1">
          <label className={SWITCH_ROW}>
            <input
              type="checkbox"
              role="switch"
              checked={form.draft.respawnOnRedemption}
              onChange={(event) => form.set("respawnOnRedemption", event.target.checked)}
              className="h-5 w-5"
            />
            Renew after redeeming
          </label>
          <p className={NOTE}>{RENEW_NOTE}</p>
          <FieldError messages={form.errors.respawnOnRedemption} />
        </div>

        {/* FR-414 / FR-415: a chip per Profile, at least one required — the
            refusal is the picker's own. */}
        <fieldset className="flex flex-col gap-1">
          <legend className={LEGEND}>Eligible Profiles</legend>
          <ProfileMultiSelect
            profiles={eligible}
            selectedIds={form.draft.categoryIds}
            onToggle={form.toggleProfile}
          />
          <FieldError messages={form.errors.categoryIds} />
        </fieldset>

        <FormFooter
          errors={form.errors}
          message={form.message}
          pending={form.pending}
          onClose={onClose}
        />
      </form>
    </dialog>
  );
}
