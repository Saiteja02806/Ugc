/* eslint-disable @typescript-eslint/no-require-imports -- Real gallery controls with local media, no auth/generation. */
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), http = require("node:http");
const { webpack } = require("next/dist/compiled/webpack/webpack");
const root = path.resolve(__dirname, ".."), out = path.join(root, ".tmp/wall-money-review-2026-10-26/browser");
fs.mkdirSync(out, { recursive: true });
const write = (name, value) => fs.writeFileSync(path.join(out, name), value);
const release = require("../worker/src/lib/explore-wall-money-reference-release.json");
const refs = release.items.map(item => ({ ...item, slides: [], isNew: true, posterUrl: "/media/" + path.basename(item.posterStorageKey), videoUrl: "/media/" + path.basename(item.videoStorageKey), previewVideoUrl: "/media/" + path.basename(item.previewStorageKey), pairedAudio: { title: item.audioTitle, url: "/media/" + path.basename(item.audioStorageKey), durationSeconds: item.audioDurationSeconds } }));
const workspace = fs.readFileSync("components/explore/recreate-workspace.tsx", "utf8");
write("card.tsx", `import {useState} from 'react';import {ArrowLeft,ArrowRight,Check,Layers3,RotateCcw,SlidersHorizontal} from 'lucide-react';
import {Button} from '@/components/ui/button';import {Checkbox} from '@/components/ui/checkbox';import {Popover,PopoverContent,PopoverTitle,PopoverTrigger} from '@/components/ui/popover';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {SocialPlatformIcon} from '@/components/social/platform-icon';import {getReferenceSource,referenceSourceLabel} from '@/lib/explore/reference-source-link';import {cn} from '@/lib/utils';
import Link from 'next/link';import {ReferenceVideoPlayer} from '@/components/explore/reference-video-player';import {useCoverPlayback} from '@/components/explore/use-cover-playback';
import studio from '@/components/explore/workflow-studio.module.css';import type {RecreateReference} from '@/lib/explore/recreate-types';import {canOpenReferenceSource} from '@/lib/explore/reference-source-access';
const useCreatorVideoPreview=(url)=>({url,loading:false,failed:false});
const useBillingSubscription=()=>({isSuccess:true,isFetching:false,isError:false,data:{isActive:true,planKey:'starter'}});
${workspace.slice(workspace.indexOf("export function FilterMenu("), workspace.indexOf("export function ReferenceGridSkeleton("))}`);
write("entry.tsx", `import {createRoot} from 'react-dom/client';import {useState} from 'react';import {FilterMenu,ReferenceCard,ReferencePreviewDialog} from './card';import {filterReferences,referenceCategories} from '@/lib/explore/recreate-types';import layout from '@/components/explore/recreate-layout.module.css';
const additions=${JSON.stringify(refs)};const old={...additions[0],id:'existing-wall',title:'Existing productivity reference',category:'productivity',categoryLabel:'Productivity',isNew:false};
const before=new URLSearchParams(location.search).has('before');const items=before?[old]:[old,...additions];
function App(){const[categories,setCategories]=useState([]),[selected,select]=useState(null),[preview,show]=useState(null);const visible=filterReferences(items,'wall_text',categories);return <main style={{maxWidth:1100,padding:16,margin:'0 auto'}}><header style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}><h1>Wall of Text references</h1><FilterMenu activeCategories={categories} categories={referenceCategories(items,'wall_text')} count={categories.length} disabled={false} onClear={()=>setCategories([])} onToggle={(id,on)=>setCategories(on?[...categories,id]:categories.filter(x=>x!==id))}/></header><p data-count>{visible.length} references</p><div className={layout.galleryGrid}>{visible.map(reference=><ReferenceCard key={reference.id} reference={reference} canOpenSource compact showActionLabel hideCaption isSelected={selected===reference.id} onRecreate={()=>select(reference.id)} onPreview={()=>show(reference)}/>)}</div><ReferencePreviewDialog key={preview?.id??'empty'} reference={preview} open={!!preview} onOpenChange={open=>{if(!open)show(null)}}/></main>};createRoot(document.getElementById('root')).render(<App/>);`);
write("loader.cjs", `const ts=require(${JSON.stringify(require.resolve("typescript"))});module.exports=s=>ts.transpileModule(s,{fileName:this.resourcePath,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText;`);
write("css-loader.cjs", `module.exports=s=>'export default '+JSON.stringify(Object.fromEntries([...s.matchAll(/\.([a-zA-Z][a-zA-Z0-9_-]*)/g)].map(m=>[m[1],m[1]])))`);
async function main() {
  write("creator-preview.ts", "export const useCreatorVideoPreview=(url)=>({url,loading:false,failed:false});");
  const postcss = require("postcss");
  const globals = fs.readFileSync("app/globals.css", "utf8").replace('@import "tailwindcss";', '@import "tailwindcss" source(none);') + '\n@source "../.tmp/wall-money-review-2026-10-26/browser/*.tsx";\n@source "../components/ui/*.tsx";';
  const css = await postcss([require("@tailwindcss/postcss")()]).process(globals, { from: path.join(root, "app/globals.css") });
  write("style.css", css.css + ["workflow-studio", "recreate-layout", "clip-preview-controls"].map(name => fs.readFileSync(`components/explore/${name}.module.css`, "utf8").replaceAll(":global(section)", "section")).join("\n"));
  await new Promise((resolve, reject) => { const compiler = webpack({ mode: "development", devtool: false, context: root, entry: path.join(out, "entry.tsx"), output: { path: out, filename: "bundle.js" }, plugins: [new webpack.NormalModuleReplacementPlugin(/use-creator-video-preview$/, path.join(out, "creator-preview.ts")), new webpack.DefinePlugin({ "process.env": JSON.stringify({ NODE_ENV: "development" }) })], resolve: { extensions: [".tsx", ".ts", ".js"], alias: { "@": root } }, module: { rules: [{ test: /\.tsx?$/, use: path.join(out, "loader.cjs") }, { test: /\.css$/, use: path.join(out, "css-loader.cjs") }] } }); compiler.run((e, s) => compiler.close(() => e || s.hasErrors() ? reject(e || Error(s.toString({ all: false, errors: true }))) : resolve())); });
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://fixture.test");
    const name = path.basename(url.pathname);
    const file = url.pathname.startsWith("/media/") && /^[a-f0-9]{64}\.(mp4|mp3|webp)$/.test(name) ? path.join(root, ".tmp/wall-money-review-2026-10-26/media", name) : ["/bundle.js", "/style.css"].includes(url.pathname) ? path.join(out, name) : null;
    if (file) { const bytes = fs.readFileSync(file); const type = name.endsWith("mp4") ? "video/mp4" : name.endsWith("mp3") ? "audio/mpeg" : name.endsWith("webp") ? "image/webp" : name.endsWith("js") ? "text/javascript" : "text/css"; res.writeHead(200, { "Content-Type": type, "Content-Length": bytes.length }); res.end(bytes); return; }
    res.setHeader("Content-Type", "text/html; charset=utf-8"); res.end('<!doctype html><html class="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>');
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const { chromium } = require(path.join(process.env.USERPROFILE, ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright"));
  let browser;
  try {
    browser = await chromium.launch({ headless: true, channel: "msedge" });
    const receipts = [];
    for (const viewport of [{ width: 1280, height: 720 }, { width: 390, height: 844 }]) {
      const page = await browser.newPage({ viewport }); const errors = []; page.on("pageerror", e => { errors.push(e.message); console.error("Browser fixture:", e.message); });
      const base = `http://127.0.0.1:${server.address().port}`;
      await page.goto(base + "?before=1"); await page.getByRole("button", { name: "Filter", exact: true }).click();
      await page.getByText("Productivity", { exact: true }).waitFor(); assert.equal(await page.getByText("Investing & Money", { exact: true }).count(), 0);
      await page.screenshot({ path: path.join(out, `before-${viewport.width}.png`) });
      await page.goto(base); await page.getByRole("button", { name: "Filter", exact: true }).click();
      await page.getByText("Investing & Money", { exact: true }).click();
      assert.equal(await page.locator("article[data-reference-id]").count(), 6);
      await page.screenshot({ path: path.join(out, `category-${viewport.width}.png`) });
      await page.keyboard.press("Escape");
      assert.equal(await page.locator("[data-reference-new]").count(), 6);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
      const first = page.locator(`article[data-reference-id="${refs[0].id}"]`);
      await first.getByRole("button", { name: `Recreate ${refs[0].title}`, exact: true }).click();
      assert.equal(await first.getByRole("button", { name: `Recreate ${refs[0].title}`, exact: true }).getAttribute("aria-pressed"), "true");
      await page.screenshot({ path: path.join(out, `selected-${viewport.width}.png`) });
      await first.getByRole("button", { name: `Preview ${refs[0].title}`, exact: true }).click(); await page.getByRole("heading", { name: "Video preview", exact: true }).waitFor();
      await page.keyboard.press("Escape"); await page.getByRole("button", { name: "Filter", exact: true }).click(); await page.getByRole("button", { name: "Clear filters", exact: true }).click();
      assert.equal(await page.locator("article[data-reference-id]").count(), 7);
      assert.deepEqual(errors, []);
      receipts.push({ viewport, sixFilteredCards: true, newBadges: true, recreateSelection: true, previewOpenClose: true, clearFilters: true, overflow: false, errors }); await page.close();
    }
    write("receipt.json", JSON.stringify({ boundary: "Production FilterMenu/cards/dialog; fixture gallery shell and one representative existing card. No production auth or generation.", receipts }, null, 2));
    console.log(JSON.stringify(receipts));
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
