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
