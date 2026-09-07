"use client";

import { MAX_LEAD_MINUTES } from "@/lib/family/notifications/settings";
import type { EventReminder } from "@/lib/family/types";

import { FIELD, LABEL } from "../../components/settings/CategoryFields";

/**
 * This event's own reminder (008 FR-808, R809).
 *
 * Skylight verifies two levels — a calendar-wide default and a per-event
 * reminder that OVERRIDES it [VERIFIED](32083277890075) — so this control has
 * exactly three states and no fourth:
 *
 *   **The household's setting** is the default, and the one almost every event
 *   keeps. It follows Settings as it changes.
 *   **No reminder** is deliberate silence. It exists because absence already
 *   means inherit, so quiet needs a name of its own — nothing in the reference
 *   addresses this, and spec Assumption 4 owns the decision.
 *   **Its own** is at-the-time, a lead time, or both.
 *
 * Whether several reminders can stack on one event is [UNKNOWN] in every
 * fetched source, so an event carries one setting rather than a list.
 */

const MODES = [
  { value: "inherit", label: "The household's setting" },
  { value: "none", label: "No reminder" },
  { value: "custom", label: "Its own" },
] as const;

export interface ReminderFieldsetProps {
  value: EventReminder;
  onChange: (reminder: EventReminder) => void;
}

/** The minutes shown when somebody first opens "Its own" — the household's own default. */
const DEFAULT_LEAD = 10;

function customFrom(previous: EventReminder): EventReminder {
  if (previous.mode === "custom") return previous;
  return { mode: "custom", atTime: false, beforeMinutes: DEFAULT_LEAD };
}

export function ReminderFieldset({ value, onChange }: ReminderFieldsetProps) {
  const custom = value.mode === "custom" ? value : null;
  const tooLong = custom?.beforeMinutes !== null && (custom?.beforeMinutes ?? 0) > MAX_LEAD_MINUTES;

  function chooseMode(mode: string): void {
    if (mode === "custom") return onChange(customFrom(value));
    onChange(mode === "none" ? { mode: "none" } : { mode: "inherit" });
  }

  function setAtTime(atTime: boolean): void {
    if (!custom) return;
    onChange({ ...custom, atTime });
  }

  function setBefore(minutes: number | null): void {
    if (!custom) return;
    onChange({ ...custom, beforeMinutes: minutes });
  }

  return (
    <fieldset className="flex flex-col gap-2 border-0 p-0">
      <legend className="text-(length:--fam-fs-small) text-(--fam-text-muted)">Reminder</legend>

      <label className={LABEL}>
        <span className="sr-only">Reminder</span>
        <select value={value.mode} onChange={(e) => chooseMode(e.target.value)} className={FIELD}>
          {MODES.map((mode) => (
            <option key={mode.value} value={mode.value}>
              {mode.label}
            </option>
          ))}
        </select>
      </label>

      {custom ? (
        <div className="flex flex-col gap-2">
          <label className="flex min-h-[44px] items-center gap-3 text-(length:--fam-fs-body)">
            <input
              type="checkbox"
              role="switch"
              checked={custom.atTime}
              onChange={(e) => setAtTime(e.target.checked)}
              className="h-5 w-5"
            />
            As it starts
          </label>

          <label className="flex min-h-[44px] items-center gap-3 text-(length:--fam-fs-body)">
            <input
              type="checkbox"
              role="switch"
              checked={custom.beforeMinutes !== null}
              onChange={(e) => setBefore(e.target.checked ? DEFAULT_LEAD : null)}
              className="h-5 w-5"
            />
            Before it starts
          </label>

          {custom.beforeMinutes !== null ? (
            <label className={LABEL}>
              Minutes before
              <input
                type="number"
                min={1}
                max={MAX_LEAD_MINUTES}
                value={custom.beforeMinutes}
                onChange={(e) => setBefore(Number(e.target.value))}
                className={FIELD}
              />
            </label>
          ) : null}

          {/* A custom that carries neither half is just "No reminder" written
              badly — the action refuses it and so does the database, but saying
              so here is cheaper than a round trip. */}
          {!custom.atTime && custom.beforeMinutes === null ? (
            <p role="alert" className="text-(length:--fam-fs-small) text-(--fam-danger)">
              Choose when it reminds, or choose No reminder.
            </p>
          ) : null}

          {tooLong ? (
            <p role="alert" className="text-(length:--fam-fs-small) text-(--fam-danger)">
              A lead time cannot be more than 7 days.
            </p>
          ) : null}
        </div>
      ) : null}
    </fieldset>
  );
}
