import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

// Vitest's `globals` option is off in this repo, so the global `afterEach`
// that @testing-library/react's auto-cleanup relies on is never defined and
// rendered DOM trees silently accumulate across tests in the same file.
// Register cleanup explicitly so each test starts from an empty document.
afterEach(() => {
  cleanup();
});

// `server-only` throws the moment it is imported outside a React Server
// Component graph. Component tests legitimately pull in modules that reach it
// transitively (a client component importing a server action's module), so it
// is made inert for tests rather than each file re-declaring the same mock.
vi.mock("server-only", () => ({}));

// Node 22+ ships an experimental global `localStorage` that is unusable
// without `--localstorage-file` (accessing it warns and returns undefined).
// Because that global already exists on `globalThis` before vitest's jsdom
// environment installs its own globals, and `localStorage` isn't part of
// vitest's recognized window-key allowlist, the real jsdom implementation
// never gets copied over — leaving `localStorage`/`window.localStorage`
// broken in every test. Replace it with a small in-memory Storage-compatible
// polyfill so tests can rely on standard localStorage behavior.
class MemoryStorage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  key(index: number): string | null {
    return [...this.store.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

for (const key of ["localStorage", "sessionStorage"] as const) {
  Object.defineProperty(globalThis, key, {
    value: new MemoryStorage() as unknown as Storage,
    configurable: true,
    writable: true,
  });
}
