/* eslint-disable @typescript-eslint/no-require-imports -- Real browser/module-loader regression; auth reads are isolated and no generation is allowed. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { webpack } = require("next/dist/compiled/webpack/webpack");
const root = process.cwd();
const out = path.join(root, ".tmp/hook-starting-frame-opening");
fs.mkdirSync(out, { recursive: true });
const write = (name, value) => fs.writeFileSync(path.join(out, name), value);
write("auth.ts", "export const useAuth=()=>({user:null,loading:false});export const getCurrentUserIdToken=async()=>null;");
write("image.tsx", "export default function Image({fill,unoptimized,...props}){return <img {...props}/>;}");
write("navigation.ts", "export const useRouter=()=>({push(){}});export const useSearchParams=()=>new URLSearchParams();");
write("loader.cjs", `const ts=require(${JSON.stringify(require.resolve("typescript"))});module.exports=function(s){return ts.transpileModule(s,{fileName:this.resourcePath,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText};`);
write("css.cjs", `const fs=require('node:fs'),path=require('node:path');module.exports=function(s){const prefix='ui_'+path.basename(this.resourcePath).replace(/[^a-z]/gi,'_')+'_',names={};s=s.replace(/\\.([a-zA-Z_][\\w-]*)/g,(_,n)=>{names[n]=prefix+n;return '.'+prefix+n}).replace(/:global\\(([^)]+)\\)/g,'$1');fs.appendFileSync(${JSON.stringify(path.join(out, "modules.css"))},s+'\\n');return 'export default '+JSON.stringify(names)};`);
write("entry.tsx", `import React,{Component,useState} from 'react';import{createRoot}from'react-dom/client';import{QueryClient,QueryClientProvider}from'@tanstack/react-query';import{LazyHookStartingFrameWorkspace}from'@/components/explore/lazy-hook-starting-frame-workspace';
class PageBoundary extends Component{state={failed:false};static getDerivedStateFromError(){return{failed:true}}render(){return this.state.failed?<h1>Something interrupted this page.</h1>:this.props.children}}
const reference={id:'explore-paired-hook-43cc1dae0a6cfcb03e0a9333',title:'Hook 14',format:'hook',slides:[],videoUrl:'https://example.invalid/928ee9942d157b5e22797ca819bf01e8087b9e3f6285f0f27ad26d64a6484df0.mp4'};
function App(){const[open,setOpen]=useState(false);return <><h1>Hook video</h1><input aria-label='Unsaved instructions' defaultValue='Preserve my draft'/><button onClick={()=>setOpen(true)}>Recreate</button>{open?<LazyHookStartingFrameWorkspace reference={reference} ownerId='isolated-owner' draftId='00000000-0000-4000-8000-000000000001' presentation={new URLSearchParams(location.search).get('presentation')||'recreation'} onClose={()=>setOpen(false)}/>:null}</>};createRoot(document.getElementById('root')).render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><PageBoundary><App/></PageBoundary></QueryClientProvider>);`);

async function main() {
  write("modules.css", "");
  const globals = fs.readFileSync("app/globals.css", "utf8").replace('@import "tailwindcss";', '@import "tailwindcss" source(none);') + '\n@source "../components";';
  write("global.css", (await require("postcss")([require("@tailwindcss/postcss")()]).process(globals, { from: path.join(root, "app/globals.css") })).css);
  await new Promise((resolve, reject) => {
    const compiler = webpack({ mode: "development", devtool: false, context: root,
      entry: path.join(out, "entry.tsx"), output: { path: out, filename: "bundle.js" },
      plugins: [new webpack.NormalModuleReplacementPlugin(/firebase[\/]auth(?:\.ts)?$/, path.join(out, "auth.ts")),
        new webpack.DefinePlugin({ "process.env": "({NODE_ENV:'production'})" })],
      resolve: { extensions: [".tsx", ".ts", ".js"], alias: {
        "@/lib/firebase/auth": path.join(out, "auth.ts"), "@/contexts/auth-context": path.join(out, "auth.ts"),
        "next/image": path.join(out, "image.tsx"), "next/navigation": path.join(out, "navigation.ts"), "@": root } },
      module: { rules: [{ test: /\.tsx?$/, use: path.join(out, "loader.cjs") }, { test: /\.css$/, use: path.join(out, "css.cjs") }] } });
    compiler.run((error, stats) => compiler.close(() => error || stats.hasErrors()
      ? reject(error || Error(stats.toString({ all: false, errors: true }))) : resolve()));
  });
  const server = http.createServer((request, response) => {
    const pathname = new URL(request.url, "http://localhost").pathname;
    if (pathname.endsWith(".js") || pathname.endsWith(".css")) {
      const file = path.join(out, path.basename(pathname));
      if (!fs.existsSync(file)) { response.writeHead(404); response.end(); return; }
      response.setHeader("Content-Type", pathname.endsWith(".css") ? "text/css" : "text/javascript"); fs.createReadStream(file).pipe(response); return;
    }
    response.setHeader("Content-Type", "text/html");
    response.end('<!doctype html><html class="dark"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/global.css"><link rel="stylesheet" href="/modules.css"><body class="instagram-theme"><div id="root"></div><script src="/bundle.js"></script></body></html>');
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const { chromium } = require(path.join(process.env.USERPROFILE, ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright"));
  const browser = await chromium.launch({ headless: true, channel: "msedge" });
  const receipts = [];
  try {
    for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      for (const presentation of ["recreation", "workspace"]) {
        const page = await browser.newPage({ viewport });
        let attempts = 0; const writes = [], errors = [], consoleErrors = [];
        page.on("pageerror", error => errors.push(error.message));
        page.on("console", message => { if (message.type() === "error") consoleErrors.push(message.text()); });
        await page.route("**/api/**", route => {
          if (route.request().method() !== "GET") writes.push(route.request().url());
          return route.fulfill({ status: 401, contentType: "application/json", body: '{"ok":false,"error":"Isolated signed-out read"}' });
        });
        await page.route("**/components_explore_hook-starting-frame-workspace_tsx.bundle.js", async route => {
          attempts++;
          if (attempts === 1) return route.fulfill({ status: 503, body: "Temporary bundle failure" });
          return route.continue();
        });
        await page.goto(`http://127.0.0.1:${server.address().port}?presentation=${presentation}`);
        await page.evaluate(() => localStorage.setItem("saved-preparation-marker", "preserve"));
        await page.getByRole("button", { name: "Recreate", exact: true }).click();
        if (process.env.HOOK_OPENING_EXPECT_BROKEN === "1") {
          await page.getByRole("heading", { name: "Something interrupted this page.", exact: true }).waitFor();
          await page.screenshot({ path: path.join(out, "before-page-crash.png"), animations: "disabled" });
          console.log("REPRODUCED: one failed starting-frame chunk replaces the Hook page.");
          return;
        }
        await page.getByRole("button", { name: "Retry opening", exact: true }).waitFor();
        assert.equal(await page.getByRole("heading", { name: "Hook video", exact: true, includeHidden: true }).count(), 1);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
        await page.screenshot({ path: path.join(out, `${presentation}-${viewport.width}-recoverable.png`), animations: "disabled" });
        if (presentation === "recreation" && viewport.width === 390) {
          await page.getByRole("button", { name: "Back to references", exact: true }).click();
          await page.getByRole("button", { name: "Retry opening", exact: true }).waitFor({ state: "hidden" });
          assert.equal(await page.getByLabel("Unsaved instructions").inputValue(), "Preserve my draft");
          await page.getByRole("button", { name: "Recreate", exact: true }).click();
        } else {
          await page.getByRole("button", { name: "Retry opening", exact: true }).click();
        }
        await page.getByRole("heading", { name: "Create your starting frame", exact: true }).waitFor();
        await page.getByRole("region", { name: "Face identity photos", exact: true }).waitFor().catch(async error => {
          write("failure.json", JSON.stringify({ attempts, consoleErrors, errors, body: await page.locator("body").innerText() }, null, 2));
          throw error;
        });
        assert.equal(attempts, 2, "Retry must perform a new import, not reuse a rejected lazy instance");
        assert.equal(await page.getByLabel("Unsaved instructions").inputValue(), "Preserve my draft");
        assert.equal(await page.evaluate(() => localStorage.getItem("saved-preparation-marker")), "preserve");
        assert.deepEqual(writes, []); assert.deepEqual(errors, []);
        await page.screenshot({ path: path.join(out, `${presentation}-${viewport.width}-opened.png`), animations: "disabled" });
        if (presentation === "recreation") {
          await page.keyboard.press("Escape");
          await page.getByRole("heading", { name: "Create your starting frame", exact: true }).waitFor({ state: "hidden" });
          await page.getByRole("button", { name: "Recreate", exact: true }).click();
          await page.getByRole("group", { name: "Starting frame approval", exact: true }).waitFor();
          assert.equal(attempts, 2);
        }
        receipts.push({ viewport, presentation, failedChunkContained: true, freshRetry: true, realComponentOpened: true, draftPreserved: true, writes, pageErrors: errors });
        await page.close();
      }
    }
    write("results.json", JSON.stringify({ receipts, limits: "Actual React, wrapper, production-mode component, styles/dialog and browser chunk loader. Isolated auth/API failures; no authenticated production or paid-generation claim. Local fixture screenshots are not hosted acceptance." }, null, 2));
    console.log(`PASS ${receipts.length} starting-frame opening/retry browser scenarios`);
  } finally { await browser.close(); server.closeAllConnections(); server.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
