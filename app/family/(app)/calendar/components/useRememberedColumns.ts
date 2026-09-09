"use client";

import { useEffect } from "react";

import { columnCookieString } from "@/lib/family/calendar/device-columns";

/**
 * Tells the next server render how wide this device drew the week (012).
 *
 * The measurement itself belongs to `useGridGeometry`; all this does is put the
 * number somewhere a server can read it, because a cookie is the only thing a
 * browser sends before a page renders. Everything that makes the cookie safe —
 * what values are accepted back, how it is scoped — lives in
 * `lib/family/calendar/device-columns.ts`, which is pure and tested; this file
 * is the one line of DOM.
 *
 * **Only the Week view records anything.** The Day view fixes its own count at
 * one and the Month view is always seven, so either would write a number that
 * says nothing about how wide the device is, and the next Week paint would
 * start from a lie. `view` is the guard rather than a filter on the count,
 * because 1 and 7 are also counts a real week could legitimately want.
 *
 * A write per changed measurement, not per render: a resize that settles on the
 * same count is not news, and a rotation is.
 */
export function useRememberedColumns(columnCount: number, recording: boolean): void {
  useEffect(() => {
    if (!recording) return;
    document.cookie = columnCookieString(columnCount);
  }, [columnCount, recording]);
}
