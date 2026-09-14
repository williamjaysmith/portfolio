"use client";

import { cacheBustedUrl } from "@/lib/family/recovery";

import { SectionHeading } from "./SectionHeading";

/**
 * A way to reload the app from inside it (014).
 *
 * **Why it has to exist.** Added to the home screen, `/family` runs in a
 * standalone window with no address bar — and therefore no reload button, no
 * pull-to-refresh, and no way to reach a browser menu. The operator hit it
 * while testing on the iPad: "once you add it theres actually no way to refresh
 * the full url/page … do i need to delete it every time and re add to
 * homescreen". No: this button.
 *
 * **What it actually clears, and what it does not.** This app registers NO
 * service worker, so there is no app-shell cache holding a stale build — that
 * was checked rather than assumed. What does go stale is the HTTP cache for the
 * JS and CSS chunks, and a standalone window that has simply been open for
 * days. So: a cache-busting navigation rather than `location.reload()`, which a
 * browser is free to serve entirely from cache.
 *
 * The query parameter is stripped from what the user sees by navigating to the
 * bare path afterwards being unnecessary — `?reload=` is harmless and the app
 * reads no query parameters on this route.
 *
 * The navigation itself moved to `cacheBustedUrl` in `lib/family/recovery.ts`
 * when `app/family/error.tsx` needed the same thing: two hand-rolled copies of
 * "reload in a way the cache cannot satisfy" would be two places to get it
 * wrong.
 */
export function ReloadSection() {
  function reload() {
    window.location.replace(cacheBustedUrl(window.location.href, Date.now()));
  }

  return (
    <section aria-labelledby="reload-heading" className="flex flex-col gap-3">
      <SectionHeading id="reload-heading">This device</SectionHeading>
      <p className="text-(length:--fam-fs-body) text-(--fam-text-secondary)">
        Added to the home screen there is no address bar, so this is the way to
        pick up a new version of the app.
      </p>
      <button
        type="button"
        onClick={reload}
        className="min-h-(--fam-touch) w-fit rounded-full border border-(--fam-hairline) px-6 text-(length:--fam-fs-body) font-medium"
      >
        Reload the app
      </button>
    </section>
  );
}
