import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

test("feed recovery does not fail queued Carousel slots, but retains terminal, ownership and mixed-format guards", async () => {
  const db = new PGlite();
  const feed = "00000000-0000-4000-8000-000000000001";
  const profile = "00000000-0000-4000-8000-000000000005";
  const job = "00000000-0000-4000-8000-000000000004";
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create table daily_trending_feeds(id uuid primary key,user_id text,business_profile_id uuid,business_profile_version int,local_date date,status text,recovery_attempt_count int,last_recovery_at timestamptz,last_recovery_error text,last_error text,updated_at timestamptz);
      create table daily_trending_feed_slots(id int,feed_id uuid,format text,state text,carousel_assignment_id uuid,hook_video_assignment_id uuid,wall_text_assignment_id uuid,reaction_assignment_id uuid,updated_at timestamptz);
      create table daily_carousel_feeds(id uuid,user_id text,local_date date);
      create table daily_carousel_refill_batches(feed_id uuid,user_id text,business_profile_id uuid,business_profile_version int,generation_batch_id uuid,superseded_at timestamptz);
      create table carousel_generations(generation_batch_id uuid,user_id text,business_profile_id uuid,business_profile_version int,trigger_run_id text);
      create table background_jobs(id uuid,user_id text,job_type text,status text);
      insert into daily_trending_feeds values('${feed}','owner','${profile}',2,current_date,'preparing',3,now(),'waiting',null,now());
      insert into daily_trending_feed_slots values(1,'${feed}','carousel','decided','00000000-0000-4000-8000-000000000099',null,null,null,now()-interval '1 hour'),(2,'${feed}','carousel','failed',null,null,null,null,now()-interval '1 hour');
      insert into daily_carousel_feeds values('00000000-0000-4000-8000-000000000002','owner',current_date);
      insert into daily_carousel_refill_batches values('00000000-0000-4000-8000-000000000002','owner','${profile}',2,'00000000-0000-4000-8000-000000000003',null);
      insert into carousel_generations values('00000000-0000-4000-8000-000000000003','owner','${profile}',2,'${job}');
      insert into background_jobs values('${job}','owner','generate_carousel','queued');`);
    await db.exec(readFileSync(new URL("../supabase/migrations/20261015145119_defer_feed_recovery_for_active_carousel.sql", import.meta.url), "utf8"));
    const finish = () => db.query(`select finish_daily_trending_feed_repair('${feed}',1,'waiting',60,3) as result`);
    const state = async () => (await db.query("select state from daily_trending_feed_slots order by id")).rows.map(row => row.state);
    assert.equal((await finish()).rows[0].result, "waiting_source_job");
    assert.deepEqual(await state(), ["decided", "planned"]);
    assert.equal((await db.query("select recovery_attempt_count from daily_trending_feeds")).rows[0].recovery_attempt_count, 2);
    const reset = () => db.exec("update daily_trending_feeds set recovery_attempt_count=3; update daily_trending_feed_slots set state='planned',updated_at=now()-interval '1 hour' where id=2");
    for (const alter of ["update background_jobs set status='failed'", "update background_jobs set status='queued',user_id='other'", "update background_jobs set user_id='owner'; update daily_carousel_refill_batches set superseded_at=now()"] ) {
      await reset(); await db.exec(alter); await finish();
      assert.deepEqual(await state(), ["decided", "failed"]);
    }
    await reset();
    await db.exec("update daily_carousel_refill_batches set superseded_at=null; update daily_trending_feed_slots set format='wall_text' where id=2");
    assert.notEqual((await finish()).rows[0].result, "waiting_source_job");
    assert.deepEqual(await state(), ["decided", "failed"]);
    await db.exec("set role authenticated");
    await assert.rejects(finish(), /permission denied/);
    await db.exec("set role service_role");
    await finish();
  } finally { await db.close(); }
});

