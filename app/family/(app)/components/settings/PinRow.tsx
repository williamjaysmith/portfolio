"use client";

import { useState } from "react";

import { clearProfilePin, setProfilePin } from "@/lib/family/actions/pins";
import type { Category } from "@/lib/family/types";

import { useFamily } from "../FamilyProvider";

/**
 * Setting and clearing a profile's PIN (FR-018, SC-010).
 *
 * `setProfilePin` is called DIRECTLY, not through `withActor`: requiring a
 * punch-in to set the first PIN would leave a household where nobody has one
 * permanently read-only. It is still refused for a punched-in member, so a
 * child cannot take over a parent's profile.
 */

// `--fam-control-border`, not the hairline: an empty PIN box is nothing but
// its outline, and WCAG 1.4.11 wants 3:1 for that (the hairline is 1.17:1).
const PIN_INPUT =
  "min-h-[44px] w-24 rounded-xl border border-(--fam-control-border) bg-(--fam-app-bg) px-3 text-center text-(length:--fam-fs-body) tracking-[0.4em]";

export interface PinRowProps {
  profile: Category;
}

export function PinRow({ profile }: PinRowProps) {
  const { actor, withActor, refresh } = useFamily();
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // A punched-in child may not touch PINs at all (FR-015).
  const blocked = actor?.role === "member";

  async function save(pin: string): Promise<void> {
    setPending(true);
    setError(null);
    const result = await setProfilePin(profile.id, pin);
    setPending(false);

    if (result.ok) {
      setEditing(false);
      setStatus("PIN set");
      // This path deliberately bypasses `withActor` (FR-018), so nothing else
      // refetches: without this the picker still shows the profile as PIN-less.
      refresh();
      return;
    }
    setError(result.message);
  }

  async function remove(): Promise<void> {
    setPending(true);
    setError(null);
    const result = await withActor(() => clearProfilePin(profile.id));
    setPending(false);
    if (result.ok) {
      setStatus("PIN removed");
      refresh();
    } else {
      setError(result.message);
    }
  }

  if (editing) {
    return (
      <PinEditor
        pending={pending}
        error={error}
        onSave={save}
        onCancel={() => {
          setEditing(false);
          setError(null);
        }}
      />
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={blocked}
        onClick={() => {
          setEditing(true);
          setStatus(null);
        }}
        className="min-h-[44px] rounded-full border border-(--fam-hairline) px-4 text-(length:--fam-fs-small) font-medium disabled:opacity-50"
      >
        {profile.hasPin ? "Reset PIN" : "Set PIN"}
      </button>

      {profile.hasPin ? (
        <button
          type="button"
          disabled={blocked || pending}
          onClick={() => void remove()}
          className="min-h-[44px] rounded-full px-3 text-(length:--fam-fs-small) font-medium text-(--fam-text-secondary) disabled:opacity-50"
        >
          Remove PIN
        </button>
      ) : null}

      {blocked ? (
        <span className="text-(length:--fam-fs-small) text-(--fam-text-secondary)">Parents only</span>
      ) : null}

      <span role="status" className="text-(length:--fam-fs-small) text-(--fam-text-secondary)">
        {status}
      </span>
      {error ? (
        <span role="alert" className="text-(length:--fam-fs-small) text-(--fam-danger)">
          {error}
        </span>
      ) : null}
    </div>
  );
}

interface PinEditorProps {
  pending: boolean;
  error: string | null;
  onSave: (pin: string) => void;
  onCancel: () => void;
}

/** Entering a PIN twice, because a mistyped PIN locks someone out of acting. */
function PinEditor({ pending, error, onSave, onCancel }: PinEditorProps) {
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [mismatch, setMismatch] = useState(false);

  const digitsOnly = (value: string) => value.replace(/\D/g, "");

  function submit(): void {
    if (pin !== confirmPin) {
      setMismatch(true);
      return;
    }
    setMismatch(false);
    onSave(pin);
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-(length:--fam-fs-small) text-(--fam-text-muted)">
        New PIN
        <input
          type="password"
          inputMode="numeric"
          pattern="[0-9]{4}"
          maxLength={4}
          value={pin}
          onChange={(event) => setPin(digitsOnly(event.target.value))}
          className={PIN_INPUT}
        />
      </label>
      <label className="flex flex-col gap-1 text-(length:--fam-fs-small) text-(--fam-text-muted)">
        Confirm
        <input
          type="password"
          inputMode="numeric"
          pattern="[0-9]{4}"
          maxLength={4}
          value={confirmPin}
          onChange={(event) => setConfirmPin(digitsOnly(event.target.value))}
          className={PIN_INPUT}
        />
      </label>
      <button
        type="button"
        onClick={submit}
        disabled={pending || pin.length !== 4}
        className="min-h-[44px] rounded-full bg-(--fam-primary-blue) px-5 text-(length:--fam-fs-body) font-medium text-white disabled:opacity-60"
      >
        Save
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="min-h-[44px] rounded-full px-4 text-(length:--fam-fs-body) font-medium text-(--fam-text-secondary)"
      >
        Cancel
      </button>
      {mismatch || error ? (
        <p role="alert" className="w-full text-(length:--fam-fs-small) text-(--fam-danger)">
          {mismatch ? "Those PINs don't match." : error}
        </p>
      ) : null}
    </div>
  );
}
