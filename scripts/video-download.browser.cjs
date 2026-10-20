// Isolated browser regression test for the real result actions and download client.
// Auth and HTTP responses are fixtures; no generation, storage or account writes.
/* eslint-disable @typescript-eslint/no-require-imports -- This CommonJS runner uses webpack and the bundled Playwright runtime. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { webpack } = require("next/dist/compiled/webpack/webpack");
let playwright;
try { playwright = require("playwright"); }
catch { playwright = require(path.join(process.env.USERPROFILE, ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright")); }

const root = path.resolve(__dirname, "..");
const out = path.join(root, ".tmp/video-download-browser");
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, "loader.cjs"), `const ts = require(${JSON.stringify(require.resolve("typescript"))}); module.exports = function(source) { return ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX } }).outputText; };`);
fs.writeFileSync(path.join(out, "auth.ts"), `import { useSyncExternalStore } from "react";
window.fixtureOwner = "owner";
export function useAuth() { const uid = useSyncExternalStore(callback => { window.addEventListener("fixture-owner", callback); return () => window.removeEventListener("fixture-owner", callback); }, () => window.fixtureOwner); return { user: uid ? { uid } : null }; }
export async function getCurrentUserIdToken(expected) { if (window.fixtureOwner !== expected) throw new Error("Your signed-in account changed."); return "fixture-" + expected; }`);
fs.writeFileSync(path.join(out, "entry.tsx"), `import { createRoot } from "react-dom/client";
import { AiStudioResultActions } from "@/components/generation/ai-studio-result-actions";
const id = "00000000-0000-4000-8000-000000000001";
const root = createRoot(document.getElementById("root"));
window.renderFixture = (legacy = false) => root.render(<><video src="/preview.mp4" /><AiStudioResultActions kind="video" mediaAssetId={legacy ? null : id} url="/preview.mp4" title="My video" /><AiStudioResultActions kind="image" url="/image.png" title="My image" /><button onClick={() => { window.fixtureOwner = "other-owner"; window.dispatchEvent(new Event("fixture-owner")); }}>Switch owner</button></>);
window.renderFixture();`);

async function main() {
  await new Promise((resolve, reject) => {
    const compiler = webpack({ mode: "development", devtool: false, context: root, entry: path.join(out, "entry.tsx"),
      output: { path: out, filename: "bundle.js" },
      resolve: { extensions: [".tsx", ".ts", ".js"], alias: { "@/contexts/auth-context": path.join(out, "auth.ts"), "@/lib/firebase/auth": path.join(out, "auth.ts"), "@": root } },
      module: { rules: [{ test: /\.tsx?$/, use: path.join(out, "loader.cjs") }] },
    });
    compiler.run((error, stats) => compiler.close(() => error || stats.hasErrors() ? reject(error || new Error(stats.toString({ all: false, errors: true }))) : resolve()));
  });
  const server = http.createServer((request, response) => {
    if (request.url === "/bundle.js") { response.setHeader("Content-Type", "text/javascript"); response.end(fs.readFileSync(path.join(out, "bundle.js"))); }
    else if (request.url === "/fixture") { response.setHeader("Content-Type", "text/html"); response.end('<div id="root"></div><script src="/bundle.js"></script>'); }
    else { response.statusCode = 404; response.end(); }
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try { browser = await playwright.chromium.launch({ headless: true, ...(process.platform === "win32" ? { channel: "msedge" } : {}) }); }
  catch (error) { await new Promise(resolve => server.close(resolve)); throw error; }
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();
  const errors = []; page.on("pageerror", error => errors.push(error.message));
  const signed = new URL("https://storage.googleapis.com/fixture/video.mp4");
  signed.searchParams.set("response-content-disposition", 'attachment; filename="my-video.mp4"');
  const bytes = Buffer.alloc(5 * 1024 * 1024, 7);
  let calls = 0, storageRequests = 0, mode = "success", release, observed, served;
  await page.route("https://storage.googleapis.com/**", async route => {
    storageRequests++;
    assert.equal(route.request().headers().authorization, undefined);
    await route.fulfill({ status: 200, body: bytes, headers: { "Content-Type": "video/mp4", "Content-Disposition": 'attachment; filename="my-video.mp4"' } });
  });
  await page.route("**/api/media/**/download", async route => {
    calls++; assert.equal(route.request().method(), "POST");
    assert.equal(route.request().headers().authorization, "Bearer fixture-owner");
    if (mode === "pending") { observed(); await new Promise(resolve => { release = resolve; }); }
    await route.fulfill({ status: mode === "failure" ? 503 : 200, contentType: "application/json", body: JSON.stringify(mode === "failure" ? { ok: false, error: "Please try again." } : { ok: true, url: signed.href, fileName: "my-video.mp4" }) }).catch(() => {});
    if (mode === "pending") served();
  });
  await page.route("**/api/media?**", route => {
    assert.equal(route.request().headers().authorization, "Bearer fixture-owner");
    assert.equal(new URL(route.request().url()).searchParams.get("sourceTypes"), "generated_video");
    return route.fulfill({ contentType: "application/json", body: JSON.stringify({ ok: true, assets: [{ id: "00000000-0000-4000-8000-000000000001", status: "ready", url: "/preview.mp4" }] }) });
  });
  try {
    await page.goto(`${base}/fixture`);
    const downloadEvent = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download My video", exact: true }).evaluate(button => { button.click(); button.click(); });
    const download = await downloadEvent;
    assert.equal(download.suggestedFilename(), "my-video.mp4");
    await download.saveAs(path.join(out, "download.mp4"));
    assert.deepEqual(fs.readFileSync(path.join(out, "download.mp4")), bytes);
    assert.equal(calls, 1); assert.equal(page.url(), `${base}/fixture`);
    // Edge may show its internal downloads-hub tab; no website tab should open.
    assert.equal(context.pages().filter(tab => /^https?:/.test(tab.url())).length, 1,
      `Unexpected website pages: ${context.pages().map(tab => tab.url()).join(", ")}`);
    assert.equal(await page.locator("video").getAttribute("src"), "/preview.mp4");
    assert.equal(await page.getByRole("link", { name: "Download My image", exact: true }).getAttribute("download"), "my-image.png");
    assert.equal(await page.getByRole("link", { name: "Open My video in a new tab", exact: true }).getAttribute("target"), "_blank");
    console.log("PASS: direct 5 MB download, correct filename/bytes, one request, same page/tab, playback and image/open actions preserved");

    mode = "failure"; await page.goto(`${base}/fixture`);
    await page.getByRole("button", { name: "Download My video", exact: true }).click();
    await page.getByRole("alert").getByText("Please try again.").waitFor();
    assert.equal(page.url(), `${base}/fixture`); assert.equal(storageRequests, 1);
    assert.equal(await page.getByRole("button", { name: "Download My video", exact: true }).isEnabled(), true);
    mode = "success";
    const retryEvent = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download My video", exact: true }).click(); await retryEvent;
    console.log("PASS: failures stay on the page and the same button can retry");

    await page.goto(`${base}/fixture`); await page.evaluate(() => window.renderFixture(true));
    const legacyEvent = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download My video", exact: true }).click(); await legacyEvent;
    console.log("PASS: older job outputs resolve their asset through the owned media list");

    mode = "pending"; await page.goto(`${base}/fixture`);
    const pendingObserved = new Promise(resolve => { observed = resolve; });
    const pendingServed = new Promise(resolve => { served = resolve; });
    await page.getByRole("button", { name: "Download My video", exact: true }).click(); await pendingObserved;
    const storageBefore = storageRequests;
    await page.getByRole("button", { name: "Switch owner", exact: true }).click();
    release();
    await pendingServed;
    // A subsequent UI action and request confirm the old response cannot trigger a download.
    await page.getByRole("button", { name: "Download My video", exact: true }).waitFor();
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.equal(storageRequests, storageBefore); assert.equal(page.url(), `${base}/fixture`);
    assert.deepEqual(errors, []);
    console.log("PASS: switching accounts cancels a pending download");
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
