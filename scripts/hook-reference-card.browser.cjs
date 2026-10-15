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
const root = path.resolve(__dirname, ".."), out = path.join(root, ".tmp/hook-card-browser");
fs.mkdirSync(out, { recursive: true });
const file = (name, content) => fs.writeFileSync(path.join(out, name), content);
const release = JSON.parse(fs.readFileSync(path.join(root, "worker/src/lib/explore-hook-reference-release.json")));
const additions = JSON.parse(fs.readFileSync(path.join(root, "worker/src/lib/explore-hook-reference-addition-release.json")));
const sources = process.argv.includes("--all") ? [
  ...release.items.filter(item => !release.excludedReferenceIds.includes(item.id)),
  ...additions.items.filter(item => !additions.excludedReferenceIds.includes(item.id)),
] : [
  ...release.items.filter(item => !release.excludedReferenceIds.includes(item.id)).slice(0, 2),
  additions.items.find(item => item.sourcePlatform === "tiktok"),
];
const refs = sources.map((item, i) => ({ id: item.id, format: "hook", title: `Hook ${String(i + 1).padStart(2, "0")}`, durationSeconds: item.durationSeconds, instagramUrl: item.instagramUrl, sourceUrl: item.sourceUrl, sourcePlatform: item.sourcePlatform,
  videoUrl: "/media/" + path.basename(item.videoStorageKey), previewVideoUrl: "/media/" + path.basename(item.previewStorageKey), posterUrl: "/media/" + path.basename(item.posterStorageKey), slides: [] }));
file("loader.cjs", `const ts=require(${JSON.stringify(require.resolve("typescript"))});module.exports=source=>ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText;`);
file("css-loader.cjs", `module.exports=source=>'export default '+JSON.stringify(Object.fromEntries([...source.matchAll(/\\.([a-zA-Z][a-zA-Z0-9_-]*)/g)].map(m=>[m[1],m[1]])))+';';`);
const workspace = fs.readFileSync(path.join(root, "components/explore/recreate-workspace.tsx"), "utf8");
// Compile the production card and dialog unchanged, excluding unrelated auth/network workspace code.
file("card.tsx", `import {useRef,useState} from 'react';import {ArrowLeft,ArrowRight,Check,Layers3,RotateCcw} from 'lucide-react';
import {Button} from '@/components/ui/button';import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {SocialPlatformIcon} from '@/components/social/platform-icon';import {canonicalHookSource} from '@/worker/src/lib/explore-instagram-source';import {cn} from '@/lib/utils';
import studio from '@/components/explore/workflow-studio.module.css';import type {RecreateReference} from '@/lib/explore/recreate-types';
${workspace.slice(workspace.indexOf("export function ReferenceCard("), workspace.indexOf("export function EmptyReferences("))}`);
file("entry.tsx", `import {createRoot} from 'react-dom/client';import {useState} from 'react';import {ReferenceCard,ReferencePreviewDialog} from './card';
const refs=${JSON.stringify(refs)};
window.cardSelections=0;window.cardPreviews=0;
function App(){const [selected,select]=useState(null),[preview,show]=useState(null);return <main style={{maxWidth:1000,margin:'24px auto',padding:16}}><h1>References</h1><p>Watch an example, then choose Recreate.</p><div className='fixture-grid'>{refs.map(reference=><ReferenceCard key={reference.id} reference={reference} compact showActionLabel isSelected={selected===reference.id} onRecreate={()=>{window.cardSelections++;select(reference.id)}} onPreview={()=>{window.cardPreviews++;show(reference)}}/>)}</div><ReferencePreviewDialog key={preview?.id??'empty'} reference={preview} open={!!preview} onOpenChange={open=>{if(!open)show(null)}}/></main>};createRoot(document.getElementById('root')).render(<App/>);`);
async function main() {
  console.log("Compiling the production reference card fixture.");
  const globals = fs.readFileSync(path.join(root, "app/globals.css"), "utf8").replace('@import "tailwindcss";', '@import "tailwindcss" source(none);')
    + '\n@source "../.tmp/hook-card-browser/card.tsx";\n@source "../.tmp/hook-card-browser/entry.tsx";\n';
  const css = await postcss([require("@tailwindcss/postcss")()]).process(globals, { from: path.join(root, "app/globals.css") });
  file("style.css", css.css + "\n" + fs.readFileSync(path.join(root, "components/explore/workflow-studio.module.css"), "utf8") + "\n.fixture-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px}h1,p{margin-bottom:16px}@media(max-width:600px){.fixture-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}}");
  await new Promise((resolve, reject) => {
    const compiler = webpack({ mode: "development", devtool: false, context: root, entry: path.join(out, "entry.tsx"), output: { path: out, filename: "bundle.js" },
      resolve: { extensions: [".tsx", ".ts", ".js"], alias: { "@": root } }, module: { rules: [{ test: /\.tsx?$/, use: path.join(out, "loader.cjs") }, { test: /\.css$/, use: path.join(out, "css-loader.cjs") }] } });
    compiler.run((error, stats) => compiler.close(() => error || stats.hasErrors() ? reject(error || new Error(stats.toString({ all: false, errors: true }))) : resolve()));
  });
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://fixture.test");
    if (url.pathname.startsWith("/media/")) {
      const name = path.basename(url.pathname); if (!/^[a-f0-9]{64}\.(mp4|webp)$/.test(name)) { res.writeHead(404); res.end(); return; }
      const bytes = fs.readFileSync(path.join(root, ".tmp/explore-paired-references/media", name));
      res.writeHead(200, { "Content-Type": name.endsWith(".mp4") ? "video/mp4" : "image/webp", "Content-Length": bytes.length }); res.end(bytes); return;
    }
    if (url.pathname === "/bundle.js" || url.pathname === "/style.css") { res.writeHead(200, { "Content-Type": url.pathname.endsWith(".js") ? "text/javascript" : "text/css" }); res.end(fs.readFileSync(path.join(out, url.pathname.slice(1)))); return; }
    res.writeHead(200, { "Content-Type": "text/html" }); res.end('<!doctype html><html class="dark"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>');
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  console.log("Reference card fixture is ready; launching browser.");
  let browser;
  try {
    browser = await playwright.chromium.launch({ headless: true, ...(process.platform === "win32" ? { channel: "msedge" } : {}) });
    const page = await browser.newPage({ viewport: { width: 1100, height: 900 } }), errors = [];
    console.log("Browser started; checking card interactions.");
    page.on("pageerror", error => errors.push(error.message));
    await page.route("https://www.instagram.com/**", route => route.fulfill({ status: 200, contentType: "text/html", body: "<title>Original post fixture</title>" }));
    await page.route("https://www.tiktok.com/**", route => route.fulfill({ status: 200, contentType: "text/html", body: "<title>Original post fixture</title>" }));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    const link = page.getByRole("link", { name: "View original on Instagram: Hook 01", exact: true });
    await link.waitFor(); assert.equal(await link.getAttribute("href"), refs[0].instagramUrl); assert.equal(await link.getAttribute("target"), "_blank");
    assert.equal(await link.getAttribute("title"), "View original on Instagram"); assert.match(await link.getAttribute("rel"), /noopener/);
    const popup = page.waitForEvent("popup"); await link.click(); const opened = await popup; await opened.waitForLoadState(); assert.equal(opened.url(), refs[0].instagramUrl); await opened.close();
    const tiktokRef = refs.find(item => item.sourcePlatform === "tiktok");
    const tiktokLink = page.getByRole("link", { name: `View original on TikTok: ${tiktokRef.title}`, exact: true });
    await tiktokLink.waitFor(); assert.equal(await tiktokLink.getAttribute("href"), tiktokRef.sourceUrl); assert.equal(await tiktokLink.getAttribute("title"), "View original on TikTok"); assert.equal(await tiktokLink.getAttribute("target"), "_blank");
    assert.equal(await tiktokLink.locator("svg").evaluate(svg => getComputedStyle(svg).fill), await tiktokLink.locator("svg").evaluate(svg => getComputedStyle(svg).color), "TikTok icon inherits its link color on dark cards");
    assert.deepEqual(await page.evaluate(() => [window.cardSelections, window.cardPreviews]), [0, 0]);
    await page.getByRole("button", { name: "Recreate Hook 01", exact: true }).click(); assert.equal(await page.evaluate(() => window.cardSelections), 1);
    await page.screenshot({ path: path.join(out, "desktop.png"), fullPage: !process.argv.includes("--all") });
    await page.getByRole("button", { name: "Preview Hook 01", exact: true }).click();
    const preview = page.locator('[role="dialog"] video'); await preview.waitFor(); assert.equal(await preview.getAttribute("src"), refs[0].previewVideoUrl);
    await preview.evaluate(async video => { await video.play(); }); await page.waitForFunction(() => document.querySelector('[role="dialog"] video')?.currentTime > .2);
    assert.equal(await preview.evaluate(video => video.muted), false); await page.keyboard.press("Escape");
    const playback = [];
    if (process.argv.includes("--all")) {
      for (const reference of refs) {
        const card = page.locator("article").filter({ has: page.getByRole("button", { name: `Recreate ${reference.title}`, exact: true }) });
        const sourceUrl = reference.sourceUrl ?? reference.instagramUrl;
        assert.equal(await card.getByRole("link").count(), sourceUrl ? 1 : 0, `${reference.title} source visibility`);
        if (sourceUrl) assert.equal(await card.getByRole("link").getAttribute("href"), sourceUrl);
        await card.getByRole("button", { name: `Recreate ${reference.title}`, exact: true }).click();
        assert.equal(await card.getByRole("button", { name: `Recreate ${reference.title}`, exact: true }).getAttribute("aria-pressed"), "true");
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
    await page.screenshot({ path: path.join(out, "mobile.png"), fullPage: !process.argv.includes("--all") });
    await link.focus(); assert.equal(await link.evaluate(node => node === document.activeElement), true);
    assert.deepEqual(errors, []); console.log(JSON.stringify({ sourceLink: "passed", recreateUnaffected: true, soundtrackPreview: "passed", fullyPlayed: playback.length, failedVideo: playback.filter(item => !item.videoDecoded).map(item => item.title), desktopAndMobile: "passed", output: out }));
    assert.deepEqual(playback.filter(item => !item.videoDecoded).map(item => item.title), [], "every preview must decode visible video pictures");
  } finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
