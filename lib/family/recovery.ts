/**
 * Recognising the failures a reload actually fixes, and reloading properly.
 *
 * **Why this exists at all.** The household hit "Application error: a
 * client-side exception has occurred" on a phone, and nothing recorded what
 * threw — this repo has no error reporting and, until now, no error boundary
 * anywhere. The exception was gone. A hunt across the deployed diff came back
 * with nothing it could confirm, so the cause is still unknown; what is certain
 * is that the next one must not vanish the same way.
 *
 * **Why a chunk failure is singled out.** It is the one uncaught error where
 * the right response is automatic, because the page cannot recover in place.
 * This project builds with Turbopack, whose browser runtime loads chunks with a
 * plain `<script>` tag and, on `onerror`, synthesises its own error — so the
 * shape is identical in Safari and Chrome, and the webkit/chrome message
 * variants ("Importing a module script failed.", "Failed to fetch dynamically
 * imported module") never appear on this build. `name === "ChunkLoadError"` is
 * the stable test across both bundlers; the message pattern is belt and braces
 * in case the build ever drops `--turbopack`.
 *
 * Retrying the import is pointless and was rejected: the runtime caches the
 * loading promise per chunk URL, so a second attempt returns the same rejection.
 * A document reload is the only cure.
 */

/** Turbopack: `Failed to load chunk …`. Webpack: `Loading chunk N failed.` */
const CHUNK_MESSAGE = /Failed to load chunk|Loading chunk \S+ failed/i;

/**
 * Is this the error that means "the JS this page wants is no longer there"?
 *
 * Duck-typed rather than `instanceof Error`, because what a framework hands an
 * error boundary is not guaranteed to be a same-realm `Error` — a serialised
 * one carries the same `name` and `message` and should be treated the same.
 */
export function isChunkLoadError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;

  const { name, message } = error as { name?: unknown; message?: unknown };
  if (name === "ChunkLoadError") return true;
  return typeof message === "string" && CHUNK_MESSAGE.test(message);
}

/**
 * The same cache-busting navigation `ReloadSection` has always used, extracted
 * so the two callers cannot drift.
 *
 * **Not `location.reload()`**, which a browser is free to satisfy entirely from
 * cache — the exact thing that is broken when a chunk 404s. A URL the cache has
 * never seen forces a real fetch. The parameter is inert: nothing on these
 * routes reads the query string.
 */
export function cacheBustedUrl(href: string, stamp: number): string {
  const url = new URL(href);
  url.searchParams.set("reload", String(stamp));
  return url.toString();
}
