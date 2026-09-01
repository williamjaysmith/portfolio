"use client";

import { useState } from "react";

import { reorderCategories } from "@/lib/family/actions/categories";
import type { Category } from "@/lib/family/types";

import { useFamily } from "../FamilyProvider";
import { CategoryForm } from "./CategoryForm";
import { CategoryRow } from "./CategoryRow";
import { DeleteDialog } from "./DeleteDialog";

/**
 * The Profiles list or the Labels list (FR-025).
 *
 * Reordering uses buttons rather than drag, so it is operable by keyboard and
 * by a child on a tablet (SC-009); the fractional index means a move writes one
 * row rather than renumbering the list.
 */

export interface CategorySectionProps {
  kind: "profile" | "label";
}

interface SectionHeaderProps {
  kind: "profile" | "label";
  disabled: boolean;
  bootstrap: boolean;
  onAdd: () => void;
}

function SectionHeader({ kind, disabled, bootstrap, onAdd }: SectionHeaderProps) {
  const isProfile = kind === "profile";
  const notes = [
    disabled ? "Parents only" : null,
    bootstrap ? "You’re the first — this person will be a parent." : null,
  ].filter((note): note is string => note !== null);

  return (
    <>
      <div className="flex items-center gap-3">
        <h2
          id={`${kind}-heading`}
          className="font-(family-name:--fam-font-serif) text-(length:--fam-fs-section)"
        >
          {isProfile ? "Profiles" : "Labels"}
        </h2>
        <button
          type="button"
          disabled={disabled}
          onClick={onAdd}
          className="min-h-[44px] rounded-full bg-(--fam-primary-blue) px-5 text-(length:--fam-fs-small) font-medium text-white disabled:opacity-50"
        >
          {isProfile ? "Add a Profile" : "Add a Label"}
        </button>
      </div>
      {notes.map((note) => (
        <p key={note} className="text-(length:--fam-fs-small) text-(--fam-text-secondary)">
          {note}
        </p>
      ))}
    </>
  );
}

export function CategorySection({ kind }: CategorySectionProps) {
  const { profiles, labels, actor, avatarUrls, withActor } = useFamily();
  const isProfile = kind === "profile";
  const items = isProfile ? profiles : labels;
  const disabled = actor?.role === "member";
  const emptyCopy = isProfile ? "No one yet." : "No labels yet.";

  const [editing, setEditing] = useState<Category | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Category | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // D6: with no parent yet, a signed-in member may create the first one.
  const bootstrap = isProfile && !profiles.some((profile) => profile.role === "parent");

  async function move(index: number, direction: -1 | 1): Promise<void> {
    const reordered = [...items];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(index + direction, 0, moved);

    // Send the whole household's order so the two lists cannot interleave.
    const others = isProfile ? labels : profiles;
    const result = await withActor(() =>
      reorderCategories([...reordered, ...others].map((entry) => entry.id)),
    );
    if (!result.ok) setMessage(result.message);
  }

  return (
    <section aria-labelledby={`${kind}-heading`} className="flex flex-col gap-4">
      <SectionHeader
        kind={kind}
        disabled={disabled}
        bootstrap={bootstrap}
        onAdd={() => setCreating(true)}
      />

      <ul className="flex flex-col gap-3">
        {items.map((item, index) => (
          <CategoryRow
            key={item.id}
            category={item}
            photoUrl={avatarUrls[item.id]}
            isActor={actor?.profileId === item.id}
            disabled={disabled}
            canMoveUp={index > 0}
            canMoveDown={index < items.length - 1}
            onMove={(direction) => void move(index, direction)}
            onEdit={() => setEditing(item)}
            onDelete={() => setDeleting(item)}
          />
        ))}
      </ul>

      {items.length === 0 ? (
        <p className="text-(length:--fam-fs-body) text-(--fam-text-secondary)">{emptyCopy}</p>
      ) : null}

      <p role="alert" className="text-(length:--fam-fs-body) empty:hidden">
        {message}
      </p>

      {creating ? (
        <CategoryForm
          mode="create"
          kind={kind}
          forceParent={bootstrap}
          onClose={() => setCreating(false)}
        />
      ) : null}
      {editing ? (
        <CategoryForm mode="edit" kind={kind} existing={editing} onClose={() => setEditing(null)} />
      ) : null}
      {deleting ? <DeleteDialog category={deleting} onClose={() => setDeleting(null)} /> : null}
    </section>
  );
}
