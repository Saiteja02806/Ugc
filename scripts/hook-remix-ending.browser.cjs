/* eslint-disable @typescript-eslint/no-require-imports -- Isolated actual-component regression. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { webpack } = require("next/dist/compiled/webpack/webpack");
let pw;
try { pw = require("playwright"); } catch { pw = require(path.join(process.env.USERPROFILE, ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright")); }
const root = path.resolve(__dirname, ".."), out = path.join(root, ".tmp/hook-remix-ending-browser");
fs.mkdirSync(out, { recursive: true });
const write = (name, value) => fs.writeFileSync(path.join(out, name), value);
const source = JSON.parse(fs.readFileSync(path.join(root, "lib/explore/reference-text-catalog.json"))).items.find(item => item.referenceId === "explore-paired-hook-4585ee949081c4e5cd835cd3");
const output = { blocks: ["SaaS founders!!\nThis app is a game changer", "I used to think marketing my SaaS\nwould take so much time"], heading: "", body: "" };
const style = { width: .84, y: .18, fontSize: 72, color: "#ffffff", font: "inter", fontWeight: 700 };
const legacy = { version: 1, format: "hook", trimStartMs: 0, trimEndMs: 3167, originalVolume: 1, musicVolume: .2, text: null,
  textOverlays: [{ ...style, value: output.blocks[0], startMs: 0, endMs: 3133 }, { ...style, fontSize: 48, value: output.blocks[1], startMs: 3133, endMs: 3167 }] };
write("loader.cjs", `const ts=require(${JSON.stringify(require.resolve("typescript"))});module.exports=source=>ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText;`);
write("css.cjs", `module.exports=s=>'export default '+JSON.stringify(Object.fromEntries([...s.matchAll(/\\.([a-zA-Z][a-zA-Z0-9_-]*)/g)].map(m=>[m[1],m[1]])))+';';`);
write("stubs.tsx", `export const useAuth=()=>({user:{uid:'fixture-owner'}});export const getCurrentUserIdToken=async()=>'fixture-token';
export const WorkflowBackgroundAudioPicker=()=>null;export const useLocalWorkflowMedia=()=>({asset:null,loading:false,error:null});export const DEFAULT_FINISHING_OPTIONS={};
export const useWorkflowFinishing=()=>({output:null,action:{disabled:true,busy:false,message:''}});export const useClipDraftSave=()=>({loaded:true,saved:null,busy:false,dirty:false,error:null,save:async()=>{},reload:()=>{}});
export const fetchAIStudioMediaAsset=async()=>{throw Error('Unexpected media lookup')};export const uploadAIStudioReferenceMedia=async()=>{throw Error('Unexpected upload')};`);
write("entry.tsx", `import {createRoot} from 'react-dom/client';import {useState} from 'react';import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {FormatVideoEditor} from '@/components/explore/format-video-editor';import {RemixTextSection} from '@/components/explore/remix-text-section';import {applyVideoTextRemix} from '@/lib/explore/remix-text-edit';
const source=${JSON.stringify(source)}, reference={id:source.referenceId,format:'hook',title:'Reviewed hook',videoUrl:'/video.mp4',slides:[]};
function App(){const [controls,sc]=useState(null),[preview,sp]=useState(null);return <><main><div ref={sc}/><div ref={sp}/></main>
<FormatVideoEditor format='hook' video={{id:'fixture',mediaAssetId:null,title:'Hook clip',url:'/video.mp4',durationSeconds:3.167,ratio:'9:16',width:720,height:1280}} remixReference={reference} localPreview active enabled={false} allowRemix={false} controlsTarget={controls} resultsTarget={preview} onDirty={()=>{}} onSaved={()=>{}} onContinue={()=>{}} onClipStateChange={value=>{window.clip=value}} onPreviewChange={value=>{window.sequence=value}} />
<section aria-label='Recovered remix'><RemixTextSection owner='fixture-owner' targetKey='recovery' format='hook' reference={reference} expanded onUse={(output,source)=>{window.applied=applyVideoTextRemix(${JSON.stringify(legacy)},output,source)}} /></section></>}
createRoot(document.getElementById('root')).render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><App/></QueryClientProvider>);`);

async function main() {
  execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "color=c=0x333344:s=720x1280:r=24", "-frames:v", "76", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-y", path.join(out, "video.mp4")], { windowsHide: true });
  const aliases = {};
  for (const name of ["contexts/auth-context", "lib/firebase/auth", "lib/ai-studio/media-client", "lib/ai-studio/reference-media-upload", "components/explore/workflow-background-audio-picker", "components/explore/use-local-workflow-media", "components/explore/use-workflow-finishing", "components/explore/use-clip-draft-save"]) aliases["@/" + name] = path.join(out, "stubs.tsx");
  aliases["@"] = root;
  await new Promise((resolve, reject) => { const compiler = webpack({ mode: "development", devtool: false, plugins: [new webpack.DefinePlugin({ "process.env": JSON.stringify({ NODE_ENV: "development" }) })], context: root, entry: path.join(out, "entry.tsx"), output: { path: out, filename: "bundle.js" }, resolve: { extensions: [".tsx", ".ts", ".js"], alias: aliases }, module: { rules: [{ test: /\.tsx?$/, use: path.join(out, "loader.cjs") }, { test: /\.css$/, use: path.join(out, "css.cjs") }] } }); compiler.run((error, stats) => compiler.close(() => error || stats.hasErrors() ? reject(error || Error(stats.toString({ all: false, errors: true }))) : resolve())); });
  let writes = 0;
  const server = http.createServer((req, res) => {
    if (req.method !== "GET") { writes++; res.writeHead(500); return res.end("Unexpected write"); }
    if (req.url.startsWith("/api/explore/reference-text")) { res.setHeader("Content-Type", "application/json"); return res.end(JSON.stringify({ ok: true, source, enabled: true, businessContext: { ready: true, name: "Fixture" } })); }
    if (req.url === "/bundle.js") { res.setHeader("Content-Type", "text/javascript"); return res.end(fs.readFileSync(path.join(out, "bundle.js"))); }
    if (req.url === "/video.mp4") { res.setHeader("Content-Type", "video/mp4"); return res.end(fs.readFileSync(path.join(out, "video.mp4"))); }
    res.setHeader("Content-Type", "text/html"); res.end('<html><head><meta charset="utf-8"><style>body{background:#202020;color:white;font-family:Arial}main{display:flex;gap:40px}main>div{width:360px}[data-clip-media]{position:relative;width:300px!important}video{width:100%}svg[aria-label^="Text overlay"]{position:absolute;inset:0;width:100%;height:100%}</style></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>');
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  let browser, page; const errors = [];
  try {
    browser = await pw.chromium.launch({ headless: true, ...(process.platform === "win32" ? { channel: "msedge" } : {}) });
    page = await browser.newPage({ viewport: { width: 1280, height: 850 } });
    page.on("pageerror", e => errors.push(e.message));
    await page.addInitScript(({ legacy, source, output }) => {
      localStorage.setItem("ugc-explore:format-draft:v1:fixture-owner:hook:fixture", JSON.stringify({ editing: legacy }));
      localStorage.setItem(`ugc-explore:remix-request:v2:fixture-owner:hook:recovery:${source.referenceId}:null`, JSON.stringify({ version: 1, requestKey: "00000000-0000-4000-8000-000000000001", referenceId: source.referenceId, slideId: null, format: "hook", instructions: "", referenceBlocks: source.blocks.map(b => b.text), outcome: "completed", source, reviewedDraft: output }));
    }, { legacy, source, output });
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    const video = page.locator("section[aria-label='Video edit preview'] video").first();
    await page.waitForFunction(() => window.clip && document.querySelector("video")?.readyState >= 2);
    assert.equal(await page.getByRole("button", { name: "Edit text block 2", exact: true }).count(), 0);
    const before = await page.getByLabel("Text overlay 1 preview", { exact: true }).innerHTML();
    for (const time of [3.1, 3.145, 3.1666667]) {
      await video.evaluate((v, time) => { v.pause(); v.currentTime = time; v.dispatchEvent(new Event("timeupdate")); }, time);
      await page.waitForFunction(() => document.querySelector('[aria-label="Text overlay 1 preview"]')?.textContent.includes("SaaS founders!!"));
      assert.equal(await page.getByLabel("Text overlay 1 preview", { exact: true }).innerHTML(), before);
      assert.equal(await page.getByLabel("Text overlay 2 preview", { exact: true }).count(), 0);
    }
    await video.evaluate(v => { v.currentTime = 0; return v.play(); });
    await page.waitForFunction(() => document.querySelector("video")?.ended);
    assert.equal(await page.getByLabel("Text overlay 1 preview", { exact: true }).innerHTML(), before);
    const clip = await page.evaluate(() => window.clip.editing), sequence = await page.evaluate(() => window.sequence.segment.editing);
    assert.deepEqual(clip.textOverlays, [{ ...legacy.textOverlays[0], endMs: 3167 }]); assert.deepEqual(sequence, clip);
    const recovered = page.getByRole("region", { name: "Recovered remix", exact: true });
    assert.equal(await recovered.getByLabel("Remixed text", { exact: true }).inputValue(), output.blocks[0]);
    await recovered.getByRole("button", { name: "Apply to this clip", exact: true }).click();
    assert.deepEqual((await page.evaluate(() => window.applied)).textOverlays, clip.textOverlays);
    assert.equal(writes, 0); assert.deepEqual(errors, []);
    await page.screenshot({ path: path.join(out, "ending-verified.png"), fullPage: true });
    console.log("PASS actual Hook editor: legacy draft repaired, text/style stable at 3.1s, 3.145s and natural end; final sequence uses same edits; old Remix review applies without any paid/API write.");
  } catch (error) { console.error(JSON.stringify({ errors, body: page ? await page.locator("body").innerText() : "" })); throw error;
  } finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
