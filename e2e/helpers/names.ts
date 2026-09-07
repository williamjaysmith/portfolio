import type { TestInfo } from "@playwright/test";

/**
 * 007 T012 — a name a journey owns (FR-706).
 *
 * One database serves the whole run, so a row a journey creates must be
 * findable by that journey and by no other. The name is derived from the
 * journey's own title, so it is stable across runs — a re-run finds the same
 * name — and unique within one, and it reads in the interface as what it is:
 * `Toast · lists 4`.
 */

/** A short, stable tag for the journey that is running. */
export function journeyTag(testInfo: TestInfo): string {
  const file = testInfo.titlePath[0]?.replace(/\.spec\.ts$/, "") ?? "e2e";
  return `${file} ${testInfo.line}`;
}

/** `unique("Toast")` → `"Toast · lists 42"`. Everything a journey creates carries one. */
export function unique(base: string, testInfo: TestInfo): string {
  return `${base} · ${journeyTag(testInfo)}`;
}
