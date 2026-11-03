import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { createReadStream, readFileSync, writeFileSync, mkdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";

// Compile the real Explore workspace and hook. Both media variants travel over
// HTTP with byte ranges and browser network throttling, never route.fulfill().
const require = createRequire(import.meta.url);
let pw;
try { pw = require("playwright"); }
catch { pw = require(path.join(process.env.USERPROFILE, ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright")); }
const root = process.cwd(), out = path.join(root, ".tmp/explore-playback-browser");
mkdirSync(out, { recursive: true });
const write = (name, content) => { const file = path.join(out, name); writeFileSync(file, content); return file; };
const aliases = {
  "@/contexts/auth-context": write("auth.ts", "export const useAuth=()=>({user:null,loading:false});"),
  "@/components/layout/workspace-navigation-feedback": write("link.tsx", "export function WorkspaceLink({href,prefetch,children,...props}){return <a href={href} {...props}>{children}</a>}export const useWorkspaceNavigationPending=()=>false;"),
  "@/components/explore/explore-link-indicator": write("indicator.tsx", "export const ExploreLinkIndicator=()=>null;"),
  "next/link": write("next-link.tsx", "export default function Link({href,prefetch,children,...props}){return <a href={href} {...props}>{children}</a>}"),
  "next/image": write("image.tsx", "export default function Image({fill,unoptimized,sizes,...props}){return <img {...props}/>;}"),
};
write("loader.cjs", `const ts=require(${JSON.stringify(require.resolve("typescript"))});module.exports=function(s){return ts.transpileModule(s,{fileName:this.resourcePath,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText};`);
write("css.cjs", `module.exports=s=>'const style=document.createElement("style");style.textContent='+JSON.stringify(s)+';document.head.append(style);export default '+JSON.stringify(Object.fromEntries([...s.matchAll(/\\.([a-zA-Z][a-zA-Z0-9_-]*)/g)].map(m=>[m[1],m[1]])))+';';`);
write("entry.tsx", "import{createRoot}from'react-dom/client';import{ExploreWorkspace}from'@/components/explore/explore-workspace';createRoot(document.getElementById('root')).render(<ExploreWorkspace/>);");
const { webpack } = require("next/dist/compiled/webpack/webpack");
await new Promise((resolve, reject) => {
  const compiler = webpack({ mode: "development", devtool: false, context: root, entry: path.join(out, "entry.tsx"), output: { path: out, filename: "bundle.js" },
    resolve: { extensions: [".tsx", ".ts", ".js"], alias: { ...aliases, "@": root } },
    module: { rules: [{ test: /\.tsx?$/, use: path.join(out, "loader.cjs"), exclude: /node_modules/ }, { test: /\.css$/, use: path.join(out, "css.cjs") }] } });
  compiler.run((error, stats) => compiler.close(() => error || stats.hasErrors() ? reject(error || Error(stats.toString({ all: false, errors: true }))) : resolve()));
});
write("fixture.css", (await postcss([tailwind({ base: root })]).process(readFileSync("app/globals.css", "utf8").replace('@import "tailwindcss";', '@import "tailwindcss" source(none);') + '\n@source "../components/explore";', { from: path.join(root, "app/globals.css") })).css);
const media = JSON.parse(readFileSync(".tmp/explore-checkout-fixes-2026-11-03/media-comparison.json", "utf8"));
const bytes = { master: 0, optimized: 0 }, requests = [];
const server = createServer((req, res) => {
  const name = new URL(req.url, "http://fixture.invalid").pathname;
  let file = name === "/bundle.js" || name === "/fixture.css" ? path.join(out, name.slice(1)) : path.join(root, "public", name);
  const variant = req.headers.referer?.includes("variant=master") ? "master" : "optimized";
  const cover = media.find(row => "/" + row.optimized.replace("public/", "") === name);
  if (cover) file = path.join(root, variant === "master" ? cover.source : cover.optimized);
  if (name === "/" || name === "/pricing") {
    res.setHeader("Content-Type", "text/html");
    res.end(name === "/pricing" ? "<h1>Pricing destination</h1>" : '<!doctype html><html class="dark"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"><body style="margin:0"><div id="root"></div><script src="/bundle.js"></script></body></html>'); return;
  }
  if (!file.startsWith(root + path.sep) || !existsSync(file)) { res.writeHead(404); res.end(); return; }
  const size = statSync(file).size;
  const mime = file.endsWith(".mp4") ? "video/mp4" : file.endsWith(".webp") ? "image/webp" : file.endsWith(".css") ? "text/css" : file.endsWith(".js") ? "text/javascript" : "application/octet-stream";
  const range = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range ?? "");
  const start = range ? Number(range[1]) : 0, end = range?.[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
  res.setHeader("Content-Type", mime); res.setHeader("Accept-Ranges", "bytes"); res.setHeader("Cache-Control", "no-cache");
  if (start > end) { res.writeHead(416); res.end(); return; }
  res.setHeader("Content-Length", end - start + 1);
  if (range) { res.setHeader("Content-Range", `bytes ${start}-${end}/${size}`); res.writeHead(206); }
  if (cover) requests.push({ variant, name, range: req.headers.range, size });
  const stream = createReadStream(file, { start, end });
  if (cover) stream.on("data", chunk => bytes[variant] += chunk.length);
  stream.pipe(res); res.on("close", () => stream.destroy());
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
const results = [];
try {
  browser = await pw.chromium.launch({ headless: true, channel: "msedge" });
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    for (const variant of ["master", "optimized"]) {
      const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
      const page = await context.newPage(), errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.goto(`${origin}?variant=${variant}`, { waitUntil: "networkidle" });
      assert.equal(await page.locator("video[src]").count(), 0, "Reduced motion must not request or play videos");
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      const cdp = await context.newCDPSession(page);
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
      await cdp.send("Network.enable");
      await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 120, downloadThroughput: 187500, uploadThroughput: 93750 });
      await page.emulateMedia({ reducedMotion: "no-preference" });
      const samples = [];
      const sample = () => page.evaluate(() => Array.from(document.querySelectorAll("video"), video => {
        const r = video.getBoundingClientRect(), quality = video.getVideoPlaybackQuality();
        return { visible: r.bottom > 0 && r.top < innerHeight, time: video.currentTime, paused: video.paused, ready: video.readyState,
          duration: video.duration || 0, frames: quality.totalVideoFrames, dropped: quality.droppedVideoFrames, error: video.error?.code ?? null };
      }));
      for (let i = 0; i < 45; i++) { samples.push(await sample()); await page.waitForTimeout(1000); }
      const active = samples.at(-1).map((v, i) => v.visible ? i : -1).filter(i => i >= 0);
      const summary = active.map(i => {
        const first = samples[30][i], last = samples.at(-1)[i];
        return { i, measuredFrames: last.frames - first.frames, dropped: last.dropped - first.dropped,
          unreadySamples: samples.slice(30).filter(row => row[i].ready < 3).length };
      });
      if (variant === "optimized") {
        for (const item of summary) {
          assert(item.measuredFrames > 300, `Visible optimized cover ${item.i} must keep advancing after initial buffering`);
          assert.equal(item.unreadySamples, 0);
        }
        // Continuous playback survives hover leaving, then stops off-screen or under reduced motion.
        await page.locator("video").first().hover(); await page.mouse.move(1, 1);
        assert.equal(await page.locator("video").first().evaluate(v => v.paused), false);
        await page.emulateMedia({ reducedMotion: "reduce" });
        await page.waitForFunction(() => Array.from(document.querySelectorAll("video")).every(v => v.paused && !v.hasAttribute("src")));
        await page.emulateMedia({ reducedMotion: "no-preference" });
        for (const index of [3, 4, 0]) {
          await page.locator("video").nth(index).scrollIntoViewIfNeeded();
          await page.waitForFunction(i => { const v = document.querySelectorAll("video")[i]; return !v.paused && v.readyState >= 3; }, index, { timeout: 30000 });
        }
        await page.screenshot({ path: path.join(out, `explore-${viewport.width}.png`), fullPage: true });
        await page.getByRole("link", { name: "Upgrade", exact: true }).click(); await page.waitForURL("**/pricing");
      }
      assert.equal(errors.length, 0);
      results.push({ viewport, variant, summary, samples, pageErrors: errors });
      console.log(JSON.stringify({ viewport, variant, summary }));
      write("results.json", JSON.stringify({ results, bytes, requests }, null, 2));
      await context.close();
    }
  }
} finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
