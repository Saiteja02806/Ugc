import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

test("remix claims enforce ownership, idempotency, quota and browser denial", async () => {
  const db = new PGlite();
  const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  const hash = "a".repeat(64), input = { source: { referenceId: "original" }, businessContext: { businessName: "Private business" } };
  const claim = async (owner, n, fingerprint = hash) => (await db.query("select public.explore_claim_text_remix($1,$2,$3,$4) as result", [owner, id(n), fingerprint, input])).rows[0].result;
  try {
    await db.exec("create role anon; create role authenticated; create role service_role bypassrls; grant usage on schema public to service_role;");
    await db.exec(await readFile(new URL("../supabase/migrations/20261010151817_explore_reference_text_remix.sql", import.meta.url), "utf8"));
    await db.exec("set role service_role");
    assert.equal((await claim("owner-a", 1)).claimed, true);
    assert.equal((await claim("owner-a", 1)).claimed, false);
    await assert.rejects(claim("owner-a", 1, "b".repeat(64)), /remix_request_conflict/);
    assert.equal((await claim("owner-b", 1)).claimed, true);
    await db.query("update public.explore_text_remixes set status='completed',output_json=$1 where user_id=$2 and request_key=$3", [{ blocks: ["Adapted copy"], heading: "", body: "" }, "owner-a", id(1)]);
    const cached = await claim("owner-a", 1);
    assert.equal(cached.claimed, false); assert.equal(cached.status, "completed");
    assert.deepEqual(cached.output.blocks, ["Adapted copy"]); assert.deepEqual(cached.source, input.source);
    for (let n = 2; n <= 20; n++) await claim("owner-a", n);
    await assert.rejects(claim("owner-a", 21), /remix_daily_limit/);
    assert.equal((await claim("owner-b", 21)).claimed, true);
    assert.equal((await claim("owner-a", 1)).claimed, false, "existing receipt survives quota");
    await db.exec("update public.explore_text_remixes set created_at=now()-interval '25 hours' where user_id='owner-a'");
    assert.equal((await claim("owner-a", 21)).claimed, true);
    await assert.rejects(claim("", 22), /invalid_remix_request/);
    await assert.rejects(db.query("insert into public.explore_text_remixes(user_id,request_key,payload_hash,input_json,status) values($1,$2,$3,$4,'completed')", ["owner-x", id(99), hash, input]), /check constraint/);
    await db.exec("reset role");
    assert.equal((await db.query("select relrowsecurity from pg_class where oid='public.explore_text_remixes'::regclass")).rows[0].relrowsecurity, true);
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`set role ${role}`);
      await assert.rejects(db.query("select * from public.explore_text_remixes"), /permission denied/);
      await assert.rejects(claim("owner-a", 1), /permission denied/);
      await assert.rejects(db.query("update public.explore_text_remixes set status='failed'"), /permission denied/);
      await db.exec("reset role");
    }
  } finally { await db.close(); }
});
