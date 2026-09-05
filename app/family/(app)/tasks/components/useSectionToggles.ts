"use client";

import { useCallback, useState } from "react";

import { timeOfDayAt } from "@/lib/family/tasks/dates";
import type { TimeOfDay } from "@/lib/family/types";

import { useNow } from "../../components/Clock";

/**
 * The four section switches per column (FR-306, FR-307, Assumption 10, R322).
 *
 * The automatic selection is a DERIVATION of the same shared clock the day
 * anchor rides — `timeOfDayAt` against FR-306's boundaries, read in the
 * household's zone — so no timer of this hook's own exists. Chores is not a
 * time of day: it starts on, composes with any of them, and never competes.
 *
 * A manual change is a per-column override stored against the window it was
 * made under. That single field is the whole of Assumption 10's lifetime
 * rule: when the derived window changes, the stored window stops matching and
 * the map stops being read, so "the automatic selection re-asserts at the next
 * boundary" happens by a value changing rather than by an event being
 * scheduled. Overrides are component state and deliberately unpersisted —
 * they expire at a boundary they were about to lose anyway.
 */

/** The four sections a column renders. Chores is the one that is not a time of day. */
export type TaskSectionKey = TimeOfDay | "chores";

export type SectionToggles = Record<TaskSectionKey, boolean>;

/** The sections one column has been manually moved away from the clock's choice. */
type ColumnOverrides = Partial<SectionToggles>;

interface OverrideState {
  /** The window the overrides were made under; `null` until one is made. */
  window: TimeOfDay | null;
  byColumn: Record<string, ColumnOverrides>;
}

const NO_OVERRIDES: Record<string, ColumnOverrides> = {};
const INITIAL: OverrideState = { window: null, byColumn: NO_OVERRIDES };

export interface UseSectionTogglesOptions {
  /** Household IANA zone (FR-284) — the windows are ITS noon and six, not the device's. */
  zone: string;
  /**
   * The window the server read at render time (R314). `useNow` is `null` on
   * the server and through hydration, and without this the wall tablet would
   * paint Morning at eight in the evening and then flip.
   */
  initialWindow: TimeOfDay;
}

export interface SectionTogglesState {
  /** The clock's current window (FR-306) — what re-asserts at each boundary. */
  activeWindow: TimeOfDay;
  /** The four switches for one column, overrides applied over the clock's choice. */
  sectionsFor: (columnId: string) => SectionToggles;
  /** FR-307: four independent switches — this flips exactly one, for one column. */
  toggleSection: (columnId: string, section: TaskSectionKey) => void;
}

/** FR-306's automatic selection: one time of day on, and Chores always on. */
function automaticSections(window: TimeOfDay): SectionToggles {
  return {
    morning: window === "morning",
    afternoon: window === "afternoon",
    evening: window === "evening",
    chores: true,
  };
}

/** An override wins where it exists; every other switch stays the clock's. */
function withOverrides(automatic: SectionToggles, overrides: ColumnOverrides): SectionToggles {
  return {
    morning: overrides.morning ?? automatic.morning,
    afternoon: overrides.afternoon ?? automatic.afternoon,
    evening: overrides.evening ?? automatic.evening,
    chores: overrides.chores ?? automatic.chores,
  };
}

export function useSectionToggles(options: UseSectionTogglesOptions): SectionTogglesState {
  const { zone, initialWindow } = options;
  const now = useNow();
  const [overrides, setOverrides] = useState<OverrideState>(INITIAL);

  const activeWindow = now === null ? initialWindow : timeOfDayAt(zone, now.getTime());
  // Assumption 10, and the only place the expiry lives: overrides made under a
  // window that has since passed are simply not read.
  const live = overrides.window === activeWindow ? overrides.byColumn : NO_OVERRIDES;

  const sectionsFor = useCallback(
    (columnId: string) => withOverrides(automaticSections(activeWindow), live[columnId] ?? {}),
    [activeWindow, live],
  );

  const toggleSection = useCallback(
    (columnId: string, section: TaskSectionKey) => {
      setOverrides((previous) => {
        const base = previous.window === activeWindow ? previous.byColumn : NO_OVERRIDES;
        const column = base[columnId] ?? {};
        // Flipping what is on screen, which is the automatic choice until an
        // override for THIS switch exists.
        const shown = withOverrides(automaticSections(activeWindow), column)[section];
        return {
          window: activeWindow,
          byColumn: { ...base, [columnId]: { ...column, [section]: !shown } },
        };
      });
    },
    [activeWindow],
  );

  return { activeWindow, sectionsFor, toggleSection };
}
