"use client";

import { useFamily } from "./FamilyProvider";

/**
 * Who is punched in, and the way out (FR-013). Renders nothing when the shell
 * is in its shared, read-only state — which is most of the time.
 */
export function ActorBadge() {
  const { actor, punchOut } = useFamily();
  if (!actor) return null;

  return (
    <div
      className="flex items-center gap-2 rounded-full bg-(--fam-pill-btn-bg) py-1 pl-3 pr-1"
      aria-label={`Punched in as ${actor.label}`}
    >
      <span
        aria-hidden="true"
        style={{ backgroundColor: actor.color }}
        className="h-3 w-3 shrink-0 rounded-full"
      />
      <span className="text-(length:--fam-fs-pill) font-medium text-(--fam-text-primary)">
        {actor.label}
      </span>
      <button
        type="button"
        onClick={() => void punchOut()}
        className="min-h-[44px] rounded-full px-3 text-(length:--fam-fs-pill) font-medium text-(--fam-text-muted)"
      >
        Punch out
      </button>
    </div>
  );
}
