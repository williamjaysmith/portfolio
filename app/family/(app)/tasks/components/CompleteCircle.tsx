"use client";

import { Check, Minus } from "lucide-react";

import type { PaletteColor } from "@/lib/family/colors";
import type { OccurrenceState } from "@/lib/family/types";

/**
 * The circle to the right of a task's name (FR-348, T041).
 *
 * Unresolved it is a white circle; complete it is a disc in the CREDITED
 * Profile's own accent drawn deeper, under a white checkmark — never a fixed
 * success green, because the reference has none and the colour is the
 * family's own choice.
 *
 * Every colour here is a token and none is derived. `--fam-profile-deep` is
 * the accent's channels scaled toward black — FR-398's "how much deeper",
 * never another hue — and `tokens.css` owns that arithmetic with
 * `task-tokens.test.ts` proving it across all twenty accents. The white
 * circle's edge is `--fam-task-ink`, the ink `TaskCard` chose for the fill it
 * actually drew, because white on a 40 % tint is 1.13:1 and a circle with no
 * edge is a circle that is not there.
 *
 * The hit area is `--fam-task-circle-hit`, which is itself
 * `max(var(--fam-touch), …)`, so FR-397's floor travels with the token rather
 * than being restated here; the DRAWN circle is the smaller
 * `--fam-task-circle-d`.
 *
 * There is deliberately no permission prop. FR-350 forbids hiding controls as
 * the enforcement mechanism: the circle is always rendered and always
 * tappable, and a refusal is the server's answer surfaced as FR-351's
 * message. `busy` is the only thing that stops a tap, and it means a write is
 * already in flight (FR-393).
 */

/**
 * The disc's fill and edge, in tokens. `hasAccent` is false only in the Up for
 * Grabs column, where no `.fam-profile` element sits above the card and
 * `--fam-profile-deep` is therefore not declared at all (FR-308).
 */
function discClassOf(state: OccurrenceState, hasAccent: boolean): string {
  if (state === "complete") {
    return hasAccent
      ? "bg-(--fam-profile-deep) border-(--fam-profile-deep) text-white"
      : "bg-(--fam-task-ink) border-(--fam-task-ink) text-white";
  }
  return "bg-(--fam-app-bg) border-(--fam-task-ink) text-(--fam-task-ink)";
}

/**
 * What the circle DOES, said as its action. The card body beside it is named
 * for the task itself, so naming both the same thing would put two
 * identically-named controls on one card (FR-352).
 */
const ACTIONS: Record<OccurrenceState, (summary: string) => string> = {
  unresolved: (summary) => `Complete ${summary}`,
  complete: (summary) => `Mark ${summary} incomplete`,
  skipped: (summary) => `Unskip ${summary}`,
};

/** The stroke is a token so the mark stays legible at wall distance (FR-397). */
const MARK = "h-1/2 w-1/2 [stroke-width:var(--fam-task-check-w)]";

/** FR-348's check; a skip is marked, not blank, or it reads as outstanding. */
function markFor(state: OccurrenceState) {
  if (state === "complete") return <Check aria-hidden="true" className={MARK} />;
  if (state === "skipped") return <Minus aria-hidden="true" className={MARK} />;
  return null;
}

export interface CompleteCircleProps {
  state: OccurrenceState;
  /** The CREDITED Profile's accent (FR-348); `null` in Up for Grabs, which has none. */
  accent: PaletteColor | null;
  /** The task's title — the circle names its action over it, never repeats it. */
  summary: string;
  /** FR-393: a write is in flight, so the circle shows it and refuses a second tap. */
  busy?: boolean;
  /** The board picks the verb this state implies and runs the one commit path (T044). */
  onToggle: () => void;
}

export function CompleteCircle({
  state,
  accent,
  summary,
  busy = false,
  onToggle,
}: CompleteCircleProps) {
  return (
    <button
      type="button"
      aria-label={ACTIONS[state](summary)}
      aria-busy={busy ? "true" : undefined}
      disabled={busy}
      data-state={state}
      onClick={onToggle}
      className="grid h-(--fam-task-circle-hit) w-(--fam-task-circle-hit) shrink-0 place-items-center rounded-full"
    >
      <span
        data-disc
        className={`grid h-(--fam-task-circle-d) w-(--fam-task-circle-d) place-items-center rounded-full border-(length:--fam-task-circle-w) transition-colors duration-(--fam-task-fade-ms) ease-(--fam-task-fade-ease) ${discClassOf(
          state,
          accent !== null,
        )}`}
      >
        {markFor(state)}
      </span>
    </button>
  );
}
