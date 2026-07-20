export type RouteId = "milwaukee" | "madison" | "chicago";

export interface Stop {
  id: string;
  name: string;
  address: string;
  note?: string;
}

export interface RouteDef {
  id: RouteId;
  label: string;
  short: string; // abbreviated tab label, e.g. "MAD"
  stopIds: string[];
}

// PLACEHOLDER seed data — replace addresses/ids with the real route lists.
export const stops: Record<string, Stop> = {
  easttosa: { id: "easttosa", name: "East Tosa Cafe", address: "6745 W Wells St, Wauwatosa, WI 53213" },
  willy: { id: "willy", name: "Willy Street Cafe", address: "836 Williamson St, Madison, WI 53703" },
  tenney: { id: "tenney", name: "Tenney Cafe", address: "25 S Pinckney St, Madison, WI 53703" },
  state: { id: "state", name: "State Street Cafe", address: "583 State St, Madison, WI 53703" },
  bassett: { id: "bassett", name: "Bassett Street Brunch Club", address: "444 W Johnson St, Madison, WI 53716" },
  monroe: { id: "monroe", name: "Monroe Cafe", address: "2530 Monroe St, Madison, WI 53711" },
  westtosa: { id: "westtosa", name: "West Tosa Cafe", address: "9125 W North Ave, Wauwatosa, WI 53226" },
  grafton: { id: "grafton", name: "Grafton Cafe", address: "1211 Washington St, Grafton, WI 53024" },
  mequon: { id: "mequon", name: "Mequon Cafe", address: "11205 N Cedarburg Rd Mequon WI 53092" },
  shorewood: { id: "shorewood", name: "Shorewood Cafe", address: "4500 N Oakland Ave, Shorewood, WI 53211" },
  prospect: { id: "prospect", name: "Prospect Cafe", address: "2211 N Prospect Ave, Milwaukee, WI 53202" },
  lakefront: { id: "lakefront", name: "Lakefront Cafe", address: "1701 N Lincoln Memorial Dr, Milwaukee, WI 53202" },
  thirdward: { id: "thirdward", name: "Third Ward Cafe", address: "223 E St Paul Ave, Milwaukee, WI 53202" },
  foundry: { id: "foundry", name: "Foundry Cafe", address: "170 S 1st St, Milwaukee, WI 53204" },
  usbank: { id: "usbank", name: "US Bank Colectivo", address: "777 E Wisconsin Ave, Milwaukee, WI 53202" },
  blum: { id: "blum", name: "Blum Coffee Garden", address: "4930 W. Loomis Road, Milwaukee, WI 53220" },
  humbolt: { id: "humbolt", name: "Humbolt Cafe", address: "2999 N Humboldt Blvd, Milwaukee, WI 53212" },
  bayview: { id: "bayview", name: "Bayview Cafe", address: "2301 S Kinnickinnic Ave, Milwaukee, WI 53207" },
  evanston: { id: "evanston", name: "Evanston Cafe", address: "716 Church St, Evanston, IL 60201" },
  andersonville: { id: "andersonville", name: "Andersonville Cafe", address: "5425 N Clark St, Chicago, IL 60640" },
  ravenswood: { id: "ravenswood", name: "Ravenswood Cafe", address: "1831 W Lawrence Ave, Chicago, IL 60640" },
  southport: { id: "southport", name: "Southport Cafe", address: "3258 N Southport Ave, Chicago, IL 60657" },
  lincolnpark: { id: "lincolnpark", name: "Lincoln Park Cafe", address: "2530 N Clark St, Chicago, IL 60614" },
  wickerpark: { id: "wickerpark", name: "Wicker Park Cafe", address: "1211 N Damen Ave, Chicago, IL 60622" },
  logansquare: { id: "logansquare", name: "Logan Square Cafe", address: "2261 N Milwaukee Ave, Chicago, IL 60647" },
  tradecraft: { id: "tradecraft", name: "Tradecraft", address: "940 Lively Blvd, Wood Dale, IL 60191" },
  riverside: { id: "riverside", name: "Riverside Cafe", address: "401 N Riverside Dr, Ste 7, Gurnee, IL 60031" },
};

export const routes: RouteDef[] = [
  { id: "milwaukee", label: "Milwaukee", short: "MIL", stopIds: ["westtosa", "grafton", "mequon","shorewood","prospect","lakefront","thirdward","foundry","usbank","blum","humbolt","bayview"] },
  { id: "madison", label: "Madison", short: "MAD", stopIds: ["easttosa", "willy", "tenney", "state","bassett","monroe"] },
  { id: "chicago", label: "Chicago", short: "CHI", stopIds: ["evanston", "andersonville","ravenswood","southport","lincolnpark","wickerpark","logansquare","tradecraft","riverside"] },
];

// One accent for any out-of-route stop (pulled in from another route's area).
// The colored left stripe alone signals it; no per-city palette.
export const OUT_OF_ROUTE_COLOR = "#59c8c7";

export function getRoute(id: RouteId): RouteDef | undefined {
  return routes.find((r) => r.id === id);
}

export function isNative(stopId: string, routeId: RouteId): boolean {
  return getRoute(routeId)?.stopIds.includes(stopId) ?? false;
}

export function homeRoutes(stopId: string): RouteDef[] {
  return routes.filter((r) => r.stopIds.includes(stopId));
}

export type MapsPlatform = "ios" | "other";

// Pick each platform's stock maps app so a user needn't have Google Maps installed:
// iPhone/iPad/iPod -> Apple Maps; everything else (Android stock + desktop) -> Google Maps.
export function detectMapsPlatform(userAgent: string): MapsPlatform {
  return /iPhone|iPad|iPod/i.test(userAgent) ? "ios" : "other";
}

export function directionsUrl(address: string, platform: MapsPlatform = "other"): string {
  const destination = encodeURIComponent(address);
  if (platform === "ios") {
    // Apple Maps, directions mode (dirflg=d); no saddr -> from current location.
    return `https://maps.apple.com/?daddr=${destination}&dirflg=d`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`;
}
