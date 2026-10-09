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
const { chromium } = require(process.env.UGCPILOT_PLAYWRIGHT_PATH ?? "playwright");
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
  </main>;
}
createRoot(document.getElementById("root")).render(<React.StrictMode><Preview /></React.StrictMode>);
`);
writeFileSync(path.join(out, "tsx-loader.cjs"), `const ts = require(${JSON.stringify(require.resolve("typescript"))}); module.exports = function(source) { return ts.transpileModule(source, {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText; };`);
const compiled = require("next/dist/compiled/webpack/webpack");
await new Promise((resolve, reject) => compiled.webpack({
  mode: "development", target: "web", devtool: false,
  entry: path.join(out, "entry.tsx"),
  output: { path: out, filename: "preview.js" },
  resolve: { extensions: [".tsx", ".ts", ".js"], alias: { "@": root } },
  module: { rules: [{ test: /\.tsx?$/, use: path.join(out, "tsx-loader.cjs"), exclude: /node_modules/ }] },
}, (error, stats) => error || stats.hasErrors() ? reject(error ?? Error(stats.toString({all:false,errors:true}))) : resolve()));
const css = await postcss([tailwind({ base: root })]).process(readFileSync(path.join(root, "app/globals.css"), "utf8"), { from: path.join(root, "app/globals.css") });
writeFileSync(path.join(out, "preview.css"), css.css);
const html = '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/preview.css"></head><body><div id="root"></div><script src="/preview.js"></script></body></html>';
let retryRequests = 0;
const server = createServer((request, response) => {
  const url = new URL(request.url, "http://localhost");
  if (url.pathname === "/") { response.setHeader("Content-Type", "text/html"); response.end(html); return; }
  let name = path.basename(url.pathname);
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
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(origin);
  await page.waitForFunction(() => [...document.querySelectorAll('section[aria-label="Content Library"] video')].length === 4 && [...document.querySelectorAll('section[aria-label="Content Library"] video')].every(video => video.readyState >= 2 && getComputedStyle(video).opacity === "1"));
  const demos = page.getByRole("region", { name:"Content Library" });
  const assets = page.getByRole("region", { name:"Creative Assets" });
  check(await demos.locator("video").evaluateAll(videos => videos.every(v => v.paused)), "Preview frames must never autoplay");
  check(await demos.locator("video").evaluateAll(videos => videos.every(v => v.currentTime > 0 && v.currentTime <= 0.11)), "Opening frames must decode before a click");
  check(await demos.locator("video").evaluateAll(videos => videos.every(v => { const canvas = document.createElement("canvas"); canvas.width=16; canvas.height=16; const context=canvas.getContext("2d"); context.drawImage(v,0,0,16,16); return [...context.getImageData(0,0,16,16).data].some((value,i)=>i%4!==3 && value>50); })), "Decoded frames must contain visible video pixels");
  check(await demos.getByRole("img", {name:"Preview of Saved poster"}).count() === 1, "Existing posters must display without loading a video");
  check(await page.getByRole("region", {name:"Offscreen preview"}).locator("video").count() === 0, "Offscreen videos must not preload");
  check(await demos.locator("article").evaluateAll(cards => cards.every(card => card.getBoundingClientRect().width < 270)), "Desktop cards must stay compact");
  check(await demos.locator("article").evaluateAll(cards => cards.every(card => { const frame=card.querySelector("[data-video-preview]"); const video=frame.querySelector("video"); return !video || Math.abs(frame.clientWidth/frame.clientHeight - video.videoWidth/video.videoHeight)<0.02; })), "Cards must match source proportions without side bars or cropping");
  await demos.getByRole("button", {name:"Play Opening frame",exact:true}).click();
  await page.waitForFunction(() => document.querySelector('video[aria-label="Preview of Opening frame"]').currentTime > 0.5);
  await demos.getByRole("button", {name:"Pause Opening frame",exact:true}).click();
  const paused = await demos.locator('video[aria-label="Preview of Opening frame"]').evaluate(v => v.currentTime);
  await demos.getByRole("button", {name:"Resume Opening frame",exact:true}).click();
  await page.waitForTimeout(200);
  check(await demos.locator('video[aria-label="Preview of Opening frame"]').evaluate((v,time)=>v.currentTime > time, paused), "Resuming must retain the playback position");
  await demos.getByRole("button", {name:"Play Screen recording",exact:true}).click();
  await page.waitForTimeout(100);
  check(await demos.locator("video").evaluateAll(videos => videos.filter(v=>!v.paused).length === 1), "Demo playback must retain its single-active-video behavior");
  await demos.getByRole("button", {name:"Pause Screen recording",exact:true}).click();
  await assets.scrollIntoViewIfNeeded();
  await page.waitForFunction(()=>{const video=document.querySelector('video[aria-label="Preview of Edited output"]'); return video?.readyState>=2 && getComputedStyle(video).opacity==="1";});
  check(await assets.locator('video[aria-label="Preview of Edited output"]').evaluate(video=>{const frame=video.parentElement; return video.currentSrc.includes("landscape.mp4?edited") && Math.abs(frame.clientWidth/frame.clientHeight - 16/9)<0.02;}),"Edited assets must use the current output frame and proportions, not the original poster or dimensions");
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
  await page.waitForFunction(()=>{const video=document.querySelector('video[aria-label="Preview of Retry fixture"]'); return video?.readyState>=2 && getComputedStyle(video).opacity==="1";});
  check(await failed.locator("video").evaluate(video=>video.paused && getComputedStyle(video).opacity==="1"),"Retry must restore a paused opening frame");
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
  console.log(JSON.stringify({checks, errors, screenshots:[path.join(out,"desktop.png"),path.join(out,"mobile.png"),path.join(out,"mobile-assets.png")]},null,2));
} finally {
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
