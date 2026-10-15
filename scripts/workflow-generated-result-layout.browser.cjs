/* eslint-disable @typescript-eslint/no-require-imports -- Real preview layout check with no live account. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { webpack } = require("next/dist/compiled/webpack/webpack");

let playwright;
try { playwright = require("playwright"); }
catch { playwright = require(path.join(process.env.USERPROFILE, ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright")); }

const root = path.resolve(__dirname, "..");
const out = path.join(root, ".tmp", "workflow-generated-result-layout");
fs.mkdirSync(out, { recursive: true });
const file = (name, content) => fs.writeFileSync(path.join(out, name), content);

file("loader.cjs", `const ts=require(${JSON.stringify(require.resolve("typescript"))});module.exports=source=>ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText;`);
file("css.cjs", `module.exports=function(source){const prefix=this.resourcePath.replace(/[^a-zA-Z]/g,'')+'_';const names=Object.fromEntries([...source.matchAll(/\\.([a-zA-Z][a-zA-Z0-9_-]*)/g)].map(m=>[m[1],prefix+m[1]]));const css=source.replaceAll(/:global\\(([^)]+)\\)/g,'$1').replaceAll(/\\.([a-zA-Z][a-zA-Z0-9_-]*)/g,(_,name)=>'.'+names[name]);return 'const style=document.createElement("style");style.textContent='+JSON.stringify(css)+';document.head.append(style);export default '+JSON.stringify(names)+';';};`);
file("ui.tsx", `export const Button=({variant='default',className='',...props})=><button {...props} className={(variant==='outline'?'outline':'primary')+' '+className}/>; export const WorkflowMediaPlayer=({asset,label,className=''})=><video aria-label={label} className={className} controls preload="metadata" src={asset.url}/>; export const VideoGenerationPlaceholder=()=>null;`);
file("entry.tsx", `import {createRoot} from 'react-dom/client';import {useState} from 'react';import {WorkflowPreviewCanvas} from '@/components/explore/workflow-preview-canvas';import sections from '@/components/explore/workflow-section-layout.module.css';
const asset={id:'video-1',title:'Generated WAN video',url:'/video.mp4',durationSeconds:3};
function App(){const [selected,setSelected]=useState(null);const generation={busy:false,error:null,results:[asset],selected:selected?asset:null,selectResult:()=>setSelected(asset.id)};return <main><h1>Talking Head + Demo</h1><section data-preview-shell><WorkflowPreviewCanvas kind="hook" generation={generation}/><div className={sections.nextStage}><button type="button">Continue to edit</button></div></section></main>}createRoot(document.getElementById('root')).render(<App/>);`);

async function main() {
  await new Promise((resolve, reject) => {
    const compiler = webpack({
      mode: "development", devtool: false,
      entry: path.join(out, "entry.tsx"), output: { path: out, filename: "bundle.js" },
      resolve: { extensions: [".tsx", ".ts", ".js"], alias: {
        "@/components/ui/button": path.join(out, "ui.tsx"),
        "@/components/explore/hook-workflow-media-controls": path.join(out, "ui.tsx"),
        "@/components/video/video-generation-placeholder": path.join(out, "ui.tsx"), "@": root,
      } },
      module: { rules: [{ test: /\.tsx?$/, use: path.join(out, "loader.cjs") }, { test: /\.css$/, use: path.join(out, "css.cjs") }] },
    });
    compiler.run((error, stats) => compiler.close(() => error || stats.hasErrors() ? reject(error || Error(stats.toString({ all: false, errors: true }))) : resolve()));
  });
  const server = http.createServer((request, response) => {
    if (request.url === "/bundle.js") { response.setHeader("Content-Type", "application/javascript"); return response.end(fs.readFileSync(path.join(out, "bundle.js"))); }
    if (request.url === "/video.mp4") { response.setHeader("Content-Type", "video/mp4"); return response.end(fs.readFileSync(path.join(root, "public", "explore", "covers", "hook-video-v1.mp4"))); }
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.end('<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>:root{--background:#1d1d1d;--foreground:#f7f4ef;--foreground-strong:#fff;--card:#242424;--card-muted:#292929;--border:#484848;--muted:#b7b1aa;--primary:#ff6d4a;--primary-foreground:#191919}*{box-sizing:border-box}body{margin:0;background:var(--background);color:var(--foreground);font:15px system-ui}main{max-width:1500px;margin:32px auto;padding:0 20px}h1{font-size:20px}button{border:1px solid #555;border-radius:8px;min-height:40px;padding:8px 14px;color:var(--foreground);background:var(--card);font:600 14px system-ui}.primary{border-color:var(--primary);background:var(--primary);color:var(--primary-foreground)}[data-preview-shell]{min-height:680px;border:1px solid var(--border);border-radius:16px;overflow:hidden}video{background:#000}</style><div id="root"></div><script src="/bundle.js"></script>');
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  let browser;
  try {
    browser = await playwright.chromium.launch({ headless: true, ...(process.platform === "win32" ? { channel: "msedge" } : {}) });
    const page = await browser.newPage();
    const checks = [];
    for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      await page.goto(`http://127.0.0.1:${server.address().port}`);
      const choose = page.getByRole("button", { name: "Use video 1", exact: true });
      await choose.click();
      const layout = await page.evaluate(() => {
        const card = document.querySelector('[aria-label="Generated video 1"]').getBoundingClientRect();
        const choice = [...document.querySelectorAll("button")].find(button => button.textContent === "Use video 1").getBoundingClientRect();
        const next = [...document.querySelectorAll("button")].find(button => button.textContent === "Continue to edit").getBoundingClientRect();
        return { card: { x: card.x, width: card.width }, choice: { x: choice.x, y: choice.y, width: choice.width, right: choice.right }, next: { x: next.x, width: next.width, right: next.right }, overflow: document.documentElement.scrollWidth > innerWidth };
      });
      assert.equal(layout.overflow, false, JSON.stringify({ viewport, layout }));
      assert.ok(layout.choice.width < Math.min(layout.card.width * .6, 220), JSON.stringify({ viewport, layout }));
      assert.ok(Math.abs(layout.choice.x + layout.choice.width / 2 - (layout.card.x + layout.card.width / 2)) < 2, JSON.stringify({ viewport, layout }));
      assert.ok(layout.next.right <= viewport.width, JSON.stringify({ viewport, layout }));
      assert.ok(Math.abs(layout.next.x + layout.next.width / 2 - viewport.width / 2) < 2, JSON.stringify({ viewport, layout }));
      checks.push({ viewport, layout });
      await page.screenshot({ path: path.join(out, `generated-result-${viewport.width}.png`), fullPage: true, animations: "disabled" });
    }
    fs.writeFileSync(path.join(out, "results.json"), JSON.stringify(checks, null, 2));
    console.log("PASS generated-video actions are compact, centered and inside desktop/mobile previews.");
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
