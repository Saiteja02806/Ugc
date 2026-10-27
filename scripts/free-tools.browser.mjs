import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'file:///C:/Users/chund/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {bundleStatus,claimBundleDownload} from '../lib/resources/hook-video-bundle.ts';
import {createHookBundleHandlers} from '../lib/resources/hook-video-bundle-api.ts';
import {createBatchNotificationHandler} from '../lib/resources/batch-notification-api.ts';

// Isolated browser evidence: actual components, handlers and archive generator;
// storage/media/auth fixtures. Never consumes a production download slot.
const base=process.env.FREE_TOOLS_PREVIEW_URL || 'http://127.0.0.1:3154';
const out=process.env.FREE_TOOLS_ARTIFACTS;
if(!out)throw new Error('Set FREE_TOOLS_ARTIFACTS to a task-owned artifact directory.');
await mkdir(out,{recursive:true});
const hash=value=>createHash('sha256').update(value).digest('hex');
const bundleHash=hash('free tools browser fixture');
let state=null,generation=0,unavailable=false,notifyUnavailable=false,notifyLimited=false,posts=0;
const emails=new Set();
const store={async read(){return state?{generation:String(generation),value:structuredClone(state)}:null},async replace(expected,value){if(expected!==String(generation))return false;state=structuredClone(value);generation++;return true}};
const entries=Array.from({length:104},(_,i)=>{const bytes=Buffer.from('fixture clip '+i);return {name:`Hook-${String(i+1).padStart(3,'0')}.mp4`,size:bytes.length,sha256:hash(bytes),async *open(){yield bytes}}});
const api=createHookBundleHandlers({store,bundleHash,videoCount:104,async prepare(){await new Promise(r=>setTimeout(r,200));return entries}});
const notify=createBatchNotificationHandler(async email=>{if(notifyUnavailable)throw new Error('fixture failure');if(notifyLimited)return 'limited';await new Promise(r=>setTimeout(r,250));emails.add(email);return 'saved'});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-proxy-server']});
const context=await browser.newContext({acceptDownloads:true});
await context.route(/\/api\/resources\/hook-video-bundle(?:[/?].*)?$/,async route=>{
  const original=route.request();assert.equal(original.headers()['authorization'],undefined);
  const request=new Request(original.url(),{method:original.method(),headers:original.headers(),...(original.method()==='POST'?{body:original.postData()}: {})});
  let response;
  if(new URL(request.url).pathname.endsWith('/notify'))response=await notify(request);
  else if(unavailable)response=Response.json({error:'fixture unavailable'},{status:503});
  else {if(request.method==='POST')posts++;response=await api[request.method](request)}
  await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:Buffer.from(await response.arrayBuffer())});
});
const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
const videoButton=()=>page.getByRole('button',{name:'Download Batch 1 · 104 videos',exact:true});
const available=async()=>{await page.goto(`${base}/free-tools`,{waitUntil:'networkidle'});await videoButton().waitFor();await page.waitForFunction(()=>!document.querySelector('button[type=submit]')?.disabled)};
try {
  for(const width of [1366,768,390,320]) {
    await page.setViewportSize({width,height:900});await available();
    assert.equal(await page.locator('h1').count(),1);assert.equal(await page.locator('article').count(),2);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    assert.ok(await videoButton().evaluate(el=>el.getBoundingClientRect().height)>=48);
    assert.equal(await page.locator('input[type=email]').count(),0);
    if(width>=768){await page.getByRole('navigation',{name:'Primary navigation'}).getByRole('link',{name:'Free tools',exact:true}).waitFor();await page.getByRole('navigation').getByRole('link',{name:'Guide',exact:true}).waitFor();}
    else {await page.getByLabel('Open navigation menu').click();const link=page.locator('details').getByRole('link',{name:'Free tools',exact:true});await link.waitFor();await link.click();assert.equal(await page.locator('details').getAttribute('open'),null)}
    await page.screenshot({path:path.join(out,`free-tools-${width}.png`),fullPage:true});
    await page.evaluate(()=>scrollTo(0,600));await page.waitForTimeout(400);
    const header=page.locator('header>div').first();assert.ok(await header.evaluate(el=>el.scrollWidth<=el.clientWidth),'Scrolled header fits');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.screenshot({path:path.join(out,`scrolled-${width}.png`)});
  }
  assert.equal((await bundleStatus(store,bundleHash)).count,0,'Page visits and navigation never count');
  const pdfPromise=page.waitForEvent('download');await page.getByRole('link',{name:'Download 110 free hooks',exact:true}).click();const pdf=await pdfPromise;await pdf.saveAs(path.join(out,'resource.pdf'));assert.equal(await pdf.failure(),null);
  const expectedPdf=await readFile(new URL('../public/resources/ugc-pilot-110-hooks.pdf',import.meta.url));assert.equal(hash(await readFile(path.join(out,'resource.pdf'))),hash(expectedPdf));
  assert.equal((await bundleStatus(store,bundleHash)).count,0,'PDF is unlimited and separate from video counter');
  const zipPromise=page.waitForEvent('download');await videoButton().focus();await page.keyboard.press('Enter');const zip=await zipPromise;await zip.saveAs(path.join(out,'fixture-videos.zip'));assert.equal(await zip.failure(),null);assert.equal(zip.suggestedFilename(),'UGCPilot-Hook-Video-Bundle.zip');
  await page.getByRole('button',{name:'Download started',exact:true}).waitFor();assert.equal(posts,1);assert.equal((await bundleStatus(store,bundleHash)).count,1);
  state=null;generation=0;for(let i=0;i<99;i++)await claimBundleDownload(store,bundleHash,randomUUID());
  await available();const lastPromise=page.waitForEvent('download');await videoButton().click();await (await lastPromise).path();
  await page.getByRole('button',{name:'Batch 1 completed',exact:true}).waitFor();assert.equal((await bundleStatus(store,bundleHash)).count,100);
  await page.reload({waitUntil:'networkidle'});await page.getByText('Batch 1 is fully downloaded. Wait for Batch 2.',{exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Batch 1 completed'}).isDisabled(),true);
  assert.equal(await page.getByRole('link',{name:'Download 110 free hooks',exact:true}).isVisible(),true);
  await page.screenshot({path:path.join(out,'batch-complete-320.png'),fullPage:true});
  await page.getByLabel('Email address').fill('Founder@example.com');await page.getByRole('checkbox').check();
  notifyUnavailable=true;await page.getByRole('button',{name:'Notify me about Batch 2'}).click();await page.locator('main [role=alert]').waitFor();assert.equal(emails.size,0);assert.equal(await page.getByLabel('Email address').inputValue(),'Founder@example.com');
  notifyUnavailable=false;notifyLimited=true;await page.getByRole('button',{name:'Notify me about Batch 2'}).click();await page.getByText('Too many requests. Please try again later.').waitFor();assert.equal(emails.size,0);
  notifyLimited=false;await page.getByRole('button',{name:'Notify me about Batch 2'}).click();await page.getByText('Your request is saved.',{exact:false}).waitFor();assert.deepEqual([...emails],['founder@example.com']);
  await page.screenshot({path:path.join(out,'notification-saved-320.png'),fullPage:true});
  state=null;generation=0;unavailable=true;await page.reload({waitUntil:'networkidle'});await page.locator('main [role=alert]').waitFor();assert.equal(await videoButton().isDisabled(),true);assert.equal(await page.getByRole('link',{name:'Download 110 free hooks',exact:true}).isVisible(),true);
  unavailable=false;await page.getByRole('button',{name:'Check availability again'}).click();await page.waitForFunction(()=>!document.querySelector('button[type=submit]')?.disabled);
  await page.goto(`${base}/hook-video-bundle`,{waitUntil:'networkidle'});await videoButton().waitFor();assert.equal(await page.locator('h1').count(),1);await page.getByRole('link',{name:'Free tools',exact:true}).waitFor();
  for(const width of [1366,390]){await page.setViewportSize({width,height:900});await page.goto(`${base}/before`,{waitUntil:'networkidle'});await page.screenshot({path:path.join(out,`header-before-${width}.png`),fullPage:true})}
  assert.deepEqual(errors,[]);
  await writeFile(path.join(out,'results.json'),JSON.stringify({result:'PASS',widths:[1366,768,390,320],checks:['navigation desktop/mobile and scrolled header','unlimited original PDF exact hash','native keyboard ZIP download','100th download and exhausted reload','optional email consent, failure, rate limit, retry and saved state','storage outage does not block PDF','direct bundle page'],boundary:'Actual components and handlers; isolated auth, storage and small video fixtures. No deployed acceptance or emails sent.'},null,2));
  console.log('Free tools browser checks PASS');
} catch(error) { console.log((await page.locator('body').innerText()).slice(-2200)); await page.screenshot({path:path.join(out,'failure-debug.png'),fullPage:true}); throw error; } finally {await browser.close()}

