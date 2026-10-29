/* eslint-disable @typescript-eslint/no-require-imports */
// Actual Automation UI; isolated auth, accounts and backend operations. No posts.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { webpack } = require("next/dist/compiled/webpack/webpack");
let playwright;
try { playwright = require("playwright"); }
catch { playwright = require(path.join(process.env.USERPROFILE, ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright")); }
const root = path.resolve(__dirname, "..");
const baseline = process.argv.includes("--before");
const out = path.join(root, ".tmp/trending-followup", baseline ? "ui-before" : "ui-after");
fs.mkdirSync(out, { recursive: true });
const file = (name, source) => fs.writeFileSync(path.join(out, name), source);
file("loader.cjs", `const ts=require(${JSON.stringify(require.resolve("typescript"))});module.exports=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText;`);
file("css.cjs", `module.exports=s=>'const style=document.createElement("style");style.textContent='+JSON.stringify(s)+';document.head.append(style);export default {};';`);
file("module-css.cjs", String.raw`module.exports=function(s){const prefix='automationFixture_',names={};s=s.replace(/\.([a-zA-Z][a-zA-Z0-9_-]*)/g,(_,name)=>{names[name]=prefix+name;return '.'+prefix+name;});return 'const style=document.createElement("style");style.textContent='+JSON.stringify(s)+';document.head.append(style);export default '+JSON.stringify(names)+';';};`);
file("accounts.ts", `export const loadAccountSocialConnections=async()=>[];`);
file("media.tsx", `import {useState} from 'react'; import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog'; export function MediaLibraryPanel(){const [open,setOpen]=useState(false);return <div>Media library fixture<button type="button" onClick={()=>setOpen(true)}>New image collection</button>{open?<Dialog open onOpenChange={setOpen}><DialogContent><DialogTitle>New image collection</DialogTitle><DialogDescription>Fixture collection</DialogDescription><button type="button" onClick={()=>setOpen(false)}>Cancel collection</button></DialogContent></Dialog>:null}</div>}`);
file("client.ts", `import {createDefaultAutomationConfig} from '@/lib/trending/slideshow-automation-contract';
let config=createDefaultAutomationConfig({timezone:'Asia/Kolkata',dailyAllowance:4});
config.startDate=new Date(Date.now()+86400000).toISOString().slice(0,10);
const automation=()=>({userId:'fixture',config,status:'draft',revision:1,rotationCursor:0,activatedAt:null,pausedAt:null,attentionMessage:null,attentionReason:null,updatedAt:new Date().toISOString()});
window.fixtureMutations=[];
export async function fetchSlideshowAutomationState(){if(location.search.includes('error'))throw Error('Fixture load failure');return {automation:automation(),collections:[],savedStyles:[],savedCaptions:[],slots:[],dailyAllowance:4,planDisplayName:'Growth'}}
export async function saveSlideshowAutomationConfig(value){window.fixtureMutations.push('save');config=value;return automation()}
export async function activateSlideshowAutomationRequest(){window.fixtureMutations.push('activate');throw Error('Fixture must not activate')}
export async function pauseSlideshowAutomationRequest(){throw Error('Unexpected pause')}
export async function mutateAutomationSlotRequest(){throw Error('Unexpected slot mutation')}
export async function saveVisualStylePresetRequest(){throw Error('Unexpected style save')}
export async function deleteVisualStylePresetRequest(){throw Error('Unexpected style delete')}
`);
file("entry.tsx", `import {createRoot} from 'react-dom/client';import {QueryClient,QueryClientProvider} from '@tanstack/react-query';import {TrendingSlideshowAutomationWorkspace} from 'automation-under-test';createRoot(document.getElementById('root')).render(<QueryClientProvider client={new QueryClient()}><TrendingSlideshowAutomationWorkspace userId="fixture" initialBrowserTimezone="Asia/Kolkata" open onClose={()=>{}}/></QueryClientProvider>);`);
async function main() {
  await new Promise((resolve, reject) => {
    const compiler = webpack({ mode: "development", devtool: false, context: root, entry: path.join(out, "entry.tsx"), output: { path: out, filename: "bundle.js" },
      resolve: { extensions: [".tsx", ".ts", ".js"], alias: {
        "automation-under-test": path.join(root, baseline ? ".tmp/trending-followup/automation-workspace.before.tsx" : "components/trending/trending-slideshow-automation-workspace.tsx"),
        "@/lib/trending/slideshow-automation-client": path.join(out, "client.ts"),
        "@/lib/scheduling/account-data-query": path.join(out, "accounts.ts"),
        "@/components/media/media-library-dialog": path.join(out, "media.tsx"), "@": root,
      } }, module: { rules: [{ test: /\.tsx?$/, use: path.join(out, "loader.cjs") }, { test: /\.module\.css$/, use: path.join(out, "module-css.cjs") }, { test: /\.css$/, exclude: /\.module\.css$/, use: path.join(out, "css.cjs") }] } });
    compiler.run((error, stats) => compiler.close(() => error || stats.hasErrors() ? reject(error || Error(stats.toString({ all: false, errors: true }))) : resolve()));
  });
  const css = require("./compiled-browser-css.cjs")(root);
  const server = http.createServer((req, res) => {
    if (req.url === "/bundle.js") { res.setHeader("Content-Type", "text/javascript"); return res.end(fs.readFileSync(path.join(out, "bundle.js"))); }
    res.setHeader("Content-Type", "text/html");
    res.end(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><body class="bg-background text-foreground"><div id="root"></div><script src="/bundle.js"></script></body>`);
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const browser = await playwright.chromium.launch({ headless: true, ...(process.platform === "win32" ? { channel: "msedge" } : {}) });
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errors = []; page.on("pageerror", error => errors.push(error.message));
      await page.goto(`http://127.0.0.1:${server.address().port}`);
      await page.getByText("Step 1 of 4 · Content & Daily Count", { exact: true }).waitFor();
      await page.screenshot({ path: path.join(out, `content-${width}.png`) });
      if (!baseline) {
        const buttons = page.locator('[data-slot="button"]:visible');
        for (let i = 0; i < await buttons.count(); i++) {
          const geometry = await buttons.nth(i).evaluate(el => ({ radius: parseFloat(getComputedStyle(el).borderTopLeftRadius), height: el.getBoundingClientRect().height }));
          assert.ok(geometry.radius >= geometry.height / 2, JSON.stringify(geometry));
        }
      }
      await page.getByRole("button", { name: "Continue to Appearance" }).click();
      await page.getByText("Step 2 of 4 · Appearance", { exact: true }).waitFor();
      await page.getByRole("radio", { name: /Use my collection only/ }).check();
      await page.getByText(/You don't have any image collections/).waitFor();
      if (!baseline) {
        const primary = page.getByRole("button", { name: "Create collection & upload images" });
        const bounds = await primary.boundingBox();
        assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width, "collection recovery action fits mobile viewport");
        await primary.click();
        const library = page.getByRole("dialog", { name: "Media library" });
        await page.screenshot({ path: path.join(out, `library-${width}.png`) });
        await library.getByRole("button", { name: "New image collection" }).click();
        const nested = page.getByRole("dialog", { name: "New image collection" });
        await page.screenshot({ path: path.join(out, `library-collection-${width}.png`) });
        await nested.getByRole("button", { name: "Cancel collection" }).click();
        await library.getByRole("button", { name: "Close" }).click();
        await page.getByText(/You don't have any image collections/).waitFor();
      }
      await page.screenshot({ path: path.join(out, `appearance-${width}.png`) });
      const mutations = await page.evaluate(() => window.fixtureMutations);
      assert.ok(mutations.every(value => value === "save"), "no implicit activation/scheduling");
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
      assert.deepEqual(errors, []);
      await page.goto(`http://127.0.0.1:${server.address().port}/?error`);
      await page.getByText("Fixture load failure", { exact: true }).waitFor();
      assert.deepEqual(await page.evaluate(() => window.fixtureMutations), []);
      await page.close();
    }
    console.log(`PASS: actual Automation ${baseline ? "baseline" : "updated"} UI desktop/mobile, empty collection, load failure, no implicit activation${baseline ? "" : ", pill radii"}.`);
  } finally { await browser.close(); server.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
