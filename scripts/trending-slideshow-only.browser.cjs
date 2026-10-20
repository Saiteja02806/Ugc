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
file("entry.tsx", `import {useState} from 'react';import {createRoot} from 'react-dom/client';import {TrendingContentMixDialog} from '@/components/trending/trending-content-mix-dialog';function App(){const[open,setOpen]=useState(true);return <><button onClick={()=>setOpen(true)}>Adjust</button><TrendingContentMixDialog open={open} onOpenChange={setOpen} onApplied={()=>{}}/></>;}createRoot(document.getElementById('root')).render(<App/>);`);

async function main() {
  await new Promise((resolve, reject) => {
    const compiler = webpack({ mode: "development", devtool: false, context: root, entry: path.join(out, "entry.tsx"), output: { path: out, filename: "bundle.js" }, resolve: { extensions: [".tsx", ".ts", ".js"], alias: { "@/lib/firebase/auth": path.join(out, "auth.ts"), "@": root } }, module: { rules: [{ test: /\.tsx?$/, use: path.join(out, "loader.cjs") }] } });
    compiler.run((error, stats) => compiler.close(() => error || stats.hasErrors() ? reject(error || new Error(stats.toString({ all: false, errors: true }))) : resolve()));
  });
  const css = require("./compiled-browser-css.cjs")(root);
const errors = [], requests = [];
let savedStyleMix = { helpfulTips: 50, productStoriesCta: 50 };
  const server = http.createServer((req, res) => {
    if (req.url === "/bundle.js") { res.setHeader("Content-Type", "text/javascript"); return res.end(fs.readFileSync(path.join(out, "bundle.js"))); }
    if (req.url === "/api/trending/content-mix") {
      if (req.method === "PUT") {
        let body = "";
        req.on("data", chunk => { body += chunk; });
        req.on("end", () => {
          const parsed = JSON.parse(body);
          requests.push({ method: req.method, body: parsed });
          savedStyleMix = {
            helpfulTips: parsed.slideshow_style_mix.helpful_tips,
            productStoriesCta: parsed.slideshow_style_mix.product_stories_cta,
          };
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({
            ok: true,
            applied: "today",
            message: "Mix saved. Today's complete pack is being prepared in the background.",
            preference: {
              mix: { carousel: 100, hook_video: 0, reaction: 0, wall_text: 0 },
              slideshowStyleMix: savedStyleMix,
              preferenceVersion: 3,
              updatedAt: "now",
            },
          }));
        });
        return;
      }
      requests.push({ method: req.method });
      res.setHeader("Content-Type", "application/json");
      return res.end(JSON.stringify({ ok: true, editable: true, entitlement: { dailyLimit: 20, displayName: "Starter", planKey: "pro" }, limits: { carousel: 100, hook_video: 100, reaction: 100, wall_text: 100 }, preference: { mix: { carousel: 100, hook_video: 0, reaction: 0, wall_text: 0 }, slideshowStyleMix: savedStyleMix, preferenceVersion: 2, updatedAt: "saved" } }));
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
      await dialog.getByText("Choose the balance for your next pack", { exact: true }).waitFor();
      assert.equal(await dialog.getByText("Daily composition", { exact: true }).count(), 1);
      assert.equal(await dialog.getByText(/100% slideshows/i).count(), 1);
      assert.equal(await dialog.getByText(/20 pieces of content per day/).count(), 1);
      for (const label of ["Hooks", "Wall-of-Text", "Reaction Reels"]) assert.equal(await dialog.getByText(label, { exact: true }).count(), 0);
      assert.equal(await dialog.getByRole("slider").count(), 2);
      const savedHelpfulTips = viewport.width > 400 ? "50" : "53";
      const savedProductStories = viewport.width > 400 ? "50" : "47";
      assert.equal(await dialog.getByRole("slider", { name: "Helpful tips percentage" }).inputValue(), savedHelpfulTips);
      assert.equal(await dialog.getByRole("slider", { name: "Product stories + CTA percentage" }).inputValue(), savedProductStories);
      assert.equal(await dialog.getByText("10/day", { exact: true }).count(), 2);
      assert.equal(await dialog.getByRole("button", { name: "Save mix", exact: true }).isDisabled(), true);
      for (const name of ["Cancel", "Save mix"]) {
        const bounds = await dialog.getByRole("button", { name, exact: true }).boundingBox();
        assert.ok(bounds && bounds.y >= 0 && bounds.y + bounds.height <= viewport.height, `${name} must remain fully visible at ${viewport.width}px`);
      }
      if (viewport.width > 400) {
        await dialog.getByRole("slider", { name: "Helpful tips percentage" }).fill("53");
        assert.equal(await dialog.getByRole("slider", { name: "Product stories + CTA percentage" }).inputValue(), "47");
        assert.equal(await dialog.getByText("10/day", { exact: true }).count(), 2);
        await dialog.getByRole("button", { name: "Save mix", exact: true }).click();
        await dialog.getByText("Mix saved. Today's complete pack is being prepared in the background.", { exact: true }).waitFor();
        assert.equal(requests.at(-1).method, "PUT");
        assert.deepEqual(requests.at(-1).body.slideshow_style_mix, { helpful_tips: 53, product_stories_cta: 47 });
      }
      await page.screenshot({ path: path.join(out, `${viewport.width}-adjust.png`) });
      await dialog.getByRole("button", { name: "Close", exact: true }).first().click();
      await dialog.waitFor({ state: "hidden" });
    }
    assert.deepEqual(requests.map(request => request.method), ["GET", "PUT", "GET"]);
    assert.deepEqual(errors, []);
    assert.deepEqual(savedStyleMix, { helpfulTips: 53, productStoriesCta: 47 });
    console.log("PASS: desktop/mobile Adjust shows editable slideshow styles, calculates whole-pack counts, saves the selected mix, and preserves slideshow-only formats.");
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
