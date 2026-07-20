"use client";

import { useState } from "react";
import { type RouteId, routes, getRoute } from "@/lib/colectivo";
import { ColectivoLogo } from "./ColectivoLogo";
import { RouteTabs } from "./RouteTabs";
import { StopList } from "./StopList";

export default function ColectivoRoutesPage() {
  const [activeId, setActiveId] = useState<RouteId>(routes[0].id);
  const activeRoute = getRoute(activeId)!;

  return (
    <main className="min-h-screen bg-[#fbf8f0]">
      <div className="w-full max-w-md mx-auto px-3 pt-6">
        <ColectivoLogo className="block mx-auto mb-5 w-56 text-[#2c2c2c]" />
        <RouteTabs routes={routes} activeId={activeId} onSelect={setActiveId} />
        <div className="border border-[#2c2c2c] bg-[#fbf8f0]">
          <StopList route={activeRoute} />
        </div>
      </div>
    </main>
  );
}
