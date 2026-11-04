import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";

// Actual face-choice dialog, composer, buttons and modal primitives. Saved-photo
// reads and file uploads use local fixtures; no paid or external API calls.
// This script bundles a fixture: run only with explicit build authorization.
const require = createRequire(import.meta.url), root = process.cwd();
let pw;
try { pw = require("playwright"); }
catch { pw = require(path.join(process.env.USERPROFILE, ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright")); }
const { webpack } = require("next/dist/compiled/webpack/webpack");

const out = path.join(root, ".tmp/slideshow-face-ux/browser"); mkdirSync(out, {recursive:true});
const write = (name,value) => { const file=path.join(out,name);writeFileSync(file,value);return file; };
const poster="/explore/talking-head-frames/v1/talking-taliameals.png";
const aliases={
 "@/lib/explore/format-reference-images":write("uploads.ts",`export const fetchFormatReferenceImages=async()=>[];`),
 "@/lib/characters/photo-library-client":write("photos.ts",`export const fetchInfluencerPhotoLibrary=async()=>({items:Array.from({length:30},(_,i)=>({mediaAssetId:'face-'+i,url:'${poster}',id:'face-'+i})),nextCursor:null});`),
 "@/lib/characters/history":write("history.ts",`export const mergeCharacterHistoryPages=pages=>pages.flatMap(p=>p.items);`),
 "@/lib/ai-studio/reference-media-upload":write("upload.ts",`export const uploadAIStudioReferenceMedia=async(file)=>{if(file.name.includes('fail'))throw Error('Simulated upload failure');return {asset:{id:file.name,url:'${poster}',fileName:file.name}};};`),
};
write("entry.tsx",`import {createRoot}from'react-dom/client';import{useState}from'react';import{QueryClient,QueryClientProvider}from'@tanstack/react-query';import{Plus}from'lucide-react';import{Button}from'@/components/ui/button';
import{SlideshowFaceSwapControl}from'@/components/explore/slideshow-face-swap-control';import{AiStudioComposer}from'@/components/generation/ai-studio-composer';
function App(){const[open,setOpen]=useState(false),[face,setFace]=useState(null),[ids,setIds]=useState([]),[prompt,setPrompt]=useState('Keep the scene'),[disabled,setDisabled]=useState(false),[generates,setGenerates]=useState(0);window.setFixtureDisabled=setDisabled;const value={open,onOpenChange:setOpen,influencer:face,onInfluencerChange:setFace,slideIds:ids,onSlideIdsChange:setIds,eligibleCount:6,slides:[1,2,3,4,5,6].map(n=>({id:'slide-'+n,url:'${poster}',number:n,eligible:n<=6}))};return <main><output data-confirmed>{JSON.stringify({face,ids})}</output><output data-generates>{generates}</output><AiStudioComposer active ariaLabel="Instructions" generateLabel="Generate image" generateDisabled={disabled} generationLocked={false} isGenerating={false} layout="workflow" workflowDesign="classic" generateTone="blue" name="prompt" prompt={prompt} onPromptChange={setPrompt} onSubmit={e=>{e.preventDefault();setGenerates(n=>n+1)}} onTextareaKeyDown={()=>{}} settings={<div>Model settings</div>} promptAttachmentControl={<div className="absolute bottom-3 left-3"><Button type="button" variant="outline" size="icon-sm" aria-label="Add images" className="rounded-lg"><Plus className="size-4"/></Button></div>} promptCornerControl={<SlideshowFaceSwapControl value={value} ownerId="fixture-owner" disabled={disabled}/>}/></main>}createRoot(document.getElementById('root')).render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><App/></QueryClientProvider>);`);
write("css.cjs", `module.exports=source=>'const s=document.createElement("style");s.textContent='+JSON.stringify(source)+';document.head.append(s);export default '+JSON.stringify(Object.fromEntries([...source.matchAll(/\\.([a-zA-Z][a-zA-Z0-9_-]*)/g)].map(m=>[m[1],m[1]])))+';';`);
write("loader.cjs", `const ts=require(${JSON.stringify(require.resolve("typescript"))});module.exports=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText;`);
await new Promise((resolve, reject) => {
  const compiler = webpack({ mode: "development", target: "web", devtool: false, context: root, entry: path.join(out, "entry.tsx"), output: { path: out, filename: "entry.js", publicPath: "/" }, resolve: { extensions: [".tsx", ".ts", ".js"], alias: { ...aliases, "@": root } }, module: { rules: [{ test: /\.tsx?$/, use: path.join(out, "loader.cjs"), exclude: /node_modules/ }, { test: /\.css$/, use: path.join(out, "css.cjs") }] } });
  compiler.run((error, stats) => compiler.close(() => error || stats.hasErrors() ? reject(error ?? Error(stats.toString({ all: false, errors: true }))) : resolve()));
});

const globals=readFileSync("app/globals.css","utf8").replace('@import "tailwindcss";','@import "tailwindcss" source(none);')+'\n@source "../components";\n@source "../.tmp/slideshow-face-ux/browser";';
write("fixture.css",(await postcss([tailwind({base:root})]).process(globals,{from:path.join(root,"app/globals.css")})).css);
const html='<!doctype html><html class="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"><style>body{margin:0}main{width:420px;max-width:100%;margin:auto;padding:16px}output{display:block;overflow-wrap:anywhere;font-size:10px}</style></head><body class="app-canvas"><div id="root"></div><script src="/entry.js"></script></body></html>';
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
try{
 browser=await pw.chromium.launch({headless:true,channel:"msedge"});
 for(const width of [1440,390,320]){
  const context=await browser.newContext({viewport:{width,height:900},isMobile:width<600,hasTouch:width<600});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(origin);
  const faceButton=page.getByRole('button',{name:'Face swap',exact:true});await faceButton.waitFor();
  const plus=await page.getByRole('button',{name:'Add images'}).boundingBox(), face=await faceButton.boundingBox();assert.equal(plus.height,face.height);assert.equal(plus.y,face.y);
  const color=await page.getByRole('button',{name:'Generate image',exact:true}).evaluate(e=>getComputedStyle(e).backgroundColor);assert.equal(color,'rgb(0, 120, 212)');
  await faceButton.click();const dialog=page.getByRole('dialog');await dialog.waitFor();await page.getByRole('option',{name:'AI influencer 1',exact:true}).click();await page.getByRole('option',{name:'AI influencer 2',exact:true}).click();
  assert.equal(await page.getByRole('option',{selected:true}).count(),2);assert.equal(await page.getByRole('button',{name:'Next: choose slides',exact:true}).isDisabled(),false);await page.screenshot({path:path.join(out,`photos-${width}.png`)});await page.getByRole('button',{name:'Next: choose slides',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Done',exact:true}).isDisabled(),true);assert.equal(await page.getByRole('option').count(),0);
  await page.getByRole('button',{name:'Face swap for source slide 1',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Face swap for source slide 3',exact:true}).getAttribute('aria-pressed'),'false');assert.equal(await page.getByRole('button',{name:'Face swap for source slide 6',exact:true}).getAttribute('aria-pressed'),'false');
  const box=await dialog.boundingBox();assert(box.x>=0&&box.x+box.width<=width+1&&box.y>=0&&box.y+box.height<=901,JSON.stringify(box));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({path:path.join(out,`dialog-${width}.png`)});
  await page.getByRole('button',{name:'Done',exact:true}).click();await dialog.waitFor({state:'hidden'});await page.waitForFunction(()=>document.activeElement?.getAttribute('aria-label')==='Face swap');let saved=JSON.parse(await page.locator('[data-confirmed]').textContent());assert.equal(saved.face.id,'face-0');assert.equal(saved.face.referencePhotos[0].id,'face-1');assert.deepEqual(saved.ids,['slide-1']);assert.equal(await page.locator('[data-generates]').textContent(),'0');
  await faceButton.click();await page.getByRole('option',{name:'AI influencer 3',exact:true}).click();await page.getByRole('button',{name:'Cancel',exact:true}).click();assert.deepEqual(JSON.parse(await page.locator('[data-confirmed]').textContent()),saved);
  await faceButton.click();assert.equal(await page.getByRole('option',{selected:true}).count(),2);await page.getByRole('option',{name:'AI influencer 3',exact:true}).click();await page.getByRole('option',{name:'AI influencer 4',exact:true}).click();assert.equal(await page.getByRole('option',{name:'AI influencer 5',exact:true}).isDisabled(),true);await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});assert.deepEqual(JSON.parse(await page.locator('[data-confirmed]').textContent()),saved);
  await page.screenshot({path:path.join(out,`confirmed-${width}.png`)});await page.reload();assert.equal(JSON.parse(await page.locator('[data-confirmed]').textContent()).face,null);
  await faceButton.click();await page.locator('input[type=file]').setInputFiles([{name:'uploaded-a.png',mimeType:'image/png',buffer:Buffer.from('fixture')},{name:'uploaded-b.png',mimeType:'image/png',buffer:Buffer.from('fixture')}]);await page.waitForFunction(()=>document.querySelector('[role=listbox]')?.querySelectorAll('[aria-selected=true]').length===2);await page.locator('input[type=file]').setInputFiles({name:'fail.png',mimeType:'image/png',buffer:Buffer.from('fixture')});await page.getByRole('alert').filter({hasText:'Simulated upload failure'}).waitFor();assert.equal(await page.getByRole('option',{selected:true}).count(),2);await page.getByRole('button',{name:'Next: choose slides',exact:true}).click();await page.getByRole('button',{name:'Face swap for source slide 2',exact:true}).click();await page.getByRole('button',{name:'Done',exact:true}).click();saved=JSON.parse(await page.locator('[data-confirmed]').textContent());assert.equal(saved.face.id,'uploaded-a.png');assert.equal(saved.face.referencePhotos[0].id,'uploaded-b.png');assert.equal(await page.locator('[data-generates]').textContent(),'0');
  await page.evaluate(()=>window.setFixtureDisabled(true));await page.waitForFunction(()=>document.querySelector('[aria-label="Face swap"]').disabled);assert.equal(await faceButton.isDisabled(),true);assert.deepEqual(errors,[]);console.log('PASS multiple photos / primary roles / Done / Cancel / Escape / numbered slides / disabled / bounds',width);await context.close();
 }
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
