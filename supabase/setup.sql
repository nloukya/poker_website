-- Run this once in your own Supabase project's SQL Editor.
-- Running it again preserves existing members, records, and videos.
begin;

create table if not exists public.club_members (
  email text primary key check (email = lower(email))
);
alter table public.club_members enable row level security;
revoke all on public.club_members from anon, authenticated;
grant select on public.club_members to authenticated;
drop policy if exists "Read own membership" on public.club_members;
create policy "Read own membership" on public.club_members for select to authenticated
using (email = lower(auth.jwt() ->> 'email'));

create or replace function public.is_club_member() returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.club_members where email = lower(auth.jwt() ->> 'email')) $$;
revoke all on function public.is_club_member() from public, anon;
grant execute on function public.is_club_member() to authenticated;

create table if not exists public.club_state (
  id integer primary key check (id = 1),
  payload jsonb not null,
  revision bigint not null default 0,
  clip_manifest jsonb not null default '[]'::jsonb
);
alter table public.club_state enable row level security;
revoke all on public.club_state from anon, authenticated;
grant select on public.club_state to anon, authenticated;
drop policy if exists "Members read shared table" on public.club_state;
drop policy if exists "Anyone reads shared table" on public.club_state;
create policy "Anyone reads shared table" on public.club_state for select to anon, authenticated
using (true);

insert into public.club_state(id, payload) values
(1, '{"version":1,"currency":"INR","players":[],"sessions":[],"demo":false}')
on conflict(id) do nothing;

-- Compare-and-swap prevents a stale phone from overwriting another friend's save.
-- Results and video metadata commit in the same transaction.
create or replace function public.save_club_state(
  expected_revision bigint,
  new_payload jsonb,
  clip_session text default null,
  new_clips jsonb default '[]'::jsonb,
  removed_clip_ids text[] default '{}'
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  current_row public.club_state%rowtype;
  manifest jsonb;
begin
  if auth.uid() is null or not public.is_club_member() then
    raise exception 'NOT_AUTHORIZED' using errcode = '42501';
  end if;
  if new_payload is null
    or (new_payload ->> 'version') is distinct from '1'
    or jsonb_typeof(new_payload -> 'players') is distinct from 'array'
    or jsonb_typeof(new_payload -> 'sessions') is distinct from 'array'
    or coalesce(new_payload ->> 'currency', '') not in ('INR','USD','EUR','GBP')
    or octet_length(new_payload::text) > 10485760
    or jsonb_typeof(new_clips) is distinct from 'array'
  then raise exception 'INVALID_PAYLOAD'; end if;

  select * into current_row from public.club_state where id = 1 for update;
  if not found then raise exception 'TABLE_NOT_INITIALIZED'; end if;
  if expected_revision is null or current_row.revision <> expected_revision then
    raise exception 'TABLE_CHANGED' using errcode = '40001';
  end if;

  if clip_session is not null then
    if not exists (select 1 from jsonb_array_elements(new_payload -> 'sessions') s where s ->> 'id' = clip_session)
    then raise exception 'SESSION_NOT_FOUND'; end if;
    if exists (select 1 from jsonb_array_elements(new_clips) c where
      c ->> 'sessionId' is distinct from clip_session
      or coalesce(c ->> 'id', '') = '' or coalesce(c ->> 'path', '') = ''
      or coalesce(c ->> 'name', '') = ''
      or coalesce((c ->> 'size')::bigint, 0) not between 1 and 52428800
    ) then raise exception 'INVALID_CLIPS'; end if;
  elsif jsonb_array_length(new_clips) > 0 or cardinality(removed_clip_ids) > 0 then
    raise exception 'SESSION_REQUIRED';
  end if;

  select coalesce(jsonb_agg(c), '[]'::jsonb) into manifest
  from jsonb_array_elements(current_row.clip_manifest) c
  where exists (select 1 from jsonb_array_elements(new_payload -> 'sessions') s where s ->> 'id' = c ->> 'sessionId')
    and not (c ->> 'sessionId' = coalesce(clip_session, '') and c ->> 'id' = any(removed_clip_ids));
  manifest := manifest || new_clips;
  if (select count(*) <> count(distinct c ->> 'id') or count(*) <> count(distinct c ->> 'path') from jsonb_array_elements(manifest) c)
  then raise exception 'DUPLICATE_CLIP'; end if;

  update public.club_state set payload = new_payload, revision = revision + 1, clip_manifest = manifest where id = 1
  returning * into current_row;
  return jsonb_build_object('payload', current_row.payload, 'revision', current_row.revision, 'clip_manifest', current_row.clip_manifest);
end;
$$;
revoke all on function public.save_club_state(bigint, jsonb, text, jsonb, text[]) from public, anon;
grant execute on function public.save_club_state(bigint, jsonb, text, jsonb, text[]) to authenticated;

-- Anyone can watch clips; only approved club members can upload or delete them.
insert into storage.buckets(id, name, public, file_size_limit)
values ('highlights', 'highlights', false, 52428800)
on conflict(id) do update set public = false, file_size_limit = 52428800;
drop policy if exists "Members read highlights" on storage.objects;
drop policy if exists "Anyone reads highlights" on storage.objects;
create policy "Anyone reads highlights" on storage.objects for select to anon, authenticated
using (bucket_id = 'highlights');
drop policy if exists "Members upload highlights" on storage.objects;
create policy "Members upload highlights" on storage.objects for insert to authenticated
with check (bucket_id = 'highlights' and public.is_club_member());
drop policy if exists "Members delete highlights" on storage.objects;
create policy "Members delete highlights" on storage.objects for delete to authenticated
using (bucket_id = 'highlights' and public.is_club_member());
commit;

-- After creating users in Authentication > Users, add their emails below.
-- Replace these examples before running this separate statement:
-- insert into public.club_members(email) values ('you@example.com'), ('friend@example.com')
-- on conflict do nothing;
