import {ensureCharacterCatalogCache,catalogCacheFile} from './character-catalog-test-cache.mjs';
await ensureCharacterCatalogCache();
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";

// Actual composer and reference uploader; upload service is isolated. No provider or account writes.
const require = createRequire(import.meta.url);
let pw;
try { pw = require("playwright"); }
catch { pw = require(path.join(process.env.USERPROFILE, ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright")); }
const root = process.cwd();
const out = path.join(root, ".tmp/character-ui/browser");
mkdirSync(out, { recursive: true });
const write = (name, value) => { writeFileSync(path.join(out, name), value); return path.join(out, name); };
const aliases = {
 "@/lib/ai-studio/reference-media-upload":write('upload.ts', `export async function uploadAIStudioReferenceMedia(){throw Error('No provider/upload calls allowed in layout test')}`)
};
aliases['next/image']=write('image.tsx', "export default function Image({fill,unoptimized,sizes,...props}){return <img {...props}/>}");
write('entry.tsx', `import {createRoot} from 'react-dom/client';import {useState} from 'react';import {InfluencerCustomizerDock} from '@/components/characters/influencer-customizer-dock';import {DEFAULT_INFLUENCER_SELECTION} from '@/lib/characters/influencer-registry';import styles from '@/components/characters/influencer-studio.module.css';function App(){const [selection,setSelection]=useState(DEFAULT_INFLUENCER_SELECTION);const [busy,setBusy]=useState(false);window.setCharacterFixtureBusy=setBusy;return <><div className="shell-header"/><div className={styles.studioRoot}><div style={{padding:10}}>Failed to fetch</div><header className={styles.studioHeader}>AI character influencer</header><div className={styles.studioLayout}><InfluencerCustomizerDock selection={selection} onSelectionChange={p=>setSelection(s=>({...s,...p}))} onResetAll={()=>setSelection(DEFAULT_INFLUENCER_SELECTION)} onRandomize={()=>{}} batchSize={1} onBatchSizeChange={()=>{}} isGenerating={busy} onGenerate={()=>{}}/><section className={styles.canvasContainer}>Portrait preview</section></div></div></>}createRoot(document.getElementById('root')).render(<App/>);`);
write("css.cjs", `module.exports=source=>'const style=document.createElement("style");style.textContent='+JSON.stringify(source)+';document.head.append(style);export default '+JSON.stringify(Object.fromEntries([...source.matchAll(/\\.([a-zA-Z][a-zA-Z0-9_-]*)/g)].map(m=>[m[1],m[1]])))+';';`);
write("loader.cjs", `const ts=require(${JSON.stringify(require.resolve("typescript"))});module.exports=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText;`);
const { webpack } = require("next/dist/compiled/webpack/webpack");
await new Promise((resolve, reject) => {
  const compiler = webpack({ mode: "development", target: "web", devtool: false, context: root, entry: path.join(out, "entry.tsx"), output: { path: out, filename: "entry.js", chunkFilename: "chunks/[name].js", publicPath: "/" }, resolve: { extensions: [".tsx", ".ts", ".js"], alias: { ...aliases, "@": root } }, module: { rules: [{ test: /\.tsx?$/, use: path.join(out, "loader.cjs"), exclude: /node_modules/ },{test:/\.css$/,use:path.join(out,"css.cjs")}] } });
  compiler.run((error, stats) => compiler.close(() => error || stats.hasErrors() ? reject(error ?? Error(stats.toString({ all: false, errors: true }))) : resolve()));
});
const globals = readFileSync(path.join(root, "app/globals.css"), "utf8").replace('@import "tailwindcss";', '@import "tailwindcss" source(none);') + '\n@source "../components/generation";\n@source "../components/video/reference-files-upload.tsx";\n@source "../components/ui";';
write("fixture.css", (await postcss([tailwind({ base: root })]).process(globals, { from: path.join(root, "app/globals.css") })).css);
const html = '<!doctype html><html class="dark"><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><style>body{margin:0}*{box-sizing:border-box}.shell-header{display:none}@media(max-width:767px){.shell-header{display:block;height:64px}}</style><body class="app-canvas"><div id="root"></div><script src="/entry.js"></script></body></html>';
const server = createServer((req, res) => {
  const pathname = new URL(req.url, "http://fixture").pathname;
  if (pathname === "/") { res.setHeader("Content-Type", "text/html"); res.end(html); return; }
  const file = pathname.startsWith("/explore/") ? (pathname.startsWith('/explore/influencer-studio/') ? catalogCacheFile(pathname) : path.join(root,"public",pathname)) : path.resolve(out, `.${pathname}`);
  const publicRoot = path.join(root, "public") + path.sep;
  const fixtureRoot = path.join(root, ".tmp/character-catalog/source") + path.sep;
  if ((!file.startsWith(out + path.sep) && !file.startsWith(publicRoot) && !file.startsWith(fixtureRoot)) || !existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.setHeader("Content-Type", file.endsWith(".png") ? "image/png" : file.endsWith(".jpg") ? "image/jpeg" : file.endsWith(".css") ? "text/css" : "text/javascript"); res.end(readFileSync(file));
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
 browser=await pw.chromium.launch({headless:true,channel:'msedge'});
 const page=await browser.newPage();

 for(const viewport of [{width:1440,height:1000},{width:900,height:1000},{width:390,height:844},{width:320,height:720}]){
 await page.setViewportSize(viewport);await page.goto(origin);await page.locator('.traitCard').first().waitFor();
 assert.equal(await page.getByRole('button',{name:'Wide-Eyed Mustache',exact:true}).count(),0);
 assert.equal(await page.getByRole('button',{name:'Playful Mustache',exact:true}).count(),1);
 const backgrounds=page.getByRole('button',{name:/^Background /}).locator('..');
 assert.equal(await backgrounds.locator('.traitCard').count(),7);
 for(const name of ['Car Interior','Minimal Gray Room','Loft Bedroom','Warm Living Room','Modern Kitchen','Dark Home Office']){
  assert.equal(await backgrounds.getByRole('button',{name,exact:true}).count(),0);
 }
 await page.getByRole('button',{name:/^Head Shape /}).click();
 const head=page.getByTitle('Long Narrow Face',{exact:true});await head.click();
 assert.match(await head.getAttribute('class'),/traitCardSelected/);
 await head.scrollIntoViewIfNeeded();await page.screenshot({path:path.join(root,'.tmp/character-ui/head-moved-'+viewport.width+'.png')});
 await page.getByRole('button',{name:'Reset all',exact:true}).click();
 assert.match(await page.getByTitle('Keep head shape',{exact:true}).getAttribute('class'),/traitCardSelected/);
 await page.getByRole('button',{name:/^Head Shape /}).click();
 await page.getByRole('button',{name:/Accessories/}).click();
 const label=page.locator('.cardSelectedPillText').filter({hasText:'Matte Black'});await label.waitFor();await label.scrollIntoViewIfNeeded();
 const r=await page.evaluate(()=>{const root=document.querySelector('.studioRoot').getBoundingClientRect(),cta=document.querySelector('.generateButton').getBoundingClientRect(),label=document.querySelector('.cardSelectedPillText'),style=getComputedStyle(label);return {rootBottom:root.bottom,ctaBottom:cta.bottom,overflow:document.documentElement.scrollWidth>innerWidth,color:style.color,stroke:style.webkitTextStrokeWidth,cards:[...document.querySelectorAll('.traitCard')].every(e=>e.getBoundingClientRect().right<=innerWidth),labels:[...document.querySelectorAll('.cardSelectedPillText')].every(e=>{const a=e.getBoundingClientRect(),b=e.closest('.traitCard').getBoundingClientRect();return a.left>=b.left&&a.right<=b.right})}});
 assert.equal(r.overflow,false);assert.equal(r.cards,true);assert.equal(r.labels,true);assert.equal(r.color,'rgb(255, 255, 255)');assert(parseFloat(r.stroke)>0);assert(r.rootBottom<=viewport.height+1);assert(r.ctaBottom<=viewport.height+1);await page.screenshot({path:path.join(root,'.tmp/character-ui/character-'+viewport.width+'.png'),fullPage:true});console.log('PASS',viewport,r);
 }

 for(const viewport of [{width:1440,height:1000},{width:390,height:844},{width:320,height:720}]){
  await page.setViewportSize(viewport);await page.goto(origin);await page.locator('.traitCard').first().waitFor();
  for(const [section,count] of [['Skin Color',8],['Eye Color',8],['Hair Color',9],['Outfit Color',10]]){
   const toggle=page.getByRole('button',{name:new RegExp('^'+section+' ')});
   if(await toggle.getAttribute('aria-expanded')!=='true')await toggle.click();
   const group=toggle.locator('..');const tiles=group.locator('.colorTile');
   assert.equal(await tiles.count(),count);
   assert.equal(await group.locator('.traitCard,.swatchCircle,.cardSelectedPill').count(),0);
   assert.equal(await group.locator('[aria-pressed="true"]').count(),1);
   for(const tile of await tiles.all()){
    assert.equal((await tile.textContent()).trim(),await tile.getAttribute('aria-label'));
    const preview=tile.locator('.colorTilePreview');
    const box=await preview.boundingBox();assert(box.width>box.height && box.height>30);
    assert.equal(await tile.locator('.colorTileLabel').count(),1);
   }
   const first=tiles.first(),second=tiles.nth(1);
   await second.click();assert.equal(await second.getAttribute('aria-pressed'),'true');
   await first.focus();await first.press('Enter');assert.equal(await first.getAttribute('aria-pressed'),'true');
   await page.evaluate(()=>window.setCharacterFixtureBusy(true));
   await page.waitForFunction(()=>document.querySelector('.colorTile:disabled'));
   assert.equal(await second.isDisabled(),true);
   await page.evaluate(()=>window.setCharacterFixtureBusy(false));
   await page.waitForFunction(()=>!document.querySelector('.colorTile:disabled'));
   await toggle.evaluate(element=>element.scrollIntoView({block:"start"}));
   await page.screenshot({path:path.join(root,`.tmp/character-ui/colors-${viewport.width}-${section.replaceAll(' ','-')}.png`)});
   await toggle.click();
  }
  await page.getByRole('button',{name:/^Hair Color /}).click();
  await page.getByRole('button',{name:'Jet Black',exact:true}).click();
  await page.getByRole('button',{name:'Reset all',exact:true}).click();
  assert.equal(await page.getByRole('button',{name:'Keep hair color',exact:true}).getAttribute('aria-pressed'),'true');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  console.log('PASS four color groups: rectangles, single labels, pointer, keyboard, busy, reset, no overflow',viewport);
 }

}finally{await browser?.close();await new Promise(r=>server.close(r));}
