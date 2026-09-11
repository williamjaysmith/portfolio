"use client";

import { updateHouseholdSettings } from "@/lib/family/actions/settings";
import type { HouseholdSettingsPatch } from "@/lib/family/types";

import { useFamily } from "../FamilyProvider";
import { FIELD, FieldError, LABEL } from "./CategoryFields";
import { SaveRow } from "./SaveRow";
import { useSettingsForm, type SettingsDraft } from "./useSettingsForm";
import { useSettingsSave } from "./useSettingsSave";

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
  {
    // 009 FR-903. Exactly the reference's three values, in its own words
    // [VERIFIED](40459070511515) — there is no fourth and no "never", which is
    // achieved by not marking an event as a countdown at all.
    //
    // The reference puts this at Settings > Calendar [VERIFIED](45795554249371).
    // This screen has no Calendar section — Clock and Start week on, both
    // calendar settings, already live here — so it joins them rather than
    // moving shipped fields (divergence 5, R904).
    key: "showCountdowns",
    label: "Show Countdowns",
    options: [
      { value: "always", label: "Always" },
      { value: "three_months", label: "3 months prior to the event" },
      { value: "one_month", label: "1 month prior to the event" },
    ],
  },
];

export function HouseholdSection() {
  const { household, settings, actor, withActor } = useFamily();
  const disabled = actor?.role === "member";

  const { draft, set, toPatch } = useSettingsForm(household, settings);
  const { errors, message, status, pending, submit } = useSettingsSave();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const patch: HouseholdSettingsPatch = toPatch();
    await submit(() => withActor(() => updateHouseholdSettings(patch)));
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
          Show only the time in the top bar (hide the date)
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

        <SaveRow message={message} status={status} pending={pending} disabled={disabled} />
      </form>
    </section>
  );
}
