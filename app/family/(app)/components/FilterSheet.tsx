"use client";

import { EyeOff } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";

import { useListFilters } from "@/app/family/(app)/lists/components/useListFilters";
import {
  useCountdownSwitches,
  type CalendarPreviewSwitches,
} from "@/app/family/(app)/calendar/components/useCountdownSwitches";
import { useCalendarMealSwitch } from "@/app/family/(app)/meals/components/useCalendarMealSwitch";
import { useTaskFilters } from "@/app/family/(app)/tasks/components/useTaskFilters";
import type { PaletteColor } from "@/lib/family/colors";
import type { Category, ListFilters, TaskFilters } from "@/lib/family/types";

import { Avatar } from "./Avatar";
import { useFamily } from "./FamilyProvider";
import { DialogClose } from "./DialogClose";
import { useModalDialog } from "./useModalDialog";

/**
 * Show or hide individual Profiles and Labels on THIS device (FR-033,
 * FR-264).
 *
 * Distinct from a profile's "Show on Tasks tab" setting, which is a household
 * choice stored in the database — this one is a per-device view preference and
 * needs no actor.
 *
 * Labels ride the very store Profiles already use (R212): `useDeviceVisibility`
 * has always held generic *category* ids, so a label id simply starts appearing
 * in the hidden set — no storage change, no key bump, and the one **Show all**
 * clears both kinds at once (FR-264). What the hidden set means to the grid is
 * `lib/family/calendar/visibility.ts` (FR-265); hiding is display only and
 * never unassigns anything (FR-267).
 *
 * T067 adds the **Tasks** section (FR-383): the four board switches, on a
 * store of their own rather than a widened category set (R319) — four booleans
 * with no pruning are a different type from a set of ids, and widening the key
 * would orphan every shipped device's preference. One sheet, two stores, and
 * one **Show all** that clears both. What the switches mean to the board is
 * `lib/family/tasks/visibility.ts`, applied below the counters, so no switch
 * here can move a number (FR-384).
 */

/** Every row in the sheet is this row; only the leading visual differs. */
interface ToggleRowProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** A Profile's face, a Label's colour — see `ColorSwatch`. Switches have none. */
  visual?: ReactNode;
}

function ToggleRow({ label, checked, onChange, visual }: ToggleRowProps) {
  return (
    <li>
      <label className="flex min-h-[44px] cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="h-5 w-5"
        />
        {visual}
        <span className="text-(length:--fam-fs-body)">{label}</span>
      </label>
    </li>
  );
}

/** One titled list of rows — Profiles, Labels, or the four task switches. */
function SheetSection({
  title,
  headingId,
  children,
}: {
  title: string;
  headingId: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={headingId} className="mt-4">
      <h3
        id={headingId}
        className="font-(family-name:--fam-font-serif) text-(length:--fam-fs-section)"
      >
        {title}
      </h3>
      <ul className="mt-1 flex flex-col gap-1">{children}</ul>
    </section>
  );
}

interface VisibilitySectionProps {
  title: string;
  headingId: string;
  categories: Category[];
  hiddenIds: ReadonlySet<string>;
  setHidden: (id: string, hidden: boolean) => void;
  visualOf: (category: Category) => ReactNode;
}

function VisibilitySection({
  title,
  headingId,
  categories,
  hiddenIds,
  setHidden,
  visualOf,
}: VisibilitySectionProps) {
  if (categories.length === 0) return null;

  return (
    <SheetSection title={title} headingId={headingId}>
      {categories.map((category) => (
        <ToggleRow
          key={category.id}
          label={category.label}
          checked={!hiddenIds.has(category.id)}
          onChange={(checked) => setHidden(category.id, !checked)}
          visual={visualOf(category)}
        />
      ))}
    </SheetSection>
  );
}

/** FR-383's four, in the reference's own order and its own words. */
const TASK_SWITCHES: readonly (readonly [keyof TaskFilters, string])[] = [
  ["completed", "Completed tasks"],
  ["late", "Late chores"],
  ["skipped", "Skipped tasks"],
  ["upForGrabs", "Up for Grabs"],
];

function TaskFilterSection({
  filters,
  setFilter,
}: {
  filters: TaskFilters;
  setFilter: (key: keyof TaskFilters, on: boolean) => void;
}) {
  return (
    <SheetSection title="Tasks" headingId="filter-tasks">
      {TASK_SWITCHES.map(([key, label]) => (
        <ToggleRow
          key={key}
          label={label}
          checked={filters[key]}
          onChange={(checked) => setFilter(key, checked)}
        />
      ))}
    </SheetSection>
  );
}

/** 005 FR-520's one switch, in the reference's own words (37275069922971 — "Completed"). */
const LIST_SWITCHES: readonly (readonly [keyof ListFilters, string])[] = [["completed", "Completed items"]];

function ListFilterSection({
  filters,
  setFilter,
}: {
  filters: ListFilters;
  setFilter: (key: keyof ListFilters, on: boolean) => void;
}) {
  return (
    <SheetSection title="Lists" headingId="filter-lists">
      {LIST_SWITCHES.map(([key, label]) => (
        <ToggleRow key={key} label={label} checked={filters[key]} onChange={(checked) => setFilter(key, checked)} />
      ))}
    </SheetSection>
  );
}

/** 006 FR-635's one switch, per device, on by default (36625171368987 — "Show Meals"). */
function MealFilterSection({ showMeals, setShowMeals }: { showMeals: boolean; setShowMeals: (on: boolean) => void }) {
  return (
    <SheetSection title="Meals" headingId="filter-meals">
      <ToggleRow label="Show Meals on the calendar" checked={showMeals} onChange={setShowMeals} />
    </SheetSection>
  );
}

/**
 * 009's one remaining, per device (FR-908, FR-913).
 *
 * **Pause countdowns** is ours. The reference documents that the bar rotates
 * and nothing about stopping it (Assumption 6), and a bar that changes while
 * somebody is reading it is a poor wall display.
 *
 * **Task progress** is the reference's own toggle (36625171368987), back after
 * 014 retired it — but it no longer gates a ROW. 009's switch revealed a second
 * row of the family's faces above the calendar; 014 moved the counts onto the
 * shell's chips and dropped the switch. What the operator actually wanted was
 * the switch without the duplication: a bare coloured circle by default, and
 * the count appearing beside the same face when this is on. The faces are drawn
 * once either way.
 *
 * It is OFF by default, which is also why `showAll` no longer touches it — see
 * `useCountdownSwitches`.
 */
function CalendarFilterSection({
  switches,
  set,
}: {
  switches: CalendarPreviewSwitches;
  set: (key: keyof CalendarPreviewSwitches, on: boolean) => void;
}) {
  return (
    <SheetSection title="Calendar" headingId="filter-calendar">
      <ToggleRow
        label="Pause countdowns"
        checked={switches.pauseRotation}
        onChange={(on) => set("pauseRotation", on)}
      />
      <ToggleRow
        label="Task progress"
        checked={switches.taskProgress}
        onChange={(on) => set("taskProgress", on)}
      />
    </SheetSection>
  );
}

/**
 * A Label wears its colour where a Profile wears its face — the same 32 px
 * circle, so the two lists read as one column. Decorative: the name is
 * rendered beside it, so colour is never the only carrier (FR-039).
 */
function ColorSwatch({ color }: { color: PaletteColor }) {
  return (
    <span
      aria-hidden="true"
      style={{ backgroundColor: color }}
      className="h-8 w-8 shrink-0 rounded-full"
    />
  );
}

export function FilterSheet() {
  const { profiles, labels, hiddenIds, setHidden, showAll, avatarUrls, visibilityPersists } =
    useFamily();
  const taskFilters = useTaskFilters();
  const listFilters = useListFilters();
  const mealSwitch = useCalendarMealSwitch();
  const previewSwitches = useCountdownSwitches();
  const [open, setOpen] = useState(false);
  const dialogRef = useModalDialog(open);
  const buttonRef = useRef<HTMLButtonElement>(null);

  function close(): void {
    setOpen(false);
    buttonRef.current?.focus();
  }

  /** One control, every per-device store (R319; 005 R509) — the honest meaning of "all". */
  function showEverything(): void {
    showAll();
    taskFilters.showAll();
    listFilters.showAll();
    mealSwitch.showAll();
    previewSwitches.showAll();
  }

  return (
    <>
      {/*
       * A circle carrying the eye, no label — the operator's call, and the same
       * shape as DayNav's arrows so every icon-only control in the shell is one
       * round target.
       *
       * `aria-label` is now the ONLY thing that names it. The word "Filter" was
       * the accessible name while it was on screen; dropping the text without
       * this leaves a button announced as nothing, and the icon is `aria-hidden`
       * precisely because the text used to carry the name. The browser journeys
       * find this control by that name too.
       */}
      <button
        ref={buttonRef}
        type="button"
        aria-label="Filter"
        onClick={() => setOpen(true)}
        className="fam-glyph-btn grid h-(--fam-touch) w-(--fam-touch) shrink-0 place-items-center rounded-full bg-(--fam-glyph-bg) text-(--fam-glyph-ink)"
      >
        <EyeOff size={20} strokeWidth={1.5} aria-hidden="true" />
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby="filter-title"
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
        className="m-auto w-[min(92vw,26rem)] rounded-(--fam-radius-modal) bg-(--fam-app-bg) p-6 text-(--fam-text-primary) backdrop:bg-black/30"
      >
        <DialogClose onClose={close} />
        <h2 id="filter-title" className="pr-(--fam-touch) font-(family-name:--fam-font-serif) text-(length:--fam-fs-title)">
          Show on this device
        </h2>

        <VisibilitySection
          title="Profiles"
          headingId="filter-profiles"
          categories={profiles}
          hiddenIds={hiddenIds}
          setHidden={setHidden}
          visualOf={(profile) => (
            <Avatar category={profile} size={32} photoUrl={avatarUrls[profile.id]} />
          )}
        />

        <VisibilitySection
          title="Labels"
          headingId="filter-labels"
          categories={labels}
          hiddenIds={hiddenIds}
          setHidden={setHidden}
          visualOf={(label) => <ColorSwatch color={label.color} />}
        />

        <TaskFilterSection filters={taskFilters.filters} setFilter={taskFilters.setFilter} />

        <ListFilterSection filters={listFilters.filters} setFilter={listFilters.setFilter} />

        <MealFilterSection showMeals={mealSwitch.showMeals} setShowMeals={mealSwitch.setShowMeals} />

        <CalendarFilterSection switches={previewSwitches.switches} set={previewSwitches.set} />

        {visibilityPersists && taskFilters.persistent && listFilters.persistent && mealSwitch.persistent ? null : (
          <p className="mt-3 text-(length:--fam-fs-small) text-(--fam-text-secondary)">
            Filters won&rsquo;t be remembered on this device.
          </p>
        )}

        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={showEverything}
            className="min-h-[44px] rounded-full border border-(--fam-hairline) px-5 text-(length:--fam-fs-body) font-medium"
          >
            Show all
          </button>
          <button
            type="button"
            onClick={close}
            className="min-h-[44px] rounded-full bg-(--fam-primary-blue) px-5 text-(length:--fam-fs-body) font-medium text-white"
          >
            Done
          </button>
        </div>
      </dialog>
    </>
  );
}
