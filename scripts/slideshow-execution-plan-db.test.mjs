import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

test("slide plans are private, owner scoped, immutable on replay and distinct from rewrite receipts", async () => {
  const db = new PGlite();
  try {
    await db.exec("create role anon; create role authenticated; create role service_role bypassrls;");
    await db.exec(readFileSync(new URL("../supabase/migrations/20261022092140_slideshow_execution_plans.sql", import.meta.url), "utf8"));
    const key = "00000000-0000-4000-8000-000000000001";
    const claim = (owner, hash = "a".repeat(64)) => db.query("select public.explore_claim_slideshow_plan($1,$2,$3,$4) as receipt", [owner, key, hash, { version: 1, prompt: "source 4" }]);
    await db.exec("set role service_role");
    assert.equal((await claim("owner-a")).rows[0].receipt.claimed, true);
    assert.equal((await claim("owner-a")).rows[0].receipt.status, "pending");
    assert.equal((await claim("owner-b")).rows[0].receipt.claimed, true);
    await assert.rejects(claim("owner-a", "b".repeat(64)), /slideshow_plan_conflict/);
    const output = { version: 1, slides: [{ targetId: "source:4" }] };
    await db.query("update public.explore_slideshow_plans set status='completed', output_json=$1 where user_id=$2 and request_key=$3", [output, "owner-a", key]);
    assert.deepEqual((await claim("owner-a")).rows[0].receipt.output, output);
    await db.query("update public.explore_slideshow_plans set created_at=now()-interval '6 minutes' where user_id='owner-b' and request_key=$1", [key]);
    assert.equal((await claim("owner-b")).rows[0].receipt.status, "failed", "An interrupted plan can be cleared without repeating its paid call");
    const lateSave = await db.query("update public.explore_slideshow_plans set status='completed', output_json=$1 where user_id='owner-b' and request_key=$2 and status='pending' returning request_key", [output, key]);
    assert.equal(lateSave.rows.length, 0, "A late planner cannot admit images after its receipt expired");
    await db.exec("reset role");
    assert.equal((await db.query("select relrowsecurity from pg_class where oid='public.explore_slideshow_plans'::regclass")).rows[0].relrowsecurity, true);
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`set role ${role}`);
      for (const sql of ["select * from public.explore_slideshow_plans", "delete from public.explore_slideshow_plans", "update public.explore_slideshow_plans set status='failed'"]) await assert.rejects(db.query(sql), /permission denied/);
      await assert.rejects(db.query("insert into public.explore_slideshow_plans(user_id,request_key,payload_hash,input_json) values($1,$2,$3,$4)", ["intruder", key, "a".repeat(64), {}]), /permission denied/);
      await assert.rejects(claim("owner-a"), /permission denied/);
      await db.exec("reset role");
    }
    assert.equal((await db.query("select prosecdef from pg_proc where oid='public.explore_claim_slideshow_plan(text,uuid,text,jsonb)'::regprocedure")).rows[0].prosecdef, false);
  } finally { await db.close(); }
});
