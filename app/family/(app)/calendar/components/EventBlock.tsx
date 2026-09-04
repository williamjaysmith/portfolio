"use client";

import type { CSSProperties } from "react";

import type { TimedSegment } from "@/lib/family/calendar/layout";
import { eventInk, type Ink, type PaletteColor } from "@/lib/family/colors";
import type { EventTimes, Occurrence, TimeFormat } from "@/lib/family/types";

/**
 * One drawn rectangle of a timed occurrence (T031). Purely presentational:
 * `layout.ts` decided the rectangle (top/height already floored per FR-218,
 * fractions already clustered per FR-205/285) and `colors.ts` decides the ink
 * (FR-214) — this component renders both verbatim and computes nothing.
 *
 * The three renderings (FR-211/212/213):
 * - one category   → the block fills with that colour;
 * - several        → 45° stripes in draw order (FR-227), with the title on a
 *                    solid run of the FIRST colour so it stays legible;
 * - none           → the neutral block: light fill, thin border, dark ink.
 *
 * A midnight-crossing event arrives as one segment per touched column, all
 * sharing one `occurrence` (FR-217) — every segment shows the event's TRUE
 * full range, never a per-column clip, so both halves read as one event.
 *
 * Each block is a focusable button at least 44pt tall (FR-263; layout's
 * `minBlockHeight` guarantees the height). Its press opens the occurrence's
 * details (FR-256) — never an edit directly (FR-257): the block only reports
 * WHICH occurrence was tapped through `onOpen`, and every segment of a
 * midnight-crosser reports the same one.
 */

/** Category ids → the block's fills in draw order; unknown ids drop out. */
export function fillsOf(
  categoryIds: readonly string[],
  colorsById: Readonly<Record<string, PaletteColor>>,
): PaletteColor[] {
  return categoryIds
    .map((id) => colorsById[id])
    .filter((color): color is PaletteColor => color !== undefined);
}

/**
 * FR-212's striped treatment as a CSS gradient: one `--fam-stripe-w` run per
 * colour in draw order, repeating at the token's `--fam-stripe-angle`.
 */
export function stripeBackground(fills: readonly PaletteColor[]): string {
  const stops = fills
    .map(
      (color, index) =>
        `${color} calc(${index} * var(--fam-stripe-w)) calc(${index + 1} * var(--fam-stripe-w))`,
    )
    .join(", ");
  return `repeating-linear-gradient(var(--fam-stripe-angle), ${stops})`;
}

const timeFormatters = new Map<string, Intl.DateTimeFormat>();

function timeFormatterFor(zone: string, timeFormat: TimeFormat): Intl.DateTimeFormat {
  const key = `${zone}|${timeFormat}`;
  const cached = timeFormatters.get(key);
  if (cached) return cached;
  const formatter =
    timeFormat === "24h"
      ? new Intl.DateTimeFormat("en-US", {
          timeZone: zone,
          hourCycle: "h23",
          hour: "2-digit",
          minute: "2-digit",
        })
      : new Intl.DateTimeFormat("en-US", {
          timeZone: zone,
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        });
  timeFormatters.set(key, formatter);
  return formatter;
}

/**
 * The event's TRUE household-local range — "9:30 AM – 10:15 AM" or
 * "09:30 – 10:15" — from its stored instants, whatever column shows it
 * (FR-217/218: rendering may clip or inflate, the label never does).
 */
export function formatTimeRange(times: EventTimes, zone: string, timeFormat: TimeFormat): string {
  if (times.allDay) return "All day";
  const formatter = timeFormatterFor(zone, timeFormat);
  return `${formatter.format(Date.parse(times.startsAt))} – ${formatter.format(Date.parse(times.endsAt))}`;
}

type Variant = "single" | "striped" | "neutral";

function variantOf(fills: readonly PaletteColor[]): Variant {
  if (fills.length === 0) return "neutral";
  return fills.length === 1 ? "single" : "striped";
}

export interface EventBlockProps {
  segment: TimedSegment;
  /** The occurrence's category colours in draw order (FR-227) — see `fillsOf`. */
  fills: readonly PaletteColor[];
  /** FR-215: the event has ended (minute granularity, decided above). */
  dimmed: boolean;
  /** Household IANA zone — the one zone every render works in (FR-219/284). */
  zone: string;
  timeFormat: TimeFormat;
  /** FR-256: a press opens this occurrence's details. Absent = read-only. */
  onOpen?: (occurrence: Occurrence) => void;
}

export function EventBlock({ segment, fills, dimmed, zone, timeFormat, onOpen }: EventBlockProps) {
  const variant = variantOf(fills);
  const ink: Ink = eventInk(fills);

  const style: CSSProperties = {
    top: segment.top,
    height: segment.height,
    left: `calc(${segment.leftFraction * 100}% + var(--fam-event-inset))`,
    width: `calc(${segment.widthFraction * 100}% - 2 * var(--fam-event-inset))`,
    color: ink,
  };
  if (variant === "single") style.backgroundColor = fills[0];
  if (variant === "striped") style.backgroundImage = stripeBackground(fills);
  // FR-217: an open edge where the event continues into the neighbour column.
  if (segment.continuesFromPrevious) {
    style.borderTopLeftRadius = 0;
    style.borderTopRightRadius = 0;
  }
  if (segment.continuesToNext) {
    style.borderBottomLeftRadius = 0;
    style.borderBottomRightRadius = 0;
  }

  return (
    <button
      type="button"
      data-variant={variant}
      onClick={() => onOpen?.(segment.occurrence)}
      style={style}
      className={`absolute overflow-hidden rounded-(--fam-radius-card) pt-(--fam-event-pad) pr-(--fam-event-pad-end) pb-(--fam-event-pad-end) pl-(--fam-event-pad) text-left ${
        variant === "neutral"
          ? "border bg-(--fam-event-neutral-fill) border-(--fam-event-neutral-border)"
          : ""
      } ${dimmed ? "opacity-(--fam-past-dim)" : ""}`}
    >
      <span
        className="block w-fit max-w-full truncate font-semibold text-(length:--fam-fs-event-title)"
        // FR-212: on stripes the title sits on a solid run of the first
        // colour — the same colour FR-214's ink was chosen against.
        style={variant === "striped" ? { backgroundColor: fills[0] } : undefined}
      >
        {segment.occurrence.summary}
      </span>
      <span className="mt-(--fam-event-gap) block truncate text-(length:--fam-fs-body) tabular-nums">
        {formatTimeRange(segment.occurrence.times, zone, timeFormat)}
      </span>
    </button>
  );
}
