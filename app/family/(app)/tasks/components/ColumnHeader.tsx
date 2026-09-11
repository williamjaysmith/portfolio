"use client";

import { Check, Star } from "lucide-react";

import type { PaletteColor } from "@/lib/family/colors";
import type { TaskCounters } from "@/lib/family/tasks/counters";
import type { Category } from "@/lib/family/types";

import { Avatar } from "../../components/Avatar";
import {
  SECTION_GLYPHS,
  SECTION_LABELS,
  SECTION_LABELS_SHORT,
  SECTION_ORDER,
} from "./SectionGroup";
import type { TaskSectionKey, SectionToggles } from "./useSectionToggles";

/**
 * A column's header (T042): the avatar with FR-305's progress ring around it,
 * the Profile's name, the completed-of-total count with FR-407's star pill
 * beside it, and FR-306's four toggles — all on a panel filled with that
 * Profile's colour at 20 %, the third rung of the ladder the cards use at 40 %
 * and full (FR-304).
 *
 * The ring and the count are two indicators, not two readings of one: the ring
 * is the glanceable state at wall distance and the count is the exact one.
 * Both come from a `TaskCounters` computed above from the UNFILTERED list
 * (R317) — nothing here counts anything. The star pill (004 T027) is the same
 * arrangement for a third number: the stars this Profile EARNED on the
 * displayed day, summed above in the same memo (R402) and handed down as a
 * number, so the header holds no ledger it could sum wrongly. It wears the
 * count's own pill — the photograph pairs them, "✓ 2/20 · ⭐ 10" — and it is
 * drawn at 0 too, because a header missing a pill reads as broken rather
 * than as a day with nothing earned yet.
 *
 * `SectionToggleRow` is exported because the Up for Grabs column needs the
 * same four switches on a header that has no Profile behind it (FR-306's "in
 * each column header", FR-308's "no avatar, no ring, no profile accent"), and
 * two copies of the ring-state rule would be two places for it to drift. The
 * star pill is deliberately NOT exported for it: stars are credited to a
 * Profile, and that column belongs to nobody (FR-407).
 */

/** FR-305's arc, as the fraction of a turn it fills. An empty column is a full track. */
function progressFractionOf(counters: TaskCounters): number {
  return counters.total === 0 ? 0 : counters.complete / counters.total;
}

/**
 * The header's pills share one geometry — the count's — so the two read as a
 * pair. The icon size is the badge family's (FR-372's bolt, FR-403's chip).
 */
const HEADER_PILL =
  "flex w-fit items-center gap-(--fam-task-badge-gap) rounded-(--fam-task-badge-r) " +
  "bg-(--fam-app-bg) px-(--fam-task-badge-pad) py-(--fam-task-badge-gap) " +
  "text-(length:--fam-fs-pill) tabular-nums";

const PILL_ICON = "h-(--fam-task-streak-icon) w-(--fam-task-streak-icon)";

/** FR-407's spoken half — "1 star earned", "15 stars earned" — day-neutral, because the board's date names the day. */
function starsEarnedLabelOf(count: number): string {
  return `${count} ${count === 1 ? "star" : "stars"} earned`;
}

/**
 * FR-306's ring GEOMETRY. Chores is not a time of day and never draws the
 * partial arc: it is full circumference in both states, and its on/off is
 * carried by the paint and the ring's width instead.
 */
function ringKindOf(section: TaskSectionKey, on: boolean): "full" | "partial" {
  return section === "chores" || on ? "full" : "partial";
}

/** The two paints and the face a toggle's ring is drawn against. */
interface ToggleTone {
  on: string;
  off: string;
  face: string;
}

const PROFILE_TONE: ToggleTone = {
  // Two rungs, app-wide (see tokens.css's tint ladder): the accent at full
  // strength for ON, and the PAGE for OFF. It was the black-mixed deep rung
  // over a faded third shade, which is what made the same person read as a
  // different colour here than on the calendar.
  on: "var(--fam-profile-100)",
  off: "var(--fam-task-progress-track)",
  face: "bg-(--fam-profile-40)",
};

/** Up for Grabs has no accent to deepen, so its toggles take the neutral chrome. */
const NEUTRAL_TONE: ToggleTone = {
  on: "var(--fam-text-primary)",
  off: "var(--fam-control-border)",
  face: "bg-(--fam-pill-btn-bg)",
};

/**
 * The ring itself. `--fam-task-ring-arc` is the inactive time-of-day arc; a
 * full ring closes the circle. The unpainted remainder is transparent so the
 * panel shows through, which is what makes a partial ring read as partial.
 */
function ringBackgroundOf(section: TaskSectionKey, on: boolean, tone: ToggleTone): string {
  const paint = on ? tone.on : tone.off;
  return ringKindOf(section, on) === "full"
    ? `conic-gradient(${paint} 0turn 1turn)`
    : `conic-gradient(${paint} 0 var(--fam-task-ring-arc), transparent 0)`;
}

export interface SectionToggleRowProps {
  toggles: SectionToggles;
  /** The column's Profile accent; `null` in the column that has none (FR-308). */
  accent: PaletteColor | null;
  onToggle: (section: TaskSectionKey) => void;
}

/**
 * FR-307's four INDEPENDENT switches — any combination, including none. The
 * label carries the control's perceivability (`--fam-task-toggle-ink`, 12:1 or
 * better on the panel); the ring carries its state, because nothing faded 40 %
 * toward a 20 % panel can clear 3:1 against it.
 */
export function SectionToggleRow({ toggles, accent, onToggle }: SectionToggleRowProps) {
  const tone = accent === null ? NEUTRAL_TONE : PROFILE_TONE;

  return (
    // **Never wraps, by construction.** It was `flex-wrap` with a fixed gap, and
    // it broke onto a second line wherever the column came up a few pixels
    // short: measured at 181px on a 430×932 phone and — by ONE pixel — at 207px
    // on a 1024×768 iPad, against the 189 + 3·gap it wanted. Chasing that with
    // column widths is unwinnable, because the requirement moves with the text.
    //
    // Instead the row is four FIXED tap targets that cannot grow, `nowrap` so
    // they can never break, and `justify-between` so the leftover width becomes
    // the spacing. Four 44px targets need 176px; the narrowest column this app
    // can draw leaves more than that, so the row always fits on one line.
    <div className="flex flex-nowrap items-start justify-between gap-1">
      {SECTION_ORDER.map((section) => {
        const on = toggles[section];
        return (
          <button
            key={section}
            type="button"
            aria-pressed={on}
            aria-label={SECTION_LABELS[section]}
            data-ring={ringKindOf(section, on)}
            data-section={section}
            onClick={() => onToggle(section)}
            // The HEIGHT is a minimum — the hit floor must not clip the label
            // that carries the control's perceivability (FR-397, FR-306). The
            // WIDTH is now exact: a button that grew to fit "Afternoon" was
            // what pushed the row past its column in the first place, so the
            // label truncates inside a 44px target instead of widening it.
            className="flex min-h-(--fam-task-toggle-hit) w-(--fam-task-toggle-hit) shrink-0 flex-col items-center justify-center gap-(--fam-task-badge-gap) text-(--fam-task-toggle-ink)"
          >
            <span
              aria-hidden="true"
              style={{ backgroundImage: ringBackgroundOf(section, on, tone) }}
              className={`grid h-(--fam-task-toggle-d) w-(--fam-task-toggle-d) place-items-center rounded-full ${
                on ? "p-(--fam-task-ring-w)" : "p-(--fam-task-ring-w-off)"
              }`}
            >
              <span
                className={`grid h-full w-full place-items-center rounded-full text-(length:--fam-fs-small) ${tone.face}`}
              >
                {SECTION_GLYPHS[section]}
              </span>
            </span>
            {/*
              The SHORT spelling everywhere, not just on small screens. It was
              swapped by a viewport media query, which is the wrong axis
              entirely: what runs out of room is the COLUMN, and a 1024px iPad
              showing four of them has narrower columns than a 414px phone
              showing one. The full word is still the button's accessible name
              (`aria-label` above), so nothing is lost to a screen reader, and
              the section HEADINGS below still spell it out in full.
            */}
            <span className="w-full truncate text-center text-(length:--fam-fs-nav) leading-none">
              {SECTION_LABELS_SHORT[section]}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export interface ColumnHeaderProps {
  category: Category;
  /** FR-305, computed above from the UNFILTERED list (R317). */
  counters: TaskCounters;
  /** FR-407: the stars this Profile EARNED on the displayed day, summed above from the week's entries (R402). */
  starsToday: number;
  toggles: SectionToggles;
  onToggleSection: (section: TaskSectionKey) => void;
  /** Signed URL for a photo avatar; initials stand in while it loads. */
  photoUrl?: string;
  /**
   * FR-309: this column may be reordered, so the Profile's NAME becomes the
   * handle — press and hold it and drag, or focus it and press Enter. It is a
   * `button` only then: a name nobody may drag is a name, and giving it a
   * control's semantics would put an empty control in every reading order.
   */
  reorderable?: boolean;
}

/**
 * The Profile's FACE — the progress ring with the avatar inside it — and, for a
 * parent, FR-309's drag handle.
 *
 * **The name used to be here, visibly, and it was also the handle.** The
 * operator's call, once real photographs were loaded: *"i think we dont even
 * need a name on ours because were using photos"* — the same reasoning that
 * took the name off the calendar's profile chip ("we know who it is").
 *
 * So the handle moved onto the face. It had to move somewhere: `reorderable` is
 * true whenever a PARENT is punched in, on any device, so deleting the visible
 * name without this would have deleted column reordering with it. The face is
 * the better handle anyway — it is `--fam-task-avatar` square against a line of
 * text, and it is unambiguously the person.
 *
 * **The column is still named.** `ColumnHeader`'s own `<header role="group">`
 * carries `aria-label={category.label}`, and this button carries the name too,
 * so nothing that reads the board lost anything. `Avatar` stays `aria-hidden`
 * (FR-039's rule holds: colour is not the only carrier — the face is).
 *
 * The board's own listeners do the work (`useListReorder`); what belongs here
 * is only that a press must LAND on the handle and the keyboard can reach it.
 */
function ProfileFace({
  category,
  photoUrl,
  fraction,
  reorderable,
}: {
  category: Category;
  photoUrl?: string;
  fraction: number;
  reorderable: boolean;
}) {
  const ring = (
    <span
      data-progress-ring
      data-fraction={fraction}
      aria-hidden="true"
      style={{
        backgroundImage: `conic-gradient(var(--fam-profile-100) ${fraction}turn, var(--fam-task-progress-track) 0)`,
      }}
      className="grid shrink-0 place-items-center rounded-full p-(--fam-task-progress-w)"
    >
      <Avatar
        category={category}
        photoUrl={photoUrl}
        sizeClassName="h-(--fam-task-avatar) w-(--fam-task-avatar)"
      />
    </span>
  );

  if (!reorderable) return ring;
  return (
    <button
      type="button"
      data-reorder-handle
      aria-label={`${category.label} — hold to drag this column, or press Enter to move it`}
      className="flex min-h-(--fam-touch) min-w-(--fam-touch) shrink-0 items-center justify-center"
    >
      {ring}
    </button>
  );
}

export function ColumnHeader({
  category,
  counters,
  starsToday,
  toggles,
  onToggleSection,
  photoUrl,
  reorderable = false,
}: ColumnHeaderProps) {
  const fraction = progressFractionOf(counters);

  return (
    <header
      role="group"
      aria-label={category.label}
      className="fam-tint-40 flex flex-col gap-(--fam-task-header-gap) rounded-(--fam-task-col-r) p-(--fam-task-header-pad)"
    >
      {/*
        **One row: the face and both counts.** It was three rows — face + name,
        then the pills, then the toggles — and on an iPhone SE that header ate
        130px of a 568px screen while the task list got 155px. Folding the rows
        and dropping the visible name (see `ProfileFace`) took it to 97px.
        The pills are `shrink-0` because a count that truncates is a wrong number.
      */}
      <div className="flex items-center gap-(--fam-task-header-gap)">
        <ProfileFace
          category={category}
          photoUrl={photoUrl}
          fraction={fraction}
          reorderable={reorderable}
        />
        <div className="ml-auto flex shrink-0 items-center gap-(--fam-task-badge-gap)">
          <p aria-label={`${counters.complete} of ${counters.total} complete`} className={HEADER_PILL}>
            <Check aria-hidden="true" className={PILL_ICON} />
            {`${counters.complete}/${counters.total}`}
          </p>
          <p data-star-pill aria-label={starsEarnedLabelOf(starsToday)} className={HEADER_PILL}>
            {/* Filled, not outlined, and the verified palette gold — the same star the card's chip draws. */}
            <Star
              aria-hidden="true"
              fill="currentColor"
              className={`${PILL_ICON} text-(--fam-star-gold)`}
            />
            {starsToday}
          </p>
        </div>
      </div>
      <SectionToggleRow toggles={toggles} accent={category.color} onToggle={onToggleSection} />
    </header>
  );
}
