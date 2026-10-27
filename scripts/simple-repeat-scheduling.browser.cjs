/* eslint-disable @typescript-eslint/no-require-imports -- Isolated browser regression runner. */
// Real scheduling components, fixture authentication and HTTP. No live posts.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { webpack } = require('next/dist/compiled/webpack/webpack');
let playwright;
try { playwright = require('playwright'); }
catch { playwright = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
const root = path.resolve(__dirname, '..'), out = path.join(root, '.tmp/simple-repeat-scheduling');
fs.mkdirSync(out, {recursive:true});
const file = (name, content) => fs.writeFileSync(path.join(out, name), content);
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
file('loader.cjs', `const ts=require(${JSON.stringify(require.resolve('typescript'))});module.exports=source=>ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText;`);
file('css.cjs', `module.exports=()=> 'export default new Proxy({}, {get: (_, name) => name});';`);
file('auth.ts', `export const useAuth=()=>({user:{uid:'owner'}});export const getCurrentUserIdToken=async()=> 'fixture-owner';`);
file('timezone.ts', `export const useAccountTimeZone=()=> 'Asia/Calcutta';`);
file('link.tsx', `export default props=><a {...props}/>;`);
file('entry.tsx', `import {createRoot} from 'react-dom/client';import {useState} from 'react';import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {PendingExploreSchedulePanel} from '@/components/explore/pending-schedule-panel';import {FormatSchedulePanel} from '@/components/explore/format-schedule-panel';import {TalkingHeadScheduleActions} from '@/components/explore/talking-head-schedule-review';
const mode=new URLSearchParams(location.search).get('mode');const finishDraft={version:1,kind:'hook',sourceAssetId:'${id(1)}',demoAssetId:'${id(2)}',demoAudioAssetId:null,demoAudioPlayback:'once',backgroundAssetId:null,backgroundPlayback:'once',subtitles:null,composition:{version:1,sourceEditing:null,demoEditing:null,sourceAudioAssetId:null,sourceAudioPlayback:'once'}};
const composition={signature:'exact-clips',sourceId:'${id(1)}',title:'My video',draft:finishDraft,error:null,resolve:async()=>finishDraft};
function Fixture(){const [draft,onChange]=useState({platform:'instagram',connectionId:'${id(3)}',caption:'Repeat this same content',date:'',time:''});return <main>{mode==='talking'?<TalkingHeadScheduleActions action={{completed:true,busy:false,disabled:false,message:'Post scheduled',onAction(){},refresh(){}}} enabled onBackToEdit={()=>{}}/>:mode==='pending'?<PendingExploreSchedulePanel owner='owner' scope='hook' composition={composition} draft={draft} onChange={onChange} timezone='Asia/Calcutta' active onBackToEdit={()=>{}}/>:<FormatSchedulePanel format={mode==='slideshow'?'slideshow':mode==='wall'?'wall_text':'hook'} output={{id:'${id(1)}',kind:mode==='slideshow'?'library_item':'media_asset',url:'/fixture.mp4',title:'My content'}} localPreview={false} imageOnly={mode==='slideshow'} active onBackToEdit={()=>{}}/>}</main>}
createRoot(document.getElementById('root')).render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><Fixture/></QueryClientProvider>);`);
const connections=[{id:id(3),platform:'instagram',platformAccountName:'Fixture',platformAccountUsername:'fixture',status:'connected',scopes:['instagram_business_content_publish'],supportsBackgroundRefresh:true}];
const direct = new Map(), pending = new Map(), posts=[];
let loseNext=false;
function json(res, value) { res.setHeader('Content-Type','application/json');res.end(JSON.stringify(value)); }
const css = ['workflow-creation.module.css','workflow-schedule-review.module.css'].map(name=>fs.readFileSync(path.join(root,'components/explore',name),'utf8')).join('\n') + `
:root{--background:#202020;--card:#282828;--border:#414141;--foreground:#eee;--foreground-strong:#fff;--muted:#aaa}*{box-sizing:border-box}body{margin:0;background:var(--background);color:var(--foreground);font:14px Arial}main{max-width:760px;margin:24px auto;padding:12px}button,input,textarea{font:inherit;color:inherit}button{cursor:pointer;padding:10px;border:1px solid var(--border);border-radius:8px;background:#303030;display:inline-flex;align-items:center;justify-content:center}button:disabled{opacity:.5}button[aria-pressed=true]{border-color:#ff7043}.reviewButton{background:#ff7043;color:#111}input,textarea{width:100%;border:1px solid var(--border);border-radius:8px;background:var(--background);padding:10px}p{margin:0}.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}[hidden]{display:none!important}svg{width:18px;height:18px}.text-xs{font-size:12px}.text-muted{color:var(--muted)}`;
async function pickTime(page,time){await page.getByRole('button',{name:/^Choose publish time, currently/}).click();await page.getByLabel('Hour',{exact:true}).selectOption(time.slice(0,2));await page.getByLabel('Minute',{exact:true}).selectOption(time.slice(3));await page.getByRole('button',{name:'Done',exact:true}).click();}
async function main(){
  const globalCss = (await require('postcss')([require('@tailwindcss/postcss')()]).process(fs.readFileSync(path.join(root,'app/globals.css'),'utf8').replace('@import "tailwindcss";','@import "tailwindcss" source(none);')+'\n@source "../components";', {from:path.join(root,'app/globals.css')})).css;
  await new Promise((resolve,reject)=>{const compiler=webpack({mode:'development',devtool:false,context:root,plugins:[new webpack.NormalModuleReplacementPlugin(/(?:^|[\\/])firebase[\\/]auth$/,resource=>{resource.request=path.join(out,'auth.ts');})],entry:path.join(out,'entry.tsx'),output:{path:out,filename:'bundle.js'},resolve:{extensions:['.tsx','.ts','.js'],alias:{'@/contexts/auth-context':path.join(out,'auth.ts'),'@/lib/firebase/auth':path.join(out,'auth.ts'),'@/components/providers/account-timezone-provider':path.join(out,'timezone.ts'),'next/link':path.join(out,'link.tsx'),'@':root}},module:{rules:[{test:/\.tsx?$/,use:path.join(out,'loader.cjs')},{test:/\.css$/,use:path.join(out,'css.cjs')}]}});compiler.run((error,stats)=>compiler.close(()=>error||stats.hasErrors()?reject(error||new Error(stats.toString({all:false,errors:true}))):resolve()));});
  const server=http.createServer(async(req,res)=>{try{
    const url=new URL(req.url,'http://fixture');
    if(url.pathname==='/fixture') {res.setHeader('Content-Type','text/html; charset=utf-8');return res.end(`<html class="dark"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${globalCss}\n${css}</style><div id="root"></div><script>window.process={env:{}}</script><script src="/bundle.js"></script></html>`);}
    if(url.pathname==='/bundle.js'){res.setHeader('Content-Type','text/javascript');return res.end(fs.readFileSync(path.join(out,'bundle.js')));}
    if(url.pathname.startsWith('/api/'))assert.equal(req.headers.authorization,'Bearer fixture-owner');
    if(url.pathname==='/api/social/connections')return json(res,{ok:true,connections});
    if(url.searchParams.has('configOnly'))return json(res,{ok:true,minimumScheduleLeadMinutes:5});
    if(req.method==='POST'){
      let body='';for await(const chunk of req)body+=chunk;const input=JSON.parse(body);posts.push({url:url.pathname,input});
      if(url.pathname==='/api/explore/schedules'){
        const result={ok:true,version:1,requestKey:input.requestKey,schedule:{id:id(posts.length+20),caption:input.schedule.caption.trim(),title:input.schedule.title,timezone:input.schedule.timezone,scheduledFor:input.schedule.scheduledFor,targets:[],metadata:{exploreFinishRequestKey:input.requestKey,exploreFinishFingerprint:'b'.repeat(64),exploreFinishOutputAssetId:id(12),plannedTargetsJson:JSON.stringify(input.schedule.targets),plannedScheduledFor:input.schedule.scheduledFor}},preparation:{state:'preparing',jobId:id(11),mediaAssetId:null,message:'Saved'}};
        pending.set(input.requestKey,result);if(loseNext){loseNext=false;res.statusCode=502;return json(res,{ok:false,message:'Fixture gateway lost the saved response'});}return json(res,result);
      }
      const result={id:id(posts.length+20),[input.source.kind==='library_item'?'libraryItemId':'mediaAssetId']:input.source.id,idempotencyKey:input.idempotencyKey,status:'scheduled',targets:input.targets.map(t=>({socialConnectionId:t.connectionId,platform:t.platform}))};
      direct.set(input.idempotencyKey,result);if(loseNext){loseNext=false;res.statusCode=502;return json(res,{ok:false,message:'Fixture gateway lost the saved response'});}return json(res,{ok:true,schedule:result});
    }
    if(url.pathname==='/api/explore/schedules')return json(res,pending.get(url.searchParams.get('requestKey')));
    if(url.pathname==='/api/schedules')return json(res,{ok:true,schedules:[...direct.values()]});
    res.statusCode=404;res.end();
  }catch(error){res.statusCode=500;json(res,{ok:false,error:error.message});}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let browser;
  try{
    browser=await playwright.chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
    for(const mode of ['pending','video','wall','slideshow'])for(const mobile of [false,true]){
      const context=await browser.newContext({locale:"en-GB",viewport:mobile?{width:390,height:844}:{width:1440,height:1000}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
      console.log(`Checking ${mode} ${mobile?'mobile':'desktop'}`);
      await page.goto(`http://127.0.0.1:${server.address().port}/fixture?mode=${mode}`);
      await page.waitForFunction(()=>document.querySelector('button')!==null).catch(async error=>{throw new Error(`${error.message}\nRuntime errors: ${errors.join('; ')}\n${await page.locator('body').innerText()}`);});
      if(mode!=='pending'){
        await page.getByRole('button',{name:'Instagram',exact:true}).click();
        await page.waitForFunction(()=>document.querySelector('[aria-label="Post to @fixture on Instagram"]')?.getAttribute('aria-pressed')==='true');
        await page.getByRole('textbox',{name:/^Post caption/}).fill('Repeat this same content');
      }
      assert.equal(await page.getByRole('group',{name:'Publishing time',exact:true}).count(),0);
      const start=posts.length;loseNext=mobile;
      // A lost acknowledgement is resolved with a read, without another POST.
      await page.getByRole('button',{name:'Post now',exact:true}).last().click();
      await page.getByRole('link',{name:'View in Scheduling',exact:true}).waitFor();
      assert.match(await page.locator('body').innerText(),/Post scheduled/);
      assert.equal(await page.getByRole('link',{name:'View in Scheduling',exact:true}).getAttribute('href'),'/scheduling');
      const linkStyle=await page.getByRole('link',{name:'View in Scheduling',exact:true}).evaluate(link=>({color:getComputedStyle(link).color,underline:getComputedStyle(link).textDecorationLine,parentColor:getComputedStyle(link.parentElement).color}));
      assert.notEqual(linkStyle.color,linkStyle.parentColor,JSON.stringify({mode,mobile,linkStyle}));
      assert.match(linkStyle.underline,/underline/,JSON.stringify({mode,mobile,linkStyle}));
      assert.equal(linkStyle.color,'rgb(255, 112, 69)',JSON.stringify({mode,mobile,linkStyle}));
      await page.keyboard.press('Tab');
      await page.getByRole('link',{name:'View in Scheduling',exact:true}).focus();
      assert.equal(await page.getByRole('link',{name:'View in Scheduling',exact:true}).evaluate(link=>getComputedStyle(link).outlineStyle),'solid');
      assert.doesNotMatch(await page.locator('body').innerText(),/Confirm the same saved request|Check saved|Resume saved|not confirmed/);
      assert.equal(posts.length,start+1);assert.equal((mode==='pending'?posts[start].input.schedule:posts[start].input).useDefaultScheduleTime,true);
      await page.reload();
      await page.getByRole('link',{name:'View in Scheduling',exact:true}).waitFor();
      assert.equal(posts.length,start+1,'Restoring a confirmed schedule never submits another post');
      await page.screenshot({path:path.join(out,`${mode}-${mobile?'mobile':'desktop'}.png`),fullPage:true});
      await page.getByRole('button',{name:/^(Post now|Schedule post)$/}).last().click();
      // Successful direct schedules clear the unsent form cache. After reload,
      // the confirmed receipt remains; supply the new post's details explicitly.
      if(mode!=='pending'){
        await page.getByRole('button',{name:'Instagram',exact:true}).click();
        await page.waitForFunction(()=>document.querySelector('[aria-label="Post to @fixture on Instagram"]')?.getAttribute('aria-pressed')==='true');
        await page.getByRole('textbox',{name:/^Post caption/}).fill('Repeat this same content');
        await page.getByLabel('Date',{exact:true}).fill('2099-12-01');
      }
      if(mode==='pending')await page.getByLabel('Date',{exact:true}).fill('2099-12-01');
      await pickTime(page,'17:30');
      await page.getByRole('button',{name:'Schedule post',exact:true}).evaluate(button=>{button.click();button.click();});
      await page.getByRole('link',{name:'View in Scheduling',exact:true}).waitFor();assert.equal(posts.length,start+2);
      const [first,second]=posts.slice(start).map(p=>p.input);
      if(mode==='pending'){assert.notEqual(first.requestKey,second.requestKey);assert.deepEqual(first.draft,second.draft);assert.equal(second.schedule.scheduledTime,'17:30');}
      else{assert.notEqual(first.idempotencyKey,second.idempotencyKey);assert.deepEqual(first.source,second.source);assert.equal(second.scheduledTime,'17:30');}
      assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await context.close();
    }
    for(const mobile of [false,true]){
      const page=await browser.newPage({locale:"en-GB",viewport:mobile?{width:390,height:844}:{width:1440,height:1000}});
      await page.goto(`http://127.0.0.1:${server.address().port}/fixture?mode=talking`);
      const link=page.getByRole('link',{name:'View in Scheduling',exact:true});await link.waitFor();
      assert.equal(await link.evaluate(node=>getComputedStyle(node).color),'rgb(255, 112, 69)');
      assert.match(await link.evaluate(node=>getComputedStyle(node).textDecorationLine),/underline/);
      await page.screenshot({path:path.join(out,`talking-${mobile?'mobile':'desktop'}.png`),fullPage:true});await page.close();
    }
    console.log('PASS: pending video, Hook, Wall and slideshow; desktop/mobile; orange underlined confirmation links, reload, repeat an hour later, double clicks, lost acknowledgements. Talking Head confirmation presentation also verified. Fixture APIs only.');
  }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
