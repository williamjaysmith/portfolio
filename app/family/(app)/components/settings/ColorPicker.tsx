"use client";

import { PALETTE, PALETTE_NAMES, type PaletteColor } from "@/lib/family/colors";
import type { Category } from "@/lib/family/types";

/**
 * The 20 sanctioned colours (FR-021). Custom colours are not offered, and the
 * database rejects anything off-palette even if submitted directly.
 *
 * Two people may share a colour, but they are warned first, because colour is
 * the primary way the family is told apart at a glance.
 *
 * It is a real radio group, so it is ONE tab stop with the arrows moving
 * inside it (SC-009): twenty stops between the name field and Save is not a
 * form anyone can fill in from a keyboard.
 */

/** Where a key moves the selection, or null when the key is not part of the pattern. */
function nextOption(key: string, from: number, count: number): number | null {
  if (key === "ArrowRight" || key === "ArrowDown") return (from + 1) % count;
  if (key === "ArrowLeft" || key === "ArrowUp") return (from - 1 + count) % count;
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  return null;
}

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
  // The one swatch in the tab order. A colour that has left the palette selects
  // nothing, and the group would otherwise have no way in at all.
  const tabStop = Math.max(PALETTE.indexOf(value), 0);

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>): void {
    const target = nextOption(event.key, tabStop, PALETTE.length);
    if (target === null) return;

    event.preventDefault();
    onChange(PALETTE[target]);
    // Selection and focus move together; the swatch is already in the DOM, so
    // only its `tabIndex` changes on the re-render this triggers.
    event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]')[target]?.focus();
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        role="radiogroup"
        aria-label="Colour"
        onKeyDown={handleKeyDown}
        className="flex flex-wrap gap-2"
      >
        {PALETTE.map((color, index) => {
          const used = owner(color);
          const selected = color === value;
          return (
            <button
              key={color}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`${PALETTE_NAMES[color]}${used ? ` — already used by ${used.label}` : ""}`}
              tabIndex={index === tabStop ? 0 : -1}
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
