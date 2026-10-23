import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
const require = createRequire(import.meta.url);
const { webpack } = require("next/dist/compiled/webpack/webpack");
const playwright = require(path.join(process.env.USERPROFILE, ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright"));
const root = process.cwd(), out = path.join(root, ".tmp/hook-composer-browser"); mkdirSync(out, { recursive: true });
const write = (file, value) => writeFileSync(path.join(out, file), value);
const frame = { ownerId: "owner", assetId: "11111111-1111-4111-8111-111111111111", jobId: "22222222-2222-4222-8222-222222222222", draftId: "33333333-3333-4333-8333-333333333333",
  referenceId: "hook-first", sourceSha256: "a".repeat(64), url: "https://media.example.test/original.png?signature=temporary", width: 720, height: 1280, durationSeconds: 8, motionInstructions: "My reviewed custom motion", generateAudio: true };
write("loader.cjs", `const ts=require(${JSON.stringify(require.resolve("typescript"))});module.exports=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText;`);
write("auth.ts", "export async function getCurrentUserIdToken(owner){return 'fixture-'+owner}");
write("entry.tsx", `import {StrictMode,useState} from 'react';import {createRoot} from 'react-dom/client';import {useHookComposerSelection} from '@/components/explore/use-hook-composer-selection';
const frame=${JSON.stringify(frame)};function App(){const [owner,setOwner]=useState('owner');const state=useHookComposerSelection(owner,true);return <main><h1>Starting frame recovery fixture</h1><pre data-state>{JSON.stringify({frame:state.frame,ready:state.ready,error:state.error})}</pre><button onClick={()=>state.setFrame(frame)}>Choose frame</button><button onClick={()=>state.setFrame(null)}>Clear</button><button onClick={state.retry}>Retry</button><button onClick={()=>setOwner('other')}>Switch account</button></main>};createRoot(document.getElementById('root')).render(<StrictMode><App/></StrictMode>);`);
await new Promise((resolve, reject) => {
  const compiler = webpack({ mode: "development", devtool: false, context: root, entry: path.join(out, "entry.tsx"), output: { path: out, filename: "entry.js" },
    resolve: { extensions: [".tsx", ".ts", ".js"], alias: { "@/lib/firebase/auth": path.join(out, "auth.ts"), "@": root } },
    module: { rules: [{ test: /\.tsx?$/, use: path.join(out, "loader.cjs"), exclude: /node_modules/ }] } });
  compiler.run((error, stats) => compiler.close(() => error || stats.hasErrors() ? reject(error ?? Error(stats.toString({ all: false, errors: true }))) : resolve()));
});
let mode = "ok", reads = 0;
const server = createServer((request, response) => {
  if (request.url.startsWith("/api/explore/hook-starting-frames")) {
    reads++; assert.equal(request.method, "GET"); assert.equal(request.headers.authorization, "Bearer fixture-owner");
    response.setHeader("Content-Type", "application/json");
    if (mode === "fail") { response.statusCode = 503; response.end(JSON.stringify({ ok: false, message: "Fixture read unavailable" })); }
    else response.end(JSON.stringify({ ok: true, frame: { ...frame, url: "https://media.example.test/fresh.png", motionInstructions: "Suggested motion", generateAudio: false } }));
    return;
  }
  if (request.url === "/entry.js") { response.setHeader("Content-Type", "text/javascript"); response.end(readFileSync(path.join(out, "entry.js"))); return; }
  response.setHeader("Content-Type", "text/html"); response.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script src="/entry.js"></script>');
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
let browser; const checks = [], errors = [];
try {
  browser = await playwright.chromium.launch({ headless: true, channel: "msedge" });
  for (const viewport of [{ width: 1366, height: 768 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, hasTouch: viewport.width < 500 }); const page = await context.newPage();
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.waitForFunction(() => JSON.parse(document.querySelector("[data-state]").textContent).ready);
    await page.getByRole("button", { name: "Choose frame", exact: true }).click();
    const saved = await page.evaluate(() => localStorage.getItem("ugc-explore:hook-composer:v1:owner")); assert.ok(saved); assert.equal(saved.includes("signature"), false);
    await page.reload(); await page.waitForFunction(() => JSON.parse(document.querySelector("[data-state]").textContent).frame?.url.endsWith("fresh.png"));
    let state = JSON.parse(await page.locator("[data-state]").innerText()); assert.equal(state.frame.motionInstructions, frame.motionInstructions); assert.equal(state.frame.generateAudio, true);
    mode = "fail"; await page.reload(); await page.waitForFunction(() => Boolean(JSON.parse(document.querySelector("[data-state]").textContent).error));
    state = JSON.parse(await page.locator("[data-state]").innerText()); assert.equal(state.ready, false); assert.equal(state.frame, null);
    assert.equal(await page.evaluate(() => Boolean(localStorage.getItem("ugc-explore:hook-composer:v1:owner"))), true);
    mode = "ok"; await page.getByRole("button", { name: "Retry", exact: true }).click(); await page.waitForFunction(() => JSON.parse(document.querySelector("[data-state]").textContent).frame?.url.endsWith("fresh.png"));
    await page.getByRole("button", { name: "Switch account", exact: true }).click(); await page.waitForFunction(() => { const s = JSON.parse(document.querySelector("[data-state]").textContent); return s.ready && s.frame === null; });
    await page.screenshot({ path: path.join(out, `${viewport.width}.png`) });
    checks.push(`${viewport.width}px: StrictMode, refresh/owned GET, fresh URL, exact motion/audio, failed-read retention, explicit retry and account isolation`);
    await context.close();
  }
  assert.deepEqual(errors, []); const receipt = { checks, reads, errors, limitations: "Actual React hook and authenticated read client, isolated HTTP/account fixtures; no paid generation or hosted acceptance." };
  write("receipt.json", JSON.stringify(receipt, null, 2)); console.log(JSON.stringify(receipt, null, 2));
} finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
