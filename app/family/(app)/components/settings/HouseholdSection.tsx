"use client";

import { useState } from "react";

import { updateHouseholdSettings } from "@/lib/family/actions/settings";
import type { FieldErrors } from "@/lib/family/errors";
import type { HouseholdSettingsPatch } from "@/lib/family/types";

import { useFamily } from "../FamilyProvider";
import { FIELD, FieldError, LABEL } from "./CategoryFields";
import { useSettingsForm, type SettingsDraft } from "./useSettingsForm";

/**
 * Household name and display preferences (FR-031, FR-043).
 *
 * Readable by anyone signed in; saving is parent-only, enforced by the server.
 * Controls are disabled rather than hidden for a punched-in member, so the
 * reason is visible instead of mysterious.
 */

interface ChoiceField {
  key: keyof SettingsDraft;
  label: string;
  options: { value: string; label: string }[];
}

const CHOICES: ChoiceField[] = [
  {
    key: "timeFormat",
    label: "Clock",
    options: [
      { value: "12h", label: "12-hour" },
      { value: "24h", label: "24-hour" },
    ],
  },
  {
    key: "startWeekOn",
    label: "Start week on",
    options: [
      { value: "0", label: "Sunday" },
      { value: "1", label: "Monday" },
    ],
  },
  {
    key: "textSize",
    label: "Text size",
    options: [
      { value: "small", label: "Small" },
      { value: "medium", label: "Medium" },
      { value: "large", label: "Large" },
    ],
  },
  {
    key: "density",
    label: "Display density",
    options: [
      { value: "cozy", label: "Cozy" },
      { value: "snug", label: "Snug" },
      { value: "roomy", label: "Roomy" },
    ],
  },
];

export function HouseholdSection() {
  const { household, settings, actor, withActor } = useFamily();
  const disabled = actor?.role === "member";

  const { draft, set, toPatch } = useSettingsForm(household, settings);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setPending(true);
    setErrors({});
    setMessage(null);
    setStatus(null);

    const patch: HouseholdSettingsPatch = toPatch();
    const result = await withActor(() => updateHouseholdSettings(patch));
    setPending(false);

    if (result.ok) {
      setStatus("Saved");
      return;
    }
    setErrors(result.fieldErrors ?? {});
    setMessage(result.message);
  }

  return (
    <section aria-labelledby="household-heading" className="flex flex-col gap-4">
      <h2
        id="household-heading"
        className="font-(family-name:--fam-font-serif) text-(length:--fam-fs-section)"
      >
        Household
      </h2>
      {disabled ? (
        <p className="text-(length:--fam-fs-small) text-(--fam-text-secondary)">Parents only</p>
      ) : null}

      <form onSubmit={handleSubmit} className="flex max-w-lg flex-col gap-4">
        <label className={LABEL}>
          Household name
          <input
            value={draft.householdName}
            onChange={(event) => set("householdName", event.target.value)}
            maxLength={60}
            disabled={disabled}
            className={FIELD}
          />
          <FieldError messages={errors.householdName} />
        </label>

        <label className="flex min-h-[44px] items-center gap-3 text-(length:--fam-fs-body)">
          <input
            type="checkbox"
            role="switch"
            checked={draft.showNameNotDate}
            disabled={disabled}
            onChange={(event) => set("showNameNotDate", event.target.checked)}
            className="h-5 w-5"
          />
          Show the household name instead of the date
        </label>

        {CHOICES.map((choice) => (
          <label key={choice.key} className={LABEL}>
            {choice.label}
            <select
              value={String(draft[choice.key])}
              disabled={disabled}
              onChange={(event) => set(choice.key, event.target.value)}
              className={FIELD}
            >
              {choice.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ))}

        <label className={LABEL}>
          Punch out after (minutes)
          <input
            type="number"
            min={1}
            max={60}
            value={draft.punchOutMinutes}
            disabled={disabled}
            onChange={(event) => set("punchOutMinutes", event.target.value)}
            className={FIELD}
          />
          <FieldError messages={errors.punchOutMinutes} />
        </label>

        {message ? (
          <p role="alert" className="text-(length:--fam-fs-body)">
            {message}
          </p>
        ) : null}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={disabled || pending}
            className="min-h-[44px] rounded-full bg-(--fam-primary-blue) px-6 text-(length:--fam-fs-body) font-medium text-white disabled:opacity-60"
          >
            Save
          </button>
          <span role="status" className="text-(length:--fam-fs-small) text-(--fam-text-secondary)">
            {status}
          </span>
        </div>
      </form>
    </section>
  );
}
