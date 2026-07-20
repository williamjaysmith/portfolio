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
    <main className="h-dvh flex flex-col bg-[#fbf8f0]">
      <div className="w-full max-w-md mx-auto px-3 py-6 flex flex-col flex-1 min-h-0">
        <ColectivoLogo className="block mx-auto mb-5 w-56 text-[#2c2c2c] shrink-0" />
        <RouteTabs routes={routes} activeId={activeId} onSelect={setActiveId} />
        {/* Card grows to fill the space but never taller than ~8 stops (max-h) nor
            shorter than ~2 stops (min-h); between those it shrinks with the window so
            the footer is never cut off. */}
        <div className="border border-t-0 border-[#2c2c2c]/20 bg-white rounded-b-lg relative overflow-hidden flex-1 min-h-[14rem] max-h-[44rem]">
          <StopList route={activeRoute} />
        </div>
      </div>
    </main>
  );
}
