import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

test("publishing preference migration isolates account rows and denies direct browser access", async () => {
  const db = new PGlite();
  try {
    await db.exec("create role anon; create role authenticated; create role service_role bypassrls; grant usage on schema public to service_role;");
    await db.exec(await readFile(new URL("../supabase/migrations/20261009204135_account_publishing_preferences.sql", import.meta.url), "utf8"));
    await db.query("insert into public.user_publishing_preferences(user_id,contains_synthetic_media) values ('existing-owner',false)");
    await db.exec(await readFile(new URL("../supabase/migrations/20261012135300_expanded_account_publishing_defaults.sql", import.meta.url), "utf8"));
    assert.deepEqual((await db.query("select contains_synthetic_media,tiktok_privacy_level,tiktok_allow_comments,youtube_privacy_status,youtube_made_for_kids,youtube_notify_subscribers from public.user_publishing_preferences where user_id='existing-owner'")).rows, [{contains_synthetic_media:false,tiktok_privacy_level:"PUBLIC_TO_EVERYONE",tiktok_allow_comments:true,youtube_privacy_status:"public",youtube_made_for_kids:false,youtube_notify_subscribers:false}]);
    await db.exec("set role service_role");
    await db.query("insert into public.user_publishing_preferences(user_id) values ($1)", ["owner-a"]);
    await db.query("insert into public.user_publishing_preferences(user_id,contains_synthetic_media) values ($1,$2) on conflict(user_id) do update set contains_synthetic_media=excluded.contains_synthetic_media", ["owner-a", false]);
    await db.query("insert into public.user_publishing_preferences(user_id) values ($1)", ["owner-b"]);
    assert.deepEqual((await db.query("select user_id,contains_synthetic_media from public.user_publishing_preferences where user_id like 'owner-%' order by user_id")).rows, [{user_id:"owner-a",contains_synthetic_media:false},{user_id:"owner-b",contains_synthetic_media:true}]);
    await db.query("update public.user_publishing_preferences set tiktok_privacy_level='SELF_ONLY',tiktok_allow_comments=false,youtube_privacy_status='unlisted',youtube_made_for_kids=true where user_id='owner-a'");
    await db.query("insert into public.user_publishing_preferences(user_id,contains_synthetic_media) values ('owner-a',true) on conflict(user_id) do update set contains_synthetic_media=excluded.contains_synthetic_media");
    assert.deepEqual((await db.query("select contains_synthetic_media,tiktok_privacy_level,tiktok_allow_comments,youtube_privacy_status,youtube_made_for_kids from public.user_publishing_preferences where user_id='owner-a'")).rows, [{contains_synthetic_media:true,tiktok_privacy_level:"SELF_ONLY",tiktok_allow_comments:false,youtube_privacy_status:"unlisted",youtube_made_for_kids:true}]);
    await assert.rejects(db.query("update public.user_publishing_preferences set tiktok_privacy_level='everyone' where user_id='owner-a'"), /check constraint/);
    await assert.rejects(db.query("update public.user_publishing_preferences set youtube_privacy_status='everyone' where user_id='owner-a'"), /check constraint/);
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
