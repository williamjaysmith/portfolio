"use client";

/**
 * FR-358's late mark (T061): a carried-forward occurrence, showing **the date
 * it was due** rather than the day it is drawn on — that date is the
 * occurrence's identity (FR-353), and it is the whole reason the card is on
 * today's board at all (FR-356, FR-357, US3-1).
 *
 * It is a **pill, not tinted text**, and it is ochre rather than coral. Raw
 * text at 4.5:1 on every one of the twenty profile tints at both card
 * strengths is not achievable in one colour, while a pill only has to be
 * legible against its own fill; and a red mark beside a title reads as
 * "delete this", which is the one thing this badge must not say. Both
 * decisions live in `tokens.css`, which T038 owns — this component **consumes**
 * `--fam-late-fill` / `--fam-late-ink` / `--fam-late-edge` and the shared badge
 * geometry, and neither redefines nor extends them.
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
 * Both dates are formatted in **UTC** on purpose: a plain date carries no zone,
 * and running it through the household's would shift it across midnight.
 */
const AS_UTC = { timeZone: "UTC" } as const;

/** The visible half — short, because a card has one line to spare. */
const SHORT_DAY = new Intl.DateTimeFormat("en-US", { ...AS_UTC, month: "short", day: "numeric" });

/** The spoken half, where there is no width to run out of. */
const FULL_DAY = new Intl.DateTimeFormat("en-US", { ...AS_UTC, dateStyle: "long" });

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
  const due = new Date(`${dueDate}T00:00:00Z`);
  return (
    <span
      data-late-badge
      className="inline-flex h-(--fam-task-badge-h) shrink-0 items-center rounded-(--fam-task-badge-r) border-(length:--fam-task-badge-edge) border-(--fam-late-edge) bg-(--fam-late-fill) px-(--fam-task-badge-pad) text-(length:--fam-fs-small) font-medium text-(--fam-late-ink) tabular-nums"
    >
      {/* Said in full where there is no width to run out of, and short where
          there is — one badge, two audiences, never two badges. */}
      <span className="sr-only">{`Late — due ${FULL_DAY.format(due)}`}</span>
      <span aria-hidden="true">{`Late · ${SHORT_DAY.format(due)}`}</span>
    </span>
  );
}
