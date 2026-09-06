"use client";

import { useCallback } from "react";

import { createDeviceKeySet } from "../../components/useDeviceKeySet";

/**
 * Which sections this device has folded away (005 FR-531, R509): a per-device
 * set keyed `<listId> <section>`, never written to the household — Ana folding
 * Dairy on the wall must not fold it on Ben's phone. The header and its count
 * stay while folded; only the rows hide.
 */

const store = createDeviceKeySet("family:list-folds:v1");

export function foldKeyOf(listId: string, section: string): string {
  return `${listId} ${section}`;
}

export interface ListFolds {
  isFolded: (listId: string, section: string) => boolean;
  toggle: (listId: string, section: string) => void;
  /** False once storage has refused — the tab says the fold won't be remembered. */
  persistent: boolean;
}

export function useListFolds(): ListFolds {
  const { keys, persistent } = store.useKeys();
  const isFolded = useCallback((listId: string, section: string) => keys.has(foldKeyOf(listId, section)), [keys]);
  const toggle = useCallback((listId: string, section: string) => store.toggle(foldKeyOf(listId, section)), []);
  return { isFolded, toggle, persistent };
}

/** Test seam. */
export function resetListFolds(): void {
  store.reset();
}
