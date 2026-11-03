// Actual route handler + onboarding services + Supabase client + canonical SQL.
// Only authentication verification, PostgREST transport and external queue/content
// publication are substituted. No hosted requests or account mutations.
import assert from 'node:assert/strict';
import { before, after, test, mock } from 'node:test';
import { readFile, readdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp';
import { createClient as actualCreateClient } from '@supabase/supabase-js';

const db = new PGlite({extensions:{pgcrypto,uuid_ossp}});
const owner = `route-onboarding-${randomUUID()}`;
const deferred = [];
const published = [];
const preparations = [];
const one = async (sql,params=[]) => (await db.query(sql,params)).rows[0];
const reply = (body,status=200) => new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
async function sqlTransport(input,init={}) {
  const req = new Request(input,init);
  const url = new URL(req.url);
  try {
    if (url.pathname.endsWith('/rpc/mutate_business_onboarding_v1')) {
      const p = await req.json();
      const row = await one('select * from public.mutate_business_onboarding_v1($1,$2,$3)',[p.p_user_id,p.p_action,p.p_payload]);
      return reply(row);
    }
    const table = url.pathname.split('/').at(-1);
    assert.ok(['business_onboarding_drafts','business_profiles','background_jobs','website_analyses'].includes(table),`Unexpected table ${table}`);
    assert.equal(req.method,'GET');
    const params = [];
    const where = [];
    for (const [column,value] of url.searchParams) {
      if (['select','limit','order'].includes(column)) continue;
      assert.match(column,/^[a-z_]+$/);
      assert.ok(value.startsWith('eq.')||value.startsWith('cs.'),value);
      params.push(value.startsWith('eq.')?value.slice(3):JSON.parse(value.slice(3)));
      where.push(`"${column}" ${value.startsWith('eq.')?'=':'@>'} $${params.length}`);
    }
    const rows = (await db.query(`select * from public.${table}${where.length?' where '+where.join(' and '):''}${url.searchParams.has('limit')?' limit '+Number(url.searchParams.get('limit')):''}`,params)).rows;
    return reply(req.headers.get('accept')?.includes('vnd.pgrst.object')?rows[0]??null:rows);
  } catch(error) { return reply({message:error.message,code:error.code??'LOCAL_SQL_ERROR'},400); }
}
process.env.SUPABASE_URL='http://local-postgrest.test';
process.env.SUPABASE_SERVICE_ROLE_KEY='local-test-key';
process.env.BUSINESS_ONBOARDING_BACKGROUND_ENABLED='true';
mock.module('@supabase/supabase-js',{namedExports:{createClient:(url,key,options)=>actualCreateClient(url,key,{...options,global:{fetch:sqlTransport}})}});
class FirebaseAuthRequestError extends Error {constructor(message,status=401){super(message);this.status=status;}}
mock.module('../lib/firebase/server-auth.ts',{namedExports:{FirebaseAuthRequestError,requireFirebaseUser:async request=>{
  if(request.headers.get('Authorization')!=='Bearer local-route-token')throw new FirebaseAuthRequestError('Sign in to continue.');
  return {uid:owner,emailVerified:true};
}}});
mock.module('next/server',{namedExports:{after:callback=>deferred.push(callback)}});
mock.module('../lib/jobs/gcp-cloud-tasks.ts',{namedExports:{getMissingBackgroundJobCloudTasksEnvVars:()=>[]}});
mock.module('../lib/jobs/background-job-service.ts',{namedExports:{dispatchQueuedBackgroundJobForRecovery:async job=>published.push(job.id),retryAndDispatchBackgroundJob:async()=>{throw Error('Not part of this test');}}});
mock.module('../lib/trending/onboarding-prebuild.ts',{namedExports:{prebuildTrendingAfterOnboarding:async input=>{preparations.push(input);return [{status:'scheduled'}];}}});
mock.module('../lib/trending/hook-video-feature.ts',{namedExports:{areTrendingHookVideosEnabled:()=>false}});
const {GET,POST} = await import('../app/api/business-profile/onboarding/route.ts');
const {finalizeOnboardingJob} = await import('../lib/business-profiles/onboarding-drafts.ts');
const request = (payload,authorized=true) => new Request('http://localhost/api/business-profile/onboarding',{
  method:payload?'POST':'GET',headers:{...(authorized?{Authorization:'Bearer local-route-token'}:{}),'Content-Type':'application/json'},...(payload?{body:JSON.stringify(payload)}:{})});
const send = async payload => {const response=await POST(request(payload));const data=await response.json();assert.ok(response.ok,JSON.stringify(data));return data;};
before(async()=>{
  await db.exec('create role anon;create role authenticated;create role service_role bypassrls;create schema extensions;');
  for(const file of (await readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')).sort())await db.exec((await readFile(`supabase/migrations/${file}`,'utf8')).replace(/\r\n/g,'\n'));
},{timeout:120000});
after(()=>db.close());
test('real onboarding route authenticates, persists, resumes and finalizes through local SQL',async()=>{
  assert.equal((await GET(request(null,false))).status,401);
  assert.equal((await POST(request({action:'invalid'}))).status,400);
  assert.deepEqual(await (await GET(request())).json(),{ok:true,mode:'background',draft:null});
  const input={experience:'streamlined',intakeType:'manual',businessName:'Moonlight Studio',description:'We help independent coaches create personalized training programs.'};
  const started=await send({action:'start',input,requestKey:randomUUID()});
  let d=started.draft;
  assert.ok(d.id);assert.equal(d.analysisReady,false);
  const resumed=await (await GET(request())).json();assert.equal(resumed.draft.id,d.id);
  for(const callback of deferred.splice(0))await callback();
  assert.ok(published.includes(d.analysisJob.id),'Accepted analysis queued after response');
  assert.equal(await one('select user_id from free_trial_entitlements where user_id=$1',[owner]),undefined);
  const analysis={businessName:input.businessName,productSummary:input.description,category:'Coaching',categories:['Coaching'],businessModel:'b2b',campaignPurposes:[],targetAudience:['Coaches'],valueProps:['Personalized programs'],mainProblem:null,mainPromise:null,painPoints:[],differentiators:[],brandTone:null,carouselAngles:[],pexelsImageQueries:[],visualKeywords:[],recommendedCarouselStructure:[],ctaIdeas:[],claimsToAvoid:[],missingInfo:[],confidence:'high',confidenceReason:null};
  const a=await one("insert into website_analyses(user_id,project_id,source_job_id,source_type,analysis_json,confidence) values($1,'default-project',$2,'manual',$3,'high') returning id",[owner,d.analysisJob.id,analysis]);
  await one('select * from mutate_business_onboarding_v1($1,$2,$3)',[owner,'attach',{draftId:d.id,sourceRevision:d.sourceRevision,jobId:d.analysisJob.id,analysisId:a.id}]);
  d=(await (await GET(request())).json()).draft;
  const identity={action:'identity',draftId:d.id,revision:d.revision,businessName:input.businessName,logoStorageKey:null};
  d=(await send(identity)).draft;
  assert.equal((await POST(request(identity))).status,409,'Stale revisions rejected');
  d=(await send({action:'submit',draftId:d.id,revision:d.revision,primaryGoals:['brand_awareness'],timezone:'Asia/Calcutta'})).draft;
  assert.ok(d.finalizationJob.id);
  await finalizeOnboardingJob({userId:owner,jobId:d.finalizationJob.id,draftId:d.id,sourceRevision:d.sourceRevision});
  const done=await (await GET(request())).json();assert.equal(done.draft.completed,true);
  assert.equal(preparations.length,1);assert.equal(preparations[0].timezone,'Asia/Calcutta');
  const p=await one('select * from business_profiles where user_id=$1',[owner]);
  assert.equal(p.onboarding_status,'completed');assert.equal(p.context_json.businessName,input.businessName);
  assert.equal((await one('select count(*)::int n from free_trial_entitlements where user_id=$1',[owner])).n,1);
});
