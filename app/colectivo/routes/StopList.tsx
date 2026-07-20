"use client";

import { useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { ChevronLeft } from "lucide-react";
import { type RouteDef, stops, isNative, homeRoutes } from "@/lib/colectivo";
import type { RouteStorage } from "@/lib/colectivo-storage";
import { useRouteState } from "./useRouteState";
import { SortableStopItem } from "./SortableStopItem";
import { AddStopSheet } from "./AddStopSheet";

export interface StopListProps {
  route: RouteDef;
  onBack(): void;
  backend?: RouteStorage;
}

export function StopList({ route, onBack, backend }: StopListProps) {
  const rs = useRouteState(route, backend);
  const [showDelivered, setShowDelivered] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
      onActivation: (event) => event.event.preventDefault(),
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      rs.reorder(String(active.id), String(over.id));
    }
  };

  const handleExport = async () => {
    const text = rs.exportNotes();
    try {
      await navigator.clipboard.writeText(text);
      alert("Notes copied to clipboard.");
    } catch {
      alert(text);
    }
  };

  const handleReset = () => {
    if (window.confirm(`Reset ${route.label} to default? This clears your order and delivered marks. Your notes are kept.`)) {
      rs.reset();
    }
  };

  if (!rs.ready) {
    return <div className="p-6 text-[#2c2c2c]/60">Loading…</div>;
  }

  const deliveredCount = rs.state.delivered.length;
  const visibleIds = rs.state.order.filter(
    (id) => showDelivered || !rs.state.delivered.includes(id),
  );

  const originFor = (id: string) => homeRoutes(id).find((r) => r.id !== route.id) ?? homeRoutes(id)[0];

  return (
    <div className="w-full max-w-md mx-auto pb-24">
      <div className="flex items-center justify-between p-4">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to routes"
          className="flex items-center gap-1 text-[#2c2c2c] font-bold"
        >
          <ChevronLeft className="w-5 h-5" /> Routes
        </button>
        <h1 className="font-black text-[#2c2c2c]" style={{ color: route.color }}>
          {route.label.toUpperCase()}
        </h1>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={visibleIds} strategy={verticalListSortingStrategy}>
          <div className="border-t border-[#2c2c2c]/20">
            {visibleIds.map((id) => {
              const stop = stops[id];
              if (!stop) return null;
              const outOfRoute = !isNative(id, route.id);
              const origin = outOfRoute ? originFor(id) : undefined;
              return (
                <SortableStopItem
                  key={id}
                  stop={stop}
                  outOfRoute={outOfRoute}
                  originLabel={origin?.label}
                  originColor={origin?.color}
                  delivered={rs.state.delivered.includes(id)}
                  note={rs.notes[id] ?? stop.note ?? ""}
                  onToggleDelivered={() => rs.toggleDelivered(id)}
                  onRemove={outOfRoute ? () => rs.remove(id) : undefined}
                  onNoteChange={(text) => rs.setNote(id, text)}
                />
              );
            })}
          </div>
        </SortableContext>
      </DndContext>

      {visibleIds.length === 0 && (
        <p className="p-6 text-center text-[#2c2c2c]/70">All delivered 🎉</p>
      )}

      <div className="fixed bottom-0 left-0 right-0 bg-[#fbf8f0] border-t border-[#2c2c2c]/20 p-3 flex flex-wrap gap-2 justify-center">
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="px-3 py-2 border border-[#2c2c2c] text-[#2c2c2c] font-bold text-sm"
        >
          + Add stop
        </button>
        <button
          type="button"
          onClick={() => setShowDelivered((v) => !v)}
          className="px-3 py-2 border border-[#2c2c2c] text-[#2c2c2c] font-bold text-sm"
        >
          {showDelivered ? "Hide delivered" : `Show delivered (${deliveredCount})`}
        </button>
        <button
          type="button"
          onClick={handleExport}
          className="px-3 py-2 border border-[#2c2c2c] text-[#2c2c2c] font-bold text-sm"
        >
          Export notes
        </button>
        <button
          type="button"
          onClick={handleReset}
          className="px-3 py-2 border border-[#2c2c2c] text-[#2c2c2c] font-bold text-sm"
        >
          Reset
        </button>
      </div>

      {sheetOpen && (
        <AddStopSheet
          route={route}
          currentOrder={rs.state.order}
          onAdd={(id) => {
            rs.add(id);
            setSheetOpen(false);
          }}
          onClose={() => setSheetOpen(false)}
        />
      )}
    </div>
  );
}
