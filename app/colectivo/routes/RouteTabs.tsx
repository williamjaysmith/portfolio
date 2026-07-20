"use client";

import { type RouteDef, type RouteId } from "@/lib/colectivo";

export interface RouteTabsProps {
  routes: RouteDef[];
  activeId: RouteId;
  onSelect(id: RouteId): void;
}

// Folder tabs (Strangebad-style) mapped to Colectivo's charcoal/cream palette:
// inactive = charcoal, active = cream so it merges flush into the content card below.
const ACTIVE = "bg-[#fbf8f0] text-[#2c2c2c] border border-b-0 border-[#2c2c2c] -mb-px";
const INACTIVE = "bg-[#2c2c2c] text-[#fbf8f0] border border-transparent hover:brightness-150";

export function RouteTabs({ routes, activeId, onSelect }: RouteTabsProps) {
  return (
    <nav aria-label="Routes">
      <ul className="flex items-end gap-1">
        {routes.map((route) => {
          const active = route.id === activeId;
          return (
            <li key={route.id} className="flex-1">
              <button
                type="button"
                aria-current={active ? "page" : undefined}
                onClick={() => onSelect(route.id)}
                className={`w-full rounded-t-lg px-4 py-3 text-center font-black tracking-wide transition ${
                  active ? ACTIVE : INACTIVE
                }`}
              >
                {route.short}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
