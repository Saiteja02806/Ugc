/* eslint-disable @typescript-eslint/no-require-imports -- Isolated browser fixture. */
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const { webpack } = require('next/dist/compiled/webpack/webpack');
let playwright; try { playwright = require('playwright'); } catch { playwright = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
const root = path.resolve(__dirname, '..'), out = path.join(root, '.tmp/trending-history-recovery'); fs.mkdirSync(out, { recursive: true });
const write = (name, value) => fs.writeFileSync(path.join(out, name), value);
write('loader.cjs', `const ts=require(${JSON.stringify(require.resolve('typescript'))});module.exports=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText;`);
write('css.cjs', `module.exports=s=>'const style=document.createElement("style");style.textContent='+JSON.stringify(s)+';document.head.append(style);export default {};';`);
write('module-css.cjs', String.raw`module.exports=function(s){const prefix=require('node:path').basename(this.resourcePath).replace(/[^a-zA-Z]/g,'')+'_',names={};s=s.replace(/:global\(([^)]+)\)/g,(_,value)=>'GLOBALSTART'+Buffer.from(value).toString('hex')+'GLOBALEND');s=s.replace(/\.([a-zA-Z][a-zA-Z0-9_-]*)/g,(_,name)=>{names[name]=prefix+name;return '.'+prefix+name;});s=s.replace(/GLOBALSTART([a-f0-9]+)GLOBALEND/g,(_,value)=>Buffer.from(value,'hex').toString());return 'const style=document.createElement("style");style.textContent='+JSON.stringify(s)+';document.head.append(style);export default '+JSON.stringify(names)+';';};`);
write('auth.ts', `export const getCurrentUserIdToken=async()=> 'fixture-token';export const useAuth=()=>({user:{uid:'owner-a'},loading:false});`);
write('font.ts', `export default ()=>({variable:'fixture-inter'});`);
write('entry.tsx', `import {StrictMode,useEffect,useState} from 'react';import {createRoot} from 'react-dom/client';import {QueryClient,QueryClientProvider} from '@tanstack/react-query';import {TrendingFeedGallery} from '@/components/trending/trending-workspace';
function App(){const [owner,so]=useState(sessionStorage.getItem('fixture-owner')||'owner-a');const [items,si]=useState([]);const [loading,sl]=useState(true);useEffect(()=>{let live=true;sl(true);fetch('/fixture/feed?owner='+owner).then(r=>r.json()).then(items=>{if(live){si(items);sl(false)}});return()=>{live=false}},[owner]);return <main><header><a href='/away'>Leave Trending</a><button onClick={()=>{const next=owner==='owner-a'?'owner-b':'owner-a';sessionStorage.setItem('fixture-owner',next);so(next)}}>Switch account</button><span data-owner>{owner}</span></header><div style={{height:'calc(100dvh - 80px)'}}><TrendingFeedGallery key={owner} enqueueDecision={entry=>{si(current=>current.filter(item=>item.assignmentId!==entry.assignmentId));fetch('/fixture/decision?owner='+owner,{method:'POST',body:JSON.stringify(entry)})}} error={null} failure={null} headerActionsRoot={null} hasPresentedFeed={items.length>0} items={items} loading={loading} pendingSlotCount={0} preparing={false} remainingCount={items.length} onCompleteProfile={()=>{}} onRetryHistory={()=>{}} profile={null} userId={owner} upgradeRequired={false}/></div></main>};createRoot(document.getElementById('root')).render(<StrictMode><QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><App/></QueryClientProvider></StrictMode>);`);

async function main() {
  await new Promise((resolve,reject)=>{const c=webpack({mode:'development',plugins:[new webpack.DefinePlugin({'process.env':JSON.stringify({NODE_ENV:'development'})})],devtool:false,context:root,entry:path.join(out,'entry.tsx'),output:{path:out,filename:'bundle.js'},resolve:{extensions:['.tsx','.ts','.js'],extensionAlias:{'.js':['.js','.ts','.tsx']},alias:{'next/font/local':path.join(out,'font.ts'),'@/lib/firebase/auth':path.join(out,'auth.ts'),'@/contexts/auth-context':path.join(out,'auth.ts'),'@':root}},module:{rules:[{test:/\.tsx?$/,use:path.join(out,'loader.cjs')},{test:/\.module\.css$/,use:path.join(out,'module-css.cjs')},{test:/\.css$/,exclude:/\.module\.css$/,use:path.join(out,'css.cjs')}]}});c.run((e,s)=>c.close(()=>e||s.hasErrors()?reject(e||Error(s.toString({all:false,errors:true}))):resolve()));});
  const css=(await require('postcss')([require('@tailwindcss/postcss')({base:root})]).process(fs.readFileSync(path.join(root,'app/globals.css'),'utf8').replace('@import "tailwindcss";','@import "tailwindcss" source(none);\n@source "../components/trending";\n@source "../components/ui";'),{from:path.join(root,'app/globals.css')})).css;
  const items=[1,2,3].map(n=>{const slides=[1,2].map(s=>({headline:'Post '+n+' slide '+s,renderedUrl:'/slide-'+s+'.jpg',slideNumber:s,slideType:s===1?'hook':'body',status:'ready',subtext:null}));return {id:'post-'+n,assignmentId:'assignment-'+n,creativeId:'creative-'+n,feedItemId:'post-'+n,format:'carousel',position:n,readiness:'preview_ready',source:'new',creative:{candidateIndex:n,carouselId:'carousel-'+n,categorySlug:null,generationBatchId:'batch',projectId:'project',readySlideCount:2,selectedAngle:'Post '+n,slideCount:2,slides,status:'completed',thumbnailUrl:slides[0].renderedUrl,updatedAt:'2026-10-19T00:00:00Z'}}});
  const decisions=[], errors=[], writes=[];
  const server=http.createServer(async(req,res)=>{try{
    const u=new URL(req.url,'http://fixture'),json=value=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(value));};
    if(u.pathname==='/away')return res.end('<a href="/">Return to Trending</a>');
    if(u.pathname==='/')return res.end('<!doctype html><html class="dark"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><body style="background:#202020;color:white"><div id="root"></div><script src="/bundle.js"></script>');
    if(u.pathname==='/favicon.ico'){res.writeHead(204);return res.end();}
    if(u.pathname==='/bundle.js'){res.setHeader('Content-Type','text/javascript');return res.end(fs.readFileSync(path.join(out,'bundle.js')));}
    if(u.pathname==='/style.css'){res.setHeader('Content-Type','text/css');return res.end(css);}
    if(/^\/slide-[12]\.jpg$/.test(u.pathname)){res.setHeader('Content-Type','image/jpeg');return res.end(fs.readFileSync(path.join(root,'public/marketing/showcase-part2/slideshow/image_'+(Number(u.pathname[7])-1)+'.jpg')));}
    if(u.pathname==='/fixture/feed')return json(u.searchParams.get('owner')==='owner-a'?items.filter(item=>!decisions.some(d=>d.assignmentId===item.assignmentId)):[]);
    if(u.pathname==='/fixture/decision'){let body='';for await(const part of req)body+=part;decisions.push(JSON.parse(body));return json({ok:true});}
    if(u.pathname.startsWith('/api/')){
      if(req.method!=='GET')writes.push(u.pathname);
      if(u.pathname==='/api/trending/walkthrough')return json({ok:true,completed:true});
      if(u.pathname.endsWith('/edit'))return json({ok:true,edit:null});
    }
    errors.push('Unexpected request '+u.pathname);res.writeHead(404);res.end();
  }catch(e){errors.push(e.message);res.writeHead(500);res.end();}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
  const browser=await playwright.chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
  const page=await browser.newPage({viewport:{width:1366,height:900}});page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message));
  const active=()=>page.locator('[data-post-feed-active=true]');
  async function expectPost(n){await page.locator('[data-post-feed-active=true][data-post-feed-item="post-'+n+'"]').waitFor();await page.waitForFunction(()=>{const e=document.querySelector('[data-post-interaction-feed]');if(!e||e.getAttribute('aria-busy')!=='false'||e.dataset.postSettling)return false;for(let node=e;node;node=node.parentElement)if(Number(getComputedStyle(node).opacity)<.999)return false;return [...e.querySelectorAll('[data-post-feed-active=true] img')].every(image=>image.complete&&image.naturalWidth>0)});}
  async function key(name){await page.locator('[data-post-interaction-feed]').focus();await page.keyboard.press(name);}
  async function wheelBack(n){const feed=page.locator('[data-post-interaction-feed]');await feed.hover();await page.mouse.wheel(0,-1000);await expectPost(n);}
  try{
    await page.goto(origin);await expectPost(1);
    await key('ArrowDown');await expectPost(2);await key('ArrowDown');await expectPost(3);
    await page.waitForFunction(()=>JSON.parse(localStorage.getItem('ugc:trending-review-history:v1:owner-a'))?.entries.length===2);
    await page.getByRole('link',{name:'Leave Trending'}).click();await page.getByRole('link',{name:'Return to Trending'}).click();await expectPost(3);
    await wheelBack(2);await page.reload();await expectPost(2);assert.equal(decisions.length,2);
    await wheelBack(1);await key('ArrowDown');await expectPost(2);await key('ArrowDown');await expectPost(3);assert.equal(decisions.length,2,'Browsing recovered posts must not replay skips');
    await key('ArrowDown');await page.getByRole('button',{name:'View previous posts'}).waitFor();assert.equal(decisions.length,3);
    await page.reload();await page.getByRole('button',{name:'View previous posts'}).click();await expectPost(3);await wheelBack(2);
    await page.getByRole('button',{name:'Switch account'}).click();await page.locator('[data-owner]').filter({hasText:'owner-b'}).waitFor();assert.equal(await active().count(),0);assert.equal(await page.getByRole('button',{name:'View previous posts'}).count(),0);
    await page.getByRole('button',{name:'Switch account'}).click();await expectPost(2);
    await page.screenshot({path:path.join(out,'recovered-history.png')});
    assert.equal(decisions.length,3);assert.deepEqual(writes,[],'Restoring/browsing history must not call any mutating API');
    await page.evaluate(()=>localStorage.setItem('ugc:trending-review-history:v1:owner-a','{broken'));await page.reload();await page.getByText("You're all caught up",{exact:true}).waitFor();assert.equal(await active().count(),0);
    // A denied Storage API must degrade to working current-visit history.
    decisions.length=0;const blocked=await browser.newContext({viewport:{width:1366,height:900}});
    await blocked.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Storage blocked','SecurityError')}}));
    const blockedPage=await blocked.newPage();blockedPage.on('pageerror',e=>errors.push(e.message));await blockedPage.goto(origin);
    await blockedPage.getByText('Browser storage is unavailable. Previous posts can only be kept during this visit.',{exact:true}).waitFor();
    await blockedPage.locator('[data-post-interaction-feed]').focus();await blockedPage.keyboard.press('ArrowDown');await blockedPage.locator('[data-post-feed-active=true][data-post-feed-item="post-2"]').waitFor();
    await blockedPage.locator('[data-post-interaction-feed]').focus();await blockedPage.keyboard.press('ArrowUp');await blockedPage.locator('[data-post-feed-active=true][data-post-feed-item="post-1"]').waitFor();assert.equal(decisions.length,1);
    await blocked.close();assert.deepEqual(errors,[]);console.log('PASS: actual Trending gallery/deck: navigate away/back, refresh selected history, scroll backward, browse forward without replay, final-post recovery, account isolation, corrupt/blocked storage, StrictMode.');
  }finally{await browser.close();await new Promise(r=>server.close(r));}
}
main().catch(error=>{console.error(error);process.exitCode=1});
