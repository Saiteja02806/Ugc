/* eslint-disable @typescript-eslint/no-require-imports -- Real-component browser regression with isolated HTTP fixtures. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { webpack } = require('next/dist/compiled/webpack/webpack');
const postcss = require('postcss');
const tailwind = require('@tailwindcss/postcss');
let playwright;
try { playwright = require('playwright'); }
catch { playwright = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
const root = path.resolve(__dirname, '..'), out = path.join(root, '.tmp/explore-demo-loading-browser');
fs.mkdirSync(out, { recursive: true });
const write = (name, content) => fs.writeFileSync(path.join(out, name), content);
write('loader.cjs', `const ts=require(${JSON.stringify(require.resolve('typescript'))});module.exports=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText;`);
write('css.cjs', `module.exports=function(source){const prefix=this.resourcePath.replace(/[^a-zA-Z]/g,'')+'_';const names=Object.fromEntries([...source.matchAll(/\\.([a-zA-Z][a-zA-Z0-9_-]*)/g)].map(m=>[m[1],prefix+m[1]]));const css=source.replaceAll(/:global\\(([^)]+)\\)/g,'$1').replaceAll(/\\.([a-zA-Z][a-zA-Z0-9_-]*)/g,(_,name)=>'.'+names[name]);return 'const style=document.createElement("style");style.textContent='+JSON.stringify(css)+';document.head.append(style);export default '+JSON.stringify(names)+';';};`);
write('boundary.tsx', `export const useAuth=()=>({user:{uid:'fixture-owner'}});export const getCurrentUserIdToken=async()=> 'fixture-token';
export const fetchAIStudioMediaAsset=async()=>{throw Error('Unexpected owned media lookup');};export const uploadAIStudioReferenceMedia=async()=>{throw Error('Unexpected audio upload');};
export const DEFAULT_FINISHING_OPTIONS={};export const useWorkflowFinishing=()=>({output:null,action:{busy:false,disabled:true,error:null,message:'Fixture only',onAction:()=>{throw Error('Unexpected render');}}});
export const useClipDraftSave=()=>({loaded:true,busy:false,dirty:true,saved:null,error:null,save:async()=>{},reload:()=>{}});
export const WorkflowVideoAssetPicker=()=>null;export const WorkflowBackgroundAudioPicker=()=>null;export const WorkflowSavedAudioPicker=()=>null;
export const RemixTextSection=({children})=><>{children}</>;`);
write('entry.tsx', `import {createRoot} from 'react-dom/client';import {useState,useCallback} from 'react';import {QueryClient,QueryClientProvider} from '@tanstack/react-query';import {FormatDemoSection} from '@/components/explore/format-demo-section';import styles from '@/components/explore/format-workspace.module.css';
function Fixture(){const [editing,setEditing]=useState(false),[controls,sc]=useState(null),[preview,sp]=useState(null),[editControls,se]=useState(null),[actions,sa]=useState(null);const noop=useCallback(()=>{},[]);return <><header style={{padding:16}}>Explore / Hook video</header><main style={{display:'grid',gridTemplateColumns:editing?'1fr':'minmax(260px, 30%) 1fr',gap:16,padding:16,height:'calc(100dvh - 56px)'}}><aside hidden={editing} ref={sc} style={{overflow:'auto',padding:16}}/><section className={styles.clipStage} data-editing={editing} style={{display:'flex',flexDirection:'column',minHeight:0,padding:16,border:'1px solid var(--border)',borderRadius:16}}><h1>{editing?'Edit demo video':'Your videos'}</h1><div className={styles.clipScrollArea} style={{flex:1,overflow:'auto'}}><div className={styles.clipEditorBody} data-editing={editing}><div className={styles.clipPreviews}><div className={styles.clipPreviewCard} ref={sp}/></div><div className={styles.clipTools} hidden={!editing} ref={se}/></div></div><div className={styles.clipActions} ref={sa}/></section></main><FormatDemoSection format="hook" videoId={null} opening={null} openingRevision={0} enabled active controlsTarget={controls} resultsTarget={null} actionsTarget={null} onDirty={noop} onSelectionChange={noop} onSaved={noop} onSkip={noop} onContinue={noop} editActive={editing} editPreviewActive editControlsTarget={editControls} editResultsTarget={preview} editActionsTarget={actions} onEdit={()=>setEditing(true)} onEditDone={()=>setEditing(false)} onAdd={()=>{setEditing(false);requestAnimationFrame(()=>document.querySelector('[data-demo-source=upload]')?.focus());}}/></>};createRoot(document.getElementById('root')).render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><Fixture/></QueryClientProvider>);`);
write('entry.tsx', `import {FormatVideoEditor} from '@/components/explore/format-video-editor';import {WorkflowCreationPanel} from '@/components/explore/workflow-creation-panel';import creation from '@/components/explore/workflow-creation.module.css';import sections from '@/components/explore/workflow-section-layout.module.css';\n` + fs.readFileSync(path.join(out,'entry.tsx'),'utf8').replace('<Fixture/>', '<Entry/>') + `
function Entry(){const mode=new URLSearchParams(location.search).get('shared');return mode?<SharedEditor mode={mode}/>:<Fixture/>;}
function SharedEditor({mode}){const [controls,sc]=useState(null),[preview,sp]=useState(null),[actions,sa]=useState(null);const noop=useCallback(()=>{},[]);return <><div className={sections.workspace} data-hook-first-screen><header className={sections.header}>Explore / {mode==='wall'?'Wall of text':'Talking Head + Demo'}</header><main className={sections.layout}><div className={sections.stage} data-preview-visible data-focused-workflow data-stage="edit" data-editing="true"><WorkflowCreationPanel kind="hook" section="edit" actionContent={<div ref={sa}/>}><div ref={sc}/></WorkflowCreationPanel><section ref={sp} className={creation.main+' '+sections.preview}/></div></main></div><FormatVideoEditor format={mode==='wall'?'wall_text':'hook'} video={{id:'fixture-local',mediaAssetId:null,title:'Shared editor fixture',url:'/video.mp4',durationSeconds:8,ratio:'16:9'}} active enabled={false} localPreview controlsTarget={controls} resultsTarget={preview} actionsTarget={actions} showSoundControls={mode==='wall'} prepareInSequence onBackToPreview={noop} onDirty={noop} onSaved={noop} onContinue={noop}/></>}
`);
async function main() {
  const aliases = { '@':root };
  for (const name of ['contexts/auth-context','lib/firebase/auth','lib/ai-studio/media-client','lib/ai-studio/reference-media-upload','components/explore/use-clip-draft-save','components/explore/use-workflow-finishing','components/explore/workflow-video-asset-picker','components/explore/workflow-background-audio-picker','components/explore/workflow-saved-audio-picker','components/explore/remix-text-section']) aliases['@/'+name]=path.join(out,'boundary.tsx');
  delete aliases['@']; aliases['@']=root;
  await new Promise((resolve,reject)=>{const compiler=webpack({mode:'development',devtool:false,entry:path.join(out,'entry.tsx'),output:{path:out,filename:'bundle.js'},resolve:{extensions:['.tsx','.ts','.js'],alias:aliases},module:{rules:[{test:/\.tsx?$/,use:path.join(out,'loader.cjs')},{test:/\.css$/,use:path.join(out,'css.cjs')}]}});compiler.run((error,stats)=>compiler.close(()=>error||stats.hasErrors()?reject(error||Error(stats.toString({all:false,errors:true}))):resolve()));});
  console.log('Real component bundle built. Building scoped application styles.');
  const globalCss=fs.readFileSync(path.join(root,'app/globals.css'),'utf8').replace('@import "tailwindcss";', '@import "tailwindcss" source(none);');
  const css=(await postcss([tailwind()]).process(globalCss+`\n@source "${path.join(root,'components/explore').replaceAll(path.sep,'/')}";\n@source "${path.join(root,'components/ui').replaceAll(path.sep,'/')}";`,{from:path.join(root,'app/globals.css')})).css;
  console.log('Scoped styles built. Starting browser checks.');
  const media=fs.readFileSync(path.join(root,'public/explore/covers/hook-video-v1.mp4'));
  const id='00000000-0000-4000-8000-000000000002';
  let pendingUpload=null, completedBody=null, completions=0;
  const json=(res,value)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(value));};
  const server=http.createServer(async(req,res)=>{
    const url=new URL(req.url,'http://fixture');
    if(url.pathname==='/bundle.js'){res.setHeader('Content-Type','text/javascript');return res.end(fs.readFileSync(path.join(out,'bundle.js')));}
    if(url.pathname==='/api/demo/create-upload-url') return json(res,{ok:true,demoId:id,key:'fixture-key',uploadUrl:`http://127.0.0.1:${server.address().port}/fixture-upload`});
    if(url.pathname==='/fixture-upload'){for await(const chunk of req) void chunk;pendingUpload=res;return;}
    if(url.pathname==='/fixture-release'){assert.ok(pendingUpload);pendingUpload.end();pendingUpload=null;return json(res,{ok:true});}
    if(url.pathname==='/api/demo/complete-upload'){let body='';for await(const chunk of req)body+=chunk;completedBody=JSON.parse(body);completions++;return json(res,{ok:true,mediaAsset:{id,title:'Confirmed demo',url:'/video.mp4',status:'ready',sourceType:'demo_upload',collection:'video',mimeType:'video/mp4',durationSeconds:completedBody.durationSeconds,width:completedBody.width,height:completedBody.height}});}
    if(url.pathname==='/video.mp4'){res.setHeader('Content-Type','video/mp4');res.setHeader('Content-Length',media.length);return res.end(media);}
    if(url.pathname.startsWith('/api/')){res.statusCode=500;return json(res,{error:'Unexpected API '+url.pathname});}
    res.setHeader('Content-Type','text/html; charset=utf-8');res.end(`<html class="dark"><head><meta charset="utf-8"><style>${css}</style></head><body><div id="root"></div><script>window.process={env:{NODE_ENV:'development'}}</script><script src="/bundle.js"></script></body></html>`);
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let browser;
  try {
    browser=await playwright.chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
    const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
    for(const viewport of [{width:1280,height:720},{width:1536,height:864}]){
      await page.setViewportSize(viewport);await page.goto(`http://127.0.0.1:${server.address().port}/`);
      await page.getByLabel('Upload or replace demo video',{exact:true}).setInputFiles({name:'slow-demo.mp4',mimeType:'video/mp4',buffer:media});
      await page.getByRole('button',{name:'Edit demo video',exact:true}).waitFor();
      assert.equal(await page.getByRole('button',{name:'Edit demo video',exact:true}).isEnabled(),true);
      assert.equal(await page.getByRole('button',{name:'Change demo video',exact:true}).isEnabled(),true);
      await page.waitForFunction(()=>document.querySelector('[data-clip-media] video')?.readyState>=1);
      const overview=await page.locator('[data-clip-media]').evaluate(frame=>{const r=frame.getBoundingClientRect();return{width:r.width,height:r.height,aspect:r.width/r.height};});
      assert.ok(overview.width>300,'Demo overview makes use of the available laptop width');
      await page.screenshot({path:path.join(out,`overview-${viewport.width}.png`)});
      await page.getByRole('button',{name:'Change demo video',exact:true}).click();
      await page.waitForFunction(()=>document.activeElement?.getAttribute('data-demo-source')==='upload');
      await page.getByRole('button',{name:'Edit demo video',exact:true}).click();
      assert.equal(await page.getByRole('button',{name:'Save edits',exact:true}).isDisabled(),true);
      await page.getByLabel('Demo trim start',{exact:true}).fill('1');
      await page.getByLabel('Demo trim end',{exact:true}).fill('3');
      await page.getByLabel('Overlay text',{exact:true}).fill('Edited before upload finished');
      assert.equal(await page.getByRole('button',{name:'Back to videos',exact:true}).isEnabled(),true);
      await page.screenshot({path:path.join(out,`upload-edit-${viewport.width}.png`)});
      await page.request.get(`http://127.0.0.1:${server.address().port}/fixture-release`);
      await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent==='Save edits' && !b.disabled));
      await page.getByRole('button',{name:'Save edits',exact:true}).waitFor();
      assert.equal(await page.getByRole('button',{name:'Save edits',exact:true}).isEnabled(),true);
      assert.equal(await page.getByLabel('Demo trim start',{exact:true}).inputValue(),'1');
      assert.equal(await page.getByLabel('Demo trim end',{exact:true}).inputValue(),'3');
      assert.equal(await page.getByLabel('Overlay text',{exact:true}).inputValue(),'Edited before upload finished');
      const metrics=await page.evaluate(()=>{const footer=[...document.querySelectorAll('button')].find(b=>b.textContent==='Save edits').closest('[class*="clipActions"]');const box=footer.getBoundingClientRect();return{footerHeight:box.height,borderTop:getComputedStyle(footer).borderTopWidth,visible:box.bottom<=innerHeight,overflow:document.documentElement.scrollWidth>innerWidth};});
      assert.equal(metrics.borderTop,'0px');assert.equal(metrics.visible,true);assert.equal(metrics.overflow,false);
      assert.equal(await page.getByText('Changes appear in the preview immediately. Save edits to keep them.',{exact:true}).count(),0);
      await page.screenshot({path:path.join(out,`confirmed-edit-${viewport.width}.png`)});
      await page.evaluate(()=>localStorage.clear());
      console.log(JSON.stringify({viewport,...metrics,editBeforeConfirmation:true,pendingEditsPreserved:true}));
    }
    for(const mode of ['talking-head','wall']){
      await page.setViewportSize({width:1280,height:720});
      await page.goto(`http://127.0.0.1:${server.address().port}/?shared=${mode}`);
      const save=page.getByRole('button',{name:'Save edits',exact:true});await save.waitFor();
      if(mode==='wall')await page.getByRole('button',{name:'Edit video with advanced controls',exact:true}).click();
      assert.equal(await page.getByText('Changes appear in the preview immediately. Save edits to keep them.',{exact:true}).count(),0);
      const metrics=await save.evaluate(b=>{const f=b.closest('footer'),r=f.getBoundingClientRect();return{height:r.height,border:getComputedStyle(f).borderTopWidth,visible:r.bottom<=innerHeight,overflow:document.documentElement.scrollWidth>innerWidth};});
      assert.equal(metrics.border,'0px');assert.equal(metrics.visible,true);assert.equal(metrics.overflow,false);
      await page.getByRole('region',{name:'Workflow section settings',exact:true}).evaluate(el=>{el.scrollTop=el.scrollHeight;});
      await page.screenshot({path:path.join(out,`${mode}-footer-1280.png`)});
      console.log(JSON.stringify({sharedEditor:mode,viewport:{width:1280,height:720},...metrics}));
    }
    assert.equal(completions,2);assert.deepEqual(errors,[]);console.log('Demo upload/edit and compact footer browser checks passed. HTTP/auth/storage boundaries use fixtures.');
  } finally { pendingUpload?.end();await browser?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve)); }
}
main().catch(error=>{console.error(error);process.exitCode=1;});

