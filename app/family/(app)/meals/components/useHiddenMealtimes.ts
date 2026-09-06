"use client";

import { useCallback } from "react";

import { createDeviceKeySet } from "../../components/useDeviceKeySet";

/**
 * Which mealtimes this device has hidden (006 FR-611, R609): a per-device set
 * of mealtime ids, never written to the household — hiding Lunch on the wall
 * must not hide it on Ben's phone. The rows leave the grid and the tokens
 * leave the calendar; every meal stays planned.
 */

const store = createDeviceKeySet("family:meal-hidden:v1");

export interface HiddenMealtimes {
  hiddenIds: ReadonlySet<string>;
  isHidden: (categoryId: string) => boolean;
  toggle: (categoryId: string) => void;
  /** False once storage has refused — the sheet says the choice won't be remembered. */
  persistent: boolean;
}

export function useHiddenMealtimes(): HiddenMealtimes {
  const { keys, persistent } = store.useKeys();
  const isHidden = useCallback((categoryId: string) => keys.has(categoryId), [keys]);
  const toggle = useCallback((categoryId: string) => store.toggle(categoryId), []);
  return { hiddenIds: keys, isHidden, toggle, persistent };
}

/** Test seam. */
export function resetHiddenMealtimes(): void {
  store.reset();
}
