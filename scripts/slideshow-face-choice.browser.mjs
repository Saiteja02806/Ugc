import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";

// Actual Face Swap picker with isolated library failures and retries. No account writes or generation.
const require = createRequire(import.meta.url);
let pw;
try { pw = require("playwright"); }
catch { pw = require(path.join(process.env.USERPROFILE, ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright")); }
const root = process.cwd();
const out = path.join(root, ".tmp/slideshow-face-choice/browser");
mkdirSync(out, { recursive: true });
const write = (name, value) => { writeFileSync(path.join(out, name), value); return path.join(out, name); };
const aliases = {};
aliases['@/lib/explore/format-reference-images']=write('uploads.ts', `export async function fetchFormatReferenceImages(){window.fixture.uploadReads++;if(window.fixture.failUploads)throw Error('fixture offline');return []}`);
aliases['@/lib/characters/photo-library-client']=write('faces.ts', `export async function fetchInfluencerPhotoLibrary(){window.fixture.faceReads++;if(window.fixture.failFaces)throw Error('fixture offline');return {images:[],nextCursor:null}}`);
aliases['@/lib/ai-studio/reference-media-upload']=write('upload.ts', `export async function uploadAIStudioReferenceMedia(){throw Error('No uploads allowed in test')}`);
write('entry.tsx', `import {createRoot} from 'react-dom/client';import {useState} from 'react';import {QueryClient,QueryClientProvider} from '@tanstack/react-query';import {SlideshowFaceChoice} from '@/components/explore/slideshow-face-choice';window.fixture={faceReads:0,uploadReads:0,failFaces:true,failUploads:true};const client=new QueryClient({defaultOptions:{queries:{retry:false}}});function App(){const [face,setFace]=useState({id:'chosen',url:'/portrait.png',title:'Chosen face'});return <main className="max-w-sm p-5"><h1>Face Swap · library recovery preview</h1><SlideshowFaceChoice ownerId="fixture-owner" selected={face} onSelect={setFace}/></main>}createRoot(document.getElementById('root')).render(<QueryClientProvider client={client}><App/></QueryClientProvider>);`);
write("loader.cjs", `const ts=require(${JSON.stringify(require.resolve("typescript"))});module.exports=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText;`);
const { webpack } = require("next/dist/compiled/webpack/webpack");
await new Promise((resolve, reject) => {
  const compiler = webpack({ mode: "development", target: "web", devtool: false, context: root, entry: path.join(out, "entry.tsx"), output: { path: out, filename: "entry.js", chunkFilename: "chunks/[name].js", publicPath: "/" }, resolve: { extensions: [".tsx", ".ts", ".js"], alias: { ...aliases, "@": root } }, module: { rules: [{ test: /\.tsx?$/, use: path.join(out, "loader.cjs"), exclude: /node_modules/ }] } });
  compiler.run((error, stats) => compiler.close(() => error || stats.hasErrors() ? reject(error ?? Error(stats.toString({ all: false, errors: true }))) : resolve()));
});
const globals = readFileSync(path.join(root, "app/globals.css"), "utf8").replace('@import "tailwindcss";', '@import "tailwindcss" source(none);') + '\n@source "../components/explore/slideshow-face-choice.tsx";\n@source "../components/ui";';
write("fixture.css", (await postcss([tailwind({ base: root })]).process(globals, { from: path.join(root, "app/globals.css") })).css);
const html = '<!doctype html><html class="dark"><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body class="app-canvas"><div id="root"></div><script src="/entry.js"></script></body></html>';
const server = createServer((req, res) => {
  const pathname = new URL(req.url, "http://fixture").pathname;
  if (pathname === "/") { res.setHeader("Content-Type", "text/html"); res.end(html); return; }
  const file = path.resolve(out, `.${pathname}`);
  if (!file.startsWith(out + path.sep) || !existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.setHeader("Content-Type", file.endsWith(".css") ? "text/css" : "text/javascript"); res.end(readFileSync(file));
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
 browser=await pw.chromium.launch({headless:true,channel:'msedge'});
 const page=await browser.newPage({viewport:{width:390,height:844}});
 await page.goto(origin);
 await page.getByRole('button',{name:'Retry saved faces',exact:true}).waitFor();
 await page.getByRole('button',{name:'Retry uploaded portraits',exact:true}).waitFor();
 assert.equal(await page.getByText('Selected: Chosen face',{exact:true}).count(),1);
 await page.screenshot({path:path.join(root,'.tmp/slideshow-fixes/library-error.png'),fullPage:true});
 await page.evaluate(()=>window.fixture.failFaces=false);
 await page.getByRole('button',{name:'Retry saved faces',exact:true}).click();
 await page.waitForFunction(()=>window.fixture.faceReads===2);
 await page.waitForFunction(()=>!document.body.textContent.includes('Could not load your saved faces.'));
 assert.equal(await page.getByRole('button',{name:'Retry uploaded portraits',exact:true}).count(),1);
 await page.evaluate(()=>window.fixture.failUploads=false);
 await page.getByRole('button',{name:'Retry uploaded portraits',exact:true}).click();
 await page.waitForFunction(()=>window.fixture.uploadReads===2);
 await page.waitForFunction(()=>!document.body.textContent.includes('Could not load your uploaded portraits.'));
 assert.equal(await page.getByText('Selected: Chosen face',{exact:true}).count(),1);
 await page.screenshot({path:path.join(root,'.tmp/slideshow-fixes/library-recovered.png'),fullPage:true});
 console.log('PASS actual face picker: independent failures, Retry success, preserved selection, no provider/upload calls');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
