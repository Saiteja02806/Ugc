/* eslint-disable @typescript-eslint/no-require-imports -- Local browser regression harness. */
// Real Trending editor and upload section, with isolated HTTP/storage fixtures.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { webpack } = require("next/dist/compiled/webpack/webpack");
let playwright;
try { playwright = require("playwright"); }
catch { playwright = require(path.join(process.env.USERPROFILE, ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright")); }
const root = path.resolve(__dirname, ".."), out = path.join(root, ".tmp/trending-slide-upload-browser");
fs.mkdirSync(out, { recursive: true });
const file = (name, value) => fs.writeFileSync(path.join(out, name), value);
file("loader.cjs", `const ts=require(${JSON.stringify(require.resolve("typescript"))});module.exports=source=>ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText;`);
file("auth.ts", "export const getCurrentUserIdToken=async()=> 'local-upload-test';");
file("font.ts", "export default function(){return {variable:'fixture-font',className:'fixture-font'};}");
file("upload.ts", `export async function uploadAIStudioReferenceMedia(file){const response=await fetch('/fixture/upload',{method:'POST',body:JSON.stringify({name:file.name,type:file.type,size:file.size})});const data=await response.json();if(!response.ok)throw new Error(data.error);return {asset:data.asset};}`);
file("entry.tsx", `import {useState} from 'react';import {createRoot} from 'react-dom/client';import {TrendingCreativeEditor} from '@/components/trending/trending-creative-editor';
const item=window.__fixtureItem;
function App(){const[open,setOpen]=useState(true);return <><button onClick={()=>setOpen(true)}>Open editor</button><button id="unmount-editor" onClick={()=>setOpen(false)}>Unmount fixture editor</button>{open?<TrendingCreativeEditor item={item} onClose={()=>setOpen(false)} onSaved={edit=>{window.__saved=edit;}}/>:null}</>}
createRoot(document.getElementById('root')).render(<App/>);`);

async function main() {
  await new Promise((resolve, reject) => {
    const compiler = webpack({ mode: "development", devtool: false, context: root, entry: path.join(out, "entry.tsx"), output: { path: out, filename: "bundle.js" }, resolve: { extensions: [".tsx", ".ts", ".js"], alias: {
      "@/lib/firebase/auth": path.join(out, "auth.ts"), "next/font/local": path.join(out, "font.ts"),
      "@/lib/ai-studio/reference-media-upload": path.join(out, "upload.ts"), "@": root,
    } }, module: { rules: [{ test: /\.tsx?$/, use: path.join(out, "loader.cjs") }] } });
    compiler.run((error, stats) => compiler.close(() => error || stats.hasErrors() ? reject(error || new Error(stats.toString({ all: false, errors: true }))) : resolve()));
  });
  const initial = { format: "carousel", version: "trending-creative-edit-v1", slides: Array.from({ length: 6 }, (_, index) => ({
    slideId: `slide-${index + 1}`, slideNumber: index + 1, structureId: "structure_2", renderFormat: "4:5",
    backgroundAssetId: `original-${index + 1}`, originalBackgroundAssetId: `original-${index + 1}`,
    backgroundUrl: `/original-${index + 1}.png`, originalBackgroundUrl: `/original-${index + 1}.png`, renderedUrl: `/original-${index + 1}.png`,
    originalVisualRole: index === 0 ? "hook" : "human", visualRole: index === 0 ? "hook" : "human",
    headline: "A clear and useful next step", subtext: index ? "Choose one useful action." : "", hasHeading: index !== 0, ctaText: "",
    textPosition: { x: .5, y: .5 }, productVisualEligibility: "forbidden", storyLayoutVariant: "story_overlay_only", storyTextTreatment: "overlay",
  })) };
  const item = { id: "preview", assignmentId: "assignment", creativeId: "creative", feedItemId: "preview", format: "carousel", position: 0,
    readiness: "preview_ready", source: "new", creative: { candidateIndex: 0, carouselId: "creative", categorySlug: null,
      generationBatchId: "preview", projectId: "preview", readySlideCount: 6, selectedAngle: "Local upload test", slideCount: 6, status: "completed",
      thumbnailUrl: initial.slides[0].renderedUrl, updatedAt: "2026-10-11T00:00:00Z",
      slides: initial.slides.map(slide => ({ slideNumber: slide.slideNumber, headline: slide.headline, renderedUrl: slide.renderedUrl, slideType: "body", status: "ready", subtext: slide.subtext })) } };
  const edit = { assignmentId: "assignment", creativeId: "creative", format: "carousel", id: "edit", revision: 2,
    updatedAt: "2026-10-11T00:00:00Z", renderState: "ready", renderError: null, renderJobId: "old-job", source: null,
    content: initial, renderOutput: { slides: initial.slides.map(slide => ({ slideNumber: slide.slideNumber, renderedUrl: slide.renderedUrl, renderedS3Key: null })) } };
  let hold = false, fail = false, complete, uploads = 0;
  const writes = [], errors = [];
  const css = require('./compiled-browser-css.cjs')(root);
  const image = fs.readFileSync(path.join(root, "public/marketing/showcase-part2/slideshow/image_0.jpg"));
  const json = (res, body) => { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(body)); };
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://fixture");
    if (url.pathname === "/") { res.setHeader("Content-Type", "text/html; charset=utf-8"); return res.end(`<html class="dark"><head><meta charset="utf-8"/><link rel="stylesheet" href="/style.css"/><style>body{margin:0;font-family:Arial;background:#101312;color:white}</style></head><body><div id="root"></div><script>window.process={env:{}};window.__fixtureItem=${JSON.stringify(item)}</script><script src="/bundle.js"></script></body></html>`); }
    if (url.pathname === "/bundle.js") { res.setHeader("Content-Type", "text/javascript"); return res.end(fs.readFileSync(path.join(out, "bundle.js"))); }
    if (url.pathname === "/style.css") { res.setHeader("Content-Type", "text/css"); return res.end(css); }
    if (url.pathname.endsWith(".png")) { res.setHeader("Content-Type", "image/jpeg"); return res.end(image); }
    if (url.pathname === "/fixture/upload") {
      uploads++; const number = uploads; const failed = fail;
      if (hold) await new Promise(resolve => { complete = resolve; });
      if (failed) { res.statusCode = 503; return json(res, { error: "Test upload failed. Try again." }); }
      return json(res, { asset: { id: `upload-${number}`, url: `/confirmed-${number}.png`, collection: "image", status: "ready", sourceType: "upload",
        width: 1920, height: 1080, projectId: "trending-carousel-slide", mimeType: "image/png" } });
    }
    if (url.pathname.startsWith("/api/")) assert.equal(req.headers.authorization, "Bearer local-upload-test");
    if (url.pathname === "/api/trending/creatives/carousel/creative/edit") {
      if (req.method === "PATCH") {
        let body = ""; for await (const chunk of req) body += chunk;
        const value = JSON.parse(body); writes.push(value);
        assert.ok(!body.includes("blob:"), "Temporary previews never enter Save payloads");
        const content = { ...initial, slides: initial.slides.map(slide => ({ ...slide, ...value.slides.find(next => next.slideId === slide.slideId) })) };
        return json(res, { ok: true, edit: { ...edit, content, revision: 3, renderState: "queued" } });
      }
      return json(res, { ok: true, edit });
    }
    if (["/api/trending/carousel-hyper-hooks", "/api/trending/carousel-product-assets"].includes(url.pathname)) return json(res, { ok: true, assets: [] });
    res.statusCode = 404; res.end();
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  let browser;
  try { browser = await playwright.chromium.launch({ headless: true, ...(process.platform === "win32" ? { channel: "msedge" } : {}) }); }
  catch (error) { await new Promise(resolve => server.close(resolve)); throw error; }
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 680 } });
    page.on("pageerror", error => errors.push(error.message));
    await page.addInitScript(() => {
      window.__created = []; window.__revoked = [];
      const create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL);
      URL.createObjectURL = value => { const url = create(value); window.__created.push(url); return url; };
      URL.revokeObjectURL = url => { window.__revoked.push(url); return revoke(url); };
    });
    const save = () => page.getByRole("button", { name: "Confirm and save creative edit", exact: true });
    const next = () => page.getByRole("button", { name: "Next slide", exact: true });
    const previous = () => page.getByRole("button", { name: "Previous slide", exact: true });
    const preview = () => page.locator("[data-carousel-editor-preview]");
    const payload = { name: "replacement.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==", "base64") };
    const choose = () => { complete = null; return page.locator('input[type="file"][aria-label^="Choose image for slide"]').setInputFiles(payload); };
    async function releaseUpload() {
      for (let attempt = 0; !complete && attempt < 100; attempt++) await new Promise(resolve => setTimeout(resolve, 10));
      assert.equal(typeof complete, "function", "Upload reached the confirmation gate");
      hold = false; complete(); complete = null;
    }
    async function open() { await page.goto(`http://127.0.0.1:${server.address().port}`); await save().waitFor(); await page.getByRole("heading", { name: "Slide 1 of 6", exact: true }).waitFor(); }
    await open();
    for (let index = 1; index < 5; index++) await next().click();
    hold = true; await choose();
    await preview().getByText("Uploading image…", { exact: true }).waitFor();
    assert.equal(await save().isDisabled(), true);
    assert.match(await preview().locator("img").getAttribute("src"), /^blob:/);
    assert.equal(writes.length, 0);
    await next().click();
    assert.equal(await preview().getByText("Uploading image…", { exact: true }).count(), 0);
    assert.ok(!(await preview().locator("img").getAttribute("src")).startsWith("blob:"));
    await previous().click();
    assert.match(await preview().locator("img").getAttribute("src"), /^blob:/);
    await page.screenshot({ path: path.join(out, "14-inch-pending.png") });
    await releaseUpload();
    await page.getByText("Slide 5 image updated. Save to apply your changes.", { exact: true }).waitFor();
    assert.equal(await save().isDisabled(), false);
    assert.equal(await preview().locator("img").getAttribute("src"), "/confirmed-1.png");
    await save().click();
    await page.waitForFunction(() => window.__saved);
    assert.equal(writes.length, 1);
    assert.equal(writes[0].slides[4].backgroundAssetId, "upload-1");
    assert.equal(writes[0].slides[5].backgroundAssetId, "original-6");
    assert.equal(writes[0].expectedRevision, 2);
    assert.deepEqual(await page.evaluate(() => window.__revoked), await page.evaluate(() => window.__created));

    await page.getByRole("button", { name: "Open editor", exact: true }).click();
    await page.getByRole("heading", { name: "Slide 1 of 6", exact: true }).waitFor();
    fail = true; hold = true; await choose();
    await preview().getByText("Uploading image…", { exact: true }).waitFor();
    assert.equal(await save().isDisabled(), true);
    await releaseUpload();
    await page.getByRole("alert").filter({ hasText: "Test upload failed" }).waitFor();
    assert.equal(await preview().locator("img").getAttribute("src"), "/original-1.png");
    assert.equal(writes.length, 1);
    fail = false; await choose();
    await page.getByText("Slide 1 image updated. Save to apply your changes.", { exact: true }).waitFor();
    assert.equal(await save().isDisabled(), false);
    assert.deepEqual(await page.evaluate(() => window.__revoked), await page.evaluate(() => window.__created));
    await page.setViewportSize({ width: 1536, height: 760 });
    await page.screenshot({ path: path.join(out, "15-inch-confirmed.png") });
    // An editor being removed by navigation must ignore late upload completion.
    hold = true; await choose();
    await preview().getByText("Uploading image…", { exact: true }).waitFor();
    await page.locator("#unmount-editor").evaluate(button => button.click());
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    await releaseUpload();
    await page.getByRole("button", { name: "Open editor", exact: true }).click();
    await page.getByRole("heading", { name: "Slide 1 of 6", exact: true }).waitFor();
    assert.equal(await preview().locator("img").getAttribute("src"), "/original-1.png");
    assert.deepEqual(await page.evaluate(() => window.__revoked), await page.evaluate(() => window.__created));
    assert.equal(writes.length, 1); assert.deepEqual(errors, []);
    console.log("PASS: immediate preview, blocked Save, captured slide target, failure/retry, blob cleanup, unmount/late completion and confirmed-only Save at 1366×680 and 1536×760.");
  } finally {
    complete?.();
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
