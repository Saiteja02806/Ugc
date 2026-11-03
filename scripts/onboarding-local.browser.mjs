// Run against `npm run dev`. Actual Next pages, Firebase client SDK and controls;
// Firebase HTTP and application API transport are isolated from hosted systems.
// All setup mutations execute the canonical SQL in a fresh local PGlite database.
// This is NOT a live Firebase, Next route-handler or worker acceptance test.
import assert from 'node:assert/strict';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp';
import { BusinessProfileSetupInputSchema } from '../lib/business-profiles/setup.ts';
import { WebsiteBusinessAnalysisSchema } from '../lib/website-analysis/schema.ts';

const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); }
catch { pw = require(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
const base = process.env.ONBOARDING_LOCAL_URL || 'http://localhost:3000';
assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname),'Local server only');
const out = path.resolve('.tmp/onboarding-local');
await mkdir(out,{recursive:true});
const db = new PGlite({extensions:{pgcrypto,uuid_ossp}});
const one = async (sql,params=[]) => (await db.query(sql,params)).rows[0];
const mutate = async (owner,action,payload) => (await one('select * from public.mutate_business_onboarding_v1($1,$2,$3)',[owner,action,payload]));
const draftFor = owner => one('select * from business_onboarding_drafts where user_id=$1',[owner]);
const events = [];
const failures = [];
let browser;
try {
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls; create schema extensions;');
  for (const file of (await readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')).sort()) {
    await db.exec((await readFile(`supabase/migrations/${file}`,'utf8')).replace(/\r\n/g,'\n'));
  }
  browser = await pw.chromium.launch({headless:true,channel:'msedge',args:['--disk-cache-size=1']});
  const cases = [['desktop',1440],['mobile',390]].filter(([name])=>!process.env.ONBOARDING_VIEWPORT||process.env.ONBOARDING_VIEWPORT===name);
  for (const [name,width] of cases) {
    const owner = `local-onboarding-${name}-${randomUUID()}`;
    const email = `${name}@example.test`;
    const tokenPayload = {sub:owner,user_id:owner,iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+3600,email,email_verified:true,firebase:{sign_in_provider:'password',identities:{email:[email]}}};
    const token = `${Buffer.from(JSON.stringify({alg:'none',typ:'JWT'})).toString('base64url')}.${Buffer.from(JSON.stringify(tokenPayload)).toString('base64url')}.local-test`;
    let failSession = false;
    const context = await browser.newContext({viewport:{width,height:width===390?844:1000},timezoneId:'Asia/Calcutta',reducedMotion:'reduce'});
    const page = await context.newPage();
    page.on('dialog',dialog=>dialog.accept());
    page.on('pageerror',error=>failures.push(`${name}: ${error.message}`));
    const json = (route,body,status=200) => route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
    async function publicJob(id) {
      if (!id) return null;
      const row = await one('select * from background_jobs where id=$1',[id]);
      return {id:row.id,jobType:row.job_type,projectId:row.project_id,status:row.status,stage:row.stage,error:row.status==='failed'?{message:'Local simulated source failure',retryable:true}:null,progress:null,output:null,outputReference:null,createdAt:row.created_at,updatedAt:row.updated_at,queuedAt:row.queued_at,startedAt:row.started_at,completedAt:row.completed_at,failedAt:row.failed_at,cancelRequestedAt:null};
    }
    async function session() {
      const d = await draftFor(owner);
      if (!d) return {ok:true,mode:'background',draft:null};
      const a = d.analysis_id ? await one('select analysis_json from website_analyses where id=$1',[d.analysis_id]) : null;
      return {ok:true,mode:'background',draft:{id:d.id,revision:d.revision,sourceRevision:d.source_revision,sourceInput:d.source_input,businessName:d.business_name,suggestedName:a?.analysis_json.businessName??null,logoStorageKey:null,logoUrl:null,primaryGoals:d.primary_goals,step:d.step,submitted:!!d.submitted_at,completed:!!d.completed_at,analysisReady:!!d.analysis_id,analysisJob:await publicJob(d.source_job_id),finalizationJob:await publicJob(d.finalization_job_id)}};
    }
    await context.route('**/*',async route=>{
      const req = route.request();
      const url = new URL(req.url());
      if (url.hostname==='identitytoolkit.googleapis.com') {
        const user = {localId:owner,email,emailVerified:true,displayName:'Local onboarding test',providerUserInfo:[{providerId:'password',rawId:email,email}],createdAt:String(Date.now()),lastLoginAt:String(Date.now())};
        events.push({name,auth:url.pathname});
        if (url.pathname.endsWith(':signInWithPassword')) {
          const body = req.postDataJSON();
          if (body.password!=='Local-only-password') return json(route,{error:{message:'INVALID_LOGIN_CREDENTIALS'}},400);
          return json(route,{kind:'identitytoolkit#VerifyPasswordResponse',localId:owner,email,displayName:user.displayName,idToken:token,refreshToken:'local-refresh',expiresIn:'3600',registered:true});
        }
        if (url.pathname.endsWith(':lookup')) return json(route,{users:[user]});
        return json(route,{error:{message:'LOCAL_TEST_UNSUPPORTED_AUTH'}},400);
      }
      if (url.hostname==='securetoken.googleapis.com') return json(route,{access_token:token,id_token:token,refresh_token:'local-refresh',expires_in:'3600',user_id:owner,token_type:'Bearer'});
      if (url.origin!==new URL(base).origin) return route.abort();
      if (!url.pathname.startsWith('/api/')) return route.continue();
      try {
        if (url.pathname==='/api/business-profile/onboarding') {
          assert.equal(req.headers().authorization,`Bearer ${token}`);
          if (req.method()==='GET') return failSession ? json(route,{ok:false,message:'Local simulated session unavailable'},503) : json(route,await session());
          const input = req.postDataJSON();
          if (input.action==='start') BusinessProfileSetupInputSchema.parse(input.input);
          events.push({name,action:input.action});
          await mutate(owner,input.action,input);
          return json(route,await session(),['start','submit'].includes(input.action)?202:200);
        }
        if (url.pathname==='/api/business-profile') {
          assert.equal(req.headers().authorization,`Bearer ${token}`);
          const profile = await one('select * from business_profiles where user_id=$1',[owner]);
          return json(route,{ok:true,profile:profile?{id:profile.id,onboardingComplete:profile.onboarding_status==='completed',onboardingVersion:profile.onboarding_version,businessName:profile.context_json.businessName}:null});
        }
        // Do not forward other account, generation, checkout or analytics APIs.
        return json(route,{ok:false,message:'Not part of isolated onboarding test'},404);
      } catch (error) {
        failures.push(`${name}: ${url.pathname}: ${error.message}`);
        return json(route,{ok:false,message:error.message},409);
      }
    });
    const shot = async label => {
      await page.evaluate(()=>document.fonts.ready);
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal page overflow');
      await page.screenshot({path:path.join(out,`${name}-${label}.png`),fullPage:true});
    };
    await page.goto(`${base}/sign-in`,{waitUntil:'domcontentloaded',timeout:240000});
    await page.waitForLoadState('load');
    await page.waitForTimeout(1000);
    await page.getByRole('button',{name:'Continue with email',exact:true}).click();
    await page.getByRole('textbox',{name:'Email',exact:true}).fill(email);
    await page.locator('input[name=password]').fill('Wrong-local-password');
    await page.locator('button[type=submit]').click();
    await page.getByText(/incorrect|invalid|could not sign|wrong|credential/i).first().waitFor({timeout:20000});
    assert.ok(page.url().includes('/sign-in'));
    await shot('01-sign-in');
    await page.locator('input[name=password]').fill('Local-only-password');
    await page.locator('button[type=submit]').click();
    await page.waitForURL(`${base}/explore`,{timeout:120000});
    await page.getByRole('heading',{name:'Explore',exact:true}).waitFor();
    await shot('02-explore');
    // Explore is deliberately public; entering AI Studio enforces setup.
    await page.goto(`${base}/ai-studio`,{waitUntil:'domcontentloaded',timeout:120000});
    await page.waitForURL(`${base}/onboarding`,{timeout:120000});
    await page.getByRole('heading',{name:'Tell us about your product'}).waitFor();
    await shot('03-source');
    // Initial read failure must be recoverable without losing the auth session.
    failSession = true;
    await page.reload({waitUntil:'domcontentloaded'});
    await page.getByText('We couldn’t load your saved setup.').waitFor({timeout:30000});
    await shot('04-load-error');
    failSession = false;
    await page.getByRole('button',{name:'Try again',exact:true}).click();
    await page.getByRole('heading',{name:'Tell us about your product'}).waitFor();
    if (name==='mobile') {
      await page.getByRole('textbox',{name:'Product URL',exact:true}).fill('https://example.test/');
      await page.getByRole('button',{name:'Continue',exact:true}).click();
      await page.getByText('We’re building your content system.').waitFor();
      const d = await draftFor(owner);
      await db.query("update background_jobs set status='failed' where id=$1",[d.source_job_id]);
      await page.getByText('Unable to analyze that URL. Try entering your product details manually.').waitFor({timeout:20000});
      await shot('05-website-fallback');
    } else {
      await page.getByRole('button',{name:'Enter manually',exact:true}).click();
    }
    await page.getByRole('textbox',{name:'Business or product name'}).fill('Moonlight Studio');
    await page.getByRole('textbox',{name:'Product description'}).fill('We help independent coaches turn client notes into clear, personalized training programs.');
    await shot('06-manual');
    await page.getByRole('button',{name:'Continue',exact:true}).click();
    await page.getByText('We’re building your content system.').waitFor();
    await shot('07-progress');
    const d = await draftFor(owner);
    assert.equal(d.source_input.businessName,'Moonlight Studio');
    assert.equal(await one('select user_id from free_trial_entitlements where user_id=$1',[owner]),undefined);
    await page.reload({waitUntil:'domcontentloaded'});
    await page.getByText('We’re building your content system.').waitFor();
    assert.equal((await draftFor(owner)).id,d.id,'Reload resumes saved SQL draft');
    const analysis = WebsiteBusinessAnalysisSchema.parse({businessName:'Moonlight Studio',productSummary:d.source_input.description,category:'Coaching',categories:['Coaching'],businessModel:'b2b',campaignPurposes:[],targetAudience:['Independent coaches'],valueProps:['Personalized programs'],mainProblem:'Manual planning',mainPromise:null,painPoints:[],differentiators:[],brandTone:null,carouselAngles:[],pexelsImageQueries:[],visualKeywords:[],recommendedCarouselStructure:[],ctaIdeas:[],claimsToAvoid:['Unsupported guarantees'],missingInfo:[],confidence:'high',confidenceReason:null});
    const a = await one("insert into website_analyses(user_id,project_id,source_job_id,source_type,analysis_json,confidence) values($1,'default-project',$2,'manual',$3,'high') returning id",[owner,d.source_job_id,analysis]);
    await mutate(owner,'attach',{draftId:d.id,sourceRevision:d.source_revision,jobId:d.source_job_id,analysisId:a.id});
    await db.query("update background_jobs set status='completed',completed_at=now() where id=$1",[d.source_job_id]);
    const submitDeadline = Date.now()+25000;
    while (!(await draftFor(owner)).submitted_at && Date.now()<submitDeadline) await new Promise(resolve=>setTimeout(resolve,200));
    assert.ok((await draftFor(owner)).submitted_at,'Client submitted analyzed identity and goals');
    const submitted = await draftFor(owner);
    assert.deepEqual(submitted.primary_goals,['brand_awareness']);
    assert.equal(submitted.timezone,'Asia/Calcutta');
    await mutate(owner,'finalize',{draftId:submitted.id,sourceRevision:submitted.source_revision,jobId:submitted.finalization_job_id,analysis});
    await db.query("update background_jobs set status='completed',completed_at=now() where id=$1",[submitted.finalization_job_id]);
    await page.getByText('Your content system is ready.').waitFor({timeout:25000});
    await shot('08-complete');
    await page.getByRole('button',{name:'Continue',exact:true}).click();
    await page.waitForURL(`${base}/explore`,{timeout:120000});
    await page.getByRole('heading',{name:'Explore',exact:true}).waitFor();
    await shot('09-return');
    const profile = await one('select * from business_profiles where user_id=$1',[owner]);
    assert.equal(profile.onboarding_status,'completed');
    assert.equal(profile.context_json.businessName,'Moonlight Studio');
    assert.equal((await one('select count(*)::int n from free_trial_entitlements where user_id=$1',[owner])).n,1);
    await page.reload({waitUntil:'domcontentloaded'});
    await page.getByRole('heading',{name:'Explore',exact:true}).waitFor();
    assert.equal(page.url(),`${base}/explore`);
    await page.goto(`${base}/ai-studio`,{waitUntil:'domcontentloaded'});
    await page.waitForTimeout(1500);
    assert.equal(page.url(),`${base}/ai-studio`,'Completed SQL profile grants protected workflow access after a fresh load');
    console.log(`PASS ${name}: actual sign-in UI/SDK → Explore → protected workflow → onboarding → SQL saved/reload → completion → Explore; isolated auth/API/analysis transport`);
    await context.close();
  }
  assert.deepEqual(failures,[]);
  await writeFile(path.join(out,'evidence.json'),JSON.stringify({boundary:'Actual Next UI and Firebase client SDK; simulated Firebase HTTP and API adapter; real canonical local SQL; analysis/finalizer driven locally, no hosted writes or provider calls',events,failures},null,2));
} finally {
  await browser?.close();
  await db.close();
}
