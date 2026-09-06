"use client";

import type { MealCategory } from "@/lib/family/types";

import { FIELD, FieldError, LABEL } from "../../components/settings/CategoryFields";

/** The one mealtime chooser the meal and recipe forms share (006 FR-613, FR-624). */
export function MealtimeSelect({
  value,
  categories,
  onChange,
  errors,
}: {
  value: string;
  categories: readonly MealCategory[];
  onChange: (categoryId: string) => void;
  errors?: string[];
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className={LABEL}>
        Mealtime
        <select value={value} onChange={(event) => onChange(event.target.value)} className={FIELD}>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </label>
      <FieldError messages={errors} />
    </div>
  );
}
