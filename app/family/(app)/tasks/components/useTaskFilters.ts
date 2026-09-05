"use client";

import { useCallback, useSyncExternalStore } from "react";

import type { TaskFilters } from "@/lib/family/types";

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

const STORAGE_KEY = "family:task-filters:v1";

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

const KEYS: readonly (keyof TaskFilters)[] = ["completed", "late", "skipped", "upForGrabs"];

let filters: TaskFilters = DEFAULTS;
let persistent = true;
let loaded = false;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

/** A stored switch, or its default — a corrupt half never poisons the others. */
function booleanAt(source: Record<string, unknown>, key: keyof TaskFilters): boolean {
  const value = source[key];
  return typeof value === "boolean" ? value : DEFAULTS[key];
}

function parse(raw: string): TaskFilters {
  const stored: unknown = JSON.parse(raw);
  if (stored === null || typeof stored !== "object" || Array.isArray(stored)) return DEFAULTS;
  const source = stored as Record<string, unknown>;
  return {
    completed: booleanAt(source, "completed"),
    late: booleanAt(source, "late"),
    skipped: booleanAt(source, "skipped"),
    upForGrabs: booleanAt(source, "upForGrabs"),
  };
}

function load(): void {
  if (loaded) return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) filters = parse(raw);
  } catch {
    // Unreadable, corrupt, or storage refused: fall back to the defaults and
    // say the choice will not be remembered rather than crash the board.
    persistent = false;
  }
}

function save(): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
  } catch {
    persistent = false;
  }
}

/** The one write path: a new object only when something actually changed. */
function commit(next: TaskFilters): void {
  if (KEYS.every((key) => next[key] === filters[key])) return;
  filters = next;
  save();
  emit();
}

function setFilterValue(key: keyof TaskFilters, on: boolean): void {
  load();
  commit({ ...filters, [key]: on });
}

function showEverything(): void {
  load();
  commit(EVERYTHING);
}

function subscribe(listener: () => void): () => void {
  load();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): TaskFilters {
  load();
  return filters;
}

/** The server cannot know this device's switches; it renders the defaults. */
function getServerSnapshot(): TaskFilters {
  return DEFAULTS;
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
  const current = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const setFilter = useCallback(
    (key: keyof TaskFilters, on: boolean) => setFilterValue(key, on),
    [],
  );
  const showAll = useCallback(() => showEverything(), []);
  return { filters: current, setFilter, showAll, persistent };
}

/** Test seam: reset the module store between cases. */
export function resetTaskFilters(): void {
  filters = DEFAULTS;
  persistent = true;
  loaded = false;
  emit();
}
