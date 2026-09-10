import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
const baseline = readFileSync(new URL('../supabase/migrations/20260829093001_production_baseline_v1.sql',import.meta.url),'utf8');
const migration = readFileSync(new URL('../supabase/migrations/20260910112546_increase_free_trial_allowances.sql',import.meta.url),'utf8');
test('trial upgrade preserves expiry/usage and supports unlimited or restored scheduling caps', async()=>{
 const db=new PGlite();try{
 await db.exec(`create table free_trial_entitlements(user_id text primary key,started_at timestamptz,expires_at timestamptz,content_days_limit int default 3,daily_content_pieces int not null default 10,instagram_schedule_limit int not null default 5 check(instagram_schedule_limit>0));
 create table subscription_entitlements(plan_key text,daily_trending_limit int);
 create table billing_subscriptions(user_id text,status text);
 create table daily_trending_feeds(user_id text,created_at timestamptz default now(),daily_limit int);
 create table free_trial_instagram_schedule_usage(user_id text,scheduled_post_target_id int);
 create table targets(id int,user_id text,platform text);
 create table profiles(user_id text,onboarding_status text,onboarding_version int,onboarding_completed_at timestamptz);
 insert into subscription_entitlements values('free',10),('pro',20);
 insert into free_trial_entitlements(user_id,started_at,expires_at) values('active',now(),now()+interval '3 days'),('expired',now()-interval '4 days',now()-interval '1 day');
 insert into free_trial_instagram_schedule_usage values('active',0);`);
 for(const name of ['enforce_free_trial_instagram_schedule_limit','enforce_free_trial_daily_trending_feed']){
 const start=baseline.indexOf(`CREATE OR REPLACE FUNCTION public.${name}()`);
 assert.ok(start>=0,name);const end=baseline.indexOf('$function$;',start)+11;
 await db.exec(baseline.slice(start,end));
 }
 await db.exec(`create trigger schedule_guard before insert on targets for each row execute function enforce_free_trial_instagram_schedule_limit(); create trigger feed_guard before insert on daily_trending_feeds for each row execute function enforce_free_trial_daily_trending_feed();`);
 const before=(await db.query('select * from free_trial_entitlements order by user_id')).rows;
 await db.exec(migration);
 const after=(await db.query('select * from free_trial_entitlements order by user_id')).rows;
 assert.deepEqual(after.map(x=>[x.started_at,x.expires_at,x.content_days_limit]),before.map(x=>[x.started_at,x.expires_at,x.content_days_limit]));
 assert.ok(after.every(x=>x.daily_content_pieces===20&&x.instagram_schedule_limit===null));
 await db.exec(`insert into targets select n,'active','instagram' from generate_series(1,25) n;`);
 assert.equal((await db.query("select count(*)::int n from free_trial_instagram_schedule_usage where user_id='active'")).rows[0].n,26);
 await assert.rejects(db.exec("insert into targets values(30,'expired','instagram')"),/free_trial_schedule_expired/);
 await db.exec("update free_trial_entitlements set instagram_schedule_limit=5 where user_id='active'");
 await assert.rejects(db.exec("insert into targets values(31,'active','instagram')"),/free_trial_schedule_limit_reached/);
 await db.exec("insert into daily_trending_feeds(user_id,daily_limit) values('active',20)");
 await assert.rejects(db.exec("insert into daily_trending_feeds(user_id,daily_limit) values('active',21)"),/free_trial_daily_content_limit_exceeded/);
 await db.exec(`create trigger onboarding after insert on profiles for each row execute function grant_free_trial_on_onboarding_completion(); insert into profiles values('new','completed',3,now());`);
 const fresh=(await db.query("select * from free_trial_entitlements where user_id='new'")).rows[0];
 assert.equal(fresh.daily_content_pieces,20);assert.equal(fresh.instagram_schedule_limit,null);assert.equal(fresh.content_days_limit,3);
 }finally{await db.close()}
});
