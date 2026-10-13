/* eslint-disable @typescript-eslint/no-require-imports -- Isolated browser fixture. */
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), http = require("node:http");
const { execFileSync } = require("node:child_process");
const { webpack } = require("next/dist/compiled/webpack/webpack");
let playwright;
try { playwright = require("playwright"); }
catch { playwright = require(path.join(process.env.USERPROFILE, ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright")); }
const root = path.resolve(__dirname, ".."), out = path.join(root, ".tmp/caption-review-browser");
fs.mkdirSync(out, { recursive: true });
const file = (name, value) => fs.writeFileSync(path.join(out, name), value);
file("loader.cjs", `const ts=require(${JSON.stringify(require.resolve("typescript"))});module.exports=source=>ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText;`);
file("css.cjs", "module.exports=()=> 'export default new Proxy({}, {get: (_, name) => name});';");
file("auth.ts", "export const getCurrentUserIdToken=async()=> 'caption-fixture';");
file("assets.ts", "export const fetchAIStudioMediaAsset=async id=>({id, status:'ready',collection:'video',title:'Prepared final',url:'/video.mp4',durationSeconds:4,width:256,height:384});");
file("entry.tsx", `import {useState} from 'react';import {createRoot} from 'react-dom/client';
import {WorkflowFinishingBoundary} from '@/components/explore/workflow-finishing-boundary';
import {WorkflowCaptionEditor} from '@/components/explore/workflow-caption-editor';
import {WorkflowSequencePreview} from '@/components/explore/workflow-sequence-preview';
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const source={id:id(1),status:'ready',collection:'video',title:'Talking head',url:'/video.mp4',durationSeconds:2,width:256,height:384};
function App(){const [changed,setChanged]=useState(false);const demo={...source,id:id(changed?3:2),title:'Demo'};
return <WorkflowFinishingBoundary enabled ownerId='fixture-owner' kind='hook' source={source} demo={null} demoSource={demo} demoAudio={null} playback='once' scheduleDraft={{}} fastStatus>{finish=><>
<h1>Talking Head + Demo caption review</h1><button onClick={()=>finish.setOptions({...finish.options,subtitles:true})}>Enable captions</button>
<button onClick={()=>finish.setOptions({...finish.options,style:'karaoke',placement:'top'})}>Karaoke at top</button><button onClick={()=>setChanged(true)}>Replace demo</button>
{finish.options.subtitles?<WorkflowCaptionEditor captions={finish.captions}/>:null}
<button disabled={finish.edit.disabled} onClick={finish.edit.onAction}>Prepare final video</button><p role='status'>{finish.edit.message}</p>
<WorkflowSequencePreview segments={[{id:source.id,label:'Talking head',url:source.url,durationSeconds:2,width:256,height:384},{id:demo.id,label:'Demo',url:demo.url,durationSeconds:2,width:256,height:384}]} outputWidth={256} outputHeight={384}
captions={finish.options.subtitles&&finish.captions.transcript?{transcript:finish.captions.transcript,corrections:finish.options.corrections,style:finish.options.style,placement:finish.options.placement??'bottom'}:null}/>
{finish.output?<p data-final-ready>Final video is ready</p>:null}</>}</WorkflowFinishingBoundary>}
createRoot(document.getElementById('root')).render(<App/>);`);

async function main() {
  const ffmpeg = require("ffmpeg-static");
  if (!fs.existsSync(path.join(out, "video.mp4"))) execFileSync(ffmpeg, ["-v", "error", "-n", "-f", "lavfi", "-i", "color=c=blue:s=256x384:r=30:d=2", "-f", "lavfi", "-i", "sine=frequency=440:duration=2", "-c:v", "libx264", "-c:a", "aac", path.join(out, "video.mp4")], { windowsHide: true });
  await new Promise((resolve, reject) => {
    const compiler = webpack({ mode: "development", devtool: false, context: root, entry: path.join(out, "entry.tsx"), output: { path: out, filename: "bundle.js" },
      resolve: { extensions: [".tsx", ".ts", ".js"], extensionAlias: { ".js": [".ts", ".js"] }, alias: { "@/lib/firebase/auth": path.join(out, "auth.ts"), "@/lib/ai-studio/media-client": path.join(out, "assets.ts"), "@": root } },
      module: { rules: [{ test: /\.tsx?$/, use: path.join(out, "loader.cjs") }, { test: /\.css$/, use: path.join(out, "css.cjs") }] } });
    compiler.run((error, stats) => compiler.close(() => error || stats.hasErrors() ? reject(error || new Error(stats.toString({ all: false, errors: true }))) : resolve()));
  });
  const requests = new Map(), posts = [], errors = [];
  const id = n => `00000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
  const transcript = { schemaVersion:1,provider:"elevenlabs",model:"scribe_v2",language:"en",durationMs:4000,words:[{text:"personally",startMs:100,endMs:1800},{text:"outreach",startMs:2100,endMs:3800}] };
  const css = (await require("postcss")([require("@tailwindcss/postcss")({ base: root })])
    .process(fs.readFileSync(path.join(root, "app/globals.css"), "utf8"), { from: path.join(root, "app/globals.css") })).css;
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://fixture");
    if (url.pathname === "/") { res.setHeader("Content-Type", "text/html"); return res.end('<html class="dark"><head><link rel="stylesheet" href="/style.css"/><style>body{margin:24px;background:#111;color:white;font-family:Arial}.preview{height:520px;width:360px}.stage{height:430px}.frame{position:relative;width:286px;height:430px;overflow:hidden}.controls{display:flex}button{margin:8px}</style></head><body><div id="root"></div><script>window.process={env:{}}</script><script src="/bundle.js"></script></body></html>'); }
    if (url.pathname === "/bundle.js") { res.setHeader("Content-Type", "text/javascript"); return res.end(fs.readFileSync(path.join(out,"bundle.js"))); }
    if (url.pathname === "/style.css") { res.setHeader("Content-Type", "text/css"); return res.end(css); }
    if (url.pathname === "/video.mp4") {
      const media=fs.readFileSync(path.join(out,"video.mp4"));
      res.setHeader("Content-Type", "video/mp4"); res.setHeader("Accept-Ranges", "bytes");
      const range=/^bytes=(\d+)-(\d*)$/.exec(req.headers.range ?? "");
      if (range) {
        const start=Number(range[1]), end=range[2] ? Math.min(Number(range[2]),media.length-1) : media.length-1;
        if (start>end || start>=media.length) { res.statusCode=416; res.setHeader("Content-Range",`bytes */${media.length}`); return res.end(); }
        res.statusCode=206; res.setHeader("Content-Range",`bytes ${start}-${end}/${media.length}`); res.setHeader("Content-Length",end-start+1);
        return res.end(media.subarray(start,end+1));
      }
      res.setHeader("Content-Length",media.length); return res.end(media);
    }
    if (url.pathname === "/api/explore/finishes") {
      assert.equal(req.headers.authorization, "Bearer caption-fixture");
      let key = url.searchParams.get("requestKey"), draft;
      if (req.method === "POST") { let body=""; for await (const chunk of req) body+=chunk; ({ requestKey:key,draft } = JSON.parse(body)); posts.push(draft); requests.set(key,draft); if (process.argv.includes("--serve")) console.log(JSON.stringify({ post: posts.length, draft })); }
      else draft = requests.get(key);
      assert.ok(draft, "Only a known fixture request can recover");
      res.setHeader("Content-Type","application/json");
      return res.end(JSON.stringify({ok:true,receiptVersion:1,requestKey:key,jobId:id(20),outcome:draft.captionPreview?"captions_ready":"completed",mediaAssetId:draft.captionPreview?null:id(30),captionTranscript:transcript,message:draft.captionPreview?"Captions ready":"Video ready"}));
    }
    res.statusCode=404; res.end();
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  // Allows manual checks through an already connected app browser, without
  // spawning an external browser process from the terminal.
  if (process.argv.includes("--serve")) { console.log(`Caption fixture: http://127.0.0.1:${server.address().port}/`); return; }
  let browser, page;
  try {
    browser = await playwright.chromium.launch({headless:true,...(process.platform==="win32"?{channel:"msedge"}:{})});
    page = await browser.newPage({ viewport:{width:1100,height:1000} });
    page.on("pageerror", error=>errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.getByRole("button",{name:"Enable captions"}).click();
    await page.getByRole("button",{name:"Generate captions",exact:true}).click();
    await page.getByRole("textbox",{name:"Caption word 1",exact:true}).waitFor();
    assert.equal(posts.length,1); assert.equal(posts[0].captionPreview,true);
    const slider=page.getByRole("slider",{name:"Combined preview position"});
    await page.waitForFunction(() => [...document.querySelectorAll("video")].every(video => video.readyState >= 1));
    await slider.focus(); await slider.press("Home");
    for (let i=0;i<20;i++) {
      await slider.press("ArrowRight");
      await page.waitForFunction(expected => document.querySelector('input[aria-label="Combined preview position"]')?.value === String(expected), (i+1)*50);
    }
    assert.equal(await slider.inputValue(), "1000");
    await page.locator("[data-caption-preview]").waitFor();
    assert.match(await page.locator("[data-caption-preview]").textContent(),/personally/);
    await page.getByRole("textbox",{name:"Caption word 1",exact:true}).fill("personalized");
    await page.getByRole("button",{name:"Karaoke at top"}).click();
    await page.waitForFunction(()=>document.querySelector('[data-caption-preview]')?.getAttribute('data-style')==='karaoke');
    assert.match(await page.locator("[data-caption-preview]").textContent(),/personalized/);
    await slider.focus(); await slider.press("End"); for (let i=0;i<30;i++) await slider.press("ArrowLeft");
    assert.equal(await slider.inputValue(), "2500");
    await page.waitForFunction(()=>document.querySelector('[data-caption-preview]')?.textContent.includes('outreach'));
    await page.screenshot({path:path.join(out,"caption-preview.png")});
    await page.getByRole("button",{name:"Prepare final video",exact:true}).click();
    await page.locator("[data-final-ready]").waitFor();
    assert.equal(posts.length,2); assert.equal(posts[1].captionPreview,undefined);
    assert.deepEqual(posts[1].subtitles.corrections,[{index:0,text:"personalized"}]);
    assert.equal(posts[1].subtitles.style,"karaoke"); assert.equal(posts[1].subtitles.placement,"top");
    await page.reload(); await page.locator("[data-final-ready]").waitFor();
    assert.equal(await page.getByRole("textbox",{name:"Caption word 1",exact:true}).inputValue(),"personalized");
    assert.equal(posts.length,2,"reload must not POST another transcription or export");
    await page.getByRole("button",{name:"Replace demo"}).click();
    await page.getByRole("button",{name:"Generate captions",exact:true}).waitFor();
    assert.equal(await page.getByRole("button",{name:"Prepare final video",exact:true}).isDisabled(),true);
    assert.equal(await page.locator("[data-caption-preview]").count(),0,"stale captions must disappear on replacement");
    assert.deepEqual(errors,[]);
    console.log(JSON.stringify({passed:true,checks:["generate without publishing", "correct words", "seek across demo cut", "style and placement", "final corrected draft", "reload without another POST", "stale captions hidden after replacement"],posts:posts.length}));
  } catch (error) {
    if (page && !page.isClosed()) { file("failure.json", JSON.stringify({ errors, body: await page.locator("body").innerText(), media: await page.locator("video").evaluateAll(videos=>videos.map(video=>({time:video.currentTime,duration:video.duration,ready:video.readyState}))) }, null, 2)); await page.screenshot({ path:path.join(out,"failure.png") }); }
    throw error;
  } finally { if (browser) await browser.close(); server.closeAllConnections(); await new Promise(resolve=>server.close(resolve)); }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
