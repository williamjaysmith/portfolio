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
