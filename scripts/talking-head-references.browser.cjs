/* eslint-disable @typescript-eslint/no-require-imports -- Actual components with isolated media/auth fixtures. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { webpack } = require('next/dist/compiled/webpack/webpack');
let playwright;
try { playwright = require('playwright'); } catch { playwright = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
const root = path.resolve(__dirname, '..'), out = path.join(root, '.tmp/talking-reference-browser');
fs.mkdirSync(out, { recursive: true });
const write = (name, value) => fs.writeFileSync(path.join(out, name), value);
write('loader.cjs', `const ts=require(${JSON.stringify(require.resolve('typescript'))});module.exports=function(s){return ts.transpileModule(s,{fileName:this.resourcePath,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText;};`);
write('css.cjs', String.raw`module.exports=function(s){const prefix=require('node:path').basename(this.resourcePath).replace(/[^a-zA-Z]/g,'')+'_',names={};s=s.replace(/:global\(([^)]+)\)/g,(_,value)=>'GLOBALSTART'+Buffer.from(value).toString('hex')+'GLOBALEND');s=s.replace(/\.([a-zA-Z][a-zA-Z0-9_-]*)/g,(_,name)=>{names[name]=prefix+name;return '.'+prefix+name;});s=s.replace(/GLOBALSTART([a-f0-9]+)GLOBALEND/g,(_,value)=>Buffer.from(value,'hex').toString());return 'const style=document.createElement("style");style.textContent='+JSON.stringify(s)+';document.head.append(style);export default '+JSON.stringify(names)+';';};`);
write('auth.ts', `export const useAuth=()=>({user:{uid:'fixture-owner'},loading:false});export const getCurrentUserIdToken=async()=> 'fixture-token';export const useAIStudioAccess=()=>window.testAccess??'free';export const useBillingSubscription=()=>({data:{isActive:true}});`);
write('next.tsx', `export const useSearchParams=()=>new URLSearchParams();export default function Element({href,children,src,alt,...props}){return src?<img src={src} alt={alt}/>:<a href={href} {...props}>{children}</a>;}`);
write('entry.tsx', `import {createRoot} from 'react-dom/client';import {useState} from 'react';import {QueryClient,QueryClientProvider} from '@tanstack/react-query';import {useTalkingHeadReference} from '@/components/explore/use-talking-head-reference';import {TalkingHeadReferences} from '@/components/explore/talking-head-references';import {WorkflowCreationForm} from '@/components/explore/workflow-creation-form';import {useLocalWorkflowMedia} from '@/components/explore/use-local-workflow-media';import {useLocalWorkflowImages} from '@/components/explore/use-local-workflow-images';import {createWorkflowSession} from '@/lib/explore/workflow-session';import {normalizeWorkflowGenerationSettings} from '@/lib/explore/workflow-generation-settings';import {workflowGenerationPrompt} from '@/lib/explore/workflow-generation-client';import sections from '@/components/explore/workflow-section-layout.module.css';import creation from '@/components/explore/workflow-creation.module.css';
const initial=()=>JSON.parse(localStorage.getItem('fixture-session')||'null')??{...createWorkflowSession('fixture-owner'),instructions:'Keep my own product message',generationSettings:normalizeWorkflowGenerationSettings({model:'seedance_2_5'})};
function App(){const [session,setSession]=useState(initial),[access,setAccess]=useState('free'),[requests,setRequests]=useState(0);window.testAccess=access;const update=next=>setSession(previous=>{const value=next(previous);localStorage.setItem('fixture-session',JSON.stringify(value));return value;});const settings=session.generationSettings;const change=patch=>update(p=>({...p,generationSettings:normalizeWorkflowGenerationSettings({...p.generationSettings,...patch})}));const refs=useTalkingHeadReference({ownerId:'fixture-owner',enabled:true,session,updateSession:update,settings,onSettingsChange:change});const audio=useLocalWorkflowMedia('audio'),images=useLocalWorkflowImages(6);return <main className={sections.workspace} data-hook-first-screen><header><h1>Talking Head + Demo</h1><button onClick={()=>setAccess(access==='free'?'pro':'free')}>Toggle account</button><span data-testid='requests'>{requests}</span></header><div className={'layout '+sections.stage} data-focused-workflow data-stage='create' data-preview-visible='true'><aside><WorkflowCreationForm kind='hook' ownerId='fixture-owner' creator={images} imageReferences={images} videoReference={refs.videoReference} audio={audio} audioLabel='Talking head audio' audioMode='voice' onAudioModeChange={()=>{}} instructions={session.instructions} onInstructionsChange={instructions=>update(p=>({...p,instructions}))} referenceInstructions={refs.selectedId?{value:refs.instructions,onChange:refs.changeInstructions}:undefined} generationSettings={settings} onGenerationSettingsChange={change}/><button disabled={refs.videoReference.loading||!!refs.videoReference.error||!refs.videoReference.asset} onClick={()=>{window.fixturePayload={prompt:workflowGenerationPrompt({instructions:session.instructions,referenceInstructions:refs.instructions}),file:refs.videoReference.asset.file.name,duration:settings.duration};setRequests(n=>n+1);}}>Generate fixture</button>{refs.videoReference.error?<p role='alert'>{refs.videoReference.error}</p>:null}<p data-testid='selected'>{refs.selectedId}</p></aside><section className={'right '+creation.main+' '+sections.preview}><TalkingHeadReferences items={refs.query.data??[]} loading={refs.query.isPending} failed={refs.query.isError} selectedId={refs.selectedId} model={settings.model} disabled={refs.videoReference.loading} onChoose={id=>void refs.choose(id)} onRetry={()=>void refs.query.refetch()}/></section></div></main>};createRoot(document.getElementById('root')).render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><App/></QueryClientProvider>);`);

async function main() {
  const aliases = { '../firebase/auth':path.join(out,'auth.ts'), '@/contexts/auth-context':path.join(out,'auth.ts'), '@/lib/firebase/auth':path.join(out,'auth.ts'), '@/components/generation/use-ai-studio-access':path.join(out,'auth.ts'), '@/components/billing/use-billing-subscription':path.join(out,'auth.ts'), 'next/link':path.join(out,'next.tsx'), 'next/image':path.join(out,'next.tsx'), 'next/navigation':path.join(out,'next.tsx'), '@':root };
  await new Promise((resolve,reject)=>{const c=webpack({mode:'development',devtool:false,context:root,entry:path.join(out,'entry.tsx'),output:{path:out,filename:'bundle.js'},plugins:[new webpack.DefinePlugin({'process.env.NEXT_PUBLIC_ENABLE_OPENROUTER_SEEDANCE':JSON.stringify('true'),'process.env.NEXT_PUBLIC_ENABLE_OPENROUTER_WAN':JSON.stringify('true')})],resolve:{extensions:['.tsx','.ts','.js'],alias:aliases},module:{rules:[{test:/\.tsx?$/,use:path.join(out,'loader.cjs')},{test:/\.css$/,use:path.join(out,'css.cjs')}]}});c.run((e,s)=>c.close(()=>e||s.hasErrors()?reject(e||Error(s.toString({all:false,errors:true}))):resolve()));});
  const css=(await require('postcss')([require('@tailwindcss/postcss')({base:root})]).process(fs.readFileSync(path.join(root,'app/globals.css'),'utf8').replace('@import "tailwindcss";','@import "tailwindcss" source(none);\n@source "../components/explore";\n@source "../components/ui";'),{from:path.join(root,'app/globals.css')})).css;
  const items=JSON.parse(fs.readFileSync(path.join(root,'lib/explore/talking-head-reference-catalog.json'))).items.map(item=>({...item,format:'hook',slides:[]}));
  let failDownload=false;const reads=[];
  const server=http.createServer((req,res)=>{const url=new URL(req.url,'http://fixture');
    if(url.pathname==='/bundle.js'){res.setHeader('Content-Type','text/javascript');return res.end(fs.readFileSync(path.join(out,'bundle.js')));}
    if(url.pathname==='/api/explore/talking-head-references'){assert.equal(req.headers.authorization,'Bearer fixture-token');res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({ok:true,items}));}
    if(url.pathname.startsWith('/explore/talking-head-references/v1/')){reads.push(url.pathname);if(failDownload&&url.pathname.endsWith('.mp4')){res.writeHead(503);return res.end();}res.setHeader('Content-Type',url.pathname.endsWith('.mp4')?'video/mp4':'image/jpeg');return res.end(fs.readFileSync(path.join(root,'public',url.pathname)));}
    res.setHeader('Content-Type','text/html');res.end('<html class="dark"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'body{margin:0}main>header{display:flex;justify-content:space-between;padding:20px}.layout{display:grid;grid-template-columns:minmax(300px,400px) minmax(0,1fr);gap:24px;padding:20px}aside,.right{min-width:0;border:1px solid #383838;border-radius:20px}aside{padding:20px;background:#272727}.right{align-self:start}@media(max-width:800px){.layout{grid-template-columns:minmax(0,1fr);padding:10px}.right{grid-row:1}}</style><div id="root"></div><script>window.process={env:{NODE_ENV:"development"}};</script><script src="/bundle.js"></script></html>');
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
  try {
    browser=await playwright.chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});const page=await browser.newPage(),errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error(e.stack);});page.on('console',m=>{if(m.type()==='error')console.error(m.text());});const base='http://127.0.0.1:'+server.address().port;
    for(const size of [{width:1366,height:768},{width:1536,height:864},{width:390,height:844}]){
      await page.setViewportSize(size);await page.goto(base);await page.getByRole('button',{name:'Use as reference',exact:true}).first().waitFor().catch(async e=>{console.error((await page.locator('body').innerText()).slice(0,2000));throw e;});
      assert.equal(await page.getByRole('button',{name:'Use as reference',exact:true}).count(),items.filter(item=>item.durationSeconds<=30).length);assert.equal(await page.getByRole('button',{name:'Preview only',exact:true}).count(),2);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      const first=page.locator('[data-reference-id]').first(), cardVideo=first.locator('video');
      await cardVideo.evaluate(async video=>{video.muted=true;await video.play();});
      await page.waitForFunction(()=>document.querySelector('[data-reference-id] video')?.readyState>=2);
      const fit=await cardVideo.evaluate(video=>{video.pause();const media=video.getBoundingClientRect(),slot=video.parentElement.getBoundingClientRect();return{media:{width:media.width,height:media.height},slot:{width:slot.width,height:slot.height}};});
      assert.ok(Math.abs(fit.media.width-fit.slot.width)<1&&Math.abs(fit.media.height-fit.slot.height)<1,'Reference footage must fill its card inside the real workflow preview CSS: '+JSON.stringify(fit));
      await page.screenshot({path:path.join(out,'references-'+size.width+'.png')});
    }
    await page.setViewportSize({width:1536,height:2600});await page.goto(base);
    await page.getByRole('button',{name:'Use as reference',exact:true}).first().waitFor();
    await page.screenshot({path:path.join(out,'all-nine-references-1536.png'),fullPage:true});
    await page.setViewportSize({width:1536,height:864});
    const playback=[];
    for(const item of items){
      await page.getByRole('button',{name:'Preview '+item.title,exact:true}).click();
      const video=page.getByRole('dialog').locator('video');
      await video.waitFor();
      await video.evaluate(async element=>{element.muted=true;await element.play();});
      await page.waitForFunction(()=>{const video=document.querySelector('[role="dialog"] video');return video?.readyState>=2&&video.currentTime>.1;});
      const decoded=await video.evaluate(element=>{element.pause();const canvas=document.createElement('canvas');canvas.width=32;canvas.height=32;const context=canvas.getContext('2d');context.drawImage(element,0,0,32,32);const pixels=context.getImageData(0,0,32,32).data;let min=255,max=0;for(let i=0;i<pixels.length;i+=4){const value=(pixels[i]+pixels[i+1]+pixels[i+2])/3;min=Math.min(min,value);max=Math.max(max,value);}return{duration:element.duration,width:element.videoWidth,height:element.videoHeight,time:element.currentTime,range:max-min,nativeControls:element.controls};});
      assert.ok(Math.abs(decoded.duration-item.durationSeconds)<.15, item.id+' preserves its full duration');
      assert.ok(decoded.width>0&&decoded.height>0&&decoded.range>20,item.id+' decodes actual footage');
      assert.equal(decoded.nativeControls,false);
      playback.push({id:item.id,...decoded});
      if(item.id===items[0].id)await page.screenshot({path:path.join(out,'reference-playback-1536.png')});
      await page.keyboard.press('Escape');
    }
    fs.writeFileSync(path.join(out,'playback-report.json'),JSON.stringify(playback,null,2));
    await page.getByRole('button',{name:/Upgrade to Pro/}).first().click();await page.getByRole('heading',{name:'Upgrade to Pro',exact:true}).waitFor();await page.keyboard.press('Escape');
    await page.getByRole('button',{name:'Toggle account',exact:true}).click();assert.equal(await page.locator('a[href^="https://www.tiktok.com/"]').count(),items.length);
    await page.getByRole('button',{name:'Preview '+items[0].title,exact:true}).click();await page.getByRole('dialog').waitFor();assert.equal(await page.getByRole('dialog').locator('video[controls]').count(),0);assert.equal(await page.getByRole('menuitem',{name:/Download/}).count(),0);await page.keyboard.press('Escape');
    await page.getByRole('button',{name:'Use as reference',exact:true}).first().click();await page.getByTestId('selected').filter({hasText:items[0].id}).waitFor();
    assert.equal(await page.getByRole('textbox',{name:'Your instructions',exact:true}).inputValue(),'Keep my own product message');
    const instructions=page.getByRole('textbox',{name:'Reference instructions',exact:true});await instructions.fill('Use my edited reference directions');
    await page.getByRole('button',{name:'Generate fixture',exact:true}).click();const payload=await page.evaluate(()=>window.fixturePayload);assert.match(payload.prompt,/Use my edited reference directions/);assert.match(payload.prompt,/Keep my own product message/);assert.equal(payload.file,items[0].id+'.mp4');
    await page.reload();await page.getByTestId('selected').filter({hasText:items[0].id}).waitFor();await page.waitForFunction(()=>Array.from(document.querySelectorAll('button')).some(button=>button.textContent==='Generate fixture'&&!button.disabled));
    assert.equal(await instructions.inputValue(),'Use my edited reference directions');
    await page.screenshot({path:path.join(out,'selected-reference-1536.png')});
    failDownload=true;await page.getByRole('button',{name:'Use as reference',exact:true}).first().click();await page.getByRole('alert').first().waitFor();assert.equal(await page.getByTestId('selected').textContent(),items[0].id);assert.equal(await page.getByRole('button',{name:'Generate fixture',exact:true}).isDisabled(),true);
    assert.deepEqual(errors,[]);assert.ok(reads.length);console.log('PASS laptop/mobile gallery, free/Pro source access, custom playback, exact reference attachment, combined prompt, reload recovery and failed replacement; no paid generation');
  } finally { await browser?.close();await new Promise(r=>server.close(r)); }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
