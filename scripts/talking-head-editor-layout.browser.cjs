/* eslint-disable @typescript-eslint/no-require-imports -- Isolated real-component browser regression. */
// Auth and preparation are disconnected. The clip editor, its portals and both
// layout stylesheets are real; this fixture never writes to a live account.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const postcss = require("postcss");
const tailwind = require("@tailwindcss/postcss");
const { webpack } = require("next/dist/compiled/webpack/webpack");
let playwright;
try { playwright = require("playwright"); }
catch { playwright = require(path.join(process.env.USERPROFILE, ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright")); }
const root = path.resolve(__dirname, ".."), out = path.join(root, ".tmp/talking-head-editor-layout");
fs.mkdirSync(out, { recursive: true });
const file = (name, content) => fs.writeFileSync(path.join(out, name), content);
file("loader.cjs", `const ts=require(${JSON.stringify(require.resolve("typescript"))});module.exports=source=>ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText;`);
file("css.cjs", `module.exports=function(source){const prefix=this.resourcePath.replace(/[^a-zA-Z]/g,'')+'_';const names=Object.fromEntries([...source.matchAll(/\\.([a-zA-Z][a-zA-Z0-9_-]*)/g)].map(m=>[m[1],prefix+m[1]]));const css=source.replaceAll(/:global\\(([^)]+)\\)/g,'$1').replaceAll(/\\.([a-zA-Z][a-zA-Z0-9_-]*)/g,(_,name)=>'.'+names[name]);return 'const style=document.createElement("style");style.textContent='+JSON.stringify(css)+';document.head.append(style);export default '+JSON.stringify(names)+';';};`);
file("ui.tsx", `export const WorkflowBackgroundAudioPicker=()=>null;export const RemixTextSection=({children})=><>{children}</>;export const SCHEDULE_PLATFORMS=[];export const WorkflowDemoPreview=()=>null;export const loadWorkflowDefaultMusic=async()=>{throw Error('Unexpected live music lookup');};
export const useAuth=()=>({user:null});export const getCurrentUserIdToken=async()=>null;export const fetchAIStudioMediaAsset=async()=>{throw Error('Unexpected live media lookup');};export const uploadAIStudioReferenceMedia=async()=>{throw Error('Unexpected upload');};
export const useLocalWorkflowMedia=()=>({asset:null,loading:false,error:null});export const DEFAULT_FINISHING_OPTIONS={};export const useWorkflowFinishing=()=>({output:null,action:{disabled:true,busy:false,message:'Fixture only'}});export const useClipDraftSave=()=>({loaded:true,saved:null,busy:false,dirty:false,error:null,save:async()=>{},reload:async()=>{}});`);
file("entry.tsx", `import {createRoot} from 'react-dom/client';import {useCallback} from 'react';import {QueryClient,QueryClientProvider} from '@tanstack/react-query';import {TalkingHeadClipEditing} from '@/components/explore/talking-head-clip-editing';import {WorkflowCreationPanel} from '@/components/explore/workflow-creation-panel';import {WorkflowEditWorkspace} from '@/components/explore/workflow-edit-workspace';import creation from '@/components/explore/workflow-creation.module.css';import sections from '@/components/explore/workflow-section-layout.module.css';
const empty={asset:null,loading:false,error:null};const source={name:'Portrait talking head',url:'/video.mp4',duration:3};const demo={...empty,asset:{...source,name:'UGCPilot_Final_Demo(1) (online-video-cutter.com).mp4'}};
function App(){const dirty=useCallback(()=>{},[]);return <TalkingHeadClipEditing enabled={false} ownerId={null} source={null} sourcePreview={source} demo={demo} demoFraming={null} active onDirty={dirty}>{clips=><div className={sections.workspace} data-hook-first-screen><header className={sections.header}><h1>Talking Head + Demo</h1></header><main className={sections.layout}><div className={sections.stage} data-preview-visible data-focused-workflow data-stage="edit" data-editing={clips.editing}><WorkflowCreationPanel kind="hook" section="edit" actionContent={clips.editing?clips.actions:undefined} navigation={<nav className={sections.panelNavigation}><button>Create</button><button>Edit demo</button><button>Schedule</button></nav>}>{clips.controls}<div hidden={clips.editing}><p>Sequence controls</p><div style={{height:1500}}>Existing settings</div></div></WorkflowCreationPanel><section id="hook-workflow-preview" className={creation.main+' '+sections.preview} aria-label="Hook creation workspace">{clips.preview}<div hidden={clips.editing}><WorkflowEditWorkspace kind="hook" demo={demo} demoAudio={empty} sourcePreview={source} onEditSource={clips.openOpening} onEditDemo={clips.openDemo}/></div></section></div></main></div>}</TalkingHeadClipEditing>};createRoot(document.getElementById('root')).render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><App/></QueryClientProvider>);`);
const globals = productionCss => `<html class="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${productionCss}</style><style>body{margin:0}h1{font-size:20px}h3{margin:0}video{object-fit:contain}summary{cursor:pointer}.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}</style></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>`;
async function main() {
  execFileSync(require("ffmpeg-static"), ["-nostdin","-v","error","-y","-i",path.join(root,"public/explore/covers/hook-video-v1.mp4"),"-t","3","-vf","crop=ih*9/16:ih:(iw-ih*9/16)/4:0,scale=478:850","-an","-c:v","libx264",path.join(out,"portrait.mp4")], {windowsHide:true,timeout:30000});
  const aliases = {};
  for (const name of ["components/explore/workflow-background-audio-picker","components/explore/remix-text-section","contexts/auth-context","lib/firebase/auth","lib/ai-studio/media-client","lib/ai-studio/reference-media-upload","components/explore/use-local-workflow-media","components/explore/use-workflow-finishing","components/explore/use-clip-draft-save","components/explore/workflow-scheduling-panel","components/explore/workflow-demo-controls","lib/explore/workflow-default-music-client"]) aliases['@/'+name]=path.join(out,'ui.tsx');
  aliases['@']=root;
  await new Promise((resolve,reject)=>{const compiler=webpack({mode:"development",devtool:false,plugins:[new webpack.DefinePlugin({"process.env":JSON.stringify({NODE_ENV:"development"})})],entry:path.join(out,"entry.tsx"),output:{path:out,filename:"bundle.js"},resolve:{extensions:[".tsx",".ts",".js"],alias:aliases},module:{rules:[{test:/\.tsx?$/,use:path.join(out,"loader.cjs")},{test:/\.css$/,use:path.join(out,"css.cjs")}]}});compiler.run((error,stats)=>compiler.close(()=>error||stats.hasErrors()?reject(error||Error(stats.toString({all:false,errors:true}))):resolve()));});
  const globalCss=(await postcss([tailwind()]).process(`@import "${path.join(root,'app','globals.css').replaceAll(path.sep,'/')}";`,{from:path.join(out,'fixture.css')})).css;
  const server=http.createServer((request,response)=>{const name=request.url==='/bundle.js'?'bundle.js':request.url==='/video.mp4'?'portrait.mp4':null;response.setHeader('Content-Type',name==='bundle.js'?'text/javascript':name?'video/mp4':'text/html');response.end(name?fs.readFileSync(path.join(out,name)):globals(globalCss));});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let browser;
  const measurements=[];
  try {
    browser=await playwright.chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
    const page=await browser.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
    for (const viewport of [{width:1900,height:806},{width:1440,height:900},{width:1280,height:720},{width:390,height:844},{width:320,height:700}]) {
      await page.setViewportSize(viewport);await page.goto('http://127.0.0.1:'+server.address().port);
      await page.getByRole('button',{name:'Edit talking-head video',exact:true}).waitFor();
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Sequence overview fits screen with both selected clips and a long filename');
      for(const label of ['Talking head segment','Demo segment'])assert.equal(await page.getByRole('region',{name:label,exact:true}).evaluate(element=>element.scrollWidth>element.clientWidth),false,label+' has no internal horizontal overflow');
      await page.locator('[data-workflow-section-content]').evaluate(element=>{element.scrollTop=element.scrollHeight;});
      await page.getByRole('button',{name:'Edit talking-head video',exact:true}).click();
      await page.waitForFunction(()=>document.querySelector('[data-clip-media] video')?.readyState>=2);
      const layout=await page.evaluate(()=>{const frame=document.querySelector('[data-clip-media]').getBoundingClientRect(),video=document.querySelector('[data-clip-media] video').getBoundingClientRect(),stage=document.querySelector('[data-focused-workflow]').getBoundingClientRect(),settings=document.querySelector('[data-workflow-section-content]'),trim=document.querySelector('[data-editor-section="trim"]').getBoundingClientRect(),trimStart=document.querySelector('[aria-label="Trim start"]').getBoundingClientRect(),trimEnd=document.querySelector('[aria-label="Trim end"]').getBoundingClientRect(),overlay=document.querySelector('[aria-label="Overlay text"]').getBoundingClientRect();return{frame:{width:frame.width,height:frame.height},video:{width:video.width,height:video.height},stageWidth:stage.width,trim:{width:trim.width,x:trim.x},trimStart:{width:trimStart.width},trimEnd:{width:trimEnd.width},overlay:{width:overlay.width},scrollTop:settings.scrollTop,overflow:document.documentElement.scrollWidth>innerWidth};});
      assert.equal(layout.overflow,false,JSON.stringify({viewport,layout}));
      assert.ok(Math.abs(layout.frame.height-layout.video.height)<1 && Math.abs(layout.frame.width-layout.video.width)<1,'Video fills entire portrait frame: '+JSON.stringify({viewport,layout}));
      assert.ok(Math.abs(layout.frame.width/layout.frame.height-478/850)<.01,'Natural portrait ratio remains intact');
      assert.ok(layout.frame.height>300,'Preview remains readable: '+JSON.stringify({viewport,layout}));
      if(viewport.width>=1024)assert.ok(layout.stageWidth>viewport.width-100,'Editor uses the available workspace');
      assert.ok(layout.trim.width<=760.5,'Trim editor stays at a purposeful working width: '+JSON.stringify({viewport,layout}));
      assert.ok(layout.overlay.width<=760.5,'Text editor stays aligned with trim controls: '+JSON.stringify({viewport,layout}));
      assert.ok(Math.abs(layout.trimStart.width-layout.trimEnd.width)<2,'Trim number fields stay balanced: '+JSON.stringify({viewport,layout}));
      if(viewport.width>=1024)assert.ok(layout.trimStart.width>=180&&layout.trimStart.width<380,'Trim number fields are compact and readable: '+JSON.stringify({viewport,layout}));
      if(viewport.width<1024)assert.ok(layout.trim.width<=viewport.width-24,'Compact controls remain within the mobile canvas: '+JSON.stringify({viewport,layout}));
      assert.equal(layout.scrollTop,0,'Editor opens at the first controls instead of inherited overview scroll');
      await page.getByLabel('Trim start',{exact:true}).fill('1');await page.getByLabel('Overlay text',{exact:true}).fill('Portrait layout check');
      await page.getByRole('button',{name:'Back to previews',exact:true}).click();await page.getByRole('button',{name:'Edit talking-head video',exact:true}).click();
      assert.equal(await page.getByLabel('Trim start',{exact:true}).inputValue(),'1');assert.equal(await page.getByLabel('Overlay text',{exact:true}).inputValue(),'Portrait layout check');
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Reopening edited controls fits the viewport');
      measurements.push({viewport,layout});await page.screenshot({path:path.join(out,`editor-${viewport.width}.png`),fullPage:true});
    }
    assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'measurements.json'),JSON.stringify(measurements,null,2));
    console.log('PASS real Talking Head clip editor: full-width workspace, entire portrait frame, initial scroll reset, draft retention, no overflow at 320–1900px.');
  } finally {await browser?.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
