# Phase 0 Research: Family Lists

**Feature**: `005-family-lists` | **Date**: 2026-09-05

Every decision the plan needs that the spec left to design, each with its rationale and the
alternatives it beat. Numbered R501–R516 so the plan, data model, contracts and tasks can cite
them; the spec's own numbered decisions are Assumptions 1–17 and are not restated here.

Phases 2–4's research (R201–R214, R301–R326, R401–R418) remains in force. This phase adds no
trigger that writes, no view and no function on the write path: lists carry no money, so the
database's job here is shape, tenancy and cascade, and the actions' job is one statement each.

## What binds this phase before any decision is taken

- **Lists are the household's, and open** (spec Assumptions 4–5): every write is any punched-in
  Profile's, attributed (Phase 1 FR-016); the one gate is Parents only, judged from the role.
- **A write is one statement or it is refused** (FR-537, SC-505, SC-506): a drop writes one row, a
  clear deletes one set, a section change updates one set; nothing is two writes that could be
  half-done.
- **Shipped shapes are inherited, not forked**: the board chassis (`lib/family/tasks/layout.ts`,
  `useBoardGeometry`, `ColumnPager`, `BoardStrip`), the press-and-hold reorder machine
  (`useListReorder` inside `useColumnReorder.ts`), the fractional index (`lib/family/ordering.ts`),
  the write surface and serialised writes (`useWriteSurface`, `useSerialisedWrites`), the form
  path (`useDraft`, `useSubmission`, `FormFooter`), the per-device switch store
  (`createDeviceSwitches`), the palette domain (`family.palette_color`), `requireVerifiedActor`,
  the single realtime channel and its bare invalidation, the `runAction` / `mapDbError` contract.
- **The hosted push precedes the deploy** (Phase 3's Hard ordering 7, R411): two more tables join
  the shared realtime channel.

---

## R501 — Two tables; a section is a string on the item

**Decision**: `family.lists` and `family.list_items` (migration 028). A section is the `section`
text column on an item — trimmed, 1–60 characters or null — and nothing else: no `list_sections`
table, no section id, no section row. A section's existence, its count and its order are all
derived from the items that carry it.

**Rationale**: it is the reference's verified shape (`[V](skylight-api — section is a string on
the item; there is no section resource)`) and the reference's verified rule ("an empty section
can't be created standalone", `[V](44739335665051)`) falls out of it for free: with no row to
create, a section without items cannot exist. Renaming across items (`bulk_update_section`
`[V](pyskylight)`) is one UPDATE; removal is one UPDATE to null; the last item leaving takes the
header with it (FR-527, FR-533). Spec Assumption 9.

**Alternatives rejected**: a `list_sections` table with position and name (cleaner ordering, but
it invents an entity the reference does not have, needs a "delete empty sections" sweep or allows
the empty section the reference forbids, and makes a cross-section drag a two-table write); a
`sections text[]` column on the list for ordering (the same ordering problem solved by a second
source of truth that can disagree with the items).

## R502 — One position per item across the whole list; the drop decides section and order together

**Decision**: `list_items.sort_order` is one `numeric` fractional index per item across the whole
list, not per section (`nextSortOrder` on add, `sortOrderBetween` on drop — `lib/family/ordering.ts`,
divergence #5). The card draws a **flat sequence**: the ungrouped items first in `sort_order`,
then each section — in the order of its first item's `sort_order` — as a header followed by its
items in `sort_order`. A drop is resolved by one pure function, `dropOf(rows, movedId, toIndex)`
in `lib/family/lists/reorder.ts`, over that flat sequence with the headers included as rows:
the **nearest section header above the drop position decides the item's section** (none above →
ungrouped), and the **nearest items above and below decide its `sort_order`** (headers skipped).
The action writes both in one UPDATE (FR-524, FR-532). The function's input is the sequence as it
will read after the move — which is exactly what the shipped machine hands back as `move.order` —
so `dropOf(orderedRows, movedId)` needs no index arithmetic of its own.

**Rationale**: the reference's `position` is "sort order within its section" `[V]`, but with
sections as strings there is no section order to fall back on, so a list-wide index is the only
way two devices draw the same card (SC-506) without a second ordering column. Ordering sections by
their first item means a drag orders sections exactly as it orders items — the person moves the
one thing they are holding, and the rest follows. Including headers as (un-liftable) rows gives
the machine an unambiguous target for "drop it at the top of Dairy": the position just under the
header. Tested exhaustively as a table (spec SC-513).

**Alternatives rejected**: per-section positions (the reference's shape; needs section order from
somewhere); renumbering on every drop (N writes, the thing divergence #5 exists to avoid);
resolving the section from the *previous* item only (a drop under a header would land in the
section above it — the gesture the reference documents becomes impossible).

## R503 — Checked is a timestamp and an actor, not a status word

**Decision**: `list_items.checked_at timestamptz` (null = unchecked) and `checked_by uuid` (set null
on the Profile's deletion). Checking sets both, unchecking nulls both; the CHECK
`checked_by is null or checked_at is not null` allows the one asymmetric state a deletion leaves.
Checking an already-checked item and unchecking an unchecked one are both accepted and write the
same state (SC-504).

**Rationale**: FR-525 wants who and when; a `status` enum (the reference's `pending|completed`
`[V]`) would need two more columns beside it to say the same. Idempotent writes are what let two
devices tick the same item in the same second with no error (spec edge case 1) — an UPDATE to a
state is not a transition that can be "already done".

**Alternatives rejected**: `status text` + `checked_at` + `checked_by` (redundant; a status and a
timestamp that can disagree); a `list_item_checks` history table (a grocery item's tick history is
not a ledger — nothing is owed — and Clear Completed deletes the row anyway).

## R504 — Twelve actions, one statement each, no function on the write path

**Decision**: `lib/family/actions/lists.ts` exports `createList`, `updateList`, `deleteList`,
`addListItem`, `updateListItem`, `setListItemChecked`, `moveListItem`, `deleteListItem`,
`clearCompletedItems`, `sectionItems`, `renameSection`, `removeSection`. Every one is
`requireVerifiedActor()` (any role) followed by the Parents only rule (R505), Zod on the input,
one admin-client statement scoped by `household_id`, `touchActor`, and a re-read. The set
operations are each **one UPDATE/DELETE over a set**: `sectionItems` sets `section` on the chosen
ids; `renameSection` sets it where it equals the old name; `removeSection` nulls it; `clearCompleted`
deletes where `checked_at is not null`. Section names are normalised in the action — trimmed, then
matched case-insensitively against the list's existing distinct sections, adopting the existing
spelling on a match (FR-529) — because the database does not need to know the rule to keep the
invariant (a section is whatever string the items carry).

**Rationale**: FR-534's "open to every punched-in Profile" makes `requireVerifiedActor` the only
guard; there is no parent-only verb, so `requireParent` appears nowhere in this module. No
invariant here needs a lock or a trigger: the worst race is two ticks (idempotent, R503) or a
clear against an un-tick (the store applies one first and the other reads its truth — spec edge
case 2). Phase 3's "no function on the write path" (R310) holds without exception.

**Alternatives rejected**: an RPC for `sectionItems` / `renameSection` (one UPDATE is already
atomic); a trigger normalising section names (it would have to know the list's other sections and
would refuse nothing the action has not already resolved); a boolean `checked` toggle action
(`setListItemChecked({checked})` is idempotent, a toggle is not — R503).

## R505 — Parents only: display from the session, refusal from the database, RLS unchanged

**Decision**: `lists.parents_only boolean`. **On the client** the board filters the list set with
`visibleListsOf(lists, actor)` (`lib/family/lists/visibility.ts`): every list when the punched-in
actor's role is `parent`, only `parents_only = false` lists otherwise (including nobody punched in).
The filter runs in the board's memo chain so a punch-out re-renders the row and a `useWriteSurface`
gone-check closes any sheet whose list has left. **On the server** every action loads the list
(`loadList(householdId, listId, actor)`) and answers `NOT_FOUND` — not `FORBIDDEN` — when it is
Parents only and the verified actor's database role is not `parent`; items are loaded through
their list so the same rule covers them. **RLS is unchanged**: `authenticated` reads every row of
the household.

**Rationale**: FR-514/FR-535 and spec Assumption 5. RLS cannot see the punch-in — the whole
household shares one Supabase account and the actor lives in the app's signed cookie — so the
database has no way to hide a row from "a member". The honest statement is the spec's: within the
household this is a display rule and an action rule, not a security boundary; the data stays
inside the household exactly as every other row does (FR-539). `NOT_FOUND` is chosen over
`FORBIDDEN` for the same reason FR-442's tenancy rule chose it: nothing confirms that a row exists.
The role is read from the database at the moment of the write (`requireVerifiedActor`), never
from the cookie's claim.

**Alternatives rejected**: a per-device "show this list" switch (anyone at the wall could flip it —
spec Assumption 5); a device flag ("this device is the wall"); a second Supabase role or a
per-list RLS predicate on the actor (there is no actor in the database session — Phase 1's design,
not reopened here).

## R506 — Reads: two unwindowed keys; two tables on the channel; the ordering rule returns

**Decision**: `familyKeys.lists(h)` → `family.lists` ordered by `sort_order, created_at`;
`familyKeys.listItems(h)` → `family.list_items` for the household ordered by `sort_order,
created_at`, **unwindowed** — every item of every list in one read. `page.tsx` for `/family/lists`
seeds both as `initialData`. `useFamilyRealtime`'s `TABLES` gains `lists` and `list_items`,
unfiltered (DELETE payloads carry only the key), funnelling into the bare `familyKeys.all`
invalidation. Migration 029 adds both tables to `supabase_realtime` with the 022/027 guard block;
replica identity stays default.

**Rationale**: a household's items number in the hundreds at most and the tab shows every list at
once, so a window would save nothing and cost a second key per card. One read per table keeps the
Phase 1 discipline (named columns, explicit household filter) and lets the count badges, the
section counts and the Completed switch all derive from one array in the memo chain (R317's
branch discipline: the switch hides rows *below* the counts, so a badge never moves when checked
items are hidden — FR-505, FR-520). The ordering rule is Phase 3's: a client binding for a table
not yet in the publication fails the whole shared channel (R411), so **028–029 are pushed to the
hosted project before the branch is merged or deployed** (quickstart §4).

**Alternatives rejected**: items windowed per list and fetched on card mount (N keys, N
invalidations, and a card that scrolls into view empty); a joined read `lists(list_items(*))`
(a PostgREST embed is fine here — both are tables — but two flat arrays are what the memo chain
wants, and a tick invalidates one small query rather than the whole tree either way).

## R507 — The Lists tab is the third board on the chassis, and the chassis moves home

**Decision**: the tab mounts `useBoardGeometry` + `useColumnPage` + `ColumnPager` + `BoardStrip`
exactly as Tasks and Rewards do, with two parameters the shipped hook gains: **the width token it
probes** (`--fam-list-card-w` instead of `--fam-task-col-w`) and **the layout rule it applies** —
`rowLayoutOf` from `lib/family/lists/layout.ts`, which returns `grid` when every card fits and
`pager` otherwise, never wrapping (FR-502, spec Assumption 11). Because this is the third consumer,
the shared modules still housed under `app/family/(app)/tasks/components/` move to
`app/family/(app)/components/` in the first setup task: `ColumnPager.tsx` (with `useColumnPage`),
`useBoardGeometry.ts`, and the generic `useListReorder` machine — split out of
`useColumnReorder.ts`, whose routine-specific hooks (`useRoutineReorder`, `RoutineMove`,
`householdOrderOf`) stay where they are. Tests move with their modules. No behaviour changes.

**Rationale**: constitution §I's "third consumer" rule is exactly this moment; Rewards importing
from `tasks/components` was tolerated as a two-board convenience and Phase 4's plan said the move
would follow "if that reads as a tasks-to-rewards dependency worth breaking". Three boards importing
a chassis from one of them is that. Parametrising the geometry hook is a smaller change than a
copy: `boardLayoutOf` keeps FR-395's wrap for the Tasks and Rewards boards, and `rowLayoutOf` is a
six-line pure function beside it. On a phone `perRow` is 1 and `minmax(0, 1fr)` fills the width
(FR-543).

**Alternatives rejected**: a free horizontal scroll with a partial card peeking (the photographed
3.4 — spec Assumption 11: a second scrolling idiom for the same gesture); a CSS scroll-snap strip
(fights the press-and-hold drag on touch and loses the shipped keyboard paging); copying
`useBoardGeometry` for lists (a second measurement hook to keep in step).

## R508 — Reorder is `useListReorder` with headers as rows that cannot be lifted

**Decision**: one `useListReorder` per card over the card's flat row sequence (R502), `axis:
"vertical"`, `rowSelector` matching both item rows and section headers, `handleSelector` matching
only item rows — so a press on a header never lifts anything, but a header is a position a drop can
land beside. `onDrop(move, movedId)` receives the machine's `Reorder` — `move.order` is the full new sequence of
row ids — so `dropOf(orderedRows, movedId)` reads the section and the neighbours straight off that
sequence and commits one `moveListItem`. The pointer the reference describes ("a small orange
pointer to the left", `[V](37275069922971)`) is drawn by the lifted row in `--fam-accent-coral`;
the lift's spacing is the machine's existing lifted styling. A drop on the row's own position
writes nothing (the machine already answers `null`). **The machine's keyboard pick-up is off**
(`keyboard: false`, as Phase 3 set it for routine cards): Enter and Space on a row belong to its
checkbox and its text button, and the machine would `preventDefault` them. The keyboard path is the
item sheet's **Move up** / **Move down**, each one `moveListItem` computed by `dropOf` over the
current sequence (FR-541).

**Rationale**: FR-523/FR-532 name the shipped machine; the only new need is "a row that takes part
in positions but cannot be dragged", which `handleSelector` already provides (`handleRowOf` refuses
a press whose target is not inside the handle, while `rowAt` still counts every row). `previewed`
draws the in-flight order. The checkbox inside a row is a tap, not a hold — the same arrangement as
the completion circle inside a routine card, and the machine's click-capture guard already keeps a
completed drag from firing the button.

**Alternatives rejected**: `@dnd-kit` (colectivo-only by Phase 2's decision, R214); a drag handle
glyph on each row (the reference lifts the row itself).

## R509 — Per-device state: one switch store, one key-set store

**Decision**: `useListFilters` = `createDeviceSwitches({ storageKey: "family:list-filters:v1",
defaults: { completed: true } })` in `lists/components/`, surfaced as the **Lists** section of the
shared `FilterSheet` with one switch, "Completed items" (FR-520), the way `useTaskFilters`
surfaces four. Section folds are a per-device set of `${listId} ${section}` keys in
`family:list-folds:v1` behind a small `createDeviceKeySet(storageKey)` factory added to
`deviceStorage.ts` (add / delete / has / prune, `useSyncExternalStore`, in-memory fallback when
storage refuses). What the switch **means** — which rows are drawn — is `itemsShownOf(items,
switches)` in `lib/family/lists/visibility.ts`, applied below the counts (FR-505).

**Rationale**: FR-544 and Phase 4's convention: per-device preferences never touch a table, and a
new set of switches gets its own versioned key so a stored shape is never reparsed against another
(R412's reasoning). Folds are dynamic keys, which `createDeviceSwitches` (fixed keys) does not
model, and `useDeviceVisibility`'s `Set<string>` store is the same shape with prune semantics —
the factory is that shape extracted; `useDeviceVisibility` is not rewritten onto it unless
`fallow:dupes` says the two are clones, in which case it is (never a threshold lift).

**Alternatives rejected**: folds on the household (FR-531 says per device — Ana folding Dairy on
the wall must not fold it on Ben's phone); the switch in the tab's own chrome (the Rewards
precedent) — the reference puts it in the top-bar Filter `[V]`, and the Filter sheet is where a
device's "show me" switches already live.

## R510 — Surfaces: the card, the box, the menu, three sheets, two confirmations

**Decision**:
- **`ListCard`** — header (`ListCardHeader`: name in `--fam-font-serif` at `--fam-fs-list-title`,
  the count badge, a `•••` menu button), the **`AddItemBox`** (a one-field form; Enter submits;
  the field is disabled while its write is pending and cleared only on success — a refusal keeps
  the text and shows the notice beside the box, FR-537), the flat rows (`ListItemRow`,
  `SectionHeader`), and the **`AddSectionFooter`** (a `SectionHeader` in its placeholder state,
  FR-503, opening the section sheet).
- **`ListMenu`** — a native `<dialog>` action sheet (44 px rows, `useModalDialog`) with **Add item**
  (focuses the box), **Edit list**, **Add section**, **Clear Completed** (with its count, disabled at
  0), **Delete list**; the `SectionHeader`'s menu is the same component with **Rename** and
  **Remove section**.
- **`ListForm`** + `useListForm` (`useDraft` + `useSubmission`): Name, List type (three radio pills:
  To do / Grocery / Other), Colour (the shipped settings `ColorPicker`), **Parents only** switch
  with its one-line note; validated with `listInputSchema` before the send.
- **`ItemSheet`** (tap the text): the text field, a "Section" chooser (None / each existing section /
  "New section…"), **Move up** / **Move down** (the keyboard's reorder, one `moveListItem` each via
  `dropOf`, FR-541), **Delete**; the fields are saved as one `updateListItem`.
- **`SectionSheet`** (Add section / Move items / Rename): a name field and, for Add/Move, the list's
  items as a checklist (at least one); saved as one `sectionItems` or `renameSection`.
- **`ConfirmDialog`** in `lists/components/` for Delete list ("Delete "Party" and its 4 items? This
  can't be undone.") and Clear Completed ("Clear 3 completed items from Grocery List?").
- All writes through one `useSerialisedWrites` per board with keys `list:<id>`, `item:<id>`,
  `add:<listId>`, `section:<listId>`; every write goes through `withActor` so the punch-in keypad
  appears at the tap (FR-534).

**Rationale**: every piece is a shipped pattern with new copy; the only new component kind is the
action-sheet menu, which the shipped dialog idiom covers. Enter-to-add with the box disabled while
pending is the refuse-never-queue posture made visible: the person sees their text until the store
has it or has said no.

**Alternatives rejected**: an inline "x" on every row (spec Assumption 8); a popover menu anchored
to the `•••` (a second overlay idiom beside the shipped dialogs, and harder to make 44 px on a
wall); optimistic ticks (FR-537).

## R511 — Migrations 028–029, `seed_default_lists()`, and the seed fixtures

**Decision**: **028** creates the two tables, indexes, the touch trigger on `lists`, RLS policies
and grants, and `family.seed_default_lists(p_household_id)` — the `seed_task_box()` pattern:
`security definer`, `search_path = ''`, revoked from public, executable by `service_role`,
idempotent **by emptiness** (returns 0 if the household has any list), inserting "Grocery List"
(`grocery`, `#B6E085`, sort 1000) and "To-Do List" (`to_do`, `#A8D4D3`, sort 2000). **029** is the
realtime block over `array['lists', 'list_items']` plus `notify pgrst, 'reload schema'`. The seed
script's `ensureHousehold` calls `seed_default_lists` after `seed_task_box` in **both** modes, so
the hosted household gets its two lists on the next `--yes` run and never again. Local fixtures
(`--local`) add, by fixed ids (`…0005NN` lists, `…0006NN` items): items on the Grocery List
(🥚 Eggs, 🥛 Milk, 🍞 Bread ungrouped; Bagels under Bakery; Yoghurt under Dairy, checked by Ben),
items on the To-Do List (Pack for trip, Pet sitter (Allie?), Stop mail), a third list "Packing
List" (Other, Grapefruit; Shirts x5, Jeans x2, Undies x7) and a Parents only "Party" (Other,
Lavender; Cake, Balloons).

**Rationale**: FR-513 and spec Assumption 3 — reference product data with no personal content
belongs in committed SQL (Phase 3's Task Box reasoning), and "by emptiness" is what keeps a renamed
or deleted default from coming back. The fixtures are the spec's own scenarios, so quickstart §4's
hand checks run on a fresh reset without typing.

**Alternatives rejected**: seeding the two lists from the script only (the hosted household then
depends on someone running the script; a function the seed calls is one line either way and the
migration is where the reference data lives); default lists on a trigger at household creation
(Phase 1 creates the household in migration 007 with a fixed id; a trigger there would fire in
`db reset` before the seed and in nothing else).

## R512 — Tokens

**Decision**: `app/family/tokens.css` gains a Lists section, each `× --fam-u`, each `[ESTIMATED]`
from dossier 07 §3: `--fam-list-card-w 495`, `--fam-list-card-r 28`, `--fam-list-card-gap 38`,
`--fam-list-header-h 100`, `--fam-list-row-h 76`, `--fam-list-row-r 14`, `--fam-list-row-gap 38`,
`--fam-list-check 63`, `--fam-list-check-r 10`, `--fam-list-badge 53`, `--fam-list-footer-h 110`,
`--fam-fs-list-title 46` and `--fam-fs-list-item 25` (on `--fam-t`). The card's three tints are the
shipped ladder (`fam-profile` with `--profile` = the list's colour: `--fam-profile-20` panel,
`--fam-profile-40` rows, `--fam-profile-100` badge — FR-504). A unit test (`list-tokens.test.ts`)
reads every declaration back (SC-511).

**Rationale**: FR-503's numbers are photograph estimates and belong in the one file that owns
metrics; the tint ladder is the reason no list colour is ever hand-picked.

## R513 — Testing strategy per layer

- **Unit (jsdom)**: `lists-grouping` (flat sequence, section order by first item, counts, the
  name match), `lists-reorder` (`dropOf` as a table: top, bottom, under a header, between sections,
  own position), `lists-visibility` (`visibleListsOf` by role, `itemsShownOf` by switch, counts
  unmoved), `lists-layout` (`rowLayoutOf` at the four viewports, never `grid` when overflowing),
  `lists-validation` (bounds, kinds, palette, unknown keys refused, `confirm: true`), `permissions`
  delta, `list-tokens`; RTL for `ListsBoard` (columns, empty state, hidden lists leaving on
  punch-out), `ListCard` (badge, rows, footer), `ListItemRow` (checked style, accessible name),
  `SectionHeader` (fold), `AddItemBox` (Enter, disabled while pending, kept on refusal),
  `ListForm`, `ItemSheet`, `SectionSheet`, `FilterSheet` (the Lists section), `nav` (no chip row).
- **Policies (local stack)**: `lists-access` (anon `42501`, another household zero rows, no direct
  write for `authenticated`), `lists-schema` (CHECKs, the kind set, the palette domain, the section
  shape, the checked shape, list→items cascade, Profile deletion nulling attribution,
  `seed_default_lists` once), `lists-actions` (all twelve end to end, the Parents only `NOT_FOUND`
  for a member, idempotent ticks, clear exactness, move across sections, case-insensitive merge,
  rename merge, remove keeps items), `privileges` delta.
- **By hand**: the four viewports, the feel of the lift and the pointer, two devices.

## R514 — Dependencies: none added

`framer-motion`, TanStack Query 5, Zod 4 and lucide are already installed; the drag is the shipped
pointer-event machine; the menu is a native `<dialog>`.

## R515 — What this phase does **not** build, restated for the plan

Organize (dedupe + aisle sort — AI), Order (Instacart), Sidekick capture, list-card reorder (the
column stored), item quantity/note/assignee fields, list-level or automatic emoji, undo/trash,
the home screen's lists pane, meals and every recipe→list flow (Phase 6), any Settings surface.

## R516 — The fallow zone

`.fallowrc.json` gains `{ "name": "family-lists-core", "patterns": ["lib/family/lists/**/*"] }`
before the catch-all `lib` zone, the rule `{ "from": "family-lists-core", "allow":
["family-lists-core", "lib"] }`, and `"family-lists-core"` appended to the allow lists of
`family-actions`, `components`, `ui-pages` and `tests` — not `lib` (queries/rows/validation need
nothing from it, as with rewards-core).

## Resolved unknowns

Every NEEDS CLARIFICATION the plan template asks for is answered above or in the spec: the storage
shape (R501–R503), the write path (R504), the Parents only mechanism (R505), the read and realtime
shape (R506), the chassis and its move (R507), the reorder machine (R508), per-device state (R509),
every surface and its copy (R510), the migrations and seed (R511), tokens (R512), tests (R513),
dependencies (R514), the fallow zone (R516).
