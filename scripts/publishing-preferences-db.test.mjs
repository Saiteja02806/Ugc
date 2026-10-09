import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

test("publishing preference migration isolates account rows and denies direct browser access", async () => {
  const db = new PGlite();
  try {
    await db.exec("create role anon; create role authenticated; create role service_role bypassrls; grant usage on schema public to service_role;");
    await db.exec(await readFile(new URL("../supabase/migrations/20261009204135_account_publishing_preferences.sql", import.meta.url), "utf8"));
    await db.exec("set role service_role");
    await db.query("insert into public.user_publishing_preferences(user_id) values ($1)", ["owner-a"]);
    await db.query("insert into public.user_publishing_preferences(user_id,contains_synthetic_media) values ($1,$2) on conflict(user_id) do update set contains_synthetic_media=excluded.contains_synthetic_media", ["owner-a", false]);
    await db.query("insert into public.user_publishing_preferences(user_id) values ($1)", ["owner-b"]);
    assert.deepEqual((await db.query("select user_id,contains_synthetic_media from public.user_publishing_preferences order by user_id")).rows, [{user_id:"owner-a",contains_synthetic_media:false},{user_id:"owner-b",contains_synthetic_media:true}]);
    await db.exec("reset role");
    assert.equal((await db.query("select relrowsecurity from pg_class where oid='public.user_publishing_preferences'::regclass")).rows[0].relrowsecurity, true);
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`set role ${role}`);
      await assert.rejects(db.query("select * from public.user_publishing_preferences"), /permission denied/);
      await assert.rejects(db.query("insert into public.user_publishing_preferences(user_id) values ('intruder')"), /permission denied/);
      await db.exec("reset role");
    }
  } finally { await db.close(); }
});
