"use client";

import { Check } from "lucide-react";

import type { PaletteColor } from "@/lib/family/colors";
import type { TaskCounters } from "@/lib/family/tasks/counters";
import type { Category } from "@/lib/family/types";

import { Avatar } from "../../components/Avatar";
import { SECTION_GLYPHS, SECTION_LABELS, SECTION_ORDER } from "./SectionGroup";
import type { TaskSectionKey, SectionToggles } from "./useSectionToggles";

/**
 * A column's header (T042): the avatar with FR-305's progress ring around it,
 * the Profile's name, the completed-of-total count, and FR-306's four
 * toggles — all on a panel filled with that Profile's colour at 20 %, the
 * third rung of the ladder the cards use at 40 % and full (FR-304).
 *
 * The ring and the count are two indicators, not two readings of one: the ring
 * is the glanceable state at wall distance and the count is the exact one.
 * Both come from a `TaskCounters` computed above from the UNFILTERED list
 * (R317) — nothing here counts anything.
 *
 * `SectionToggleRow` is exported because the Up for Grabs column needs the
 * same four switches on a header that has no Profile behind it (FR-306's "in
 * each column header", FR-308's "no avatar, no ring, no profile accent"), and
 * two copies of the ring-state rule would be two places for it to drift.
 */

/** FR-305's arc, as the fraction of a turn it fills. An empty column is a full track. */
function progressFractionOf(counters: TaskCounters): number {
  return counters.total === 0 ? 0 : counters.complete / counters.total;
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
  on: "var(--fam-profile-deep)",
  off: "var(--fam-task-ring-off)",
  face: "bg-(--fam-profile-20)",
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
    <div className="flex flex-wrap items-start justify-between gap-(--fam-task-header-gap)">
      {SECTION_ORDER.map((section) => {
        const on = toggles[section];
        return (
          <button
            key={section}
            type="button"
            aria-pressed={on}
            data-ring={ringKindOf(section, on)}
            data-section={section}
            onClick={() => onToggle(section)}
            // A MINIMUM, not a size: the hit floor must not clip the label
            // that carries the control's perceivability (FR-397, FR-306).
            className="flex min-h-(--fam-task-toggle-hit) min-w-(--fam-task-toggle-hit) shrink-0 flex-col items-center justify-center gap-(--fam-task-badge-gap) text-(--fam-task-toggle-ink)"
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
            <span className="text-(length:--fam-fs-nav) leading-none">
              {SECTION_LABELS[section]}
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
 * The Profile's name, and — for a parent — FR-309's drag handle. The board's
 * own listeners do the work (`useListReorder`); what belongs here is only that
 * a press must LAND on the name, and that the keyboard can reach it.
 */
function ColumnName({ label, reorderable }: { label: string; reorderable: boolean }) {
  const text = "min-w-0 truncate font-(family-name:--fam-font-serif) text-(length:--fam-fs-title)";
  if (!reorderable) return <span className={text}>{label}</span>;
  return (
    <button
      type="button"
      data-reorder-handle
      aria-label={`${label} — hold to drag this column, or press Enter to move it`}
      className={`flex min-h-(--fam-touch) items-center text-left ${text}`}
    >
      {label}
    </button>
  );
}

export function ColumnHeader({
  category,
  counters,
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
      className="fam-tint-20 flex flex-col gap-(--fam-task-header-gap) rounded-(--fam-task-col-r) p-(--fam-task-header-pad)"
    >
      <div className="flex items-center gap-(--fam-task-header-gap)">
        <span
          data-progress-ring
          data-fraction={fraction}
          aria-hidden="true"
          style={{
            backgroundImage: `conic-gradient(var(--fam-profile-deep) ${fraction}turn, var(--fam-task-progress-track) 0)`,
          }}
          className="grid shrink-0 place-items-center rounded-full p-(--fam-task-progress-w)"
        >
          <Avatar
            category={category}
            photoUrl={photoUrl}
            sizeClassName="h-(--fam-task-avatar) w-(--fam-task-avatar)"
          />
        </span>
        <ColumnName label={category.label} reorderable={reorderable} />
      </div>
      <p
        aria-label={`${counters.complete} of ${counters.total} complete`}
        className="flex w-fit items-center gap-(--fam-task-badge-gap) rounded-(--fam-task-badge-r) bg-(--fam-app-bg) px-(--fam-task-badge-pad) py-(--fam-task-badge-gap) text-(length:--fam-fs-pill) tabular-nums"
      >
        <Check aria-hidden="true" className="h-(--fam-task-streak-icon) w-(--fam-task-streak-icon)" />
        {`${counters.complete}/${counters.total}`}
      </p>
      <SectionToggleRow toggles={toggles} accent={category.color} onToggle={onToggleSection} />
    </header>
  );
}
