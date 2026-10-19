import { test } from "node:test";
import assert from "node:assert/strict";
import { createSharedReader } from "../src/shared-reader.js";

const row = (revision) => ({
  revision,
  payload: { players: [{ name: `Player ${revision}` }], sessions: [] },
  clip_manifest: [],
});

test("shared reads combine concurrent requests, reuse recent data, and fetch only a revision when unchanged", async () => {
  let time = 0;
  let server = row(0);
  const calls = [];
  const reader = createSharedReader(
    async (columns) => {
      calls.push(columns);
      return columns === "revision" ? { revision: server.revision } : server;
    },
    { now: () => time },
  );
  const [a, b] = await Promise.all([reader.read(), reader.read()]);
  assert.equal(a, b);
  assert.equal(calls.length, 1);
  time = 100;
  assert.equal(await reader.read(), a);
  assert.equal(calls.length, 1);
  time = 60000;
  assert.equal(await reader.read(), a);
  assert.deepEqual(calls, ["payload, revision, clip_manifest", "revision"]);
  server = row(1);
  time = 120000;
  assert.equal((await reader.read()).revision, 1);
  assert.deepEqual(calls.slice(-2), [
    "revision",
    "payload, revision, clip_manifest",
  ]);
});

test("a stale in-flight response cannot replace a newer successful save", async () => {
  let release;
  const reader = createSharedReader(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  const waiting = reader.read();
  reader.remember(row(2));
  release(row(1));
  assert.equal((await waiting).revision, 2);
  assert.equal(reader.peek().revision, 2);
});

test("uncertain-save confirmation bypasses both the cache and an earlier in-flight request", async () => {
  let time = 0;
  let release;
  let calls = 0;
  const reader = createSharedReader(
    async (columns) => {
      calls++;
      if (calls === 1) return row(0);
      if (columns === "revision")
        return new Promise((resolve) => {
          release = resolve;
        });
      return row(1);
    },
    { now: () => time },
  );
  await reader.read();
  time = 6000;
  const earlier = reader.read();
  const confirmed = await reader.read({ fresh: true });
  assert.equal(confirmed.revision, 1);
  release({ revision: 0 });
  assert.equal((await earlier).revision, 1);
  assert.equal(reader.peek().revision, 1);
});

test("failed reads are retryable and saved snapshots notify subscribers without another request", async () => {
  let calls = 0;
  const changes = [];
  const reader = createSharedReader(
    async () => {
      calls++;
      if (calls === 1) throw new Error("offline");
      return row(0);
    },
    { onChange: (next) => changes.push(next.revision) },
  );
  await assert.rejects(reader.read(), /offline/);
  await reader.read();
  reader.remember(row(1));
  reader.remember(row(0));
  assert.equal((await reader.read()).revision, 1);
  assert.equal(calls, 2);
  assert.deepEqual(changes, [0, 1]);
});
