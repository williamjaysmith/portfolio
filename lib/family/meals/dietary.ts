import type { Category } from "../types";

/**
 * The dietary notes shown while planning (006 FR-638; Phase 1 FR-024): every
 * Profile with a non-blank note, in the household's order, as "Name: note".
 * Labels never carry one.
 */

export interface DietaryNote {
  name: string;
  note: string;
}

export function dietaryNotesOf(profiles: readonly Pick<Category, "label" | "isProfile" | "dietaryPrefs">[]): DietaryNote[] {
  const notes: DietaryNote[] = [];
  for (const profile of profiles) {
    if (!profile.isProfile) continue;
    const note = profile.dietaryPrefs?.trim() ?? "";
    if (note.length > 0) notes.push({ name: profile.label, note });
  }
  return notes;
}
