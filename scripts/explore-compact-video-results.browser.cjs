/* eslint-disable @typescript-eslint/no-require-imports -- Local rendering of actual result components, without auth or inference. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const ts = require("typescript");
const { webpack } = require("next/dist/compiled/webpack/webpack");
let playwright;
try { playwright = require("playwright"); }
catch { playwright = require(path.join(process.env.USERPROFILE, ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright")); }

const root = path.resolve(__dirname, "..");
const out = path.join(root, ".tmp", "explore-compact-video-results");
fs.mkdirSync(out, { recursive: true });
const write = (name, content) => fs.writeFileSync(path.join(out, name), content);

// Extract unchanged function bodies so the isolated fixture exercises the actual
// pending/completed result markup, prompt disclosure and playback handlers.
function functions(file, names) {
  const source = ts.createSourceFile(file, fs.readFileSync(path.join(root, file), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  return source.statements.filter(statement => ts.isFunctionDeclaration(statement) && names.includes(statement.name?.text)).map(statement => statement.getText(source)).join("\n");
}
const videoFile = "components/video/video-generation-workspace.tsx";
const source = fs.readFileSync(path.join(root, videoFile), "utf8");
const widths = source.match(/const VIDEO_RESULT_WIDTH_CLASS_NAMES[\s\S]*?\n};/)[0];
write("results.tsx", `import {useEffect,useRef,useState} from 'react';
import {ChevronUp,ChevronDown,Clock3,Monitor,Pause,Play,Sparkles,Volume2,VolumeX} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {AiStudioCopyButton} from '@/components/generation/ai-studio-copy-button';
import {AiStudioResultActions} from '@/components/generation/ai-studio-result-actions';
import {VideoGenerationPlaceholder} from '@/components/video/video-generation-placeholder';
import {cn} from '@/lib/utils';
import resultLayout from '@/components/video/video-results.module.css';
import {VideoPromptBubble} from '@/components/video/video-result-prompt';
${widths}
${functions(videoFile, ["OptimisticVideoCard", "VideoResultCard", "VideoResultMetadata", "getVideoResultWidthClassName", "formatVideoDuration"])}
export {OptimisticVideoCard,VideoResultCard};`);
write("player.tsx", `import {useCallback,useRef} from 'react';import {cn} from '@/lib/utils';import playerStyles from '@/components/explore/workflow-media-player.module.css';
${functions("components/explore/hook-workflow-media-controls.tsx", ["WorkflowMediaPlayer"])}`);
// Download is the only rendered action isolated from account/network state.
write("download.tsx", "export const VideoDownloadButton=({className,label})=><button type='button' className={className} aria-label='Download sample video'>{label}</button>;");
write("loader.cjs", `const ts=require(${JSON.stringify(require.resolve("typescript"))});module.exports=function(s){return ts.transpileModule(s,{fileName:this.resourcePath,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText};`);
write("css-loader.cjs", `const fs=require('node:fs'),path=require('node:path');module.exports=function(s){const prefix='ui_'+path.basename(this.resourcePath).replace(/[^a-z]/gi,'_')+'_';const names={};s=s.replace(/\\.([a-zA-Z_][\\w-]*)/g,(_,n)=>{names[n]=prefix+n;return '.'+prefix+n}).replace(/:global\\(([^)]+)\\)/g,'$1');fs.appendFileSync(${JSON.stringify(path.join(out, "modules.css"))},s+'\\n');return 'export default '+JSON.stringify(names)};`);
write("entry.tsx", `import {createRoot} from 'react-dom/client';import {useState} from 'react';
import {OptimisticVideoCard,VideoResultCard} from './results';
import {WorkflowPreviewCanvas} from '@/components/explore/workflow-preview-canvas';
const params=new URLSearchParams(location.search),ratio=params.get('ratio')||'9:16',mode=params.get('mode')||'pending';
const prompt='OPENING STATE: The performer sits with both open hands beside the temples, looking down toward screen-right with an open-mouth amused expression. '+('Keep the same person and scene. Lower the hands and turn toward the camera. ').repeat(24);
const asset={id:'fixture-video',mediaAssetId:'fixture-asset',title:'Sample generated video',url:'/video.mp4',thumbnailUrl:'/photo.png',modelLabel:'Omni Flash 1.1',durationSeconds:4,resolution:'720p',ratio,createdAt:'2026-10-23T13:15:00Z',prompt,metadata:{prompt}};
function App(){const [selected,setSelected]=useState(false);return <><header>Explore / <strong>{(mode.startsWith('talking')||mode.startsWith('phone'))?'Talking Head + Demo':'Hook video'}</strong><span>Local layout fixture</span></header><main><aside><strong>Create</strong><p>Starting frame</p><img src='/photo.png'/><p>Your instructions</p><p>Animation settings</p></aside><section data-results><nav>References <strong>Your videos</strong></nav><div data-scroll><div data-toolbar>History</div>{(mode.startsWith('talking')||mode.startsWith('phone'))?<WorkflowPreviewCanvas kind={mode.startsWith('phone')?'phone':'hook'} generation={{busy:mode.endsWith('pending'),results:mode.endsWith('pending')?[]:[asset],selected:selected?asset:null,selectResult:()=>setSelected(true),pendingCount:1,pendingPreview:{aspectRatio:ratio,referenceImageUrl:'/photo.png',label:'Creating your video',prompt,createdAt:asset.createdAt}}}/>:mode==='pending'?<OptimisticVideoCard compact aspectRatio={ratio} avatarThumbnail='/photo.png' prompt={prompt} modelLabel={asset.modelLabel} durationSeconds={4} resolution='720p'/>:<VideoResultCard compact={mode!=='studio'} video={asset} onSelect={()=>setSelected(true)} selectLabel={selected?'Selected for editing':'Edit hook video'}/>}</div></section></main></>};createRoot(document.getElementById('root')).render(<App/>);`);

async function main() {
  write("modules.css", "");
  const globals = fs.readFileSync(path.join(root, "app/globals.css"), "utf8").replace('@import "tailwindcss";', '@import "tailwindcss" source(none);') + '\n@source "../components";\n';
  write("global.css", (await require("postcss")([require("@tailwindcss/postcss")()]).process(globals, { from: path.join(root, "app/globals.css") })).css);
  await new Promise((resolve, reject) => {
    const compiler = webpack({ mode: "development", devtool: false, context: root,
      entry: path.join(out, "entry.tsx"), output: { path: out, filename: "bundle.js" },
      resolve: { extensions: [".tsx", ".ts", ".js"], alias: {
        "@/components/explore/hook-workflow-media-controls": path.join(out, "player.tsx"),
        "@/components/generation/video-download-button": path.join(out, "download.tsx"), "@": root,
      } }, module: { rules: [{ test: /\.tsx?$/, use: path.join(out, "loader.cjs") }, { test: /\.css$/, use: path.join(out, "css-loader.cjs") }] },
    });
    compiler.run((error, stats) => compiler.close(() => error || stats.hasErrors() ? reject(error || Error(stats.toString({ all: false, errors: true }))) : resolve()));
  });
  const server = http.createServer((request, response) => {
    const pathname = new URL(request.url, "http://localhost").pathname;
    const files = { "/bundle.js": [path.join(out, "bundle.js"), "application/javascript"], "/global.css": [path.join(out, "global.css"), "text/css"], "/modules.css": [path.join(out, "modules.css"), "text/css"], "/photo.png": [path.join(root, "public/ai-studio/creator-references/creator-01.png"), "image/png"], "/video.mp4": [path.join(root, "public/explore/covers/hook-video-v1.mp4"), "video/mp4"] };
    const file = files[pathname];
    if (file) { response.setHeader("Content-Type", file[1]); return fs.createReadStream(file[0]).pipe(response); }
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.end(`<!doctype html><html class="dark"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/global.css"><link rel="stylesheet" href="/modules.css"><style>body{margin:0}header{height:64px;padding:20px 24px;border-bottom:1px solid var(--border)}header span{float:right;color:var(--muted);font-size:12px}main{display:grid;grid-template-columns:378px minmax(0,1fr);gap:16px;padding:20px 24px}aside,[data-results]{border:1px solid var(--border);border-radius:16px;min-width:0}aside{padding:20px;background:var(--card)}aside p{margin-top:24px}aside img{margin-top:12px;width:96px;border-radius:10px}nav{height:56px;padding:16px 20px;border-bottom:1px solid var(--border)}nav strong{color:var(--primary);margin-left:24px}[data-scroll]{padding:16px 20px;height:calc(100dvh - 180px);overflow:auto}[data-toolbar]{font-size:12px;text-align:right;margin-bottom:16px}@media(max-width:900px){main{display:block;padding:12px}aside{display:none}[data-scroll]{padding:12px;height:calc(100dvh - 160px)}}@media(max-width:400px){header{padding:16px 12px;font-size:13px}header span{display:none}nav{padding-inline:12px}}</style><div id="root"></div><script src="/bundle.js"></script></html>`);
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  let browser;
  try {
    browser = await playwright.chromium.launch({ headless: true, ...(process.platform === "win32" ? { channel: "msedge" } : {}) });
    const page = await browser.newPage();
    await page.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async value=>{window.copiedPrompt=value}}}));
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    const receipts = [];
    const viewports = [{ width: 1280, height: 600 }, { width: 1280, height: 720 }, { width: 1366, height: 768 }, { width: 1536, height: 864 }, { width: 1897, height: 915 }, { width: 1920, height: 1080 }, { width: 390, height: 844 }, { width: 320, height: 568 }];
    for (const viewport of viewports) for (const ratio of ["9:16", "4:5", "1:1", "16:9"]) for (const mode of ["pending", "completed"]) {
      await page.setViewportSize(viewport);
      await page.goto(`http://127.0.0.1:${server.address().port}/?mode=${mode}&ratio=${ratio}`);
      const media = page.locator(mode === "pending" ? "[data-video-generation-placeholder]" : "video").first();
      await media.waitFor({ state: "visible" });
      const layout = await page.evaluate(() => {
        const rect = element => { const r = element.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom }; };
        const image = document.querySelector("[data-video-generation-placeholder]") || document.querySelector("video").parentElement;
        const prompt = document.querySelector('[aria-label="Show full video prompt"]');
        const scroller = document.querySelector("[data-scroll]");
        const row=image.closest('[data-ratio]');
        return { row:rect(row), media: rect(image), prompt: rect(prompt), promptTextHeight: prompt.querySelector("span").getBoundingClientRect().height, scrollBottom: scroller.getBoundingClientRect().bottom, overflow: document.documentElement.scrollWidth > innerWidth || scroller.scrollWidth > scroller.clientWidth + 1 };
      });
      const details = JSON.stringify({ viewport, ratio, mode, layout });
      assert.equal(layout.overflow, false, details);
      assert.ok(layout.media.height <= 301, details);
      assert.ok(layout.media.height >= 100, details);
      assert.ok(layout.prompt.height <= 60, details);
      assert.ok(layout.promptTextHeight <= 41, details);
      assert.ok(layout.media.bottom < layout.scrollBottom, details);
      assert.ok(Math.abs(layout.media.x-layout.row.x)<2,'Video keeps the result row left edge: '+details);
      if(layout.row.width>=580){
        assert.ok(layout.prompt.x>=layout.row.x+layout.row.width*.35,'Prompt occupies the marked right-hand column: '+details);
        assert.ok(Math.abs(layout.prompt.y-layout.media.y)<40,'Prompt stays aligned with the video top: '+details);
      } else assert.ok(layout.prompt.y>=layout.media.bottom,'Mobile prompt follows its video: '+details);
      assert.ok(Math.abs(layout.media.width / layout.media.height - Number(ratio.split(":")[0]) / Number(ratio.split(":")[1])) < .02, details);
      const expand = page.getByRole("button", { name: "Show full video prompt", exact: true });
      await expand.focus();
      await page.keyboard.press("Enter");
      await page.getByRole("button", { name: "Collapse video prompt", exact: true }).waitFor();
      assert.equal(await page.getByRole("button", { name: "Collapse video prompt", exact: true }).getAttribute("aria-expanded"), "true");
      await page.getByRole("button", { name: "Collapse video prompt", exact: true }).click();
      if(ratio==='9:16'&&viewport.width===1897){
        await page.getByRole('button',{name:'Copy prompt',exact:true}).click();
        await page.waitForFunction(()=>Boolean(window.copiedPrompt));
        assert.ok((await page.evaluate(()=>window.copiedPrompt)).endsWith('Lower the hands and turn toward the camera. '),'Copy retains the complete original prompt');
      }
      if (mode === "completed") {
        await page.getByRole("button", { name: "Edit hook video", exact: true }).click();
        await page.getByRole("button", { name: "Selected for editing", exact: true }).waitFor();
        assert.equal(await page.getByRole("button", { name: "Play video", exact: true }).count(), 1);
        assert.equal(await page.getByRole("button", { name: "Download sample video", exact: true }).count(), 1);
      }
      receipts.push({ viewport, ratio, mode, layout });
      if (ratio === "9:16" && [1280, 390, 1897].includes(viewport.width) && viewport.height !== 600) await page.screenshot({ path: path.join(out, `${mode}-${viewport.width}.png`), fullPage: true, animations: "disabled" });
    }
    for (const viewport of viewports) for (const mode of ["talking-pending", "talking-completed", "phone-pending", "phone-completed"]) {
      await page.setViewportSize(viewport);
      await page.goto(`http://127.0.0.1:${server.address().port}/?mode=${mode}`);
      const preview = page.locator(mode.endsWith("pending") ? "[data-video-generation-placeholder]" : "video");
      await preview.waitFor({ state: "visible" });
      if (mode.endsWith("completed")) {
        await preview.evaluate(video => video.readyState >= 1 ? undefined : new Promise(resolve => video.addEventListener("loadedmetadata", resolve, { once: true })));
        await page.getByRole("button", { name: "Use video 1", exact: true }).click();
        assert.equal(await page.getByRole("button", { name: "Use video 1", exact: true }).getAttribute("aria-pressed"), "true");
      }
      const box = await preview.boundingBox();
      assert.ok(box.height <= 301, JSON.stringify({ viewport, mode, box }));
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      const placement = await page.evaluate(()=>{
        const media=document.querySelector('[data-video-generation-placeholder]')||document.querySelector('video');
        const row=media.closest('[data-ratio]'),prompt=document.querySelector('[aria-label="Show full video prompt"]');
        const r=row.getBoundingClientRect(),p=prompt.getBoundingClientRect(),m=media.getBoundingClientRect();
        return {width:r.width,rowX:r.x,promptX:p.x,mediaX:m.x,mediaBottom:m.bottom,promptY:p.y};
      });
      assert.ok(Math.abs(placement.mediaX-placement.rowX)<2,JSON.stringify(placement));
      if(placement.width>=580)assert.ok(placement.promptX>=placement.rowX+placement.width*.35,JSON.stringify(placement));
      else assert.ok(placement.promptY>=placement.mediaBottom,JSON.stringify(placement));
      await page.getByRole('button',{name:'Show full video prompt',exact:true}).click();
      await page.getByRole('button',{name:'Collapse video prompt',exact:true}).waitFor();
      receipts.push({ viewport, mode, media: box });
    }
    // Comparable physical dimensions to the supplied 1897x915 screenshot.
    const scaled=await browser.newContext({viewport:{width:1518,height:732},deviceScaleFactor:1.25});
    const scaledPage=await scaled.newPage();
    for(const mode of ['pending','completed']){
      await scaledPage.goto(`http://127.0.0.1:${server.address().port}/?mode=${mode}`);
      await scaledPage.locator(mode==='pending'?'[data-video-generation-placeholder]':'video').waitFor({state:'visible'});
      await scaledPage.screenshot({path:path.join(out,`${mode}-screenshot-scale.png`),animations:'disabled'});
    }
    await scaled.close();
    // Standalone AI Studio retains its existing spacious presentation.
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(`http://127.0.0.1:${server.address().port}/?mode=studio`);
    await page.locator("video").waitFor({ state: "visible" });
    assert.ok((await page.locator("video").boundingBox()).height > 300);
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(out, "results.json"), JSON.stringify({ checks: receipts.length, receipts, errors }, null, 2));
    console.log(`PASS ${receipts.length} compact result layouts, prompt disclosure, edit selection and standalone Studio scope. Auth, inference, hosted acceptance and download transport are isolated.`);
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
