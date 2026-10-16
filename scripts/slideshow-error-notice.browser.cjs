/* eslint-disable @typescript-eslint/no-require-imports -- Isolated real-component browser verification. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { webpack } = require("next/dist/compiled/webpack/webpack");
let playwright;
try { playwright = require("playwright"); }
catch { playwright = require(path.join(process.env.USERPROFILE, ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright")); }

const root = path.resolve(__dirname, ".."), out = path.join(root, ".tmp/slideshow-error-notice-browser");
fs.mkdirSync(out, { recursive: true });
const file = (name, content) => fs.writeFileSync(path.join(out, name), content);
file("loader.cjs", `const ts=require(${JSON.stringify(require.resolve("typescript"))});module.exports=source=>ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText;`);
file("entry.tsx", `import {createRoot} from 'react-dom/client';import {useState} from 'react';import {AiStudioResults} from '@/components/generation/ai-studio-results';
const label="The job failed, but the cause could not be identified automatically. This job cannot be retried. Contact support with this job's ID.";
function Fixture(){const [job,setJob]=useState('failed-one'),[tone,setTone]=useState('error'),[poll,setPoll]=useState(0),[enabled,setEnabled]=useState(true),[mounted,setMounted]=useState(true),[results,setResults]=useState(false),[history,setHistory]=useState(false);
window.noticeFixture={poll:()=>setPoll(n=>n+1),fail:id=>{setJob(id);setTone('error');},progress:()=>setTone('progress'),persistent:()=>setEnabled(false),unmount:()=>setMounted(false),remount:()=>setMounted(true),results:()=>setResults(true)};
return <main style={{display:'flex',flexDirection:'column',height:'100dvh',padding:16}}><p data-testid='saved-job-status'>failed</p><p data-testid='poll-count'>{poll}</p>{mounted?<AiStudioResults ariaLabel='Generated images' hasResults={results} loading={false} status={{tone,label:tone==='progress'?'Creating your image…':label}} dismissibleStatusKey={enabled?job:undefined} toolbar={<button onClick={()=>setHistory(v=>!v)}>History</button>} emptyContent={<p>Your images will appear here</p>}><article>Existing generated slide</article></AiStudioResults>:null}{history?<p>Saved job: failed. Existing images retained.</p>:null}</main>}
createRoot(document.getElementById('root')).render(<Fixture/>);`);

async function main() {
  await new Promise((resolve, reject) => {
    const compiler = webpack({ mode: "development", devtool: false, context: root, entry: path.join(out, "entry.tsx"), output: { path: out, filename: "bundle.js" },
      resolve: { extensions: [".tsx", ".ts", ".js"], alias: { "@": root } }, module: { rules: [{ test: /\.tsx?$/, use: path.join(out, "loader.cjs") }] } });
    compiler.run((error, stats) => compiler.close(() => error || stats.hasErrors() ? reject(error || new Error(stats.toString({ all: false, errors: true }))) : resolve()));
  });
  const styleSource = fs.readFileSync(path.join(root, "app/globals.css"), "utf8").replace('@import "tailwindcss";', '@import "tailwindcss" source(none);\n@source "../components/generation";\n@source "../components/ui";');
  const css = (await require("postcss")([require("@tailwindcss/postcss")({ base: root })]).process(styleSource, { from: path.join(root, "app/globals.css") })).css;
  let apiRequests = 0;
  const server = http.createServer((request, response) => {
    if (request.url === "/bundle.js") { response.setHeader("Content-Type", "text/javascript"); response.end(fs.readFileSync(path.join(out, "bundle.js"))); return; }
    if (request.url === "/style.css") { response.setHeader("Content-Type", "text/css"); response.end(css); return; }
    if (request.url.startsWith("/api/")) apiRequests += 1;
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.end('<!doctype html><html class="dark"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><style>body{margin:0;background:var(--background);color:var(--foreground);font-family:Arial}</style></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>');
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  let browser;
  try {
    browser = await playwright.chromium.launch({ headless: true, ...(process.platform === "win32" ? { channel: "msedge" } : {}) });
    const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
    const errors = []; page.on("pageerror", error => errors.push(error.message));
    await page.clock.install();
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 5_000));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    const alert = page.getByRole("alert"), close = page.getByRole("button", { name: "Dismiss generation error", exact: true });
    await alert.waitFor();
    await page.screenshot({ path: path.join(out, "desktop.png") });
    await page.clock.runFor(2_000);
    await page.evaluate(() => window.noticeFixture.poll());
    await page.getByTestId("poll-count").filter({ hasText: "1" }).waitFor();
    await page.clock.runFor(999); assert.equal(await alert.count(), 1);
    await page.clock.runFor(1); assert.equal(await alert.count(), 0, "same-job polling cannot restart the three-second timer");
    await page.evaluate(() => window.noticeFixture.poll());
    assert.equal(await alert.count(), 0, "a dismissed failure stays hidden on refresh");
    await page.evaluate(() => window.noticeFixture.fail("failed-two")); await close.waitFor();
    await close.focus(); await close.press("Enter"); assert.equal(await alert.count(), 0, "the × is keyboard accessible");
    assert.equal(await page.getByTestId("saved-job-status").textContent(), "failed");
    await page.getByRole("button", { name: "History", exact: true }).click();
    await page.getByText("Saved job: failed. Existing images retained.", { exact: true }).waitFor();
    await page.evaluate(() => window.noticeFixture.fail("failed-three")); await alert.waitFor();
    await page.clock.runFor(2_000);
    await page.evaluate(() => window.noticeFixture.fail("failed-four")); await alert.waitFor();
    await page.clock.runFor(2_999); assert.equal(await alert.count(), 1, "a distinct failure gets a fresh timer");
    await page.clock.runFor(1); assert.equal(await alert.count(), 0);
    await page.evaluate(() => { window.noticeFixture.results(); window.noticeFixture.fail("failed-five"); });
    await page.getByText("Existing generated slide", { exact: true }).waitFor();
    await close.click(); assert.equal(await alert.count(), 0); assert.equal(await page.getByText("Existing generated slide", { exact: true }).count(), 1);
    await page.evaluate(() => window.noticeFixture.progress());
    await page.getByRole("status").waitFor();
    await page.clock.runFor(10_000); assert.equal(await page.getByRole("status").count(), 1, "progress remains visible");
    assert.equal(await close.count(), 0);
    await page.evaluate(() => window.noticeFixture.fail("failed-six")); await alert.waitFor();
    await page.clock.runFor(2_000); await page.evaluate(() => window.noticeFixture.unmount());
    await page.clock.runFor(2_000); await page.evaluate(() => window.noticeFixture.remount()); await alert.waitFor();
    await page.clock.runFor(2_999); assert.equal(await alert.count(), 1, "an unmounted component's timer cannot dismiss the next notice");
    await page.clock.runFor(1); assert.equal(await alert.count(), 0);
    await page.evaluate(() => window.noticeFixture.fail("mobile-failure")); await alert.waitFor();
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.equal(await close.isVisible(), true); await page.screenshot({ path: path.join(out, "mobile.png") });
    await close.click(); assert.equal(await alert.count(), 0);
    await page.evaluate(() => window.noticeFixture.persistent());
    await alert.waitFor();
    await page.clock.runFor(10_000); assert.equal(await alert.count(), 1, "other workflows keep persistent error behavior");
    assert.equal(await close.count(), 0); assert.equal(apiRequests, 0); assert.deepEqual(errors, []);
    console.log("PASS: error auto-dismisses at three seconds; polling does not revive it; × supports mouse/keyboard; new failures restart timing; unmount cleans timers; progress, existing results and persistent notices remain intact; desktop/mobile fit; no API calls.");
  } finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
