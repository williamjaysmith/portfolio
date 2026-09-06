"use client";

import type { CSSProperties } from "react";

import { profileVars } from "@/lib/family/colors";
import { dayWordsOf } from "@/lib/family/meals/week";
import type { MealCategory, MealOccurrence } from "@/lib/family/types";

import { FormDialog } from "../../components/FormDialog";

/**
 * A planned meal's popover (006 FR-625, FR-626; 41418036777371 — "'Open
 * Recipe'… 'Add to List'… 'Edit,' and 'Delete'"; pdp/07 — the title, the
 * pills, the date, the category dot): the recipe's name, the day and the
 * mealtime as a coloured dot, the note, and the four actions — plus **Add
 * another meal**, the keyboard's path to what a press-and-hold on the cell does
 * (FR-623, FR-646). Opened from a chip on the grid and from a token on the
 * calendar alike (R611).
 */

export interface MealPopoverProps {
  occurrence: MealOccurrence;
  recipeName: string;
  category: MealCategory;
  /** FR-642: one of this meal's writes is in flight. */
  busy: boolean;
  onOpenRecipe: () => void;
  onAddToList: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAddAnother: () => void;
  onClose: () => void;
}

const ACTION =
  "flex min-h-(--fam-touch) items-center rounded-full bg-(--fam-btn-secondary-bg) px-4 text-(length:--fam-fs-body) " +
  "font-medium disabled:opacity-50";

export function MealPopover({ occurrence, recipeName, category, busy, onOpenRecipe, onAddToList, onEdit, onDelete, onAddAnother, onClose }: MealPopoverProps) {
  return (
    <FormDialog
      titleId="meal-popover-title"
      title={recipeName}
      onClose={onClose}
      widthClassName="w-[min(92vw,var(--fam-meal-popover-w))]"
      subtitle={
        <p className="mt-1 flex items-center gap-2 text-(length:--fam-fs-body) text-(--fam-text-secondary)">
          <span>{dayWordsOf(occurrence.date)}</span>
          <span aria-hidden="true">·</span>
          <span aria-hidden="true" style={profileVars(category.color) as CSSProperties} className="fam-profile size-3 rounded-full bg-(--fam-profile-100)" />
          <span>{category.name}</span>
          {occurrence.isRepeating ? <span className="text-(length:--fam-fs-small) text-(--fam-text-muted)">· repeats</span> : null}
        </p>
      }
    >
      {occurrence.note === null ? null : <p className="mt-3 text-(length:--fam-fs-body)">{occurrence.note}</p>}
      <div className="mt-5 flex flex-wrap gap-2">
        <button type="button" onClick={onOpenRecipe} className={ACTION}>
          Open Recipe
        </button>
        <button type="button" onClick={onAddToList} className={ACTION}>
          Add to List
        </button>
        <button type="button" onClick={onEdit} disabled={busy} className={ACTION}>
          Edit
        </button>
        <button type="button" onClick={onDelete} disabled={busy} className={`${ACTION} text-(--fam-danger)`}>
          Delete
        </button>
        <button type="button" onClick={onAddAnother} className={ACTION}>
          Add another meal
        </button>
      </div>
      <div className="mt-5 flex justify-end">
        <button
          type="button"
          onClick={onClose}
          className="min-h-(--fam-touch) rounded-full border border-(--fam-hairline) px-5 text-(length:--fam-fs-body) font-medium"
        >
          Close
        </button>
      </div>
    </FormDialog>
  );
}
