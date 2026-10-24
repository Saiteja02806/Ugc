/* eslint-disable @typescript-eslint/no-require-imports -- Real-component browser verification. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const postcss = require("postcss");
const { webpack } = require("next/dist/compiled/webpack/webpack");
let playwright;
try { playwright = require("playwright"); }
catch { playwright = require(path.join(process.env.USERPROFILE, ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright")); }
const root = path.resolve(__dirname, ".."), out = path.join(root, process.argv.includes("--refresh") ? ".tmp/hook-card-browser-refresh" : ".tmp/hook-card-browser");
fs.mkdirSync(out, { recursive: true });
const file = (name, content) => fs.writeFileSync(path.join(out, name), content);
const release = JSON.parse(fs.readFileSync(path.join(root, "worker/src/lib/explore-hook-reference-release.json")));
const additions = JSON.parse(fs.readFileSync(path.join(root, "worker/src/lib/explore-hook-reference-addition-release.json")));
const newBatch = JSON.parse(fs.readFileSync(path.join(root, "worker/src/lib/explore-hook-reference-new-batch-release.json")));
const octoberBatch = JSON.parse(fs.readFileSync(path.join(root, "worker/src/lib/explore-hook-reference-oct23-release.json")));
const octoberRefresh = JSON.parse(fs.readFileSync(path.join(root, "worker/src/lib/explore-hook-reference-oct23-refresh-release.json")));
const latestBatch = process.argv.includes("--refresh") ? octoberRefresh : octoberBatch;
const cached = item => [item.videoStorageKey, item.previewStorageKey, item.posterStorageKey].every(key => fs.existsSync(path.join(root, ".tmp/explore-paired-references/media", path.basename(key))));
const sources = process.argv.includes("--oct23") ? [
  ...release.items.filter(item => !release.excludedReferenceIds.includes(item.id) && cached(item)).slice(0, 2),
  ...octoberBatch.items,
  ...(process.argv.includes("--refresh") ? octoberRefresh.items : []),
  additions.items.find(item => !item.sourceUrl),
] : process.argv.includes("--new-batch") ? [
  ...release.items.filter(item => !release.excludedReferenceIds.includes(item.id)).slice(0, 2),
  ...newBatch.items.filter(item => !newBatch.excludedReferenceIds.includes(item.id)),
  additions.items.find(item => !item.sourceUrl),
] : process.argv.includes("--all") ? [
  ...release.items.filter(item => !release.excludedReferenceIds.includes(item.id)),
  ...additions.items.filter(item => !additions.excludedReferenceIds.includes(item.id)),
  ...newBatch.items.filter(item => !newBatch.excludedReferenceIds.includes(item.id)),
] : [
  ...release.items.filter(item => !release.excludedReferenceIds.includes(item.id)).slice(0, 2),
  additions.items.find(item => item.sourcePlatform === "tiktok"),
  additions.items.find(item => !item.sourceUrl),
];
const refs = sources.map(item => ({ id: item.id, format: "hook", title: "Hook", durationSeconds: item.durationSeconds, instagramUrl: item.instagramUrl, sourceUrl: item.sourceUrl, sourcePlatform: item.sourcePlatform,
  ...(latestBatch.items.some(current => current.id === item.id) ? { isNew: true, uploadBatchSequence: process.argv.includes("--refresh") ? 2 : 1 } : {}),
  videoUrl: "/media/" + path.basename(item.videoStorageKey), previewVideoUrl: "/media/" + path.basename(item.previewStorageKey), posterUrl: "/media/" + path.basename(item.posterStorageKey), slides: [] }));
file("loader.cjs", `const ts=require(${JSON.stringify(require.resolve("typescript"))});module.exports=source=>ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText;`);
file("css-loader.cjs", `module.exports=source=>'export default '+JSON.stringify(Object.fromEntries([...source.matchAll(/\\.([a-zA-Z][a-zA-Z0-9_-]*)/g)].map(m=>[m[1],m[1]])))+';';`);
const workspace = fs.readFileSync(path.join(root, "components/explore/recreate-workspace.tsx"), "utf8");
// Compile the production card and dialog unchanged, excluding unrelated auth/network workspace code.
file("card.tsx", `import {useRef,useState} from 'react';import {ArrowLeft,ArrowRight,Check,Layers3,RotateCcw} from 'lucide-react';
import {Button} from '@/components/ui/button';import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {SocialPlatformIcon} from '@/components/social/platform-icon';import {getReferenceSource,referenceSourceLabel} from '@/lib/explore/reference-source-link';import {cn} from '@/lib/utils';
import Link from 'next/link';import {ReferenceVideoPlayer} from '@/components/explore/reference-video-player';
import {useCoverPlayback} from '@/components/explore/use-cover-playback';
import studio from '@/components/explore/workflow-studio.module.css';import type {RecreateReference} from '@/lib/explore/recreate-types';
import {canOpenReferenceSource} from '@/lib/explore/reference-source-access';
const useBillingSubscription=()=>{const free=new URLSearchParams(location.search).has('free');return {isSuccess:true,isFetching:false,isError:false,data:{isActive:!free,planKey:free?'free':'starter',freeGenerationCredits:{granted:5,remaining:0}}}};
${workspace.slice(workspace.indexOf("export function ReferenceCard("), workspace.indexOf("export function EmptyReferences("))}`);
const octoberSlideshows = JSON.parse(fs.readFileSync(path.join(root, "lib/explore/slideshow-reference-oct23.json"))).items.map(item => ({ ...item, isNew: true, uploadBatchSequence: 1, posterUrl: "/media/" + item.posterFile, slides: item.slides.map(slide => ({ ...slide, url: "/media/" + slide.file })) }));
file("entry.tsx", `import {createRoot} from 'react-dom/client';import {useState} from 'react';import {ReferenceCard,ReferencePreviewDialog} from './card';
import {orderReferenceGallery} from '@/lib/explore/recreate-types';
const wall=new URLSearchParams(location.search).has('wall');
const slideshows=new URLSearchParams(location.search).has('slideshow');
const refs=orderReferenceGallery(slideshows?${JSON.stringify(octoberSlideshows)}:${JSON.stringify(refs)}.map(item=>wall?{...item,format:'wall_text',title:'Wall of text'}:item),slideshows?'slideshow':wall?'wall_text':'hook');
window.cardSelections=0;window.cardPreviews=0;
function App(){const [selected,select]=useState(null),[preview,show]=useState(null);return <main style={{maxWidth:1000,margin:'24px auto',padding:16}}><h1>References</h1><p>Watch an example, then choose Recreate.</p><div className='fixture-grid'>{refs.map(reference=><ReferenceCard key={reference.id} reference={reference} canOpenSource compact showActionLabel overlayActions isSelected={selected===reference.id} onRecreate={()=>{window.cardSelections++;select(reference.id)}} onPreview={()=>{window.cardPreviews++;show(reference)}}/>)}</div><ReferencePreviewDialog key={preview?.id??'empty'} reference={preview} open={!!preview} onOpenChange={open=>{if(!open)show(null)}}/></main>};createRoot(document.getElementById('root')).render(<App/>);`);
async function main() {
  console.log("Compiling the production reference card fixture.");
  const globals = fs.readFileSync(path.join(root, "app/globals.css"), "utf8").replace('@import "tailwindcss";', '@import "tailwindcss" source(none);')
    + '\n@source "../.tmp/hook-card-browser/card.tsx";\n@source "../.tmp/hook-card-browser/entry.tsx";\n@source "../components/explore/reference-video-player.tsx";\n@source "../components/explore/clip-preview-controls.tsx";\n';
  const css = await postcss([require("@tailwindcss/postcss")()]).process(globals + '\n@source "../components/ui/dialog.tsx";\n@source "../components/ui/button.tsx";\n', { from: path.join(root, "app/globals.css") });
  file("style.css", css.css + "\n" + fs.readFileSync(path.join(root, "components/explore/workflow-studio.module.css"), "utf8") + "\n.fixture-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px}h1,p{margin-bottom:16px}@media(max-width:600px){.fixture-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}}");
  fs.appendFileSync(path.join(out, "style.css"), "\n" + fs.readFileSync(path.join(root, "components/explore/clip-preview-controls.module.css"), "utf8").replaceAll(":global(section)", "section"));
  await new Promise((resolve, reject) => {
    const compiler = webpack({ mode: "development", devtool: false, context: root, entry: path.join(out, "entry.tsx"), output: { path: out, filename: "bundle.js" },
      plugins: [new webpack.DefinePlugin({ "process.env": JSON.stringify({ NODE_ENV: "development" }) })],
      resolve: { extensions: [".tsx", ".ts", ".js"], alias: { "@": root } }, module: { rules: [{ test: /\.tsx?$/, use: path.join(out, "loader.cjs") }, { test: /\.css$/, use: path.join(out, "css-loader.cjs") }] } });
    compiler.run((error, stats) => compiler.close(() => error || stats.hasErrors() ? reject(error || new Error(stats.toString({ all: false, errors: true }))) : resolve()));
  });
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://fixture.test");
    if (url.pathname.startsWith("/media/")) {
      const name = path.basename(url.pathname); if (!/^[a-f0-9]{64}\.(mp4|webp|png|jpg)$/.test(name)) { res.writeHead(404); res.end(); return; }
      const octoberFile = path.join(root, ".tmp/explore-upload-batch-20261023/media", name);
      const refreshFile = path.join(root, ".tmp/hook-folder-refresh-20261023/media", name);
      const bytes = fs.readFileSync(fs.existsSync(refreshFile) ? refreshFile : fs.existsSync(octoberFile) ? octoberFile : path.join(root, ".tmp/explore-paired-references/media", name));
      const range = req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
      if (range) {
        const start = Number(range[1]), end = Math.min(range[2] ? Number(range[2]) : bytes.length - 1, bytes.length - 1);
        res.writeHead(206, { "Content-Type": "video/mp4", "Accept-Ranges": "bytes", "Content-Range": `bytes ${start}-${end}/${bytes.length}`, "Content-Length": end - start + 1 }); res.end(bytes.subarray(start, end + 1)); return;
      }
      res.writeHead(200, { "Content-Type": name.endsWith(".mp4") ? "video/mp4" : name.endsWith(".png") ? "image/png" : name.endsWith(".jpg") ? "image/jpeg" : "image/webp", "Accept-Ranges": "bytes", "Content-Length": bytes.length }); res.end(bytes); return;
    }
    if (url.pathname === "/bundle.js" || url.pathname === "/style.css") { res.writeHead(200, { "Content-Type": url.pathname.endsWith(".js") ? "text/javascript" : "text/css" }); res.end(fs.readFileSync(path.join(out, url.pathname.slice(1)))); return; }
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }); res.end('<!doctype html><html class="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>');
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  console.log("Reference card fixture is ready; launching browser.");
  let browser, page;
  try {
    browser = await playwright.chromium.launch({ headless: true, ...(process.platform === "win32" ? { channel: "msedge" } : {}) });
    page = await browser.newPage({ viewport: { width: 1100, height: 900 } }); const errors = [];
    const cardFor = reference => page.locator(`article[data-reference-id=${JSON.stringify(reference.id)}]`);
    console.log("Browser started; checking card interactions.");
    page.on("pageerror", error => { errors.push(error.message); console.error("Page error:", error.message); });
    await page.context().route("https://www.instagram.com/**", route => route.fulfill({ status: 200, contentType: "text/html", body: "<title>Original post fixture</title>" }));
    await page.context().route("https://www.tiktok.com/**", route => route.fulfill({ status: 200, contentType: "text/html", body: "<title>Original post fixture</title>" }));
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    async function verifyNewBadge() {
      if (!process.argv.includes("--oct23")) return;
      assert.equal(await page.locator("[data-reference-new]").count(), latestBatch.items.length);
      assert.equal(await page.locator("article").first().getAttribute("data-reference-id"), latestBatch.items[0].id);
      for (const reference of refs.filter(reference => reference.isNew)) {
      const card = cardFor(reference);
      assert.equal(await card.locator("[data-reference-new]").textContent(), "New");
      assert.equal(await card.locator("[data-reference-new]").evaluate(badge => {
        const rect = badge.getBoundingClientRect();
        const media = badge.closest("article").querySelector("button[aria-label^='Preview']").getBoundingClientRect();
        return getComputedStyle(badge).pointerEvents === "none" && rect.left >= media.left && rect.right <= media.right && rect.top >= media.top && rect.bottom < media.bottom - 32;
      }), true, "New is visible inside the media without blocking preview or bottom actions");
      }
    }
    await page.goto(`${baseUrl}?free=1`);
    const freeSource = cardFor(refs[0]).getByRole("button", { name: /View original on Instagram.*Upgrade to Pro/ });
    await freeSource.waitFor();
    assert.equal(await cardFor(refs[0]).getByRole("link").count(), 0);
    await freeSource.click();
    await page.getByRole("dialog").getByRole("heading", { name: "Upgrade to Pro" }).waitFor();
    assert.equal(await page.getByRole("dialog").locator('a[href="/pricing"]').textContent(), "Upgrade to Pro");
    assert.equal(page.context().pages().length, 1);
    assert.deepEqual(await page.evaluate(() => [window.cardSelections, window.cardPreviews]), [0, 0]);
    await page.screenshot({ path: path.join(out, "free-upgrade.png") });
    await page.keyboard.press("Escape"); await freeSource.focus(); await page.keyboard.press("Enter");
    await page.getByRole("dialog").getByRole("heading", { name: "Upgrade to Pro" }).waitFor();
    await page.keyboard.press("Escape");
    await page.goto(baseUrl);
    const link = cardFor(refs[0]).getByRole("link", { name: "View original on Instagram: Hook", exact: true });
    await link.waitFor(); assert.equal(await link.getAttribute("href"), refs[0].instagramUrl); assert.equal(await link.getAttribute("target"), "_blank");
    assert.equal(await link.getAttribute("title"), "View original on Instagram"); assert.match(await link.getAttribute("rel"), /noopener/);
    const popup = page.waitForEvent("popup"); await link.click(); const opened = await popup; await opened.waitForLoadState(); assert.equal(opened.url(), refs[0].instagramUrl); await opened.close();
    const tiktokRef = refs.find(item => item.sourcePlatform === "tiktok");
    const tiktokLink = cardFor(tiktokRef).getByRole("link", { name: `View original on TikTok: ${tiktokRef.title}`, exact: true });
    await tiktokLink.waitFor(); assert.equal(await tiktokLink.getAttribute("href"), tiktokRef.sourceUrl); assert.equal(await tiktokLink.getAttribute("title"), "View original on TikTok"); assert.equal(await tiktokLink.getAttribute("target"), "_blank");
    assert.equal(await tiktokLink.locator("svg").evaluate(svg => getComputedStyle(svg).fill), await tiktokLink.locator("svg").evaluate(svg => getComputedStyle(svg).color), "TikTok icon inherits its link color on dark cards");
    async function verifyOverlayLayout() {
      const layout = await page.locator("article").evaluateAll(cards => cards.map(card => {
        const media = card.querySelector("button[aria-label^='Preview']").getBoundingClientRect();
        const action = card.querySelector("[data-reference-recreate-overlay]");
        const recreate = action.getBoundingClientRect(), actionStyle = getComputedStyle(action);
        const source = card.querySelector("[data-reference-source-overlay]");
        const link = card.querySelector("[data-reference-source-overlay]")?.getBoundingClientRect();
        return { inside: recreate.left >= media.left && recreate.right <= media.right && recreate.bottom <= media.bottom,
          atBottomRight: Math.abs(media.right - recreate.right - 12) < 2 && Math.abs(media.bottom - recreate.bottom - 12) < 2,
          sourceAtBottomLeft: !link || Math.abs(link.left - media.left - 12) < 2 && Math.abs(media.bottom - link.bottom - 12) < 2,
          overlap: !!link && link.right > recreate.left, nestedControls: !!card.querySelector("button button, button a"),
          visibleHookTitle: [...card.querySelectorAll("p")].some(node => /^Hook \d+$/.test(node.textContent.trim())),
          iconOnly: !action.textContent.trim(), compactAction: recreate.width === 32 && recreate.height === 32,
          transparentControls: actionStyle.backgroundColor === "rgba(0, 0, 0, 0)" && (!source || getComputedStyle(source).backgroundColor === "rgba(0, 0, 0, 0)"),
          roundedFocusTarget: parseFloat(actionStyle.borderRadius) === 8 };
      }));
      for (const card of layout) {
        assert.equal(card.inside, true); assert.equal(card.atBottomRight, true); assert.equal(card.sourceAtBottomLeft, true);
        assert.equal(card.overlap, false); assert.equal(card.nestedControls, false); assert.equal(card.visibleHookTitle, false);
        assert.equal(card.iconOnly, true); assert.equal(card.compactAction, true); assert.equal(card.transparentControls, true); assert.equal(card.roundedFocusTarget, true);
      }
    }
    await verifyOverlayLayout();
    await verifyNewBadge();
    const unlinked = refs.find(item => !item.sourceUrl && !item.instagramUrl);
    assert.ok(unlinked);
    assert.equal(await cardFor(unlinked).getByRole("link").count(), 0);
    assert.deepEqual(await page.evaluate(() => [window.cardSelections, window.cardPreviews]), [0, 0]);
    if (process.argv.includes("--verify-all-source-clicks")) {
      const clicks = [];
      for (const reference of refs) {
        const url = reference.sourceUrl ?? reference.instagramUrl;
        if (!url) continue;
        const platform = reference.sourcePlatform === "tiktok" ? "TikTok" : "Instagram";
        const icon = cardFor(reference).getByRole("link", { name: `View original on ${platform}: ${reference.title}`, exact: true });
        const popupEvent = page.waitForEvent("popup"); await icon.click(); const popup = await popupEvent;
        await popup.waitForLoadState(); assert.equal(popup.url(), url, reference.id); await popup.close();
        assert.deepEqual(await page.evaluate(() => [window.cardSelections, window.cardPreviews]), [0, 0], "Source links cannot select or preview a reference");
        clicks.push({ referenceId: reference.id, platform, destination: url });
      }
      file("source-clicks.json", JSON.stringify({ checked: clicks.length, clicks }, null, 2));
      console.log(JSON.stringify({ sourceIconClicksVerified: clicks.length }));
    }
    await cardFor(refs[0]).getByRole("button", { name: "Recreate Hook", exact: true }).click(); assert.equal(await page.evaluate(() => window.cardSelections), 1);
    await page.screenshot({ path: path.join(out, "desktop.png"), fullPage: !process.argv.includes("--all") });
    await cardFor(refs[0]).getByRole("button", { name: "Preview Hook", exact: true }).click();
    const preview = page.locator('[role="dialog"] video'); await preview.waitFor(); assert.equal(await preview.getAttribute("src"), refs[0].previewVideoUrl);
    assert.equal(await preview.evaluate(video => video.controls), false);
    assert.match(await preview.getAttribute("controlslist"), /nodownload/);
    assert.equal(await preview.evaluate(video => video.disablePictureInPicture && video.disableRemotePlayback), true);
    assert.equal(await preview.evaluate(video => video.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }))), false);
    await page.getByRole("button", { name: "Play preview", exact: true }).click();
    await page.waitForFunction(() => document.querySelector('[role="dialog"] video')?.currentTime > .2);
    await page.getByRole("button", { name: "Pause preview", exact: true }).click();
    assert.equal(await preview.evaluate(video => video.paused), true);
    await page.getByRole("slider", { name: "Preview playback position" }).press("End");
    await page.waitForFunction(() => { const video = document.querySelector('[role="dialog"] video'); return video && Math.abs(video.currentTime - video.duration) < .2; });
    await page.getByRole("button", { name: "Mute preview", exact: true }).click();
    assert.equal(await preview.evaluate(video => video.muted), true);
    await page.getByRole("button", { name: "Unmute preview", exact: true }).click();
    assert.equal(await preview.evaluate(video => video.muted), false);
    await page.getByRole("button", { name: "Fullscreen preview", exact: true }).click();
    await page.waitForFunction(() => document.fullscreenElement?.getAttribute("aria-label") === "Reference video playback");
    assert.equal(await preview.evaluate(video => video.controls), false);
    await page.evaluate(() => document.exitFullscreen());
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.screenshot({ path: path.join(out, "custom-reference-preview.png") });
    await page.keyboard.press("Escape");
    assert.equal(await page.locator('[role="dialog"] video').count(), 0);
    const playback = [];
    if (process.argv.includes("--all") || process.argv.includes("--oct23")) {
      for (const reference of refs) {
        const card = cardFor(reference);
        const sourceUrl = reference.sourceUrl ?? reference.instagramUrl;
        assert.equal(await card.getByRole("link").count(), sourceUrl ? 1 : 0, `${reference.title} source visibility`);
        if (sourceUrl) assert.equal(await card.getByRole("link").getAttribute("href"), sourceUrl);
        await card.getByRole("button", { name: `Recreate ${reference.title}`, exact: true }).click();
        const recreateAction = card.getByRole("button", { name: `Recreate ${reference.title}`, exact: true });
        assert.equal(await recreateAction.getAttribute("aria-pressed"), reference.format === "hook" ? null : "true");
        if (reference.format === "hook") assert.equal(await recreateAction.locator("svg.lucide-rotate-ccw").count(), 1);
        await card.getByRole("button", { name: `Preview ${reference.title}`, exact: true }).click();
        const video = page.locator('[role="dialog"] video');
        await video.waitFor(); assert.equal(await video.getAttribute("src"), reference.previewVideoUrl);
        await video.evaluate(async element => { element.playbackRate = 8; await element.play(); });
        await page.waitForFunction(() => document.querySelector('[role="dialog"] video')?.ended, null, { timeout: 20000 });
        let result = await video.evaluate(element => ({ duration: element.duration, ended: element.ended, error: element.error?.message ?? null, muted: element.muted, width: element.videoWidth, height: element.videoHeight }));
        if (!(result.width > 0 && result.height > 0)) {
          // Retry at ordinary speed to distinguish a codec failure from an
          // accelerated-playback limitation on this browser/device.
          await video.evaluate(async element => { element.currentTime = 0; element.playbackRate = 1; await element.play(); });
          await page.waitForFunction(() => document.querySelector('[role="dialog"] video')?.ended, null, { timeout: 20000 });
          result = await video.evaluate(element => ({ duration: element.duration, ended: element.ended, error: element.error?.message ?? null, muted: element.muted, width: element.videoWidth, height: element.videoHeight }));
          await page.screenshot({ path: path.join(out, `failed-${reference.title.replace(/ /g, "-")}.png`) });
        }
        assert.equal(result.error, null, reference.title); assert.equal(result.ended, true, reference.title);
        assert.equal(result.muted, false, reference.title);
        assert.ok(Math.abs(result.duration - reference.durationSeconds) < .2, reference.title);
        playback.push({ id: reference.id, title: reference.title, videoDecoded: result.width > 0 && result.height > 0, ...result });
        await page.keyboard.press("Escape");
      }
      file("all-playback.json", JSON.stringify({ checked: playback.length, failed: playback.filter(item => !item.videoDecoded).map(item => item.title), playback }, null, 2));
      await page.evaluate(() => scrollTo(0, 0));
    }
    await page.setViewportSize({ width: 390, height: 844 }); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await verifyNewBadge();
    await verifyOverlayLayout();
    await page.screenshot({ path: path.join(out, "mobile.png"), fullPage: !process.argv.includes("--all") });
    await link.focus(); assert.equal(await link.evaluate(node => node === document.activeElement), true);
    await page.goto(`${baseUrl}?wall=1&free=1`);
    assert.equal(await page.locator("[data-reference-source-overlay]").count(), 0);
    await page.getByRole("button", { name: "Preview Wall of text", exact: true }).first().click();
    const wallVideo = page.locator('[role="dialog"] video'); await wallVideo.waitFor();
    assert.equal(await wallVideo.evaluate(video => video.controls), false);
    await page.getByRole("button", { name: "Play preview", exact: true }).click();
    await page.waitForFunction(() => document.querySelector('[role="dialog"] video')?.currentTime > .2);
    assert.equal(await page.getByRole("group", { name: "Clip preview playback" }).evaluate(node => { const rect=node.getBoundingClientRect(); return rect.left>=0 && rect.right<=innerWidth && rect.bottom<=innerHeight; }), true);
    await page.screenshot({ path: path.join(out, "wall-preview-mobile.png") });
    await page.keyboard.press("Escape");
    if (process.argv.includes("--oct23")) {
      await page.setViewportSize({ width: 1366, height: 768 });
      await page.goto(`${baseUrl}?slideshow=1`);
      assert.equal(await page.locator("[data-reference-new]").count(), 4);
      for (const reference of octoberSlideshows) {
        const card = cardFor(reference);
        await card.getByRole("button", { name: `Preview ${reference.title}`, exact: true }).waitFor();
        assert.equal(await card.locator("[data-reference-new]").textContent(), "New");
      }
      await page.waitForFunction(() => [...document.querySelectorAll("article img")].every(img => img.complete && img.naturalWidth > 0));
      await page.screenshot({ path: path.join(out, "oct23-slideshows-desktop.png"), fullPage: true });
      await page.setViewportSize({ width: 390, height: 844 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.screenshot({ path: path.join(out, "oct23-slideshows-mobile.png"), fullPage: true });
    }
    assert.deepEqual(errors, []); console.log(JSON.stringify({ sourceLink: "passed", recreateUnaffected: true, soundtrackPreview: "passed", fullyPlayed: playback.length, failedVideo: playback.filter(item => !item.videoDecoded).map(item => item.title), desktopAndMobile: "passed", output: out }));
    assert.deepEqual(playback.filter(item => !item.videoDecoded).map(item => item.title), [], "every preview must decode visible video pictures");
  } catch (error) {
    if (page) { await page.screenshot({ path: path.join(out, "failure.png") }); console.error(await page.locator('[role="dialog"], [data-base-ui-inert], [aria-label="Clip preview playback"]').evaluateAll(nodes => nodes.map(node => ({ html: node.outerHTML.slice(0, 400), rect: node.getBoundingClientRect().toJSON(), z: getComputedStyle(node).zIndex, position: getComputedStyle(node).position })))); }
    throw error;
  } finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
