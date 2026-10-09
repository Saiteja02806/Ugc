import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
await db.exec("create role anon; create role authenticated; create role service_role bypassrls;");
await db.exec(await readFile(new URL("../../supabase/migrations/20261005042533_audio_voice_bookmarks.sql", import.meta.url), "utf8"));
await db.exec(await readFile(new URL("../../supabase/migrations/20261005090038_audio_voice_selection.sql", import.meta.url), "utf8"));
after(() => db.close());

test("Use It preferences deny direct clients and replace only one verified owner's selection", async () => {
  const privileges = (await db.query(`select relrowsecurity,
    has_table_privilege('anon','public.audio_voice_preferences','SELECT') as anon_read,
    has_table_privilege('authenticated','public.audio_voice_preferences','UPDATE') as client_write,
    has_table_privilege('service_role','public.audio_voice_preferences','UPDATE') as server_write
    from pg_class where oid='public.audio_voice_preferences'::regclass`)).rows[0];
  assert.deepEqual(privileges, { relrowsecurity: true, anon_read: false, client_write: false, server_write: true });
  await db.exec("insert into public.audio_voice_preferences values ('alice','first'),('bob','bob-voice');");
  await db.exec("set role service_role; insert into public.audio_voice_preferences values ('alice','second') on conflict(user_id) do update set voice_id=excluded.voice_id; reset role;");
  assert.deepEqual((await db.query("select * from public.audio_voice_preferences order by user_id")).rows, [
    { user_id: "alice", voice_id: "second" }, { user_id: "bob", voice_id: "bob-voice" },
  ]);
});

test("bookmark table denies direct clients and exposes only needed server privileges", async () => {
  const rows = (await db.query(`select relrowsecurity from pg_class where oid='public.audio_voice_bookmarks'::regclass`)).rows;
  assert.equal(rows[0].relrowsecurity, true);
  for (const role of ["anon", "authenticated"]) {
    for (const privilege of ["select", "insert", "update", "delete", "truncate"]) {
      assert.equal((await db.query("select has_table_privilege($1,'public.audio_voice_bookmarks',$2) as allowed", [role, privilege])).rows[0].allowed, false);
    }
    await db.exec(`set role ${role}`);
    await assert.rejects(db.query("select * from public.audio_voice_bookmarks"), /permission denied/);
    await db.exec("reset role");
  }
  for (const privilege of ["select", "insert", "delete"]) {
    assert.equal((await db.query("select has_table_privilege('service_role','public.audio_voice_bookmarks',$1) as allowed", [privilege])).rows[0].allowed, true);
  }
  assert.equal((await db.query("select has_table_privilege('service_role','public.audio_voice_bookmarks','update') as allowed")).rows[0].allowed, false);
});

test("account bookmark writes are idempotent and scoped deletes preserve other owners", async () => {
  await db.exec("set role service_role");
  const save = (uid, id) => db.query("insert into public.audio_voice_bookmarks(user_id,voice_id) values($1,$2) on conflict(user_id,voice_id) do nothing", [uid, id]);
  await save("alice", "public-voice"); await save("alice", "public-voice"); await save("bob", "public-voice");
  assert.equal((await db.query("select count(*)::int as count from public.audio_voice_bookmarks where user_id='alice'")).rows[0].count, 1);
  assert.ok((await db.query("select created_at from public.audio_voice_bookmarks where user_id='alice'")).rows[0].created_at);
  await db.query("delete from public.audio_voice_bookmarks where user_id=$1 and voice_id=$2", ["alice", "public-voice"]);
  assert.deepEqual((await db.query("select user_id,voice_id from public.audio_voice_bookmarks")).rows, [{ user_id: "bob", voice_id: "public-voice" }]);
  await db.exec("reset role");
});

test("bookmark constraints reject empty owners, overlong IDs and provider URLs", async () => {
  for (const [uid, voiceId] of [["", "voice"], ["x".repeat(129), "voice"], ["alice", "x".repeat(101)], ["alice", "https://example.invalid/voice"], ["alice", ""]]) {
    await assert.rejects(db.query("insert into public.audio_voice_bookmarks(user_id,voice_id) values($1,$2)", [uid, voiceId]), /check constraint/);
  }
});
