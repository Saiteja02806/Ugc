// Real, independent Postgres sessions. No production credentials or host ports.
import { spawn } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { randomUUID, createHash } from 'node:crypto';
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

async function mcpState(user,enrolled=true) {
 return JSON.parse(await sql(`select public.mcp_read_business_onboarding(${quote(user)},${enrolled});`));
}
const mcpFence=state=>({mode:state.mode,profile_revision:state.profile_revision,draft_id:state.draft?.id??null,draft_revision:state.draft?.revision??null});
function mcpStatement(user,key,input,prepared={},enrolled=true) {
 return `select public.mcp_mutate_business_onboarding(${quote(user)},${quote(key)},${quote(JSON.stringify(input))}::jsonb,${quote(JSON.stringify(prepared))}::jsonb,${enrolled});`;
}
async function mcpChange(user,key,input,prepared={},enrolled=true) {return JSON.parse(await sql(mcpStatement(user,key,input,prepared,enrolled)));}

test('concurrent identical MCP start requests return one immutable receipt and one analysis',async()=>{
 const user=`mcp-concurrency-${randomUUID()}`,key=randomUUID(),input={expected_state:mcpFence(await mcpState(user)),change:{action:'start',source:{intakeType:'website',websiteUrl:'https://example.com'}}};
 const results=await Promise.all([mcpChange(user,key,input),mcpChange(user,key,input)]);
 assert.equal(results.filter(result=>result.replayed).length,1);assert.deepEqual(results[0].receipt,results[1].receipt);
 assert.equal(await sql(`select count(*) from background_jobs where user_id=${quote(user)};`),'1');
 assert.equal(await sql(`select count(*) from mcp_business_onboarding_requests where user_id=${quote(user)};`),'1');
});
test('independent website and MCP saves of the same background revision accept exactly one',async()=>{
 const draft=await identityDraft(),state=await mcpState(draft.user_id);
 const result=await Promise.allSettled([
  mutate(draft.user_id,'goals',{draftId:draft.id,revision:draft.revision,primaryGoals:['grow_views']}),
  mcpChange(draft.user_id,randomUUID(),{expected_state:mcpFence(state),change:{action:'goals',primary_goals:['generate_leads']}}),
 ]);
 assert.equal(result.filter(item=>item.status==='fulfilled').length,1);
 assert.match(result.find(item=>item.status==='rejected').reason.message,/revision_conflict/);
});
test('legacy REST row-before-owner locking returns busy instead of deadlocking MCP owner-before-row',async()=>{
 const user=`mcp-lock-${randomUUID()}`;
 await sql(`insert into public.business_profiles(user_id,intake_type,context_json,content_hash) values(${quote(user)},'manual','{"businessName":"Fixture"}','fixture');`);
 const state=await mcpState(user),tag=`mcp-profile-lock-${randomUUID()}`;
 const holding=sql(`begin;set application_name=${quote(tag)};select id from business_profiles where user_id=${quote(user)} for update;select pg_sleep(3);update business_profiles set context_json=context_json||'{"businessName":"Website later"}'::jsonb,updated_at=now() where user_id=${quote(user)};commit;`);
 for(let tries=0;tries<60;tries++) {
  const sleeping=await sql(`select count(*) from pg_stat_activity where application_name=${quote(tag)} and wait_event='PgSleep';`);
  if(sleeping==='1')break;
  if(tries===59)throw Error('The independent row-lock holder never reached its sleep barrier');
  await new Promise(resolve=>setTimeout(resolve,25));
 }
 const started=Date.now();
 await assert.rejects(mcpChange(user,randomUUID(),{expected_state:mcpFence(state),change:{action:'goals',primary_goals:['generate_leads']}}),/could not obtain lock/);
 assert.ok(Date.now()-started<2000,'NOWAIT should release the owner lock before the legacy writer reaches its guard');
 await holding;
 const current=await mcpState(user);assert.equal(current.profile.context_json.businessName,'Website later');assert.deepEqual(current.profile.primary_goals,[]);
 assert.equal(await sql(`select count(*) from mcp_business_onboarding_requests where user_id=${quote(user)};`),'0');
});

test('concurrent identical logo reservations accept one stable target with no duplicate',async()=>{
 const owner=`logo-concurrency-${randomUUID()}`,request=randomUUID(),input={file_name:'logo.png',mime_type:'image/png',file_size_bytes:100,sha256:'a'.repeat(64)},prefix=`business-profile-logos/${createHash('sha256').update(owner).digest('hex')}/`;
 const reserve=key=>sql(`select mcp_reserve_business_logo(${quote(owner)},${quote(request)},${quote(JSON.stringify(input))}::jsonb,${quote(prefix+key+'.png')});`).then(JSON.parse);
 const result=await Promise.all([reserve(randomUUID()),reserve(randomUUID())]);assert.equal(result.filter(value=>value.replayed).length,1);assert.equal(result[0].upload.id,result[1].upload.id);assert.equal(await sql(`select count(*) from mcp_business_logo_uploads where user_id=${quote(owner)};`),'1');
});
test('concurrent duplicate logo confirmations retain one immutable verified descriptor',async()=>{
 const owner=`logo-confirm-${randomUUID()}`,request=randomUUID(),key=`business-profile-logos/${createHash('sha256').update(owner).digest('hex')}/${randomUUID()}.png`,input={file_name:'logo.png',mime_type:'image/png',file_size_bytes:100,sha256:'a'.repeat(64)};
 const reserved=JSON.parse(await sql(`select mcp_reserve_business_logo(${quote(owner)},${quote(request)},${quote(JSON.stringify(input))}::jsonb,${quote(key)});`));
 const logo={storageKey:key,url:`https://media.example.com/${key}`,mimeType:'image/png',fileSizeBytes:100,width:128,height:128};
 const statement=`select mcp_confirm_business_logo(${quote(owner)},${quote(reserved.upload.id)},${quote(JSON.stringify(logo))}::jsonb,${quote(input.sha256)});`;
 const result=await Promise.all([sql(statement).then(JSON.parse),sql(statement).then(JSON.parse)]);assert.deepEqual(result[0],result[1]);assert.equal(result[0].status,'ready');
});
