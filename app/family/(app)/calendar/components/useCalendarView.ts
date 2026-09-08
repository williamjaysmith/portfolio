"use client";

import { useCallback, useSyncExternalStore } from "react";

import { DEFAULT_VIEW, isCalendarView, type CalendarView } from "@/lib/family/calendar/views";

import { readDeviceJson, writeDeviceJson } from "../../components/deviceStorage";

/**
 * Which view this device's calendar is showing (011 R1111, FR-1102).
 *
 * A per-device choice, like every other display choice in this project: a
 * phone wants Day where the wall tablet wants Week, and a household setting
 * would force them to agree (spec Assumption 2).
 *
 * It is a sibling of `createDeviceSwitches` rather than a use of it, because
 * that factory holds BOOLEANS and a view is one of three names. Encoding three
 * names as two booleans would make an impossible fourth state representable,
 * so this keeps the same storage, the same `persistent` flag and the same
 * read-with-try/catch discipline, over one string.
 *
 * `useSyncExternalStore` is this repo's idiom for a client-only value: the
 * server renders the default and the store publishes the stored one on the
 * first client render, with no mount effect (which the React lint rightly
 * refuses).
 */

const STORAGE_KEY = "family:calendar-view:v1";

interface Stored {
  view: CalendarView;
}

let current: CalendarView = DEFAULT_VIEW;
let persistent = true;
let loaded = false;

const listeners = new Set<() => void>();

/**
 * An unreadable or unrecognised value falls back to the default rather than
 * throwing: a private window, cleared site data, or a `v1` key written by some
 * future version must all leave the calendar working.
 */
function load(): void {
  if (loaded) return;
  loaded = true;
  try {
    const stored = readDeviceJson(STORAGE_KEY) as Stored | undefined;
    if (stored !== undefined && isCalendarView(stored.view)) current = stored.view;
  } catch {
    persistent = false;
  }
}

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): CalendarView {
  load();
  return current;
}

/** The server has no device, so it renders the default and hydrates into the stored one. */
function getServerSnapshot(): CalendarView {
  return DEFAULT_VIEW;
}

export interface CalendarViewState {
  view: CalendarView;
  setView: (next: CalendarView) => void;
  /** False when this device cannot remember the choice — the UI may say so. */
  persistent: boolean;
}

export function useCalendarView(): CalendarViewState {
  const view = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setView = useCallback((next: CalendarView) => {
    load();
    if (next === current) return;
    current = next;
    try {
      writeDeviceJson(STORAGE_KEY, { view: next } satisfies Stored);
    } catch {
      persistent = false;
    }
    emit();
  }, []);

  return { view, setView, persistent };
}

/** Test seam. */
export function resetCalendarView(): void {
  current = DEFAULT_VIEW;
  persistent = true;
  loaded = false;
  emit();
}
