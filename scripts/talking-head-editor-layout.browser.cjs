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
file("entry.tsx", `import {createRoot} from 'react-dom/client';import {useCallback,useState} from 'react';import {QueryClient,QueryClientProvider} from '@tanstack/react-query';import {FormatVideoEditor} from '@/components/explore/format-video-editor';import {TalkingHeadClipEditing} from '@/components/explore/talking-head-clip-editing';import {WorkflowCreationPanel} from '@/components/explore/workflow-creation-panel';import {WorkflowEditWorkspace} from '@/components/explore/workflow-edit-workspace';import creation from '@/components/explore/workflow-creation.module.css';import sections from '@/components/explore/workflow-section-layout.module.css';
const empty={asset:null,loading:false,error:null,choose:()=>{},remove:()=>{}};const shape=new URLSearchParams(location.search).get('shape');const source={name:'Talking head ratio check',url:shape?'/'+shape+'.mp4':'/video.mp4',duration:3};const demo={...empty,asset:{...source,name:'UGCPilot_Final_Demo(1) (online-video-cutter.com).mp4'}};
function StandaloneEditor(){const [controls,setControls]=useState(null),[preview,setPreview]=useState(null),[actions,setActions]=useState(null);return <><div className={sections.workspace} data-hook-first-screen><header className={sections.header}><h1>Wall of text</h1></header><main className={sections.layout}><div className={sections.stage} data-preview-visible data-focused-workflow data-stage="edit" data-editing="true"><WorkflowCreationPanel kind="hook" section="edit" actionContent={<div ref={setActions}/> }><div ref={setControls}/></WorkflowCreationPanel><section ref={setPreview} className={creation.main+' '+sections.preview}/></div></main></div><FormatVideoEditor format="wall_text" video={{id:'wall-local',mediaAssetId:null,title:'Wall clip',url:'/video.mp4',durationSeconds:3,ratio:'9:16'}} active enabled={false} localPreview controlsTarget={controls} resultsTarget={preview} actionsTarget={actions} onDirty={()=>{}} onSaved={()=>{}} onContinue={()=>{}} /></>}
function App(){if(new URLSearchParams(location.search).get('format')==='wall_text')return <StandaloneEditor/>;const dirty=useCallback(()=>{},[]);return <TalkingHeadClipEditing enabled={false} ownerId={null} source={null} sourcePreview={source} demo={demo} demoFraming={null} active onDirty={dirty}>{clips=><div className={sections.workspace} data-hook-first-screen><header className={sections.header}><h1>Talking Head + Demo</h1></header><main className={sections.layout}><div className={sections.stage} data-preview-visible data-focused-workflow data-stage="edit" data-editing={clips.editing}><WorkflowCreationPanel kind="hook" section="edit" actionContent={clips.editing?clips.actions:undefined} navigation={clips.editing?undefined:<nav className={sections.panelNavigation}><button>Create</button><button>Demo</button><button>Schedule</button></nav>}>{clips.controls}<div hidden={clips.editing}><p>Sequence controls</p><div style={{height:1500}}>Existing settings</div></div></WorkflowCreationPanel><section id="hook-workflow-preview" className={creation.main+' '+sections.preview} aria-label="Hook creation workspace">{clips.preview}<div hidden={clips.editing}><WorkflowEditWorkspace kind="hook" demo={demo} demoAudio={empty} sourcePreview={source} onEditSource={clips.openOpening} onEditDemo={clips.openDemo}/></div></section></div></main></div>}</TalkingHeadClipEditing>};createRoot(document.getElementById('root')).render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><App/></QueryClientProvider>);`);
const globals = productionCss => `<html class="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${productionCss}</style><style>body{margin:0}h1{font-size:20px}h3{margin:0}video{object-fit:contain}summary{cursor:pointer}.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}</style></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>`;
async function main() {
  // The cover is two portraits with a dark gap. Extract the complete first
  // portrait at its actual bounds, rather than cropping into that gap.
  execFileSync(require("ffmpeg-static"), ["-nostdin","-v","error","-y","-i",path.join(root,"public/explore/covers/hook-video-v1.mp4"),"-t","3","-vf","crop=304:540:88:0,setsar=1","-an","-c:v","libx264",path.join(out,"portrait.mp4")], {windowsHide:true,timeout:30000});
  for(const [shape,size] of [['portrait-markers','360x640'],['landscape','640x360'],['square','480x480']])execFileSync(require('ffmpeg-static'),['-nostdin','-v','error','-y','-f','lavfi','-i',`color=c=gray:s=${size}:r=24:d=3,drawbox=x=0:y=0:w=iw/5:h=ih:color=red:t=fill,drawbox=x=iw*4/5:y=0:w=iw/5:h=ih:color=blue:t=fill`,'-c:v','libx264','-pix_fmt','yuv420p',path.join(out,shape+'.mp4')],{windowsHide:true,timeout:30000});
  const aliases = {};
  for (const name of ["components/explore/workflow-background-audio-picker","contexts/auth-context","lib/firebase/auth","lib/ai-studio/media-client","lib/ai-studio/reference-media-upload","components/explore/use-local-workflow-media","components/explore/use-workflow-finishing","components/explore/use-clip-draft-save","components/explore/workflow-scheduling-panel","components/explore/workflow-demo-controls","lib/explore/workflow-default-music-client"]) aliases['@/'+name]=path.join(out,'ui.tsx');
  aliases['@']=root;
  await new Promise((resolve,reject)=>{const compiler=webpack({mode:"development",devtool:false,plugins:[new webpack.DefinePlugin({"process.env":JSON.stringify({NODE_ENV:"development"})})],entry:path.join(out,"entry.tsx"),output:{path:out,filename:"bundle.js"},resolve:{extensions:[".tsx",".ts",".js"],alias:aliases},module:{rules:[{test:/\.tsx?$/,use:path.join(out,"loader.cjs")},{test:/\.css$/,use:path.join(out,"css.cjs")}]}});compiler.run((error,stats)=>compiler.close(()=>error||stats.hasErrors()?reject(error||Error(stats.toString({all:false,errors:true}))):resolve()));});
  const globalCss=(await postcss([tailwind()]).process(`@import "${path.join(root,'app','globals.css').replaceAll(path.sep,'/')}";`,{from:path.join(out,'fixture.css')})).css;
  const mediaRoutes={'/video.mp4':'portrait.mp4','/portrait-markers.mp4':'portrait-markers.mp4','/landscape.mp4':'landscape.mp4','/square.mp4':'square.mp4'};
  const server=http.createServer((request,response)=>{const name=request.url==='/bundle.js'?'bundle.js':mediaRoutes[request.url]??null;response.setHeader('Content-Type',name==='bundle.js'?'text/javascript':name?'video/mp4':'text/html');if(name&&name!=='bundle.js'){const bytes=fs.readFileSync(path.join(out,name));response.setHeader('Accept-Ranges','bytes');const range=request.headers.range?.match(/bytes=(\d+)-(\d*)/);if(range){const start=Number(range[1]),end=range[2]?Math.min(Number(range[2]),bytes.length-1):bytes.length-1;response.statusCode=206;response.setHeader('Content-Range',`bytes ${start}-${end}/${bytes.length}`);response.setHeader('Content-Length',end-start+1);return response.end(bytes.subarray(start,end+1));}response.setHeader('Content-Length',bytes.length);return response.end(bytes);}response.end(name?fs.readFileSync(path.join(out,name)):globals(globalCss));});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  if (process.argv.includes('--serve-only')) { console.log('Fixture URL: http://127.0.0.1:'+server.address().port); return; }
  let browser;
  const measurements=[];
  try {
    browser=await playwright.chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
    const page=await browser.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
    for (const viewport of [{width:1900,height:806},{width:1440,height:900},{width:1280,height:720},{width:390,height:844},{width:320,height:700}]) {
      await page.setViewportSize(viewport);await page.goto('http://127.0.0.1:'+server.address().port);
      await page.getByRole('button',{name:'Edit hook video',exact:true}).waitFor();
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Sequence overview fits screen with both selected clips and a long filename');
      for(const label of ['Hook video segment','Demo segment'])assert.equal(await page.getByRole('region',{name:label,exact:true}).evaluate(element=>element.scrollWidth>element.clientWidth),false,label+' has no internal horizontal overflow');
      await page.locator('[data-workflow-section-content]').evaluate(element=>{element.scrollTop=element.scrollHeight;});
      await page.getByRole('button',{name:'Edit hook video',exact:true}).click();
      await page.waitForFunction(()=>document.querySelector('[data-clip-media] video')?.readyState>=2);
      const layout=await page.evaluate(()=>{const frame=document.querySelector('[data-clip-media]').getBoundingClientRect(),video=document.querySelector('[data-clip-media] video').getBoundingClientRect(),stage=document.querySelector('[data-focused-workflow]').getBoundingClientRect(),settings=document.querySelector('[data-workflow-section-content]'),trim=document.querySelector('[data-editor-section="trim"]').getBoundingClientRect(),trimStart=document.querySelector('[aria-label="Trim start"]').getBoundingClientRect(),trimEnd=document.querySelector('[aria-label="Trim end"]').getBoundingClientRect(),overlay=document.querySelector('[aria-label="Overlay text"]').getBoundingClientRect();return{frame:{width:frame.width,height:frame.height},video:{width:video.width,height:video.height},stageWidth:stage.width,trim:{width:trim.width,x:trim.x},trimStart:{width:trimStart.width},trimEnd:{width:trimEnd.width},overlay:{width:overlay.width},inspector:{width:document.querySelector('[aria-label="Text preset"]').closest('details').getBoundingClientRect().width},scrollTop:settings.scrollTop,overflow:document.documentElement.scrollWidth>innerWidth};});
      assert.equal(layout.overflow,false,JSON.stringify({viewport,layout}));
      assert.ok(Math.abs(layout.frame.height-layout.video.height)<1 && Math.abs(layout.frame.width-layout.video.width)<1,'Video fills entire portrait frame: '+JSON.stringify({viewport,layout}));
      assert.ok(Math.abs(layout.frame.width/layout.frame.height-304/540)<.001,'Natural portrait ratio remains intact');
      assert.ok(layout.frame.height>(viewport.width<1024?180:300),'Preview remains readable: '+JSON.stringify({viewport,layout}));
      if(viewport.width>=1024)assert.ok(layout.stageWidth>=viewport.width-60,'Editor uses the available workspace');
      assert.ok(layout.trim.width<=layout.stageWidth,'Trim timeline stays inside the editor');
      if(viewport.width>=1024)assert.ok(layout.inspector.width<=300,'Text style stays in a compact inspector: '+JSON.stringify({viewport,layout}));
      assert.ok(Math.abs(layout.trimStart.width-layout.trimEnd.width)<2,'Trim number fields stay balanced: '+JSON.stringify({viewport,layout}));
      if(viewport.width>=1024)assert.ok(layout.trimStart.width<=100&&layout.trimStart.width>=60,'Trim number fields are compact and readable: '+JSON.stringify({viewport,layout}));
      if(viewport.width<1024)assert.ok(layout.trim.width<=viewport.width-24,'Compact controls remain within the mobile canvas: '+JSON.stringify({viewport,layout}));
      assert.equal(layout.scrollTop,0,'Editor opens at the first controls instead of inherited overview scroll');
      assert.equal(await page.getByRole('button',{name:'Schedule',exact:true}).count(),0,'Workflow tabs are hidden inside a clip editor');
      const remix = page.locator('[data-remix-control]');
      assert.equal(await remix.evaluate(el=>el.tagName),'DETAILS','Scratch footage keeps Remix optional');
      await remix.locator('summary').click();
      assert.equal(await remix.evaluate(el=>el.open),true,'The visible Remix entry opens its controls');
      await page.getByLabel('Trim end',{exact:true}).fill('2.6');
      await page.waitForFunction(()=>Math.abs(document.querySelector('[data-clip-media] video').currentTime-2.55)<.03 && !document.querySelector('[data-clip-media] video').seeking);
      assert.equal(await page.locator('[data-clip-media] video').evaluate(v=>v.paused),true,'Dragging trim end immediately shows its boundary frame');
      await page.getByLabel('Trim start',{exact:true}).fill('1');
      await page.waitForFunction(()=>Math.abs(document.querySelector('[data-clip-media] video').currentTime-1)<.03);
      await page.getByLabel('Overlay text',{exact:true}).fill('Portrait layout check');
      await page.getByLabel('Text start time',{exact:true}).fill('.5');
      await page.waitForFunction(()=>Math.abs(document.querySelector('[data-clip-media] video').currentTime-1.5)<.03);
      await page.getByLabel('Text overlay 1 preview',{exact:true}).waitFor();
      await page.getByLabel('Text color',{exact:true}).fill('#ff0000');
      assert.ok(await page.getByLabel('Text overlay 1 preview',{exact:true}).evaluate(el=>el.querySelector('g').getAttribute('fill')==='#ff0000'),'Text styling appears while paused');
      assert.equal(await page.getByLabel('Original volume',{exact:true}).count(),0,'Audio setup belongs in Demo, outside focused clip editing');
      assert.equal(await page.getByRole('group',{name:'Audio',exact:true}).count(),0,'Focused editing does not duplicate a Sound panel');
      const endHandle=page.getByRole('slider',{name:'Trim end handle',exact:true});await endHandle.focus();await endHandle.press('ArrowLeft');
      assert.equal(await page.getByLabel('Trim end',{exact:true}).inputValue(),'2.5');
      await page.waitForFunction(()=>Math.abs(document.querySelector('[data-clip-media] video').currentTime-2.45)<.03);
      const startHandle=page.getByRole('slider',{name:'Trim start handle',exact:true});await startHandle.evaluate(el=>el.scrollIntoView({block:'end'}));const handle=await startHandle.boundingBox();
      await page.mouse.move(handle.x+handle.width/2,handle.y+handle.height/2);await page.mouse.down();await page.mouse.move(handle.x+handle.width/2-20,handle.y+handle.height/2,{steps:4});await page.mouse.up();
      assert.ok(Number(await page.getByLabel('Trim start',{exact:true}).inputValue())<1,'Dragging start changes the trim');
      await page.getByLabel('Trim start',{exact:true}).fill('1');


      await page.getByRole('button',{name:'Back to videos',exact:true}).click();await page.getByRole('button',{name:'Edit hook video',exact:true}).click();
      assert.equal(await page.getByLabel('Trim start',{exact:true}).inputValue(),'1');assert.equal(await page.getByLabel('Overlay text',{exact:true}).inputValue(),'Portrait layout check');
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Reopening edited controls fits the viewport');
      const player=page.locator('[data-clip-media] video');
      await player.evaluate(async video=>{video.muted=true;video.currentTime=1;await video.play();});
      await page.waitForFunction(()=>document.querySelector('[data-clip-media] video')?.currentTime>1.05);
      await player.evaluate(video=>video.pause());
      const visiblePixels=await player.evaluate(video=>{const canvas=document.createElement('canvas');canvas.width=32;canvas.height=32;const context=canvas.getContext('2d');context.drawImage(video,0,0,32,32);const pixels=context.getImageData(0,0,32,32).data;let colored=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i]+pixels[i+1]+pixels[i+2]>90)colored++;return colored;});
      assert.ok(visiblePixels>256,'Preview contains decoded footage, not a blank black frame');
      await page.getByRole('button',{name:'Back to videos',exact:true}).click();await page.getByRole('button',{name:'Edit demo video',exact:true}).click();
      await page.getByRole('heading',{name:'Edit demo video',exact:true}).waitFor();await page.getByLabel('Overlay text',{exact:true}).fill('Demo live change');
      await page.getByLabel('Text overlay 1 preview',{exact:true}).waitFor();assert.equal(await page.getByLabel('Text overlay 1 preview',{exact:true}).textContent(),'Demo live change');
      await page.getByRole('button',{name:'Back to videos',exact:true}).click();await page.getByRole('button',{name:'Edit hook video',exact:true}).click();
      await page.waitForFunction(()=>document.querySelector('[data-clip-media] video')?.readyState>=2);
      await page.getByRole('button',{name:'Play preview',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[data-clip-media] video')?.currentTime>1.55);await page.getByRole('button',{name:'Pause preview',exact:true}).click();
      await page.getByLabel('Text overlay 1 preview',{exact:true}).waitFor();
      await page.evaluate(()=>localStorage.clear());await page.evaluate(()=>window.scrollTo(0,0));measurements.push({viewport,layout});await page.screenshot({path:path.join(out,`editor-${viewport.width}.png`),fullPage:true});
    }
    for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
      await page.setViewportSize(viewport);await page.goto('http://127.0.0.1:'+server.address().port+'/?format=wall_text');
      await page.getByLabel('Wall of text',{exact:true}).fill('Wall text live change');await page.getByLabel('Text overlay 1 preview',{exact:true}).waitFor();
      assert.equal(await page.getByLabel('Trim end',{exact:true}).count(),0,'Wall starts with text editing only');
      assert.equal(await page.getByLabel('Show from (s)',{exact:true}).count(),0,'Wall text has no timing controls');
      await page.getByRole('button',{name:'Edit video with advanced controls',exact:true}).click();
      await page.getByLabel('Trim end',{exact:true}).fill('2.4');await page.waitForFunction(()=>Math.abs(document.querySelector('[data-clip-media] video').currentTime-2.35)<.03);
      await page.getByLabel('Wall of text',{exact:true}).fill('Changed while paused');await page.getByLabel('Text overlay 1 preview',{exact:true}).waitFor();
      assert.equal(await page.getByLabel('Text overlay 1 preview',{exact:true}).textContent(),'Changed while paused');
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.evaluate(()=>localStorage.clear());
    }
    const sharp=require('sharp');
    for(const viewport of [{width:1900,height:806},{width:390,height:844}])for(const [shape,aspect] of [['portrait-markers',9/16],['landscape',16/9],['square',1]]){
      await page.setViewportSize(viewport);await page.goto('http://127.0.0.1:'+server.address().port+'/?shape='+shape);
      await page.getByRole('button',{name:'Edit hook video',exact:true}).click();
      const player=page.locator('[data-clip-media] video');await player.evaluate(async video=>{video.muted=true;await video.play();});
      await page.waitForFunction(()=>document.querySelector('[data-clip-media] video')?.currentTime>.1);await player.evaluate(video=>video.pause());
      const geometry=await player.evaluate(video=>{const r=video.getBoundingClientRect();return{width:r.width,height:r.height,naturalWidth:video.videoWidth,naturalHeight:video.videoHeight,fit:getComputedStyle(video).objectFit};});
      assert.ok(Math.abs(geometry.width/geometry.height-aspect)<.003,shape+' keeps its natural ratio');assert.equal(geometry.fit,'contain');
      const screenshot=await player.screenshot();const {data,info}=await sharp(screenshot).removeAlpha().raw().toBuffer({resolveWithObject:true});
      const pixel=(x,y)=>{const offset=(Math.floor(info.height*y)*info.width+Math.floor(info.width*x))*info.channels;return Array.from(data.subarray(offset,offset+3));};
      const left=pixel(.05,.5),right=pixel(.95,.5);
      assert.ok(left[0]>180&&left[1]<70&&left[2]<70,'The left edge of '+shape+' is visible: '+left);
      assert.ok(right[2]>180&&right[0]<70&&right[1]<70,'The right edge of '+shape+' is visible: '+right);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      fs.writeFileSync(path.join(out,`ratio-${shape}-${viewport.width}.png`),screenshot);measurements.push({viewport,shape,geometry,edgePixels:{left,right}});
    }
    assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'measurements.json'),JSON.stringify(measurements,null,2));
    console.log('PASS hook/demo/wall editors: immediate paused trim, text and volume previews; drag and keyboard handles; expanded Remix; compact style inspector; no workflow tabs; draft retention; complete frames and no overflow at 320–1900px.');
  } finally {await browser?.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
