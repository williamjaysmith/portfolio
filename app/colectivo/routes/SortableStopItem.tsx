"use client";

import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Check, X, ChevronDown, Info } from "lucide-react";
import { MdAssistantNavigation } from "react-icons/md";
import { type Stop, directionsUrl } from "@/lib/colectivo";

const DISCLAIMER =
  "📝 Notes are saved on this device only — clearing your browser data or switching phones will erase them.";

export interface SortableStopItemProps {
  stop: Stop;
  outOfRoute: boolean;
  originLabel?: string;
  originColor?: string;
  delivered: boolean;
  note: string;
  onToggleDelivered(): void;
  onRemove?(): void;
  onNoteChange(text: string): void;
}

export function SortableStopItem({
  stop,
  outOfRoute,
  originLabel,
  originColor,
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
  const [showInfo, setShowInfo] = useState(false);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    borderLeft: outOfRoute && originColor ? `4px solid ${originColor}` : "4px solid transparent",
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
            href={directionsUrl(stop.address)}
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

        {/* Name + address + badge */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[#2c2c2c] ${delivered ? "line-through" : "font-semibold"}`}>
              {stop.name}
            </span>
            {outOfRoute && originLabel && (
              <span
                className="text-xs font-bold px-2 py-0.5 rounded-full border"
                style={{ color: originColor, borderColor: originColor }}
              >
                {originLabel}
              </span>
            )}
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

        {/* Done circle */}
        <button
          type="button"
          onClick={onToggleDelivered}
          aria-label={delivered ? "Mark not delivered" : "Mark delivered"}
          className={`w-8 h-8 rounded-full border-2 border-[#2c2c2c] flex items-center justify-center shrink-0 ${
            delivered ? "bg-[#2c2c2c] text-white" : "text-transparent"
          }`}
        >
          <Check className="w-4 h-4" />
        </button>

        {/* Remove — added stops only */}
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
          <button
            type="button"
            onClick={() => setShowInfo((v) => !v)}
            aria-label="About note storage"
            className="mt-1 inline-flex items-center gap-1 text-xs text-[#2c2c2c]/80"
          >
            <Info className="w-3 h-3" /> Where are notes saved?
          </button>
          {showInfo && <p className="mt-1 text-xs italic text-[#2c2c2c]/80">{DISCLAIMER}</p>}
        </div>
      )}
    </div>
  );
}
