import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

let db;
const bucket = (character, overrides = {}) => ({ key: character.repeat(64), window_seconds: 3600, max_requests: 3, cooldown_seconds: 0, ...overrides });
const consume = async (buckets) => (await db.query("SELECT public.consume_auth_email_limits($1::jsonb) AS result", [JSON.stringify(buckets)])).rows[0].result;

before(async () => {
  db = new PGlite();
  await db.exec("CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;");
  await db.exec(await readFile(new URL("../../supabase/migrations/20260930160000_auth_email_rate_limits.sql", import.meta.url), "utf8"));
});
beforeEach(async () => { await db.exec("TRUNCATE public.auth_email_rate_limits"); });
after(async () => { await db?.close(); });

test("rate-limit storage and RPC are restricted to the server role", async () => {
  for (const role of ["anon", "authenticated"]) {
    const { rows } = await db.query("SELECT has_table_privilege($1, 'public.auth_email_rate_limits', 'SELECT') AS can_read, has_function_privilege($1, 'public.consume_auth_email_limits(jsonb)', 'EXECUTE') AS can_execute", [role]);
    assert.deepEqual(rows[0], { can_read: false, can_execute: false });
    await db.exec(`SET ROLE ${role}`);
    try { await assert.rejects(consume([bucket("a")])); }
    finally { await db.exec("RESET ROLE"); }
  }
  const { rows } = await db.query("SELECT relrowsecurity FROM pg_class WHERE oid='public.auth_email_rate_limits'::regclass");
  assert.equal(rows[0].relrowsecurity, true);
  await db.exec("SET ROLE service_role");
  try { assert.equal((await consume([bucket("a")])).allowed, true); }
  finally { await db.exec("RESET ROLE"); }
});

test("a rapid resend is denied with a cooldown", async () => {
  const buckets = [bucket("a", { cooldown_seconds: 60 }), bucket("b")];
  assert.equal((await consume(buckets)).allowed, true);
  const denied = await consume(buckets);
  assert.equal(denied.allowed, false);
  assert.ok(denied.retry_after > 0 && denied.retry_after <= 60);
  const counts = await db.query("SELECT request_count FROM public.auth_email_rate_limits ORDER BY bucket_hash");
  assert.deepEqual(counts.rows.map((row) => row.request_count), [1, 1]);
});

test("all counters stay unchanged if any budget is exhausted", async () => {
  assert.equal((await consume([bucket("b", { max_requests: 1 })])).allowed, true);
  const denied = await consume([bucket("a"), bucket("b", { max_requests: 1 })]);
  assert.equal(denied.allowed, false);
  const counts = await db.query("SELECT request_count FROM public.auth_email_rate_limits ORDER BY bucket_hash");
  assert.deepEqual(counts.rows.map((row) => row.request_count), [0, 1]);
});

test("an expired window resets its count and cooldown", async () => {
  const buckets = [bucket("a", { max_requests: 1, cooldown_seconds: 60 })];
  await consume(buckets);
  await db.exec("UPDATE public.auth_email_rate_limits SET expires_at=now()-interval '1 second'");
  assert.equal((await consume(buckets)).allowed, true);
  const count = await db.query("SELECT request_count FROM public.auth_email_rate_limits");
  assert.equal(count.rows[0].request_count, 1);
});

test("simultaneous requests cannot consume beyond the fixed budget", async () => {
  const responses = await Promise.all(Array.from({ length: 10 }, () => consume([bucket("a", { max_requests: 3 })])));
  assert.equal(responses.filter((response) => response.allowed).length, 3);
});

test("invalid and duplicate buckets fail without spending a budget", async () => {
  for (const value of [null, {}, [], [bucket("a"), bucket("a")], [bucket("a", { key: "plaintext@email.com" })], [bucket("a", { max_requests: 0 })], [bucket("a", { cooldown_seconds: 4000 })]]) {
    await assert.rejects(consume(value));
  }
  const count = await db.query("SELECT count(*)::int AS count FROM public.auth_email_rate_limits");
  assert.equal(count.rows[0].count, 0);
});
