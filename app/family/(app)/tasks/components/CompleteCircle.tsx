"use client";

import { Check, Minus } from "lucide-react";

import type { PaletteColor } from "@/lib/family/colors";
import type { OccurrenceState } from "@/lib/family/types";

/**
 * The circle to the right of a task's name (FR-348, T041).
 *
 * Unresolved it is a white circle; complete it is a disc in the CREDITED
 * Profile's own accent at full strength, under a checkmark — never a fixed
 * success green, because the reference has none and the colour is the
 * family's own choice.
 *
 * Every colour here is a token and none is derived. The disc was
 * `--fam-profile-deep`, the accent scaled toward black, and the app now has
 * only two rungs of a profile's colour — the operator's ruling, so that the
 * same person reads as the same colour on every tab (see tokens.css's tint
 * ladder).
 *
 * **The checkmark's ink is the reason that was safe to do.** It was hardcoded
 * `white`, which the deep rung could just about carry; on the 100 % rung white
 * is 1.37:1 on Sunshine and 1.50:1 on Sprout — no mark at all. It is
 * `--fam-profile-ink` now, chosen per accent by `profileVars` and so correct
 * for all twenty rather than for most.
 *
 * **The completed disc takes its EDGE from that same ink**, and it has to. A
 * completed card is filled at 100 % too, so a disc in the accent on top of it
 * is the same colour as its own background — before the ladder collapsed the
 * disc was deeper and stood out by itself. The edge is what puts it back, at
 * the same ≥4.5:1 the checkmark inside it gets, rather than reaching for a
 * third shade of the accent.
 *
 * The unresolved circle's edge is `--fam-task-ink`, the ink `TaskCard` chose for
 * the fill it actually drew, because white on a 40 % tint is 1.13:1 and a circle
 * with no edge is a circle that is not there.
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
 * Grabs column, where no `.fam-profile` element sits above the card and the
 * profile rungs are therefore not declared at all (FR-308).
 */
function discClassOf(state: OccurrenceState, hasAccent: boolean): string {
  if (state === "complete") {
    return hasAccent
      ? "bg-(--fam-profile-100) border-(--fam-profile-ink) text-(--fam-profile-ink)"
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
