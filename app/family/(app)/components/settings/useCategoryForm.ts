"use client";

import { useState } from "react";

import type { AvatarId } from "@/lib/family/avatars";
import { PALETTE, type PaletteColor } from "@/lib/family/colors";
import type { Category, CategoryInput, Role } from "@/lib/family/types";

/**
 * Draft state for the Profile/Label form.
 *
 * One state object rather than eight `useState` calls: the form is edited as a
 * whole and submitted as a whole, and it keeps the component itself down to
 * rendering.
 */

export interface CategoryDraft {
  label: string;
  color: PaletteColor;
  avatarId: AvatarId | null;
  /**
   * Whether the person actually used the avatar picker. An untouched draft
   * must not send an avatar at all: a profile whose avatar is an uploaded
   * PHOTO shows "no illustration" here, and submitting that as `null` would
   * silently delete the photo (constitution §VI — never lose the user's data).
   */
  avatarTouched: boolean;
  emoji: string;
  birthday: string;
  dietaryPrefs: string;
  role: Role;
  showOnTasks: boolean;
}

const BLANK_DRAFT: CategoryDraft = {
  label: "",
  color: PALETTE[0],
  avatarId: null,
  avatarTouched: false,
  emoji: "",
  birthday: "",
  dietaryPrefs: "",
  role: "member",
  showOnTasks: true,
};

/** An illustration key only survives when the row actually uses one. */
function illustrationOf(existing: Category): AvatarId | null {
  if (existing.avatarKind !== "illustration") return null;
  return (existing.avatarId as AvatarId | null) ?? null;
}

function draftOf(existing: Category): CategoryDraft {
  return {
    label: existing.label,
    color: existing.color,
    avatarId: illustrationOf(existing),
    avatarTouched: false,
    emoji: existing.emoji ?? "",
    birthday: existing.birthday ?? "",
    dietaryPrefs: existing.dietaryPrefs ?? "",
    role: existing.role,
    showOnTasks: existing.showOnTasks,
  };
}

function initialDraft(existing: Category | undefined, forceParent: boolean): CategoryDraft {
  const base = existing ? draftOf(existing) : BLANK_DRAFT;
  return forceParent ? { ...base, role: "parent" } : base;
}

export interface CategoryFormState {
  draft: CategoryDraft;
  set: <K extends keyof CategoryDraft>(key: K, value: CategoryDraft[K]) => void;
}

export function useCategoryForm(
  existing: Category | undefined,
  forceParent: boolean,
): CategoryFormState {
  const [draft, setDraft] = useState<CategoryDraft>(() => initialDraft(existing, forceParent));

  function set<K extends keyof CategoryDraft>(key: K, value: CategoryDraft[K]): void {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  return { draft, set };
}

/** Blank optional text means "not set", which the database stores as NULL. */
function orNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * `undefined` leaves every avatar column alone; `null` clears them. Only an
 * actual interaction with the picker may clear.
 */
function avatarOf(draft: CategoryDraft): CategoryInput["avatar"] {
  if (draft.avatarId) return { kind: "illustration", id: draft.avatarId };
  return draft.avatarTouched ? null : undefined;
}

function profileInput(draft: CategoryDraft): Omit<CategoryInput, "isProfile"> {
  return {
    label: draft.label,
    color: draft.color,
    avatar: avatarOf(draft),
    emoji: null,
    birthday: orNull(draft.birthday),
    dietaryPrefs: orNull(draft.dietaryPrefs),
    role: draft.role,
    showOnTasks: draft.showOnTasks,
  };
}

function labelInput(draft: CategoryDraft): Omit<CategoryInput, "isProfile"> {
  return {
    label: draft.label,
    color: draft.color,
    avatar: null,
    emoji: orNull(draft.emoji),
    birthday: null,
    dietaryPrefs: null,
    role: "member",
    showOnTasks: draft.showOnTasks,
  };
}

/**
 * The draft as the action expects it: fields belonging to the other kind are
 * dropped rather than sent as blanks, because Profiles and Labels share one
 * record type and the database refuses a mix.
 */
export function draftToInput(
  draft: CategoryDraft,
  isProfile: boolean,
): Omit<CategoryInput, "isProfile"> {
  return isProfile ? profileInput(draft) : labelInput(draft);
}
