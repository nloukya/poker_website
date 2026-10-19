-- Upgrade an already configured soberSem3 table to viewing without sign-in.
-- Existing records and editor memberships are preserved.
begin;
grant select on public.club_state to anon, authenticated;
drop policy if exists "Members read shared table" on public.club_state;
drop policy if exists "Anyone reads shared table" on public.club_state;
create policy "Anyone reads shared table" on public.club_state
for select to anon, authenticated using (true);

drop policy if exists "Members read highlights" on storage.objects;
drop policy if exists "Anyone reads highlights" on storage.objects;
create policy "Anyone reads highlights" on storage.objects
for select to anon, authenticated using (bucket_id = 'highlights');
commit;
