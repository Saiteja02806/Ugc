// Real, independent Postgres sessions. No production credentials or host ports.
import { spawn } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import test, { before, after } from 'node:test';

const container = `ugc-onboarding-test-${randomUUID().slice(0,8)}`;
let created = false;
function command(args, input='') {
  return new Promise((resolve,reject) => {
    const child=spawn('docker',args,{windowsHide:true,stdio:['pipe','pipe','pipe']});
    let out='',err=''; child.stdout.on('data',d=>out+=d); child.stderr.on('data',d=>err+=d);
    child.on('error',reject); child.on('close',code=>code===0?resolve(out.trim()):reject(new Error(err || out)));
    child.stdin.end(input);
  });
}
function sql(query) { return command(['exec','-i',container,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres'],query); }
const quote = value => `'${String(value).replaceAll("'","''")}'`;
function transition(user,action,payload) {
  return `select row_to_json(d) from public.mutate_business_onboarding_v1(${quote(user)},${quote(action)},${quote(JSON.stringify(payload))}::jsonb) d;`;
}
async function mutate(user,action,payload) { return JSON.parse(await sql(transition(user,action,payload))); }
before(async () => {
  await command(['run','--rm','-d','--name',container,'-e','POSTGRES_PASSWORD=isolated-test-only','postgres:17-alpine']);
  created=true;
  for (let i=0;i<30;i++) {
    try { await sql('select 1;'); break; }
    catch (e) { if(i===29)throw e; await new Promise(r=>setTimeout(r,500)); }
  }
  await sql('create role anon; create role authenticated; create role service_role bypassrls; create schema extensions;');
  const root=new URL('../supabase/migrations/',import.meta.url);
  for (const file of (await readdir(root)).filter(f=>f.endsWith('.sql')).sort()) {
    try { await sql((await readFile(new URL(file,root),'utf8')).replace(/\r\n/g,'\n')); }
    catch(e) { throw new Error(`Migration ${file}: ${e.message}`); }
  }
}, {timeout:180000});
after(async () => { if(created) await command(['stop',container]); });

async function identityDraft() {
  const user=`concurrency-${randomUUID()}`;
  let d=await mutate(user,'start',{requestKey:randomUUID(),input:{intakeType:'website',websiteUrl:'https://example.com'}});
  d=await mutate(user,'identity',{draftId:d.id,revision:d.revision,businessName:'Owner choice',logo:null});
  return d;
}
test('two independent sessions saving the same revision allow exactly one write', async () => {
  const d=await identityDraft();
  const results=await Promise.allSettled([
    mutate(d.user_id,'goals',{draftId:d.id,revision:d.revision,primaryGoals:['grow_views']}),
    mutate(d.user_id,'goals',{draftId:d.id,revision:d.revision,primaryGoals:['generate_leads']}),
  ]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  assert.match(results.find(r=>r.status==='rejected').reason.message,/revision_conflict/);
});
test('concurrent final submit and analysis attachment schedule exactly one finalizer', async () => {
  const d=await identityDraft();
  const analysisId=await sql(`insert into website_analyses(user_id,project_id,source_job_id,source_type,confidence,analysis_json)
    values(${quote(d.user_id)},'default-project',${quote(d.source_job_id)},'website','high','{}') returning id;`);
  const results=await Promise.allSettled([
    mutate(d.user_id,'submit',{draftId:d.id,revision:d.revision,primaryGoals:['generate_leads'],timezone:'UTC'}),
    mutate(d.user_id,'attach',{draftId:d.id,sourceRevision:d.source_revision,jobId:d.source_job_id,analysisId}),
  ]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,2,JSON.stringify(results));
  assert.equal(await sql(`select count(*) from background_jobs where user_id=${quote(d.user_id)} and input_json->>'finalizeOnly'='true';`),'1');
});
test('duplicate finalizers commit one profile and preserve one trial timestamp', async () => {
  let d=await identityDraft();
  const analysis={businessName:'Analysis name',category:null};
  const analysisId=await sql(`insert into website_analyses(user_id,project_id,source_job_id,source_type,confidence,analysis_json)
    values(${quote(d.user_id)},'default-project',${quote(d.source_job_id)},'website','high',${quote(JSON.stringify(analysis))}) returning id;`);
  d=await mutate(d.user_id,'attach',{draftId:d.id,sourceRevision:d.source_revision,jobId:d.source_job_id,analysisId});
  d=await mutate(d.user_id,'submit',{draftId:d.id,revision:d.revision,primaryGoals:['generate_leads'],timezone:'UTC'});
  const input={draftId:d.id,sourceRevision:d.source_revision,jobId:d.finalization_job_id,analysis};
  const [a,b]=await Promise.all([mutate(d.user_id,'finalize',input),mutate(d.user_id,'finalize',input)]);
  assert.equal(a.profile_id,b.profile_id); assert.equal(a.completed_at,b.completed_at);
  assert.equal(await sql(`select count(*) from free_trial_entitlements where user_id=${quote(d.user_id)};`),'1');
});
