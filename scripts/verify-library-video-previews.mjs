import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";

// Browser regression for the actual card/preview components, with account and
// editing chrome substituted. Fixtures stay local; no account/provider writes.
const require = createRequire(import.meta.url);
let playwright;
try { playwright = require(process.env.UGCPILOT_PLAYWRIGHT_PATH ?? "playwright"); }
catch { playwright = require(path.join(process.env.USERPROFILE, ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright")); }
const { chromium } = playwright;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, ".tmp/library-video-preview");
mkdirSync(out, { recursive: true });
const ffmpeg = require("ffmpeg-static");
for (const [name, size] of [["portrait", "180x320"], ["landscape", "320x180"], ["square", "240x240"]]) {
  execFileSync(ffmpeg, ["-v", "error", "-y", "-f", "lavfi", "-i", `testsrc2=size=${size}:rate=10:duration=6`, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart", path.join(out, `${name}.mp4`)]);
}
execFileSync(ffmpeg, ["-v", "error", "-y", "-i", path.join(out, "portrait.mp4"), "-frames:v", "1", path.join(out, "poster.png")]);

function functions(file, names) {
  const source = readFileSync(path.join(root, file), "utf8");
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  return ast.statements.filter(node => ts.isFunctionDeclaration(node) && names.includes(node.name?.text)).map(node => node.getText(ast)).join("\n");
}
const demoSource = functions("components/demos/demos-workspace.tsx", ["DemoCard", "StatusBadge", "getDemoTags", "formatDuration", "formatFileSize", "formatDate", "getFileTypeLabel", "getDimensionsLabel"]).replace("export function DemoCard", "function DemoCard");
const assetSource = functions("components/media/user-media-collection.tsx", ["MediaAssetCard", "getCreativeAssetCardStatusLabel", "getCreativeAssetCardStatusVariant", "formatDuration", "formatAssetDate", "getSourceLabel"]);
const demoGrid = readFileSync(path.join(root,"components/demos/demos-workspace.tsx"),"utf8").match(/const demoLibraryGridClassName\s*=\s*"([^"]+)"/)[1];
const assetGrid = readFileSync(path.join(root,"components/media/user-media-collection.tsx"),"utf8").match(/return "(grid grid-cols-2[^"\n]*xl:grid-cols-5[^"\n]*)"/)[1];
writeFileSync(path.join(out, "entry.tsx"), `
import React, { useState, useMemo } from "react";
import { createRoot } from "react-dom/client";
import { Check, Clock3, Maximize2, Pause, Play, Trash2, Loader2, Pencil, FolderMinus } from "lucide-react";
import { VideoPreview } from "@/components/media/video-preview";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { getVideoPreviewAspectRatio } from "@/lib/media/video-preview";
import { getDemoPlaybackUrl } from "@/lib/demo/demo-display";
import { getCreativeAssetDisplayState } from "@/lib/edit/creative-asset-display";
import { getCreativeAssetEditorHref, getContentDemoEditorHref } from "@/lib/edit/routes";
const Link = ({ children, ...props }) => <a {...props}>{children}</a>;
const InlineTitleEditor = ({ title }) => <h3 className="truncate text-sm font-semibold">{title}</h3>;
const DemoTagBadges = () => null;
const DemoCard = (() => { ${demoSource}; return DemoCard; })();
const MediaAssetCard = (() => { ${assetSource}; return MediaAssetCard; })();
const frames = [
  { id:"first", title:"Opening frame", ratio:"9:16", width:180, height:320, url:"/portrait.mp4", poster:null },
  { id:"poster", title:"Saved poster", ratio:"9:16", width:180, height:320, url:"/portrait.mp4?poster", poster:"/poster.png" },
  { id:"broken", title:"Missing poster", ratio:"9:16", width:180, height:320, url:"/portrait.mp4?broken", poster:"/missing.png" },
  { id:"wide", title:"Screen recording", ratio:"16:9", width:320, height:180, url:"/landscape.mp4", poster:null },
  { id:"square", title:"Square footage", ratio:"1:1", width:240, height:240, url:"/square.mp4", poster:null },
];
const assetFrames = [...frames, { id:"edited", title:"Edited output", ratio:"9:16", width:180, height:320, url:"/portrait.mp4", poster:"/poster.png" }];
function Preview() {
  const [playing, setPlaying] = useState(null);
  const [source, setSource] = useState('/portrait.mp4?original');
  const [mounted, setMounted] = useState(true);
  const [dialog, setDialog] = useState(false);
  return <main className="mx-auto max-w-[1360px] space-y-8 p-4 text-foreground sm:p-6">
    <section aria-label="Content Library"><h1 className="mb-4 text-xl font-semibold">Demo footage</h1>
      <div className=${JSON.stringify(demoGrid)}>
        {frames.map(f => <DemoCard key={f.id} demo={{ id:f.id, title:f.title, ratio:f.ratio, width:f.width, height:f.height, source_video_url:f.url, rendered_video_url:null, thumbnail_url:f.poster, status:"ready", duration_seconds:6, file_size_bytes:2048, file_type:"video/mp4", updated_at:"2026-10-05T04:00:00Z", draft_json:{} }} deleting={false} isSelected={false} isPlaying={playing===f.id} onPlay={() => setPlaying(current => current===f.id ? null : f.id)} onPlaybackStateChange={value => setPlaying(current => value ? f.id : current===f.id ? null : current)} onOpenPreview={() => {}} onToggleSelect={() => {}} onDelete={() => {}} onRename={async()=>{}} onTagsChange={async()=>{}} />)}
      </div>
    </section>
    <section aria-label="Creative Assets"><h2 className="mb-4 text-xl font-semibold">Creative Assets</h2>
      <div className=${JSON.stringify(assetGrid)}>
        {assetFrames.map(f => <MediaAssetCard key={f.id} aspectRatioMode="adaptive" asset={{ id:f.id, title:f.title, ratio:f.ratio, width:f.width, height:f.height, url:f.url, thumbnailUrl:f.poster, collection:"video", status:"ready", sourceType:"upload", durationSeconds:6, createdAt:"2026-10-05T04:00:00Z" }} deleting={false} grouped={false} editProject={f.id==="edited" ? {status:"rendered",renderedVideoUrl:"/landscape.mp4?edited"} : null} onRemove={()=>{}} />)}
      </div>
    </section>
    <section aria-label="Failed preview" className="h-80 w-44"><VideoPreview src="/retry.mp4" title="Retry fixture" /></section>
    <div style={{height:1500}} />
    <section aria-label="Offscreen preview" className="h-80 w-44"><VideoPreview src="/portrait.mp4?offscreen" title="Offscreen video" /></section>
    <section aria-label="Source change" className="w-44"><div className="h-80"><VideoPreview src={source} title="Changing source" playing={playing==='changing'} onPlaybackStateChange={v=>setPlaying(v?'changing':null)} /></div><button onClick={()=>{setPlaying(null);setSource('/landscape.mp4?replacement')}}>Replace source</button><button onClick={()=>setPlaying('changing')}>Play changing source</button></section>
    <section aria-label="Unmount preview" className="w-44"><div className="h-80">{mounted?<VideoPreview src="/portrait.mp4?unmount" title="Unmount fixture" playing={playing==='unmount'} onPlaybackStateChange={v=>setPlaying(v?'unmount':null)}/>:null}</div><button onClick={()=>setPlaying('unmount')}>Play unmount fixture</button><button onClick={()=>setMounted(false)}>Remove preview</button></section>
    <section aria-label="Long library"><h2>Long library</h2><div className=${JSON.stringify(demoGrid)}>{Array.from({length:40},(_,i)=><div key={i} className="h-64" data-long-card><VideoPreview src={'/portrait.mp4?long='+i} title={'Long '+i}/></div>)}</div></section>
    <section aria-label="Cross origin" className="h-80 w-44"><VideoPreview src={'http://localhost:'+location.port+'/portrait.mp4?cross'} title="Cross origin fixture" /></section>
    <section aria-label="Expanded preview" className="w-44"><button onClick={()=>{setPlaying(null);setDialog(true)}}>Expand controlled preview</button>{dialog?<div role="dialog" aria-label="Expanded video"><div className="h-80"><VideoPreview src="/portrait.mp4?dialog" title="Dialog video" playing={playing==='dialog'} onPlaybackStateChange={v=>setPlaying(v?'dialog':null)} /></div><button onClick={()=>setPlaying('dialog')}>Play dialog video</button><button onClick={()=>{setPlaying(null);setDialog(false)}}>Close dialog</button></div>:null}</section>
  </main>;
}
createRoot(document.getElementById("root")).render(<React.StrictMode><Preview /></React.StrictMode>);
`);
writeFileSync(path.join(out, "tsx-loader.cjs"), `const ts = require(${JSON.stringify(require.resolve("typescript"))}); module.exports = function(source) { return ts.transpileModule(source, {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText; };`);
const compiled = require("next/dist/compiled/webpack/webpack");
console.log('Compiling local card fixture');
await new Promise((resolve, reject) => { const compiler=compiled.webpack({
  mode: "development", target: "web", devtool: false,
  entry: path.join(out, "entry.tsx"),
  output: { path: out, filename: "preview.js" },
  resolve: { extensions: [".tsx", ".ts", ".js"], alias: {
    ...(process.env.UGCPILOT_PREVIEW_BASELINE ? { "@/components/media/video-preview": path.join(out, "baseline-video-preview.tsx") } : {}), "@": root,
  } },
  module: { rules: [{ test: /\.tsx?$/, use: path.join(out, "tsx-loader.cjs"), exclude: /node_modules/ }] },
});compiler.run((error,stats)=>compiler.close(()=>error||stats.hasErrors()?reject(error??Error(stats.toString({all:false,errors:true}))):resolve())); });
console.log('Compiling card fixture styles');
const globals=readFileSync(path.join(root, 'app/globals.css'), 'utf8').replace('@import "tailwindcss";', '@import "tailwindcss" source(none);')
  + '\n@source "../components/demos/demos-workspace.tsx";\n@source "../components/media/user-media-collection.tsx";\n@source "../components/media/video-preview.tsx";\n@source "../components/ui";\n@source "../.tmp/library-video-preview/entry.tsx";';
const css = await postcss([tailwind({ base: root })]).process(globals, { from: path.join(root, "app/globals.css") });
writeFileSync(path.join(out, "preview.css"), css.css);
const html = '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/preview.css"></head><body><div id="root"></div><script src="/preview.js"></script></body></html>';
let retryRequests = 0;
const mediaRequests = [];
const server = createServer((request, response) => {
  const url = new URL(request.url, "http://localhost");
  if (url.pathname === "/") { response.setHeader("Content-Type", "text/html"); response.end(html); return; }
  let name = path.basename(url.pathname);
  if (name.endsWith('.mp4')) mediaRequests.push({url:url.pathname+url.search, range:request.headers.range});
  if (name === "retry.mp4") {
    retryRequests++;
    if (retryRequests === 1) { response.writeHead(404); response.end(); return; }
    name = "portrait.mp4";
  }
  if (!["preview.css", "preview.js", "portrait.mp4", "landscape.mp4", "square.mp4", "poster.png"].includes(name)) { response.writeHead(404); response.end(); return; }
  const data = readFileSync(path.join(out, name));
  const type = name.endsWith(".mp4") ? "video/mp4" : name.endsWith(".png") ? "image/png" : name.endsWith(".css") ? "text/css" : "text/javascript";
  response.setHeader("Content-Type", type);
  response.setHeader("Accept-Ranges", "bytes");
  const range = request.headers.range?.match(/bytes=(\d+)-(\d*)/);
  if (range) {
    const start = Number(range[1]), end = range[2] ? Math.min(Number(range[2]), data.length-1) : data.length-1;
    response.writeHead(206, { "Content-Range": `bytes ${start}-${end}/${data.length}`, "Content-Length": end-start+1 });
    response.end(data.subarray(start, end+1));
  } else response.end(data);
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, channel: process.env.UGCPILOT_BROWSER_CHANNEL ?? "msedge" });
const errors = [];
let checks = 0;
function check(condition, message) { assert.ok(condition, message); checks++; }
const metrics = [];
async function measureLibrary(page, viewport) {
  await page.setViewportSize(viewport);
  await page.goto(origin);
  const cards = page.locator('[data-long-card]');
  let peakSources = 0;
  for (let index=0;index<40;index+=5) {
    await cards.nth(index).scrollIntoViewIfNeeded();
    await page.waitForFunction(i=>{const card=document.querySelectorAll('[data-long-card]')[i];return card?.querySelector('canvas:not([hidden])') || (card?.querySelector('video')?.readyState>=2);},index);
    await page.waitForTimeout(100);
    peakSources=Math.max(peakSources,await page.locator('video[src]').count());
  }
  const requestsBeforeReturn=mediaRequests.length;
  await cards.first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  const afterReturn=await page.locator('video[src]').count();
  metrics.push({viewport,peakIdleSources:peakSources,sourcesAfterReturn:afterReturn,
    requestsOnReturn:mediaRequests.length-requestsBeforeReturn,
    canvasBytes:await page.locator('canvas:not([hidden])').evaluateAll(nodes=>nodes.reduce((sum,c)=>sum+c.width*c.height*4,0))});
  if(!process.env.UGCPILOT_PREVIEW_BASELINE){
    check(afterReturn===0,'Long scroll must not retain idle video sources');
    check(mediaRequests.length===requestsBeforeReturn,'Returning to captured stills must not fetch videos again');
    check(await page.locator('canvas:not([hidden])').evaluateAll(nodes=>nodes.every(c=>Math.max(c.width,c.height)<=320)), 'Local stills must have bounded dimensions');
  }
}
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
  page.setDefaultTimeout(12_000);
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(()=>{let visible='visible';Object.defineProperty(document,'visibilityState',{get:()=>visible});window.setPreviewVisibility=value=>{visible=value;document.dispatchEvent(new Event('visibilitychange'));};});
  if(process.env.UGCPILOT_PREVIEW_BASELINE){
    for(const viewport of [{width:1440,height:1200},{width:390,height:844}]) await measureLibrary(page,viewport);
  } else {
  console.log('Checking actual Demo and Creative Assets cards');
  await page.goto(origin);
  await page.waitForFunction(() => document.querySelectorAll('section[aria-label="Content Library"] canvas:not([hidden])').length === 4);
  const demos = page.getByRole("region", { name:"Content Library" });
  const assets = page.getByRole("region", { name:"Creative Assets" });
  check(await demos.locator("video").count()===0, "Opening-frame decoders must release their sources without autoplay");
  check(await demos.locator('canvas:not([hidden])').count()===4, "Opening frames must decode before a click");
  check(await demos.locator('canvas:not([hidden])').evaluateAll(nodes => nodes.every(canvas=>{ const context=canvas.getContext('2d');return [...context.getImageData(0,0,canvas.width,canvas.height).data].some((value,i)=>i%4!==3&&value>50); })), "Decoded stills must contain visible video pixels");
  check(await demos.getByRole("img", {name:"Preview of Saved poster"}).count() === 1, "Existing posters must display without loading a video");
  check(await page.getByRole("region", {name:"Offscreen preview"}).locator("video").count() === 0, "Offscreen videos must not preload");
  check(await demos.locator("article").evaluateAll(cards => cards.every(card => card.getBoundingClientRect().width < 270)), "Desktop cards must stay compact");
  check(await demos.locator("article").evaluateAll(cards => cards.every(card => { const frame=card.querySelector("[data-video-preview]"); const still=frame.querySelector('canvas:not([hidden])'); return !still || Math.abs(frame.clientWidth/frame.clientHeight - still.width/still.height)<0.02; })), "Cards must match source proportions without side bars or cropping");
  await demos.getByRole("button", {name:"Play Opening frame",exact:true}).click();
  await page.waitForFunction(() => document.querySelector('section[aria-label="Content Library"] video[aria-label="Preview of Opening frame"]')?.currentTime > 0.5);
  const paused = await demos.locator('video[aria-label="Preview of Opening frame"]').evaluate(v => v.currentTime);
  await demos.getByRole("button", {name:"Pause Opening frame",exact:true}).click();
  await page.waitForFunction(()=>!document.querySelector('section[aria-label="Content Library"] video'));
  await demos.getByRole("button", {name:"Resume Opening frame",exact:true}).click();
  await page.waitForFunction(time=>document.querySelector('section[aria-label="Content Library"] video[aria-label="Preview of Opening frame"]')?.currentTime>time,paused);
  check(await demos.locator('video[aria-label="Preview of Opening frame"]').evaluate((v,time)=>v.currentTime > time, paused), "Resuming must retain the playback position");
  await demos.getByRole("button", {name:"Play Screen recording",exact:true}).click();
  await page.waitForTimeout(100);
  check(await demos.locator("video").evaluateAll(videos => videos.filter(v=>!v.paused).length === 1), "Demo playback must retain its single-active-video behavior");
  await demos.getByRole("button", {name:"Pause Screen recording",exact:true}).click();
  await assets.scrollIntoViewIfNeeded();
  await page.waitForFunction(()=>!!document.querySelector('canvas[aria-label="Preview of Edited output"]:not([hidden])'));
  await page.waitForFunction(()=>{const canvas=document.querySelector('canvas[aria-label="Preview of Edited output"]');const frame=canvas?.parentElement;return frame && Math.abs(frame.clientWidth/frame.clientHeight-16/9)<0.02;});
  const editedDimensions=await assets.locator('canvas[aria-label="Preview of Edited output"]').evaluate(canvas=>({width:canvas.width,height:canvas.height,frameWidth:canvas.parentElement.clientWidth,frameHeight:canvas.parentElement.clientHeight}));
  check(Math.abs(editedDimensions.width/editedDimensions.height-16/9)<0.02 && Math.abs(editedDimensions.frameWidth/editedDimensions.frameHeight-16/9)<0.02,`Edited assets must use the current output frame and proportions: ${JSON.stringify(editedDimensions)}`);
  check(mediaRequests.some(request=>request.url.includes('landscape.mp4?edited')), 'Edited output uses the verified output URL');
  await assets.getByRole("button", {name:"Play Opening frame",exact:true}).click();
  await assets.locator('video[aria-label="Preview of Opening frame"]').waitFor();
  await page.waitForTimeout(400);
  await assets.getByRole("button", {name:"Pause Opening frame",exact:true}).click();
  check(await assets.getByRole("button", {name:"Resume Opening frame",exact:true}).count() === 1, "Creative Assets must expose pause/resume controls");
  for (const dark of [false, true]) {
    await page.evaluate(dark => document.documentElement.classList.toggle("dark", dark), dark);
    const color = await demos.getByRole("button", {name:"Resume Opening frame",exact:true}).evaluate(button => {
      const canvas=document.createElement("canvas"); canvas.width=1; canvas.height=1;
      const context=canvas.getContext("2d");
      function pixel(value) { context.clearRect(0,0,1,1); context.fillStyle=value; context.fillRect(0,0,1,1); return [...context.getImageData(0,0,1,1).data]; }
      return {icon:pixel(getComputedStyle(button.querySelector("svg")).color), background:pixel(getComputedStyle(button).backgroundColor)};
    });
    check(color.icon.slice(0,3).every(channel=>channel<60) && color.background.slice(0,3).every(channel=>channel>240), `Play icons must contrast in the ${dark ? "dark" : "light"} theme: ${JSON.stringify(color)}`);
  }
  const failed = page.getByRole("region",{name:"Failed preview"});
  await failed.scrollIntoViewIfNeeded();
  await failed.getByRole("button",{name:"Retry preview"}).waitFor();
  check(await failed.getByText("Preview could not load").count()===1,"Video failures must show an actionable state");
  await failed.getByRole("button",{name:"Retry preview"}).click();
  await page.waitForFunction(()=>!!document.querySelector('canvas[aria-label="Preview of Retry fixture"]:not([hidden])'));
  check(await failed.locator("video").count()===0,"Retry must restore a still and release the decoder");
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({ path:path.join(out,"desktop.png"),fullPage:false });
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>window.scrollTo(0,0));
  check(await page.evaluate(()=>document.documentElement.scrollWidth===window.innerWidth), "Mobile cards must not overflow the page");
  check(await demos.locator("article").first().evaluate(card=>card.clientWidth < 180), "Mobile must display compact two-column cards");
  await page.screenshot({path:path.join(out,"mobile.png")});
  await assets.scrollIntoViewIfNeeded();
  check(await assets.locator("article").evaluateAll(cards=>cards.every(card=>[...card.querySelectorAll("button,a")].every(control=>{const box=control.getBoundingClientRect(),parent=card.getBoundingClientRect(); return box.left>=parent.left && box.right<=parent.right && box.width>=30;}))),"Small-screen asset controls must fit inside each card");
  await page.screenshot({path:path.join(out,"mobile-assets.png")});
  check(errors.length === 0, `Browser errors: ${errors.join("; ")}`);
  for(const viewport of [{width:1440,height:1200},{width:390,height:844}]){
    await page.setViewportSize(viewport);await page.goto(origin);
    const demo=page.getByRole('region',{name:'Content Library'});
    const assetRegion=page.getByRole('region',{name:'Creative Assets'});
    for(const [region,title] of [[demo,'Opening frame'],[assetRegion,'Opening frame']]){
      const card=region.locator('article').filter({has:page.getByRole('button',{name:new RegExp('^(Play|Resume|Pause) '+title+'$')})});
      await card.scrollIntoViewIfNeeded();
      if(viewport.width===390 && await region.getAttribute('aria-label')==='Creative Assets'){
        await card.locator('[data-video-preview]').evaluate(frame=>window.scrollTo(0,scrollY+frame.getBoundingClientRect().bottom+1));
        check(await card.locator('[data-video-preview]').evaluate(frame=>frame.getBoundingClientRect().bottom<=0),'Regression setup: only the card controls remain onscreen');
        await region.getByRole('button',{name:'Play '+title,exact:true}).click();
        await page.waitForFunction(()=>document.querySelector('section[aria-label="Creative Assets"] video')?.currentTime>.2);
        check(true,'Mobile Play works when the frame is above the viewport and controls remain visible');
        await region.getByRole('button',{name:'Pause '+title,exact:true}).click();
        await card.scrollIntoViewIfNeeded();
      }
      for(const boundary of ['hidden','offline','offscreen']){
        console.log(`Checking ${viewport.width} ${await region.getAttribute('aria-label')} ${boundary}`);
        await region.getByRole('button',{name:new RegExp('^(Play|Resume) '+title+'$')}).click();
        const video=region.locator('video[aria-label="Preview of Opening frame"]');
        await page.waitForFunction(label=>document.querySelector(`section[aria-label="${label}"] video[aria-label="Preview of Opening frame"]`)?.currentTime>.4,await region.getAttribute('aria-label'));
        const before=await video.evaluate(element=>element.currentTime);
        if(boundary==='hidden')await page.evaluate(()=>window.setPreviewVisibility('hidden'));
        else if(boundary==='offline')await page.context().setOffline(true);
        else await page.getByRole('region',{name:'Offscreen preview'}).scrollIntoViewIfNeeded();
        await video.waitFor({state:'detached'});
        check(await region.getByRole('button',{name:'Resume '+title,exact:true}).count()===1,`${viewport.width} ${await region.getAttribute('aria-label')} ${boundary} updates parent playback controls`);
        if(boundary==='hidden')await page.evaluate(()=>window.setPreviewVisibility('visible'));
        else if(boundary==='offline')await page.context().setOffline(false);
        await card.scrollIntoViewIfNeeded();await page.waitForTimeout(120);
        check(await region.locator('video').count()===0, 'Return must retain the still without autoplay or another idle decoder');
        await region.getByRole('button',{name:'Resume '+title,exact:true}).click();
        await page.waitForFunction(({label,time})=>document.querySelector(`section[aria-label="${label}"] video[aria-label="Preview of Opening frame"]`)?.currentTime>time,{label:await region.getAttribute('aria-label'),time:before});
        await region.getByRole('button',{name:'Pause '+title,exact:true}).click();
        await video.waitFor({state:'detached'});
        check(true, `${viewport.width} ${boundary} Resume retains playback time`);
      }
    }
    const changing=page.getByRole('region',{name:'Source change'});await changing.scrollIntoViewIfNeeded();
    await changing.getByRole('button',{name:'Play changing source',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('video[aria-label="Preview of Changing source"]')?.currentTime>.4);
    await changing.locator('video').evaluate(video=>video.dispatchEvent(new Event('error')));
    await changing.getByRole('button',{name:'Retry preview',exact:true}).waitFor();
    await page.evaluate(()=>{window.previewRetryLoads=0;document.addEventListener('loadeddata',event=>{if(event.target.getAttribute?.('aria-label')==='Preview of Changing source')window.previewRetryLoads++;},{capture:true});});
    await changing.getByRole('button',{name:'Retry preview',exact:true}).click();
    await page.waitForFunction(()=>window.previewRetryLoads>0);
    await changing.locator('video').waitFor({state:'detached'});
    check(await changing.locator('canvas:not([hidden])').count()===1,'Retry after a playback failure reloads even when a previous still exists');
    await changing.getByRole('button',{name:'Replace source',exact:true}).click();
    await page.waitForFunction(()=>{const canvas=document.querySelector('canvas[aria-label="Preview of Changing source"]:not([hidden])');return canvas&&canvas.width>canvas.height;});
    check(await changing.locator('video').count()===0,'A new source gets its own still and releases the previous decoder');
    await changing.getByRole('button',{name:'Play changing source',exact:true}).click();
    await page.waitForFunction(()=>{const video=document.querySelector('video[aria-label="Preview of Changing source"]');return video?.readyState>=2&&!video.paused;});
    check(await changing.locator('video').evaluate(v=>v.currentTime<.5&&v.currentSrc.includes('replacement')),'New source never inherits old playback time');
    await changing.locator('video').evaluate(video=>{video.currentTime=video.duration-.1;});
    await changing.locator('video').waitFor({state:'detached'});
    await changing.getByRole('button',{name:'Play changing source',exact:true}).click();
    await page.waitForFunction(()=>{const v=document.querySelector('video[aria-label="Preview of Changing source"]');return v?.readyState>=2&&!v.paused;});
    check(await changing.locator('video').evaluate(v=>v.currentTime<.5),'Ended preview restarts at the beginning');
    const unmount=page.getByRole('region',{name:'Unmount preview'});await unmount.scrollIntoViewIfNeeded();
    await unmount.getByRole('button',{name:'Play unmount fixture',exact:true}).click();
    await unmount.locator('video').waitFor();const detached=await unmount.locator('video').elementHandle();
    await unmount.getByRole('button',{name:'Remove preview',exact:true}).click();
    check(await detached.evaluate(v=>!v.isConnected&&!v.hasAttribute('src')&&v.paused),'Unmount clears source and pauses the detached decoder');
    const cross=page.getByRole('region',{name:'Cross origin'});await cross.scrollIntoViewIfNeeded();
    await page.waitForFunction(()=>!!document.querySelector('canvas[aria-label="Preview of Cross origin fixture"]:not([hidden])'));
    check(await cross.locator('video').count()===0,'Cross-origin source becomes a display-only still without a new CORS requirement');
    check(await cross.locator('canvas').evaluate(c=>{try{c.getContext('2d').getImageData(0,0,1,1);return false;}catch(e){return e.name==='SecurityError';}}),'Cross-origin still does not bypass canvas origin protections');
    const expanded=page.getByRole('region',{name:'Expanded preview'});await expanded.scrollIntoViewIfNeeded();
    await expanded.getByRole('button',{name:'Expand controlled preview',exact:true}).click();
    await expanded.getByRole('button',{name:'Play dialog video',exact:true}).click();
    await expanded.locator('video').waitFor();const dialogVideo=await expanded.locator('video').elementHandle();
    await expanded.getByRole('button',{name:'Close dialog',exact:true}).click();
    check(await dialogVideo.evaluate(v=>!v.hasAttribute('src')&&v.paused),'Closing a preview dialog releases its decoder');
    check(errors.length===0,`No page errors on ${viewport.width}: ${errors.join('; ')}`);
  }
  for(const viewport of [{width:1440,height:1200},{width:390,height:844}]) await measureLibrary(page,viewport);
  }
  writeFileSync(path.join(out,process.env.UGCPILOT_PREVIEW_BASELINE?'baseline-receipt.json':'optimized-receipt.json'), JSON.stringify({checks,errors,metrics,mediaRequests},null,2));
  console.log(JSON.stringify({checks, errors, screenshots:[path.join(out,"desktop.png"),path.join(out,"mobile.png"),path.join(out,"mobile-assets.png")]},null,2));
} catch (error) {
  for (const page of browser.contexts().flatMap(context => context.pages())) {
    console.log(await page.evaluate(() => ({scrollY, visible:document.visibilityState, online:navigator.onLine, videos:[...document.querySelectorAll('video')].map(v=>({title:v.getAttribute('aria-label'),time:v.currentTime,paused:v.paused,state:v.readyState,src:v.currentSrc,rect:v.getBoundingClientRect().toJSON()}))})));
    await page.screenshot({path:path.join(out,'failure.png')});
  }
  throw error;
} finally {
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
