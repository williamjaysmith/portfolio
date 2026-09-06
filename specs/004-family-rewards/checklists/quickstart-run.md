# Quickstart run (T055) — the local stack, 2026-09-05

**Feature**: [spec.md](../spec.md) · **Tasks**: T055, T056 · **Stack**: `supabase start` (553xx),
`supabase db reset` replaying 001–**027**, `npm run family:seed -- --local`, `npm run dev:local`,
Chrome via the DevTools MCP at 1920×1080 (page 7), with Ana's and Cleo's PINs set in Settings first.

## Gates (T056)

| Gate | Result |
|---|---|
| `npm run typecheck` | clean |
| `npm run lint` on `app/family` + `lib/family` | clean (the whole-repo run still carries the 11 pre-existing `react-hooks/refs` errors outside `/family`, on `main` before Phase 3) |
| `npx vitest --project unit` | 168 files (with policies), **2917** tests with coverage |
| `npx vitest --project policies` | 24 files, green on the 001–027 schema |
| `npm run fallow:audit` | no issues in the changed files — dead code 0, complexity 0, **duplication 0** (three extractions along the way: `shower.tsx`, `deviceStorage.ts`, `useSerialisedWrites.ts`) |
| `npm run graph` | rebuilt |

## What was walked on a screen

| Criterion / scenario | Seen |
|---|---|
| US2-1/2/3/5, FR-422/423/427 | Seven columns paged three at a time at 1920 (the seed has six Profiles); Cleo's column: **Redeem ⭐ 15** first (Movie night), then ☆ 15/20 (Bake cookies), ☆ 15/25 (Ice cream); balances under every avatar; no chip row |
| US3-2/4/5/6/7/8, SC-410, SC-411, FR-432/433/438 | Ana (parent, punched in) redeemed Movie night for Cleo: the modal read "🍿 · Great work! Movie night redeemed · By Cleo for 15 stars on September 5, 2026 · Done · Unredeem", **80** gold stars fell over the whole screen, Cleo's balance 15 → 0, the one-time card left her column; **Unredeem** from the modal put the 15 back and the Redeem button returned; the ledger holds the −15 redemption and the +15 refund, both attributed to Ana |
| US3-1, FR-424 | Punched out, a tap on Redeem opened "Who's here?" first; punched in as **Cleo** (member) she redeemed her own Movie night — "By Cleo for 15 stars", balance 25 → 10, bars re-read 10/20 and 10/25 — and the muted **Redeemed on** card showed only with the Redeemed switch on (FR-425/426) |
| US4-1/2, SC-412, FR-434–436 | Give stars as Ana: the before-and-after table read Ben 0 → 10, Cleo 15 → 25; Confirm wrote exactly that (two `adjustment` rows by Ana). The punch-in had lapsed (3 min) so "Who's here?" appeared at Confirm — the at-write prompt |
| US4-5, FR-435 | As Cleo the Give-stars control is not offered |
| US1-2/3/4/8, FR-403/407/408, SC-402 | On the Tasks board: chips on Clean the bathroom ⭐15 and Feed the cat ⭐10, none on the rest; Ana's pill "0 stars earned" → **"15 stars earned"** on completing the 15-star chore, back to 0 on un-tick, 15 again on re-tick; the count 1/4 → 4/4 |
| US4-6, SC-414, FR-439 | The emoji rain (80 sprites) fired **only** on the completion that made Ana's list 4/4 — not on the two before it — and again after un-tick + re-tick |
| FR-443 (T053/T054) | Proved in the tiers: the reward for nobody goes, the shared reward stays, the dialog's third sentence; the schema defect they found (a Profile who had redeemed could not be deleted) is fixed in 026 and re-proved |

Not walkable here, proved in the tiers or left to T058's devices: SC-404/409 (two devices), SC-413's reduced-motion collapse (no emulation of the preference in this session; `StarConfetti.test`/`EmojiRain.test`/`WeekMessage.test`), SC-415's week messages (a clock jump; `week-celebrations.test`), SC-417 on real hardware (the layout is Phase 3's, re-verified at 1920 here), SC-416's anonymous REST probe (`rewards-access.test`).

## Drift found, and what won

1. **A Profile who had ever redeemed could not be deleted** (T053's tests): 026's attribution FKs
   `set null` on delete, which is an UPDATE the redemption trigger refused. The trigger now lets
   through exactly an attribution column going to null and nothing else; a same-millisecond
   double-unredeem still gets `P0008` (the first version of the fix was looser and the SC-409-style
   race test caught it). `data-model.md` §026 carries the same text.
2. **Three duplication findings were removed by extraction, not by the gate**: the two showers
   share `shower.tsx`, the two per-device stores share `deviceStorage.ts`, and `useTaskResolve` and
   `useRedeem` share `useSerialisedWrites.ts`.
3. **The DeleteDialog's tests live in `settings.test.tsx`**, not a file of their own; `tasks.md` T054
   says so now.
4. **The punch-in's timing** is a product question the operator raised during this walk: Skylight's
   Parental Lock gates the *action* (before the add/edit form) and never asks to tick; ours asks at
   the write and stays punched in for the timeout. Recorded as an open UX choice in `plan.md`
   §Risks; nothing changed.

Nothing in `quickstart.md`'s rows needed to change.

## The review gate (T057)

- **security-guardian**: PASS WITH FIXES — one Low: 025's header lacked the discriminated-row
  rejection for `family.task_resolutions`; added. Confirmed clean: the six trigger functions and
  `household_today` (`security definer`, empty search path, revoked from public), the
  `security_invoker` view, the grants (nothing to `anon`), the row lock's serialisation under
  READ COMMITTED, the partial unique indexes, the cascade guards in both triggers, replica identity
  default, every action's own auth check and `NOT_FOUND`-never-`FORBIDDEN`, strict Zod, affordance-
  only permissions, the two display-only stores, no secret-shaped strings.
- **code-reviewer**: PASS WITH FIXES — its one HIGH (migration 016 "untracked and out of order") is
  a false alarm: 016 is Phase 3's committed hotfix (`7d4eefe`) and `supabase migration list
  --linked` shows it applied on the hosted project before 017–023. Two comment nits applied
  (`RedeemModal`'s second `useRedeem` instance is named for what it is; `finishesList`'s claim
  comment is precise). Confirmed clean: the money rules server-side, the pill and balances above
  every filter, the rain judged from pre-write counters plus the in-flight ref, celebrations
  local-write-only, 44-pt targets, the live regions, reduced motion collapsing to nothing.
