"use client";

import type { TaskFilters } from "@/lib/family/types";

import { createDeviceSwitches } from "@/app/family/(app)/components/useDeviceSwitches";

/**
 * T067 / R319: the four per-device task switches — **Completed tasks**, **Late
 * chores**, **Skipped tasks** and **Up for Grabs** (FR-383).
 *
 * Two per-device stores, deliberately. The per-Profile toggle rides Phase 1's
 * shipped `useDeviceVisibility` unchanged — a `Set<string>` of generic
 * *category* ids with prune-against-known semantics, so a Profile hidden on
 * the calendar is hidden here and no shipped device's preference is orphaned.
 * These four booleans are a different type with no pruning, so they get a key
 * of their own rather than a widened one that would strand every stored set.
 * The storage mechanics are `useDeviceSwitches`, shared with Phase 4's
 * Redeemed switch (R409).
 *
 * **Skipped starts OFF** (FR-361: a skipped occurrence appears only when its
 * switch is on); the other three start on. What the switches MEAN to the board
 * is `lib/family/tasks/visibility.ts` (FR-383), applied below the counter
 * branch, which is what keeps FR-384's "filters never move the counters" a
 * property of the memo chain rather than an `if` in four components.
 *
 * Display only: the choice is per device, never leaves it, changes no stored
 * data and is a different thing entirely from FR-313's household-wide **Show
 * on Tasks tab**, which removes a Profile's column everywhere and withdraws it
 * from the assignment picker. When storage is unavailable (private mode,
 * quota, a browser that blocks it) the switches still work for the session and
 * `persistent` reports false, per constitution §VI.
 */

/** FR-361: everything shown except skipped occurrences. */
const DEFAULTS: TaskFilters = {
  completed: true,
  late: true,
  skipped: false,
  upForGrabs: true,
};

/** What one **Show all** leaves behind: nothing hidden, skipped included. */
const EVERYTHING: TaskFilters = {
  completed: true,
  late: true,
  skipped: true,
  upForGrabs: true,
};

const store = createDeviceSwitches<TaskFilters>({
  storageKey: "family:task-filters:v1",
  defaults: DEFAULTS,
});
const useStoredTaskSwitches = store.useSwitches;

/** Module-level so its identity is stable across renders without a memo. */
function showEverything(): void {
  store.replace(EVERYTHING);
}

export interface TaskFilterStore {
  filters: TaskFilters;
  setFilter: (key: keyof TaskFilters, on: boolean) => void;
  /** Everything shown again — the sheet's one **Show all** calls this and the
   * shipped category store's, so both per-device choices clear together. */
  showAll: () => void;
  /** False once storage has refused — the sheet says filters won't be remembered. */
  persistent: boolean;
}

export function useTaskFilters(): TaskFilterStore {
  const { switches, persistent } = useStoredTaskSwitches();
  return { filters: switches, setFilter: store.set, showAll: showEverything, persistent };
}

/** Test seam: reset the module store between cases. */
export function resetTaskFilters(): void {
  store.reset();
}
