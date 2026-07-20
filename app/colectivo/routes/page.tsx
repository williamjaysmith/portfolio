"use client";

import { useState } from "react";
import type { RouteDef } from "@/lib/colectivo";
import { RouteSelector } from "./RouteSelector";
import { StopList } from "./StopList";

export default function ColectivoRoutesPage() {
  const [route, setRoute] = useState<RouteDef | null>(null);

  return (
    <main className="min-h-screen bg-[#fbf8f0]">
      {route ? (
        <StopList route={route} onBack={() => setRoute(null)} />
      ) : (
        <RouteSelector onSelect={setRoute} />
      )}
    </main>
  );
}
