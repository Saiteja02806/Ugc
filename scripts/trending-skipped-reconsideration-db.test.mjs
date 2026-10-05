import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { after, before, test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

const sql = readFileSync(new URL("../supabase/migrations/20261005064026_trending_skipped_post_reconsideration.sql", import.meta.url), "utf8");
const formats = {
  carousel: ["user_carousel_assignments", "carousel_id", "pending", "accepted"],
  hook_video: ["user_hook_video_assignments", "hook_suggestion_id", "active", "selected"],
  wall_text: ["user_wall_text_assignments", "wall_text_creative_id", "active", "selected"],
  reaction: ["user_reaction_assignments", "reaction_creative_id", "active", "selected"],
};
let db;
before(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create table trending_creative_decisions (
      id uuid primary key default gen_random_uuid(), user_id text not null, format text not null,
      assignment_id uuid not null, creative_id uuid not null, decision text not null check(decision in ('accepted','rejected')),
      decided_at timestamptz not null default now(), created_at timestamptz not null default now(),
      unique(user_id,format,creative_id)
    );`);
  for (const [table, creativeColumn] of Object.values(formats)) {
    await db.exec(`create table ${table} (id uuid primary key, user_id text not null, ${creativeColumn} uuid not null,
      state text not null, completed_at timestamptz, last_opened_at timestamptz, completion_action text, updated_at timestamptz);`);
  }
  await db.exec(sql);
});
after(async () => db?.close());

async function fixture(format, state = formats[format][2]) {
  const [table, column] = formats[format];
  const owner = randomUUID(), assignment = randomUUID(), creative = randomUUID();
  await db.query(`insert into ${table}(id,user_id,${column},state) values($1,$2,$3,$4)`, [assignment,owner,creative,state]);
  return {
    params: [owner, format, assignment, creative],
    record: async decision => (await db.query("select * from record_trending_creative_decision($1,$2,$3,$4,$5)", [owner,format,assignment,creative,decision])).rows[0],
    reconsider: async () => (await db.query("select * from reconsider_skipped_trending_creative($1,$2,$3,$4)", [owner,format,assignment,creative])).rows[0],
    state: async () => (await db.query(`select state from ${table} where id=$1`, [assignment])).rows[0].state,
    count: async () => (await db.query("select count(*)::int n from trending_creative_decisions where user_id=$1", [owner])).rows[0].n,
  };
}

for (const format of Object.keys(formats)) {
  test(`${format}: skipped → selected keeps one decision and the original reviewed timestamp`, async () => {
    const f = await fixture(format);
    const skipped = await f.record("rejected");
    assert.equal(await f.state(), "completed_skipped");
    const selected = await f.reconsider();
    assert.equal(selected.decision, "accepted");
    assert.equal(selected.id, skipped.id);
    assert.equal(+selected.decided_at, +skipped.decided_at);
    assert.ok(selected.reconsidered_at);
    assert.equal(await f.state(), formats[format][3]);
    assert.equal(await f.count(), 1);
    const retry = await f.reconsider();
    assert.equal(retry.id, selected.id);
    assert.equal(+retry.reconsidered_at, +selected.reconsidered_at);
    const delayedSkip = await f.record("rejected");
    assert.equal(delayedSkip.decision, "accepted");
    assert.equal(await f.state(), formats[format][3]);
    assert.equal((await f.record("accepted")).id, selected.id);
  });
  test(`${format}: reconsideration before the queued skip arrives is safe`, async () => {
    const f = await fixture(format);
    const selected = await f.reconsider();
    assert.equal(selected.decision, "accepted");
    assert.equal((await f.record("rejected")).id, selected.id);
    assert.equal(await f.count(), 1);
    assert.equal(await f.state(), formats[format][3]);
  });
  test(`${format}: ordinary conflicting decisions still fail closed`, async () => {
    const f = await fixture(format);
    await f.record("rejected");
    await assert.rejects(f.record("accepted"), /decision_conflict/);
    const liked = await fixture(format);
    await liked.record("accepted");
    await assert.rejects(liked.record("rejected"), /decision_conflict/);
  });
  test(`${format}: owner and exact creative scope are required`, async () => {
    const f = await fixture(format);
    await f.record("rejected");
    await assert.rejects(db.query("select * from reconsider_skipped_trending_creative($1,$2,$3,$4)", ["other-owner", ...f.params.slice(1)]), /assignment_not_found/);
    await assert.rejects(db.query("select * from reconsider_skipped_trending_creative($1,$2,$3,$4)", [...f.params.slice(0,3),randomUUID()]), /assignment_not_found/);
    assert.equal(await f.state(), "completed_skipped");
    assert.equal(await f.count(), 1);
  });
}

test("an inactive assignment without a recorded skip cannot be reconsidered", async () => {
  const f = await fixture("reaction", "completed_skipped");
  await assert.rejects(f.reconsider(), /assignment_inactive/);
  assert.equal(await f.count(), 0);
});

test("browser database roles cannot invoke the reconsideration RPC", async () => {
  for (const role of ["anon", "authenticated"]) {
    const { rows } = await db.query("select has_function_privilege($1,'reconsider_skipped_trending_creative(text,text,uuid,uuid)','EXECUTE') allowed", [role]);
    assert.equal(rows[0].allowed, false);
  }
  const { rows } = await db.query("select has_function_privilege('service_role','reconsider_skipped_trending_creative(text,text,uuid,uuid)','EXECUTE') allowed");
  assert.equal(rows[0].allowed, true);
});
