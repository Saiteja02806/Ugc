import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

test("migration enforces private receipts, atomic replays, conflicts and owner-specific quota", async () => {
  const db = new PGlite();
  try {
    await db.exec("create role anon; create role authenticated; create role service_role bypassrls;");
    await db.exec(readFileSync(new URL("../supabase/migrations/20261016133514_slideshow_prompt_improvements.sql", import.meta.url), "utf8"));
    const key = index => `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
    const claim = (owner, index, hash = "a".repeat(64)) => db.query("select public.explore_claim_slideshow_prompt($1,$2,$3,$4) as receipt", [owner, key(index), hash, { prompt: "original", promptVersion: 2 }]);
    await db.exec("set role service_role");
    assert.equal((await claim("owner-a", 1)).rows[0].receipt.claimed, true);
    assert.equal((await claim("owner-a", 1)).rows[0].receipt.claimed, false);
    await assert.rejects(claim("owner-a", 1, "b".repeat(64)), /prompt_request_conflict/);
    await db.query("update public.explore_slideshow_prompts set status='completed', output_json=$1 where user_id='owner-a' and request_key=$2", [{ version: 1 }, key(1)]);
    assert.deepEqual((await claim("owner-a", 1)).rows[0].receipt.output, { version: 1 });
    for (let index = 2; index <= 20; index++) assert.equal((await claim("owner-a", index)).rows[0].receipt.claimed, true);
    await assert.rejects(claim("owner-a", 21), /prompt_daily_limit/);
    assert.equal((await claim("owner-b", 1)).rows[0].receipt.claimed, true);
    assert.equal((await claim("owner-a", 1)).rows[0].receipt.claimed, false, "quota cannot prevent recovering an existing result");
    await db.exec("reset role");
    const security = (await db.query("select relrowsecurity from pg_class where oid='public.explore_slideshow_prompts'::regclass")).rows[0];
    assert.equal(security.relrowsecurity, true);
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`set role ${role}`);
      await assert.rejects(db.query("select * from public.explore_slideshow_prompts"), /permission denied/);
      await assert.rejects(claim("owner-a", 1), /permission denied/);
      await db.exec("reset role");
    }
    const invoker = (await db.query("select prosecdef from pg_proc where oid='public.explore_claim_slideshow_prompt(text,uuid,text,jsonb)'::regprocedure")).rows[0];
    assert.equal(invoker.prosecdef, false);
  } finally { await db.close(); }
});
