/* eslint-disable @typescript-eslint/no-require-imports -- Bundle actual components with isolated API/auth boundaries. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { webpack } = require('next/dist/compiled/webpack/webpack');
let playwright;
try { playwright = require('playwright'); } catch { playwright = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
const root = path.resolve(__dirname, '..'), out = path.join(root, '.tmp/idle-resume-browser');
fs.mkdirSync(out, { recursive: true });
const write = (name, text) => fs.writeFileSync(path.join(out, name), text);
write('loader.cjs', `const ts=require(${JSON.stringify(require.resolve('typescript'))});module.exports=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText;`);
write('css.cjs', `module.exports=s=>'export default {};';`);
write('auth.ts', `const user={uid:'resume-owner'};export const useAuth=()=>({user,loading:false});export const getCurrentUserIdToken=async owner=>{if(owner&&owner!==user.uid)throw Error('Account changed');return 'fixture-token';};`);
write('link.tsx', `export default function Link({children,...props}){return <a {...props}>{children}</a>}`);
write('image.tsx', `export default function Image({alt,src,...props}){return <img alt={alt} src={src} {...props}/>}`);
write('dynamic.tsx', `export default ()=>()=>null;`);
write('entry.tsx', `import {createRoot} from 'react-dom/client';import {useState,Profiler,StrictMode} from 'react';
import {DemosWorkspace} from '@/components/demos/demos-workspace';import {UserMediaCollection} from '@/components/media/user-media-collection';import {HookVideoLibraryTab} from '@/components/library/hook-video-library-tab';import {EditLibraryWorkspace} from '@/components/edit/edit-library-workspace';
window.fixtureVisibility='visible';Object.defineProperty(document,'visibilityState',{get:()=>window.fixtureVisibility,configurable:true});Object.defineProperty(document,'hidden',{get:()=>window.fixtureVisibility==='hidden',configurable:true});
window.calls={};window.pending={};window.aborts=0;window.commits=0;const original=window.fetch;window.fetch=(url,init)=>{const key=new URL(url,location.href).pathname;if(!key.startsWith('/api/'))return original(url,init);window.calls[key]=(window.calls[key]||0)+1;window.pending[key]=(window.pending[key]||0)+1;init?.signal?.addEventListener('abort',()=>window.aborts++,{once:true});return original(url,init).finally(()=>window.pending[key]--);};
function App(){const[shown,setShown]=useState(true);window.unmountFixture=()=>setShown(false);const mode=new URLSearchParams(location.search).get('mode');return <><input aria-label="Unsubmitted draft" defaultValue="keep this draft"/>{shown?<Profiler id="workspace" onRender={()=>window.commits++}>{mode==='demos'?<DemosWorkspace/>:mode==='assets'?<UserMediaCollection collection="video" title="Creative Assets" description="Fixture" emptyTitle="Empty" emptyDescription="Empty"/>:mode==='hooks'?<HookVideoLibraryTab/>:<EditLibraryWorkspace/>}</Profiler>:<p>Fixture closed</p>}</>};createRoot(document.getElementById('root')).render(<StrictMode><App/></StrictMode>);`);

async function main() {
  const aliases = { '@/contexts/auth-context':path.join(out,'auth.ts'), '@/lib/firebase/auth':path.join(out,'auth.ts'),
    'next/link':path.join(out,'link.tsx'), 'next/image':path.join(out,'image.tsx'), 'next/dynamic':path.join(out,'dynamic.tsx'), '@':root };
  await new Promise((resolve,reject)=>{const compiler=webpack({mode:'development',devtool:false,context:root,entry:path.join(out,'entry.tsx'),output:{path:out,filename:'bundle.js'},resolve:{extensions:['.tsx','.ts','.js'],extensionAlias:{'.js':['.js','.ts','.tsx']},alias:aliases},module:{rules:[{test:/\.tsx?$/,use:path.join(out,'loader.cjs')},{test:/\.css$/,use:path.join(out,'css.cjs')}]}});compiler.run((error,stats)=>compiler.close(()=>error||stats.hasErrors()?reject(error||Error(stats.toString({all:false,errors:true}))):resolve()));});
  const id = '00000000-0000-4000-8000-000000000001', at = '2026-10-19T08:00:00.000Z';
  const demo = {id,user_id:'resume-owner',project_id:'test-project-001',title:'Idle demo',file_name:'demo.mp4',file_type:'video/mp4',file_size_bytes:100,created_at:at,updated_at:at,status:'processing',draft_json:{},duration_seconds:5,width:1080,height:1920,ratio:'9:16',source_video_url:'',rendered_video_url:null,thumbnail_url:null,deleted_at:null,error_message:null,latest_render_id:null,source_s3_key:'fixture'};
  const edit = {id,title:'Idle edit',source:'demo',status:'rendering',createdAt:at,draft:null,durationSeconds:5,projectId:'fixture',ratio:'9:16',renderedVideoUrl:null,thumbnailUrl:null,videoUrl:null};
  const asset = {id,title:'Idle asset',collection:'video',sourceType:'upload',status:'ready',createdAt:at,updatedAt:at,metadata:{},durationSeconds:5,ratio:'9:16',url:'',thumbnailUrl:null,fileName:'fixture.mp4',mimeType:'video/mp4'};
  const hook = {id,hookText:'Idle hook',createdAt:at,updatedAt:at,demoAssetId:id,demoTitle:'Demo',influencerId:id,influencerName:'Creator',influencerVideoId:id,influencerVideoTitle:'Opening',librarySavedAt:at,renderError:null,renderJobId:id,renderStatus:'queued',renderedAt:null,renderedMediaAssetId:null,renderedVideoUrl:null,scheduledPostId:null,selectedHookId:id,sourceKind:'ai_influencer',status:'saved',trimEnd:5,trimStart:0};
  let held = false, fail = false; const waiting = [];
  const payload = endpoint => endpoint==='/api/demo/list'?{ok:true,demos:[demo]}:endpoint==='/api/edit/videos'?{ok:true,videos:[edit]}:endpoint==='/api/trending/hook-videos/drafts'?{ok:true,drafts:[hook]}:endpoint==='/api/media/groups'?{ok:true,groups:[]}:{ok:true,assets:[asset]};
  function respond(res,endpoint) { if(res.destroyed)return;res.writeHead(fail?503:200,{'Content-Type':'application/json'});res.end(JSON.stringify(fail?{ok:false,error:'Fixture temporarily unavailable'}:payload(endpoint))); }
  const server=http.createServer((req,res)=>{const url=new URL(req.url,'http://localhost');if(url.pathname==='/bundle.js'){res.writeHead(200,{'Content-Type':'application/javascript'});return fs.createReadStream(path.join(out,'bundle.js')).pipe(res);}if(url.pathname.startsWith('/api/')){if(held)waiting.push({res,endpoint:url.pathname});else respond(res,url.pathname);return;}res.writeHead(200,{'Content-Type':'text/html'});res.end('<!doctype html><html><body><div id="root"></div><script src="/bundle.js"></script></body></html>');});
  let browser;
  try {
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    browser=await playwright.chromium.launch({channel:'msedge',headless:true});
    const page=await browser.newPage({viewport:{width:1366,height:768}}), errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    const release=()=>{held=false;for(const entry of waiting.splice(0))respond(entry.res,entry.endpoint);};
    const count=endpoint=>page.evaluate(endpoint=>window.calls[endpoint]||0,endpoint);
    const settle=async endpoint=>{await page.waitForFunction(endpoint=>window.pending[endpoint]===0,endpoint);await page.waitForTimeout(80);};
    const resume=()=>page.evaluate(()=>{window.fixtureVisibility='visible';window.dispatchEvent(new Event('focus'));document.dispatchEvent(new Event('visibilitychange'));window.dispatchEvent(new Event('online'));});
    const hide=()=>page.evaluate(()=>{window.fixtureVisibility='hidden';document.dispatchEvent(new Event('visibilitychange'));});
    const receipts=[];
    await page.clock.install();
    for(const [mode,endpoint,label] of [['demos','/api/demo/list','Idle demo'],['assets','/api/edit/videos','Idle asset'],['hooks','/api/trending/hook-videos/drafts','Idle hook'],['edit','/api/edit/videos','Idle edit']]) {
      held=false;fail=false;
      await page.goto(`http://127.0.0.1:${server.address().port}/?mode=${mode}`);
      await page.waitForFunction(endpoint=>(window.calls[endpoint]||0)>0,endpoint);await settle(endpoint);
      const content=mode==='hooks'?page.getByRole('button',{name:'Preview Idle hook',exact:true}):page.getByText(label,{exact:true}).first();
      await content.waitFor();
      await content.evaluate(node=>{node.dataset.survived='yes';});
      await page.getByLabel('Unsubmitted draft').fill('still editing');
      await hide();const before=await count(endpoint);await page.clock.fastForward(30*60_000);assert.equal(await count(endpoint),before,`${mode}: hidden 30 minutes must not poll`);
      held=true;await resume();await page.waitForFunction(({endpoint,before})=>window.calls[endpoint]===before+1,{endpoint,before});
      await page.clock.fastForward(15_000);assert.equal(await count(endpoint),before+1,`${mode}: slow response cannot overlap another poll`);
      assert.ok(await content.isVisible(),`${mode}: content stays mounted`);
      assert.equal(await content.getAttribute('data-survived'),'yes',`${mode}: the same card node survives resume`);
      assert.equal(await page.getByLabel('Unsubmitted draft').inputValue(),'still editing');
      release();await settle(endpoint);
      const settled=await count(endpoint);await resume();await page.clock.fastForward(100);assert.equal(await count(endpoint),settled,`${mode}: adjacent return events reuse freshness`);
      await page.clock.runFor(5_100);await settle(endpoint);assert.ok(await count(endpoint)>settled,`${mode}: polling resumes after completion`);
      // A failed background read preserves previous cards and recovers through explicit refresh.
      await hide();await page.clock.fastForward(2_000);fail=true;await resume();await settle(endpoint);
      assert.ok(await content.isVisible(),`${mode}: failure retains content`);
      assert.equal(await content.getAttribute('data-survived'),'yes',`${mode}: failure retains the same card node`);
      fail=false;const retryBefore=await count(endpoint);await page.getByRole('button',{name:/refresh/i}).first().click();await settle(endpoint);assert.ok(await count(endpoint)>retryBefore,`${mode}: explicit refresh bypasses backoff`);
      // A route departure aborts the pending status read.
      await hide();await page.clock.fastForward(2_000);held=true;await resume();await page.waitForFunction(endpoint=>window.pending[endpoint]>0,endpoint);const aborts=await page.evaluate(()=>window.aborts);
      await page.evaluate(()=>window.unmountFixture());await page.getByText('Fixture closed',{exact:true}).waitFor();await page.waitForFunction(aborts=>window.aborts>aborts,aborts);release();
      receipts.push({mode,hiddenIdleMinutes:30,duplicateResumeReads:0,overlappingPolls:0,contentPreserved:true,manualRetry:true,unmountAborted:true});
      console.log('PASS '+mode+' idle, resume, slow/failing reads, retained card and cancellation');
    }
    assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(receipts,null,2));console.log(JSON.stringify(receipts,null,2));
  } finally { if(browser)await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve)); }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
