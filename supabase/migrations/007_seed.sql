-- 007_seed.sql — the one household and its settings row. Nothing else.
-- Serves: FR-002 (a single pre-provisioned household), D7 (no emails, no names committed —
-- constitution §VII). People (allowlist emails, profiles, labels) are added by
-- scripts/family-seed.mjs (`npm run family:seed`), never by a migration.
--
-- The id is fixed so the seed script, the policy suite and operator SQL can refer to it.

insert into family.households (id, name)
values ('00000000-0000-4000-8000-000000000001', 'Our Family')
on conflict (id) do nothing;

insert into family.household_settings (household_id)
values ('00000000-0000-4000-8000-000000000001')
on conflict (household_id) do nothing;
