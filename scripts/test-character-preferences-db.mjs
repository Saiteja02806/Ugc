import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
await db.exec("create role anon; create role authenticated; create role service_role bypassrls;");
await db.exec(await readFile(new URL("../supabase/migrations/20261002200207_character_preferences.sql", import.meta.url), "utf8"));
after(async () => { await db.close(); });

const read = async (owner) => (await db.query("select * from public.character_preferences where user_id = $1", [owner])).rows[0] ?? null;
const skip = async (owner) => db.query("insert into public.character_preferences (user_id) values ($1) on conflict (user_id) do nothing", [owner]);
const gender = async (owner, value) => db.query("insert into public.character_preferences (user_id, gender) values ($1, $2) on conflict (user_id) do update set gender = excluded.gender", [owner, value]);

test("skip is once per account; gender updates preserve initial seen timestamp and skips preserve gender", async () => {
  await skip("skip-owner");
  const initial = await read("skip-owner");
  assert.equal(initial.gender, null);
  assert.ok(initial.seen_at);
  await gender("skip-owner", "female");
  await skip("skip-owner");
  await skip("skip-owner");
  const saved = await read("skip-owner");
  assert.equal(saved.gender, "female");
  assert.equal(saved.seen_at.getTime(), initial.seen_at.getTime());
  assert.equal((await db.query("select count(*)::int as n from public.character_preferences where user_id='skip-owner'")).rows[0].n, 1);
  await gender("skip-owner", "male");
  assert.equal((await read("skip-owner")).gender, "male");
});

test("concurrent explicit preference and skipped onboarding cannot erase the selected gender", async () => {
  await Promise.all([gender("race-owner", "female"), skip("race-owner")]);
  assert.equal((await read("race-owner")).gender, "female");
  await Promise.all([skip("reverse-race-owner"), gender("reverse-race-owner", "male")]);
  assert.equal((await read("reverse-race-owner")).gender, "male");
});

test("database constraints reject duplicate owners, invalid genders, blank owners and missing timestamps", async () => {
  await gender("constraint-owner", "female");
  await assert.rejects(db.query("insert into public.character_preferences(user_id) values('constraint-owner')"), /duplicate key/);
  await assert.rejects(db.query("insert into public.character_preferences(user_id,gender) values('invalid-gender','other')"), /check constraint/);
  await assert.rejects(db.query("insert into public.character_preferences(user_id) values('   ')"), /check constraint/);
  await assert.rejects(db.query("insert into public.character_preferences(user_id,seen_at) values('no-timestamp',null)"), /not-null constraint/);
});

test("preferences table enables RLS and grants service only select/insert/update", async () => {
  const table = (await db.query("select relrowsecurity from pg_class where oid='public.character_preferences'::regclass")).rows[0];
  assert.equal(table.relrowsecurity, true);
  for (const role of ["anon", "authenticated"]) {
    for (const privilege of ["SELECT", "INSERT", "UPDATE", "DELETE"]) {
      const result = (await db.query("select has_table_privilege($1,'public.character_preferences',$2) as permitted", [role, privilege])).rows[0];
      assert.equal(result.permitted, false, `${role} must not have ${privilege}`);
    }
  }
  for (const privilege of ["SELECT", "INSERT", "UPDATE"]) {
    assert.equal((await db.query("select has_table_privilege('service_role','public.character_preferences',$1) as permitted", [privilege])).rows[0].permitted, true);
  }
  assert.equal((await db.query("select has_table_privilege('service_role','public.character_preferences','DELETE') as permitted")).rows[0].permitted, false);
  assert.equal((await db.query("select count(*)::int as n from pg_policies where tablename='character_preferences'")).rows[0].n, 0);
});

test("browser roles cannot query or mutate preferences; service role can access owner-scoped rows", async () => {
  for (const role of ["anon", "authenticated"]) {
    await db.exec(`set role ${role}`);
    try {
      await assert.rejects(db.query("select * from public.character_preferences"), /permission denied/);
      await assert.rejects(db.query("insert into public.character_preferences(user_id) values('browser-write')"), /permission denied/);
      await assert.rejects(db.query("update public.character_preferences set gender='male'"), /permission denied/);
    } finally { await db.exec("reset role"); }
  }
  await db.exec("set role service_role");
  try {
    await gender("service-owner", "female");
    assert.equal((await read("service-owner")).gender, "female");
    assert.equal(await read("nonexistent-owner"), null);
  } finally { await db.exec("reset role"); }
});
