import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const migration = await readFile(new URL("../supabase/migrations/20261020181748_analytics_account_snapshots.sql", import.meta.url), "utf8");
const id = "00000000-0000-4000-8000-000000000001";
const ready = (views = 0) => ({ connectionId: id, status: "ready", lastSyncedAt: "2026-10-20T01:00:00Z", videos: [], metrics: { views } });
const failed = { connectionId: id, status: "error", lastSyncedAt: null, message: "Provider unavailable" };
async function fixture() {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    grant usage on schema public to service_role;
    alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
    create table public.social_connections(id uuid primary key,user_id text,platform text,revoked_at timestamptz,connected_at timestamptz,metadata jsonb);
    grant select on public.social_connections to service_role;
    create table public.background_jobs(user_id text,job_type text,status text,input_json jsonb,output_json jsonb,created_at timestamptz);
    insert into public.social_connections values ('${id}','owner','youtube',null,'2026-10-01T00:00:00Z','{}');`);
  return db;
}
async function save(db, account, { owner = "owner", revision = "2026-10-01T00:00:00Z", time = "2026-10-20T01:00:00Z", operation = "youtube_channel", days = 0 } = {}) {
  return (await db.query("select public.save_analytics_account_snapshot($1,$2,$3,$4,$5,$6,$7) saved", [owner,id,operation,days,revision,JSON.stringify(account),time])).rows[0].saved;
}

test("durable last-good analytics survives partial failures and authoritative empty success", async () => {
  const db = await fixture();
  try {
    await db.exec(migration);
    assert.equal(await save(db, ready(17)), true);
    for (let i=1;i<=6;i++) await save(db, failed, {time:`2026-10-20T01:0${i}:00Z`});
    let row = (await db.query("select * from public.analytics_account_snapshots")).rows[0];
    assert.equal(row.snapshot_json.metrics.views,17);
    assert.equal(row.refresh_status,"error");
    assert.equal(row.refresh_message,"Provider unavailable");
    await save(db, ready(0), {time:"2026-10-20T02:00:00Z"});
    row=(await db.query("select * from public.analytics_account_snapshots")).rows[0];
    assert.deepEqual(row.snapshot_json.videos,[]);
    assert.equal(row.snapshot_json.metrics.views,0);
    await save(db,ready(999),{time:"2026-10-20T01:00:00Z"});
    assert.equal((await db.query("select snapshot_json from public.analytics_account_snapshots")).rows[0].snapshot_json.metrics.views,0,"older jobs cannot overwrite newer attempts");
  } finally {await db.close();}
});

test("reconnect, disconnect, owner and operation mismatches cannot restore old snapshots",async()=>{
  const db=await fixture();
  try {
    await db.exec(migration);await save(db,ready(17));
    await db.query("update public.social_connections set metadata=$1",[JSON.stringify({authorizationRevision:"new-consent"})]);
    assert.equal(await save(db,ready(999)),false);
    assert.equal(await save(db,failed,{revision:"new-consent",time:"2026-10-20T02:00:00Z"}),true);
    const row=(await db.query("select * from public.analytics_account_snapshots")).rows[0];
    assert.equal(row.last_success_at,null);assert.equal(row.snapshot_json.status,"error");
    assert.equal(await save(db,ready(),{owner:"another-owner",revision:"new-consent"}),false);
    await assert.rejects(save(db,ready(),{operation:"tiktok_videos",revision:"new-consent"}),/invalid_analytics_snapshot/);
    await db.query("update public.social_connections set revoked_at=now()");
    assert.equal(await save(db,ready(),{revision:"new-consent"}),false);
  }finally{await db.close();}
});

test("migration backfills a last good account beyond five failed jobs and remains service-only",async()=>{
  const db=await fixture();
  try {
    await db.query("insert into public.background_jobs values ('owner','analytics_sync','completed',$1,$2,'2026-10-19T00:00:00Z')",[JSON.stringify({operation:"youtube_channel"}),JSON.stringify({accounts:[ready(12)]})]);
    for(let i=0;i<6;i++) await db.query("insert into public.background_jobs values ('owner','analytics_sync','completed',$1,$2,'2026-10-20T00:00:00Z')",[JSON.stringify({operation:"youtube_channel"}),JSON.stringify({accounts:[failed]})]);
    await db.query("insert into public.background_jobs values ('owner','analytics_sync','completed',$1,$2,'2026-10-20T01:00:00Z')",[JSON.stringify({operation:"youtube_channel",days:"malformed"}),JSON.stringify({accounts:[{...ready(999),lastSyncedAt:"invalid date"}]})]);
    await db.exec(migration);
    assert.equal((await db.query("select snapshot_json from public.analytics_account_snapshots")).rows[0].snapshot_json.metrics.views,12);
    for(const role of ['anon','authenticated']){
      await db.exec(`set role ${role}`);
      await assert.rejects(db.query('select * from public.analytics_account_snapshots'),/permission denied/);
      await assert.rejects(save(db,ready()),/permission denied/);
      await db.exec('reset role');
    }
    await db.exec('set role service_role');assert.equal(await save(db,ready(4)),true);
    await assert.rejects(db.query('delete from public.analytics_account_snapshots'),/permission denied/);
    await db.exec('reset role');
    assert.equal((await db.query("select relrowsecurity from pg_class where oid='public.analytics_account_snapshots'::regclass")).rows[0].relrowsecurity,true);
  }finally{await db.close();}
});
