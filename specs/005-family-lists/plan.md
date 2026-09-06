# Implementation Plan: Family Lists

**Branch**: `005-family-lists` | **Date**: 2026-09-05 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/005-family-lists/spec.md`

## Summary

Build the Lists tab for `/family` on the shipped Phase 1–4 platform: a row of coloured list cards,
each with a name, a count badge, an "Add item" box, item rows with square checkboxes, freeform
sections with counts and folds, and an "Add section" footer; two default lists made once for a
household; add, check, uncheck, edit, move, delete and Clear Completed on items; press-and-hold
reorder that carries an item across sections in one write; a per-device Completed switch in the
shared Filter sheet; and Parents only — the reference's "Hide on Device" mapped onto the punch-in
identity — every write open to any punched-in Profile and refused, never queued, when it cannot
complete.

The technical core is **the smallest data model that matches the reference, and one statement per
verb.** Two tables; a section is a string on the item, so it exists exactly while an item carries
it (R501); one list-wide fractional position per item, so a drop is one UPDATE that sets order and
section together and two devices draw the same card (R502); checked is a timestamp and an actor,
so a tick is idempotent and two devices ticking at once both succeed (R503); twelve actions under
`requireVerifiedActor`, each one statement, none needing a lock, a trigger or an RPC (R504);
Parents only decided by role — for display from the session, for writes from the database —
with RLS untouched because RLS cannot see the punch-in (R505). Everything else is reuse: the tab is
the third board on the shipped chassis, which moves home to `components/` because it now has three
consumers (R507); the reorder is the shipped machine with headers as un-liftable rows (R508); the
switch and the folds are the shipped per-device stores (R509); the forms and sheets are the
shipped patterns with new copy (R510).

This phase adds **two migrations (028–029), zero dependencies, no shipped-table alterations, no
view and no trigger that writes**; it amends five shipped surfaces named in the spec and replaces
one placeholder.

## Technical Context

**Language/Version**: TypeScript 5 (strict), Node 20+
**Primary Dependencies**: Next.js 16.1.6, React 19.1.0, Tailwind 4, `@supabase/ssr` + `@supabase/supabase-js`, TanStack Query 5, `jose`, Zod 4, `framer-motion` (the pager's swipe only) — **no new dependencies** (R514)
**Storage**: Supabase Postgres, schema `family`, project `zgmltllcyqylgtazunai`; migrations 028–029 on top of 001–027 — two tables, one helper function, two publication entries; **no alteration to a shipped table**. PG 17 confirmed hosted (Phase 3 T081). Local stack on 553xx
**Testing**: Vitest 4 projects — unit (jsdom: grouping, the drop rule, visibility by role and switch, the row layout, validation, permissions, tokens, the RTL surfaces) and policies (node, local stack: RLS and grants, CHECKs and cascades, the twelve actions end to end, the seed function's idempotence)
**Target Platform**: iPadOS Safari (the wall tablet, both orientations); iOS/Android phones; desktop for development
**Performance Goals**: an add, a tick, a clear and a drop that agree across devices within 5 s (SC-502–SC-506); a lift within 500 ms of holding (SC-506); a Parents only list that appears or leaves within 1 s of the punch-in changing (SC-507); one read per table for the whole tab
**Constraints**: FR-537 — refuse, never queue; one statement per write; WCAG 2.1 AA + 44×44 px on every new control (FR-541); reduced motion collapses the lift and the row changes (FR-542); fallow budgets (cyc 20 / cog 15, CRAP needs coverage, no suppressions); Supabase free tier
**Scale/Scope**: one household; a handful of lists, a few hundred items; 45 FRs (FR-501…FR-545), 15 SCs, 17 assumptions, 6 contradiction resolutions; 2 migrations, ~5 new `lib/family` modules, ~14 new components, 5 amended surfaces, 1 replaced placeholder, 1 chassis move. Zero NEEDS CLARIFICATION.

## Constitution Check

*GATE: must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Status | How this plan satisfies it |
|---|---|---|
| **I. Sub-apps are self-contained** | PASS | Everything lands in `app/family/**`, `lib/family/**`, `supabase/migrations/` and the seed script, with one deliberate root-level touch: a `family-lists-core` zone in `.fallowrc.json` (`lib/family/lists/**/*`), the Phase 2–4 pattern — a boundary widening in config, reviewable in the diff, not a suppression (R516). No new dependency, no `next.config`/`proxy`/`vitest.config` edit. The one move is *inside* the sub-app: the board chassis leaves `tasks/components/` for `(app)/components/` because a third board now imports it (R507) — §I's "third consumer" rule applied to a folder, not to `lib/`. |
| **II. Test-first for logic** | PASS | The parts that can be silently wrong are pure or in the database and land test-first: the flat sequence and section order, the drop rule (`dropOf` as a table — top, bottom, under a header, between sections, own position), the count rule, the section-name match, the row layout, the two visibility rules, validation, permissions — and, in the policies tier before the actions exist, the CHECKs, the cascade, the attribution nulling, `seed_default_lists` by emptiness, then every action's truth (idempotent ticks, exact clear, one-write move across sections, case-insensitive merge, rename-merge, remove-keeps-items, the member's `NOT_FOUND`). The lift's feel and the two-device latency are verified by running the app. |
| **III. Accessible and touch-first** | PASS | FR-541/542: every checkbox is a real `<input type="checkbox">` named by its item's text; the count badge and section counts carry text; the `•••` menus and the chevrons have names; every control is ≥44×44 with visible focus; the menus, sheets and confirmations are native `<dialog>`s on `useModalDialog`; keyboard reorder comes with the shipped machine; the lift collapses under reduced motion and the press-and-hold still works. |
| **IV. Layered, boundary-enforced architecture** | PASS | Grouping, the drop rule, visibility and the row layout live in framework-free `lib/family/lists/**`; components render from them; the actions send one statement each; the database keeps the shape. `lib` imports nothing from `app/**`; the new zone may reach `lib` and nothing else. |
| **V. Quality gates** | PASS | The branchy new code is pure and table-tested. `ListsBoard`'s model is composed from named hooks from the start (`useListsView`, `useListsData`, `useListEditor`, `useItemSheet`, `useSectionSheet`, `useListWrites`), the Phase 4 shape; `dropOf` is one function with one table; section normalisation is one helper shared by three actions. Duplication is handled by reuse: the third board mounts the moved chassis rather than a copy; the folds store is a factory beside the switch store; the two confirmations are one `ConfirmDialog`. If `fallow:dupes` flags `useDeviceVisibility` against the new key-set factory, `useDeviceVisibility` is rebuilt on it — never a threshold lift. No suppression anywhere. |
| **VI. Degrade gracefully** | PASS | FR-537 verbatim; a refused add keeps the typed text and says why; a vanished list closes its sheet; the switch and folds keep an in-memory fallback with the shipped "won't be remembered" notice. Destructive copy states what is lost and kept: Delete list names the item count; Clear Completed names the count; removing a section says the items stay. |
| **VII. Private by default** | PASS | Two tables with `is_member()` read policies, SELECT to `authenticated`, ALL to `service_role`, nothing to `anon`; every write is a `requireVerifiedActor` action scoped by `household_id`; the item→list reference proves tenancy through a composite `(id, household_id)` FK; the one function is `security definer`, `search_path = ''`, revoked from public, executable by the service role only. Every list and item records its actor. Replica identity stays default. Parents only is honestly a display and action rule, not a security boundary, and the spec says so (Assumption 5). |
| **VIII. Fidelity is specified** | PASS | All 45 FRs are tagged; the master map's flattened `[V]`s on the footer and the 3.4 cards are corrected to `[V-photo]`/`[ESTIMATED]` (spec Contradictions); every list metric stays `[ESTIMATED]` in the token layer. No spec sentence is narrowed by design: FR-502's "never wrapped" is `rowLayoutOf`, FR-529's match rule is the one helper, FR-533's "lose nothing" is the UPDATE to null. |

**Result: PASS, no deviation claimed, no open question.**

### Re-check after Phase 1 design

- **A read that a member can make of a list they cannot see.** Tested against §VII: RLS is by
  household, as it has been since Phase 1, and the household shares one account; the punch-in is
  the app's layer, so hiding is the app's job. The spec records it as a display rule (Assumption
  5), the action refuses the write from the database's role, and nothing crosses the household.
  **PASS.**
- **The chassis move touches shipped Tasks and Rewards code.** Tested against §II and §V: a move
  with no behaviour change, every existing test carried along and green before any list code is
  written; the diff is imports. **PASS.**
- **The geometry hook gains two parameters.** Tested against §V: defaults preserve every shipped
  call site; `rowLayoutOf` is a six-line pure function with its own table. **PASS.**
- **Section names are normalised in the action, not the database.** Tested against §VI: the
  database's invariant (a section is whatever string the items carry) cannot be violated by a
  spelling; the worst outcome of a bug is two spellings on one list, visible and fixable by a
  rename. **PASS.**

### Complexity Tracking

No deviation is claimed. Two design choices are recorded here because a reviewer could ask:

| Choice | Why not the simpler alternative |
|---|---|
| Sections as strings on items, no section table | A table invents an entity the reference lacks and allows the empty section the reference forbids; ordering by first item makes a drag order sections as it orders items, and a cross-section drop stays one write (R501, R502). |
| Parents only enforced in the action, not RLS | RLS cannot see the punch-in (one shared account); a per-list RLS predicate would need an actor the database session does not have — Phase 1's design, not reopened (R505). |

## Project Structure

### Documentation (this feature)

```text
specs/005-family-lists/
├── plan.md              # This file
├── spec.md              # 45 FRs, 15 SCs, 17 assumptions, 6 contradiction resolutions
├── research.md          # Phase 0 — R501–R516
├── data-model.md        # Phase 1 — migrations 028–029 in full SQL, invariants, privilege delta
├── quickstart.md        # Phase 1 — setup, fixtures, per-guarantee verification, operator steps
├── contracts/
│   └── server-actions.md    # Phase 1 — twelve actions, the read path, the error contract
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 — /speckit.tasks
```

### Source Code (repository root)

```text
supabase/migrations/
├── 028_lists.sql                    # lists + list_items + seed_default_lists + policies/grants
└── 029_realtime_lists.sql

scripts/family-seed.mjs              # (~) ensureHousehold calls seed_default_lists (both modes); --local fixtures (R511)

lib/family/
├── lists/                           # NEW zone family-lists-core, framework-free
│   ├── grouping.ts                  # groupedRowsOf(items) — the flat sequence with headers; uncheckedCountOf; sectionsOf; matchSection/normaliseSectionName
│   ├── reorder.ts                   # dropOf(rows, movedId, toIndex) → { previousItemId, nextItemId, section } (R502)
│   ├── visibility.ts                # visibleListsOf(lists, actor) (R505); itemsShownOf(items, switches) (FR-520)
│   └── layout.ts                    # rowLayoutOf(input) — whole cards or pager, never wrap (R507)
├── types.ts                         # (~) List, ListItem, ListKind, ListFilters
├── rows.ts                          # (~) LIST_COLUMNS / LIST_ITEM_COLUMNS + toList / toListItem
├── validation.ts                    # (~) listInputSchema, updateListSchema, deleteListSchema, listItemTextSchema, sectionNameSchema, the item/section action schemas
├── queries.ts                       # (~) familyKeys.lists / listItems + fetch* + use*
├── permissions.ts                   # (~) list.create, list.write (target-aware on parentsOnly)
├── actions/lists.ts                 # NEW: the twelve actions (R504); loadList / loadItem with the Parents only rule (R505)
└── __tests__/
    ├── unit/                        # lists-grouping, lists-reorder, lists-visibility, lists-layout, lists-validation, permissions delta, list-tokens
    └── policies/                    # lists-schema, lists-access, lists-actions, privileges delta

app/family/
├── tokens.css                       # (+) the Lists section: card, header, row, checkbox, badge, footer, two type sizes [ESTIMATED] (R512)
└── (app)/
    ├── components/
    │   ├── ColumnPager.tsx          # MOVED from tasks/components (with useColumnPage) — R507
    │   ├── useBoardGeometry.ts      # MOVED; (~) gains { widthToken, layoutOf } with the Tasks defaults
    │   ├── useListReorder.ts        # MOVED — the generic machine split out of tasks/components/useColumnReorder.ts
    │   ├── deviceStorage.ts         # (~) createDeviceKeySet(storageKey) for the folds (R509)
    │   ├── FilterSheet.tsx          # (~) the Lists section: "Completed items"
    │   ├── nav.ts                   # (~) lists: showsChipRow false
    │   └── useFamilyRealtime.ts     # (~) + lists, list_items
    ├── tasks/components/
    │   └── useColumnReorder.ts      # (~) keeps useRoutineReorder, RoutineMove, householdOrderOf; imports the moved machine
    └── lists/
        ├── page.tsx                 # (~) replaces the placeholder: lists + items → initialData; TabUnavailable copy
        └── components/
            ├── ListsBoard.tsx       # chassis (moved): useBoardGeometry(lists, { widthToken, layoutOf: rowLayoutOf }) + useColumnPage + ColumnPager + BoardStrip; model hooks; FAB "Add List"; empty state
            ├── ListCard.tsx         # header + AddItemBox + rows + footer; one useListReorder per card (R508)
            ├── ListCardHeader.tsx   # serif name, count badge, ••• menu
            ├── AddItemBox.tsx       # Enter adds; disabled while pending; kept on refusal (FR-516, FR-537)
            ├── ListItemRow.tsx      # text left, square checkbox right; checked style; the lifted pointer
            ├── SectionHeader.tsx    # name, "N items", chevron (fold), ••• menu; placeholder state = AddSectionFooter
            ├── ListMenu.tsx         # the <dialog> action sheet for a list and for a section
            ├── ListForm.tsx, useListForm.ts   # Name, List type, Colour (ColorPicker), Parents only
            ├── ItemSheet.tsx        # edit text, Section chooser, Delete
            ├── SectionSheet.tsx     # Add section / Move items / Rename
            ├── ConfirmDialog.tsx    # Delete list; Clear Completed
            ├── useListFilters.ts    # createDeviceSwitches('family:list-filters:v1', { completed: true })
            ├── useListFolds.ts      # the per-device folded set ('family:list-folds:v1')
            └── useListWrites.ts     # useSerialisedWrites bound to the twelve actions
```

**Structure Decision**: the Lists tab replaces its Phase 1 placeholder inside the `(app)` route
group. The board chassis moves to `app/family/(app)/components/` in the first task because it now
has three consumers (R507); `tasks/components/useColumnReorder.ts` keeps the routine-specific hooks
and imports the moved machine. Nothing leaves the sub-app.

## Implementation phasing

| # | Step | Verifiable by |
|---|---|---|
| 1 | **The chassis moves home** (R507): `ColumnPager` + `useColumnPage`, `useBoardGeometry` (+ `widthToken`/`layoutOf` options with Tasks defaults), `useListReorder` split out of `useColumnReorder.ts`; tests move; imports updated; tokens for lists added; `family-lists-core` zone | Every existing test green; `npm run fallow:audit` clean; Tasks and Rewards unchanged by hand |
| 2 | Migrations 028–029 on the local stack + the policies suites **written red first**: CHECKs, kinds, palette, section shape, checked shape, cascades, attribution nulling, `seed_default_lists` once, the privilege delta, SC-509 per path | `supabase db reset`; every policies test green; `privileges.test.ts` exact |
| 3 | Rows / types / validation / the two reads + keys + `initialData` on the page; realtime tables; `nav.ts` chip row off | Unit validation tests (bounds, kinds, palette, unknown keys, `confirm: true`); reads under RLS; `nav.test.ts` |
| 4 | `lib/family/lists/*` — `grouping`, `reorder`, `visibility`, `layout` — **tests first** | The flat sequence and section order; `dropOf`'s table; counts unmoved by the switch; `visibleListsOf` by role; `rowLayoutOf` at four viewports |
| 5 | Actions: `lists.ts` (twelve), `loadList`/`loadItem`, the normaliser, `permissions.ts` delta — **policies tests first** | SC-504/505/507's `NOT_FOUND`, move across sections, merge/rename/remove issued directly |
| 6 | The tab: page, `ListsBoard` on the moved chassis, `ListCard`, `ListCardHeader`, `ListItemRow`, `AddItemBox`, check/uncheck, the empty state, the FAB | Story 1's scenarios 1, 2, 6 and Story 2's 1–3 by hand at four viewports; RTL for badge, rows, checked style, the box |
| 7 | `ListMenu`, `ListForm`, `ItemSheet`, `ConfirmDialog`: create/edit/delete a list, edit/delete an item, Clear Completed | Story 1's 2–5, Story 2's 4, 6 by hand; RTL for the forms and confirmations |
| 8 | Sections and reorder: `SectionHeader`, `AddSectionFooter`, `SectionSheet`, folds store, `useListReorder` per card with headers as rows, `moveListItem` | Story 3 by hand; RTL for fold, rename, remove; `lists-reorder` table |
| 9 | Parents only and the Filter switch: `visibleListsOf` in the memo chain, the gone-check on punch-out, `FilterSheet`'s Lists section, `itemsShownOf` below the counts | Story 4 and Story 2's 5 by hand; RTL for the row leaving on punch-out and the badge unmoved |
| 10 | Seed fixtures, docs sync, gates, graph, the review (code-reviewer + security-guardian over migrations, actions, guards, the Parents only rule) | All four gates green, no suppressions; a fresh reset shows the fixtures |
| 11 | **Hosted push (028–029), the §4 checks and the hosted seed run, then merge and deploy** | Privileges with no `anon`; two tables published at replica identity default; two default lists once; SC-514 on the live site |

## Risks

| Risk | Mitigation |
|---|---|
| The chassis move breaks the Tasks or Rewards board | Step 1 is a pure move with every existing test carried along and green before any list code; the by-hand check of both boards is part of its verification |
| A cross-section drop lands the item in the wrong section | The rule is one pure function (`dropOf`) with an exhaustive table, and the copy tells the person the rule ("just under a header") — quickstart §Common problems |
| Sections are ordered by their first item, so a drag can reorder sections unexpectedly | It is the specified behaviour (spec Assumption 9), it is deterministic, and it is what makes one position per item enough; the preview shows the order before the drop |
| Two spellings of one section on one list | The normaliser is one helper used by every path that writes `section`; the policies suite asserts the merge on each |
| Two devices add in the same second and tie on `sort_order` | The read orders by `sort_order, created_at`; both devices draw the same order; the next drop spreads them |
| A member reaches a Parents only list's items through the network | Stated in the spec as a display rule within the household (Assumption 5, R505); the write is refused from the database role; nothing crosses the household |
| A parent's punch-in lapses mid-sheet on a Parents only list | The board's gone-check closes the surface when the list leaves the visible set; the drag machine cancels on pointer cancel; nothing is written |
| Deploy before push takes the channel down | Phase 3's ordering rule, restated in quickstart §4 and the tasks file |
| The folds key-set store duplicates `useDeviceVisibility` | Extract to the factory and rebuild `useDeviceVisibility` on it the moment `fallow:dupes` flags it; never a threshold lift |
| The count badge moves when completed items are hidden | `itemsShownOf` is applied below the counts in the memo chain (R506); RTL asserts the badge is unmoved |
| The punch-in prompt arrives at the tick, as on Tasks | The operator's open UX question from Phase 4 stands (plan §Risks there); unchanged here — every list write is `withActor`, so moving the prompt later is one place |

## Progress

- [x] Phase 0 — research complete ([research.md](./research.md): R501–R516, no open unknowns, zero new dependencies)
- [x] Constitution check — pass, before and after design, no deviation claimed
- [x] Phase 1 — design complete: [data-model.md](./data-model.md) (028–029 in full SQL, invariants, the privilege delta, the fallow zone), [contracts/server-actions.md](./contracts/server-actions.md) (twelve actions, the read path, the error contract), [quickstart.md](./quickstart.md)
- [ ] Phase 2 — `/speckit.tasks`
- [ ] Phase 3 — implementation per the phasing table above
