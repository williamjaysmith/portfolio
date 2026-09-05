"use client";

import { useSyncExternalStore } from "react";

import { createDeviceListeners, readDeviceJson, writeDeviceJson } from "./deviceStorage";

/**
 * A per-device store of named boolean switches, kept in `localStorage` under
 * one key — the shape `useTaskFilters` (Phase 3, FR-383) and `useRewardFilters`
 * (Phase 4, FR-426) share. Each tab builds its own store from its own defaults
 * and key; nothing here decides what a switch MEANS.
 *
 * Why a factory and not one widened store: a device's stored task switches
 * must never be reparsed against a different shape, so every set of switches
 * gets a key of its own and a parser that knows exactly its keys. Phase 1's
 * `useDeviceVisibility` is NOT on this — it is a `Set<string>` of category ids
 * with prune-against-known semantics, a different type entirely, and shipped.
 *
 * Display only: a switch is per device, never leaves it and changes no stored
 * data. When storage is unavailable (private mode, quota, a browser that blocks
 * it) the switches still work for the session and `persistent` reports false,
 * per constitution §VI.
 */

/** Any object whose every field is a boolean — an interface qualifies. */
export type Switches<S> = { readonly [K in keyof S]: boolean };

export interface DeviceSwitchesConfig<S extends Switches<S>> {
  /** The `localStorage` key — versioned, one per set of switches. */
  storageKey: string;
  /** What a fresh device shows, and what the server renders. */
  defaults: S;
}

export interface DeviceSwitchesSnapshot<S> {
  switches: S;
  /** False once storage has refused — the UI says the choice won't be remembered. */
  persistent: boolean;
}

export interface DeviceSwitches<S extends Switches<S>> {
  /** The `useSyncExternalStore` binding: call it from a hook or a component. */
  useSwitches: () => DeviceSwitchesSnapshot<S>;
  /** Flip one switch; a no-op when it already reads that way. */
  set: (key: keyof S, on: boolean) => void;
  /** Replace every switch at once; a no-op when nothing actually changes. */
  replace: (next: S) => void;
  /** Test seam: back to the defaults, storage unread. */
  reset: () => void;
}

export function createDeviceSwitches<S extends Switches<S>>(
  config: DeviceSwitchesConfig<S>,
): DeviceSwitches<S> {
  const { storageKey, defaults } = config;
  const keys = Object.keys(defaults) as (keyof S)[];

  let switches: S = defaults;
  let persistent = true;
  let loaded = false;
  const listeners = createDeviceListeners();

  /** A stored switch, or its default — a corrupt half never poisons the others. */
  function booleanAt(source: Record<string, unknown>, key: keyof S): boolean {
    const value = source[key as string];
    return typeof value === "boolean" ? value : defaults[key];
  }

  function parse(stored: unknown): S {
    if (stored === null || typeof stored !== "object" || Array.isArray(stored)) return defaults;
    const source = stored as Record<string, unknown>;
    return Object.fromEntries(keys.map((key) => [key, booleanAt(source, key)])) as S;
  }

  function load(): void {
    if (loaded) return;
    loaded = true;
    try {
      const stored = readDeviceJson(storageKey);
      if (stored !== undefined) switches = parse(stored);
    } catch {
      // Unreadable, corrupt, or storage refused: fall back to the defaults and
      // say the choice will not be remembered rather than crash the tab.
      persistent = false;
    }
  }

  function save(): void {
    if (!writeDeviceJson(storageKey, switches)) persistent = false;
  }

  /** The one write path: a new object only when something actually changed. */
  function commit(next: S): void {
    load();
    if (keys.every((key) => next[key] === switches[key])) return;
    switches = next;
    save();
    listeners.emit();
  }

  function subscribe(listener: () => void): () => void {
    load();
    return listeners.add(listener);
  }

  function getSnapshot(): S {
    load();
    return switches;
  }

  /** The server cannot know this device's switches; it renders the defaults. */
  function getServerSnapshot(): S {
    return defaults;
  }

  function useSwitches(): DeviceSwitchesSnapshot<S> {
    const current = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
    return { switches: current, persistent };
  }

  return {
    useSwitches,
    set: (key, on) => {
      load();
      commit({ ...switches, [key]: on });
    },
    replace: commit,
    reset: () => {
      switches = defaults;
      persistent = true;
      loaded = false;
      listeners.emit();
    },
  };
}
