"use client";

import { Pencil } from "lucide-react";
import type { CSSProperties } from "react";

import { profileVars } from "@/lib/family/colors";
import type { MealCategory } from "@/lib/family/types";

import { useModalDialog } from "../../components/useModalDialog";
import type { HiddenMealtimes } from "./useHiddenMealtimes";

/**
 * The Categories sheet (006 FR-610, FR-611; 26902149028379 — "the 'Mealtime
 * Categories' dropdown… toggle button next to its name… pencil icon"): the
 * four mealtimes, each with a show/hide switch for THIS device and, for a
 * punched-in parent, the pencil that opens the name and colour. Hiding is
 * display only — the meals stay planned, the phone still shows the row — and
 * is remembered per device (FR-648), with the shipped "won't be remembered"
 * notice when storage refuses.
 */

export interface CategoriesSheetProps {
  categories: readonly MealCategory[];
  hidden: HiddenMealtimes;
  /** FR-640: the pencils are a parent's. */
  canEdit: boolean;
  onEdit: (category: MealCategory) => void;
  onClose: () => void;
}

const ROW = "flex min-h-(--fam-touch) items-center gap-3";
const SWATCH = "fam-profile size-8 shrink-0 rounded-full bg-(--fam-profile-100)";

export function CategoriesSheet({ categories, hidden, canEdit, onEdit, onClose }: CategoriesSheetProps) {
  const dialogRef = useModalDialog(true, true);
  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="mealtimes-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className="m-auto w-[min(92vw,26rem)] rounded-(--fam-radius-modal) bg-(--fam-app-bg) p-6 text-(--fam-text-primary) backdrop:bg-black/30"
    >
      <h2 id="mealtimes-title" className="font-(family-name:--fam-font-serif) text-(length:--fam-fs-title)">
        Mealtimes
      </h2>
      <p className="mt-1 text-(length:--fam-fs-small) text-(--fam-text-secondary)">Show on this device</p>
      <ul className="mt-3 flex flex-col gap-1">
        {categories.map((category) => (
          <li key={category.id} className={ROW}>
            <label className="flex min-h-(--fam-touch) flex-1 cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={!hidden.isHidden(category.id)}
                onChange={() => hidden.toggle(category.id)}
                aria-label={category.name}
                className="h-5 w-5"
              />
              <span aria-hidden="true" style={profileVars(category.color) as CSSProperties} className={SWATCH} />
              <span className="text-(length:--fam-fs-body)">{category.name}</span>
            </label>
            {canEdit ? (
              <button
                type="button"
                aria-label={`Edit ${category.name}`}
                onClick={() => onEdit(category)}
                className="grid h-(--fam-touch) w-(--fam-touch) place-items-center rounded-full"
              >
                <Pencil aria-hidden="true" size={20} />
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      {hidden.persistent ? null : (
        <p className="mt-3 text-(length:--fam-fs-small) text-(--fam-text-secondary)">
          Filters won&rsquo;t be remembered on this device.
        </p>
      )}
      <div className="mt-5 flex justify-end">
        <button
          type="button"
          onClick={onClose}
          className="min-h-(--fam-touch) rounded-full bg-(--fam-primary-blue) px-5 text-(length:--fam-fs-body) font-medium text-white"
        >
          Done
        </button>
      </div>
    </dialog>
  );
}
