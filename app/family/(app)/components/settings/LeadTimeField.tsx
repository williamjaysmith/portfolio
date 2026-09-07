"use client";

import { useState } from "react";

import { MAX_LEAD_MINUTES } from "@/lib/family/notifications/settings";

import { FIELD, LABEL } from "./CategoryFields";

/**
 * How far ahead of an event its reminder fires (008 FR-806, R810).
 *
 * Skylight documents this control twice and incompatibly: one rendering is a
 * free 1–120 minute field [VERIFIED](36836043247131), another is quick presets
 * plus a Custom option with a Minutes / Hours / Days picker
 * [VERIFIED](45795554249371). The dossier declines to reconcile them and the
 * master map already chose presets plus custom, which is what this is.
 *
 * THE VALUE IS ALWAYS MINUTES. The unit picker is a control, not a storage
 * format — "2 hours" leaves here as 120 — so every comparison downstream is in
 * one unit and the seven-day ceiling is a single integer bound.
 */

const PRESETS = [10, 30, 60] as const;

const UNITS = [
  { value: "minutes", label: "Minutes", factor: 1 },
  { value: "hours", label: "Hours", factor: 60 },
  { value: "days", label: "Days", factor: 60 * 24 },
] as const;

type UnitValue = (typeof UNITS)[number]["value"];

function labelForPreset(minutes: number): string {
  return minutes === 60 ? "1 hour" : `${minutes} minutes`;
}

/** The largest unit that divides the value cleanly, so 120 reads as "2 hours". */
function unitFor(minutes: number): UnitValue {
  if (minutes > 0 && minutes % (60 * 24) === 0) return "days";
  if (minutes > 0 && minutes % 60 === 0) return "hours";
  return "minutes";
}

function factorOf(unit: UnitValue): number {
  return UNITS.find((entry) => entry.value === unit)?.factor ?? 1;
}

export interface LeadTimeFieldProps {
  /** Always minutes. */
  minutes: number;
  onChange: (minutes: number) => void;
  disabled?: boolean;
}

export function LeadTimeField({ minutes, onChange, disabled }: LeadTimeFieldProps) {
  const matchesPreset = (PRESETS as readonly number[]).includes(minutes);
  // Whether the household has opened the custom controls. Seeded from the
  // stored value, then owned by the person: choosing Custom and typing 30
  // should not snap the control back to the preset.
  const [custom, setCustom] = useState(!matchesPreset);
  const [unit, setUnit] = useState<UnitValue>(() => unitFor(minutes));

  const amount = Math.max(1, Math.round(minutes / factorOf(unit)));
  const tooLong = minutes > MAX_LEAD_MINUTES;

  function chooseShape(value: string): void {
    if (value === "custom") {
      setCustom(true);
      return;
    }
    setCustom(false);
    onChange(Number(value));
  }

  function chooseUnit(next: UnitValue): void {
    setUnit(next);
    // The number the person typed is kept and re-read in the new unit, which is
    // predictable; converting it would round 90 minutes into "2 hours".
    onChange(amount * factorOf(next));
  }

  return (
    <div className="flex flex-col gap-2">
      <label className={LABEL}>
        Before event
        <select
          value={custom ? "custom" : String(minutes)}
          disabled={disabled}
          onChange={(event) => chooseShape(event.target.value)}
          className={FIELD}
        >
          {PRESETS.map((preset) => (
            <option key={preset} value={String(preset)}>
              {labelForPreset(preset)}
            </option>
          ))}
          <option value="custom">Custom</option>
        </select>
      </label>

      {custom ? (
        <div className="flex gap-2">
          <label className={`${LABEL} flex-1`}>
            How long
            <input
              type="number"
              min={1}
              value={amount}
              disabled={disabled}
              onChange={(event) => onChange(Number(event.target.value) * factorOf(unit))}
              className={FIELD}
            />
          </label>
          <label className={`${LABEL} flex-1`}>
            Unit
            <select
              value={unit}
              disabled={disabled}
              onChange={(event) => chooseUnit(event.target.value as UnitValue)}
              className={FIELD}
            >
              {UNITS.map((entry) => (
                <option key={entry.value} value={entry.value}>
                  {entry.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      {tooLong ? (
        <p role="alert" className="text-(length:--fam-fs-small) text-(--fam-danger)">
          A lead time cannot be more than 7 days.
        </p>
      ) : null}
    </div>
  );
}
