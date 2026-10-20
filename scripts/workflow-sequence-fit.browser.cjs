/* eslint-disable @typescript-eslint/no-require-imports -- Isolated real-player regression check. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { webpack } = require("next/dist/compiled/webpack/webpack");
let playwright;
try { playwright = require("playwright"); }
catch { playwright = require(path.join(process.env.USERPROFILE, ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright")); }
const root = path.resolve(__dirname, ".."), out = path.join(root, ".tmp/workflow-sequence-fit");
fs.mkdirSync(out, { recursive: true });
const file = (name, value) => fs.writeFileSync(path.join(out, name), value);
file("loader.cjs", `const ts=require(${JSON.stringify(require.resolve("typescript"))});module.exports=source=>ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText;`);
file("css.cjs", `module.exports=function(source){const prefix=this.resourcePath.replace(/[^a-zA-Z]/g,'')+'_';const names=Object.fromEntries([...source.matchAll(/\\.([a-zA-Z][a-zA-Z0-9_-]*)/g)].map(m=>[m[1],prefix+m[1]]));const css=source.replaceAll(/:global\\(([^)]+)\\)/g,'$1').replaceAll(/\\.([a-zA-Z][a-zA-Z0-9_-]*)/g,(_,name)=>'.'+names[name]);return 'const style=document.createElement("style");style.textContent='+JSON.stringify(css)+';document.head.append(style);export default '+JSON.stringify(names)+';';};`);
file("ui.tsx", `export const Button=({variant,size,...props})=><button {...props}/>;export const WorkflowCaptionOverlay=()=>null;export const FormatVideoTextOverlay=()=>null;`);
file("entry.tsx", `import {createRoot} from 'react-dom/client';import {WorkflowSequencePreview} from '@/components/explore/workflow-sequence-preview';import sections from '@/components/explore/workflow-section-layout.module.css';const segments=[{id:'opening',label:'Talking head',url:'/video.mp4',width:304,height:540,durationSeconds:3}];createRoot(document.getElementById('root')).render(<main><h1>Complete video frame</h1><div className={sections.stage} data-focused-workflow data-stage="edit" data-editing="false"><div className={sections.preview}><WorkflowSequencePreview segments={segments} showDescription={false} className="test-sequence"/></div></div></main>);`);

async function main() {
  execFileSync(require("ffmpeg-static"), ["-nostdin", "-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=size=304x540:rate=10", "-t", "3", "-an", "-c:v", "libx264", path.join(out, "portrait.mp4")], { windowsHide: true, timeout: 30000 });
  await new Promise((resolve, reject) => {
    const compiler = webpack({ mode: "development", devtool: false, entry: path.join(out,"entry.tsx"), output: {path:out,filename:"bundle.js"},
      resolve: { extensions:[".tsx",".ts",".js"], alias:{"@/components/ui/button":path.join(out,"ui.tsx"),"@/components/explore/format-video-text-overlay":path.join(out,"ui.tsx"),"./workflow-caption-overlay":path.join(out,"ui.tsx"),"@":root}},
      module:{rules:[{test:/\.tsx?$/,use:path.join(out,"loader.cjs")},{test:/\.css$/,use:path.join(out,"css.cjs")}]}});
    compiler.run((error, stats) => compiler.close(() => error || stats.hasErrors() ? reject(error || Error(stats.toString({all:false,errors:true}))) : resolve()));
  });
  const server=http.createServer((req,res)=>{
    if(req.url==='/bundle.js'){res.setHeader('Content-Type','application/javascript');return res.end(fs.readFileSync(path.join(out,'bundle.js')));}
    if(req.url==='/video.mp4'){res.setHeader('Content-Type','video/mp4');return res.end(fs.readFileSync(path.join(out,'portrait.mp4')));}
    res.setHeader('Content-Type','text/html');res.end('<meta name="viewport" content="width=device-width,initial-scale=1"><style>:root{--border:#444;--background:#202020;--card:#292929}*{box-sizing:border-box}body{margin:0;background:#202020;color:#fff;font:16px system-ui}main{padding:20px}h1{font-size:18px}.test-sequence{height:600px!important}.size-full{width:100%;height:100%}button{padding:8px;background:#333;color:white;border:1px solid #666}svg{width:18px;height:18px}input{flex:1;min-width:0}</style><div id="root"></div><script src="/bundle.js"></script>');
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let browser;
  try {
    browser=await playwright.chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
    const page=await browser.newPage(), measurements=[];
    for(const viewport of [{width:1440,height:900},{width:1024,height:768},{width:390,height:844}]) {
      await page.setViewportSize(viewport);await page.goto('http://127.0.0.1:'+server.address().port);
      await page.waitForFunction(()=>document.querySelector('video')?.readyState>=2);
      const fit=await page.locator('video').evaluate(video=>{const media=video.getBoundingClientRect(),layer=video.parentElement.getBoundingClientRect(),frame=video.closest('[data-sequence-player]').getBoundingClientRect();return {media:{width:media.width,height:media.height,top:media.top,left:media.left},layer:{width:layer.width,height:layer.height,top:layer.top,left:layer.left},frame:{width:frame.width,height:frame.height},overflow:document.documentElement.scrollWidth>innerWidth};});
      for(const key of ['width','height','top','left']) assert.ok(Math.abs(fit.media[key]-fit.layer[key])<1,JSON.stringify({viewport,fit,key}));
      assert.ok(Math.abs(fit.frame.width/fit.frame.height-304/540)<.01);assert.equal(fit.overflow,false);
      if(viewport.width===1440) assert.ok(fit.media.height>360,'Exercise the former maximum-height cap');
      measurements.push({viewport,fit});await page.screenshot({path:path.join(out,`complete-frame-${viewport.width}.png`),fullPage:true});
    }
    file('measurements.json',JSON.stringify(measurements,null,2));console.log('PASS complete portrait frame fills its projected layer under the real workflow video caps at desktop, laptop and mobile sizes.');
  } finally {await browser?.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
