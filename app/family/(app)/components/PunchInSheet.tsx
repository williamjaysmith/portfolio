"use client";

import Link from "next/link";
import { useState } from "react";

import { punchIn } from "@/lib/family/actions/punch-in";
import type { ActionError, ActionResult } from "@/lib/family/errors";
import type { ActorSession, Category } from "@/lib/family/types";

import { Avatar } from "./Avatar";
import { PinPad } from "./PinPad";
import { callAction, useSessionRecovery } from "./action-client";
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

/** What one attempt leaves the sheet to do. */
type PinAttempt =
  | { status: "ok"; session: ActorSession }
  | { status: "signed-out"; result: ActionResult<ActorSession> }
  | { status: "refused"; message: string; locked: boolean };

/**
 * One attempt at the PIN, classified.
 *
 * `callAction` is what makes an unreachable house a refusal rather than a pad
 * left greyed out for good: the spec's offline edge case asks for a message,
 * not a sheet that has to be cancelled and reopened.
 */
async function attemptPunchIn(profileId: string, pin: string): Promise<PinAttempt> {
  const result = await callAction(() => punchIn(profileId, pin));
  if (result.ok) return { status: "ok", session: result.data };
  if (result.error === "NOT_AUTHENTICATED") return { status: "signed-out", result };
  return {
    status: "refused",
    message: REASON_COPY[result.error] ?? result.message,
    locked: result.error === "PIN_LOCKED",
  };
}

export interface PunchInSheetProps {
  open: boolean;
  profiles: Category[];
  avatarUrls: Record<string, string>;
  onResolve: (actor: ActorSession | null) => void;
}

export function PunchInSheet({ open, profiles, avatarUrls, onResolve }: PunchInSheetProps) {
  const dialogRef = useModalDialog(open);
  const [selected, setSelected] = useState<Category | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [wasOpen, setWasOpen] = useState(false);

  // Reset when the sheet is (re)opened, without an effect that would run a
  // frame late and briefly show the previous person's step.
  if (open && !wasOpen) {
    setWasOpen(true);
    setSelected(null);
    setNotice(null);
  } else if (!open && wasOpen) {
    setWasOpen(false);
  }

  const withPin = profiles.filter((profile) => profile.hasPin);

  function cancel(): void {
    onResolve(null);
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
          onResolve={onResolve}
          onBack={() => setSelected(null)}
        />
      ) : (
        <PickerStep
          profiles={profiles}
          withPin={withPin}
          avatarUrls={avatarUrls}
          notice={notice}
          onNotice={setNotice}
          onSelect={setSelected}
          onCancel={cancel}
        />
      )}
    </dialog>
  );
}

interface PinStepProps {
  profile: Category;
  photoUrl?: string;
  onResolve: (actor: ActorSession | null) => void;
  onBack: () => void;
}

/**
 * Step two: the chosen person proves it is them.
 *
 * The attempt lives here, not in the sheet, because this step is mounted
 * fresh for each person — going back or choosing somebody else is what clears
 * a wrong PIN, so there is no reset bookkeeping to keep in step.
 */
function PinStep({ profile, photoUrl, onResolve, onBack }: PinStepProps) {
  const signedOut = useSessionRecovery();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [locked, setLocked] = useState(false);
  const [resetKey, setResetKey] = useState(0);

  async function submit(pin: string): Promise<void> {
    setPending(true);
    setError(null);
    const attempt = await attemptPunchIn(profile.id, pin);
    setPending(false);

    if (attempt.status === "ok") {
      onResolve(attempt.session);
      return;
    }
    // No PIN can fix a signed-out session: the shell empties the cache and
    // leaves for sign-in, so the sheet just gets out of the way.
    if (attempt.status === "signed-out") {
      signedOut(attempt.result);
      onResolve(null);
      return;
    }
    setError(attempt.message);
    setLocked(attempt.locked);
    setResetKey((key) => key + 1);
  }

  return (
    <div className="mt-4 flex flex-col items-center gap-4">
      <Avatar category={profile} size={72} photoUrl={photoUrl} />
      <PinPad disabled={pending || locked} onComplete={submit} resetKey={resetKey} />
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
