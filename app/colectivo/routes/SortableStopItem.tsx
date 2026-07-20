"use client";

import { useEffect, useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Check, X, ChevronDown } from "lucide-react";
import { MdAssistantNavigation } from "react-icons/md";
import { type Stop, type MapsPlatform, OUT_OF_ROUTE_COLOR, directionsUrl, detectMapsPlatform } from "@/lib/colectivo";

const DISCLAIMER =
  "* Notes are saved on this device only. Clearing your browser data or switching phones will erase them *";

export interface SortableStopItemProps {
  stop: Stop;
  outOfRoute: boolean;
  delivered: boolean;
  note: string;
  onToggleDelivered(): void;
  onRemove?(): void;
  onNoteChange(text: string): void;
}

export function SortableStopItem({
  stop,
  outOfRoute,
  delivered,
  note,
  onToggleDelivered,
  onRemove,
  onNoteChange,
}: SortableStopItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: stop.id,
  });
  const [notesOpen, setNotesOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  // Default to Google (web/Android/SSR); switch to Apple Maps on iOS after mount.
  const [mapsPlatform, setMapsPlatform] = useState<MapsPlatform>("other");
  useEffect(() => {
    setMapsPlatform(detectMapsPlatform(navigator.userAgent));
  }, []);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    borderLeft: outOfRoute ? `4px solid ${OUT_OF_ROUTE_COLOR}` : "4px solid transparent",
  };

  const hasAddress = stop.address.trim().length > 0;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`border-b border-[#2c2c2c]/20 ${delivered ? "opacity-50" : ""}`}
    >
      <div className="flex items-center gap-2 py-3 pl-3 pr-2">
        {/* Directions — far left */}
        {hasAddress ? (
          <a
            href={directionsUrl(stop.address, mapsPlatform)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Directions to ${stop.name}`}
            className="text-[#2c2c2c] shrink-0"
          >
            <MdAssistantNavigation className="w-6 h-6" />
          </a>
        ) : (
          <span aria-label="No address" className="text-[#2c2c2c]/30 shrink-0">
            <MdAssistantNavigation className="w-6 h-6" />
          </span>
        )}

        {/* Name + address (out-of-route is signaled by the colored left stripe) */}
        <div className="flex-1 min-w-0">
          <div className={`text-[#2c2c2c] ${delivered ? "line-through" : "font-semibold"}`}>
            {stop.name}
          </div>
          <div className="text-sm text-[#2c2c2c]/70 truncate">{stop.address}</div>
          <button
            type="button"
            onClick={() => setNotesOpen((v) => !v)}
            aria-label="Toggle notes"
            className="mt-1 inline-flex items-center gap-1 text-xs text-[#2c2c2c]/80"
          >
            <ChevronDown className={`w-4 h-4 transition-transform ${notesOpen ? "rotate-180" : ""}`} />
            Notes{note ? " •" : ""}
          </button>
        </div>

        {/* Remove (added stops only) — sits left of the delivered control so the
            delivered controls stay right-aligned across every row */}
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${stop.name}`}
            className="text-[#2c2c2c]/50 hover:text-[#b5462e] shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Delivered control — square checkbox; tapping (when not delivered) opens the confirm pop-up */}
        <button
          type="button"
          onClick={() => (delivered ? onToggleDelivered() : setConfirming(true))}
          aria-label={delivered ? `Mark ${stop.name} not delivered` : `Mark ${stop.name} delivered`}
          className={`w-5 h-5 rounded-md border-2 border-[#2c2c2c] flex items-center justify-center shrink-0 ${
            delivered ? "bg-[#2c2c2c] text-white" : ""
          }`}
        >
          {delivered && <Check className="w-3.5 h-3.5" />}
        </button>

        {/* Grip — far right, press-hold to drag */}
        <div
          {...attributes}
          {...listeners}
          onContextMenu={(e) => e.preventDefault()}
          aria-label={`Drag ${stop.name}`}
          className="cursor-grab active:cursor-grabbing text-[#2c2c2c]/50 hover:text-[#2c2c2c] flex items-center justify-center py-2 px-1 shrink-0 select-none"
          style={{ touchAction: "none", WebkitUserSelect: "none" }}
        >
          <GripVertical className="w-5 h-5" />
        </div>
      </div>

      {/* Inline notes editor */}
      {notesOpen && (
        <div className="px-3 pb-3">
          <textarea
            value={note}
            onChange={(e) => onNoteChange(e.target.value)}
            placeholder="e.g. prefers bakery on the glass counter"
            className="w-full text-sm border border-[#2c2c2c]/30 rounded p-2 bg-white/60"
            rows={2}
          />
          <p className="mt-1 text-xs italic text-[#2c2c2c]/80">{DISCLAIMER}</p>
        </div>
      )}

      {/* Delivery confirmation pop-up */}
      {confirming && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Confirm delivery to ${stop.name}`}
        >
          <div className="w-full max-w-xs bg-white border border-[#2c2c2c] rounded-lg p-5 text-center shadow-lg">
            <p className="text-[#2c2c2c] mb-1">Did you deliver to</p>
            <p className="text-[#2c2c2c] font-black text-lg mb-4">{stop.name}?</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setConfirming(false);
                  onToggleDelivered();
                }}
                aria-label={`Yes, delivered to ${stop.name}`}
                className="flex-1 px-4 py-2 bg-[#2c2c2c] text-white font-bold rounded"
              >
                Yes
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                aria-label="Cancel"
                className="flex-1 px-4 py-2 border border-[#2c2c2c] text-[#2c2c2c] font-bold rounded"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
