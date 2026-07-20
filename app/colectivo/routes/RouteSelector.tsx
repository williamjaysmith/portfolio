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
