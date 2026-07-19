# Colectivo Routing — Design Spec

**Date:** 2026-07-19
**Feature URL:** `willsmith.dev/colectivo/routes`
**Status:** Approved design, ready for implementation planning

## Overview

A mobile-first delivery-routing tool for the author's job as a Colectivo delivery
driver. The driver picks one of four routes, sees that route's stops in a
preferred/efficient default order, taps a stop to launch turn-by-turn directions,
and can reorder stops, pull in stops from other routes (visibly flagged), mark
stops delivered, and keep per-cafe notes.

It is hosted on the author's existing Next.js portfolio and reuses the drag-to-
reorder interaction already built for the `/skyhammer` music player.

### Goals

- Pick a route → see its stops (name, address, map action) in a default order.
- One-tap turn-by-turn directions from current location to a stop.
- Drag-reorder stops, with the exact feel of the `/skyhammer` player.
- Add a stop from another route, clearly flagged as "not normal for this route."
- Mark stops delivered (they hide); reveal them again; reset the route.
- Per-cafe notes that persist and survive resets.

### Non-goals (YAGNI, for now)

- No backend / accounts / multi-device sync (see Future Considerations — MongoDB).
- No per-route bookmarkable URLs (single page, content swaps).
- No auth / access gating (page is public).
- No in-app editing of the master location list (edited in code for now).

## Scope & routing

- Lives at `app/colectivo/routes/page.tsx` — a single client page.
- Two screens on one page, content swaps (no URL change between them):
  1. **Route picker** — Milwaukee, Madison, Chicago, Kegs.
  2. **Stop list** — for the selected route.
- `/colectivo` is treated as a namespace/hub for possible future tools; `routes`
  is the first feature under it.
- Page is **public** (no gate). Not linked from the portfolio nav.

## Data model

All location data lives in a hand-edited, git-tracked file: `lib/colectivo.ts`.
The author fills in the real cafes/addresses; the file is scaffolded with the
four real route names and a few placeholder stops each.

```ts
export type RouteId = "milwaukee" | "madison" | "chicago" | "kegs";

export interface Stop {
  id: string;      // stable slug, e.g. "hilldale"
  name: string;    // "Colectivo Hilldale"
  address: string; // "702 N Midvale Blvd, Madison, WI 53705"
  note?: string;   // OPTIONAL seed note, permanent + git-backed
}

export interface RouteDef {
  id: RouteId;
  label: string;      // "Madison"
  color: string;      // per-route accent hex (see Badge & color)
  stopIds: string[];  // DEFAULT efficient order for this route
}

export const stops: Record<string, Stop>;  // every cafe, defined once
export const routes: RouteDef[];            // the four routes + ordered stopIds
```

### Native membership (single source of truth)

A stop is **native** to a route if and only if its `id` appears in that route's
`stopIds`. No separate membership flag exists.

- A cafe shared by Madison and Kegs simply appears in both routes' `stopIds`, and
  shows **un-badged** on both. This models the Kegs overlap accurately.
- A stop present in the working list but **not** in the current route's `stopIds`
  is an **out-of-route** stop → it gets a badge + colored stripe (see below).

Helpers in `colectivo.ts`:

- `isNative(stopId, routeId): boolean`
- `homeRoutes(stopId): RouteDef[]` — routes whose defaults include this stop.
- `directionsUrl(address): string` — see Directions.

## Persistence

Chosen model: **saved on this device** (localStorage). No backend, no accounts.
Changes stick across reloads and days on the driver's phone.

**All persistence is accessed through the `useRouteState` hook via a small
internal storage interface** (e.g. `load(key)`, `save(key, value)`), so the
backend can be swapped later (see Future Considerations — MongoDB) without
touching the UI.

### localStorage keys

1. `colectivo:route:<routeId>` — per-route **daily state**:
   ```ts
   { order: string[];      // current ordered stop ids (native + added)
     delivered: string[] } // ids marked delivered
   ```
2. `colectivo:notes` — **per-stop notes**, keyed by stop id, shared across all
   routes, **not per-route**:
   ```ts
   { [stopId: string]: string }
   ```

### Reconciliation (on opening a route)

`useRouteState` reads `colectivo:route:<routeId>` and reconciles against the code
so editing `colectivo.ts` never breaks or hides saved state:

- If no saved state: `order = route.stopIds`, `delivered = []`.
- If saved state exists:
  - Keep saved `order`, **drop** ids no longer present in `stops`.
  - **Append** any new native `stopIds` (added to the route's defaults since last
    save) that aren't already in `order`, at the **bottom**.
  - `delivered` = saved delivered ∩ current order.
- If the stored JSON is unparseable or an old/unknown shape: **discard and fall
  back to defaults** (no white-screen).

### Reset to default

- Clears `colectivo:route:<routeId>` (order + delivered) → back to coded default
  order; added stops gone; delivered marks cleared.
- **Does NOT touch `colectivo:notes`.** Notes are preserved.
- Behind a confirm: *"Reset Madison to default? This clears your order and
  delivered marks. Your notes are kept."*

### SSR / hydration

Reuse the `mounted` gate already used in `/skyhammer`: render a static default
list on the server, read localStorage only after mount, to avoid hydration
mismatch.

## Screens & layout

Matches the portfolio aesthetic: charcoal (`#2c2c2c`) on cream (`#fbf8f0`), bold
type, Skyhammer-style borders.

### Screen 1 — Route picker

Four large tap targets, each accented with its route color:

```
        C O L E C T I V O
     ┌───────────────────────┐
     │   MILWAUKEE           ›│
     │   MADISON             ›│
     │   CHICAGO             ›│
     │   KEGS                ›│
     └───────────────────────┘
```

### Screen 2 — Stop list

```
 ‹ Routes                MADISON
 ────────────────────────────────────────────
 │↗   Colectivo Hilldale             ( ○ )  ⠿
 │    702 N Midvale Blvd…            ⌄ ⓘ
 ────────────────────────────────────────────
 ┃↗   Colectivo Prospect  ‹Milwaukee›  ( ○ )  ⠿   ✕
 ┃    2211 N Prospect Ave…           ⌄
 ────────────────────────────────────────────
    [ + Add stop ]
    [ Show delivered (0) ]        [ Reset ]
```

**Row anatomy (left → right):**

- **`↗` directions** — far left, **tap** → Google Maps directions (charcoal-
  tinted `MdAssistantNavigation`). Disabled if the stop has no address.
- **name + address** — address smaller, beneath the name.
- **`‹Milwaukee›` badge + left stripe** — only on out-of-route stops, in the
  origin route's color.
- **`⌄` notes chevron** — expands an inline note editor beneath the row; shows a
  filled icon when a note exists. The **`ⓘ`** beside it reveals the on-device
  disclaimer.
- **`○` done circle** — center-right, **tap** → marks delivered; the row animates
  out of the active list.
- **`⠿` grip** — far right (opposite the directions button so the two are never
  confused), **press-and-hold** to drag-reorder.
- **`✕` remove** — **only on added (out-of-route) stops**; removes the stop
  entirely. Native stops have no `✕`.

## Interactions

### Drag-to-reorder

Reuse the `/skyhammer` dnd-kit configuration (copied, not refactored — Skyhammer
stays untouched):

- `DndContext` + `SortableContext` + `verticalListSortingStrategy`.
- `PointerSensor` with `activationConstraint: { delay: 250, tolerance: 5 }` so a
  quick tap acts and a press-hold drags.
- `KeyboardSensor` with `sortableKeyboardCoordinates`.
- `arrayMove` on drag end; persist new order.

### Directions

`directionsUrl(address)` returns:

```
https://www.google.com/maps/dir/?api=1&destination=<encoded address>&travelmode=driving
```

Omitting the origin makes Google Maps route from current location. Universal
cross-platform link; on the author's iPhone with Google Maps installed it opens
straight into navigation. Falls back to the browser otherwise.

### Mark delivered / Show delivered

- Tapping `○` marks the stop delivered → it leaves the active list (animated).
- **Show delivered / Hide delivered** toggle (with count) reveals delivered stops
  dimmed + struck-through, each with an undo tap to un-deliver.
- When every stop is delivered: an "All delivered 🎉" state, with Show delivered
  and Reset still reachable.

### Add stop (`AddStopSheet`)

- `+ Add stop` opens a sheet listing every stop **not native to this route**,
  grouped by home route, with a search box.
- Stops already on the current list are filtered out (no duplicate-add).
- Tapping `+` appends the stop to the **bottom** of the list, badged as out-of-
  route; the driver then drags it into position.
- Added stops carry a `✕` to remove them entirely.

### Notes

- Each stop has an expandable inline note editor (the `⌄` chevron).
- Saved to `colectivo:notes` keyed by stop id → the same note shows on every route
  the cafe appears on, and **survives Reset**.
- Displayed note = the in-app edit if present, otherwise the seed `note` from
  `colectivo.ts`.
- **Disclaimer** (behind the `ⓘ`): *"📝 Notes are saved on this device only —
  clearing your browser data or switching phones will erase them."*
- **Export notes** — a one-tap action that copies all notes as text, so they can
  be backed up (or pasted into `colectivo.ts` to make them permanent/git-backed).

## Badge & per-route color

Out-of-route stops are color-coded by their **origin route**. The color appears as
a left stripe on the row + the pill background/border, and as the accent on the
route picker. Native stops show no stripe/badge.

| Route     | Accent      | Hex       |
|-----------|-------------|-----------|
| Milwaukee | slate blue  | `#2f5b8f` |
| Madison   | rust red    | `#b5462e` |
| Chicago   | forest green| `#3f7d4e` |
| Kegs      | amber       | `#b4791f` |

Hexes are a tunable starting point.

## File structure (new; Skyhammer untouched)

```
app/colectivo/routes/
  page.tsx             // orchestrates: picker ↔ list, owns route selection
  RouteSelector.tsx    // the four-route picker screen
  StopList.tsx         // DndContext + the sortable list + bottom action bar
  SortableStopItem.tsx // one row: directions, name/addr, badge, notes, done, grip, remove
  AddStopSheet.tsx     // picker of stops from other routes
  useRouteState.ts     // storage-backed hook: load/reconcile/persist + actions
lib/colectivo.ts       // master stops + route defaults + helpers (incl. directionsUrl)
```

## Error handling & edge cases

- **localStorage unavailable** (private mode / quota) → app runs in memory for the
  session; a quiet one-line notice that changes won't be saved. Never crashes.
- **Corrupt/old saved data** → discarded, falls back to defaults.
- **Blank/missing address** → directions arrow disabled for that stop.
- **Unknown route id in state** → ignored, falls back to the picker.
- **Duplicate add** → prevented (filtered out of the Add sheet).
- **All delivered** → friendly empty state (see Interactions).

Philosophy: this is relied on mid-shift, so it degrades gracefully — worst case it
forgets today's reordering; it never loses the ability to see stops or get
directions.

## Testing

- Add a lightweight test runner (Vitest) — none currently in `package.json`;
  confirm before adding.
- Unit-test the pure logic:
  - `useRouteState` reconciliation: added/removed/renamed stops in `colectivo.ts`.
  - `isNative` / out-of-route detection.
  - Reset behavior (clears order + delivered, preserves notes).
  - Notes read/write and survival across reset.
  - `directionsUrl` encoding.
- Drag + visual layers verified by running the app (as Skyhammer is).

## Implementation approach

**Approach A — self-contained feature module, reuse Skyhammer's drag pattern.**
Copy Skyhammer's proven dnd-kit config rather than refactoring the working player.
Keeps Skyhammer safe, keeps files small and focused, and reuses the interaction
the author already likes. (Rejected: extracting a shared `<SortableList>` — YAGNI
until a third consumer; inlining everything in one giant file — this feature is
more complex than the player.)

## Future considerations

- **MongoDB migration:** persistence is isolated behind the `useRouteState`
  storage interface specifically so localStorage can be replaced with a Mongo-
  backed API later, giving multi-device sync + durable notes, without UI changes.
  This is also the point at which on-device note-durability concerns go away.
- **Per-route bookmarkable URLs** (`/colectivo/routes/madison`) — could be added
  later for home-screen shortcuts straight to a route.
- **Lat/long precision** — addresses drive the directions link today; coordinates
  could be added per stop for pin-perfect navigation.
- **Home-screen web-app install** — improves localStorage durability on iOS
  Safari (dodges the ~7-day dormant-site data eviction).
```
