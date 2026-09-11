"use client";

/**
 * FR-358's late mark (T061): a carried-forward occurrence. The date it was due
 * is the occurrence's identity (FR-353) and the whole reason the card is on
 * today's board at all (FR-356, FR-357, US3-1) — but it is no longer PRINTED
 * here. The operator: *"doesnt need to say the date because you can see date
 * when you click on it, it can just say late"*, and the details view does
 * exactly that. The date is still spoken, by the card's own accessible name.
 *
 * It is a **pill, not tinted text**: raw text at 4.5:1 on every one of the
 * twenty profile tints at both card strengths is not achievable in one colour,
 * while a pill only has to be legible against its own fill.
 *
 * **It is the app's red now, and that reverses a shipped decision.** The fill
 * was a derived ochre (`#674117`) chosen so a late mark could not be mistaken
 * for a destructive one — "a red mark beside a title reads as delete this". The
 * operator read that ochre as a mistake rather than a distinction: *"i hate the
 * werid brown color used for the late background maybe it should be the same
 * red the app uses"*. Their board, their call. What keeps the two apart now is
 * position and shape rather than hue — this is a pill on a card, and the
 * destructive action is a button in a dialog — and `task-tokens.test.ts` says
 * so where it used to assert the colours differed.
 *
 * The colours live in `tokens.css`, which T038 owns — this component
 * **consumes** `--fam-late-fill` / `--fam-late-ink` / `--fam-late-edge` and the
 * shared badge geometry, and neither redefines nor extends them.
 *
 * The edge is `--fam-late-edge`, which `tokens.css` sets to `--fam-task-ink` —
 * the ink the CARD chose for the fill it actually drew: on a completed card in
 * a dark accent the ochre fill alone is 1.04:1 against its surround, so without
 * an edge the pill would not be perceivable at all on some of the twenty.
 *
 * **An anytime chore can never carry it.** It has no date to be late against
 * (FR-328, US3-4), so `dueDate` is null and this component renders nothing —
 * the rule is structural here as well as in the expander, rather than being a
 * condition each caller has to remember.
 *
 * Purely presentational: no state, no clock, no action. It imports **nothing**
 * from the components that draw it — a leaf reaching back up to `TaskDetails`
 * for its date formatter would close a cycle through `TaskCard`, and a cycle is
 * a thing the code changes to remove rather than a thing to annotate.
 */

/**
 * The date is formatted in **UTC** on purpose: a plain date carries no zone,
 * and running it through the household's would shift it across midnight.
 */
const FULL_DAY = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", dateStyle: "long" });

/**
 * What a screen reader hears, for the card to fold into its own name.
 *
 * It lives here rather than in `TaskCard` because the date formatting and the
 * "an anytime chore is never late" rule are this module's, and splitting them
 * across two files is how the two halves drift apart. Returns `null` when there
 * is nothing to say — the same condition under which the badge draws nothing.
 */
export function lateSpokenOf(dueDate: string | null, late: boolean): string | null {
  if (!late || dueDate === null) return null;
  return `Late — due ${FULL_DAY.format(new Date(`${dueDate}T00:00:00Z`))}`;
}

export interface LateBadgeProps {
  /**
   * The occurrence's OWN scheduled date (`YYYY-MM-DD`), never the board day it
   * is drawn on. `null` is an anytime chore, which has none.
   */
  dueDate: string | null;
  /** FR-356: this occurrence was carried forward past its own date. */
  late: boolean;
}

export function LateBadge({ dueDate, late }: LateBadgeProps) {
  if (!late || dueDate === null) return null;
  return (
    // `aria-hidden`: this sits inside the card's body button, which carries an
    // explicit accessible name that already says "Late — due <date>" in full
    // (`lateSpokenOf` above). Without that the word would be said twice on the
    // details view's badge and not at all on the card's.
    <span
      data-late-badge
      aria-hidden="true"
      className="inline-flex h-(--fam-task-badge-h) shrink-0 items-center rounded-(--fam-task-badge-r) border-(length:--fam-task-badge-edge) border-(--fam-late-edge) bg-(--fam-late-fill) px-(--fam-task-badge-pad) text-(length:--fam-fs-small) font-medium text-(--fam-late-ink)"
    >
      Late
    </span>
  );
}
