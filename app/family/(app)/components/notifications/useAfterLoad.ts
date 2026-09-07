"use client";

import { useSyncExternalStore } from "react";

/**
 * Whether the page has finished loading.
 *
 * The reminder banner reads the household's events over the whole reminder
 * horizon, and it does that from the app SHELL — so without this it fires on
 * every route, during hydration, competing with the work that makes the page
 * usable. It cost a browser journey that types into a field the moment the page
 * appears: the text went in before React had taken over, and hydration replaced
 * it with the server's empty value.
 *
 * A banner about something happening in ten minutes has no business delaying
 * first paint by even a little. It waits for `load`, and nothing about a
 * reminder is worse for it.
 *
 * `useSyncExternalStore` rather than a mount effect, for the reason every other
 * client-only value in this app uses it: no extra render, a correct server
 * snapshot, and no synchronous `setState` inside an effect.
 */

function subscribe(onChange: () => void): () => void {
  if (document.readyState === "complete") return () => {};
  window.addEventListener("load", onChange, { once: true });
  return () => window.removeEventListener("load", onChange);
}

function loadedSnapshot(): boolean {
  return document.readyState === "complete";
}

/** The server has not loaded anything; it renders as though nothing is ready. */
function serverSnapshot(): boolean {
  return false;
}

export function useAfterLoad(): boolean {
  return useSyncExternalStore(subscribe, loadedSnapshot, serverSnapshot);
}
