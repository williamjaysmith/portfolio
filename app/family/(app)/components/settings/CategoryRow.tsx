"use client";

import { ChevronDown, ChevronUp } from "lucide-react";

import type { Category } from "@/lib/family/types";

import { Avatar } from "../Avatar";
import { PhotoUploadButton } from "./PhotoUploadButton";
import { PinRow } from "./PinRow";

/** One person or label in the Settings list, with everything you can do to it. */

export interface CategoryRowProps {
  category: Category;
  photoUrl?: string;
  isActor: boolean;
  disabled: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMove: (direction: -1 | 1) => void;
  onEdit: () => void;
  onDelete: () => void;
}

const ICON_BUTTON =
  "flex h-[44px] w-[44px] items-center justify-center rounded-full border border-(--fam-hairline) disabled:opacity-40";

export function CategoryRow({
  category,
  photoUrl,
  isActor,
  disabled,
  canMoveUp,
  canMoveDown,
  onMove,
  onEdit,
  onDelete,
}: CategoryRowProps) {
  return (
    <li className="flex flex-wrap items-center gap-3 rounded-(--fam-radius-card) border border-(--fam-hairline) p-3">
      <Avatar category={category} size={40} photoUrl={photoUrl} />
      <span className="text-(length:--fam-fs-body) font-medium">{category.label}</span>

      {category.isProfile ? (
        <span className="rounded-full bg-(--fam-pill-btn-bg) px-3 py-1 text-(length:--fam-fs-small) capitalize text-(--fam-text-muted)">
          {category.role}
        </span>
      ) : null}
      {isActor ? (
        <span className="text-(length:--fam-fs-small) text-(--fam-text-secondary)">You</span>
      ) : null}

      <div className="ml-auto flex flex-wrap items-center gap-2">
        <button
          type="button"
          aria-label={`Move ${category.label} up`}
          disabled={disabled || !canMoveUp}
          onClick={() => onMove(-1)}
          className={ICON_BUTTON}
        >
          <ChevronUp size={20} strokeWidth={1.5} aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label={`Move ${category.label} down`}
          disabled={disabled || !canMoveDown}
          onClick={() => onMove(1)}
          className={ICON_BUTTON}
        >
          <ChevronDown size={20} strokeWidth={1.5} aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label={`Edit ${category.label}`}
          disabled={disabled}
          onClick={onEdit}
          className="min-h-[44px] rounded-full border border-(--fam-hairline) px-4 text-(length:--fam-fs-small) font-medium disabled:opacity-50"
        >
          Edit
        </button>
        <button
          type="button"
          aria-label={`Delete ${category.label}`}
          disabled={disabled}
          onClick={onDelete}
          className="min-h-[44px] rounded-full px-3 text-(length:--fam-fs-small) font-medium text-(--fam-danger) disabled:opacity-50"
        >
          Delete
        </button>
      </div>

      {category.isProfile ? (
        <div className="flex w-full flex-wrap items-center gap-3 border-t border-(--fam-hairline) pt-3">
          <PinRow profile={category} />
          <PhotoUploadButton profile={category} disabled={disabled} />
        </div>
      ) : null}
    </li>
  );
}
