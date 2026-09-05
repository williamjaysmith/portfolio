# Quickstart: Family Rewards

**Feature**: `004-family-rewards` | **Date**: 2026-09-05

Everything needed to go from a Phase 3 checkout to a working Rewards tab and a starred board, plus
how to verify each Phase 4 guarantee by hand and where each is automated. Day-to-day development
runs against the **local** stack (§3); the hosted project needs the same short operator sequence
as Phase 3 (§4): one `db push`, two post-push checks, and the ordering rule.

## 1. Prerequisites

- **Phases 1–3 are the platform**, shipped and live. Their stack, seed, sign-in, punch-in,
  resolution verbs, streaks, column layout, filter stores and both test projects are reused.
- **No new dependencies** (R416). `framer-motion` is already installed; the confetti and the
  emoji rain are hand-rolled sprites.
- **No new services, buckets, providers, hooks or extensions.** Migrations 024–027 create four
  tables, one view, six trigger functions and one helper, four publication entries. **No shipped
  table changes shape** and **no function is on the write path** beyond triggers.
- **One config change that is not a migration**: `.fallowrc.json` gains a `family-rewards-core`
  zone (data-model §"Dashboard / config steps").
- **PostgreSQL 15+** is already confirmed on the hosted project (Phase 3, T081: 17.0006).

## 2. Environment

Phases 1–3's `.env.local` carries over verbatim. **This phase adds no variables.**

## 3. Local stack

```bash
supabase start                        # :553xx
supabase db reset                     # replays 001–027
npm run family:seed -- --local        # + star values on five tasks, three rewards, Cleo at 15 stars
npm run dev:local                     # /family/tasks and /family/rewards
```

The seed's Phase 4 fixtures (R413), idempotent by emptiness: **Brush teeth** 5 ⭐ (Cleo, tracked,
streak 11), **Practice piano** 5, **Feed the cat** 10, **Take out trash** 20 (Ben), **Clean the
bathroom** 15 (Ana); rewards **Bake cookies** 🍪 20 (renews, Cleo), **Movie night** 🍿 15 (one-time,
Cleo + Ben), **Ice cream** 🍨 25 (one-time, everyone); one adjustment giving Cleo 15. PINs are
still never seeded — set one in Settings before redeeming.

## 4. Hosted project — operator steps

> **Ordering constraint, unchanged from Phase 3**: the push happens **before** the branch is
> merged or deployed. Four more tables join the single shared realtime channel; a deploy that
> lands first takes the shipped calendar's and board's live updates down, silently.

1. **Push**: `supabase db push --linked` (024–027; a dry run lists exactly those four).
2. **Privileges** (SQL editor or `supabase db query --linked`):
   ```sql
   select table_name, grantee, string_agg(privilege_type, ',' order by 1) as privs
     from information_schema.role_table_grants
    where table_schema = 'family'
      and table_name in ('rewards','reward_eligibilities','star_entries','redemptions','star_balances')
    group by 1, 2 order by 1, 2;
   -- expect: no anon row; authenticated SELECT; service_role ALL (SELECT on the view)
   select p.proname, has_function_privilege('anon', p.oid, 'execute') as anon,
          has_function_privilege('authenticated', p.oid, 'execute') as authenticated
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'family' and p.proname in
      ('assert_reward_eligibility','credit_task_resolution','retract_task_resolution',
       'assert_star_adjustment','assert_redemption','record_redemption','household_today');
   -- expect: false, false on every row
   select reloptions from pg_class where relname = 'star_balances';   -- security_invoker=true
   ```
3. **Publication**: the four tables in `pg_publication_tables` for `supabase_realtime`, replica
   identity `d` on each.
4. **Balances on day one**: `select * from family.star_balances;` — one row per Profile, all 0.
5. Then merge, deploy, and the device pass (§"Verifying").

## 5. Run

Sign in, punch in as a parent, edit a task and give it stars; tick it as that Profile; open
Rewards. The seeded board already carries values, so on a fresh reset the chip, the pill and the
bars are visible before anything is edited.

## Verifying the guarantees — by hand

| Criterion | What must hold | Verify by hand |
|---|---|---|
| **SC-401** one extra field | Stars is one field on the task form; a template carries its value | Edit "Feed the cat": the Stars field sits after Phase 3's fields with the guidance beside it. Add from the "Take out trash" template: the value is pre-filled |
| **SC-402** exact and reversible | Balance = Σ ledger after a mixed day | As Cleo: tick Brush teeth (both slots), Feed the cat, un-tick one, re-tick, skip Practice piano, unskip; as Ana tick one of Cleo's. Read `star_balances` and `star_entries` for Cleo: the sum matches, every credit names Cleo, the Ana-ticked one records Ana in `created_by` |
| **SC-403** skips earn nothing | No entry on skip or unskip | The two skip rows above added no entry and moved neither pill nor balance |
| **SC-404** ≤5 s on a second device | Pill, balance, bar, button, history | Two devices: tick on A, redeem on A, unredeem on A, give stars on A — B follows each within 5 s, no reload |
| **SC-405** editing a value rewrites nothing | Balance identical before/after; next tick earns the new value | Change Feed the cat from 10 to 3 after a credit: balance unchanged; tick again → +3 |
| **SC-406** nothing moves anonymously | Every star write refused punched-out and member-refused where parent-only | Punched out: Redeem, Unredeem, Give stars, reward create/edit/delete each demand a punch-in. As Cleo: Give stars and reward management are absent, and a direct call is refused |
| **SC-407** a member redeems only their own | Four checks | Cleo redeems hers → ok; Cleo redeems Ben's → refused naming Ben; Ana redeems Cleo's → ok, credited to Cleo, actor Ana |
| **SC-408** nobody overspends | One short → no button, direct call refused; exact → zero | Set Cleo to 19 (adjust −1 from 20): Bake cookies shows a bar; a direct `redeemReward` → `CONFLICT`. Set 20: Redeem → balance 0 |
| **SC-409** one redemption wins | Two devices, same second | Both tap Redeem on the same 20-star reward at 20 stars: one modal, one refusal "no longer has enough", one `redemptions` row |
| **SC-410** the two kinds differ | Renewing resets; one-time greys, per Profile | Redeem Bake cookies (renews): back to 0/20. Redeem Movie night (one-time) as Cleo: her card reads "Redeemed on <today>" behind the Redeemed switch; Ben's is untouched |
| **SC-411** Unredeem is exact | Refund, card restored, both rows kept | From the modal, then from the history card: balance back by the cost; two ledger rows (redemption, refund); the card back to bar/button |
| **SC-412** before-and-after is true | Two Profiles, a negative, a refusal | Give 10 to Cleo and Ben: the table's "after" equals the balances. Take 5 from Ben at 3: refused, nothing written for Cleo either |
| **SC-413** no celebration under reduced motion; once; local | Falling stars, rain, week message | With reduced motion on: redeem and complete a list — nothing moves. Off: each plays once, ends within 6 s, and the second device shows only the data |
| **SC-414** the rain fires on completion by a tap | Not on a skip, not behind a filter, again after undo | Leave one outstanding; skip it → nothing; unskip, hide it with a filter, complete via search → the rain plays (the list is complete regardless of the filter) ; un-tick and re-tick → plays again |
| **SC-415** the week messages | Amazing / Strong / nothing / skip is neither | Locally with the clock: a full week of Brush teeth → Amazing Week on the next week's first paint; one day missed → Strong Week; two missed → nothing; one skipped, rest done → Amazing |
| **SC-416** no stranger's data | Zero rows per path | `curl` the REST endpoint for each of the four tables and the view with the publishable key and no session → `401`/`42501`; a second household's member sees `[]` |
| **SC-417** four viewports | Columns as the space allows; 44 pt; the phone pages | 1920×1080, 1180×820, 820×1180, 390×844 on `/family/rewards` — the same fit as the Tasks board; every Redeem button and switch ≥ 44×44 |
| **SC-418** SC-319 inverted | Chip on valued cards, none on others; pill on every Profile column, none on Up for Grabs; four template fields; placeholder gone | Audit the board, a 0-star card, the Up for Grabs header, the template edit form, and `/family/rewards` |
| **SC-419** deleting a Profile | The forfeited count in the dialog; shared rewards survive | Throwaway Profile with 12 stars, eligible for Ice cream: the dialog says 12 stars are forfeited; after, Ice cream is still on Cleo's column at her own progress |

### Load-bearing FR spot-checks

- **FR-405/406**: a late chore due Tuesday and ticked Friday credits **Friday** — Friday's pill
  includes it, Tuesday's does not. An unclaimed up-for-grabs occurrence credits nobody until
  claimed; then the credited Profile.
- **FR-407**: the pill reads today's net; Previous shows yesterday's; the balance on Rewards is a
  different number.
- **FR-408 / Assumption 5**: earn 20, redeem 20, un-tick → balance −20, Redeem hidden, no error.
- **FR-425/426**: a redeemed one-time card is absent until the Redeemed switch is on; the switch
  is per device and off by default.
- **FR-427**: card order — affordable first, then cheaper, then older; redeemed last.
- **FR-436**: an adjustment of 0, 501 or −501 is refused by the form; a valid one for three
  Profiles where one would overdraw writes nothing.
- **FR-439**: the emoji rain's "every" is the counters' denominator: a skipped occurrence does not
  hold the rain back, a hidden one does not either.
- **FR-443**: the delete dialog's third sentence, and a reward left with nobody disappears.

## Automated checks — which suite covers what

| Guarantee | Suite |
|---|---|
| SC-402/403/405 trigger truth, SC-408/409/411/412 money rules, SC-416, SC-419 cascades, the privilege delta | `lib/family/__tests__/policies/rewards-schema.test.ts`, `rewards-access.test.ts`, `rewards-actions.test.ts`, `privileges.test.ts` |
| SC-407 the four-check matrix, the six operations | `lib/family/__tests__/unit/permissions.test.ts` |
| SC-413/414/415 the verdicts | `lib/family/__tests__/unit/rewards-celebrations.test.ts`; the mounting rule in `TasksBoard.test.tsx`, `RewardsBoard.test.tsx` |
| SC-401/418 the chip, the pill, the field, the pre-fill | `TaskCard.test.tsx`, `ColumnHeader.test.tsx`, `TaskForm.test.tsx`, `TaskBoxSheet.test.tsx` |
| SC-410 bar/button/muted card | `RewardCard.test.tsx`, `lib/family/__tests__/unit/rewards-progress.test.ts` |
| SC-404, SC-417, the feel of the three celebrations | by hand |

## Quality gates

`npm run fallow:audit` (with the new zone), `npm test`, `npm run typecheck`, `npm run lint` — all
green before every commit; no suppressions.

## Common problems

- **A tick earns nothing**: the task's `reward_points` is null or 0 — the chip is absent for the
  same reason. Set a value on the form.
- **Redeem is missing on an affordable reward**: the balance is being read from a stale cache —
  the realtime channel must be up (`[family] realtime channel` in the console) — or the Profile is
  not eligible.
- **"already redeemed" on a renewing reward**: it is not renewing; check the switch on the card's
  details.
- **The week message never shows**: the routine is not tracked, or the week has not rolled over in
  the household zone; the verdict is judged at the rollover, not on the seventh tick.
