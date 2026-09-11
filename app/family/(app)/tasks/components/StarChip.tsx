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

/**
 * **A WHITE pill, like the header's counts** (the operator's ask). It was a
 * bare outline with the card's tint showing through, which meant the chip
 * changed colour with every accent and every state. On white it reads the same
 * on all twenty, and it matches `ColumnHeader`'s own pills, so the marks on a
 * card and the counts above it are one family.
 *
 * **The ink had to be pinned with it.** The chip inherited `--fam-task-ink`,
 * which is WHITE on the six dark accents — white digits on a white pill. It is
 * `--fam-text-primary` now, which is 4.5:1 on the app background by
 * construction (`tokens.test.ts`). The border stays `--fam-task-ink` so the
 * pill still has an edge against the card it sits on, whatever that card is.
 */
const CHIP =
  "inline-flex h-(--fam-task-badge-h) shrink-0 items-center gap-(--fam-task-badge-gap) " +
  "rounded-(--fam-task-badge-r) border-(length:--fam-task-badge-edge) border-(--fam-task-ink) " +
  "bg-(--fam-app-bg) px-(--fam-task-badge-pad) text-(length:--fam-fs-small) font-medium " +
  "text-(--fam-text-primary) tabular-nums";

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
