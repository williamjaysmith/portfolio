"use client";

import { Star } from "lucide-react";

/**
 * FR-403's gold star chip (T025) — "⭐ 10" on the card face, beside the title,
 * on every surface that draws the card.
 *
 * **The value is read, never derived.** It is the task's stored `reward_points`
 * riding `BoardOccurrence.rewardPoints` through `expandTaskDay` unchanged in
 * shape (R406). Nothing here knows about the ledger: what a task is WORTH and
 * what a Profile has EARNED are different numbers (FR-409 — a later edit to the
 * value changes nothing already credited), and the chip shows only the first.
 *
 * **Worth nothing draws nothing.** `null` and `0` are the same answer (FR-402:
 * "blank and 0 alike"), so a card worth nothing is the height it was in
 * Phase 3 (US1-2) and SC-418's audit finds no chip on it. The rule is stated
 * here once, for the drawn half and the spoken half together — `starsWorthOf`
 * is what `TaskCard` folds into the body control's accessible name — so the
 * card cannot show a chip its name does not mention, or name a value its face
 * does not show.
 *
 * Geometry is **consumed** from `tokens.css` and not re-committed: the shipped
 * badge pill the late mark and the streak badge wear (R414 — "the chip reuses
 * `--fam-task-badge-*`"), so a card carrying more than one mark reads as one
 * family of marks. Its edge is `--fam-task-ink`, the ink the CARD chose for
 * the fill it actually drew and ≥ 4.5:1 against it by construction (FR-398),
 * which is what makes the pill perceivable on all twenty accents at both
 * tints. The star alone is `--fam-star-gold` — the verified palette colour
 * the reference uses for star chips and reward stars — and it is filled, not
 * outlined, because the photograph's star is solid.
 */

/** The badge's icon size — one token, shared with FR-372's bolt, so the two icons match. */
const ICON = "h-(--fam-task-streak-icon) w-(--fam-task-streak-icon) text-(--fam-star-gold)";

const CHIP =
  "inline-flex h-(--fam-task-badge-h) shrink-0 items-center gap-(--fam-task-badge-gap) " +
  "rounded-(--fam-task-badge-r) border-(length:--fam-task-badge-edge) border-(--fam-task-ink) " +
  "px-(--fam-task-badge-pad) text-(length:--fam-fs-small) font-medium tabular-nums";

/** FR-402's one rule: blank and zero are both "worth nothing". */
function isWorthSomething(count: number | null): count is number {
  return count !== null && count > 0;
}

/**
 * The chip's spoken half — what the card's accessible name says about the
 * value, or `null` where there is no chip to speak of. Kept beside the drawn
 * half so the two can never disagree about when a card is worth something.
 */
export function starsWorthOf(count: number | null): string | null {
  if (!isWorthSomething(count)) return null;
  return `worth ${count} ${count === 1 ? "star" : "stars"}`;
}

export interface StarChipProps {
  /** The task's stored star value. `null` and `0` both mean no stars, and draw nothing (FR-402). */
  count: number | null;
}

export function StarChip({ count }: StarChipProps) {
  if (!isWorthSomething(count)) return null;
  return (
    // Hidden from the reading order on purpose: the chip sits INSIDE the
    // card's body control, which carries an explicit accessible name that
    // already says the value once (`TaskCard`), so announcing the digits here
    // would say it twice.
    <span data-star-chip aria-hidden="true" className={CHIP}>
      <Star fill="currentColor" className={ICON} />
      {count}
    </span>
  );
}
