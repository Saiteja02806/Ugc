/* eslint-disable @typescript-eslint/no-require-imports -- Isolated browser regression harness. */
// Real Adjust component; isolated authentication and API fixtures, no paid work.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { webpack } = require("next/dist/compiled/webpack/webpack");
let playwright;
try { playwright = require("playwright"); }
catch { playwright = require(path.join(process.env.USERPROFILE, ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright")); }
const root = path.resolve(__dirname, "..");
const out = path.join(root, ".tmp/trending-slideshow-only-browser");
fs.mkdirSync(out, { recursive: true });
const file = (name, value) => fs.writeFileSync(path.join(out, name), value);
file("loader.cjs", `const ts=require(${JSON.stringify(require.resolve("typescript"))});module.exports=source=>ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText;`);
file("auth.ts", "export const getCurrentUserIdToken=async()=> 'slideshow-only-fixture';");
file("entry.tsx", `import {useState} from 'react';import {createRoot} from 'react-dom/client';import {TrendingContentMixDialog} from '@/components/trending/trending-content-mix-dialog';function App(){const[open,setOpen]=useState(true);return <><button onClick={()=>setOpen(true)}>Adjust</button><TrendingContentMixDialog open={open} onOpenChange={setOpen} onApplied={()=>{throw new Error('Fixed mix must not save')}}/></>;}createRoot(document.getElementById('root')).render(<App/>);`);

async function main() {
  await new Promise((resolve, reject) => {
    const compiler = webpack({ mode: "development", devtool: false, context: root, entry: path.join(out, "entry.tsx"), output: { path: out, filename: "bundle.js" }, resolve: { extensions: [".tsx", ".ts", ".js"], alias: { "@/lib/firebase/auth": path.join(out, "auth.ts"), "@": root } }, module: { rules: [{ test: /\.tsx?$/, use: path.join(out, "loader.cjs") }] } });
    compiler.run((error, stats) => compiler.close(() => error || stats.hasErrors() ? reject(error || new Error(stats.toString({ all: false, errors: true }))) : resolve()));
  });
  const css = require("./compiled-browser-css.cjs")(root);
  const errors = [], requests = [];
  const server = http.createServer((req, res) => {
    if (req.url === "/bundle.js") { res.setHeader("Content-Type", "text/javascript"); return res.end(fs.readFileSync(path.join(out, "bundle.js"))); }
    if (req.url === "/api/trending/content-mix") {
      requests.push(req.method);
      res.setHeader("Content-Type", "application/json");
      // A stale API response must still not reveal video formats or editing.
      return res.end(JSON.stringify({ ok: true, editable: true, entitlement: { dailyLimit: 20, displayName: "Starter", planKey: "pro" }, limits: { carousel: 100, hook_video: 100, reaction: 100, wall_text: 100 }, preference: { mix: { carousel: 20, hook_video: 30, reaction: 20, wall_text: 30 }, preferenceVersion: 2, updatedAt: "saved" } }));
    }
    res.setHeader("Content-Type", "text/html");
    res.end(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body class="bg-background text-foreground"><div id="root"></div><script src="/bundle.js"></script></body></html>`);
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  let browser;
  try {
    browser = await playwright.chromium.launch({ headless: true, ...(process.platform === "win32" ? { channel: "msedge" } : {}) });
    const page = await browser.newPage();
    page.on("pageerror", error => errors.push(error.message));
    for (const viewport of [{ width: 1366, height: 768 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      await page.goto(`http://127.0.0.1:${server.address().port}`);
      const dialog = page.getByRole("dialog");
      await dialog.getByText("Slideshows are set to 100% of your daily content.", { exact: true }).waitFor();
      assert.equal(await dialog.getByText("Slideshows", { exact: true }).count(), 1);
      assert.equal(await dialog.getByText("100%", { exact: true }).count(), 1);
      assert.equal(await dialog.getByText("20/day", { exact: true }).count(), 1);
      for (const label of ["Hooks", "Wall-of-Text", "Reaction Reels"]) assert.equal(await dialog.getByText(label, { exact: true }).count(), 0);
      assert.equal(await dialog.getByRole("slider").count(), 1);
      assert.equal(await dialog.getByRole("slider").isDisabled(), true);
      assert.equal(await dialog.getByRole("slider").inputValue(), "100");
      assert.equal(await dialog.getByRole("button", { name: "Save mix", exact: true }).count(), 0);
      await page.screenshot({ path: path.join(out, `${viewport.width}-adjust.png`) });
      await dialog.getByRole("button", { name: "Close", exact: true }).first().click();
      await dialog.waitFor({ state: "hidden" });
    }
    assert.deepEqual(requests, ["GET", "GET"]);
    assert.deepEqual(errors, []);
    console.log("PASS: desktop/mobile Adjust shows only Slideshows at fixed 100%, correct daily allowance, no hidden formats or writes, including stale API preferences.");
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
