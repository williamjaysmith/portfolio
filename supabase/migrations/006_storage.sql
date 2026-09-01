-- 006_storage.sql — the private `family-avatars` bucket and its read helper.
-- Serves: FR-021 (photo avatars), research R7, D16, security critique F8.
-- Contains no personal data.
--
-- The app never depends on the storage policy below: avatar reads use server-minted signed
-- URLs (admin client) and writes go through the admin client, so no insert/delete policy is
-- needed. On the hosted platform the `storage` schema is owned by supabase_storage_admin and
-- `postgres` may not be allowed to insert the bucket or create the policy — both statements
-- are therefore wrapped so a permission problem becomes a NOTICE, not a failed push. If you
-- see that notice, create the bucket (private, 5 MB, jpeg/png/webp) in Dashboard -> Storage.

-- Text comparison, never a cast: a non-uuid prefix (or an object in another bucket that is
-- evaluated first — Postgres does not promise AND short-circuit order) can never raise from
-- inside a policy. Object path convention: <household_id>/<profile_id>.<ext>.
create or replace function family.can_read_avatar(object_name text)
returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
      from family.household_users
     where user_id is not null
       and user_id = (select auth.uid())
       and household_id::text = split_part(object_name, '/', 1)
  );
$$;
revoke all on function family.can_read_avatar(text) from public;
grant execute on function family.can_read_avatar(text) to authenticated;

do $$
begin
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('family-avatars', 'family-avatars', false, 5242880,
          array['image/jpeg', 'image/png', 'image/webp'])
  on conflict (id) do nothing;
exception
  when insufficient_privilege or undefined_table then
    raise notice 'family: could not create bucket family-avatars here (%). Create it in Dashboard -> Storage: private, 5 MB, image/jpeg + image/png + image/webp.', sqlerrm;
end
$$;

do $$
begin
  drop policy if exists "members read avatars" on storage.objects;
  create policy "members read avatars" on storage.objects
    for select to authenticated
    using (bucket_id = 'family-avatars' and family.can_read_avatar(name));
exception
  when insufficient_privilege or undefined_table then
    raise notice 'family: could not create the storage read policy here (%). Not required — the app reads avatars through signed URLs.', sqlerrm;
end
$$;
