"use client";

import { useState } from "react";

import { updateHouseholdSettings } from "@/lib/family/actions/settings";
import type { HouseholdSettingsPatch } from "@/lib/family/types";

import { useFamily } from "../FamilyProvider";
import { FieldError } from "./CategoryFields";
import { LeadTimeField } from "./LeadTimeField";
import { useReminderSwitches } from "../notifications/reminderSwitches";
import { SaveRow } from "./SaveRow";
import { useSettingsSave } from "./useSettingsSave";
import { SectionHeading } from "./SectionHeading";

/**
 * The household's reminder choices (008 FR-802–FR-807).
 *
 * Two groups and exactly four choices, which is what Skylight's own Settings
 * screen has [VERIFIED](45795554249371): Calendar Notifications with "At time
 * of event" and "Before event", and Task Notifications with "When Due" and
 * "When Completed".
 *
 * The choices belong to the HOUSEHOLD, never to a person. Every documented
 * reminder in the reference is an unaddressed pop-up on a shared display
 * [VERIFIED](36836043247131), and this project knows who somebody is only while
 * they are punched in (spec Assumption 2).
 *
 * Like every other settings section: readable by anyone signed in, saved only
 * by a parent, and the controls are disabled rather than hidden so the reason
 * is visible instead of mysterious. The server enforces it regardless.
 */

interface SwitchRow {
  key: keyof Draft;
  label: string;
}

interface Draft {
  notifyEventAtTime: boolean;
  notifyEventBefore: boolean;
  notifyEventBeforeMinutes: number;
  notifyTaskDue: boolean;
  notifyTaskCompleted: boolean;
}

const CALENDAR_SWITCHES: SwitchRow[] = [
  { key: "notifyEventAtTime", label: "At time of event" },
  { key: "notifyEventBefore", label: "Before event" },
];

const TASK_SWITCHES: SwitchRow[] = [
  { key: "notifyTaskDue", label: "When Due" },
  { key: "notifyTaskCompleted", label: "When Completed" },
];

export function NotificationsSection() {
  const { settings, actor, withActor } = useFamily();
  const disabled = actor?.role === "member";
  const device = useReminderSwitches();

  const [draft, setDraft] = useState<Draft>(() => ({
    notifyEventAtTime: settings.notifyEventAtTime,
    notifyEventBefore: settings.notifyEventBefore,
    notifyEventBeforeMinutes: settings.notifyEventBeforeMinutes,
    notifyTaskDue: settings.notifyTaskDue,
    notifyTaskCompleted: settings.notifyTaskCompleted,
  }));
  const { errors, message, status, pending, submit } = useSettingsSave();

  function set<K extends keyof Draft>(key: K, value: Draft[K]): void {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const patch: HouseholdSettingsPatch = { ...draft };
    await submit(() => withActor(() => updateHouseholdSettings(patch)));
  }

  function switchRow(row: SwitchRow) {
    return (
      <label
        key={row.key}
        className="flex min-h-[44px] items-center gap-3 text-(length:--fam-fs-body)"
      >
        <input
          type="checkbox"
          role="switch"
          checked={draft[row.key] as boolean}
          disabled={disabled}
          onChange={(event) => set(row.key, event.target.checked as never)}
          className="h-5 w-5"
        />
        {row.label}
      </label>
    );
  }

  return (
    <section aria-labelledby="notifications-heading" className="flex flex-col gap-4">
      <SectionHeading id="notifications-heading">Notifications</SectionHeading>

      {/*
        Assumption 15, said out loud in the product and not only in the spec. A
        household that is not told will assume its phones buzz, and then quietly
        stop trusting the feature when they do not.
      */}
      <p className="text-(length:--fam-fs-small) text-(--fam-text-secondary)">
        Reminders appear on screens that have this app open. Nothing is sent to a phone that is put away.
      </p>

      {disabled ? (
        <p className="text-(length:--fam-fs-small) text-(--fam-text-secondary)">Parents only</p>
      ) : null}

      <form onSubmit={handleSubmit} className="flex max-w-lg flex-col gap-6">
        <fieldset className="flex flex-col gap-2 border-0 p-0">
          <legend className="text-(length:--fam-fs-small) text-(--fam-text-muted)">Calendar</legend>
          {CALENDAR_SWITCHES.map(switchRow)}
          {draft.notifyEventBefore ? (
            <LeadTimeField
              minutes={draft.notifyEventBeforeMinutes}
              disabled={disabled}
              onChange={(minutes) => set("notifyEventBeforeMinutes", minutes)}
            />
          ) : null}
          <FieldError messages={errors.notifyEventBeforeMinutes} />
        </fieldset>

        <fieldset className="flex flex-col gap-2 border-0 p-0">
          <legend className="text-(length:--fam-fs-small) text-(--fam-text-muted)">Tasks</legend>
          {TASK_SWITCHES.map(switchRow)}
        </fieldset>

        <SaveRow message={message} status={status} pending={pending} disabled={disabled} />
      </form>

      {/*
        Outside the form, and deliberately: these two belong to THIS device and
        are saved the instant they are flipped. Nothing about them reaches the
        household, so they need no parent, no Save button and no permission from
        the browser — a banner is a DOM element on a page somebody has open
        (FR-815).
      */}
      <fieldset className="flex max-w-lg flex-col gap-2 border-0 p-0">
        <legend className="text-(length:--fam-fs-small) text-(--fam-text-muted)">This device</legend>
        <label className="flex min-h-[44px] items-center gap-3 text-(length:--fam-fs-body)">
          <input
            type="checkbox"
            role="switch"
            checked={device.switches.banner}
            onChange={(event) => device.setSwitch("banner", event.target.checked)}
            className="h-5 w-5"
          />
          Show reminders on this screen
        </label>
        <label className="flex min-h-[44px] items-center gap-3 text-(length:--fam-fs-body)">
          <input
            type="checkbox"
            role="switch"
            checked={device.switches.chime}
            onChange={(event) => device.setSwitch("chime", event.target.checked)}
            className="h-5 w-5"
          />
          Play a sound with them
        </label>
        {device.persistent ? null : (
          <p className="text-(length:--fam-fs-small) text-(--fam-text-secondary)">
            This device can&apos;t remember these two, so they last until you close the app.
          </p>
        )}
      </fieldset>

    </section>
  );
}
