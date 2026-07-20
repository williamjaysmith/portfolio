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
  };
}
