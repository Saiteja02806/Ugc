/* eslint-disable @typescript-eslint/no-require-imports -- Isolated real-component layout verification. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { webpack } = require("next/dist/compiled/webpack/webpack");
let playwright;
try { playwright = require("playwright"); }
catch { playwright = require(path.join(process.env.USERPROFILE, ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright")); }
const root = path.resolve(__dirname, ".."), out = path.join(root, ".tmp/explore-safe-implementation-20261014/preview-browser");
const evidence = path.join(root, "outputs/explore-safe-implementation-2026-10-14");
fs.mkdirSync(out, { recursive: true }); fs.mkdirSync(evidence, { recursive: true });
const file = (name, content) => fs.writeFileSync(path.join(out, name), content);
file("loader.cjs", `const ts=require(${JSON.stringify(require.resolve("typescript"))});module.exports=source=>ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText;`);
file("css.cjs", `module.exports=function(source){const prefix=this.resourcePath.replace(/[^a-zA-Z]/g,'')+'_';const names=Object.fromEntries([...source.matchAll(/\\.([a-zA-Z][a-zA-Z0-9_-]*)/g)].map(m=>[m[1],prefix+m[1]]));const css=source.replaceAll(/:global\\(([^)]+)\\)/g,'$1').replaceAll(/\\.([a-zA-Z][a-zA-Z0-9_-]*)/g,(_,name)=>'.'+names[name]);return 'const style=document.createElement("style");style.textContent='+JSON.stringify(css)+';document.head.append(style);export default '+JSON.stringify(names)+';';};`);
file("ui.tsx", `export const Button=({variant,size,...props})=><button {...props} style={{...(size==='icon-sm'?{padding:6,minHeight:32,width:32,height:32}:{}),...props.style}}/>; export const SCHEDULE_PLATFORMS=[]; export const WorkflowDemoPreview=()=>null; export const getCurrentUserIdToken=async()=>{throw Error('No live authentication in layout fixture');}; export const loadWorkflowDefaultMusic=async()=>{throw Error('No live music in layout fixture');};`);
file("entry.tsx", `import {createRoot} from 'react-dom/client';import {useState} from 'react';import {WorkflowEditWorkspace,WorkflowScheduleWorkspace} from '@/components/explore/workflow-edit-workspace';import {TalkingHeadScheduleActions} from '@/components/explore/talking-head-schedule-review';
const source={id:'00000000-0000-4000-8000-000000000001',title:'Portrait talking head',url:'/video.mp4',durationSeconds:3,width:304,height:540,metadata:{}};
const croppedDemo={segment:{id:'00000000-0000-4000-8000-000000000003',label:'Demo',url:'/demo.mp4',durationSeconds:3,width:1280,height:720,editing:{version:1,format:'hook',trimStartMs:500,trimEndMs:2500,originalVolume:1,musicVolume:.2,text:null}}};
const frame={version:1,width:(304/540)/(1280/720),height:1,points:[[0,0,0],[3000,.6,0]]};
const empty={asset:null,loading:false,error:null,remove:()=>{},choose:()=>{}};function App(){const [demo,setDemo]=useState(false),[stage,setStage]=useState('edit'),[crop,setCrop]=useState(false);return <main><h1>Talking Head + Demo</h1><nav><button onClick={()=>setStage('edit')}>Edit</button><button onClick={()=>setStage('schedule')}>Schedule</button><button onClick={()=>setDemo(v=>!v)}>Toggle demo</button><button onClick={()=>{setDemo(true);setCrop(true);setStage('edit');}}>Cropped landscape demo</button></nav>{stage==='edit'?<WorkflowEditWorkspace kind="hook" demo={{...empty,choose:()=>setDemo(true),remove:()=>setDemo(false),asset:demo?{name:'Optional demo',url:crop?'/demo.mp4':'/video.mp4',duration:3}:null}} demoAudio={empty} generatedVideo={source} demoSegmentPreview={crop?croppedDemo:null} demoFraming={crop?frame:null} rawComposition onEditSource={()=>{}} onEditDemo={demo?()=>{}:undefined}/>:<><WorkflowScheduleWorkspace draft={{platform:'instagram'}} source={source} demoSource={demo?{...source,id:'00000000-0000-4000-8000-000000000002'}:null} options={{subtitles:false,backgroundMusic:false,style:'clean'}}/><TalkingHeadScheduleActions enabled action={{disabled:true,busy:false,message:'Wait for the file'}} preparation={{disabled:true,busy:false,processing:true,message:'Loading your finished video…'}} onBackToEdit={()=>setStage('edit')}/></>}</main>};createRoot(document.getElementById('root')).render(<App/>);`);
async function main() {
  execFileSync(require("ffmpeg-static"), ["-nostdin","-v","error","-y","-i",path.join(root,"public/explore/covers/hook-video-v1.mp4"),"-t","3","-vf","crop=304:540:88:0,setsar=1","-an","-c:v","libx264",path.join(out,"portrait.mp4")], { windowsHide:true, timeout:30000 });
  execFileSync(require("ffmpeg-static"), ["-nostdin","-v","error","-y","-i",path.join(root,"public/explore/covers/hook-video-v1.mp4"),"-t","3","-vf","scale=1280:720","-an","-c:v","libx264",path.join(out,"landscape.mp4")], { windowsHide:true, timeout:30000 });
  await new Promise((resolve,reject)=>{const compiler=webpack({mode:"development",devtool:false,plugins:[new webpack.DefinePlugin({"process.env":JSON.stringify({NODE_ENV:"development"})})],entry:path.join(out,"entry.tsx"),output:{path:out,filename:"bundle.js"},
    resolve:{extensions:[".tsx",".ts",".js"],alias:{"@/components/ui/button":path.join(out,"ui.tsx"),"@/components/explore/workflow-scheduling-panel":path.join(out,"ui.tsx"),"@/components/explore/workflow-demo-controls":path.join(out,"ui.tsx"),"@/lib/firebase/auth":path.join(out,"ui.tsx"),"@/lib/explore/workflow-default-music-client":path.join(out,"ui.tsx"),"@":root}},
    module:{rules:[{test:/\.tsx?$/,use:path.join(out,"loader.cjs")},{test:/\.css$/,use:path.join(out,"css.cjs")}]}});compiler.run((error,stats)=>compiler.close(()=>error||stats.hasErrors()?reject(error||Error(stats.toString({all:false,errors:true}))):resolve()));});
  const server=http.createServer((req,res)=>{
    if(req.url==='/bundle.js'){res.setHeader('Content-Type','application/javascript');return res.end(fs.readFileSync(path.join(out,'bundle.js')));}
    if(req.url==='/video.mp4'){res.setHeader('Content-Type','video/mp4');return res.end(fs.readFileSync(path.join(out,'portrait.mp4')));}
    if(req.url==='/demo.mp4'){res.setHeader('Content-Type','video/mp4');return res.end(fs.readFileSync(path.join(out,'landscape.mp4')));}
    res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<meta charset="utf-8"><style>:root{--border:#ccc;--card:#fff;--card-muted:#f4f5f7;--muted:#555;--foreground:#16171a}*{box-sizing:border-box}body{margin:0;font:15px system-ui;background:#f7f8fa}main{max-width:1100px;margin:24px auto;background:white;border-radius:16px;padding:24px}button{min-height:40px;padding:8px 16px;border:1px solid #ddd;border-radius:8px;background:#fff;cursor:pointer}nav{display:flex;gap:8px}video{object-fit:contain}.size-full{width:100%;height:100%}.object-fill{object-fit:fill}.min-w-0{min-width:0}.flex-1{flex:1}.whitespace-nowrap{white-space:nowrap}.rounded-2xl{border-radius:16px}.bg-black{background:#000}.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}h1{margin-top:0}@media(max-width:600px){main{margin:0;padding:12px}}</style><div id="root"></div><script src="/bundle.js"></script>');});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
  const browser=await playwright.chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
  const measurements=[];
  try {
    const page=await browser.newPage();const errors=[];page.on('pageerror',error=>{errors.push(error.message);console.error('Browser fixture error:',error.message);});
    for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
      await page.setViewportSize(viewport);await page.goto(base);await page.getByLabel('Hook video segment preview',{exact:true}).waitFor({timeout:10000});
      await page.waitForFunction(()=>document.querySelector('video')?.readyState>=1);
      assert.equal(await page.getByRole('region',{name:'Demo segment',exact:true}).count(),1,'Optional demo slot is always visible'); assert.equal(await page.getByRole('button',{name:'Edit hook video',exact:true}).count(),1); assert.equal(await page.getByRole('button',{name:'Edit demo video',exact:true}).count(),0,'No edit action without a demo');
      const layout=await page.evaluate(()=>{const player=document.querySelector('video'),r=player.getBoundingClientRect();return{width:r.width,height:r.height,viewport:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth};});
      assert.equal(layout.overflow,false);assert.ok(layout.height>320,'Portrait single preview uses more than former 320px limit');
      assert.ok(layout.width>180,'Portrait preview is larger than former 180px bound');measurements.push({viewport,layout});
      await page.screenshot({path:path.join(evidence,viewport.width===390?'preview-single-mobile.png':'preview-single-desktop.png'),fullPage:true});
      const chooser=page.waitForEvent('filechooser');await page.getByRole('button',{name:'Upload demo video',exact:true}).click();await (await chooser).setFiles(path.join(out,'portrait.mp4'));await page.getByLabel('Video sequence demo preview',{exact:true}).waitFor();
      assert.equal(await page.locator('[data-demo-selected="true"]').count(),1);assert.equal(await page.getByRole('button',{name:'Edit demo video',exact:true}).count(),1);assert.ok(await page.locator('video').count()===2);
      await page.getByRole('button',{name:'Schedule',exact:true}).click();
      const preparing=page.locator('button[aria-busy="true"]');await preparing.waitFor({timeout:10000});assert.match(await preparing.innerText(),/Preparing video/);assert.equal(await preparing.getAttribute('aria-busy'),'true');
      assert.equal(await preparing.isDisabled(),true);assert.match(await page.locator('body').innerText(),/Editing preview/);
      await page.waitForFunction(()=>[...document.querySelectorAll('video')].every(v=>v.readyState>=2));
      const frameSize=await page.locator('[data-sequence-player]').boundingBox();
      assert.ok(frameSize.height>150 && frameSize.width>80,JSON.stringify({viewport,frameSize}));
      await page.locator('[data-sequence-preview] video').first().evaluate(v=>{v.currentTime=.5;});
      await page.waitForFunction(()=>!document.querySelector('[data-sequence-preview] video').seeking);
      assert.equal(await page.getByRole('alert').count(),0);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Schedule preview remains inside mobile width');
      await page.screenshot({path:path.join(evidence,viewport.width===390?'preview-sequence-mobile.png':'preview-sequence-desktop.png'),fullPage:true});
      await page.getByRole('button',{name:'Cropped landscape demo',exact:true}).click();
      await page.waitForFunction(()=>document.querySelector('[aria-label="Demo segment"] video')?.readyState>=2);
      assert.equal(await page.getByRole('alert').count(),0,'Landscape demo framing is validated against the portrait opening dimensions');
      const cropSize=await page.locator('[aria-label="Demo segment"] [data-sequence-player]').boundingBox();
      assert.ok(cropSize.height>150 && Math.abs(cropSize.width/cropSize.height-304/540)<.02);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Cropped edit preview remains inside mobile width');
      measurements.push({viewport,cropSize,frameSize});
    }
    assert.deepEqual(errors,[]);fs.writeFileSync(path.join(evidence,'preview-browser-measurements.json'),JSON.stringify(measurements,null,2));
    console.log('PASS real Edit/Schedule components: large single preview, optional two-clip sequence, no horizontal overflow, truthful pending preparation on desktop/mobile.');
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
