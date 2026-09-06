# Tasks: Family Lists

**Input**: Design documents from `/specs/005-family-lists/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/server-actions.md, quickstart.md — all final

**Tests**: Included and mandatory. The constitution (§II) makes test-first non-negotiable for pure logic, and this phase's pure logic is what two devices must agree on: the flat sequence and its section order, the drop rule, the count rule, the section-name match, the two visibility rules, the row layout, validation and permissions — and, in the policies tier, the schema's shape and every action's truth. Every one lands red before the code that makes it green.

**Organization**: Grouped by user story in the spec's priority order. Setup (including the chassis move, R507) and Foundational block every story; then US1 (the tab and its lists) → US2 (items) → US3 (sections and order) → US4 (Parents only), each reading state the previous one creates.

**Phases 1–4 are shipped and live.** Nothing here forks them. No shipped table changes shape; no trigger writes; no RPC. The one refactor — the board chassis moving from `tasks/components/` to `components/` — changes no behaviour and is verified green before any list code exists (T005). **The hosted push (028–029) precedes the merge and the deploy** — Hard ordering, restated at T054.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: parallelisable — different files, no dependency on an unfinished task
- **[Story]**: US1–US4 on story-phase tasks only
- Every task names its files; FR/SC references are the spec's; R references are research.md's

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: the two migrations, the fallow zone, the tokens, the seed fixtures, and the chassis move — written against data-model.md and research.md before anything is applied.

- [ ] T001 [P] Migration `supabase/migrations/028_lists.sql` — `family.lists` (`name` 1–120 trimmed, `kind in ('to_do','grocery','other')`, `color family.palette_color not null`, `parents_only` default false, `sort_order numeric` default 1000, attribution, timestamps, `unique (id, household_id)`, the `(household_id, sort_order)` index), `family.list_items` (`text` 1–200 trimmed, `section` null or trimmed 1–60, `checked_at`, `checked_by` set null, `sort_order`, `created_by`, `created_at`, composite FK `(list_id, household_id)` cascading, `list_item_checked_shape`, the `(list_id, sort_order)` and `(household_id)` indexes), the `touch` trigger on `lists`, `family.seed_default_lists(uuid)` (`security definer`, `search_path = ''`, idempotent by emptiness, "Grocery List" `grocery` `#B6E085` 1000 then "To-Do List" `to_do` `#A8D4D3` 2000, revoked from `public, anon, authenticated`, EXECUTE to `service_role`), RLS + `is_member()` read policies, SELECT to `authenticated`, ALL to `service_role`, `notify pgrst`, **the fold-into-existing rejection header** (data-model §028). Serves FR-509–FR-533, FR-539, FR-540
- [ ] T002 [P] Migration `supabase/migrations/029_realtime_lists.sql` — the 022/027 guard block verbatim over `lists`, `list_items`; replica identity left at default; `notify pgrst`; the Hard ordering comment. Serves FR-538, R506
- [ ] T003 [P] `.fallowrc.json` — the `family-lists-core` zone (`lib/family/lists/**/*`) before the catch-all `lib` zone, its rule (`family-lists-core`, `lib`), and the name added to the allow lists of `family-actions`, `components`, `ui-pages`, `tests` — not `lib` (R516). A boundary widening in config, not a suppression
- [ ] T004 [P] `app/family/tokens.css` — the Lists section (R512): `--fam-list-card-w 495`, `--fam-list-card-r 28`, `--fam-list-card-gap 38`, `--fam-list-header-h 100`, `--fam-list-row-h 76`, `--fam-list-row-r 14`, `--fam-list-row-gap 38`, `--fam-list-check 63`, `--fam-list-check-r 10`, `--fam-list-badge 53`, `--fam-list-footer-h 110` (each `× --fam-u`, `[ESTIMATED]`), `--fam-fs-list-title 46` and `--fam-fs-list-item 25` (on `--fam-t`), the "WHAT IS REUSED" list (the tint ladder, `--fam-accent-coral` for the pointer, the pill and touch tokens); unit test `lib/family/__tests__/unit/list-tokens.test.ts` reading every declaration back (SC-511)
- [ ] T005 **The chassis moves home** (R507; constitution §I's third consumer): `app/family/(app)/tasks/components/ColumnPager.tsx` (with `useColumnPage`) → `app/family/(app)/components/ColumnPager.tsx`; `tasks/components/useBoardGeometry.ts` → `components/useBoardGeometry.ts`; the generic press-and-hold machine — `useListReorder`, `ListReorderOptions`, `ListReorder`, `ReorderAxis`, `ReorderItem`, `reorderKeyStepOf`, `previewed`, the hold timer, the row finder, the machine and its transitions — split out of `tasks/components/useColumnReorder.ts` into `components/useListReorder.ts`, with `useColumnReorder.ts` keeping `useRoutineReorder`, `RoutineMove`, `RoutineReorders`, `householdOrderOf` and importing the machine; `BoardStrip.tsx`'s `ListReorder` import, `TasksBoard.tsx`, `RewardsBoard.tsx`, `FilterSheet.tsx`'s comment and every test import updated; the moved modules' tests move beside them (`components/__tests__/`). **No behaviour change**: every existing test green, `npm run fallow:audit` clean, Tasks and Rewards checked by hand
- [ ] T006 `components/useBoardGeometry.ts` gains `options?: { widthToken?: string; layoutOf?: (input: BoardLayoutInput) => BoardLayout }` with the Tasks defaults (`--fam-task-col-w`, `boardLayoutOf`); the probe reads `widthToken`; every shipped call site unchanged; unit test extended for the option (R507)
- [ ] T007 [P] `scripts/family-seed.mjs` — `ensureHousehold` calls `rpc("seed_default_lists")` after `seed_task_box` in **both** modes (R511); `--local` fixtures by fixed id (lists `…0005NN`, items `…0006NN`): Grocery List items 🥚 Eggs, 🥛 Milk, 🍞 Bread (ungrouped), Bagels (Bakery), Yoghurt (Dairy, checked by Ben); To-Do List items Pack for trip, Pet sitter (Allie?), Stop mail; **Packing List** (Other, `#FBA994` Grapefruit) — Shirts x5, Jeans x2, Undies x7; **Party** (Other, `#D5B6EC` Lavender, `parents_only`) — Cake, Balloons; the default lists looked up by name for their items; a log line per fixture. Applied at T011

**Checkpoint**: 028/029 review clean against data-model.md; the chassis move is green and behaviour-identical; nothing list-shaped exists yet.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: the schema proved by tests before the code that uses it; the types, reads, pure modules and actions every story renders from.

### Schema, test-first (write red against the running 553xx stack — still on 001–027 until T011 resets it)

- [ ] T008 [P] Failing policies tests `lib/family/__tests__/policies/lists-schema.test.ts` — **the CHECKs**: a `name` of 0 or 121 characters (or spaces only) refused `23514`; `text` of 0/201; `section` of `''`, 61 characters, or untrimmed `' Dairy'` refused, `'Dairy'` accepted, null accepted; `kind = 'shopping'` refused, the three accepted; `color = '#123456'` refused by the domain, `#B6E085` accepted; `checked_by` set with `checked_at` null refused, `checked_at` alone accepted. **Cascades and attribution** (FR-540): deleting a list removes its items; deleting the household removes both; deleting a Profile who created a list, created an item and checked an item leaves all three rows and nulls `created_by` / `updated_by` / `checked_by`. **The touch trigger** moves `updated_at`. **`seed_default_lists`** returns 2 on an empty household with exactly the two rows (names, kinds, colours, `sort_order` 1000/2000), returns 0 and adds nothing on a second call, and returns 0 for a household that has one list of its own
- [ ] T009 [P] Failing policies tests `lib/family/__tests__/policies/lists-access.test.ts` — SC-509 per path: both tables read as a member (rows), cross-household (`[]`), anonymous (`42501`); an authenticated INSERT/UPDATE/DELETE on each refused (`42501`); `seed_default_lists` not executable by `anon` or `authenticated` (`42501`); the `rewards-access.test.ts` pattern
- [ ] T010 [P] Extend `lib/family/__tests__/policies/privileges.test.ts` — `TABLES` gains `lists`, `list_items` (SELECT `authenticated`, ALL `service_role`, nothing to `anon`); `FUNCTIONS` gains `seed_default_lists` with EXECUTE to `service_role` only (the `seed_task_box` row's shape); the two tables in `pg_publication_tables` at replica identity `d`
- [ ] T011 Apply: `supabase db reset` (001–**029**) → `npm run family:seed -- --local` → T008–T010 green → `npm run fallow:audit` clean with the new zone. **Only now** does story work begin

### Rows, types, validation, reads, channel, nav

- [ ] T012 [P] `lib/family/rows.ts` + `lib/family/types.ts` — `LIST_COLUMNS`, `LIST_ITEM_COLUMNS`, `toList`, `toListItem` (`sort_order` arrives as a string → `Number()`); the `List`, `ListItem`, `ListKind`, `ListFilters` types (contracts §Shared input shapes); unit test `lib/family/__tests__/unit/rows.test.ts` extended for the two mappers
- [ ] T013 [P] `lib/family/validation.ts` — `listKindSchema`, `listInputSchema` (name via the shipped title bound — "Name is required." / "Keep it under 120 characters."; `color` in the palette — "Choose a colour from the palette."; `parentsOnly` boolean), `updateListSchema` (`{ id, patch }` validated as the merged row), `deleteListSchema` (`confirm: z.literal(true)`), `listItemTextSchema` (1–200 trimmed — "An item is 1 to 200 characters."), `sectionNameSchema` (1–60 trimmed — "A section name is 1 to 60 characters."), `addListItemSchema`, `updateListItemSchema` (`text?`, `section?: string | null`), `setListItemCheckedSchema`, `moveListItemSchema` (`previousItemId`/`nextItemId` nullable uuids, `section` nullable), `deleteListItemSchema`, `clearCompletedSchema` (`confirm`), `sectionItemsSchema` (`itemIds` ≥1 distinct — "Choose at least one item."), `renameSectionSchema`, `removeSectionSchema` — all `z.strictObject`; unit test `lib/family/__tests__/unit/lists-validation.test.ts` (every bound, the kind set, an off-palette colour, unknown keys refused, `confirm` required)
- [ ] T014 [P] `lib/family/queries.ts` — `familyKeys.lists(h)`, `familyKeys.listItems(h)`; `fetchLists` (`order sort_order, created_at`), `fetchListItems` (same order, whole household); `useLists`, `useListItems` with `initialData` (R506); unit test `lib/family/__tests__/unit/lists-queries.test.ts` (keys under `['family']`, named columns, no `select('*')`, the order)
- [ ] T015 [P] `app/family/(app)/components/useFamilyRealtime.ts` — `TABLES` gains `{ table: "lists" }`, `{ table: "list_items" }` **unfiltered** (R506); `useFamilyRealtime.test.tsx` asserts the two subscriptions
- [ ] T016 [P] `app/family/(app)/components/nav.ts` — `lists: showsChipRow: false` with the FR-506 comment; `nav.test.ts` asserts the row is off for `/family/lists` and on for `/family/meals`

### Pure modules, tests first (`lib/family/lists/`, zone `family-lists-core`)

- [ ] T017 [P] Failing unit test `lib/family/__tests__/unit/lists-grouping.test.ts` then `lib/family/lists/grouping.ts` — `normaliseSectionName(raw)` (trim; empty → null), `matchSection(existing: readonly string[], name)` (case-insensitive after trim → the existing spelling, else the trimmed name), `sectionsOf(items)` (distinct sections ordered by their first item's `sortOrder`, ties by `createdAt`), `groupedRowsOf(items)` → the flat sequence `[{ kind: "item", item } | { kind: "header", section, count }]` — ungrouped first, then each section's header and items (FR-530, R502), `uncheckedCountOf(items)` (FR-505), `sectionCountOf(items, section)`; the table: empty list, all ungrouped, one section, two sections whose first items interleave, a section whose items are all checked (count 0, header stays), ties
- [ ] T018 [P] Failing unit test `lib/family/__tests__/unit/lists-reorder.test.ts` then `lib/family/lists/reorder.ts` — `dropOf(rows, movedId, toIndex)` → `{ previousItemId, nextItemId, section } | null` over the flat sequence with headers as rows (R502): the nearest header above the drop decides `section` (none → null), the nearest items above and below (skipping headers) decide the neighbours; `null` when the drop is the row's own position; the table: to the top, to the bottom, just under a header (first of that section), between two items of a section, between the last item of A and the header of B (stays in A), out of a section into the ungrouped run, the only item of a section moved out (the header will vanish), an invalid `toIndex`
- [ ] T019 [P] Failing unit test `lib/family/__tests__/unit/lists-visibility.test.ts` then `lib/family/lists/visibility.ts` — `visibleListsOf(lists, actor)` (every list for role `parent`; `parentsOnly === false` only for a member or `null`; order preserved, R505), `itemsShownOf(items, switches)` (`completed: false` drops checked items and nothing else, FR-520); a test that `uncheckedCountOf(items)` equals `uncheckedCountOf(itemsShownOf(items, { completed: false }))` — the badge never moves
- [ ] T020 [P] Failing unit test `lib/family/__tests__/unit/lists-layout.test.ts` then `lib/family/lists/layout.ts` — `rowLayoutOf(input: BoardLayoutInput)` → `{ perRow, mode }`: `perRow = clamp(floor(boardWidth / referenceColumnWidth), 1, columnCount)`, `mode = perRow >= columnCount ? "grid" : "pager"`, never `grid` when overflowing whatever the orientation (FR-502, Assumption 11); the four reference viewports (1920×1080 → 3 of 5, 1180×820 → 2, 820×1180 → 1 paged, 390×844 → 1)

### Actions, tests first

- [ ] T021 Failing policies tests `lib/family/__tests__/policies/lists-actions.test.ts` (the `rewards-actions.test.ts` harness) — every action end to end as a parent and as a member: `createList` appends (`sort_order` above the max) with attribution; `updateList` merges and touches `updated_by`; `deleteList` with `confirm` cascades, without it `VALIDATION`; `addListItem` appends ungrouped; `updateListItem` renames, moves to `" dairy"` and lands in **Dairy**; `setListItemChecked` twice is one state with no error (SC-504), unchecking nulls both columns; `moveListItem` writes `sort_order` between the neighbours **and** the section in one row (re-read shows both), refuses a neighbour from another list (`NOT_FOUND`); `deleteListItem`; `clearCompletedItems` removes exactly the checked rows and returns the count (SC-505); `sectionItems` sets the section on the chosen ids, merges on a case-insensitive match, refuses an empty `itemIds`; `renameSection` renames across items and merges into an existing spelling, zero rows → `NOT_FOUND`; `removeSection` nulls and keeps every row. **Parents only** (R505): every write to a `parents_only` list by a member is `NOT_FOUND`, by a parent succeeds; a member's `updateList` cannot turn `parentsOnly` off. **Tenancy**: an id from another household is `NOT_FOUND`. Nobody punched in → `NO_ACTOR`
- [ ] T022 `lib/family/actions/lists.ts` — `loadList(householdId, listId, actor)` / `loadItem(householdId, itemId, actor)` (admin client, `.eq('household_id')`, the Parents only rule → `NOT_FOUND`), `resolveSectionName(listId, raw)` (the one normaliser, reading the list's distinct sections), and the twelve actions per contracts — each `"use server"` → `runAction` → `requireVerifiedActor()` → `parseOrThrow` → one statement → `touchActor` → re-read; `lib/family/permissions.ts` gains `list.create` and `list.write` (target-aware on `ctx.parentsOnly`) with `permissions.test.ts` extended (parent / member / nobody × plain / Parents only)
- [ ] T023 T021 green; `npm run fallow:audit` clean

**Checkpoint**: the schema, the reads, the pure rules and the twelve actions exist and are proven; no pixel has been drawn.

---

## Phase 3: User Story 1 — The Lists tab and its lists (Priority: P1) 🎯 MVP

**Goal**: the placeholder replaced by a row of list cards on the shipped chassis — name, badge, menu — with create, edit and delete of a list, the two default lists, no chip row, "Add List" on the `+`.

**Independent Test**: spec US1's six scenarios by hand at 1920×1080, 1180×820, 820×1180 and 390×844; the RTL suites below.

- [ ] T024 [P] [US1] Failing RTL `app/family/(app)/lists/components/__tests__/ListsBoard.test.tsx` — one card per list in `sortOrder` order; the empty state "No lists yet" when there are none; the FAB registers "Add List" while mounted; `READ_FAILED` "Lists could not be loaded." on a read error; the notice line's precedence (`boardNoticeOf`)
- [ ] T025 [P] [US1] Failing RTL `ListCard.test.tsx` + `ListCardHeader.test.tsx` — the name in the serif class; the badge shows `uncheckedCountOf` with the accessible name "N to do"; the `•••` button is named "<list> menu"; the card sets `--profile` to the list's colour (`profileVars`)
- [ ] T026 [US1] `app/family/(app)/lists/page.tsx` — the placeholder replaced (FR-501): async server component, `getMember()`, the RLS client, `Promise.all([fetchLists, fetchListItems])` → `initialData`, `TabUnavailable` with "Lists can't be loaded right now. Everything else still works."; metadata title "Lists"
- [ ] T027 [US1] `lists/components/ListsBoard.tsx` — the model split from the start (plan §V): `useListsView` (`useBoardGeometry(count, { widthToken: "--fam-list-card-w", layoutOf: rowLayoutOf })`, `useColumnPage`, `useListFilters` later), `useListsData` (the two reads → error union; `visibleListsOf` in the memo chain from T047 on), `useListWrites` (`useSerialisedWrites` with keys `list:<id>`, `item:<id>`, `add:<listId>`, `section:<listId>`), `useListEditor` (`useWriteSurface` over `{ closed | create | edit | delete }`), `boardNoticeOf`; renders `ColumnPager` → `BoardStrip` → `ListCard`s; copy constants `FAB_LABEL "Add List"`, `READ_FAILED`, `GONE_MESSAGE "That list is no longer here."`, `NO_LISTS "No lists yet"`
- [ ] T028 [US1] `ListCard.tsx` + `ListCardHeader.tsx` — the card panel (`fam-profile` + `fam-tint-20`, `rounded-(--fam-list-card-r)`, width from the strip), the header (`--fam-list-header-h`; name at `--fam-fs-list-title` in `--fam-font-serif`; the badge circle `--fam-list-badge` in `--fam-profile-100` with a white numeral; the `•••` button ≥44 px); rows and footer arrive in US2/US3
- [ ] T029 [US1] `ListMenu.tsx` — a native `<dialog>` action sheet on `useModalDialog` (R510): for a list, **Add item** (focuses the box), **Edit list**, **Add section**, **Clear Completed** (with its count, disabled at 0), **Delete list**; for a section (T043), **Rename**, **Remove section**; every row ≥44 px, `aria-labelledby` the list's or section's name; RTL `ListMenu.test.tsx`
- [ ] T030 [US1] `ListForm.tsx` + `useListForm.ts` (`useDraft` + `useSubmission` + `settleSubmit` against `listInputSchema`) — "Add a list" / "Edit list"; fields: Name; List type as three radio pills To do / Grocery / Other (FR-510); Colour via the shipped settings `ColorPicker`; **Parents only** switch (`role="switch"`) with the note "Shown only while a parent is punched in on the device."; `FormFooter`; failing RTL `ListForm.test.tsx` first (field order, the copy, a blank name refused locally, an edit seeded from `listDraftOf`)
- [ ] T031 [US1] `ConfirmDialog.tsx` (title, body, Keep / Confirm labels, `useModalDialog`) and the Delete list flow: "Delete “<name>” and its N items? This can't be undone." → `deleteList({ id, confirm: true })`; RTL `ConfirmDialog.test.tsx` (the count in the copy; Escape keeps)
- [ ] T032 [US1] Wire `useListEditor`: FAB → create form → `withActor(createList)`; header tap and menu **Edit list** → edit form → `settleEdit(withActor(updateList))`, `NOT_FOUND` → `reportGone`; menu **Delete list** → confirm → `deleteList`; the notice line; T024–T025 green

**Checkpoint**: US1's six scenarios by hand on the local stack; four viewports show 3 / 2 / 1 / 1 whole cards, a swipe pages one, the page never scrolls sideways (SC-510).

---

## Phase 4: User Story 2 — Items: adding, checking, clearing (Priority: P2)

**Goal**: the "Add item" box, item rows with square checkboxes and the checked style, check/uncheck, the item sheet (edit, delete), Clear Completed, and the per-device Completed switch in the Filter sheet.

**Independent Test**: spec US2's seven scenarios by hand on two devices; the RTL suites below.

- [ ] T033 [P] [US2] Failing RTL `ListItemRow.test.tsx` — text at the left, a real `<input type="checkbox">` at the right named "<text>" with its checked state; checked rows carry the grey + strikethrough classes and the filled box; the row height and radius classes are the tokens; the lifted state draws the pointer (T044)
- [ ] T034 [P] [US2] Failing RTL `AddItemBox.test.tsx` — Enter submits the trimmed text; the field is disabled while its write is pending and cleared on success with focus kept (FR-516); a refusal keeps the text and shows the notice beside the box (FR-537); a blank or 201-character text is refused locally against `listItemTextSchema` and never sent
- [ ] T035 [US2] `ListItemRow.tsx` + `AddItemBox.tsx`; `ListCard` draws the box under the header and then every item as a row (`fam-tint-40`, `rounded-(--fam-list-row-r)`, `min-h-(--fam-list-row-h)`, `gap-(--fam-list-row-gap)`); the checkbox a rounded square `--fam-list-check` / `--fam-list-check-r`, white with the control border, filled when checked
- [ ] T036 [US2] `useListWrites` gains `add(listId, text)` (`addListItem`), `setChecked(item, checked)` (`setListItemChecked`), `remove(item)` (`deleteListItem`); a refusal's message becomes the board notice or the box's notice; every write is `withActor` (the keypad at the tap, FR-534)
- [ ] T037 [US2] `ItemSheet.tsx` + failing RTL `ItemSheet.test.tsx` first — opened by tapping the text (FR-522): the text field (`listItemTextSchema`), a **Section** chooser (None / each existing section / "New section…" revealing a name field), **Delete**; Save → one `updateListItem`; Delete → `deleteListItem`; refusal shown in the sheet; `NOT_FOUND` → "That item is no longer here." and the sheet closes
- [ ] T038 [US2] Clear Completed: `ListMenu`'s entry shows the count and is disabled at 0; `ConfirmDialog` "Clear N completed items from <list>?" → `clearCompletedItems({ listId, confirm: true })`; RTL for the count and the disabled state
- [ ] T039 [US2] `useListFilters.ts` (`createDeviceSwitches({ storageKey: "family:list-filters:v1", defaults: { completed: true } })`); `components/FilterSheet.tsx` gains a **Lists** section with the one switch "Completed items" (FR-520) and the not-persistent notice covers it; `ListCard` applies `itemsShownOf` **below** the badge and section counts; failing RTL first: `FilterSheet.test.tsx` (the section, the switch, "Show all" resets it) and `ListCard.test.tsx` (badge unmoved with the switch off, checked rows absent)

**Checkpoint**: US2's scenarios by hand on two devices; SC-502–SC-505 within 5 s.

---

## Phase 5: User Story 3 — Sections and order (Priority: P3)

**Goal**: section headers with counts and folds, the "Add section" footer, the section sheet (add / move / rename), remove-keeps-items, and press-and-hold reorder that carries an item across sections in one write.

**Independent Test**: spec US3's seven scenarios by hand; the `lists-reorder` table; the RTL suites below.

- [ ] T040 [P] [US3] Failing RTL `SectionHeader.test.tsx` — the name, "1 item" / "2 items", a chevron button named "Fold <section>" / "Unfold <section>" with `aria-expanded`, the `•••` button named "<section> menu"; the placeholder state renders "Add section" in the muted serif with a count of 0 and opens the section sheet (FR-503)
- [ ] T041 [US3] `components/deviceStorage.ts` gains `createDeviceKeySet(storageKey)` (`has`, `add`, `remove`, `toggle`, `useKeySet`, in-memory fallback, `persistent`) and `lists/components/useListFolds.ts` (`family:list-folds:v1`, key `${listId} ${section}`); unit test `deviceStorage.test.ts` extended (corrupt value → empty, refused storage → in-memory, prune) (R509)
- [ ] T042 [US3] `SectionHeader.tsx` + `AddSectionFooter` (the header in its placeholder state); `ListCard` draws `groupedRowsOf(items)` — ungrouped rows, then each header and its rows, folded sections showing the header only (FR-530, FR-531); the footer at the bottom (`--fam-list-footer-h`)
- [ ] T043 [US3] `SectionSheet.tsx` + failing RTL `SectionSheet.test.tsx` first — modes **Add section** / **Move items** (a name field + the list's items as a checklist, at least one, FR-528) and **Rename** (the name field only); Save → one `sectionItems` or `renameSection`; the section menu's **Remove section** → `ConfirmDialog` "Remove “Dairy”? Its 3 items stay on the list." → `removeSection` (FR-533); refusals in the sheet
- [ ] T044 [US3] Reorder (R508): one `useListReorder` per `ListCard` over the flat rows (`axis: "vertical"`, `rowSelector: "[data-list-row]"`, `handleSelector: "[data-item-handle]"` — item rows only, headers un-liftable, `labelOf` the item text or the section name, `enabled` when the card is not paging), `previewed` for the in-flight order, the lifted row's pointer in `--fam-accent-coral` at its left (FR-523), `onDrop(move, movedId)` → `dropOf(rows, movedId, move.to)` → one `moveListItem` or nothing (own position); the container's `touch-action` while a row is in hand; failing RTL `ListCard.reorder.test.tsx` first (a drop calls `moveListItem` once with `dropOf`'s result; a drop on the same position writes nothing; a header cannot be lifted)
- [ ] T045 [US3] Accessibility and motion (FR-541, FR-542): the machine's live-region announcement names the item and its new position and section; arrow keys reorder after a held Space; under `prefers-reduced-motion` the lift and the row transitions are instant (tokens.css zeroes the durations; the machine's spacing still applies); RTL for the announcement

**Checkpoint**: US3's scenarios by hand; SC-506 on two devices.

---

## Phase 6: User Story 4 — A list that stays off the wall (Priority: P4)

**Goal**: Parents only lists shown only while a parent is punched in on the device, leaving on punch-out, invisible to members, refused at the server.

**Independent Test**: spec US4's four scenarios by hand; the RTL suite below; T021's Parents only cases.

- [ ] T046 [P] [US4] Failing RTL `ListsBoard.parentsOnly.test.tsx` — with `actor` null or a member, a `parentsOnly` list is not drawn and the empty state shows when only hidden lists exist (FR-508); with a parent actor it is drawn in its place; when the actor changes from parent to null while its item sheet is open, the sheet closes and nothing is written (FR-514)
- [ ] T047 [US4] `useListsData` applies `visibleListsOf(lists, actor)` in the memo chain (R505); `useListEditor` / `useItemSheet` / `useSectionSheet` close when their list leaves the visible set (the `reportGone` path without the notice — the list is not gone, only hidden); the card count and the pager window follow the visible set
- [ ] T048 [US4] Story 4 by hand on the local stack: the wall (nobody), Ana punched in, punch-out, Cleo punched in, a direct `addListItem` to "Party" as Cleo → `NOT_FOUND`; T021's Parents only cases re-run green

**Checkpoint**: every story's scenarios pass by hand; SC-507 timings met.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T049 [P] Seed fixtures verified on a fresh `supabase db reset` + `npm run family:seed -- --local`: the four cards, the checked Yoghurt, the two sections, "Party" hidden until a parent punches in; quickstart §3's list matches
- [ ] T050 [P] Docs sync: plan.md Progress; CLAUDE.md's active-feature block (state, the ordering rule); every task ticked here; `specs/005-family-lists/checklists/quickstart-run.md` holding the by-hand results
- [ ] T051 Gates: `npm run fallow:audit` (zero new findings, duplication 0 — a flagged clone is extracted, never suppressed), `npm test` (unit + policies), `npm run typecheck`, `npm run lint`; `npm run graph` rebuilt
- [ ] T052 Review gate (the T083 pattern): code-reviewer over the whole diff; security-guardian over 028–029, `actions/lists.ts`, `loadList`/`loadItem`, the Parents only rule, the seed function's grants; findings applied, false alarms recorded
- [ ] T053 Hand walk: quickstart §"Verifying the guarantees" on the local stack with chrome-devtools at the four viewports and the phone emulation; two browser contexts for SC-502–SC-506; results in `checklists/quickstart-run.md`
- [ ] T054 **Hosted, in this order** (Hard ordering, R506): `supabase db push --linked` (028–029) → quickstart §4 steps 2–3 (no `anon` grant; `seed_default_lists` executable by `service_role` only; both tables published at replica identity `d`) → `npm run family:seed -- --yes` → step 4's query shows exactly the two default lists → **then** merge to `main`, push, Vercel deploy → live checks: `/family/lists` renders the two cards with no console errors, SC-514 (Calendar, Tasks, Rewards still live), SC-515
- [ ] T055 Device pass (the operator's, by hand on hardware): SC-502–SC-506 across two devices, SC-510 on the iPad in both orientations and on a phone, SC-512 with VoiceOver, the feel of the lift on the wall tablet

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: T001–T004 and T007 are independent files; **T005 precedes T006**, and both precede every story task (they move the chassis every board mounts)
- **Foundational (Phase 2)**: T008–T010 red before T011; T011 (the reset) before T012–T023; T017–T020 independent of each other; T021 red before T022; T023 closes the phase — **BLOCKS all user stories**
- **US1 (Phase 3)**: after Foundational; T024–T025 red first; T026 → T027 → T028 → T029–T031 → T032
- **US2 (Phase 4)**: after US1 (the card exists); T033–T034 red first; T035 → T036 → T037 → T038 → T039
- **US3 (Phase 5)**: after US2 (rows exist); T040 red first; T041 → T042 → T043 → T044 → T045
- **US4 (Phase 6)**: after US1 (the board's memo chain) and T021 (the action rule); T046 red first; T047 → T048
- **Polish (Phase 7)**: after every story; T054 after T051–T053; T055 after T054

### Within Each User Story

- RTL tests are written and fail before the component that makes them pass
- Pure rules (Phase 2) before components; actions before the hooks that call them
- Story complete and walked by hand before the next priority

### Parallel Opportunities

- Setup: T001, T002, T003, T004, T007 together; then T005, then T006
- Foundational: T008–T010 together; T012–T016 together; T017–T020 together
- US1: T024 ∥ T025; US2: T033 ∥ T034; US3: T040 alone then T041; US4: T046 alone
- Polish: T049 ∥ T050

---

## Parallel Example: Foundational pure modules

```bash
# After T011, launch the four pure-module pairs together (different files, no dependencies):
Task: "Failing test lists-grouping.test.ts then lib/family/lists/grouping.ts"
Task: "Failing test lists-reorder.test.ts then lib/family/lists/reorder.ts"
Task: "Failing test lists-visibility.test.ts then lib/family/lists/visibility.ts"
Task: "Failing test lists-layout.test.ts then lib/family/lists/layout.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 (including the chassis move) and Phase 2
2. Complete Phase 3: the tab, the cards, list create/edit/delete, the two defaults
3. **STOP and VALIDATE**: US1's six scenarios at four viewports; Tasks and Rewards unchanged
4. The tab is already usable as a set of empty lists; items arrive next

### Incremental Delivery

1. Setup + Foundational → the schema, reads, rules and actions proven
2. US1 → the tab and its lists (MVP)
3. US2 → the daily loop: add, tick, clear, hide completed
4. US3 → sections and order
5. US4 → Parents only
6. Polish → gates, review, the hosted push, then merge and deploy — in that order

---

## Notes

- [P] tasks = different files, no dependencies
- Every write is one statement through `requireVerifiedActor` (R504); no `requireParent` appears in this phase
- The hosted push (028–029) MUST precede the merge and the deploy — a client binding for a table not yet in the publication takes the whole shared channel down (R506)
- A `fallow:dupes` finding is removed by extraction, never by a threshold lift; a complexity finding by splitting, never by annotation
- Commit after each task or logical group; the pre-commit hook runs the fallow gate
