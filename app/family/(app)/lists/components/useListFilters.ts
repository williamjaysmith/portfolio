"use client";

import type { ListFilters } from "@/lib/family/types";

import { createDeviceSwitches } from "../../components/useDeviceSwitches";

/**
 * The Lists tab's one per-device switch (005 FR-520, R509): **Completed
 * items**, on by default so checked items stay in place, struck through, until
 * cleared (FR-519). Off, they are hidden on THIS device only — the badge and
 * the section counts never move (FR-505), because `itemsShownOf` is applied
 * below the counts.
 *
 * Its own versioned key, on the shipped switch-store factory, for the reason
 * `useRewardFilters` had one: a stored shape is never reparsed against another.
 * Surfaced in the shared Filter sheet's Lists section (T039), where the
 * reference puts it (37275069922971 — the top-bar Filter).
 */

const store = createDeviceSwitches<ListFilters>({
  storageKey: "family:list-filters:v1",
  defaults: { completed: true },
});

export interface ListFilterStore {
  filters: ListFilters;
  setFilter: (key: keyof ListFilters, on: boolean) => void;
  /** The Filter sheet's "Show all": every switch back on. */
  showAll: () => void;
  /** False once storage has refused — the sheet says the choice won't be remembered. */
  persistent: boolean;
}

export function useListFilters(): ListFilterStore {
  const { switches, persistent } = store.useSwitches();
  return { filters: switches, setFilter: store.set, showAll: () => store.replace({ completed: true }), persistent };
}

/** Test seam. */
export function resetListFilters(): void {
  store.reset();
}
