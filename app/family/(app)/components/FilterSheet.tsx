"use client";

import { EyeOff } from "lucide-react";
import { useRef, useState } from "react";

import { Avatar } from "./Avatar";
import { useFamily } from "./FamilyProvider";
import { useModalDialog } from "./useModalDialog";

/**
 * Show or hide individual profiles on THIS device (FR-033).
 *
 * Distinct from a profile's "Show on Tasks tab" setting, which is a household
 * choice stored in the database — this one is a per-device view preference and
 * needs no actor.
 */
export function FilterSheet() {
  const { profiles, hiddenIds, setHidden, showAll, avatarUrls, visibilityPersists } = useFamily();
  const [open, setOpen] = useState(false);
  const dialogRef = useModalDialog(open);
  const buttonRef = useRef<HTMLButtonElement>(null);

  function close(): void {
    setOpen(false);
    buttonRef.current?.focus();
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-[44px] items-center gap-2 rounded-full bg-(--fam-pill-btn-bg) px-4 text-(length:--fam-fs-pill) font-medium text-(--fam-text-muted)"
      >
        <EyeOff size={20} strokeWidth={1.5} aria-hidden="true" />
        Filter
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby="filter-title"
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
        className="m-auto w-[min(92vw,26rem)] rounded-(--fam-radius-modal) bg-(--fam-app-bg) p-6 text-(--fam-text-primary) backdrop:bg-black/30"
      >
        <h2 id="filter-title" className="font-(family-name:--fam-font-serif) text-(length:--fam-fs-title)">
          Show people
        </h2>

        <ul className="mt-4 flex flex-col gap-1">
          {profiles.map((profile) => (
            <li key={profile.id}>
              <label className="flex min-h-[44px] cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={!hiddenIds.has(profile.id)}
                  onChange={(event) => setHidden(profile.id, !event.target.checked)}
                  className="h-5 w-5"
                />
                <Avatar category={profile} size={32} photoUrl={avatarUrls[profile.id]} />
                <span className="text-(length:--fam-fs-body)">{profile.label}</span>
              </label>
            </li>
          ))}
        </ul>

        {visibilityPersists ? null : (
          <p className="mt-3 text-(length:--fam-fs-small) text-(--fam-text-secondary)">
            Filters won&rsquo;t be remembered on this device.
          </p>
        )}

        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={showAll}
            className="min-h-[44px] rounded-full border border-(--fam-hairline) px-5 text-(length:--fam-fs-body) font-medium"
          >
            Show all
          </button>
          <button
            type="button"
            onClick={close}
            className="min-h-[44px] rounded-full bg-(--fam-primary-blue) px-5 text-(length:--fam-fs-body) font-medium text-white"
          >
            Done
          </button>
        </div>
      </dialog>
    </>
  );
}
