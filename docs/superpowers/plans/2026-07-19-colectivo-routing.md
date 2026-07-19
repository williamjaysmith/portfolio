# Colectivo Routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a mobile-first delivery-routing tool at `/colectivo/routes` where the driver picks a route, sees stops in a preferred order, taps for directions, reorders/adds/removes stops, marks stops delivered, and keeps per-cafe notes — persisted on-device.

**Architecture:** A single Next.js client page swaps between a route picker and a stop list. Pure logic (data helpers, reconciliation, state operations, storage) lives in `lib/` and is unit-tested in isolation; React components in `app/colectivo/routes/` render it and reuse the `/skyhammer` dnd-kit drag pattern. All persistence sits behind a `RouteStorage` interface so localStorage can later be swapped for a MongoDB-backed API without touching UI.

**Tech Stack:** Next.js 16 (app router) · React 19 · TypeScript (strict) · Tailwind v4 · `@dnd-kit/*` (installed) · `framer-motion` (installed) · `react-icons` (installed) · Vitest + Testing Library (added in Task 1).

## Global Constraints

- **Path alias:** `@/*` maps to the repo root (`tsconfig.json`). Import shared code as `@/lib/...`.
- **Spec of record:** `docs/superpowers/specs/2026-07-19-colectivo-routing-design.md`. Every decision below traces to it.
- **Routes:** exactly `milwaukee`, `madison`, `chicago`, `kegs`. Labels: Milwaukee, Madison, Chicago, Kegs.
- **Per-route colors:** Milwaukee `#2f5b8f` · Madison `#b5462e` · Chicago `#3f7d4e` · Kegs `#b4791f`.
- **Aesthetic:** charcoal `#2c2c2c` on cream `#fbf8f0`, bold type, Skyhammer-style borders.
- **Directions URL:** `https://www.google.com/maps/dir/?api=1&destination=<encoded address>&travelmode=driving` (no origin → routes from current location).
- **localStorage keys:** `colectivo:route:<routeId>` (`{ order, delivered }`) and `colectivo:notes` (`{ [stopId]: string }`). Notes are per-stop and never cleared by Reset.
- **Disclaimer copy (verbatim):** `📝 Notes are saved on this device only — clearing your browser data or switching phones will erase them.`
- **Directions icon:** `MdAssistantNavigation` from `react-icons/md`, charcoal-tinted.
- **Drag feel:** reuse Skyhammer's `PointerSensor` `activationConstraint: { delay: 250, tolerance: 5 }` so tap acts / press-hold drags. **Do not modify** `app/skyhammer/page.tsx`.
- Native = a stop id is present in that route's `stopIds`. Out-of-route = present in the working list but not native. Reset preserves notes.

---

### Task 1: Test infrastructure (Vitest + Testing Library)

**Files:**
- Modify: `package.json` (scripts + devDependencies)
- Create: `vitest.config.ts`
- Create: `vitest.setup.ts`
- Create: `lib/__tests__/smoke.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: a working `npm test` command running Vitest in a jsdom environment with `@testing-library/jest-dom` matchers and the `@/*` alias resolved.

- [ ] **Step 1: Install dev dependencies**

```bash
npm install -D vitest@^2 @vitejs/plugin-react@^4 jsdom@^25 \
  @testing-library/react@^16 @testing-library/jest-dom@^6 @testing-library/user-event@^14
```

- [ ] **Step 2: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    css: false,
  },
  resolve: {
    alias: { "@": resolve(__dirname, ".") },
  },
});
```

- [ ] **Step 3: Create `vitest.setup.ts`**

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 4: Add test scripts to `package.json`**

Add to the `"scripts"` block:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 5: Write a smoke test**

`lib/__tests__/smoke.test.ts`:

```ts
import { describe, it, expect } from "vitest";

describe("test harness", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 6: Run the test to verify the harness works**

Run: `npm test`
Expected: PASS — 1 passed.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vitest.config.ts vitest.setup.ts lib/__tests__/smoke.test.ts
git commit -m "chore: add Vitest test infrastructure"
```

---

### Task 2: Data module — types, seed data, pure helpers

**Files:**
- Create: `lib/colectivo.ts`
- Create: `lib/__tests__/colectivo.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type RouteId = "milwaukee" | "madison" | "chicago" | "kegs"`
  - `interface Stop { id: string; name: string; address: string; note?: string }`
  - `interface RouteDef { id: RouteId; label: string; color: string; stopIds: string[] }`
  - `const stops: Record<string, Stop>`
  - `const routes: RouteDef[]`
  - `function getRoute(id: RouteId): RouteDef | undefined`
  - `function isNative(stopId: string, routeId: RouteId): boolean`
  - `function homeRoutes(stopId: string): RouteDef[]`
  - `function directionsUrl(address: string): string`

- [ ] **Step 1: Write the failing tests**

`lib/__tests__/colectivo.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  routes,
  stops,
  getRoute,
  isNative,
  homeRoutes,
  directionsUrl,
} from "@/lib/colectivo";

describe("colectivo data", () => {
  it("defines exactly the four routes", () => {
    expect(routes.map((r) => r.id).sort()).toEqual([
      "chicago",
      "kegs",
      "madison",
      "milwaukee",
    ]);
  });

  it("every stopId in every route exists in the stops map", () => {
    for (const route of routes) {
      for (const id of route.stopIds) {
        expect(stops[id], `${id} missing from stops`).toBeDefined();
      }
    }
  });
});

describe("helpers", () => {
  it("getRoute returns the matching route", () => {
    expect(getRoute("madison")?.label).toBe("Madison");
    expect(getRoute("chicago")?.id).toBe("chicago");
  });

  it("isNative is true only when the stop is in the route's stopIds", () => {
    const madison = getRoute("madison")!;
    const firstMadisonStop = madison.stopIds[0];
    expect(isNative(firstMadisonStop, "madison")).toBe(true);
    expect(isNative("does-not-exist", "madison")).toBe(false);
  });

  it("homeRoutes returns every route whose defaults include the stop", () => {
    const madison = getRoute("madison")!;
    const id = madison.stopIds[0];
    const result = homeRoutes(id).map((r) => r.id);
    expect(result).toContain("madison");
  });

  it("directionsUrl encodes the address and routes from current location", () => {
    const url = directionsUrl("702 N Midvale Blvd, Madison, WI");
    expect(url).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=702%20N%20Midvale%20Blvd%2C%20Madison%2C%20WI&travelmode=driving",
    );
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- colectivo.test`
Expected: FAIL — cannot resolve `@/lib/colectivo`.

- [ ] **Step 3: Implement `lib/colectivo.ts`**

> Seed data below is PLACEHOLDER — real Colectivo cafes/addresses get filled in later. Keep ids stable slugs. A shared stop (e.g. Madison + Kegs) is modeled by listing its id in both routes' `stopIds`.

```ts
export type RouteId = "milwaukee" | "madison" | "chicago" | "kegs";

export interface Stop {
  id: string;
  name: string;
  address: string;
  note?: string;
}

export interface RouteDef {
  id: RouteId;
  label: string;
  color: string;
  stopIds: string[];
}

// PLACEHOLDER seed data — replace addresses/ids with the real route lists.
export const stops: Record<string, Stop> = {
  hilldale: { id: "hilldale", name: "Colectivo Hilldale", address: "702 N Midvale Blvd, Madison, WI 53705" },
  monroe: { id: "monroe", name: "Colectivo Monroe", address: "2301 Monroe St, Madison, WI 53711" },
  capitol: { id: "capitol", name: "Colectivo Capitol Square", address: "16 W Mifflin St, Madison, WI 53703" },
  prospect: { id: "prospect", name: "Colectivo Prospect", address: "2211 N Prospect Ave, Milwaukee, WI 53202" },
  downer: { id: "downer", name: "Colectivo Downer", address: "2999 N Downer Ave, Milwaukee, WI 53211" },
  lincoln: { id: "lincoln", name: "Colectivo Lincoln Warehouse", address: "320 E Buffalo St, Milwaukee, WI 53202" },
  southport: { id: "southport", name: "Colectivo Southport", address: "3011 N Southport Ave, Chicago, IL 60657" },
  wicker: { id: "wicker", name: "Colectivo Wicker Park", address: "1601 N Milwaukee Ave, Chicago, IL 60647" },
};

export const routes: RouteDef[] = [
  { id: "milwaukee", label: "Milwaukee", color: "#2f5b8f", stopIds: ["prospect", "downer", "lincoln"] },
  { id: "madison", label: "Madison", color: "#b5462e", stopIds: ["hilldale", "monroe", "capitol"] },
  { id: "chicago", label: "Chicago", color: "#3f7d4e", stopIds: ["southport", "wicker"] },
  // Kegs shares stops with the city routes — model the overlap by re-listing ids.
  { id: "kegs", label: "Kegs", color: "#b4791f", stopIds: ["lincoln", "capitol", "wicker"] },
];

export function getRoute(id: RouteId): RouteDef | undefined {
  return routes.find((r) => r.id === id);
}

export function isNative(stopId: string, routeId: RouteId): boolean {
  return getRoute(routeId)?.stopIds.includes(stopId) ?? false;
}

export function homeRoutes(stopId: string): RouteDef[] {
  return routes.filter((r) => r.stopIds.includes(stopId));
}

export function directionsUrl(address: string): string {
  const destination = encodeURIComponent(address);
  return `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- colectivo.test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/colectivo.ts lib/__tests__/colectivo.test.ts
git commit -m "feat: add colectivo data model and helpers"
```

---

### Task 3: Storage layer — `RouteStorage` interface + backends

**Files:**
- Create: `lib/colectivo-storage.ts`
- Create: `lib/__tests__/colectivo-storage.test.ts`

**Interfaces:**
- Consumes: `RouteId` from `@/lib/colectivo`.
- Produces:
  - `interface StoredRouteState { order: string[]; delivered: string[] }`
  - `type NotesMap = Record<string, string>`
  - `interface RouteStorage { loadRoute(routeId: RouteId): StoredRouteState | null; saveRoute(routeId: RouteId, state: StoredRouteState): void; clearRoute(routeId: RouteId): void; loadNotes(): NotesMap; saveNotes(notes: NotesMap): void }`
  - `function createMemoryBackend(seed?: { routes?: Partial<Record<RouteId, StoredRouteState>>; notes?: NotesMap }): RouteStorage`
  - `function createBrowserBackend(): RouteStorage` — localStorage-backed if available, else falls back to an in-memory backend (never throws).

- [ ] **Step 1: Write the failing tests**

`lib/__tests__/colectivo-storage.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import {
  createBrowserBackend,
  createMemoryBackend,
} from "@/lib/colectivo-storage";

describe("memory backend", () => {
  it("round-trips route state", () => {
    const b = createMemoryBackend();
    expect(b.loadRoute("madison")).toBeNull();
    b.saveRoute("madison", { order: ["a", "b"], delivered: ["a"] });
    expect(b.loadRoute("madison")).toEqual({ order: ["a", "b"], delivered: ["a"] });
  });

  it("clears a single route without touching notes", () => {
    const b = createMemoryBackend();
    b.saveRoute("madison", { order: ["a"], delivered: [] });
    b.saveNotes({ a: "hi" });
    b.clearRoute("madison");
    expect(b.loadRoute("madison")).toBeNull();
    expect(b.loadNotes()).toEqual({ a: "hi" });
  });
});

describe("browser backend", () => {
  beforeEach(() => localStorage.clear());

  it("persists route state to localStorage", () => {
    const b = createBrowserBackend();
    b.saveRoute("chicago", { order: ["x"], delivered: [] });
    expect(JSON.parse(localStorage.getItem("colectivo:route:chicago")!)).toEqual({
      order: ["x"],
      delivered: [],
    });
  });

  it("returns null for corrupt JSON instead of throwing", () => {
    localStorage.setItem("colectivo:route:madison", "{not valid json");
    const b = createBrowserBackend();
    expect(b.loadRoute("madison")).toBeNull();
  });

  it("persists notes under colectivo:notes", () => {
    const b = createBrowserBackend();
    b.saveNotes({ hilldale: "glass counter" });
    expect(b.loadNotes()).toEqual({ hilldale: "glass counter" });
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- colectivo-storage.test`
Expected: FAIL — cannot resolve `@/lib/colectivo-storage`.

- [ ] **Step 3: Implement `lib/colectivo-storage.ts`**

```ts
import type { RouteId } from "@/lib/colectivo";

export interface StoredRouteState {
  order: string[];
  delivered: string[];
}

export type NotesMap = Record<string, string>;

export interface RouteStorage {
  loadRoute(routeId: RouteId): StoredRouteState | null;
  saveRoute(routeId: RouteId, state: StoredRouteState): void;
  clearRoute(routeId: RouteId): void;
  loadNotes(): NotesMap;
  saveNotes(notes: NotesMap): void;
}

const routeKey = (id: RouteId) => `colectivo:route:${id}`;
const NOTES_KEY = "colectivo:notes";

export function createMemoryBackend(seed?: {
  routes?: Partial<Record<RouteId, StoredRouteState>>;
  notes?: NotesMap;
}): RouteStorage {
  const routeMap = new Map<RouteId, StoredRouteState>();
  for (const [id, state] of Object.entries(seed?.routes ?? {})) {
    if (state) routeMap.set(id as RouteId, state);
  }
  let notes: NotesMap = { ...(seed?.notes ?? {}) };

  return {
    loadRoute: (id) => routeMap.get(id) ?? null,
    saveRoute: (id, state) => void routeMap.set(id, state),
    clearRoute: (id) => void routeMap.delete(id),
    loadNotes: () => ({ ...notes }),
    saveNotes: (next) => void (notes = { ...next }),
  };
}

function localStorageAvailable(): boolean {
  try {
    const k = "__colectivo_probe__";
    localStorage.setItem(k, "1");
    localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

export function createBrowserBackend(): RouteStorage {
  if (typeof window === "undefined" || !localStorageAvailable()) {
    return createMemoryBackend();
  }

  const readJson = <T,>(key: string): T | null => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  };

  const writeJson = (key: string, value: unknown): void => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Quota exceeded / private mode — silently skip; session state still works.
    }
  };

  return {
    loadRoute: (id) => {
      const parsed = readJson<StoredRouteState>(routeKey(id));
      if (!parsed || !Array.isArray(parsed.order) || !Array.isArray(parsed.delivered)) {
        return null;
      }
      return parsed;
    },
    saveRoute: (id, state) => writeJson(routeKey(id), state),
    clearRoute: (id) => {
      try {
        localStorage.removeItem(routeKey(id));
      } catch {
        /* ignore */
      }
    },
    loadNotes: () => readJson<NotesMap>(NOTES_KEY) ?? {},
    saveNotes: (notes) => writeJson(NOTES_KEY, notes),
  };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- colectivo-storage.test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/colectivo-storage.ts lib/__tests__/colectivo-storage.test.ts
git commit -m "feat: add swappable colectivo storage layer"
```

---

### Task 4: Pure route-state logic — reconcile + operations

**Files:**
- Create: `lib/colectivo-state.ts`
- Create: `lib/__tests__/colectivo-state.test.ts`

**Interfaces:**
- Consumes: `Stop`, `RouteDef` from `@/lib/colectivo`; `StoredRouteState` from `@/lib/colectivo-storage`.
- Produces:
  - `interface RouteState { order: string[]; delivered: string[] }`
  - `function reconcile(route: RouteDef, stops: Record<string, Stop>, saved: StoredRouteState | null): RouteState`
  - `function moveStop(state: RouteState, activeId: string, overId: string): RouteState`
  - `function addStop(state: RouteState, stopId: string): RouteState`
  - `function removeStop(state: RouteState, stopId: string): RouteState`
  - `function toggleDelivered(state: RouteState, stopId: string): RouteState`

- [ ] **Step 1: Write the failing tests**

`lib/__tests__/colectivo-state.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import type { RouteDef, Stop } from "@/lib/colectivo";
import {
  reconcile,
  moveStop,
  addStop,
  removeStop,
  toggleDelivered,
} from "@/lib/colectivo-state";

const stops: Record<string, Stop> = {
  a: { id: "a", name: "A", address: "1" },
  b: { id: "b", name: "B", address: "2" },
  c: { id: "c", name: "C", address: "3" },
  x: { id: "x", name: "X", address: "9" }, // from another route
};

const route: RouteDef = { id: "madison", label: "Madison", color: "#000", stopIds: ["a", "b", "c"] };

describe("reconcile", () => {
  it("uses the default order when nothing is saved", () => {
    expect(reconcile(route, stops, null)).toEqual({ order: ["a", "b", "c"], delivered: [] });
  });

  it("keeps a saved custom order", () => {
    const saved = { order: ["c", "a", "b"], delivered: [] };
    expect(reconcile(route, stops, saved).order).toEqual(["c", "a", "b"]);
  });

  it("drops saved ids that no longer exist in the stops map", () => {
    const saved = { order: ["a", "gone", "b"], delivered: ["gone"] };
    const result = reconcile(route, stops, saved);
    expect(result.order).toEqual(["a", "b"]);
    expect(result.delivered).toEqual([]);
  });

  it("appends newly-added native stops missing from the saved order", () => {
    const saved = { order: ["b", "a"], delivered: [] }; // "c" added to defaults since save
    expect(reconcile(route, stops, saved).order).toEqual(["b", "a", "c"]);
  });

  it("keeps saved out-of-route (added) stops that still exist", () => {
    const saved = { order: ["a", "x", "b", "c"], delivered: [] };
    expect(reconcile(route, stops, saved).order).toEqual(["a", "x", "b", "c"]);
  });

  it("filters delivered down to ids still present in order", () => {
    const saved = { order: ["a", "b", "c"], delivered: ["b", "gone"] };
    expect(reconcile(route, stops, saved).delivered).toEqual(["b"]);
  });
});

describe("operations", () => {
  const base = { order: ["a", "b", "c"], delivered: [] as string[] };

  it("moveStop reorders active over target", () => {
    expect(moveStop(base, "a", "c").order).toEqual(["b", "c", "a"]);
  });

  it("addStop appends to the bottom when not present", () => {
    expect(addStop(base, "x").order).toEqual(["a", "b", "c", "x"]);
  });

  it("addStop is a no-op if the stop is already present", () => {
    expect(addStop(base, "a").order).toEqual(["a", "b", "c"]);
  });

  it("removeStop removes from order and delivered", () => {
    const s = { order: ["a", "x", "b"], delivered: ["x"] };
    expect(removeStop(s, "x")).toEqual({ order: ["a", "b"], delivered: [] });
  });

  it("toggleDelivered adds then removes an id", () => {
    const once = toggleDelivered(base, "b");
    expect(once.delivered).toEqual(["b"]);
    expect(toggleDelivered(once, "b").delivered).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- colectivo-state.test`
Expected: FAIL — cannot resolve `@/lib/colectivo-state`.

- [ ] **Step 3: Implement `lib/colectivo-state.ts`**

```ts
import type { RouteDef, Stop } from "@/lib/colectivo";
import type { StoredRouteState } from "@/lib/colectivo-storage";

export interface RouteState {
  order: string[];
  delivered: string[];
}

export function reconcile(
  route: RouteDef,
  stops: Record<string, Stop>,
  saved: StoredRouteState | null,
): RouteState {
  const exists = (id: string) => Boolean(stops[id]);

  if (!saved) {
    return { order: route.stopIds.filter(exists), delivered: [] };
  }

  // Keep saved order, drop stops that no longer exist.
  const order = saved.order.filter(exists);

  // Append native stops added to the route's defaults since the last save.
  for (const id of route.stopIds) {
    if (exists(id) && !order.includes(id)) order.push(id);
  }

  const delivered = saved.delivered.filter((id) => order.includes(id));
  return { order, delivered };
}

export function moveStop(state: RouteState, activeId: string, overId: string): RouteState {
  const from = state.order.indexOf(activeId);
  const to = state.order.indexOf(overId);
  if (from === -1 || to === -1 || from === to) return state;
  const order = [...state.order];
  const [moved] = order.splice(from, 1);
  order.splice(to, 0, moved);
  return { ...state, order };
}

export function addStop(state: RouteState, stopId: string): RouteState {
  if (state.order.includes(stopId)) return state;
  return { ...state, order: [...state.order, stopId] };
}

export function removeStop(state: RouteState, stopId: string): RouteState {
  return {
    order: state.order.filter((id) => id !== stopId),
    delivered: state.delivered.filter((id) => id !== stopId),
  };
}

export function toggleDelivered(state: RouteState, stopId: string): RouteState {
  const delivered = state.delivered.includes(stopId)
    ? state.delivered.filter((id) => id !== stopId)
    : [...state.delivered, stopId];
  return { ...state, delivered };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- colectivo-state.test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/colectivo-state.ts lib/__tests__/colectivo-state.test.ts
git commit -m "feat: add pure route-state reconciliation and operations"
```

---

### Task 5: `useRouteState` hook

**Files:**
- Create: `app/colectivo/routes/useRouteState.ts`
- Create: `app/colectivo/routes/__tests__/useRouteState.test.ts`

**Interfaces:**
- Consumes: `RouteDef`, `stops`, `Stop` from `@/lib/colectivo`; storage backends + `NotesMap` from `@/lib/colectivo-storage`; `RouteState` + operations from `@/lib/colectivo-state`.
- Produces:
  - `interface UseRouteState { ready: boolean; state: RouteState; notes: NotesMap; reorder(activeId: string, overId: string): void; add(stopId: string): void; remove(stopId: string): void; toggleDelivered(stopId: string): void; reset(): void; setNote(stopId: string, text: string): void; exportNotes(): string }`
  - `function useRouteState(route: RouteDef, backend?: RouteStorage): UseRouteState`

- [ ] **Step 1: Write the failing tests**

`app/colectivo/routes/__tests__/useRouteState.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { getRoute } from "@/lib/colectivo";
import { createMemoryBackend } from "@/lib/colectivo-storage";
import { useRouteState } from "@/app/colectivo/routes/useRouteState";

const madison = getRoute("madison")!;

describe("useRouteState", () => {
  it("becomes ready with the default order", () => {
    const backend = createMemoryBackend();
    const { result } = renderHook(() => useRouteState(madison, backend));
    expect(result.current.ready).toBe(true);
    expect(result.current.state.order).toEqual(madison.stopIds);
  });

  it("persists a reorder to the backend", () => {
    const backend = createMemoryBackend();
    const { result } = renderHook(() => useRouteState(madison, backend));
    const [a, , c] = madison.stopIds;
    act(() => result.current.reorder(a, c));
    expect(backend.loadRoute("madison")?.order[2]).toBe(a);
  });

  it("reset restores defaults but keeps notes", () => {
    const backend = createMemoryBackend();
    const { result } = renderHook(() => useRouteState(madison, backend));
    act(() => result.current.setNote(madison.stopIds[0], "glass counter"));
    act(() => result.current.reorder(madison.stopIds[0], madison.stopIds[2]));
    act(() => result.current.reset());
    expect(result.current.state.order).toEqual(madison.stopIds);
    expect(result.current.notes[madison.stopIds[0]]).toBe("glass counter");
    expect(backend.loadNotes()[madison.stopIds[0]]).toBe("glass counter");
  });

  it("exportNotes formats saved notes as text", () => {
    const backend = createMemoryBackend();
    const { result } = renderHook(() => useRouteState(madison, backend));
    act(() => result.current.setNote("hilldale", "glass counter"));
    expect(result.current.exportNotes()).toContain("Colectivo Hilldale");
    expect(result.current.exportNotes()).toContain("glass counter");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- useRouteState.test`
Expected: FAIL — cannot resolve the hook module.

- [ ] **Step 3: Implement `app/colectivo/routes/useRouteState.ts`**

```ts
"use client";

import { useEffect, useMemo, useState } from "react";
import { type RouteDef, stops } from "@/lib/colectivo";
import {
  type NotesMap,
  type RouteStorage,
  createBrowserBackend,
} from "@/lib/colectivo-storage";
import {
  type RouteState,
  reconcile,
  moveStop,
  addStop as addStopOp,
  removeStop as removeStopOp,
  toggleDelivered as toggleDeliveredOp,
} from "@/lib/colectivo-state";

export interface UseRouteState {
  ready: boolean;
  state: RouteState;
  notes: NotesMap;
  reorder(activeId: string, overId: string): void;
  add(stopId: string): void;
  remove(stopId: string): void;
  toggleDelivered(stopId: string): void;
  reset(): void;
  setNote(stopId: string, text: string): void;
  exportNotes(): string;
}

const EMPTY: RouteState = { order: [], delivered: [] };

export function useRouteState(route: RouteDef, backend?: RouteStorage): UseRouteState {
  const store = useMemo(() => backend ?? createBrowserBackend(), [backend]);
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<RouteState>(EMPTY);
  const [notes, setNotes] = useState<NotesMap>({});

  // Load + reconcile after mount (avoids SSR/hydration mismatch).
  useEffect(() => {
    setState(reconcile(route, stops, store.loadRoute(route.id)));
    setNotes(store.loadNotes());
    setReady(true);
  }, [route, store]);

  const commit = (next: RouteState) => {
    setState(next);
    store.saveRoute(route.id, next);
  };

  return {
    ready,
    state,
    notes,
    reorder: (activeId, overId) => commit(moveStop(state, activeId, overId)),
    add: (stopId) => commit(addStopOp(state, stopId)),
    remove: (stopId) => commit(removeStopOp(state, stopId)),
    toggleDelivered: (stopId) => commit(toggleDeliveredOp(state, stopId)),
    reset: () => {
      store.clearRoute(route.id);
      setState(reconcile(route, stops, null));
    },
    setNote: (stopId, text) => {
      const next = { ...notes };
      if (text.trim()) next[stopId] = text;
      else delete next[stopId];
      setNotes(next);
      store.saveNotes(next);
    },
    exportNotes: () =>
      Object.entries(notes)
        .map(([id, text]) => `${stops[id]?.name ?? id}\n${text}`)
        .join("\n\n"),
  };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- useRouteState.test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/colectivo/routes/useRouteState.ts app/colectivo/routes/__tests__/useRouteState.test.ts
git commit -m "feat: add useRouteState hook"
```

---

### Task 6: `SortableStopItem` component

**Files:**
- Create: `app/colectivo/routes/SortableStopItem.tsx`
- Create: `app/colectivo/routes/__tests__/SortableStopItem.test.tsx`

**Interfaces:**
- Consumes: `Stop` from `@/lib/colectivo`; `directionsUrl` from `@/lib/colectivo`.
- Produces:
  - `interface SortableStopItemProps { stop: Stop; outOfRoute: boolean; originLabel?: string; originColor?: string; delivered: boolean; note: string; onToggleDelivered(): void; onRemove?(): void; onNoteChange(text: string): void }`
  - `function SortableStopItem(props: SortableStopItemProps): JSX.Element`

> Note: renders inside a `SortableContext` (Task 8). Uses `useSortable({ id: stop.id })`. Grip handle carries the drag listeners with `touchAction: "none"`, mirroring Skyhammer. Directions is an `<a>` (disabled `<span>` when address is empty). Badge + left stripe render only when `outOfRoute`, using `originColor`. `✕` renders only when `onRemove` is provided.

- [ ] **Step 1: Write the failing tests**

`app/colectivo/routes/__tests__/SortableStopItem.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DndContext } from "@dnd-kit/core";
import { SortableContext } from "@dnd-kit/sortable";
import { SortableStopItem } from "@/app/colectivo/routes/SortableStopItem";
import type { Stop } from "@/lib/colectivo";

const stop: Stop = { id: "hilldale", name: "Colectivo Hilldale", address: "702 N Midvale Blvd" };

function renderItem(props: Partial<React.ComponentProps<typeof SortableStopItem>> = {}) {
  const merged = {
    stop,
    outOfRoute: false,
    delivered: false,
    note: "",
    onToggleDelivered: vi.fn(),
    onNoteChange: vi.fn(),
    ...props,
  };
  render(
    <DndContext>
      <SortableContext items={[stop.id]}>
        <SortableStopItem {...merged} />
      </SortableContext>
    </DndContext>,
  );
  return merged;
}

describe("SortableStopItem", () => {
  it("shows the name and address", () => {
    renderItem();
    expect(screen.getByText("Colectivo Hilldale")).toBeInTheDocument();
    expect(screen.getByText("702 N Midvale Blvd")).toBeInTheDocument();
  });

  it("links directions to the Google Maps URL", () => {
    renderItem();
    const link = screen.getByRole("link", { name: /directions/i });
    expect(link).toHaveAttribute(
      "href",
      expect.stringContaining("google.com/maps/dir/?api=1&destination=702"),
    );
  });

  it("shows the origin badge only when out of route", () => {
    renderItem({ outOfRoute: true, originLabel: "Milwaukee", originColor: "#2f5b8f" });
    expect(screen.getByText("Milwaukee")).toBeInTheDocument();
  });

  it("does not render a remove button without onRemove", () => {
    renderItem();
    expect(screen.queryByRole("button", { name: /remove/i })).toBeNull();
  });

  it("renders a remove button when onRemove is provided and calls it", () => {
    const onRemove = vi.fn();
    renderItem({ outOfRoute: true, onRemove });
    fireEvent.click(screen.getByRole("button", { name: /remove/i }));
    expect(onRemove).toHaveBeenCalled();
  });

  it("calls onToggleDelivered when the done control is clicked", () => {
    const merged = renderItem();
    fireEvent.click(screen.getByRole("button", { name: /mark.*delivered|delivered/i }));
    expect(merged.onToggleDelivered).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- SortableStopItem.test`
Expected: FAIL — component module not found.

- [ ] **Step 3: Implement `app/colectivo/routes/SortableStopItem.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Check, X, ChevronDown, Info } from "lucide-react";
import { MdAssistantNavigation } from "react-icons/md";
import { type Stop, directionsUrl } from "@/lib/colectivo";

const DISCLAIMER =
  "📝 Notes are saved on this device only — clearing your browser data or switching phones will erase them.";

export interface SortableStopItemProps {
  stop: Stop;
  outOfRoute: boolean;
  originLabel?: string;
  originColor?: string;
  delivered: boolean;
  note: string;
  onToggleDelivered(): void;
  onRemove?(): void;
  onNoteChange(text: string): void;
}

export function SortableStopItem({
  stop,
  outOfRoute,
  originLabel,
  originColor,
  delivered,
  note,
  onToggleDelivered,
  onRemove,
  onNoteChange,
}: SortableStopItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: stop.id,
  });
  const [notesOpen, setNotesOpen] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    borderLeft: outOfRoute && originColor ? `4px solid ${originColor}` : "4px solid transparent",
  };

  const hasAddress = stop.address.trim().length > 0;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`border-b border-[#2c2c2c]/20 ${delivered ? "opacity-50" : ""}`}
    >
      <div className="flex items-center gap-2 py-3 pl-3 pr-2">
        {/* Directions — far left */}
        {hasAddress ? (
          <a
            href={directionsUrl(stop.address)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Directions to ${stop.name}`}
            className="text-[#2c2c2c] shrink-0"
          >
            <MdAssistantNavigation className="w-6 h-6" />
          </a>
        ) : (
          <span aria-label="No address" className="text-[#2c2c2c]/30 shrink-0">
            <MdAssistantNavigation className="w-6 h-6" />
          </span>
        )}

        {/* Name + address + badge */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[#2c2c2c] ${delivered ? "line-through" : "font-semibold"}`}>
              {stop.name}
            </span>
            {outOfRoute && originLabel && (
              <span
                className="text-xs font-bold px-2 py-0.5 rounded-full border"
                style={{ color: originColor, borderColor: originColor }}
              >
                {originLabel}
              </span>
            )}
          </div>
          <div className="text-sm text-[#2c2c2c]/70 truncate">{stop.address}</div>
          <button
            type="button"
            onClick={() => setNotesOpen((v) => !v)}
            aria-label="Toggle notes"
            className="mt-1 inline-flex items-center gap-1 text-xs text-[#2c2c2c]/60"
          >
            <ChevronDown className={`w-4 h-4 transition-transform ${notesOpen ? "rotate-180" : ""}`} />
            Notes{note ? " •" : ""}
          </button>
        </div>

        {/* Done circle */}
        <button
          type="button"
          onClick={onToggleDelivered}
          aria-label={delivered ? "Mark not delivered" : "Mark delivered"}
          className={`w-8 h-8 rounded-full border-2 border-[#2c2c2c] flex items-center justify-center shrink-0 ${
            delivered ? "bg-[#2c2c2c] text-white" : "text-transparent"
          }`}
        >
          <Check className="w-4 h-4" />
        </button>

        {/* Remove — added stops only */}
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${stop.name}`}
            className="text-[#2c2c2c]/50 hover:text-[#b5462e] shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Grip — far right, press-hold to drag */}
        <div
          {...attributes}
          {...listeners}
          onContextMenu={(e) => e.preventDefault()}
          aria-label={`Drag ${stop.name}`}
          className="cursor-grab active:cursor-grabbing text-[#2c2c2c]/50 hover:text-[#2c2c2c] flex items-center justify-center py-2 px-1 shrink-0 select-none"
          style={{ touchAction: "none", WebkitUserSelect: "none" }}
        >
          <GripVertical className="w-5 h-5" />
        </div>
      </div>

      {/* Inline notes editor */}
      {notesOpen && (
        <div className="px-3 pb-3">
          <textarea
            value={note}
            onChange={(e) => onNoteChange(e.target.value)}
            placeholder="e.g. prefers bakery on the glass counter"
            className="w-full text-sm border border-[#2c2c2c]/30 rounded p-2 bg-white/60"
            rows={2}
          />
          <button
            type="button"
            onClick={() => setShowInfo((v) => !v)}
            aria-label="About note storage"
            className="mt-1 inline-flex items-center gap-1 text-xs text-[#2c2c2c]/50"
          >
            <Info className="w-3 h-3" /> Where are notes saved?
          </button>
          {showInfo && <p className="mt-1 text-xs italic text-[#2c2c2c]/60">{DISCLAIMER}</p>}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- SortableStopItem.test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/colectivo/routes/SortableStopItem.tsx app/colectivo/routes/__tests__/SortableStopItem.test.tsx
git commit -m "feat: add SortableStopItem row component"
```

---

### Task 7: `AddStopSheet` component

**Files:**
- Create: `app/colectivo/routes/AddStopSheet.tsx`
- Create: `app/colectivo/routes/__tests__/AddStopSheet.test.tsx`

**Interfaces:**
- Consumes: `RouteDef`, `stops`, `homeRoutes` from `@/lib/colectivo`.
- Produces:
  - `interface AddStopSheetProps { route: RouteDef; currentOrder: string[]; onAdd(stopId: string): void; onClose(): void }`
  - `function AddStopSheet(props: AddStopSheetProps): JSX.Element`

> Candidates = every stop whose id is NOT in `currentOrder`, grouped by home route label, filtered by a search box (matches name, case-insensitive). Tapping `+` calls `onAdd(id)`.

- [ ] **Step 1: Write the failing tests**

`app/colectivo/routes/__tests__/AddStopSheet.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { getRoute } from "@/lib/colectivo";
import { AddStopSheet } from "@/app/colectivo/routes/AddStopSheet";

const madison = getRoute("madison")!;

describe("AddStopSheet", () => {
  it("lists stops not already on the route", () => {
    render(
      <AddStopSheet route={madison} currentOrder={madison.stopIds} onAdd={vi.fn()} onClose={vi.fn()} />,
    );
    // A Milwaukee stop should be offered; a Madison-native stop should not.
    expect(screen.getByText("Colectivo Prospect")).toBeInTheDocument();
    expect(screen.queryByText("Colectivo Hilldale")).toBeNull();
  });

  it("filters by the search box", () => {
    render(
      <AddStopSheet route={madison} currentOrder={madison.stopIds} onAdd={vi.fn()} onClose={vi.fn()} />,
    );
    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: "downer" } });
    expect(screen.getByText("Colectivo Downer")).toBeInTheDocument();
    expect(screen.queryByText("Colectivo Prospect")).toBeNull();
  });

  it("calls onAdd with the chosen stop id", () => {
    const onAdd = vi.fn();
    render(
      <AddStopSheet route={madison} currentOrder={madison.stopIds} onAdd={onAdd} onClose={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /add colectivo prospect/i }));
    expect(onAdd).toHaveBeenCalledWith("prospect");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- AddStopSheet.test`
Expected: FAIL — component module not found.

- [ ] **Step 3: Implement `app/colectivo/routes/AddStopSheet.tsx`**

```tsx
"use client";

import { useMemo, useState } from "react";
import { X, Plus } from "lucide-react";
import { type RouteDef, stops, homeRoutes } from "@/lib/colectivo";

export interface AddStopSheetProps {
  route: RouteDef;
  currentOrder: string[];
  onAdd(stopId: string): void;
  onClose(): void;
}

export function AddStopSheet({ route, currentOrder, onAdd, onClose }: AddStopSheetProps) {
  const [query, setQuery] = useState("");

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const candidates = Object.values(stops).filter(
      (s) => !currentOrder.includes(s.id) && s.name.toLowerCase().includes(q),
    );
    const byRoute = new Map<string, { label: string; color: string; items: typeof candidates }>();
    for (const stop of candidates) {
      const home = homeRoutes(stop.id).find((r) => r.id !== route.id) ?? homeRoutes(stop.id)[0];
      const key = home?.label ?? "Other";
      if (!byRoute.has(key)) {
        byRoute.set(key, { label: key, color: home?.color ?? "#2c2c2c", items: [] });
      }
      byRoute.get(key)!.items.push(stop);
    }
    return [...byRoute.values()];
  }, [query, currentOrder, route.id]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
      <div className="w-full max-w-md bg-[#fbf8f0] border border-[#2c2c2c] rounded-t-xl sm:rounded-xl max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-[#2c2c2c]/20">
          <h2 className="font-black text-[#2c2c2c]">Add a stop to {route.label}</h2>
          <button type="button" onClick={onClose} aria-label="Close">
            <X className="w-5 h-5 text-[#2c2c2c]" />
          </button>
        </div>

        <div className="p-4">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            className="w-full border border-[#2c2c2c]/30 rounded p-2 mb-4 bg-white/60 text-[#2c2c2c]"
          />

          {groups.length === 0 && <p className="text-sm text-[#2c2c2c]/60">No stops to add.</p>}

          {groups.map((group) => (
            <div key={group.label} className="mb-4">
              <h3
                className="text-xs font-bold uppercase tracking-wide mb-1"
                style={{ color: group.color }}
              >
                {group.label}
              </h3>
              {group.items.map((stop) => (
                <div
                  key={stop.id}
                  className="flex items-center justify-between py-2 border-b border-[#2c2c2c]/10"
                >
                  <span className="text-[#2c2c2c]">{stop.name}</span>
                  <button
                    type="button"
                    onClick={() => onAdd(stop.id)}
                    aria-label={`Add ${stop.name}`}
                    className="text-[#2c2c2c] hover:scale-110 transition-transform"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- AddStopSheet.test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/colectivo/routes/AddStopSheet.tsx app/colectivo/routes/__tests__/AddStopSheet.test.tsx
git commit -m "feat: add AddStopSheet stop picker"
```

---

### Task 8: `StopList` component (dnd + action bar)

**Files:**
- Create: `app/colectivo/routes/StopList.tsx`
- Create: `app/colectivo/routes/__tests__/StopList.test.tsx`

**Interfaces:**
- Consumes: `RouteDef`, `stops`, `isNative`, `homeRoutes` from `@/lib/colectivo`; `useRouteState` from `./useRouteState`; `SortableStopItem` from `./SortableStopItem`; `AddStopSheet` from `./AddStopSheet`; dnd-kit primitives.
- Produces:
  - `interface StopListProps { route: RouteDef; onBack(): void; backend?: RouteStorage }`
  - `function StopList(props: StopListProps): JSX.Element`

> Renders `DndContext` + `SortableContext` (Skyhammer sensor config). Active list = order minus delivered. "Show/Hide delivered" reveals delivered rows. Bottom bar: `+ Add stop`, `Show delivered (n)`, `Reset` (with `window.confirm`), `Export notes`. `backend` prop is optional for tests.

- [ ] **Step 1: Write the failing tests**

`app/colectivo/routes/__tests__/StopList.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { getRoute } from "@/lib/colectivo";
import { createMemoryBackend } from "@/lib/colectivo-storage";
import { StopList } from "@/app/colectivo/routes/StopList";

const madison = getRoute("madison")!;

describe("StopList", () => {
  it("renders the route's stops", () => {
    render(<StopList route={madison} onBack={vi.fn()} backend={createMemoryBackend()} />);
    expect(screen.getByText("Colectivo Hilldale")).toBeInTheDocument();
    expect(screen.getByText("Colectivo Monroe")).toBeInTheDocument();
  });

  it("hides a stop from the active list once marked delivered", () => {
    render(<StopList route={madison} onBack={vi.fn()} backend={createMemoryBackend()} />);
    const row = screen.getByText("Colectivo Hilldale").closest("div")!;
    fireEvent.click(within(row.parentElement!.parentElement!).getByRole("button", { name: /mark delivered/i }));
    expect(screen.queryByText("Colectivo Hilldale")).toBeNull();
    expect(screen.getByRole("button", { name: /show delivered \(1\)/i })).toBeInTheDocument();
  });

  it("reveals delivered stops when Show delivered is toggled", () => {
    render(<StopList route={madison} onBack={vi.fn()} backend={createMemoryBackend()} />);
    const marks = screen.getAllByRole("button", { name: /mark delivered/i });
    fireEvent.click(marks[0]);
    fireEvent.click(screen.getByRole("button", { name: /show delivered/i }));
    expect(screen.getByText("Colectivo Hilldale")).toBeInTheDocument();
  });

  it("calls onBack when Routes is clicked", () => {
    const onBack = vi.fn();
    render(<StopList route={madison} onBack={onBack} backend={createMemoryBackend()} />);
    fireEvent.click(screen.getByRole("button", { name: /routes/i }));
    expect(onBack).toHaveBeenCalled();
  });

  it("opens the add-stop sheet", () => {
    render(<StopList route={madison} onBack={vi.fn()} backend={createMemoryBackend()} />);
    fireEvent.click(screen.getByRole("button", { name: /add stop/i }));
    expect(screen.getByText(/add a stop to madison/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- StopList.test`
Expected: FAIL — component module not found.

- [ ] **Step 3: Implement `app/colectivo/routes/StopList.tsx`**

```tsx
"use client";

import { useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { ChevronLeft } from "lucide-react";
import { type RouteDef, stops, isNative, homeRoutes } from "@/lib/colectivo";
import type { RouteStorage } from "@/lib/colectivo-storage";
import { useRouteState } from "./useRouteState";
import { SortableStopItem } from "./SortableStopItem";
import { AddStopSheet } from "./AddStopSheet";

export interface StopListProps {
  route: RouteDef;
  onBack(): void;
  backend?: RouteStorage;
}

export function StopList({ route, onBack, backend }: StopListProps) {
  const rs = useRouteState(route, backend);
  const [showDelivered, setShowDelivered] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
      onActivation: (event) => event.event.preventDefault(),
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      rs.reorder(String(active.id), String(over.id));
    }
  };

  const handleExport = async () => {
    const text = rs.exportNotes();
    try {
      await navigator.clipboard.writeText(text);
      alert("Notes copied to clipboard.");
    } catch {
      alert(text);
    }
  };

  const handleReset = () => {
    if (window.confirm(`Reset ${route.label} to default? This clears your order and delivered marks. Your notes are kept.`)) {
      rs.reset();
    }
  };

  if (!rs.ready) {
    return <div className="p-6 text-[#2c2c2c]/60">Loading…</div>;
  }

  const deliveredCount = rs.state.delivered.length;
  const visibleIds = rs.state.order.filter(
    (id) => showDelivered || !rs.state.delivered.includes(id),
  );

  const originFor = (id: string) => homeRoutes(id).find((r) => r.id !== route.id) ?? homeRoutes(id)[0];

  return (
    <div className="w-full max-w-md mx-auto pb-24">
      <div className="flex items-center justify-between p-4">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to routes"
          className="flex items-center gap-1 text-[#2c2c2c] font-bold"
        >
          <ChevronLeft className="w-5 h-5" /> Routes
        </button>
        <h1 className="font-black text-[#2c2c2c]" style={{ color: route.color }}>
          {route.label.toUpperCase()}
        </h1>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={visibleIds} strategy={verticalListSortingStrategy}>
          <div className="border-t border-[#2c2c2c]/20">
            {visibleIds.map((id) => {
              const stop = stops[id];
              if (!stop) return null;
              const outOfRoute = !isNative(id, route.id);
              const origin = outOfRoute ? originFor(id) : undefined;
              return (
                <SortableStopItem
                  key={id}
                  stop={stop}
                  outOfRoute={outOfRoute}
                  originLabel={origin?.label}
                  originColor={origin?.color}
                  delivered={rs.state.delivered.includes(id)}
                  note={rs.notes[id] ?? stop.note ?? ""}
                  onToggleDelivered={() => rs.toggleDelivered(id)}
                  onRemove={outOfRoute ? () => rs.remove(id) : undefined}
                  onNoteChange={(text) => rs.setNote(id, text)}
                />
              );
            })}
          </div>
        </SortableContext>
      </DndContext>

      {visibleIds.length === 0 && (
        <p className="p-6 text-center text-[#2c2c2c]/70">All delivered 🎉</p>
      )}

      <div className="fixed bottom-0 left-0 right-0 bg-[#fbf8f0] border-t border-[#2c2c2c]/20 p-3 flex flex-wrap gap-2 justify-center">
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="px-3 py-2 border border-[#2c2c2c] text-[#2c2c2c] font-bold text-sm"
        >
          + Add stop
        </button>
        <button
          type="button"
          onClick={() => setShowDelivered((v) => !v)}
          className="px-3 py-2 border border-[#2c2c2c] text-[#2c2c2c] font-bold text-sm"
        >
          {showDelivered ? "Hide delivered" : `Show delivered (${deliveredCount})`}
        </button>
        <button
          type="button"
          onClick={handleExport}
          className="px-3 py-2 border border-[#2c2c2c] text-[#2c2c2c] font-bold text-sm"
        >
          Export notes
        </button>
        <button
          type="button"
          onClick={handleReset}
          className="px-3 py-2 border border-[#2c2c2c] text-[#2c2c2c] font-bold text-sm"
        >
          Reset
        </button>
      </div>

      {sheetOpen && (
        <AddStopSheet
          route={route}
          currentOrder={rs.state.order}
          onAdd={(id) => {
            rs.add(id);
            setSheetOpen(false);
          }}
          onClose={() => setSheetOpen(false)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- StopList.test`
Expected: PASS. (If the delivered-row query proves brittle, target the done button via its accessible name rather than DOM traversal — the accessible names are defined in Task 6.)

- [ ] **Step 5: Commit**

```bash
git add app/colectivo/routes/StopList.tsx app/colectivo/routes/__tests__/StopList.test.tsx
git commit -m "feat: add StopList with dnd, delivered toggle, add/reset/export"
```

---

### Task 9: `RouteSelector` + page orchestration

**Files:**
- Create: `app/colectivo/routes/RouteSelector.tsx`
- Create: `app/colectivo/routes/page.tsx`
- Create: `app/colectivo/routes/__tests__/RouteSelector.test.tsx`

**Interfaces:**
- Consumes: `RouteDef`, `routes` from `@/lib/colectivo`; `StopList` from `./StopList`.
- Produces:
  - `interface RouteSelectorProps { onSelect(route: RouteDef): void }`
  - `function RouteSelector(props: RouteSelectorProps): JSX.Element`
  - default-exported `ColectivoRoutesPage` client component that swaps between selector and list.

- [ ] **Step 1: Write the failing test**

`app/colectivo/routes/__tests__/RouteSelector.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RouteSelector } from "@/app/colectivo/routes/RouteSelector";

describe("RouteSelector", () => {
  it("renders all four routes", () => {
    render(<RouteSelector onSelect={vi.fn()} />);
    ["Milwaukee", "Madison", "Chicago", "Kegs"].forEach((label) => {
      expect(screen.getByRole("button", { name: new RegExp(label, "i") })).toBeInTheDocument();
    });
  });

  it("calls onSelect with the chosen route", () => {
    const onSelect = vi.fn();
    render(<RouteSelector onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: /madison/i }));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "madison" }));
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- RouteSelector.test`
Expected: FAIL — component module not found.

- [ ] **Step 3: Implement `app/colectivo/routes/RouteSelector.tsx`**

```tsx
"use client";

import { ChevronRight } from "lucide-react";
import { type RouteDef, routes } from "@/lib/colectivo";

export interface RouteSelectorProps {
  onSelect(route: RouteDef): void;
}

export function RouteSelector({ onSelect }: RouteSelectorProps) {
  return (
    <div className="w-full max-w-md mx-auto p-6">
      <h1 className="text-center font-black tracking-[0.3em] text-[#2c2c2c] mb-6">COLECTIVO</h1>
      <div className="border border-[#2c2c2c]">
        {routes.map((route) => (
          <button
            key={route.id}
            type="button"
            onClick={() => onSelect(route)}
            aria-label={route.label}
            className="w-full flex items-center justify-between p-5 border-b border-[#2c2c2c]/20 last:border-b-0 font-black text-lg text-[#2c2c2c]"
            style={{ borderLeft: `6px solid ${route.color}` }}
          >
            {route.label.toUpperCase()}
            <ChevronRight className="w-5 h-5" />
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Implement `app/colectivo/routes/page.tsx`**

```tsx
"use client";

import { useState } from "react";
import type { RouteDef } from "@/lib/colectivo";
import { RouteSelector } from "./RouteSelector";
import { StopList } from "./StopList";

export default function ColectivoRoutesPage() {
  const [route, setRoute] = useState<RouteDef | null>(null);

  return (
    <main className="min-h-screen bg-[#fbf8f0]">
      {route ? (
        <StopList route={route} onBack={() => setRoute(null)} />
      ) : (
        <RouteSelector onSelect={setRoute} />
      )}
    </main>
  );
}
```

- [ ] **Step 5: Run to verify pass**

Run: `npm test -- RouteSelector.test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/colectivo/routes/RouteSelector.tsx app/colectivo/routes/page.tsx app/colectivo/routes/__tests__/RouteSelector.test.tsx
git commit -m "feat: add route selector and page orchestration"
```

---

### Task 10: Full-suite verification, lint & manual QA

**Files:**
- Modify: none (verification task; small fixes only if something fails)

**Interfaces:**
- Consumes: everything built in Tasks 1–9.
- Produces: a verified, lint-clean, manually-smoke-tested feature.

- [ ] **Step 1: Run the whole test suite**

Run: `npm test`
Expected: PASS — all suites green.

- [ ] **Step 2: Type-check + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no type errors, no lint errors. Fix any that surface, then re-run.

- [ ] **Step 3: Manual smoke test in the browser**

Run: `npm run dev`, open `http://localhost:3000/colectivo/routes` (use device toolbar / a narrow viewport). Verify:
  - Route picker shows all four routes, each with its color stripe; tapping one opens its list; `‹ Routes` returns.
  - A quick **tap** on the grip does nothing; **press-and-hold** drags a row and the new order persists across a reload.
  - Tapping the directions arrow opens Google Maps directions to that address.
  - `+ Add stop` → pick a stop from another route → it appears at the bottom with its origin badge + colored stripe and an `✕`; `✕` removes it; the order persists across reload.
  - Marking a stop delivered hides it; `Show delivered (n)` reveals it struck-through; un-marking restores it.
  - Opening Notes, typing, reloading → note persists; the `ⓘ` shows the on-device disclaimer verbatim.
  - `Reset` (confirm) restores default order + clears delivered, **but notes remain**.
  - `Export notes` copies the notes text.

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "test: verify colectivo routing feature end-to-end"
```

---

## Self-Review

**Spec coverage:**
- URL/scope (single page, swap, public) → Task 9. ✓
- Data model + native-membership + Kegs overlap → Task 2. ✓
- Persistence keys + reconciliation + reset-keeps-notes → Tasks 3, 4, 5. ✓
- Notes (per-stop, survive reset, disclaimer verbatim, export) → Tasks 5, 6, 8. ✓
- Screens + row anatomy (directions left / grip right, badge+stripe, done, ✕) → Tasks 6, 8, 9. ✓
- Directions URL → Task 2 (`directionsUrl`), used in Task 6. ✓
- Drag pattern reused from Skyhammer (250ms sensor) → Task 8. ✓
- Add-stop flow (grouped, searchable, dedup) → Task 7. ✓
- Delivered / Show-Hide + all-delivered state → Task 8. ✓
- Per-route colors → Task 2 data + Tasks 6/8/9 rendering. ✓
- Edge cases (localStorage unavailable, corrupt data, blank address, unknown route via picker default) → Tasks 3, 5, 6, 9. ✓
- Testing (Vitest, unit tests for logic) → Task 1 + tests throughout. ✓
- Future MongoDB seam (`RouteStorage` interface) → Task 3. ✓

**Placeholder scan:** No TBD/TODO. The only "placeholder" is the seed cafe data in Task 2, explicitly flagged as user-replaceable — not a plan gap.

**Type consistency:** `RouteState`/`StoredRouteState` used consistently; `useRouteState` returns the interface defined in Task 5 and consumed in Task 8; `SortableStopItemProps` defined in Task 6 matches the props passed in Task 8; `directionsUrl`, `isNative`, `homeRoutes` signatures consistent across Tasks 2/6/7/8.
