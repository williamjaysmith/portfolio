"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Per-device profile visibility (FR-033).
 *
 * This is a view preference, not household data: the tablet and a phone can
 * show different subsets, so it lives in `localStorage` rather than the
 * database. When storage is unavailable (private mode, quota, a browser that
 * blocks it) the choice still works for the session and `persistent` reports
 * false, per constitution §VI.
 */

const STORAGE_KEY = "family:hidden-categories:v1";

let hidden: ReadonlySet<string> = new Set();
let persistent = true;
let loaded = false;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function load(): void {
  if (loaded) return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      hidden = new Set(parsed.filter((id): id is string => typeof id === "string"));
    }
  } catch {
    // Unreadable or corrupt: fall back to "show everyone" rather than crash.
    persistent = false;
  }
}

function save(): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...hidden]));
  } catch {
    persistent = false;
  }
}

function subscribe(listener: () => void): () => void {
  load();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): ReadonlySet<string> {
  load();
  return hidden;
}

const EMPTY: ReadonlySet<string> = new Set();

/** The server cannot know this device's preference; it renders everyone. */
function getServerSnapshot(): ReadonlySet<string> {
  return EMPTY;
}

function setHiddenId(id: string, isHidden: boolean): void {
  load();
  const next = new Set(hidden);
  if (isHidden) next.add(id);
  else next.delete(id);
  if (next.size === hidden.size) return;
  hidden = next;
  save();
  emit();
}

function showAllIds(): void {
  load();
  if (hidden.size === 0) return;
  hidden = new Set();
  save();
  emit();
}

/** Drop ids that no longer exist, so a deleted profile cannot stay hidden forever. */
function pruneToIds(ids: readonly string[]): void {
  load();
  if (hidden.size === 0) return;
  const known = new Set(ids);
  const next = new Set([...hidden].filter((id) => known.has(id)));
  if (next.size === hidden.size) return;
  hidden = next;
  save();
  emit();
}

export interface DeviceVisibility {
  hiddenIds: ReadonlySet<string>;
  setHidden: (id: string, hidden: boolean) => void;
  showAll: () => void;
  pruneTo: (ids: readonly string[]) => void;
  /** False once a write has failed — the UI says filters won't be remembered. */
  persistent: boolean;
}

export function useDeviceVisibility(): DeviceVisibility {
  const hiddenIds = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const setHidden = useCallback((id: string, isHidden: boolean) => setHiddenId(id, isHidden), []);
  const showAll = useCallback(() => showAllIds(), []);
  const pruneTo = useCallback((ids: readonly string[]) => pruneToIds(ids), []);
  return { hiddenIds, setHidden, showAll, pruneTo, persistent };
}

/** Test seam: reset the module store between cases. */
export function resetDeviceVisibility(): void {
  hidden = new Set();
  persistent = true;
  loaded = false;
  emit();
}
