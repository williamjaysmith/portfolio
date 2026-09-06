"use client";

import { useSyncExternalStore } from "react";

import { createDeviceListeners, readDeviceJson, writeDeviceJson } from "./deviceStorage";

/**
 * A per-device set of string keys, kept in `localStorage` under one versioned
 * key — the shape the Lists tab's folded sections take (005 R509, FR-531):
 * dynamic keys, which `createDeviceSwitches` (fixed booleans) does not model,
 * and no pruning against a known list, which `useDeviceVisibility` (category
 * ids) does. A factory, like the switches: each store owns its key and its
 * parser, so a stored shape is never reparsed against another.
 *
 * Display only: a key is per device, never leaves it and changes no household
 * data. When storage is unavailable the set still works for the session and
 * `persistent` reports false (constitution §VI).
 */

const EMPTY: ReadonlySet<string> = new Set();

export interface DeviceKeySetSnapshot {
  keys: ReadonlySet<string>;
  /** False once storage has refused — the UI says the choice won't be remembered. */
  persistent: boolean;
}

export interface DeviceKeySet {
  /** The `useSyncExternalStore` binding: call it from a hook or a component. */
  useKeys: () => DeviceKeySetSnapshot;
  has: (key: string) => boolean;
  add: (key: string) => void;
  remove: (key: string) => void;
  toggle: (key: string) => void;
  /** Test seam: back to empty, storage unread. */
  reset: () => void;
}

export function createDeviceKeySet(storageKey: string): DeviceKeySet {
  let keys: ReadonlySet<string> = EMPTY;
  let persistent = true;
  let loaded = false;
  const listeners = createDeviceListeners();

  /** A stored list of strings, or nothing — a corrupt value never crashes the tab. */
  function parse(stored: unknown): ReadonlySet<string> {
    if (!Array.isArray(stored)) return EMPTY;
    return new Set(stored.filter((one): one is string => typeof one === "string"));
  }

  function load(): void {
    if (loaded) return;
    loaded = true;
    try {
      const stored = readDeviceJson(storageKey);
      if (stored !== undefined) keys = parse(stored);
    } catch {
      persistent = false;
    }
  }

  function commit(next: ReadonlySet<string>): void {
    keys = next;
    if (!writeDeviceJson(storageKey, [...next])) persistent = false;
    listeners.emit();
  }

  function add(key: string): void {
    load();
    if (keys.has(key)) return;
    commit(new Set([...keys, key]));
  }

  function remove(key: string): void {
    load();
    if (!keys.has(key)) return;
    const next = new Set(keys);
    next.delete(key);
    commit(next);
  }

  function subscribe(listener: () => void): () => void {
    load();
    return listeners.add(listener);
  }

  function getSnapshot(): ReadonlySet<string> {
    load();
    return keys;
  }

  /** The server cannot know this device's keys; it renders none. */
  function getServerSnapshot(): ReadonlySet<string> {
    return EMPTY;
  }

  return {
    useKeys() {
      const current = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
      return { keys: current, persistent };
    },
    has(key) {
      load();
      return keys.has(key);
    },
    add,
    remove,
    toggle(key) {
      load();
      if (keys.has(key)) remove(key);
      else add(key);
    },
    reset() {
      keys = EMPTY;
      persistent = true;
      loaded = false;
      listeners.emit();
    },
  };
}
