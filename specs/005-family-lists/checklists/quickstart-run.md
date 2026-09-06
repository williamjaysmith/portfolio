# Quickstart run (T048, T049, T053) — the local stack, 2026-09-06

**Feature**: [spec.md](../spec.md) · **Tasks**: T048, T049, T051, T053 · **Stack**: `supabase start`
(553xx), `supabase db reset` replaying 001–**029**, `npm run family:seed -- --local`, `npm run dev:local`,
Chrome via the DevTools MCP (page 7 = device A at 1180×820 → 1920×1080 → 390×844 phone emulation;
page 11 = device B in an isolated browser context), with Ana's PIN set in Settings first.

## Gates (T051)

| Gate | Result |
|---|---|
| `npm run typecheck` | clean |
| `npx eslint app/family lib/family` | clean (the whole-repo run still carries the pre-existing errors outside `/family`, on `main` before Phase 3) |
| `npm run fallow:audit` | no issues in the 88 changed files — dead code 0, complexity 0, **duplication 0**; three advisory `css-token-drift` warnings (two pre-existing dialog widths, `max-h-[40vh]` on the section checklist) |
| `npx vitest --project unit` (via the audit's coverage run) | 191 files, **3139** tests |
| `npm run test:policies` | 26 files, **431** tests, green on the 001–029 schema |
| `npm run graph` | rebuilt |

## Seed (T049)

Fresh `supabase db reset` + `npm run family:seed -- --local`: Grocery List and To-Do List (the two
defaults, `seed_default_lists` by emptiness) plus the Packing List and the Parents only Party
fixtures — "13 across the two defaults and the two fixtures"; the checked Yoghurt under Dairy,
Bagels under Bakery. A second seed run adds nothing (idempotent by emptiness of `list_items`).
PINs are never seeded (Ana's was set from Settings by hand).

## What was walked on a screen (T053, T048)

| Criterion / scenario | Seen |
|---|---|
| SC-515, FR-506/507 | `/family/lists`: no placeholder, no chip row, the shell's `+` reads **Add List** |
| SC-510, FR-502/543 | 1180 and 1920 wide: three whole cards (567 px each) and a pager over the fourth — "Showing Grocery List, To-Do List and Packing List", ArrowRight → "…To-Do List, Packing List and Party"; 390×844 phone: one whole card, "Showing Grocery List", never a sideways page scroll |
| FR-514 / SC-507 (Story 4) | Nobody punched in: Party absent, three cards. Ana (parent) punched in: Party present on the next page with Cake and Balloons. Punch-out (the 3-minute lapse): Party gone again. The member-side refusal (`NOT_FOUND`, never `FORBIDDEN`) is the policies suite's `lists-actions.test.ts` |
| FR-534, FR-518, SC-503 (device A) | Ticking 🥛 Milk while punched out opened "Who's here?" first; Ana's PIN, then the tick landed: filled, struck, **same place** between Eggs and Bread; badge 4 → 3; Dairy's count unmoved |
| FR-516, SC-502 (device A) | "Coffee" typed into To-Do's box and Enter: the row appeared last among the ungrouped, badge 3 → 4, the box empty again |
| FR-522, FR-541 | Tapping 🥚 Eggs opened its sheet: text prefilled, Section chooser (No section / Bakery / Dairy / New section…), **Move up disabled at the top**, Move down, Delete, Cancel, Save |
| FR-531 | The Dairy chevron folded the section on this device: Yoghurt hidden, the header and "0 items" kept, the button reads **Unfold Dairy** with `aria-expanded=false`; `family:list-folds:v1` holds `"<listId> Dairy"` |
| FR-528, FR-529 | "Add section" footer → sheet with the name field and the five items as a checklist (each showing its section); typed " dairy" → the note **"The items join Dairy."**; 🍞 Bread chosen; Save asked for the punch-in, then Bread sat under **Dairy** (the existing spelling), count 1 — no second section |
| FR-533 rename-merge | Bakery's `•••` → Rename section → "Dairy": one Dairy header, **2 items** (Bread, Bagels; the checked Yoghurt not counted) |
| FR-523, FR-532, SC-506 | Phone emulation, touch pointer: press-and-hold on Bagels (under Dairy) → after 600 ms the row was lifted and the live region read "Bagels, position 5 of 6. Picked up."; dragged above Eggs, the preview showed it first; release → "Bagels, position 1 of 6. Dropped." and the row was drawn first, ungrouped. Database: `Bagels · ∅ · sort_order 0`, Eggs 1000, Milk 2000, Bread Dairy 3000, Yoghurt Dairy 5000 — one write |
| FR-520, FR-505 | Filter → Lists → **Completed items** off: the struck rows leave, the badge and the section counts do not move; `family:list-filters:v1` = `{"completed":false}` |

## Not walked here

- **SC-502–SC-506 on two devices**: device B (page 11, isolated context) never received a realtime
  event on the local stack — `realtime.subscription` stayed empty for every tab, the Tasks tab
  included, while the same channel shape subscribed fine from node against the same stack. The local
  realtime image (v2.103.2) and this supabase-js (2.112, protocol `vsn=2.0.0`) do not agree; this
  is the local stack, not Phase 5 (the Tasks board shows the same gap here and is live on hosted).
  Verify on the hosted project after the push (T054 live checks), as SC-514 requires anyway.
- SC-508 (airplane mode), SC-512 (VoiceOver), SC-504 (two taps in the same second): the device
  pass (T055).

## Review gate (T052)

- **code-quality** over the whole diff: one real defect — `ListCard` fed the press-and-hold machine
  the unfiltered row set while the DOM held the fold-filtered one, so a lift below a folded section
  indexed the wrong item. Fixed by filtering folds BEFORE the machine sees the rows (one `rows`
  memo), with a red-then-green test ("lifts the row under the pointer when a fold sits above it").
  Also taken: the duplicated count-words helper → `itemsInWords` in `lib/family/lists/grouping.ts`;
  `labelOf` memoised so the machine's callbacks are not rebuilt every render.
- **security-auditor** over 028–029, `actions/lists.ts`, the schemas, the visibility filter, the page
  and the board: no findings; every query scoped by `household_id`, Parents only answered
  `NOT_FOUND` uniformly, the seed function `security definer` + `search_path=''` + service_role only,
  replica identity default. One drift note taken: `mayTouch` now delegates to the permission
  matrix's own `memberMayWriteList` rule instead of restating it.

## Hosted (T054), 2026-09-06

`supabase db push --linked` applied 028 and 029 (dry run listed exactly those two). Quickstart §4
checks via `supabase db query --linked`: `lists` / `list_items` grants — `authenticated` SELECT,
`service_role` ALL, **no `anon` row**; `seed_default_lists` executable by `service_role` only; both
tables in `supabase_realtime` with replica identity `d`. `npm run family:seed -- --yes` → "2 default
lists (seeded)": Grocery List (`grocery`, `#B6E085`, 1000) and To-Do List (`to_do`, `#A8D4D3`, 2000).
