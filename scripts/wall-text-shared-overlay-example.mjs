// Local, non-deploying end-to-end example. Build worker first.
// node scripts/wall-text-shared-overlay-example.mjs <inputs.json> <clean-source.mp4>
import assert from "node:assert/strict";
import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { spawnSync } from "node:child_process";
import ffmpeg from "ffmpeg-static";
import sharp from "sharp";
import { prepareWallTextOverlayAsset, buildWallTextVideoArgs } from "../worker/dist/lib/render-engine.js";
import { validateWallTextOverlayAsset, wallTextOverlayPngHash } from "../worker/dist/lib/wall-text-overlay-asset.js";

const [inputPath, sourcePath] = process.argv.slice(2);
if (!inputPath || !sourcePath) throw new Error("Supply parity inputs.json and a clean local source video.");
const fixture = JSON.parse(await readFile(inputPath, "utf8"));
const input = { text: fixture.variants.find(v => v.key === "b").content,
  textBox: fixture.layout.textBox, placement: fixture.layout.placement,
  safeArea: fixture.layout.safeArea, textColor: "#FFFFFF" };
const directory = resolve("output/wall-text-shared-overlay");
await mkdir(directory, { recursive: true });
const started = performance.now();
const asset = await prepareWallTextOverlayAsset(input);
const prepareMs = performance.now() - started;
const { png, ...manifest } = asset;
const overlayName = `${asset.sha256}.png`;
const overlayPath = join(directory, overlayName);
await writeFile(overlayPath, png);
await writeFile(join(directory, "manifest.json"), JSON.stringify(manifest, null, 2));
// Export reads the persisted asset, exactly as preview does. No second text render.
await validateWallTextOverlayAsset({ ...asset, png: await readFile(overlayPath) }, asset.inputHash);
await copyFile(sourcePath, join(directory, "source.mp4"));
function run(args) {
  const result = spawnSync(ffmpeg, ["-hide_banner", "-loglevel", "error", ...args], { encoding: "utf8", windowsHide: true });
  if (result.error || result.status !== 0) throw new Error(result.error?.message || result.stderr);
}
const audioPath = join(directory, "silence.wav");
run(["-y", "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo", "-t", "6", audioPath]);
const outputPath = join(directory, "export.mp4");
const exportStart = performance.now();
run(buildWallTextVideoArgs({ inputPath: join(directory, "source.mp4"), overlayPath, audioPath, outputPath,
  payload: { durationSeconds: 6, audio: { assetDurationSeconds: 6, cueStartSeconds: 0,
    fadeOutSeconds: 0, fitMode: "exact" } } }));
const exportMs = performance.now() - exportStart;
const frameHashes = [];
for (const second of [1, 3, 5]) {
  const framePath = join(directory, `export-${second}s.png`);
  run(["-y", "-ss", String(second), "-i", outputPath, "-frames:v", "1", framePath]);
  frameHashes.push(wallTextOverlayPngHash(await readFile(framePath)));
}
assert.equal(new Set(frameHashes).size, 3, "Export must retain a moving background.");
// Equal-size static reference: the original source frame plus the same PNG.
run(["-y", "-ss", "3", "-i", join(directory, "source.mp4"), "-vf",
  "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1", "-frames:v", "1", join(directory, "source-3s.png")]);
await sharp(join(directory, "source-3s.png")).composite([{ input: png }]).png().toFile(join(directory, "preview-3s.png"));
const report = { prepareMs, exportMs, pngBytes: png.length, sha256: asset.sha256,
  sameSavedPngForPreviewAndExport: true, movingBackgroundVerified: true,
  productionValidated: false, widths: [230, 277, 280, 322] };
await writeFile(join(directory, "report.json"), JSON.stringify(report, null, 2));
await writeFile(join(directory, "index.html"), `<!doctype html><meta charset="utf-8"><title>Shared text asset review</title>
<style>body{background:#10161d;color:#eef3fa;font:16px Arial;padding:24px}h1{font-size:24px}button,select{padding:8px}section{display:flex;gap:24px;flex-wrap:wrap}.card{position:relative;width:var(--width,277px);aspect-ratio:9/16;overflow:hidden;border-radius:14px;background:#222}.card video,.card img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}.card img{object-fit:contain;pointer-events:none}.loading{visibility:hidden}p{max-width:850px;line-height:1.5}</style>
<h1>One text image, preview and export</h1><p>Local example. Both use the same saved PNG. Preview does not draw browser text. Export uses the production FFmpeg composition settings. Compression can slightly soften exported edges.</p>
<label>Card width <select id="width"><option>230</option><option selected>277</option><option>280</option><option>322</option></select> CSS px</label>
<button id="play" disabled>Play both</button><button id="still" disabled>Compare at 3 seconds</button><p id="status" role="status">Loading and validating text…</p>
<section><div><h2>Preview</h2><div class="card loading" id="preview"><video id="source" src="source.mp4" muted playsinline preload="auto"></video><img id="overlay" alt="${input.text.fullText.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;")}"></div></div>
<div><h2>Export</h2><div class="card loading" id="exportcard"><video id="exported" src="export.mp4" muted playsinline preload="auto"></video></div></div></section>
<script type="module">
const videos=[document.querySelector('#source'),document.querySelector('#exported')];
const status=document.querySelector('#status'),overlay=document.querySelector('#overlay');
document.querySelector('#width').onchange=e=>document.documentElement.style.setProperty('--width',e.target.value+'px');
try {
 const r=await fetch('${overlayName}');if(!r.ok)throw Error('Text asset could not load');const bytes=await r.arrayBuffer();
 const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
 if(hash!=='${asset.sha256}')throw Error('Text version mismatch');
 overlay.src=URL.createObjectURL(new Blob([bytes],{type:'image/png'}));await overlay.decode();
 if(overlay.naturalWidth!==1080||overlay.naturalHeight!==1920)throw Error('Invalid text dimensions');
 await Promise.all(videos.map(v=>new Promise((ok,fail)=>{
   const timeout=setTimeout(()=>finish(Error('Video frame did not load within 15 seconds')),15000);
   function finish(error){clearTimeout(timeout);v.removeEventListener('loadeddata',check);v.removeEventListener('error',failed);error?fail(error):ok();}
   function check(){if(v.readyState>=2&&v.videoWidth>0&&v.videoHeight>0)finish();}
   function failed(){finish(Error('Video failed to load'));}
   v.addEventListener('loadeddata',check);v.addEventListener('error',failed);check();
 })));
 document.querySelectorAll('.loading').forEach(e=>e.classList.remove('loading'));
 document.querySelectorAll('button').forEach(e=>e.disabled=false);
 status.textContent='Ready — text image verified and video frames loaded.';
 document.querySelector('#play').onclick=async()=>{videos.forEach(v=>{v.currentTime=0});await Promise.all(videos.map(v=>v.play()));};
 document.querySelector('#still').onclick=()=>videos.forEach(v=>{v.pause();v.currentTime=3});
 videos.forEach(v=>v.addEventListener('timeupdate',()=>{if(v.currentTime>=5.9)videos.forEach(x=>x.pause())}));
}catch(e){status.textContent=e.message+'. Reload to retry. No substitute text is shown.';}
</script>`);
console.log(JSON.stringify({ directory, ...report }, null, 2));
