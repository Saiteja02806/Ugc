import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import test, { before, after } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp';

const db = new PGlite({ extensions: { pgcrypto, uuid_ossp } });
before(async () => {
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls; create schema extensions;');
  const root = new URL('../supabase/migrations/', import.meta.url);
  for (const file of (await readdir(root)).filter(f => f.endsWith('.sql')).sort()) {
    try { await db.exec((await readFile(new URL(file, root), 'utf8')).replace(/\r\n/g, '\n')); }
    catch (e) { throw new Error(`Migration ${file}: ${e.message}`); }
  }
}, { timeout: 120000 });
after(() => db.close());
async function one(sql, params = []) { return (await db.query(sql, params)).rows[0]; }
async function change(user, action, payload) {
  return one('select * from public.mutate_business_onboarding_v1($1,$2,$3)', [user, action, payload]);
}
function payload(d, extra = {}) { return { draftId: d.id, revision: d.revision, sourceRevision: d.source_revision, ...extra }; }
async function start(user = `onboarding-test-${randomUUID()}`, input = { intakeType: 'website', websiteUrl: 'https://example.com' }) {
  return change(user,'start',{ requestKey: randomUUID(), input });
}
async function identity(d, name='User chosen name') { return change(d.user_id,'identity',payload(d,{ businessName:name,logo:null })); }
async function submit(d) { return change(d.user_id,'submit',payload(d,{ primaryGoals:['increase_revenue','increase_engagement'],timezone:'Asia/Calcutta' })); }
const analysis = { businessName:'Analyzed name',productSummary:'A factual business summary',category:'Productivity',
  categories:['Productivity'],businessModel:null,campaignPurposes:[],targetAudience:[],valueProps:[],mainProblem:null,
  mainPromise:null,painPoints:[],differentiators:[],brandTone:null,carouselAngles:[],pexelsImageQueries:[],visualKeywords:[],
  recommendedCarouselStructure:[],ctaIdeas:[],claimsToAvoid:['Unsupported claims'],missingInfo:[],confidence:'high',confidenceReason:null };
async function analyze(d) {
  const a=await one(`insert into website_analyses(user_id,project_id,source_job_id,source_type,website_url,analysis_json,confidence)
    values($1,'default-project',$2,'website','https://example.com',$3,'high') returning *`,[d.user_id,d.source_job_id,analysis]);
  return change(d.user_id,'attach',payload(d,{jobId:d.source_job_id,analysisId:a.id}));
}
async function finalize(d) { return change(d.user_id,'finalize',payload(d,{jobId:d.finalization_job_id,analysis})); }

test('fresh submission atomically persists a draft and one recoverable job', async () => {
  const d=await start();
  assert.equal(d.step,2);
  assert.equal(d.analysis_id,null);
  assert.equal(await one('select id from business_profiles where user_id=$1',[d.user_id]),undefined);
  const job=await one('select * from background_jobs where id=$1',[d.source_job_id]);
  assert.equal(job.status,'queued'); assert.equal(job.input_json.onboardingDraftId,d.id);
  const again=await change(d.user_id,'start',{requestKey:randomUUID(),input:d.source_input});
  assert.equal(again.source_job_id,d.source_job_id);
  assert.equal(again.revision,d.revision);
});
test('answers first: no trial before analysis, then one completion preserving user input', async () => {
  let d=await submit(await identity(await start()));
  assert.equal(d.finalization_job_id,null);
  assert.equal(await one('select user_id from free_trial_entitlements where user_id=$1',[d.user_id]),undefined);
  d=await analyze(d); assert.ok(d.finalization_job_id);
  d=await finalize(d); assert.ok(d.completed_at);
  const p=await one('select * from business_profiles where id=$1',[d.profile_id]);
  assert.equal(p.context_json.businessName,'User chosen name');
  assert.deepEqual(p.context_json.claimsToAvoid,['Unsupported claims']);
  assert.deepEqual(p.context_json.campaignPurposes,['conversion','education']);
  assert.equal(p.trending_timezone,'Asia/Calcutta');
  assert.equal(p.onboarding_status,'completed'); assert.equal(p.onboarding_version,3);
  const again=await finalize(d); assert.deepEqual(again.completed_at,d.completed_at);
  const p2=await one('select * from business_profiles where id=$1',[d.profile_id]);
  assert.equal(p2.profile_version,p.profile_version); assert.deepEqual(p2.onboarding_completed_at,p.onboarding_completed_at);
  assert.equal((await one('select count(*)::int n from free_trial_entitlements where user_id=$1',[d.user_id])).n,1);
});
test('analysis first never submits or navigates the saved step backwards', async () => {
  let d=await identity(await start()); const rev=d.revision;
  d=await analyze(d); assert.equal(d.step,3); assert.equal(d.revision,rev); assert.equal(d.submitted_at,null);
  assert.equal(d.finalization_job_id,null);
  d=await submit(d); assert.ok(d.finalization_job_id);
  const replay=await change(d.user_id,'attach',payload(d,{jobId:d.source_job_id,analysisId:d.analysis_id}));
  assert.equal(replay.finalization_job_id,d.finalization_job_id);
  assert.ok((await finalize(d)).completed_at);
});
test('stale autosaves cannot overwrite newer goals or reopen submission', async () => {
  let d=await identity(await start()); const old=d;
  d=await change(d.user_id,'goals',payload(d,{primaryGoals:['grow_views']}));
  await assert.rejects(change(d.user_id,'goals',payload(old,{primaryGoals:['generate_leads']})),/revision_conflict/);
  const before=d; d=await submit(d);
  await assert.rejects(change(d.user_id,'goals',payload(before,{primaryGoals:[]})),/revision_conflict/);
  assert.deepEqual((await one('select primary_goals from business_onboarding_drafts where id=$1',[d.id])).primary_goals,['increase_revenue','increase_engagement']);
});
test('a replaced website invalidates late analysis and retains identity/goals', async () => {
  let d=await identity(await start()); const old=d;
  d=await change(d.user_id,'start',{revision:d.revision,requestKey:randomUUID(),input:{intakeType:'website',websiteUrl:'https://example.org'}});
  assert.equal(d.source_revision,old.source_revision+1); assert.equal(d.business_name,old.business_name);
  const late=await analyze(old); assert.equal(late.analysis_id,null); assert.equal(late.source_job_id,d.source_job_id);
  await assert.rejects(change(d.user_id,'start',{requestKey:randomUUID(),input:{intakeType:'website',websiteUrl:'https://example.net'}}),/revision_conflict/);
});
test('withdrawing submission fences the old finalizer; resubmission gets a new job', async () => {
  let d=await submit(await analyze(await identity(await start()))); const old=d;
  d=await change(d.user_id,'edit',payload(d));
  assert.equal(d.submitted_at,null); assert.equal(d.finalization_job_id,null);
  assert.equal((await finalize(old)).completed_at,null);
  d=await submit(d); assert.notEqual(d.finalization_job_id,old.finalization_job_id);
  assert.ok((await finalize(d)).completed_at);
});
test('owner and source-job mismatches cannot attach someone else\'s analysis', async () => {
  const d=await start(), other=await analyze(await start());
  await assert.rejects(change(other.user_id,'identity',payload(d,{businessName:'Stolen'})),/draft_not_found/);
  await assert.rejects(change(d.user_id,'attach',payload(d,{jobId:d.source_job_id,analysisId:other.analysis_id})),/analysis_mismatch/);
});
test('invalid answers and analysis cannot grant dashboard access', async () => {
  const d=await start();
  await assert.rejects(submit(d),/answers_required/);
  await assert.rejects(change(d.user_id,'identity',payload(d,{businessName:''})),/name_required/);
  const ready=await submit(await analyze(await identity(d)));
  await assert.rejects(change(ready.user_id,'finalize',payload(ready,{jobId:ready.finalization_job_id,analysis:{...analysis,businessName:'different'}})),/analysis_changed/);
});
test('legacy writers cannot insert or reset a draft-managed profile', async () => {
  let d=await start();
  await assert.rejects(db.query(`insert into business_profiles(user_id,intake_type,context_json,content_hash) values($1,'website','{}','legacy')`,[d.user_id]),/legacy_write_rejected/);
  d=await finalize(await submit(await analyze(await identity(d))));
  await assert.rejects(db.query(`update business_profiles set context_json='{}' where id=$1`,[d.profile_id]),/legacy_write_rejected/);
  await db.query(`update business_profiles set preparation_status='preparing' where id=$1`,[d.profile_id]);
});
test('anonymous clients cannot read drafts or execute transition functions', async () => {
  assert.equal((await one(`select has_table_privilege('anon','public.business_onboarding_drafts','SELECT') allowed`)).allowed,false);
  assert.equal((await one(`select has_function_privilege('authenticated','public.mutate_business_onboarding_v1(text,text,jsonb)','EXECUTE') allowed`)).allowed,false);
});

test('the service role can execute the complete protocol with RLS enabled', async () => {
  await db.exec('set role service_role');
  try {
    const d = await finalize(await submit(await analyze(await identity(await start()))));
    assert.ok(d.completed_at);
  } finally { await db.exec('reset role'); }
});

test('a crash before queue publication leaves accepted work recoverable on resume', async () => {
  let d = await submit(await identity(await start()));
  d = await analyze(d);
  // Neither queued job was published. A fresh read still has both durable IDs.
  const resumed = await one('select * from business_onboarding_drafts where user_id=$1', [d.user_id]);
  assert.equal(resumed.finalization_job_id, d.finalization_job_id);
  const jobs = (await db.query('select status,queue_message_id from background_jobs where id=any($1::uuid[])',
    [[d.source_job_id,d.finalization_job_id]])).rows;
  assert.equal(jobs.length,2);
  for (const job of jobs) { assert.equal(job.status,'queued'); assert.equal(job.queue_message_id,null); }
  const completed = await finalize(resumed);
  // Simulate a crash after profile commit, before content preparation: replay
  // returns the same profile and never creates another trial or profile version.
  assert.equal((await finalize(completed)).profile_id,completed.profile_id);
});

test('a queue-insert failure rolls back acceptance instead of leaving an orphan draft', async () => {
  const user = `onboarding-test-${randomUUID()}`;
  await db.exec(`create function public.fail_onboarding_test_job() returns trigger language plpgsql as $$
    begin raise exception 'injected_queue_failure'; end $$;
    create trigger fail_onboarding_test_job before insert on background_jobs for each row execute function public.fail_onboarding_test_job();`);
  try {
    await assert.rejects(start(user), /injected_queue_failure/);
    assert.equal(await one('select id from business_onboarding_drafts where user_id=$1',[user]),undefined);
  } finally {
    await db.exec('drop trigger fail_onboarding_test_job on background_jobs; drop function public.fail_onboarding_test_job()');
  }
  assert.ok((await start(user)).source_job_id);
});

test('manual recovery preserves saved answers and fences the failed website', async () => {
  let d = await submit(await identity(await start()));
  const old = d;
  d = await change(d.user_id,'edit',payload(d));
  d = await change(d.user_id,'start',{revision:d.revision,requestKey:randomUUID(),input:{intakeType:'manual',manual:{businessName:'Manual name'}}});
  assert.equal(d.business_name,old.business_name);
  assert.deepEqual(d.primary_goals,old.primary_goals);
  assert.equal(d.source_input.intakeType,'manual');
  assert.equal((await analyze(old)).analysis_id,null);
});

test('a pending legacy setup keeps its original protocol', async () => {
  const user = `legacy-test-${randomUUID()}`;
  await db.query(`select public.create_or_get_background_job_v1($1,$2,'legacy','media_analysis',3,'default-project','ai-generation',$3)`,
    [randomUUID(),{operation:'business_profile_setup',userId:user,intakeType:'website',websiteUrl:'https://example.com'},user]);
  await assert.rejects(start(user), /legacy_profile/);
  assert.equal(await one('select id from business_onboarding_drafts where user_id=$1',[user]),undefined);
  // Its original writer is still allowed to save the analyzed legacy profile.
  await db.query(`insert into business_profiles(user_id,intake_type,context_json,content_hash) values($1,'website',$2,'legacy')`,[user,analysis]);
  assert.ok(await one('select id from business_profiles where user_id=$1',[user]));
});
