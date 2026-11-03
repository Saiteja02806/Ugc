import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";

// Actual reference-card/media/source controls and TalkingHeadReferences. Only
// auth, provider reads, playback and modal contents are isolated; no paid calls.
const require = createRequire(import.meta.url), root = process.cwd();
let pw;
try { pw = require("playwright"); }
catch { pw = require(path.join(process.env.USERPROFILE, ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright")); }
const { webpack } = require("next/dist/compiled/webpack/webpack");
const before = process.argv.includes("--before");
const badgeReview = process.argv.includes("--badges");
const reviewRoot = badgeReview ? ".tmp/new-pill" : ".tmp/recreate-standard";
const out = path.join(root, reviewRoot, before ? "before" : "after");
mkdirSync(out, { recursive: true });
const write = (name, value) => { const file = path.join(out, name); writeFileSync(file, value); return file; };
const workspace = readFileSync(path.join(root, before ? `${reviewRoot}/recreate-workspace.before.tsx` : "components/explore/recreate-workspace.tsx"), "utf8");
const studioCss = before ? path.join(root, `${reviewRoot}/workflow-studio.before.css`) : path.join(root, "components/explore/workflow-studio.module.css");
const talkingCss = before ? path.join(root, `${reviewRoot}/talking-head.before.css`) : path.join(root, "components/explore/talking-head-references.module.css");
const poster = "/explore/influencer-studio/accessories/over-ear-headphones.png";
const aliases = {
  "next/link": write("link.tsx", "export default function Link(props){return <a {...props}/>;}"),
  "@/components/generation/use-ai-studio-access": write("access.ts", "export const useAIStudioAccess=()=> 'pro';"),
  "@/components/explore/lazy-hook-starting-frame-workspace": write("warm.ts", "export async function preloadHookStartingFrameWorkspace(){window.warmed=(window.warmed||0)+1;}"),
  "@/components/explore/talking-head-references.module.css": talkingCss,
  "@/components/explore/workflow-studio.module.css": studioCss,
};
write("card.tsx", `import {useRef,useState} from 'react';import {Check,RotateCcw,Layers3} from 'lucide-react';
import {Button} from '@/components/ui/button';import {cn} from '@/lib/utils';
import studio from '@/components/explore/workflow-studio.module.css';
import {SocialPlatformIcon} from '@/components/social/platform-icon';
import Link from 'next/link';import {getReferenceSource,referenceSourceLabel} from '@/lib/explore/reference-source-link';
const useBillingSubscription=()=>({isSuccess:true,isFetching:false,isError:false,data:{isActive:true,planKey:'starter'}});
const canOpenReferenceSource=()=>true;
const useCreatorVideoPreview=()=>({url:undefined,failed:false,loading:false});const useCoverPlayback=()=>useRef(null);
const Dialog=()=>null,DialogContent=()=>null,DialogHeader=()=>null,DialogTitle=()=>null,DialogDescription=()=>null;
export const ReferencePreviewDialog=({open})=>open?<div role="dialog">Preview fixture</div>:null;
export const ReferenceGridSkeleton=()=>null,LoadError=()=>null;
${workspace.slice(workspace.indexOf("export function ReferenceCard("), workspace.indexOf("export function ReferencePreviewDialog("))}
`);
let talking = readFileSync(path.join(root, before ? `${reviewRoot}/talking-head-references.before.tsx` : "components/explore/talking-head-references.tsx"), "utf8");
talking = talking.replace('from "./recreate-workspace"', 'from "./card"').replace(/from "\.\/(?!card)([^"]+)"/g, 'from "@/components/explore/$1"');
write("talking.tsx", talking);
const catalogue = JSON.parse(readFileSync("lib/explore/talking-head-reference-catalog.json", "utf8"));
const ready = { ...catalogue.items.find(item => item.id === "talking-car-story-full"), slides: [], posterUrl: poster, videoUrl: undefined, sourceSha256: "a".repeat(64), title: "Ready example" };
const unavailable = { ...ready, id: "talking-warm-story", title: "Awaiting example", sourceSha256: undefined };
write("entry.tsx", `import {createRoot}from'react-dom/client';import{useState}from'react';import{ReferenceCard}from'./card';import{TalkingHeadReferences}from'./talking';
import presentation from '@/components/explore/workflow-video-layout.module.css';
function App(){const[selected,select]=useState(null),[clicks,setClicks]=useState(0),[previews,setPreviews]=useState(0),[disabled,setDisabled]=useState(false);window.setFixtureDisabled=setDisabled;const choose=id=>{select(id);setClicks(n=>n+1)};return <main className={presentation.videoWorkspace}><h1>Workflow Recreate actions</h1><output data-selections>{clicks}</output><output data-previews>{previews}</output><div className={'fixture-grid '+presentation.exampleGrid}>{['hook','wall_text','slideshow'].map(format=><section key={format} data-fixture-format={format}><h2>{format}</h2><ReferenceCard reference={{id:format,title:format,format,isNew:${badgeReview},posterUrl:'${poster}',sourceUrl:format==='hook'?'https://www.instagram.com/reel/fixture/':undefined,videoUrl:undefined,slides:format==='slideshow'?[{width:1080,height:1350}]:[]}} compact hideCaption={format==='wall_text'} showActionLabel overlayActions={format==='hook'} canOpenSource isSelected={selected===format} onPreview={()=>setPreviews(n=>n+1)} onRecreate={()=>choose(format)}/></section>)}</div><h2>Talking Head</h2><TalkingHeadReferences items={${JSON.stringify([ready, unavailable])}} startingFrameEnabled model="seedance_2_5" loading={false} failed={false} disabled={disabled} selectedId={selected} onChoose={choose} onRetry={()=>{}}/></main>}createRoot(document.getElementById('root')).render(<App/>);`);
write("css.cjs", `module.exports=source=>'const s=document.createElement("style");s.textContent='+JSON.stringify(source)+';document.head.append(s);export default '+JSON.stringify(Object.fromEntries([...source.matchAll(/\\.([a-zA-Z][a-zA-Z0-9_-]*)/g)].map(m=>[m[1],m[1]])))+';';`);
write("loader.cjs", `const ts=require(${JSON.stringify(require.resolve("typescript"))});module.exports=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText;`);
await new Promise((resolve, reject) => {
  const compiler = webpack({ mode: "development", target: "web", devtool: false, context: root, entry: path.join(out, "entry.tsx"), output: { path: out, filename: "entry.js", publicPath: "/" }, resolve: { extensions: [".tsx", ".ts", ".js"], alias: { ...aliases, "@": root } }, module: { rules: [{ test: /\.tsx?$/, use: path.join(out, "loader.cjs"), exclude: /node_modules/ }, { test: /\.css$/, use: path.join(out, "css.cjs") }] } });
  compiler.run((error, stats) => compiler.close(() => error || stats.hasErrors() ? reject(error ?? Error(stats.toString({ all: false, errors: true }))) : resolve()));
});
const globals = readFileSync("app/globals.css", "utf8").replace('@import "tailwindcss";', '@import "tailwindcss" source(none);') + `\n@source "../${reviewRoot}";\n@source "../components/ui";`;
write("fixture.css", (await postcss([tailwind({ base: root })]).process(globals, { from: path.join(root, "app/globals.css") })).css);
const html = '<!doctype html><html class="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"><style>body{margin:0}main{max-width:1100px;margin:auto;padding:16px}.fixture-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}h1,h2{margin:12px 0}output{margin-right:12px}@media(max-width:600px){.fixture-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}.fixture-grid>section{min-width:0}</style></head><body class="app-canvas"><div id="root"></div><script src="/entry.js"></script></body></html>';
const server = createServer((req, res) => {
  const pathname = new URL(req.url, "http://fixture").pathname;
  if (pathname === "/") { res.setHeader("Content-Type", "text/html"); res.end(html); return; }
  const file = pathname.startsWith("/explore/") ? path.join(root, "public", pathname) : path.resolve(out, `.${pathname}`);
  if ((!file.startsWith(out + path.sep) && !file.startsWith(path.join(root, "public") + path.sep)) || !existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.setHeader("Content-Type", file.endsWith(".png") ? "image/png" : file.endsWith(".css") ? "text/css" : "text/javascript"); res.end(readFileSync(file));
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await pw.chromium.launch({ headless: true, channel: "msedge" });
  for (const width of [1440, 390, 320]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, isMobile: width < 600, hasTouch: width < 600 });
    const page = await context.newPage();
    page.on("pageerror", error => console.error("Fixture browser error:", error.message));
    await page.goto(origin); await page.getByRole("button", { name: "Recreate hook", exact: true }).waitFor();
    if (badgeReview) {
      const badges=page.locator('[data-reference-new]'); assert.equal(await badges.count(),3);
      if (!before) for(const badge of await badges.all()){
        const info=await badge.evaluate(e=>{const r=e.getBoundingClientRect(),p=e.parentElement.getBoundingClientRect(),s=getComputedStyle(e);return {left:r.left-p.left,top:r.top-p.top,height:r.height,color:s.color,pointer:s.pointerEvents,role:e.getAttribute('role'),label:e.textContent};});
        assert.equal(info.left,12);assert.equal(info.top,12);assert.equal(info.height,24);assert.equal(info.color,'rgb(245, 248, 255)');assert.equal(info.pointer,'none');assert.equal(info.role,null);assert.equal(info.label,'New');
      }
    }
    if (!before) {
      const actions = page.locator("[data-reference-recreate]"); assert.equal(await actions.count(), 5);
      for (const action of await actions.all()) {
        const info = await action.evaluate(e => { const b=e.getBoundingClientRect(),p=e.closest('article').getBoundingClientRect(),s=getComputedStyle(e);return {height:b.height,left:b.left,right:b.right,bottom:b.bottom,parent:p.bottom,width:innerWidth,color:s.color,position:s.position,borderRadius:s.borderRadius,text:e.textContent,clipped:e.scrollWidth>e.clientWidth}; });
        assert.equal(info.color, "rgb(255, 255, 255)"); assert.equal(info.position, "absolute"); assert(info.height >= (width < 600 ? 44 : 36));
        assert(info.left >= 0 && info.right <= width && info.bottom <= info.parent + 1, JSON.stringify(info));
        assert.match(info.text, /Recreate|Preview only/);
        assert.equal(info.clipped, false, JSON.stringify(info));
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      for (const format of ["hook", "wall_text", "slideshow"]) { const action=page.getByRole("button",{name:`Recreate ${format}`,exact:true});await action.focus();await page.keyboard.press("Enter"); }
      assert.equal(await page.locator("[data-selections]").textContent(), "3");
      const hook=page.getByRole("button",{name:"Recreate hook",exact:true});await hook.click();assert.equal(await page.locator("[data-selections]").textContent(),"4");
      await page.getByRole("button",{name:"Preview wall_text",exact:true}).click();assert.equal(await page.locator("[data-previews]").textContent(),"1");
      await page.getByRole("button",{name:"Recreate Ready example",exact:true}).click();assert.equal(await page.locator("[data-selections]").textContent(),"5");
      await page.locator('[data-reference-recreate]').filter({hasText:'Preview only'}).click();assert.equal(await page.locator("[role=dialog]").count(),1);assert.equal(await page.locator("[data-selections]").textContent(),"5");
      await page.evaluate(()=>window.setFixtureDisabled(true));
      await page.waitForFunction(()=>document.querySelector('[aria-label="Recreate Ready example"]').disabled);
      assert.equal(await page.getByRole("button",{name:"Recreate Ready example",exact:true}).isDisabled(),true);
      // Source and Recreate are separate touch targets, including narrow cards.
      const overlap=await page.locator('[data-fixture-format="hook"] article').evaluate(e=>{const s=e.querySelector('[data-reference-source-overlay]')?.getBoundingClientRect(),r=e.querySelector('[data-reference-recreate]')?.getBoundingClientRect();return s&&r&&s.left<r.right&&s.right>r.left&&s.top<r.bottom&&s.bottom>r.top});assert.equal(Boolean(overlap),false);
    }
    await page.reload(); await page.getByRole("button",{name:"Recreate hook",exact:true}).waitFor();
    await page.waitForFunction(()=>[...document.images].every(image=>image.complete&&image.naturalWidth>0));
    const geometry = await page.locator('.fixture-grid article > div:first-child').evaluateAll(items=>items.map(e=>{const r=e.getBoundingClientRect();return {width:r.width,height:r.height}}));
    const geometryFile = path.join(root,reviewRoot,'before',`geometry-${width}.json`);
    if (before) writeFileSync(geometryFile,JSON.stringify(geometry));
    else if (existsSync(geometryFile)) assert.deepEqual(geometry,JSON.parse(readFileSync(geometryFile,'utf8')),'Reference thumbnail geometry remains unchanged');
    await page.screenshot({ path: path.join(out, `recreate-${width}.png`), fullPage: true });
    if (badgeReview) await page.locator('[data-fixture-format="hook"] article').screenshot({path:path.join(out,`new-pill-card-${width}.png`)});
    console.log("PASS", before ? "baseline" : "standard actions / callbacks / keyboard / touch / disabled / preview", width);
    await context.close();
  }
} finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
