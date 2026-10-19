import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const db = new PGlite();
await db.exec(`
create role anon; create role authenticated;
create schema auth;
create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb$$;
create function auth.uid() returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;
grant usage on schema auth to anon, authenticated;
create schema storage;
create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint);
create table storage.objects(id text primary key, bucket_id text, name text);
alter table storage.objects enable row level security;
grant usage on schema storage to anon, authenticated;
grant select,insert,delete on storage.objects to anon, authenticated;
`);
const sql = await readFile(
  new URL("../supabase/setup.sql", import.meta.url),
  "utf8",
);
await db.exec(sql);
await db.exec(sql); // Setup must also preserve an existing project.
await db.exec(`insert into public.club_members values ('owner@example.com');`);
const user = async (email) => {
  await db.exec("reset role");
  await db.query(`select set_config('request.jwt.claims', $1, false)`, [
    JSON.stringify({ email, sub: "00000000-0000-0000-0000-000000000001" }),
  ]);
  await db.exec("set role authenticated");
};
const payload = {
  version: 1,
  currency: "INR",
  players: [{ id: "p1", name: "One", tagline: "" }],
  sessions: [],
  demo: false,
};
const save = async (
  rev,
  body = payload,
  session = null,
  clips = [],
  removed = [],
) =>
  (
    await db.query("select public.save_club_state($1,$2,$3,$4,$5) as row", [
      rev,
      JSON.stringify(body),
      session,
      JSON.stringify(clips),
      removed,
    ])
  ).rows[0].row;
await user("outsider@example.com");
assert.equal(
  (await db.query("select * from public.club_state")).rows.length,
  1,
);
await assert.rejects(save(0), /NOT_AUTHORIZED/);
await assert.rejects(
  db.query(`insert into storage.objects values ('x','highlights','bad')`),
  /row-level security/,
);
await user("owner@example.com");
assert.equal(
  (await db.query("select * from public.club_state")).rows.length,
  1,
);
await assert.rejects(
  db.query(`update public.club_state set revision=3`),
  /permission denied/,
);
let row = await save(0);
assert.equal(row.revision, 1);
assert.equal(row.payload.players[0].name, "One");
await assert.rejects(save(0), /TABLE_CHANGED/);
assert.equal(
  (await db.query("select revision from public.club_state")).rows[0].revision,
  1,
);
await assert.rejects(save(1, { version: 1 }), /INVALID_PAYLOAD/);
const withSession = { ...payload, sessions: [{ id: "s1" }] };
const clip = {
  id: "c1",
  sessionId: "s1",
  path: "clip.webm",
  size: 100,
  name: "round.webm",
  type: "video/webm",
  createdAt: 1,
};
row = await save(1, withSession, "s1", [clip]);
assert.equal(row.clip_manifest.length, 1);
await assert.rejects(save(1, payload), /TABLE_CHANGED/);
assert.equal(
  (await db.query("select clip_manifest from public.club_state")).rows[0]
    .clip_manifest.length,
  1,
);
await assert.rejects(save(2, withSession, "s1", [clip]), /DUPLICATE_CLIP/);
await assert.rejects(
  save(2, withSession, "missing", [{ ...clip, id: "c2" }]),
  /SESSION_NOT_FOUND/,
);
row = await save(2, payload);
assert.equal(row.clip_manifest.length, 0);
await db.query(
  `insert into storage.objects values ('x','highlights','clip.webm')`,
);
assert.equal((await db.query("select * from storage.objects")).rows.length, 1);
await user("outsider@example.com");
assert.equal((await db.query("select * from storage.objects")).rows.length, 1);
assert.equal(
  (await db.query(`delete from storage.objects returning id`)).rows.length,
  0,
);
await db.exec("reset role");
await db.query("select set_config('request.jwt.claims', '{}', false)");
await db.exec("set role anon");
assert.equal(
  (await db.query("select * from public.club_state")).rows.length,
  1,
);
assert.equal((await db.query("select * from storage.objects")).rows.length, 1);
await assert.rejects(save(3), /permission denied/);
await assert.rejects(
  db.query("update public.club_state set revision=99"),
  /permission denied/,
);
await assert.rejects(
  db.query("select * from public.club_members"),
  /permission denied/,
);
await assert.rejects(
  db.query("insert into storage.objects values ('guest','highlights','bad')"),
  /row-level security/,
);
assert.equal(
  (await db.query("delete from storage.objects returning id")).rows.length,
  0,
);
await db.exec("reset role");
// Re-create the earlier private-view policies to exercise the actual upgrade.
await db.exec(`
revoke select on public.club_state from anon;
drop policy "Anyone reads shared table" on public.club_state;
create policy "Members read shared table" on public.club_state for select to authenticated using (public.is_club_member());
drop policy "Anyone reads highlights" on storage.objects;
create policy "Members read highlights" on storage.objects for select to authenticated using (bucket_id = 'highlights' and public.is_club_member());
`);
const upgrade = await readFile(
  new URL("../supabase/public-view.sql", import.meta.url),
  "utf8",
);
await db.exec(upgrade);
await db.exec(upgrade);
await db.exec("set role anon");
assert.equal((await db.query("select * from public.club_state")).rows.length, 1);
assert.equal((await db.query("select * from storage.objects")).rows.length, 1);
await assert.rejects(save(3), /permission denied/);
await db.exec("reset role");
assert.equal((await db.query("select * from storage.objects")).rows.length, 1);
await db.exec(sql);
assert.equal(
  (await db.query("select revision from public.club_state")).rows[0].revision,
  3,
);
console.log(
  "PASS: schema is repeatable; public viewing, restricted editing/media uploads, atomic saves, conflicts, invalid writes, and manifest pruning verified in PostgreSQL.",
);
await db.close();
