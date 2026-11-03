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
const out = path.join(root, ".tmp/ai-studio-prompt/browser");
mkdirSync(out, { recursive: true });
const write = (name, value) => { writeFileSync(path.join(out, name), value); return path.join(out, name); };
const aliases = {
 "@/lib/ai-studio/reference-media-upload":write('upload.ts', `export async function uploadAIStudioReferenceMedia(){throw Error('No provider/upload calls allowed in layout test')}`)
};
write("entry.tsx", `import {createRoot} from 'react-dom/client';import {useState} from 'react';import {AiStudioComposer} from '@/components/generation/ai-studio-composer';import {ReferenceFilesUpload} from '@/components/video/reference-files-upload';function App(){const [prompt,setPrompt]=useState('');const [references,setReferences]=useState([]);return <main className="p-6"><h1>AI Studio · prompt layout</h1><AiStudioComposer active ariaLabel="Video prompt" name="videoPrompt" layout="unified" generateDisabled generateLabel="Generate video" generationLocked={false} isGenerating={false} prompt={prompt} onPromptChange={setPrompt} onTextareaKeyDown={()=>{}} onSubmit={e=>e.preventDefault()} placeholder="Describe the video you want to create…" hasAttachments={references.length>0} showPromptHint={false} settings={<span>Seedance 2.5 · 720p · 5 sec</span>} leadingControl={<ReferenceFilesUpload active allowedKinds={['image','video','audio']} disabled={false} expectedUserId="layout-owner" maxFiles={4} selections={references} onChange={setReferences} onPendingChange={()=>{}}/>}/><button onClick={()=>setReferences([{kind:'image',asset:{id:'image',url:'/sample.png',title:'Sample reference',fileName:'sample.png'}}])}>Attach fixture</button></main>}createRoot(document.getElementById('root')).render(<App/>);`);
write("css.cjs", `module.exports=source=>'const style=document.createElement("style");style.textContent='+JSON.stringify(source)+';document.head.append(style);export default '+JSON.stringify(Object.fromEntries([...source.matchAll(/\\.([a-zA-Z][a-zA-Z0-9_-]*)/g)].map(m=>[m[1],m[1]])))+';';`);
write("loader.cjs", `const ts=require(${JSON.stringify(require.resolve("typescript"))});module.exports=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText;`);
const { webpack } = require("next/dist/compiled/webpack/webpack");
await new Promise((resolve, reject) => {
  const compiler = webpack({ mode: "development", target: "web", devtool: false, context: root, entry: path.join(out, "entry.tsx"), output: { path: out, filename: "entry.js", chunkFilename: "chunks/[name].js", publicPath: "/" }, resolve: { extensions: [".tsx", ".ts", ".js"], alias: { ...aliases, "@": root } }, module: { rules: [{ test: /\.tsx?$/, use: path.join(out, "loader.cjs"), exclude: /node_modules/ },{test:/\.css$/,use:path.join(out,"css.cjs")}] } });
  compiler.run((error, stats) => compiler.close(() => error || stats.hasErrors() ? reject(error ?? Error(stats.toString({ all: false, errors: true }))) : resolve()));
});
const globals = readFileSync(path.join(root, "app/globals.css"), "utf8").replace('@import "tailwindcss";', '@import "tailwindcss" source(none);') + '\n@source "../components/generation";\n@source "../components/video/reference-files-upload.tsx";\n@source "../components/ui";';
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
 const page=await browser.newPage();
 for(const viewport of [{width:1440,height:1000},{width:390,height:844}]){
 await page.setViewportSize(viewport);await page.goto(origin);
 const prompt=page.getByRole('textbox',{name:'Video prompt',exact:true});await prompt.waitFor();
 const measure=()=>page.evaluate(()=>{const t=document.querySelector('textarea'),b=document.querySelector('[data-reference-tile]'),tr=t.getBoundingClientRect(),br=b.getBoundingClientRect();return {textLeft:tr.left,tileRight:br.right,width:tr.width,overflow:document.documentElement.scrollWidth>innerWidth}});
 let r=await measure();assert(r.textLeft>=r.tileRight+7,JSON.stringify(r));assert.equal(r.overflow,false);
 await prompt.fill('Describe a creator speaking naturally.\nKeep the opening frame and camera steady.');
 r=await measure();assert(r.textLeft>=r.tileRight+7,JSON.stringify(r));assert.match(await prompt.inputValue(),/^Describe/);
 await prompt.fill('');await page.screenshot({path:path.join(root,'.tmp/ai-studio-prompt/prompt-'+viewport.width+'.png'),fullPage:true});
 await page.getByRole('button',{name:'Attach fixture',exact:true}).click();
 const attached=await page.evaluate(()=>{const t=document.querySelector('textarea').getBoundingClientRect(),b=document.querySelector('[data-reference-tile]').getBoundingClientRect();return {textTop:t.top,tileBottom:b.bottom}});assert(attached.textTop>=attached.tileBottom,JSON.stringify(attached));
 console.log('PASS actual composer + ReferenceFilesUpload empty/multiline/attached, no overlap',viewport.width,r);
 }
}finally{await browser?.close();await new Promise(r=>server.close(r));}
