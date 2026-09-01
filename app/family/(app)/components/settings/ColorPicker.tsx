"use client";

import { PALETTE, PALETTE_NAMES, type PaletteColor } from "@/lib/family/colors";
import type { Category } from "@/lib/family/types";

/**
 * The 20 sanctioned colours (FR-021). Custom colours are not offered, and the
 * database rejects anything off-palette even if submitted directly.
 *
 * Two people may share a colour, but they are warned first, because colour is
 * the primary way the family is told apart at a glance.
 */

export interface ColorPickerProps {
  value: PaletteColor;
  onChange: (color: PaletteColor) => void;
  /** Everyone who already uses a colour, so duplicates are visible before choosing. */
  usedBy: Pick<Category, "id" | "label" | "color" | "emoji">[];
  /** The category being edited — it doesn't clash with itself. */
  excludeId?: string;
}

export function ColorPicker({ value, onChange, usedBy, excludeId }: ColorPickerProps) {
  const others = usedBy.filter((entry) => entry.id !== excludeId);
  const owner = (color: PaletteColor) => others.find((entry) => entry.color === color);
  const clash = owner(value);

  return (
    <div className="flex flex-col gap-2">
      <div role="radiogroup" aria-label="Colour" className="flex flex-wrap gap-2">
        {PALETTE.map((color) => {
          const used = owner(color);
          const selected = color === value;
          return (
            <button
              key={color}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`${PALETTE_NAMES[color]}${used ? ` — already used by ${used.label}` : ""}`}
              onClick={() => onChange(color)}
              style={{ backgroundColor: color }}
              className={`relative flex h-[44px] w-[44px] items-center justify-center rounded-full text-xs font-medium text-white ${
                selected ? "ring-2 ring-(--fam-text-primary) ring-offset-2" : ""
              }`}
            >
              {used ? <span aria-hidden="true">{used.emoji ?? used.label.slice(0, 1)}</span> : null}
            </button>
          );
        })}
      </div>
      <p role="status" className="min-h-[1.5em] text-(length:--fam-fs-small) text-(--fam-text-secondary)">
        {clash
          ? `${clash.label} already uses this colour. You can still pick it — they'll just be harder to tell apart.`
          : null}
      </p>
    </div>
  );
}
