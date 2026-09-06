import type { DietaryNote } from "@/lib/family/meals/dietary";

/**
 * Each Profile's dietary note under a planning sheet's fields (006 FR-638;
 * Phase 1 FR-024): "Cleo: no nuts", read-only, only for the Profiles that
 * have one, nothing when nobody does.
 */

export function DietaryNotes({ notes }: { notes: readonly DietaryNote[] }) {
  if (notes.length === 0) return null;
  return (
    <section aria-label="Dietary notes" className="rounded-(--fam-list-row-r) bg-(--fam-pill-btn-bg) px-3 py-2">
      <h3 className="text-(length:--fam-fs-small) text-(--fam-text-muted)">Dietary notes</h3>
      <ul className="mt-1 flex flex-col gap-0.5 text-(length:--fam-fs-small) text-(--fam-text-secondary)">
        {notes.map((note) => (
          <li key={note.name}>
            {note.name}: {note.note}
          </li>
        ))}
      </ul>
    </section>
  );
}
