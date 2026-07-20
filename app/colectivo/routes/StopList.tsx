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
  type Modifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import { type RouteDef, stops, isNative } from "@/lib/colectivo";
import type { RouteStorage } from "@/lib/colectivo-storage";
import { useRouteState } from "./useRouteState";
import { SortableStopItem } from "./SortableStopItem";
import { AddStopSheet } from "./AddStopSheet";

// Lock drag movement to the vertical axis so a sideways drag can't scroll the list right.
const restrictToVerticalAxis: Modifier = ({ transform }) => ({ ...transform, x: 0 });

export interface StopListProps {
  route: RouteDef;
  backend?: RouteStorage;
}

export function StopList({ route, backend }: StopListProps) {
  const rs = useRouteState(route, backend);
  const [showDelivered, setShowDelivered] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  // fallow-ignore-next-line code-duplication -- intentional: matches the Skyhammer player's drag feel (plan Approach A)
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

  const handleReset = () => {
    if (window.confirm(`Reset ${route.label} to default? This clears your order and delivered marks. Your notes are kept.`)) {
      rs.reset();
    }
  };

  if (!rs.ready) {
    return (
      <div className="absolute inset-0 flex items-center justify-center text-[#2c2c2c]/60">
        Loading…
      </div>
    );
  }

  const visibleIds = rs.state.order.filter(
    (id) => showDelivered || !rs.state.delivered.includes(id),
  );

  return (
    <>
      <div className="absolute inset-0 overflow-x-hidden overflow-y-auto pb-16">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
          modifiers={[restrictToVerticalAxis]}
        >
          <SortableContext items={visibleIds} strategy={verticalListSortingStrategy}>
            <div>
              {visibleIds.map((id) => {
                const stop = stops[id];
                if (!stop) return null;
                const outOfRoute = !isNative(id, route.id);
                return (
                  <SortableStopItem
                    key={id}
                    stop={stop}
                    outOfRoute={outOfRoute}
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
      </div>

      {/* Footer — charcoal bottom of the card; fixed height matches the list's pb so
          stops scroll behind its edge with no white gap */}
      <div className="absolute bottom-0 left-0 right-0 h-16 bg-[#2c2c2c] px-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          aria-label="Add stop"
          className="w-11 h-11 rounded-full bg-[#59c8c7] text-[#2c2c2c] flex items-center justify-center shrink-0"
        >
          <Plus className="w-6 h-6" strokeWidth={3} />
        </button>
        <button
          type="button"
          onClick={() => setShowDelivered((v) => !v)}
          className="text-[#fbf8f0] font-bold text-sm uppercase tracking-wide"
        >
          {showDelivered ? "Hide delivered" : "Show delivered"}
        </button>
        <button
          type="button"
          onClick={handleReset}
          className="px-3 py-2 rounded bg-[#fbf8f0] text-[#2c2c2c] font-bold text-sm"
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
    </>
  );
}
