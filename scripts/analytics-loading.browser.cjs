/* eslint-disable @typescript-eslint/no-require-imports -- Actual components with isolated hosted boundaries. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { webpack } = require("next/dist/compiled/webpack/webpack");
let playwright;
try { playwright = require("playwright"); }
catch { playwright = require(path.join(process.env.USERPROFILE, ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright")); }
const root = path.resolve(__dirname, ".."), out = path.join(root, ".tmp/analytics-loading-browser");
fs.mkdirSync(out, { recursive: true });
const write = (name, data) => fs.writeFileSync(path.join(out, name), data);
write("loader.cjs", `const ts=require(${JSON.stringify(require.resolve("typescript"))});module.exports=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText;`);
write("auth.tsx", `import {createContext,useContext,useState} from 'react';const Auth=createContext(null);export function FixtureAuth({children}){const[uid,setUid]=useState('owner-a');window.switchOwner=setUid;return <Auth value={{user:{uid,emailVerified:true,email:'fixture@example.com'}}}>{children}</Auth>};export const useAuth=()=>useContext(Auth);export const getCurrentUserIdToken=async expected=>{if(expected&&window.currentOwner!==expected)throw Error('Owner changed');return 'fixture-token'};`);
write("link.tsx", `export default function Link({children,...props}){return <a {...props}>{children}</a>}`);
write("entry.tsx", `import {createRoot} from 'react-dom/client';import {useState} from 'react';import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {FixtureAuth,useAuth} from './auth';import {InstagramAnalyticsWorkspace} from '@/components/analytics/instagram-analytics-workspace';
const at='2026-10-19T00:00:00Z';const connection=(platform,index)=>({id:'00000000-0000-4000-8000-00000000000'+index,platform,provider:platform==='youtube'?'google':platform==='tiktok'?'tiktok':'meta',authorizationRevision:'consent-1',connectedAt:at,updatedAt:at,platformAccountId:platform+'-account',platformAccountName:platform==='instagram'?'Instagram Demo':platform==='tiktok'?'TikTok Demo':'YouTube Demo',platformAccountUsername:platform+'demo',status:'connected',scopes:['instagram_business_manage_insights','instagram_business_content_publish','video.list','video.publish'],profilePictureUrl:null,expiresAt:null,refreshExpiresAt:null,supportsBackgroundRefresh:true});
const connections=[connection('instagram',1),connection('tiktok',2),connection('youtube',3)];
function Account(){const{user}=useAuth();const[client]=useState(()=>new QueryClient({defaultOptions:{queries:{retry:false,gcTime:Infinity}}}));const[shown,setShown]=useState(true);window.client=client;window.currentOwner=user.uid;window.showWorkspace=setShown;return <QueryClientProvider client={client}><button onClick={()=>setShown(v=>!v)}>Toggle analytics</button>{shown?<InstagramAnalyticsWorkspace/>:<p>Workspace closed</p>}</QueryClientProvider>}
function App(){const{user}=useAuth();return <Account key={user.uid}/>};window.fixtureConnections=connections;window.visibleFixture=true;Object.defineProperty(document,'visibilityState',{get:()=>window.visibleFixture?'visible':'hidden',configurable:true});Object.defineProperty(document,'hidden',{get:()=>!window.visibleFixture,configurable:true});window.calls={};window.aborts=0;const original=window.fetch;window.fetch=(url,init)=>{const key=new URL(url,location.href).pathname;window.calls[key]=(window.calls[key]||0)+1;init?.signal?.addEventListener('abort',()=>window.aborts++,{once:true});return original(url,init)};createRoot(document.getElementById('root')).render(<FixtureAuth><App/></FixtureAuth>);`);

const id = n => `00000000-0000-4000-8000-00000000000${n}`;
let holdInstagram = true, holdActivity = true, views = 7, needsRefresh = false, complete = false, postFails = false, ownerB = false;
let authorizationRevision="consent-1";
let snapshotFails=false;
let postWithoutJob=false;
const held = [];
const timestamp = () => new Date().toISOString();
function accounts(platform) {
  if (platform === "instagram") return [{connectionId:id(1),accountName:"Instagram Demo",accountUsername:"instagramdemo",status:"ready",lastSyncedAt:timestamp(),message:null,
    daily:[],totals:{views,reach:views,interactions:views},items:[{id:"post-1",connectionId:id(1),accountName:"Instagram Demo",accountUsername:"instagramdemo",caption:"A saved analytics post",contentType:"reel",publishedAt:timestamp(),mediaType:"VIDEO",thumbnailUrl:null,permalink:null,metrics:{views,reach:views,interactions:views,likes:views,comments:0,saves:0,shares:0}}]}];
  return [{connectionId:id(platform === "tiktok"?2:3),accountName:platform==="tiktok"?"TikTok Demo":"YouTube Demo",status:"ready",lastSyncedAt:timestamp(),message:null,videos:[],privatePublishingRecords:[],metrics:{views:0,likes:0,comments:0,estimatedMinutesWatched:0}}];
}
function data(url) { const platform=url.includes("tiktok")?"tiktok":url.includes("youtube")?"youtube":"instagram";return {accounts:accounts(platform),...(platform==="instagram"?{days:30}:{})}; }
function job() {return {id:"job-1",status:complete?"completed":"processing",createdAt:timestamp(),updatedAt:timestamp(),completedAt:complete?timestamp():null,output:complete?data("instagram"):null,error:null};}
function json(res, value, status=200) { if(res.destroyed)return;res.writeHead(status,{"Content-Type":"application/json"});res.end(JSON.stringify(value)); }
function respond(res,url) {
  if(url.includes("activity"))return json(res,{ok:true,activity:{activityRows:[],buckets:[],needsAttention:0,published:0,scheduled:0}});
  return json(res,{ok:true,data:data(url),needsRefresh,refreshKey:needsRefresh?"stale":"fresh"});
}
function release() {holdInstagram=false;holdActivity=false;for(const {res,url} of held.splice(0))respond(res,url);}

async function main(){
  await new Promise((resolve,reject)=>{const compiler=webpack({mode:"development",devtool:false,context:root,entry:path.join(out,"entry.tsx"),output:{path:out,filename:"bundle.js"},resolve:{extensions:[".tsx",".ts",".js"],alias:{"@/contexts/auth-context":path.join(out,"auth.tsx"),"@/lib/firebase/auth":path.join(out,"auth.tsx"),"next/link":path.join(out,"link.tsx"),"@":root}},module:{rules:[{test:/\.tsx?$/,use:path.join(out,"loader.cjs")} ]}});compiler.run((error,stats)=>compiler.close(()=>error||stats.hasErrors()?reject(error||Error(stats.toString({all:false,errors:true}))):resolve()));});
  const server=http.createServer((req,res)=>{
    const url=new URL(req.url,"http://fixture");
    if(url.pathname==="/bundle.js"){res.writeHead(200,{"Content-Type":"text/javascript"});return fs.createReadStream(path.join(out,"bundle.js")).pipe(res);}
    if(!url.pathname.startsWith("/api/")){res.writeHead(200,{"Content-Type":"text/html; charset=utf-8"});return res.end('<meta charset="utf-8"><style>body{font:14px Arial}svg{width:18px;height:18px}button{padding:8px;margin:4px}.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}[hidden]{display:none!important}</style><div id="root"></div><script>window.process={env:{}}</script><script src="/bundle.js"></script>');}
    if(url.pathname==="/api/social/connections")return json(res,{ok:true,connections:ownerB?[]:["instagram","tiktok","youtube"].map((platform,i)=>({id:id(i+1),platform,platformAccountId:platform+"-account",authorizationRevision,connectedAt:"2026-10-19T00:00:00Z",updatedAt:"2026-10-19T00:00:00Z",platformAccountName:platform==="instagram"?"Instagram Demo":platform==="tiktok"?"TikTok Demo":"YouTube Demo",platformAccountUsername:platform+"demo",status:"connected",scopes:[],profilePictureUrl:null}))});
    if(url.pathname.startsWith("/api/jobs/"))return json(res,{ok:true,job:job()});
    if(req.method==="POST"){
      if(postWithoutJob){views=23;needsRefresh=false;return respond(res,url.pathname);}
      return postFails?json(res,{ok:false,message:"Queue unavailable"},502):json(res,{ok:true,data:data(url.pathname),job:job(),jobId:"job-1"});
    }
    if(snapshotFails&&url.pathname.startsWith("/api/analytics/")&&!url.pathname.includes("/activity"))return json(res,{ok:false,message:"Analytics storage unavailable"},502);
    if((holdInstagram&&url.pathname.includes("/instagram/"))||(holdActivity&&url.pathname.includes("/activity")))return held.push({res,url:url.pathname});
    respond(res,url.pathname);
  });
  let browser;
  try{
    await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
    browser=await playwright.chromium.launch({channel:"msedge",headless:true});
    const page=await browser.newPage({viewport:{width:1400,height:1000}}), errors=[];
    const advance=async duration=>{await page.clock.runFor(duration);await page.clock.resume()};
    page.setDefaultTimeout(10_000);
    page.on("pageerror",e=>errors.push(e.message));
    const base=`http://127.0.0.1:${server.address().port}`;
    await page.clock.install();
    await page.addInitScript(()=>{window.timingCalls=[];const measure=performance.measure.bind(performance);performance.measure=(name,...args)=>{window.timingCalls.push(name);return measure(name,...args)}});
    await page.addInitScript(()=>{window.postCount=0;const fetch=window.fetch;window.fetch=(url,init)=>{if(init?.method==='POST')window.postCount++;return fetch(url,init)}});
    await page.goto(base);
    await page.getByText("Instagram Demo",{exact:true}).first().waitFor();
    assert.equal(await page.getByRole("status",{name:"Loading analytics",exact:true}).count(),0,"account screen must not wait for insights/activity");
    assert.equal(await page.evaluate(()=>window.calls['/api/analytics/tiktok/videos']||0),0,"unselected platforms are not prefetched");
    await page.getByRole("button",{name:"TikTok: choose analytics account"}).click();
    await advance(200);
    write("tiktok-menu.txt",await page.locator("body").innerText());
    await page.getByRole("button",{name:/@tiktokdemo/}).waitFor();await page.keyboard.press("Escape");
    await page.getByText("Your public-video performance",{exact:true}).waitFor();
    assert.ok(await page.evaluate(()=>window.aborts)>0,"switching platform aborts pending Instagram reads");
    const tiktokOpenCalls=await page.evaluate(()=>({...window.calls}));
    await advance(61_000);
    await page.waitForFunction(before=>window.calls['/api/analytics/tiktok/videos']>before,tiktokOpenCalls['/api/analytics/tiktok/videos']);
    assert.equal(await page.evaluate(()=>window.calls['/api/analytics/instagram/content']),tiktokOpenCalls['/api/analytics/instagram/content'],"Instagram stays inactive while TikTok is open");
    await page.getByRole("button",{name:"YouTube: choose analytics account"}).click();await page.keyboard.press("Escape");
    await page.getByText("Your channel at a glance",{exact:true}).waitFor();
    assert.ok(await page.evaluate(()=>window.calls['/api/analytics/youtube/channel'])>0);
    const youtubeOpenCalls=await page.evaluate(()=>({...window.calls}));
    await advance(61_000);
    await page.waitForFunction(before=>window.calls['/api/analytics/youtube/channel']>before,youtubeOpenCalls['/api/analytics/youtube/channel']);
    assert.equal(await page.evaluate(()=>window.calls['/api/analytics/tiktok/videos']),youtubeOpenCalls['/api/analytics/tiktok/videos'],"TikTok stays inactive while YouTube is open");
    release();
    await page.getByRole("button",{name:"Instagram: choose analytics account"}).click();await page.keyboard.press("Escape");
    await page.getByText("A saved analytics post",{exact:true}).first().waitFor();
    // A stale observed cache stays rendered while both server reads are held.
    holdInstagram=true;await page.evaluate(()=>{for(const query of window.client.getQueryCache().findAll({queryKey:['account','owner-a','analytics','instagram']}))if(query.queryKey.length===7)window.client.setQueryData(query.queryKey,query.state.data,{updatedAt:Date.now()-31*60_000});window.showWorkspace(false)});
    await page.getByText("Workspace closed",{exact:true}).waitFor();await page.evaluate(()=>window.showWorkspace(true));
    await page.getByText("A saved analytics post",{exact:true}).first().waitFor();
    assert.equal(await page.getByRole("status",{name:"Loading analytics",exact:true}).count(),0);
    release();
    await page.waitForFunction(()=>window.client.getQueryCache().findAll({queryKey:['account','owner-a','analytics','instagram']}).every(query=>query.state.fetchStatus==='idle'));
    // A still-mounted tab revalidates stale snapshots on return without hiding
    // its saved content. A second return while fresh does not add more reads.
    const readsBeforeIdle=await page.evaluate(()=>window.calls['/api/analytics/instagram/content']);
    holdInstagram=true;
    await page.evaluate(()=>{
      window.visibleFixture=false;document.dispatchEvent(new Event('visibilitychange',{bubbles:true}));
      for(const query of window.client.getQueryCache().findAll({queryKey:['account','owner-a','analytics','instagram']}))if(query.queryKey.length===7)window.client.setQueryData(query.queryKey,query.state.data,{updatedAt:Date.now()-31*60_000});
    });
    await advance(200);
    assert.equal(await page.evaluate(()=>window.calls['/api/analytics/instagram/content']),readsBeforeIdle);
    await page.evaluate(()=>{window.visibleFixture=true;document.dispatchEvent(new Event('visibilitychange',{bubbles:true}))});
    await page.waitForFunction(before=>window.calls['/api/analytics/instagram/content']>before,readsBeforeIdle);
    assert.ok(await page.getByText("A saved analytics post",{exact:true}).first().isVisible());
    assert.equal(await page.getByRole("status",{name:"Loading content performance",exact:true}).count(),0);
    await page.getByText("A saved analytics post",{exact:true}).first().scrollIntoViewIfNeeded();
    await page.screenshot({path:path.join(out,"analytics-idle-refresh.png")});
    release();
    await page.waitForFunction(()=>window.client.getQueryCache().findAll({queryKey:['account','owner-a','analytics','instagram']}).every(query=>query.state.fetchStatus==='idle'));
    const readsAfterIdle=await page.evaluate(()=>window.calls['/api/analytics/instagram/content']);
    await page.evaluate(()=>{window.visibleFixture=false;document.dispatchEvent(new Event('visibilitychange',{bubbles:true}))});await advance(100);
    await page.evaluate(()=>{window.visibleFixture=true;document.dispatchEvent(new Event('visibilitychange',{bubbles:true}))});await advance(100);
    assert.equal(await page.evaluate(()=>window.calls['/api/analytics/instagram/content']),readsAfterIdle,"fresh snapshots do not refetch on every focus");
    // Laptop wake can be a window focus without a visibility transition. A
    // snapshot read updates metrics and activity but fresh server data needs no
    // provider sync. Repeated focus/online/pageshow events must coalesce.
    const postsBeforeWake=await page.evaluate(()=>window.postCount);
    const activityBeforeWake=await page.evaluate(()=>window.calls['/api/analytics/activity']);
    views=13;
    await page.evaluate(()=>{
      for(const q of window.client.getQueryCache().getAll())if(
        q.queryKey[0]==='account'&&q.queryKey[1]==='owner-a'&&
        ((q.queryKey[2]==='analytics'&&q.queryKey[3]==='instagram'&&q.queryKey.length===7)||q.queryKey[2]==='analytics-activity'))
          window.client.setQueryData(q.queryKey,q.state.data,{updatedAt:Date.now()-2*60_000});
    });
    await advance(100);
    await page.evaluate(()=>{window.dispatchEvent(new Event('focus'));window.dispatchEvent(new Event('pageshow'));window.dispatchEvent(new Event('online'))});
    await page.waitForFunction(()=>window.client.getQueryCache().findAll({queryKey:['account','owner-a','analytics','instagram']}).some(q=>q.queryKey.length===7&&q.state.data?.data?.accounts?.[0]?.totals?.views===13));
    await page.waitForFunction(before=>window.calls['/api/analytics/activity']>before,activityBeforeWake);
    assert.equal(await page.evaluate(()=>window.postCount),postsBeforeWake,"Reading fresh saved data never starts provider synchronization");
    assert.equal(await page.evaluate(()=>window.calls['/api/analytics/instagram/content']),readsAfterIdle+1,"Wake event burst issues one read per resource");
    // New saved values must arrive while the screen remains visible, without
    // reload, navigation, visibility or focus events. Provider sync stays gated.
    const openCalls=await page.evaluate(()=>({...window.calls}));
    views=17;
    await advance(61_000);
    await page.waitForFunction(()=>window.client.getQueryCache().findAll({queryKey:['account','owner-a','analytics','instagram']}).some(q=>q.queryKey.length===7&&q.state.data?.data?.accounts?.[0]?.totals?.views===17));
    assert.ok(await page.evaluate(before=>window.calls['/api/analytics/activity']>before,openCalls['/api/analytics/activity']));
    assert.ok(await page.evaluate(before=>window.calls['/api/social/connections']>before,openCalls['/api/social/connections']));
    assert.equal(await page.evaluate(()=>window.postCount),postsBeforeWake,"Fresh snapshots never dispatch a provider sync");
    // Stale checks are silent while hidden or disconnected, including accounts
    // and publishing activity. Returning online catches up without a reload.
    await page.evaluate(()=>{window.visibleFixture=false;document.dispatchEvent(new Event('visibilitychange',{bubbles:true}))});
    await advance(100);
    const hiddenCalls=await page.evaluate(()=>({...window.calls}));
    await advance(121_000);
    assert.deepEqual(await page.evaluate(()=>({...window.calls})),hiddenCalls,"Hidden analytics sends no periodic requests");
    await page.evaluate(()=>{Object.defineProperty(navigator,'onLine',{configurable:true,value:false});window.visibleFixture=true;window.dispatchEvent(new Event('offline'))});
    await advance(61_000);
    assert.deepEqual(await page.evaluate(()=>({...window.calls})),hiddenCalls,"Offline analytics sends no periodic requests");
    await page.evaluate(()=>{Object.defineProperty(navigator,'onLine',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange',{bubbles:true}));window.dispatchEvent(new Event('online'))});
    await advance(200);
    await page.waitForFunction(()=>window.client.getQueryCache().getAll().every(q=>q.state.fetchStatus==='idle'));
    assert.equal(await page.evaluate(()=>window.calls['/api/analytics/tiktok/videos']||0),openCalls['/api/analytics/tiktok/videos']||0,"Inactive platforms do not check periodically");
    // A successful POST with no job must reconcile authoritative data and leave
    // manual mode. This covers cooldowns and concurrent server sync completion.
    postWithoutJob=true;
    await page.getByRole('button',{name:'Refresh',exact:true}).click();
    await page.waitForFunction(()=>window.client.getQueryCache().findAll({queryKey:['account','owner-a','analytics','instagram']}).some(q=>q.queryKey.length===7&&q.state.data?.data?.accounts?.[0]?.totals?.views===23));
    await page.waitForFunction(()=>window.client.getQueryCache().getAll().filter(q=>q.getObserversCount()>0).every(q=>!q.queryKey.some(part=>typeof part==='string'&&part.startsWith('manual:'))));
    postWithoutJob=false;
    // A different range must never borrow the previous range's snapshot.
    holdInstagram=true;
    await page.getByRole("group",{name:"Analytics date range"}).getByRole("button",{name:"7 days",exact:true}).click();
    await page.getByRole("status",{name:"Loading content performance",exact:true}).waitFor({state:"attached"});
    assert.equal(await page.getByText("A saved analytics post",{exact:true}).count(),0);
    release();await page.getByText("A saved analytics post",{exact:true}).first().waitFor();
    await page.getByRole("group",{name:"Analytics date range"}).getByRole("button",{name:"30 days",exact:true}).click();
    await page.getByText("A saved analytics post",{exact:true}).first().waitFor();
    // Reauthorizing the same connection ID starts an independent display cache.
    holdInstagram=true;authorizationRevision="consent-2";
    await page.evaluate(()=>window.client.setQueryData(['account','owner-a','social-connections'],rows=>rows.map(row=>({...row,authorizationRevision:'consent-2'}))));
    await page.getByRole("status",{name:"Loading content performance",exact:true}).waitFor({state:"attached"});
    assert.equal(await page.getByText("A saved analytics post",{exact:true}).count(),0);
    release();await page.getByText("A saved analytics post",{exact:true}).first().waitFor();
    // Only active visible job observers poll. Completion is delivered via GET.
    needsRefresh=true;await page.evaluate(()=>window.client.invalidateQueries({queryKey:['account','owner-a','analytics']}));
    await page.waitForFunction(()=>Boolean(window.calls['/api/jobs/job-1']));
    await page.evaluate(()=>{window.visibleFixture=false;document.dispatchEvent(new Event('visibilitychange',{bubbles:true}))});
    const before=await page.evaluate(()=>window.calls['/api/jobs/job-1']);await advance(20_000);
    assert.equal(await page.evaluate(()=>window.calls['/api/jobs/job-1']),before,"hidden tabs do not poll");
    views=19;complete=true;needsRefresh=false;snapshotFails=true;
    await page.evaluate(()=>{window.visibleFixture=true;document.dispatchEvent(new Event('visibilitychange',{bubbles:true}));window.dispatchEvent(new Event('focus'))});
    await advance(2500);
    await page.getByText('Analytics storage unavailable',{exact:false}).first().waitFor();
    assert.ok(await page.getByText('A saved analytics post',{exact:true}).first().isVisible(),"A failed completion read retains saved content");
    snapshotFails=false;
    await advance(61_000);
    await page.waitForFunction(()=>window.client.getQueryCache().findAll({queryKey:['account','owner-a','analytics','instagram']}).some(q=>q.queryKey.length===7&&q.state.data?.data?.accounts?.[0]?.totals?.views===19));
    await page.getByText("A saved analytics post",{exact:true}).first().waitFor();
    const jobsAfterCompletion=await page.evaluate(()=>window.calls['/api/jobs/job-1']);
    await page.evaluate(()=>{window.visibleFixture=false;document.dispatchEvent(new Event('visibilitychange',{bubbles:true}))});await advance(100);
    await page.evaluate(()=>{window.visibleFixture=true;document.dispatchEvent(new Event('visibilitychange',{bubbles:true}))});await advance(100);
    assert.equal(await page.evaluate(()=>window.calls['/api/jobs/job-1']),jobsAfterCompletion,"completed jobs stay stopped when the tab returns");
    // Refresh-start failure never replaces the saved content.
    postFails=true;await page.getByRole("button",{name:"Refresh",exact:true}).click();
    await page.waitForFunction(()=>window.client.getQueryCache().getAll().some(q=>q.queryKey.some(part=>typeof part==='string'&&part.startsWith('manual:'))&&q.state.status==='error'));
    await advance(200);
    await page.getByText("Queue unavailable",{exact:false}).first().waitFor();
    assert.ok(await page.getByText("A saved analytics post",{exact:true}).first().isVisible());
    // Returning to the screen must not replay an old manual refresh counter.
    const postsBeforeRemount=await page.evaluate(()=>window.postCount);postFails=false;
    await page.evaluate(()=>window.showWorkspace(false));await page.getByText("Workspace closed",{exact:true}).waitFor();
    await page.evaluate(()=>window.showWorkspace(true));await page.getByText("A saved analytics post",{exact:true}).first().waitFor();
    await advance(200);
    assert.equal(await page.evaluate(()=>window.postCount),postsBeforeRemount);
    // A repaired initial storage failure must recover with Refresh, without a reload.
    snapshotFails=true;
    await page.evaluate(()=>window.showWorkspace(false));await page.getByText("Workspace closed",{exact:true}).waitFor();
    await page.evaluate(()=>{window.client.removeQueries({queryKey:['account','owner-a','analytics']});window.showWorkspace(true)});
    await page.getByText("Analytics storage unavailable",{exact:false}).first().waitFor();
    const readsBeforeRepair=await page.evaluate(()=>window.calls['/api/analytics/instagram/content']);
    snapshotFails=false;await page.getByRole("button",{name:"Refresh",exact:true}).click();
    await page.waitForFunction(before=>window.calls['/api/analytics/instagram/content']>before,readsBeforeRepair);
    await page.getByText("A saved analytics post",{exact:true}).first().waitFor();
    await page.evaluate(()=>window.scrollTo(0,0));
    await page.screenshot({path:path.join(out,"analytics-ready.png")});
    await page.setViewportSize({width:390,height:844});
    await page.screenshot({path:path.join(out,"analytics-mobile.png")});
    await page.setViewportSize({width:1400,height:1000});
    // A completed manual refresh must not block the next automatic cycle.
    complete=true;needsRefresh=false;
    await page.getByRole('button',{name:'Refresh',exact:true}).click();
    await page.waitForFunction(()=>window.client.getQueryCache().getAll().filter(q=>q.queryKey[2]==='analytics'&&q.queryKey[3]==='instagram'&&q.getObserversCount()>0).every(q=>q.state.fetchStatus==='idle'));
    await advance(2000);
    const afterManual=await page.evaluate(()=>window.postCount);
    needsRefresh=true;complete=false;
    await advance(61_000);
    await page.waitForFunction(before=>window.postCount>before,afterManual);
    // Local job-1 is reused by the fixture. Existing completed cache values
    // remain terminal and cannot become an endless status polling loop.
    const beforeQuiet=await page.evaluate(()=>window.calls['/api/jobs/job-1']);
    await advance(60_000);
    assert.equal(await page.evaluate(()=>window.calls['/api/jobs/job-1']),beforeQuiet);
    // A different authenticated owner gets a different QueryClient/screen.
    ownerB=true;await page.evaluate(()=>window.switchOwner('owner-b'));
    await page.waitForFunction(()=>window.currentOwner==='owner-b');
    await page.getByText("Connect account",{exact:true}).first().waitFor();
    assert.equal(await page.getByText("A saved analytics post",{exact:true}).count(),0);
    assert.deepEqual(errors,[]);
    assert.ok(await page.evaluate(()=>window.timingCalls.includes('ugc.analytics.accounts')));
    assert.ok(await page.evaluate(()=>window.timingCalls.includes('ugc.analytics.snapshot')));
    const receipt={accountDisplayIndependent:true,platformRequestsDeferred:true,staleContentRetained:true,idleSnapshotsRevalidated:true,freshFocusAvoidsDuplicateReads:true,laptopFocusRefreshesMetricsAndActivity:true,wakeBurstCoalesced:true,noProviderSyncForFreshSnapshot:true,openScreenUpdatesMetricsActivityAndAccounts:true,hiddenAndOfflineReadsPaused:true,noJobRefreshReconciled:true,noJobManualEventConsumed:true,automaticRefreshAfterManual:true,switchAborts:true,dateRangeIsolation:true,authorizationRevisionIsolation:true,hiddenPollingPaused:true,completionUpdatesObservedCache:true,failedCompletionReadRecoversAutomatically:true,completedJobsStayStopped:true,refreshFailureRetainsContent:true,noManualRefreshReplay:true,retryRecoversInitialSnapshotFailure:true,ownerIsolation:true,displayTimingsRecorded:true};
    write("results.json",JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt,null,2));
  }finally{if(browser)await browser.close();release();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error);process.exitCode=1});
