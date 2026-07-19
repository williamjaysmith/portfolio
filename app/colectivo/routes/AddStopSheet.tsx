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
