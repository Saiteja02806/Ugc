/* eslint-disable @typescript-eslint/no-require-imports -- Isolated real-component source-link verification. */
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), http = require("node:http");
const { webpack } = require("next/dist/compiled/webpack/webpack");
let playwright; try { playwright = require("playwright"); } catch { playwright = require(path.join(process.env.USERPROFILE, ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright")); }
const root = path.resolve(__dirname, ".."), out = path.join(root, ".tmp/slideshow-source-links-browser"); fs.mkdirSync(out, { recursive: true });
const read = name => JSON.parse(fs.readFileSync(path.join(root, "lib/explore/" + name + ".json")));
const items = [...read("imported-catalog").items, ...read("slideshow-reference-additions").items];
const refs = read("slideshow-reference-sources").items.map(source => { const item = items.find(item => item.id === source.referenceId); return { ...source, id: item.id, format: "slideshow", title: item.categoryLabel, posterUrl: "/media/" + item.posterFile, slides: item.slides.map(slide => ({ ...slide, url: "/media/" + slide.file })) }; });
const noSource = { ...refs[0], id: "no-source", title: "Without source", sourceUrl: undefined };
const write = (name, value) => fs.writeFileSync(path.join(out, name), value);
write("loader.cjs", `const ts=require(${JSON.stringify(require.resolve("typescript"))});module.exports=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText;`);
write("css.cjs", `module.exports=s=>'export default '+JSON.stringify(Object.fromEntries([...s.matchAll(/\\.([a-zA-Z][a-zA-Z0-9_-]*)/g)].map(m=>[m[1],m[1]])))+';';`);
const workspace = fs.readFileSync(path.join(root, "components/explore/recreate-workspace.tsx"), "utf8");
write("card.tsx", `import {useState} from 'react';import {ArrowLeft,ArrowRight,Check,Layers3,RotateCcw} from 'lucide-react';
import {Button} from '@/components/ui/button';import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {SocialPlatformIcon} from '@/components/social/platform-icon';import {getReferenceSource,referenceSourceLabel} from '@/lib/explore/reference-source-link';import {cn} from '@/lib/utils';
import Link from 'next/link';import {ReferenceVideoPlayer} from '@/components/explore/reference-video-player';import {useCoverPlayback} from '@/components/explore/use-cover-playback';
import studio from '@/components/explore/workflow-studio.module.css';import type {RecreateReference} from '@/lib/explore/recreate-types';import {canOpenReferenceSource} from '@/lib/explore/reference-source-access';
const useBillingSubscription=()=>{const free=new URLSearchParams(location.search).has('free');return {isSuccess:true,isFetching:false,isError:false,data:{isActive:!free,planKey:free?'free':'starter'}}};
${workspace.slice(workspace.indexOf("export function ReferenceCard("), workspace.indexOf("export function EmptyReferences("))}`);
write("entry.tsx", `import {createRoot} from 'react-dom/client';import {useState} from 'react';import {ReferenceCard,ReferencePreviewDialog} from './card';
const refs=${JSON.stringify([...refs, noSource])};window.selections=0;window.previews=0;
function App(){const [preview,setPreview]=useState(null);const compact=!new URLSearchParams(location.search).has('legacy');return <main><h1>Slideshow source references</h1><div className="grid">{refs.map(reference=><ReferenceCard key={reference.id} reference={reference} canOpenSource compact={compact} showActionLabel isSelected={false} onRecreate={()=>window.selections++} onPreview={()=>{window.previews++;setPreview(reference)}}/>)}</div><ReferencePreviewDialog key={preview?.id??'empty'} canOpenSource reference={preview} open={!!preview} onOpenChange={open=>{if(!open)setPreview(null)}}/></main>};createRoot(document.getElementById('root')).render(<App/>);`);

async function main() {
  const globals = fs.readFileSync(path.join(root, "app/globals.css"), "utf8").replace('@import "tailwindcss";', '@import "tailwindcss" source(none);') + '\n@source "../.tmp/slideshow-source-links-browser/card.tsx";\n@source "../components/ui/dialog.tsx";\n@source "../components/ui/button.tsx";';
  const css = (await require("postcss")([require("@tailwindcss/postcss")()]).process(globals, { from: path.join(root, "app/globals.css") })).css;
  write("style.css", css + '\n' + fs.readFileSync(path.join(root, "components/explore/workflow-studio.module.css")) + '\nbody{background:#202020;color:#fff;font-family:Arial}main{max-width:1120px;margin:20px auto;padding:16px}.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:24px}@media(max-width:700px){.grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}}');
  await new Promise((resolve, reject) => { const compiler = webpack({ mode: "development", devtool: false, context: root, entry: path.join(out, "entry.tsx"), output: { path: out, filename: "bundle.js" }, plugins: [new webpack.DefinePlugin({ "process.env": JSON.stringify({ NODE_ENV: "development" }) })], resolve: { extensions: [".tsx", ".ts", ".js"], alias: { "@": root } }, module: { rules: [{ test: /\.tsx?$/, use: path.join(out, "loader.cjs") }, { test: /\.css$/, use: path.join(out, "css.cjs") }] } }); compiler.run((error, stats) => compiler.close(() => error || stats.hasErrors() ? reject(error || Error(stats.toString({ all: false, errors: true }))) : resolve())); });
  const fallback = await require("sharp")({ create: { width: 1080, height: 1350, channels: 3, background: "#555044" } }).jpeg().toBuffer();
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://fixture");
    if (url.pathname.startsWith("/media/")) { const name = path.basename(url.pathname), file = path.join(root, ".tmp/explore-catalog/media", name); res.writeHead(200, { "Content-Type": "image/jpeg" }); return res.end(fs.existsSync(file) ? fs.readFileSync(file) : fallback); }
    if (["/bundle.js", "/style.css"].includes(url.pathname)) { res.setHeader("Content-Type", url.pathname.endsWith("js") ? "text/javascript" : "text/css"); return res.end(fs.readFileSync(path.join(out, url.pathname.slice(1)))); }
    res.setHeader("Content-Type", "text/html; charset=utf-8"); res.end('<!doctype html><html class="dark"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><div id="root"></div><script src="/bundle.js"></script></html>');
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve)); server.unref();
  let browser;
  try {
    browser = await playwright.chromium.launch({ headless: true, ...(process.platform === "win32" ? { channel: "msedge" } : {}) });
    const page = await browser.newPage({ viewport: { width: 1366, height: 768 } }), errors = []; page.on("pageerror", error => { errors.push(error.message); console.error("Fixture page error:", error.message); });
    await page.context().route("https://www.tiktok.com/**", route => route.fulfill({ status: 200, contentType: "text/html", body: "<title>Source destination fixture</title>" }));
    const base = `http://127.0.0.1:${server.address().port}`, card = ref => page.locator(`article[data-reference-id="${ref.id}"]`);
    await page.goto(base);
    await page.getByRole("heading", { name: "Slideshow source references" }).waitFor();
    if (!await card(refs[0]).getByRole("link").count()) { console.error((await card(refs[0]).innerText()).slice(0, 500)); await page.screenshot({ path: path.join(out, "missing-link.png") }); }
    for (const ref of refs) {
      const link = card(ref).getByRole("link"); await link.waitFor(); assert.equal(await link.getAttribute("href"), ref.sourceUrl); assert.equal(await link.textContent(), ref.sourceKind === "profile" ? "Creator profile" : "Original post");
      const popup = page.waitForEvent("popup"); await link.click(); const opened = await popup; await opened.waitForLoadState(); assert.equal(opened.url(), ref.sourceUrl); await opened.close();
    }
    assert.equal(await card(noSource).getByRole("link").count(), 0);
    assert.deepEqual(await page.evaluate(() => [window.selections, window.previews]), [0, 0]);
    const reference = refs.find(ref => ref.sourceKind === "post");
    await card(reference).getByRole("button", { name: `Recreate ${reference.title}`, exact: true }).click(); assert.equal(await page.evaluate(() => window.selections), 1);
    await card(reference).getByRole("button", { name: `Preview ${reference.title}`, exact: true }).click(); const dialog = page.getByRole("dialog");
    assert.equal(await dialog.getByRole("link").getAttribute("href"), reference.sourceUrl);
    await dialog.getByRole("button", { name: "Next", exact: true }).click(); assert.equal(await dialog.getByRole("button", { name: "Previous", exact: true }).isEnabled(), true);
    await page.keyboard.press("Escape"); await page.evaluate(() => scrollTo(0, 0)); await page.screenshot({ path: path.join(out, "desktop.png") });
    for (const viewport of [{width:1280,height:720},{width:390,height:844}]) {
      await page.setViewportSize(viewport); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      const first = card(refs[0]).getByRole("link"); await first.scrollIntoViewIfNeeded(); await first.focus(); assert.equal(await first.evaluate(node => node === document.activeElement), true);
      const popup = page.waitForEvent("popup"); await page.keyboard.press("Enter"); const opened = await popup; await opened.close();
      await page.screenshot({ path: path.join(out, `viewport-${viewport.width}.png`) });
    }
    await page.goto(base + "?free=1"); const gated = card(refs[0]).getByRole("button", { name: /View creator.*Upgrade to Pro/ }); await gated.click();
    await page.getByRole("dialog").getByRole("heading", { name: "Upgrade to Pro" }).waitFor(); assert.equal(await card(refs[0]).getByRole("link").count(), 0);
    assert.deepEqual(await page.evaluate(() => [window.selections, window.previews]), [0, 0]); await page.keyboard.press("Escape");
    await page.goto(base + "?legacy=1"); assert.equal(await card(refs[0]).getByRole("link").getAttribute("href"), refs[0].sourceUrl);
    assert.deepEqual(errors, []); console.log(JSON.stringify({ sourceClicks: refs.length, sourceKindLabels: "passed", entitlement: "passed", previewAndRecreate: "passed", legacyGallery: "passed", keyboardAndViewports: [1366,1280,390], externalDestinations: "intercepted fixtures; not live TikTok acceptance", output: out }));
  } finally { if(browser) await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
