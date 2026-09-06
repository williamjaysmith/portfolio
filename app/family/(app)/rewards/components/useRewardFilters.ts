"use client";

import type { RewardFilters } from "@/lib/family/types";

import { createDeviceSwitches } from "@/app/family/(app)/components/useDeviceSwitches";

/**
 * T030 / R409: the Rewards tab's one per-device switch — **Redeemed** (FR-426).
 *
 * A third per-device store, deliberately. The per-Profile toggle rides Phase
 * 1's shipped `useDeviceVisibility` unchanged, so a Profile hidden on the
 * calendar is hidden here too; the task board's four booleans live in
 * `useTaskFilters` under their own key. This switch is a different type again,
 * so it gets a key of its own rather than a widened task-filters object that
 * would reparse every shipped device's stored switches against a new shape.
 * The storage mechanics are `useDeviceSwitches`, shared with the task board.
 *
 * **Redeemed starts OFF** (FR-425: only unredeemed rewards show until it is
 * on). What the switch MEANS to a column is decided where the cards are listed
 * (FR-426: one muted "Redeemed on" card per standing redemption, most recent
 * first, below the live cards), not here.
 *
 * Display only: the choice is per device, never leaves it and changes no
 * stored data. When storage is unavailable (private mode, quota, a browser
 * that blocks it) the switch still works for the session and `persistent`
 * reports false, per constitution §VI.
 */

/** FR-425/426: only unredeemed rewards until the switch is turned on. */
const DEFAULTS: RewardFilters = { redeemed: false };

const store = createDeviceSwitches<RewardFilters>({
  storageKey: "family:reward-filters:v1",
  defaults: DEFAULTS,
});
const useStoredRewardSwitches = store.useSwitches;

/** Module-level so its identity is stable across renders without a memo. */
function setRedeemedValue(on: boolean): void {
  store.set("redeemed", on);
}

export interface RewardFilterStore {
  filters: RewardFilters;
  setRedeemed: (on: boolean) => void;
  /** False once storage has refused — the tab says the switch won't be remembered. */
  persistent: boolean;
}

export function useRewardFilters(): RewardFilterStore {
  const { switches, persistent } = useStoredRewardSwitches();
  return { filters: switches, setRedeemed: setRedeemedValue, persistent };
}

/** Test seam: reset the module store between cases. */
export function resetRewardFilters(): void {
  store.reset();
}
