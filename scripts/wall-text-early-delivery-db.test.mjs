import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test, { before, after } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp';
import { createHash, randomUUID } from 'node:crypto';

const db = new PGlite({ extensions: { pgcrypto, uuid_ossp } });
const migrations = new URL('../supabase/migrations/', import.meta.url);
before(async () => {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema extensions;`);
  for (const file of (await readdir(migrations)).filter(f => f.endsWith('.sql')).sort()) {
    try { await db.exec((await readFile(new URL(file, migrations), 'utf8')).replace(/\r\n/g, '\n')); }
    catch (error) { throw new Error(`Migration ${file}: ${error.message}`); }
  }
  await db.exec(`insert into subscription_entitlements(plan_key,display_name,daily_carousel_limit,daily_trending_limit)
    values ('pro','Starter',50,50) on conflict do nothing;`);
}, { timeout: 120_000 });
after(async () => { await db.close(); });

test('the complete migration chain builds with no rollout rows before a Wall plan is created', async () => {
  const { rows } = await db.query('select count(*)::integer as count from public.wall_text_early_delivery_accounts');
  assert.equal(rows[0].count, 0);
});

async function one(sql, params = []) { return (await db.query(sql, params)).rows[0]; }
async function fixture({ enabled = true, count = 3 } = {}) {
  const user = `wall-test-${randomUUID()}`;
  if (enabled) await db.query('insert into wall_text_early_delivery_accounts(user_id,enabled) values ($1,true)', [user]);
  const profile = await one(`insert into business_profiles(user_id,intake_type,context_json,content_hash)
    values ($1,'manual','{}','test-context') returning *`, [user]);
  await db.query(`insert into billing_subscriptions(dodo_subscription_id,user_id,dodo_customer_id,
    product_id,plan_key,billing_interval,status,last_event_at,last_webhook_id)
    values ($1,$1,'test-customer','test-product','starter','monthly','active',now(),'test-webhook')`,[user]);
  const plan = await one(`select * from ensure_wall_text_content_plan($1,'default-project',$2,1,'UTC',
    'A test business that helps people plan their meals.','{}',200,'gpt-5-mini','test-v1')`, [user,profile.id]);
  const job = await one(`insert into background_jobs(user_id,job_type,queue_name,status,input_json,
    claim_token,stage,queue_provider) values ($1,'wall_text_content_plan_generation','ai-generation',
    'processing',$2,gen_random_uuid(),'generating_wall_text_content_plan','gcp') returning *`,
    [user,{ planId: plan.id, userId: user, operation: 'wall_text_content_plan_generation' }]);
  await db.query('select attach_wall_text_content_plan_generation_job($1,$2,$3)', [user,plan.id,job.id]);
  const feed = await one(`insert into daily_trending_feeds(user_id,business_profile_id,business_profile_version,
    local_date,timezone,plan_key,plan_display_name,daily_limit,carousel_percent,wall_text_percent,hook_video_percent,preference_version)
    values ($1,$2,1,current_date,'UTC','pro','Starter',$3,0,100,0,1) returning *`, [user,profile.id,count]);
  await db.query(`insert into daily_trending_feed_slots(feed_id,position,format)
    select $1,n,'wall_text' from generate_series(1,$2::integer) n`, [feed.id,count]);
  return { user, profile, plan, job, feed, count };
}
function chunk(start = 0) {
  const hash = value => createHash('sha256').update(value).digest('hex');
  const briefs = [1,2].map(n => ({ brief_index: start / 5 + n,
    creative_seed: `A distinctive test creative seed ${start}-${n}`, audience_context: 'Busy people planning meals',
    human_moment: `Planning tomorrow after a busy workday ${start}-${n}`, emotional_tension: 'Relief from decision fatigue',
    supported_angle: 'A practical way to make a grounded meal decision', preferred_format_family: 'freeform',
    brief_fingerprint: hash(`brief:${start}-${n}`) }));
  const items = Array.from({ length: 10 }, (_,i) => ({
    brief_index: Math.floor((start+i)/5)+1, sequence_index: start+i+1,
    content_idea: `Test meal planning idea with a distinct situation number ${start+i+1}`,
    feeling: 'relief', idea_fingerprint: hash(`idea:${start+i}`),
    private_context: { audienceContext: 'Busy people', humanMoment: `Situation ${start+i}` },
  }));
  return { briefs, items };
}
async function publish(f, start = 0, overrides = {}) {
  const data = { ...chunk(start), ...overrides };
  return db.query('select * from persist_wall_text_content_plan_brief_chunk_v2($1,$2,$3,$4,$5,$6,$7)',
    [f.user,f.plan.id,f.job.id,f.job.claim_token,start,data.briefs,data.items]);
}
async function admit(f, count = f.count, version = 'writer-test-v1') {
  return (await one('select admit_wall_text_daily_delivery($1,$2,1,$3,$4,$5,$6,$7) as result',
    [f.user,f.profile.id,f.feed.id,f.plan.id,version,'layout-test-v1',count])).result;
}

test('a committed first chunk admits one writer while the 200-item plan remains generating', async () => {
  const f = await fixture();
  assert.equal((await admit(f)).kind, 'planning');
  await publish(f);
  const plan = await one('select * from wall_text_content_plans where id=$1', [f.plan.id]);
  assert.equal(plan.status, 'generating');
  assert.equal(plan.published_item_count, 10);
  assert.equal((await one('select count(*)::int as n from wall_text_plan_publications where plan_id=$1',[f.plan.id])).n,1);
  const results = await Promise.all(Array.from({length:8}, () => admit(f)));
  assert.equal(results[0].kind, 'job');
  assert.equal(new Set(results.map(r=>r.jobId)).size,1);
  await publish(f,10);
  assert.equal((await admit(f,2)).jobId, results[0].jobId, 'partial counts do not create a new request');
  assert.equal((await one(`select count(*)::int as n from background_jobs where user_id=$1 and job_type='wall_text_generation'`,[f.user])).n,1);
});

test('waits for enough unused published ideas to cover a larger request', async () => {
  const f = await fixture({count:20});
  await publish(f);
  assert.equal((await admit(f)).kind,'planning');
  await publish(f,10);
  await db.query(`update wall_text_content_plan_items set status='retired' where plan_id=$1 and sequence_index=1`,[f.plan.id]);
  assert.equal((await admit(f)).kind,'planning');
  await publish(f,20);
  assert.equal((await admit(f)).kind,'job');
});

test('an explicit retry or later generator version has a new intent after the old writer settles', async () => {
  const f=await fixture(); await publish(f); const original=await admit(f);
  await db.query("update background_jobs set status='completed' where id=$1",[original.jobId]);
  const upgrade=await admit(f,f.count,'writer-test-v2');
  assert.notEqual(upgrade.jobId,original.jobId);
  assert.equal((await admit(f,f.count,'writer-test-v2')).jobId,upgrade.jobId);
  await db.query("update background_jobs set status='failed',attempt_count=max_attempts where id=$1",[upgrade.jobId]);
  assert.equal((await admit(f,f.count,'writer-test-v2')).jobId,upgrade.jobId,'failure does not create unlimited replacements');
  await db.query('update daily_trending_feeds set wall_text_retry_key=gen_random_uuid() where id=$1',[f.feed.id]);
  assert.notEqual((await admit(f,f.count,'writer-test-v2')).jobId,upgrade.jobId);
});

test('a completed short daily result is reopened with a new retry key and keeps its history', async () => {
  const f = await fixture();
  await publish(f);
  const admitted = await admit(f);
  await db.query(
    `update background_jobs
       set status = 'completed', output_json = jsonb_build_object('ideaCount', 1)
     where id = $1`,
    [admitted.jobId],
  );

  const recoveryMigration = await readFile(
    new URL(
      '../supabase/migrations/20260912103553_repair_wall_text_daily_delivery_shortfalls.sql',
      import.meta.url,
    ),
    'utf8',
  );
  await db.exec(recoveryMigration);

  const recoveredFeed = await one(
    'select status, wall_text_retry_key from daily_trending_feeds where id = $1',
    [f.feed.id],
  );
  const originalIntent = await one(
    'select retry_key from wall_text_daily_delivery_intents where job_id = $1',
    [admitted.jobId],
  );
  const settledJob = await one(
    'select status from background_jobs where id = $1',
    [admitted.jobId],
  );

  assert.equal(recoveredFeed.status, 'preparing');
  assert.ok(recoveredFeed.wall_text_retry_key);
  assert.notEqual(recoveredFeed.wall_text_retry_key, originalIntent.retry_key);
  assert.equal(settledJob.status, 'completed');
});

test('rejects stale claims, cancelled jobs, out-of-order chunks and duplicate saves atomically', async () => {
  const f = await fixture();
  await assert.rejects(publish({...f,job:{...f.job,claim_token:randomUUID()}}),/wall_text_planner_claim_lost/);
  const invalid = chunk(); invalid.items[0].sequence_index=2;
  await assert.rejects(publish(f,0,invalid),/wall_text_plan_publication_shape_invalid/);
  assert.equal((await one('select count(*)::int as n from wall_text_content_plan_items where plan_id=$1',[f.plan.id])).n,0);
  await publish(f);
  await assert.rejects(publish(f),/wall_text_plan_chunk_position_changed/);
  await db.query(`update background_jobs set cancel_requested_at=now() where id=$1`,[f.job.id]);
  await assert.rejects(publish(f,10),/wall_text_planner_claim_lost/);
  assert.equal((await one('select published_item_count from wall_text_content_plans where id=$1',[f.plan.id])).published_item_count,10);
});

test('missed publication delivery is reclaimable and an old acknowledgement cannot erase a new claim', async () => {
  const f = await fixture(); await publish(f);
  const first = await one('select * from claim_wall_text_plan_publications(1,$1)',[f.plan.id]);
  await db.query(`update wall_text_plan_publications set locked_at=now()-interval '6 minutes' where id=$1`,[first.id]);
  const second = await one('select * from claim_wall_text_plan_publications(1,$1)',[f.plan.id]);
  assert.notEqual(first.claim_token,second.claim_token);
  assert.equal((await one('select finish_wall_text_plan_publication($1,$2,null) as ok',[first.id,first.claim_token])).ok,false);
  assert.equal((await one('select finish_wall_text_plan_publication($1,$2,null) as ok',[second.id,second.claim_token])).ok,true);
});

test('a Cloud Task can claim exactly one publication and failed admission is due again in ten seconds', async () => {
  const f = await fixture();
  await publish(f);
  await publish(f, 10);
  const publications = (await db.query(
    'select * from wall_text_plan_publications where plan_id=$1 order by item_count',
    [f.plan.id],
  )).rows;
  const first = publications[0];
  const second = publications[1];

  const claimed = await one(
    'select * from claim_wall_text_plan_publications(1,$1,$2)',
    [f.plan.id, second.id],
  );
  assert.equal(claimed.id, second.id);
  assert.notEqual(claimed.id, first.id);
  assert.equal(
    (await one('select finish_wall_text_plan_publication($1,$2,$3) as ok', [
      claimed.id,
      claimed.claim_token,
      'temporary admission failure',
    ])).ok,
    true,
  );
  const retriable = await one(
    `select extract(epoch from next_attempt_at - now()) as retry_seconds, status, last_error
     from wall_text_plan_publications where id=$1`,
    [second.id],
  );
  assert.equal(retriable.status, 'pending');
  assert.equal(retriable.last_error, 'temporary admission failure');
  assert.ok(retriable.retry_seconds >= 9 && retriable.retry_seconds <= 11);
});

test('new Wall plans use early delivery even when no rollout row existed, and old workers cannot save them', async () => {
  const f = await fixture({enabled:false});
  assert.equal(f.plan.early_delivery_enabled,true);
  assert.equal((await one('select enabled from wall_text_early_delivery_accounts where user_id=$1',[f.user])).enabled,true);
  await publish(f);
  assert.equal((await admit(f)).kind,'job');
  assert.equal((await one('select count(*)::int as n from wall_text_plan_publications where plan_id=$1',[f.plan.id])).n,1);
  const optedIn = await fixture(); const c=chunk();
  await assert.rejects(db.query('select * from persist_wall_text_content_plan_brief_chunk($1,$2,$3,$4)',
    [optedIn.user,optedIn.plan.id,c.briefs,c.items]), /wall_text_planner_upgrade_required/);
});

test('a failed remainder keeps its published inventory and stops automatic reopening after three planner jobs', async () => {
  const f = await fixture(); await publish(f);
  await db.query(`update wall_text_content_plans set status='failed',generation_attempt=3 where id=$1`,[f.plan.id]);
  const plan=await one(`select * from ensure_wall_text_content_plan($1,'default-project',$2,1,'UTC',
    'A test business that helps people plan their meals.','{}',200,'gpt-5-mini','test-v1')`,[f.user,f.profile.id]);
  assert.equal(plan.status,'failed'); assert.equal(plan.generation_attempt,3); assert.equal(plan.published_item_count,10);
  assert.equal((await admit(f)).kind,'job');
});

test('internal tables and functions reject browser roles', async () => {
  await db.exec('set role authenticated');
  try {
    await assert.rejects(db.query('select * from wall_text_plan_publications'),/permission denied/);
    await assert.rejects(db.query('select * from claim_wall_text_plan_publications()'),/permission denied/);
  } finally { await db.exec('reset role'); }
});

async function reserve(f, jobId, count = f.count) {
  const job = await one('select * from background_jobs where id=$1',[jobId]);
  const assets = await db.query(`insert into overlay_media_assets(asset_type,s3_key)
    select 'video','test/' || gen_random_uuid() from generate_series(1,$1::int) returning id`,[count]);
  const assignments = assets.rows.map(asset=>({
    sourceKind:'ugcpilot', assignedFormatId:null, selectionMode:'freeform', selectionWeight:1,
    overlayMediaAssetId:asset.id, durationSeconds:10, layout:{}, targetWords:70,maxWords:100,focus:{},
  }));
  const {rows}=await db.query('select * from reserve_wall_text_generation_batch_v1($1,$2,1,$3,$4,$5,$6,$7,$8,$9)',
    [f.user,f.profile.id,job.idempotency_key,'a'.repeat(64),'writer-test-v1','prompt-v1','format-v1','selector-v1',assignments]);
  return rows[0];
}

test('an admitted writer can reserve after rollback, without recycling a partial plan', async () => {
  const f = await fixture(); await publish(f); const admitted = await admit(f);
  await db.query(`update wall_text_early_delivery_accounts set enabled=false where user_id=$1`,[f.user]);
  const batch = await reserve(f,admitted.jobId);
  assert.equal(batch.requested_count,3);
  assert.equal((await reserve(f,admitted.jobId)).id,batch.id,'the same request reuses its reservation');
  assert.equal((await one(`select count(*)::int as n from wall_text_content_plan_items where plan_id=$1 and status='reserved'`,[f.plan.id])).n,3);
  const assignments=await db.query('select wall_text_content_plan_id,wall_text_content_plan_item_id from wall_text_generation_assignments where batch_id=$1',[batch.id]);
  assert.ok(assignments.rows.every(a=>a.wall_text_content_plan_id===f.plan.id));
});

test('reservation cannot recycle consumed prefix items while planning is incomplete', async () => {
  const f=await fixture({count:10}); await publish(f); const admitted=await admit(f);
  await db.query(`update wall_text_content_plan_items set status='consumed' where plan_id=$1 and sequence_index=1`,[f.plan.id]);
  await assert.rejects(reserve(f,admitted.jobId),/wall_text_content_plan_inventory_pending/);
  assert.equal((await one('select count(*)::int as n from wall_text_generation_batches where user_id=$1',[f.user])).n,0);
});

test('Wall reservation uses the plan local date across midnight and session timezones', async () => {
  const signature = 'public.reserve_wall_text_generation_batch_v1(text,uuid,integer,text,text,text,text,text,text,jsonb)';
  const { definition } = await one('select pg_get_functiondef($1::regprocedure) as definition', [signature]);
  // Freeze only this function's clock so the regression does not depend on
  // the time at which CI runs. Exercise the real reservation, not a copy of it.
  const cases = [
    ['Asia/Calcutta', '2026-09-10 03:30:28+00', '2026-09-10'],
    ['Asia/Calcutta', '2026-09-09 19:00:00+00', '2026-09-10'],
    ['America/Los_Angeles', '2026-09-10 02:00:00+00', '2026-09-09'],
    ['America/New_York', '2026-11-01 05:30:00+00', '2026-11-01'],
    ['America/New_York', '2026-11-01 06:30:00+00', '2026-11-01'],
  ];
  try {
    for (const sessionZone of ['UTC', 'Asia/Calcutta', 'America/Los_Angeles']) {
      await db.query("select set_config('TimeZone',$1,false)", [sessionZone]);
      for (const [zone, instant, localDate] of cases) {
        const f = await fixture();
        await publish(f);
        const admitted = await admit(f);
        await db.query(`update wall_text_content_plans set timezone=$2,
          period_start_date=$3::date,period_end_date=$3::date+29 where id=$1`,
          [f.plan.id,zone,localDate]);
        await db.exec(definition.replace(/\bnow\(\)/g, `timestamptz '${instant}'`));
        const batch = await reserve(f,admitted.jobId);
        assert.equal(batch.requested_count,3,`${zone}, ${instant}, session ${sessionZone}`);
        await db.exec(definition);
      }
    }
  } finally {
    await db.exec(definition);
    await db.exec("set timezone='UTC'");
  }
});

test('Wall reservation still rejects future and expired plans', async () => {
  for (const offset of [1, -30]) {
    const f = await fixture(); await publish(f); const admitted = await admit(f);
    await db.query(`update wall_text_content_plans set
      period_start_date=current_date+$2::int,period_end_date=current_date+$2::int+29 where id=$1`,
      [f.plan.id,offset]);
    await assert.rejects(reserve(f,admitted.jobId),/wall_text_content_plan_pending/);
    assert.equal((await one('select count(*)::int as n from wall_text_generation_batches where user_id=$1',[f.user])).n,0);
  }
});

test('only a full 200-item plan activates, preserving reserved items and existing reservations', async () => {
  const f=await fixture(); await publish(f); const admitted=await admit(f);
  const batch=await reserve(f,admitted.jobId);
  await assert.rejects(db.query('select complete_wall_text_content_plan_generation_v2($1,$2,$3,$4)',
    [f.user,f.plan.id,f.job.id,f.job.claim_token]),/wall_text_content_plan_incomplete/);
  for(let start=10;start<200;start+=10) await publish(f,start);
  await db.query('select complete_wall_text_content_plan_generation_v2($1,$2,$3,$4)',
    [f.user,f.plan.id,f.job.id,f.job.claim_token]);
  assert.equal((await one('select status from wall_text_content_plans where id=$1',[f.plan.id])).status,'active');
  assert.equal((await one(`select count(*)::int as n from wall_text_content_plan_items where plan_id=$1 and status='reserved'`,[f.plan.id])).n,3);
  assert.equal((await reserve(f,admitted.jobId)).id,batch.id);
});

test('recovery finds a partial failed plan even with no missing feed demand, but respects the resume budget', async () => {
  const f=await fixture(); await publish(f);
  await db.query("update background_jobs set status='failed' where id=$1",[f.job.id]);
  let due=await db.query('select * from list_wall_text_plans_needing_resume(25)');
  assert.ok(due.rows.some(row=>row.plan_id===f.plan.id));
  await db.query('update wall_text_content_plans set generation_attempt=3 where id=$1',[f.plan.id]);
  due=await db.query('select * from list_wall_text_plans_needing_resume(25)');
  assert.ok(!due.rows.some(row=>row.plan_id===f.plan.id));
});
