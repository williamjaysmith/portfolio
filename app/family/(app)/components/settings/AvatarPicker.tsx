"use client";

import Image from "next/image";

import { AVATAR_IDS, AVATAR_LABELS, avatarSrc, type AvatarId } from "@/lib/family/avatars";

/**
 * Choose an illustrated avatar, or none — in which case the profile shows its
 * initials on its own colour, the reference product's default (FR-022).
 *
 * Photo upload lives on the profile row in the list, not here, because it
 * needs a saved profile id to store against.
 *
 * "No avatar" is the group's first option rather than a control beside it, so
 * the whole picker is one tab stop with the arrows moving between the faces
 * (SC-009) — see ColorPicker, which follows the same radio-group pattern.
 */

const OPTIONS: readonly (AvatarId | null)[] = [null, ...AVATAR_IDS];

const NO_AVATAR_CLASSES =
  "border border-(--fam-hairline) text-(length:--fam-fs-small) text-(--fam-text-secondary)";

function nameOf(option: AvatarId | null): string {
  return option === null ? "No avatar — use initials" : AVATAR_LABELS[option];
}

/** Where an arrow, Home or End moves the choice; null for a key we do not own. */
function stepTo(key: string, from: number): number | null {
  const count = OPTIONS.length;
  if (key === "ArrowRight" || key === "ArrowDown") return (from + 1) % count;
  if (key === "ArrowLeft" || key === "ArrowUp") return (from - 1 + count) % count;
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  return null;
}

export interface AvatarPickerProps {
  value: AvatarId | null;
  onChange: (value: AvatarId | null) => void;
}

export function AvatarPicker({ value, onChange }: AvatarPickerProps) {
  const tabStop = Math.max(OPTIONS.indexOf(value), 0);

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>): void {
    const target = stepTo(event.key, tabStop);
    if (target === null) return;

    event.preventDefault();
    onChange(OPTIONS[target]);
    event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]')[target]?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-label="Avatar"
      onKeyDown={handleKeyDown}
      className="flex flex-wrap gap-2"
    >
      {OPTIONS.map((option, index) => (
        <button
          key={option ?? "none"}
          type="button"
          role="radio"
          aria-checked={option === value}
          aria-label={nameOf(option)}
          tabIndex={index === tabStop ? 0 : -1}
          onClick={() => onChange(option)}
          className={`flex h-[56px] w-[56px] items-center justify-center rounded-full ${
            option === null ? NO_AVATAR_CLASSES : ""
          } ${option === value ? "ring-2 ring-(--fam-text-primary) ring-offset-2" : ""}`}
        >
          {option === null ? (
            "Aa"
          ) : (
            <Image src={avatarSrc(option)} alt="" width={48} height={48} unoptimized aria-hidden="true" />
          )}
        </button>
      ))}
    </div>
  );
}
