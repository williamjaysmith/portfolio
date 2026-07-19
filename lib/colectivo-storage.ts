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
