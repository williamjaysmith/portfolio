"use client";

import { EyeOff } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";

import type { PaletteColor } from "@/lib/family/colors";
import type { Category } from "@/lib/family/types";

import { Avatar } from "./Avatar";
import { useFamily } from "./FamilyProvider";
import { useModalDialog } from "./useModalDialog";

/**
 * Show or hide individual Profiles and Labels on THIS device (FR-033,
 * FR-264).
 *
 * Distinct from a profile's "Show on Tasks tab" setting, which is a household
 * choice stored in the database — this one is a per-device view preference and
 * needs no actor.
 *
 * Labels ride the very store Profiles already use (R212): `useDeviceVisibility`
 * has always held generic *category* ids, so a label id simply starts appearing
 * in the hidden set — no storage change, no key bump, and the one **Show all**
 * clears both kinds at once (FR-264). What the hidden set means to the grid is
 * `lib/family/calendar/visibility.ts` (FR-265); hiding is display only and
 * never unassigns anything (FR-267).
 */

/** The rows are one pattern; only the leading visual differs between the kinds. */
interface VisibilitySectionProps {
  title: string;
  headingId: string;
  categories: Category[];
  hiddenIds: ReadonlySet<string>;
  setHidden: (id: string, hidden: boolean) => void;
  /** A Profile's face, a Label's colour — see `ColorSwatch`. */
  visualOf: (category: Category) => ReactNode;
}

function VisibilitySection({
  title,
  headingId,
  categories,
  hiddenIds,
  setHidden,
  visualOf,
}: VisibilitySectionProps) {
  if (categories.length === 0) return null;

  return (
    <section aria-labelledby={headingId} className="mt-4">
      <h3
        id={headingId}
        className="font-(family-name:--fam-font-serif) text-(length:--fam-fs-section)"
      >
        {title}
      </h3>
      <ul className="mt-1 flex flex-col gap-1">
        {categories.map((category) => (
          <li key={category.id}>
            <label className="flex min-h-[44px] cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={!hiddenIds.has(category.id)}
                onChange={(event) => setHidden(category.id, !event.target.checked)}
                className="h-5 w-5"
              />
              {visualOf(category)}
              <span className="text-(length:--fam-fs-body)">{category.label}</span>
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * A Label wears its colour where a Profile wears its face — the same 32 px
 * circle, so the two lists read as one column. Decorative: the name is
 * rendered beside it, so colour is never the only carrier (FR-039).
 */
function ColorSwatch({ color }: { color: PaletteColor }) {
  return (
    <span
      aria-hidden="true"
      style={{ backgroundColor: color }}
      className="h-8 w-8 shrink-0 rounded-full"
    />
  );
}

export function FilterSheet() {
  const { profiles, labels, hiddenIds, setHidden, showAll, avatarUrls, visibilityPersists } =
    useFamily();
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
          Show on this device
        </h2>

        <VisibilitySection
          title="Profiles"
          headingId="filter-profiles"
          categories={profiles}
          hiddenIds={hiddenIds}
          setHidden={setHidden}
          visualOf={(profile) => (
            <Avatar category={profile} size={32} photoUrl={avatarUrls[profile.id]} />
          )}
        />

        <VisibilitySection
          title="Labels"
          headingId="filter-labels"
          categories={labels}
          hiddenIds={hiddenIds}
          setHidden={setHidden}
          visualOf={(label) => <ColorSwatch color={label.color} />}
        />

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
