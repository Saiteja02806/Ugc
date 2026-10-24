import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { after, before, test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { uuid_ossp } from "@electric-sql/pglite/contrib/uuid_ossp";

const migrationName = "20261014034706_reuse_released_partial_carousel_content_plan_items.sql";
const migrations = new URL("../supabase/migrations/", import.meta.url);
const migration = await readFile(new URL(migrationName, migrations), "utf8");
const rotation = await readFile(new URL("20260831133000_rotate_30_day_content_plan_items.sql", migrations), "utf8");
const original = rotation.match(/CREATE OR REPLACE FUNCTION public\.reserve_carousel_content_plan_items \([\s\S]*?\n\$function\$;/)[0];
const signature = "public.reserve_carousel_content_plan_items(text,uuid,integer,integer,text,integer)";
const db = new PGlite({ extensions: { pgcrypto, uuid_ossp } });

before(async () => {
  await db.exec("set time zone 'UTC'; create role anon; create role authenticated; create role service_role bypassrls; create schema extensions;");
  const applied = new Set();
  for (const file of (await readdir(migrations)).filter((file) => file.endsWith(".sql")).sort()) {
    const sql = (await readFile(new URL(file, migrations), "utf8")).replace(/\r\n/g, "\n");
    if (applied.has(sql)) continue;
    applied.add(sql);
    try { await db.exec(sql); }
    catch (error) { throw new Error(`Migration ${file}: ${error.message}`); }
  }
  // Match the inspected production ACL before checking that replacement
  // preserves it; historical bootstrap grants can differ in an empty database.
  await db.exec(`revoke all on function ${signature} from public,anon,authenticated;
    grant execute on function ${signature} to postgres,service_role;`);
}, { timeout: 120000 });
after(() => db.close());

async function one(sql, params = []) { return (await db.query(sql, params)).rows[0]; }
async function fixture(count = 150) {
  const user = `partial-reuse-${randomUUID()}`;
  const profile = await one("insert into public.business_profiles(user_id,intake_type,context_json,content_hash) values($1,'manual','{}','fixture') returning *", [user]);
  const plan = await one(`select * from public.ensure_carousel_content_plan($1,'default-project',$2,1,'UTC','Fixture business','{}'::jsonb,150,'gpt-4o-mini','fixture')`, [user, profile.id]);
  await db.query("update public.carousel_content_plans set status='active',activated_at=now() where id=$1", [plan.id]);
  await db.query(`insert into public.carousel_content_plan_items(plan_id,user_id,sequence_index,day_number,day_slot_index,creative_seed,emotion,seed_fingerprint,status)
    select $1,$2,n,((n-1)/5)+1,((n-1)%5)+1,'Fixture seed '||n,'relief',repeat('0',60)||lpad(n::text,4,'0'),'available'
    from generate_series(1,$3::int) n`, [plan.id, user, count]);
  return { user, profile, plan };
}
async function reserve(f, count, key = randomUUID()) {
  return (await db.query(`select * from ${signature.slice(0, signature.indexOf("("))}($1,$2,1,$3,$4,21600)`, [f.user, f.profile.id, count, key])).rows;
}
async function consume(f, items) {
  for (const item of items) {
    const generation = await one(`insert into public.carousel_generations(user_id,project_id,business_profile_id,business_profile_version,
      content_plan_id,content_plan_item_id,content_plan_reservation_id,status,generation_source,candidate_index,candidate_count)
      values($1,'default-project',$2,1,$3,$4,$5,'completed','auto_generated',$6,50) returning *`, [f.user, f.profile.id, f.plan.id, item.id, item.reservation_token, item.sequence_index]);
    await db.query("select * from public.consume_carousel_content_plan_item($1,$2,$3,$4)", [f.user, item.id, item.reservation_token, generation.id]);
  }
}
async function partial(f, count, consumed, key = randomUUID()) {
  const items = await reserve(f, count, key);
  await consume(f, items.slice(0, consumed));
  await db.query("select public.release_carousel_content_plan_reservation($1,$2,'one candidate failed')", [f.user, key]);
  return { items, key };
}
async function snapshot(f) {
  return (await db.query(`select id,status,reservation_token,use_count,last_used_at,consumed_by_carousel_generation_id
    from public.carousel_content_plan_items where plan_id=$1 order by id`, [f.plan.id])).rows;
}

test("reproduces the 43-of-50 production failure, then reserves all 50 using the actual migration", async () => {
  const f = await fixture();
  await partial(f, 110, 107);
  const completed = await reserve(f, 3);
  await consume(f, completed);
  const before = await snapshot(f);
  await db.exec(original);
  try {
    await assert.rejects(reserve(f, 50), /carousel_content_plan_insufficient_items/);
    assert.deepEqual(await snapshot(f), before, "a failed reservation must be atomic");
  } finally { await db.exec(migration); }
  const fixed = await reserve(f, 50, "daily-pack");
  assert.equal(fixed.length, 50);
  assert.equal(new Set(fixed.map((item) => item.id)).size, 50);
  assert.equal(new Set(fixed.map((item) => item.reservation_token)).size, 1);
  assert.equal(fixed.filter((item) => item.use_count === 0).length, 40, "unused ideas have priority");
  assert.deepEqual(fixed.map((item) => [item.id,item.use_count,item.last_used_at]).sort(),
    before.filter((item) => fixed.some((chosen) => chosen.id === item.id)).map((item) => [item.id,item.use_count,item.last_used_at]).sort());
  assert.equal((await one("select count(*)::int n from public.carousel_content_plan_item_uses where plan_id=$1", [f.plan.id])).n, 110);
  assert.deepEqual((await reserve(f, 50, "daily-pack")).map((item) => item.id), fixed.map((item) => item.id));
  await assert.rejects(reserve(f, 49, "daily-pack"), /idempotency_conflict/);
});

test("ten five-item writer partitions remain disjoint and retry-stable", async () => {
  const f = await fixture();
  await partial(f, 110, 107);
  await consume(f, await reserve(f, 3));
  const all = [];
  for (let i = 0; i < 10; i++) {
    const items = await reserve(f, 5, `writer-${i}`);
    assert.deepEqual((await reserve(f, 5, `writer-${i}`)).map((item) => item.id), items.map((item) => item.id));
    all.push(...items);
  }
  assert.equal(new Set(all.map((item) => item.id)).size, 50);
  assert.equal(new Set(all.map((item) => item.reservation_token)).size, 10);
});

test("terminal partial keys cannot be reopened, but a new reservation can reuse their successful ideas", async () => {
  const f = await fixture(5);
  const { items, key } = await partial(f, 5, 4);
  await assert.rejects(reserve(f, 5, key), /idempotency_conflict/);
  const reused = await reserve(f, 5);
  assert.equal(reused.length, 5);
  assert.equal(reused.find((item) => item.use_count === 0).id, items[4].id);
  const prior = await one("select status,consumed_count from public.carousel_content_plan_reservations where user_id=$1 and reservation_key=$2", [f.user, key]);
  assert.deepEqual(prior, { status: "released_partial", consumed_count: 4 });
});

test("in-flight successful ideas stay excluded until their reservation settles", async () => {
  const f = await fixture(5);
  const items = await reserve(f, 5);
  await consume(f, items.slice(0, 4));
  await assert.rejects(reserve(f, 1), /insufficient_items/);
  assert.equal((await snapshot(f)).filter((item) => item.status === "reserved").length, 1);
});

test("unused ideas win first, followed by least recently used successful ideas", async () => {
  const f = await fixture(5);
  const { items } = await partial(f, 5, 4);
  await db.query("update public.carousel_content_plan_items set last_used_at=now()-interval '5 days' where id=$1", [items[2].id]);
  assert.equal((await reserve(f, 1))[0].id, items[4].id);
  assert.equal((await reserve(f, 1))[0].id, items[2].id);
});

test("expired partial reservations retain the existing release and reuse behavior", async () => {
  const f = await fixture(5);
  const items = await reserve(f, 5);
  await consume(f, items.slice(0, 4));
  await db.query(`update public.carousel_content_plan_reservations set created_at=now()-interval '2 hours',expires_at=now()-interval '1 hour' where id=$1`, [items[0].reservation_token]);
  assert.equal((await reserve(f, 5)).length, 5);
  assert.equal((await one("select status from public.carousel_content_plan_reservations where id=$1", [items[0].reservation_token])).status, "expired_partial");
});

test("completed request replays recover original items after rotation without consuming them twice", async () => {
  const f = await fixture(5);
  const items = await reserve(f, 5, "original");
  await consume(f, items);
  await reserve(f, 5, "later");
  const before = await snapshot(f);
  assert.deepEqual((await reserve(f, 5, "original")).map((item) => item.id), items.map((item) => item.id));
  assert.deepEqual(await snapshot(f), before);
  assert.equal((await one("select count(*)::int n from public.carousel_content_plan_item_uses where plan_id=$1", [f.plan.id])).n, 5);
});

test("owner, profile-version, current-period and insufficient-inventory checks stay enforced", async () => {
  const f = await fixture(5);
  const before = await snapshot(f);
  await assert.rejects(reserve({ ...f, user: "foreign-owner" }, 5), /business_profile_version_changed/);
  await assert.rejects(db.query("select * from public.reserve_carousel_content_plan_items($1,$2,2,5,'wrong-version',21600)", [f.user, f.profile.id]), /business_profile_version_changed/);
  await assert.rejects(reserve(f, 6), /insufficient_items/);
  assert.deepEqual(await snapshot(f), before);
  await db.query("update public.carousel_content_plans set period_start_date=current_date-31,period_end_date=current_date-2 where id=$1", [f.plan.id]);
  await assert.rejects(reserve(f, 5), /active_carousel_content_plan_not_found/);
});

test("migration changes only the two predicates, is repeatable and retains service-only invoker permissions", async () => {
  const before = await one("select prosrc,prosecdef,proconfig,proacl::text from pg_proc where oid=$1::regprocedure", [signature]);
  await db.exec(original);
  const old = await one("select prosrc from pg_proc where oid=$1::regprocedure", [signature]);
  await db.exec(migration);
  const expected = old.prosrc.replaceAll("previous_reservation.status in ('completed', 'expired_partial')", "previous_reservation.status in ('completed', 'expired_partial', 'released_partial')");
  assert.equal((await one("select prosrc from pg_proc where oid=$1::regprocedure", [signature])).prosrc, expected);
  await db.exec(migration);
  assert.deepEqual(await one("select prosrc,prosecdef,proconfig,proacl::text from pg_proc where oid=$1::regprocedure", [signature]), before);
  for (const role of ["anon", "authenticated"]) assert.equal((await one("select has_function_privilege($1,$2,'EXECUTE') allowed", [role, signature])).allowed, false);
  assert.equal((await one("select has_function_privilege('service_role',$1,'EXECUTE') allowed", [signature])).allowed, true);
  assert.equal(before.prosecdef, false);
});

test("migration refuses an unexpected allocator definition instead of overwriting it", async () => {
  await db.exec(original.replaceAll("previous_reservation.status in ('completed', 'expired_partial')", "previous_reservation.status in ('completed')"));
  try { await assert.rejects(db.exec(migration), /partial_reuse_predicates_changed/); }
  finally { await db.exec(original); await db.exec(migration); }
});
