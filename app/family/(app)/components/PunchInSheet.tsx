"use client";

import Link from "next/link";
import { useState } from "react";

import { punchIn } from "@/lib/family/actions/punch-in";
import type { ActionError } from "@/lib/family/errors";
import type { ActorSession, Category } from "@/lib/family/types";

import { Avatar } from "./Avatar";
import { PinPad } from "./PinPad";
import { useModalDialog } from "./useModalDialog";

/**
 * "Who's here?" — the punch-in picker (US2).
 *
 * Nothing here reveals how close a wrong guess was, how many attempts remain,
 * or whether a profile exists to someone who should not know: the server
 * answers with one of a fixed set of reasons and this only maps those to copy.
 */

const REASON_COPY: Partial<Record<ActionError, string>> = {
  BAD_PIN: "That PIN isn't right.",
  PIN_LOCKED: "Too many tries. Try again in a few minutes.",
  NO_PIN: "That profile doesn't have a PIN yet.",
  NOT_FOUND: "That profile isn't available.",
  UNAVAILABLE: "Can't reach the house right now.",
};

export interface PunchInSheetProps {
  open: boolean;
  profiles: Category[];
  avatarUrls: Record<string, string>;
  onResolve: (actor: ActorSession | null) => void;
}

export function PunchInSheet({ open, profiles, avatarUrls, onResolve }: PunchInSheetProps) {
  const dialogRef = useModalDialog(open);
  const [selected, setSelected] = useState<Category | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [locked, setLocked] = useState(false);
  const [wasOpen, setWasOpen] = useState(false);

  // Reset when the sheet is (re)opened, without an effect that would run a
  // frame late and briefly show the previous person's step.
  if (open && !wasOpen) {
    setWasOpen(true);
    setSelected(null);
    setError(null);
    setNotice(null);
    setPending(false);
    setLocked(false);
  } else if (!open && wasOpen) {
    setWasOpen(false);
  }

  const withPin = profiles.filter((profile) => profile.hasPin);

  function cancel(): void {
    onResolve(null);
  }

  async function submit(pin: string): Promise<void> {
    if (!selected) return;
    setPending(true);
    setError(null);
    const result = await punchIn(selected.id, pin);
    setPending(false);

    if (result.ok) {
      onResolve(result.data);
      return;
    }
    setError(REASON_COPY[result.error] ?? result.message);
    setLocked(result.error === "PIN_LOCKED");
    setResetKey((key) => key + 1);
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="punch-in-title"
      onCancel={(event) => {
        event.preventDefault();
        cancel();
      }}
      className="m-auto w-[min(92vw,32rem)] rounded-(--fam-radius-modal) bg-(--fam-app-bg) p-6 text-(--fam-text-primary) backdrop:bg-black/30"
    >
      <h2
        id="punch-in-title"
        className="font-(family-name:--fam-font-serif) text-(length:--fam-fs-title)"
      >
        {selected ? selected.label : "Who's here?"}
      </h2>

      {selected ? (
        <PinStep
          profile={selected}
          photoUrl={avatarUrls[selected.id]}
          disabled={pending || locked}
          error={error}
          resetKey={resetKey}
          onComplete={submit}
          onBack={() => {
            setSelected(null);
            setError(null);
            setLocked(false);
          }}
        />
      ) : (
        <PickerStep
          profiles={profiles}
          withPin={withPin}
          avatarUrls={avatarUrls}
          notice={notice}
          onNotice={setNotice}
          onSelect={(profile) => {
            setSelected(profile);
            setError(null);
            setResetKey((key) => key + 1);
          }}
          onCancel={cancel}
        />
      )}
    </dialog>
  );
}

interface PinStepProps {
  profile: Category;
  photoUrl?: string;
  disabled: boolean;
  error: string | null;
  resetKey: number;
  onComplete: (pin: string) => void;
  onBack: () => void;
}

/** Step two: the chosen person proves it is them. */
function PinStep({ profile, photoUrl, disabled, error, resetKey, onComplete, onBack }: PinStepProps) {
  return (
    <div className="mt-4 flex flex-col items-center gap-4">
      <Avatar category={profile} size={72} photoUrl={photoUrl} />
      <PinPad disabled={disabled} onComplete={onComplete} resetKey={resetKey} />
      <p role="alert" className="min-h-[1.5em] text-(length:--fam-fs-body)">
        {error}
      </p>
      <button
        type="button"
        onClick={onBack}
        className="min-h-[44px] rounded-full px-6 text-(length:--fam-fs-body) font-medium text-(--fam-text-secondary)"
      >
        Back
      </button>
    </div>
  );
}

interface PickerStepProps {
  profiles: Category[];
  withPin: Category[];
  avatarUrls: Record<string, string>;
  notice: string | null;
  onNotice: (notice: string) => void;
  onSelect: (profile: Category) => void;
  onCancel: () => void;
}

function PickerStep({
  profiles,
  withPin,
  avatarUrls,
  notice,
  onNotice,
  onSelect,
  onCancel,
}: PickerStepProps) {
  if (profiles.length === 0) {
    return (
      <EmptyState
        message="Nobody's set up yet."
        actionLabel="Set up the family"
        onCancel={onCancel}
      />
    );
  }

  return (
    <div className="mt-4 flex flex-col gap-4">
      <ul className="flex flex-wrap justify-center gap-4">
        {profiles.map((profile) => {
          const selectable = profile.hasPin;
          return (
            <li key={profile.id}>
              <button
                type="button"
                // Spec US2-9: a PIN-less profile is shown but cannot be chosen —
                // hiding it would make the family look incomplete.
                aria-disabled={!selectable}
                onClick={() =>
                  selectable ? onSelect(profile) : onNotice(`${profile.label} doesn't have a PIN yet.`)
                }
                className={`flex min-h-[44px] w-24 flex-col items-center gap-2 rounded-2xl p-2 ${
                  selectable ? "" : "opacity-40"
                }`}
              >
                <Avatar category={profile} size={64} photoUrl={avatarUrls[profile.id]} />
                <span className="text-(length:--fam-fs-body) font-medium">{profile.label}</span>
                {selectable ? null : <span className="sr-only">no PIN</span>}
              </button>
            </li>
          );
        })}
      </ul>

      {withPin.length === 0 ? (
        <p className="text-center text-(length:--fam-fs-body) text-(--fam-text-secondary)">
          No one has a PIN yet. A parent can set one in Settings.
        </p>
      ) : null}

      <p role="status" className="min-h-[1.5em] text-center text-(length:--fam-fs-small)">
        {notice}
      </p>

      <div className="flex justify-center gap-3">
        {withPin.length === 0 ? (
          <Link
            href="/family/settings"
            onClick={onCancel}
            className="flex min-h-[44px] items-center rounded-full bg-(--fam-primary-blue) px-6 text-(length:--fam-fs-body) font-medium text-white"
          >
            Go to Settings
          </Link>
        ) : null}
        <button
          type="button"
          onClick={onCancel}
          className="min-h-[44px] rounded-full border border-(--fam-hairline) px-6 text-(length:--fam-fs-body) font-medium"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function EmptyState({
  message,
  actionLabel,
  onCancel,
}: {
  message: string;
  actionLabel: string;
  onCancel: () => void;
}) {
  return (
    <div className="mt-4 flex flex-col items-center gap-4">
      <p className="text-(length:--fam-fs-body) text-(--fam-text-secondary)">{message}</p>
      <Link
        href="/family/settings"
        onClick={onCancel}
        className="flex min-h-[44px] items-center rounded-full bg-(--fam-primary-blue) px-6 text-(length:--fam-fs-body) font-medium text-white"
      >
        {actionLabel}
      </Link>
      <button
        type="button"
        onClick={onCancel}
        className="min-h-[44px] rounded-full border border-(--fam-hairline) px-6 text-(length:--fam-fs-body) font-medium"
      >
        Cancel
      </button>
    </div>
  );
}
