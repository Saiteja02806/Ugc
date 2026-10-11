import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { fixture, readMigration, functionSQL, baseline } from './fixtures/generation-job-retry-db.mjs';

async function setup() {
  const db = await fixture({ realJobs: true });
  await db.exec(functionSQL(baseline, 'request_background_job_cancel'));
  await db.exec(`alter table background_jobs enable row level security;
    grant select,update on background_jobs to service_role;
    revoke all on function request_background_job_cancel(uuid,text) from public,anon,authenticated;
    grant execute on function request_background_job_cancel(uuid,text) to service_role;`);
  await db.exec(readMigration('20261011191633_mcp_operation_recovery'));
  return db;
}
const control = async (db, job, request, version, action='retry', owner='free-user', allowed=true) =>
  (await db.query('select mcp_control_background_job($1,$2,$3,$4,$5,$6) receipt', [owner,request,job,version,action,allowed])).rows[0].receipt;
const version = async (db, id) => (await db.query(`select to_char(updated_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') version from background_jobs where id=$1`, [id])).rows[0].version;
const fail = (db,id) => db.query("update background_jobs set status='failed',updated_at=clock_timestamp() where id=$1",[id]);
async function job(db, key, funded=true) {
  if(funded) await db.query("select reserve_billing_credits('free-user',$1,'generate_image',1)",[key]);
  return (await db.query("insert into background_jobs(user_id,idempotency_key,job_type,queue_name) values('free-user',$1,'generate_image','ai-generation') returning id",[key])).rows[0].id;
}
const reserved = async db => (await db.query("select reserved_credits from free_generation_credit_balances where user_id='free-user'")).rows[0]?.reserved_credits ?? 0;
const receiptCount = async db => (await db.query('select count(*)::int n from mcp_job_control_requests')).rows[0].n;

test('a lost retry response and simultaneous matching replays reserve once, even after that retry later fails', async()=>{
  const db=await setup();try{
    const id=await job(db,'lost');await fail(db,id);const before=await version(db,id),request=randomUUID();
    const replies=await Promise.all([control(db,id,request,before),control(db,id,request,before)]);
    assert.deepEqual(replies.map(r=>r.replayed).sort(),[false,true]);assert.equal(await reserved(db),1);assert.equal(await receiptCount(db),1);
    await fail(db,id);assert.equal(await reserved(db),0);
    assert.equal((await control(db,id,request,before,'retry','free-user',false)).replayed,true);
    assert.equal(await reserved(db),0);assert.equal((await db.query('select status from background_jobs where id=$1',[id])).rows[0].status,'failed');
    assert.equal((await db.query("select count(*)::int n from background_job_events where event_type='job_retried'")).rows[0].n,1);
    await control(db,id,randomUUID(),await version(db,id));assert.equal(await reserved(db),1);
  }finally{await db.close();}
});
test('different requests against one failure revision cannot fund two retries',async()=>{
  const db=await setup();try{
    const id=await job(db,'revision');await fail(db,id);const before=await version(db,id);
    const results=await Promise.allSettled([control(db,id,randomUUID(),before),control(db,id,randomUUID(),before)]);
    assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(await reserved(db),1);assert.equal(await receiptCount(db),1);
    assert.match(results.find(r=>r.status==='rejected').reason.message,/mcp_operation_changed/);
  }finally{await db.close();}
});
test('cancellation replay never cancels a later revision, and running jobs retain asynchronous cancellation',async()=>{
  const db=await setup();try{
    const id=await job(db,'cancel',false),before=await version(db,id),request=randomUUID();
    await control(db,id,request,before,'cancel');
    assert.equal((await db.query('select status from background_jobs where id=$1',[id])).rows[0].status,'cancelled');
    await db.query("update background_jobs set status='processing',updated_at=clock_timestamp() where id=$1",[id]);
    assert.equal((await control(db,id,request,before,'cancel')).replayed,true);
    assert.equal((await db.query('select status from background_jobs where id=$1',[id])).rows[0].status,'processing');
    await control(db,id,randomUUID(),await version(db,id),'cancel');
    assert.equal((await db.query('select status from background_jobs where id=$1',[id])).rows[0].status,'cancel_requested');
  }finally{await db.close();}
});
test('receipts bind owner, operation, action and exact microsecond revision; stale or internal controls are rejected',async()=>{
  const db=await setup();try{
    const id=await job(db,'owner',false);await db.query("update background_jobs set updated_at='2026-10-11T00:00:00.000001Z' where id=$1",[id]);
    const before=await version(db,id),request=randomUUID();
    await assert.rejects(control(db,id,request,'2026-10-11T00:00:00.000Z','cancel'),/mcp_operation_changed/);
    await assert.rejects(control(db,id,request,before,'cancel','other-owner'),/mcp_operation_not_found/);
    await control(db,id,request,before,'cancel');
    await assert.rejects(control(db,id,request,before,'retry'),/mcp_operation_request_conflict/);
    await assert.rejects(control(db,id,request,'2026-10-11T00:00:00.000002Z','cancel'),/mcp_operation_request_conflict/);
    const second=await job(db,'other',false);
    await assert.rejects(control(db,second,request,await version(db,second),'cancel'),/mcp_operation_request_conflict/);
    await db.query("update background_jobs set job_type='test_worker_job' where id=$1",[second]);
    await assert.rejects(control(db,second,randomUUID(),await version(db,second),'cancel'),/mcp_operation_not_found/);
    assert.equal(await receiptCount(db),1);
  }finally{await db.close();}
});
test('provider policy denial and insufficient original credits roll back without a receipt or queue transition',async()=>{
  const db=await setup();try{
    const id=await job(db,'funding');await fail(db,id);const before=await version(db,id);
    await assert.rejects(control(db,id,randomUUID(),before,'retry','free-user',false),/mcp_operation_not_retryable/);
    await db.query("select reserve_billing_credits('free-user','other-one','generate_image',1)");
    await db.query("select reserve_billing_credits('free-user','other-two','generate_image',1)");
    await assert.rejects(control(db,id,randomUUID(),before),/insufficient_billing_credits/);
    assert.equal(await receiptCount(db),0);assert.equal(await reserved(db),2);
    assert.equal((await db.query('select status from background_jobs where id=$1',[id])).rows[0].status,'failed');
  }finally{await db.close();}
});
test('same request on different jobs serializes to one action; invoker, RLS and service-only privileges hold',async()=>{
  const db=await setup();try{
    const a=await job(db,'a',false),b=await job(db,'b',false),request=randomUUID();
    const results=await Promise.allSettled([control(db,a,request,await version(db,a),'cancel'),control(db,b,request,await version(db,b),'cancel')]);
    assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(await receiptCount(db),1);
    const flags=(await db.query(`select p.prosecdef,
      has_function_privilege('anon',p.oid,'execute') anon,
      has_function_privilege('authenticated',p.oid,'execute') authenticated,
      has_function_privilege('service_role',p.oid,'execute') service,
      (select relrowsecurity from pg_class where oid='mcp_job_control_requests'::regclass) rls
      from pg_proc p where p.proname='mcp_control_background_job'`)).rows[0];
    assert.deepEqual(flags,{prosecdef:false,anon:false,authenticated:false,service:true,rls:true});
    await db.exec('set role service_role');
    const selected=results[0].status==='fulfilled'?a:b;
    assert.equal((await control(db,selected,randomUUID(),await version(db,selected),'cancel')).replayed,false);
  }finally{await db.close();}
});
