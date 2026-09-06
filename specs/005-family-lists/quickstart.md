# Quickstart: Family Lists

**Feature**: `005-family-lists` | **Date**: 2026-09-05

Everything needed to go from a Phase 4 checkout to a working Lists tab, plus how to verify each
Phase 5 guarantee by hand and where each is automated. Day-to-day development runs against the
**local** stack (§3); the hosted project needs the same short operator sequence as Phases 3 and 4
(§4): one `db push`, two post-push checks, one seed run, and the ordering rule.

## 1. Prerequisites

- **Phases 1–4 are the platform**, shipped and live. Their stack, seed, sign-in, punch-in, board
  chassis, reorder machine, filter sheet, write surface and both test projects are reused.
- **No new dependencies** (R514).
- **No new services, buckets, providers, hooks or extensions.** Migrations 028–029 create two
  tables and one helper function, and two publication entries. **No shipped table changes shape,
  no view, no trigger that writes.**
- **One config change that is not a migration**: `.fallowrc.json` gains a `family-lists-core`
  zone (data-model §"Dashboard / config steps").
- **One refactor before the feature**: the shared board chassis (`ColumnPager`, `useBoardGeometry`,
  the generic `useListReorder`) moves from `tasks/components/` to `components/` (R507). No
  behaviour changes; every existing test stays green.

## 2. Environment

Phases 1–4's `.env.local` carries over verbatim. **This phase adds no variables.**

## 3. Local stack

```bash
supabase start                        # :553xx
supabase db reset                     # replays 001–029
npm run family:seed -- --local        # + the two default lists, fixture items, "Packing List", "Party" (Parents only)
npm run dev:local                     # /family/lists
```

The seed's Phase 5 fixtures (R511): **Grocery List** (Sprout) — 🥚 Eggs, 🥛 Milk, 🍞 Bread
ungrouped, Bagels under **Bakery**, Yoghurt under **Dairy** (checked, by Ben); **To-Do List** (Cyan)
— Pack for trip, Pet sitter (Allie?), Stop mail; **Packing List** (Other, Grapefruit) — Shirts x5,
Jeans x2, Undies x7; **Party** (Other, Lavender, **Parents only**) — Cake, Balloons. The two default
lists come from `seed_default_lists()` and are never re-made; the fixtures are upserted by fixed
id. PINs are still never seeded — set one in Settings before writing.

## 4. Hosted project — operator steps

> **Ordering constraint, unchanged from Phases 3 and 4**: the push happens **before** the branch
> is merged or deployed. Two more tables join the single shared realtime channel; a deploy that
> lands first takes the shipped calendar's and boards' live updates down, silently.

1. **Push**: `supabase db push --linked` (028–029; a dry run lists exactly those two).
2. **Privileges** (SQL editor or `supabase db query --linked`):
   ```sql
   select table_name, grantee, string_agg(privilege_type, ',' order by 1) as privs
     from information_schema.role_table_grants
    where table_schema = 'family' and table_name in ('lists','list_items')
    group by 1, 2 order by 1, 2;
   -- expect: no anon row; authenticated SELECT; service_role ALL
   select p.proname, has_function_privilege('anon', p.oid, 'execute') as anon,
          has_function_privilege('authenticated', p.oid, 'execute') as authenticated,
          has_function_privilege('service_role', p.oid, 'execute') as service_role
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'family' and p.proname = 'seed_default_lists';
   -- expect: false, false, true
   ```
3. **Publication**: the two tables in `pg_publication_tables` for `supabase_realtime`, replica
   identity `d` on each.
4. **Default lists**: `npm run family:seed -- --yes` (the hosted mode; it calls
   `seed_default_lists` and changes nothing else), then
   `select name, kind, color from family.lists order by sort_order;` — exactly "Grocery List"
   (`grocery`, `#B6E085`) and "To-Do List" (`to_do`, `#A8D4D3`). A second run adds nothing.
5. Then merge, deploy, and the device pass (§"Verifying").

## 5. Run

Sign in, punch in as anyone, open Lists. The seeded cards already carry items, so on a fresh reset
the badges, a checked row, two sections and a hidden list are all there before anything is typed.
Punch in as Ana to see "Party"; punch out and watch it leave.

## Verifying the guarantees — by hand

| Criterion | What must hold | Verify by hand |
|---|---|---|
| **SC-501** two defaults, once | Grocery List then To-Do List, Sprout and Cyan; a re-seed adds nothing | Fresh reset without `--local` fixtures (or the hosted step 4): two cards; run the seed again: still two |
| **SC-502** add ≤5 s | The item appears last among the ungrouped on device B | Type "Coffee" on A's Grocery List; B shows it under 🍞 Bread within 5 s |
| **SC-503** tick ≤5 s | Filled, grey, struck; same place; both badges agree | Tick 🥛 Milk on A; B follows; untick; B follows |
| **SC-504** two ticks, same second | Both succeed, no error; opposite ticks settle on one state | Two devices tap Milk together; then one ticks while the other unticks |
| **SC-505** Clear Completed exact | Exactly the checked ones go, in one write; order of the rest unchanged | Check two of five, Clear Completed (confirm says 2): three remain in order on both devices |
| **SC-506** drop lands where released | Lift ≤500 ms; drop into/out of a section; one write; B agrees | Long-press 🍞 Bread, drag under Dairy, release: it is Dairy's first item on both devices; drop it back on its own spot: nothing written |
| **SC-507** Parents only | Absent for nobody and for a member; appears ≤1 s after a parent punches in; leaves on punch-out; member write refused | "Party" on the wall: absent → punch in as Ana → present → punch out → gone. As Cleo: absent; a direct `addListItem` to it → `NOT_FOUND` |
| **SC-508** offline / nobody | Refused with a message, nothing stored, nothing later; keypad first | Airplane mode: tick → message, checkbox empty; reconnect: still empty. Punched out: tick → keypad |
| **SC-509** no stranger's data, no client write | `42501` for anon; zero rows for another household; `authenticated` cannot write | `curl` both REST endpoints with the publishable key and no session → refused; a second household's member sees `[]`; an `authenticated` INSERT → refused |
| **SC-510** four viewports | 3 / 2 / 1 / 1 whole cards; never a sideways page scroll; swipe pages one; 44 px | 1920×1080, 1180×820, 820×1180, 390×844 on `/family/lists` |
| **SC-511** tokens | Every list metric is one `--fam-list-*` token, `[ESTIMATED]`, read back by a test | `grep -c "fam-list" app/family/tokens.css`; `list-tokens.test.ts` green |
| **SC-512** accessible names | Checkbox = item text + state; card = list name; badge = "N to do"; chevron = "Fold/Unfold Dairy" | VoiceOver on the iPad over one card; Tab through the card; arrow keys reorder after a held Space |
| **SC-513** tests | Pure logic table-tested; the two tables' policies and the twelve actions covered | `npm test` (unit) and `npm run test:policies` green |
| **SC-514** channel intact | Calendar, Tasks, Rewards still live ≤5 s after deploy | Two devices: add an event, tick a task, redeem — each follows within 5 s |
| **SC-515** placeholder gone, no chip row, "Add List" | Audit the tab; Tasks and Rewards unchanged | Open `/family/lists`: no "Coming soon", no chips, the `+` reads "Add List"; screenshot Tasks and Rewards before/after |

### Load-bearing FR spot-checks

- **FR-505 / FR-520**: hide completed items on the wall; the badge and every section count are
  unchanged; the phone still shows the struck rows.
- **FR-516**: after Enter the box is empty and focused; on a refusal (200+ characters typed,
  offline) the text stays and the notice sits beside the box.
- **FR-527 / FR-533**: check and clear Dairy's only item — the Dairy header is gone; remove Bakery —
  Bagels is still there, ungrouped, in its place.
- **FR-529**: add a section named " dairy" with 🥛 Milk chosen: Milk joins **Dairy** (the existing
  spelling), no second section.
- **FR-533 rename-merge**: rename Bakery to "Dairy": Bagels is now under Dairy; one section.
- **FR-540**: delete a throwaway Profile who created a list and ticked items: the list, the items
  and the ticks are all still there; nothing about lists in the delete confirmation.
- **FR-543**: on the phone, a horizontal swipe pages; a held press then drag reorders; neither
  triggers the other.

## Automated checks — which suite covers what

| Guarantee | Suite |
|---|---|
| SC-501 by emptiness, SC-509, the CHECKs, cascades, attribution nulling, the privilege delta | `lib/family/__tests__/policies/lists-schema.test.ts`, `lists-access.test.ts`, `privileges.test.ts` |
| SC-504 idempotent ticks, SC-505 exactness, SC-507's `NOT_FOUND`, moves across sections, the section merge/rename/remove rules, all twelve actions | `lib/family/__tests__/policies/lists-actions.test.ts` |
| SC-506's drop rule, the flat sequence and section order, counts, the name match | `lib/family/__tests__/unit/lists-reorder.test.ts`, `lists-grouping.test.ts` |
| SC-507 display by role, SC-510's fit rule, FR-520's hiding below the counts | `lists-visibility.test.ts`, `lists-layout.test.ts`; `ListsBoard.test.tsx` |
| SC-511, SC-512, SC-515 | `list-tokens.test.ts`; `ListItemRow.test.tsx`, `SectionHeader.test.tsx`, `ListCard.test.tsx`; `nav.test.ts`, `ListsBoard.test.tsx` |
| FR-516's box behaviour, the forms and sheets | `AddItemBox.test.tsx`, `ListForm.test.tsx`, `ItemSheet.test.tsx`, `SectionSheet.test.tsx`, `FilterSheet.test.tsx` |
| SC-502/503/514 latency, the feel of the lift, two devices | by hand |

## Quality gates

`npm run fallow:audit` (with the new zone), `npm test`, `npm run typecheck`, `npm run lint` — all
green before every commit; no suppressions.

## Common problems

- **A list is missing on the wall**: it is Parents only and nobody (or a member) is punched in —
  punch in as a parent. Nothing is lost.
- **The card shows no "Add section" footer change after naming a section**: a section needs at
  least one item; choose one in the sheet.
- **A drop lands in the wrong section**: the section is the nearest header *above* the release
  point — drop just under a header to be its first item.
- **Checked items vanished on one device only**: the Completed switch is off in that device's
  Filter sheet; the badge never counted them.
- **The hosted `/family` went quiet after a deploy**: 029 was not pushed first — push it; the
  channel recovers on the next page load.
