/* eslint-disable @typescript-eslint/no-require-imports -- Isolated real-component browser verification. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { webpack } = require("next/dist/compiled/webpack/webpack");
let playwright;
try { playwright = require("playwright"); }
catch { playwright = require(path.join(process.env.USERPROFILE, ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright")); }
const root = path.resolve(__dirname, ".."), out = path.join(root, ".tmp/background-audio-browser");
fs.mkdirSync(out, { recursive: true });
const file = (name, content) => fs.writeFileSync(path.join(out, name), content);
file("loader.cjs", `const ts=require(${JSON.stringify(require.resolve("typescript"))});module.exports=source=>ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText;`);
file("css-loader.cjs", `module.exports=source=>'const style=document.createElement("style");style.textContent='+JSON.stringify(source)+';document.head.append(style);export default '+JSON.stringify(Object.fromEntries([...source.matchAll(/\\.([a-zA-Z][a-zA-Z0-9_-]*)/g)].map(m=>[m[1],m[1]])))+';';`);
file("token.ts", `export const getCurrentUserIdToken=async owner=>{if(owner!=='fixture-owner')throw new Error('Account changed');return 'fixture-token';};`);
file("entry.tsx", `import {createRoot} from 'react-dom/client';import {useState} from 'react';import {QueryClient,QueryClientProvider} from '@tanstack/react-query';import {WorkflowBackgroundAudioPicker} from '@/components/explore/workflow-background-audio-picker';import {useLocalWorkflowMedia} from '@/components/explore/use-local-workflow-media';
const client=new QueryClient({defaultOptions:{queries:{retry:false}}});function App(){const [owner,setOwner]=useState('fixture-owner');const audio=useLocalWorkflowMedia('audio');const [selected,setSelected]=useState(null);return <main style={{padding:'40px',maxWidth:'700px'}}><h1>Background audio</h1><WorkflowBackgroundAudioPicker ownerId={owner} attachment={audio} onChoose={async(file,playback)=>{if(!await audio.choose(file,{maxDuration:600}))return false;const value={name:file.name,playback};localStorage.setItem('selected',JSON.stringify(value));window.choices.push(value);setSelected(value);return true;}}/><button onClick={()=>setOwner(null)}>Change account</button>{selected?<p aria-label='Selected background audio'>{selected.name} · {selected.playback}</p>:null}{audio.asset?<audio controls src={audio.asset.url} aria-label='Selected track player'/>:null}{audio.error?<p role='alert'>{audio.error}</p>:null}</main>;}window.choices=[];createRoot(document.getElementById('root')).render(<QueryClientProvider client={client}><App/></QueryClientProvider>);`);
const realCataloguePath = path.join(root, ".tmp/background-audio-catalogue.json");
const tracks = fs.existsSync(realCataloguePath) ? JSON.parse(fs.readFileSync(realCataloguePath, "utf8")).tracks : [
  { id: "hook_audio_001", source: "hook", name: "Hook track 01", durationSeconds: 28.578, moods: ["curious"], energy: "medium", loopable: false },
  { id: "audio_002_segment_03", source: "wall", name: "Wall track 02 · Segment 3", durationSeconds: 23, moods: ["calm"], energy: "low", loopable: true },
];
const wav = Buffer.alloc(44 + 16000 * 2 * 5); wav.write("RIFF",0); wav.writeUInt32LE(wav.length-8,4); wav.write("WAVEfmt ",8); wav.writeUInt32LE(16,16);
wav.writeUInt16LE(1,20); wav.writeUInt16LE(1,22); wav.writeUInt32LE(16000,24); wav.writeUInt32LE(32000,28); wav.writeUInt16LE(2,32); wav.writeUInt16LE(16,34);
wav.write("data",36); wav.writeUInt32LE(wav.length-44,40);
const requests = []; let mode = "ok", base;
async function main() {
  console.log("Bundling real background audio picker…");
  await new Promise((resolve,reject) => {
    const compiler = webpack({mode:"development",devtool:false,entry:path.join(out,"entry.tsx"),output:{path:out,filename:"bundle.js"},
      resolve:{extensions:[".tsx",".ts",".js"],alias:{"@/lib/firebase/auth":path.join(out,"token.ts"),"@":root}},
      module:{rules:[{test:/\.tsx?$/,use:path.join(out,"loader.cjs")},{test:/\.css$/,use:path.join(out,"css-loader.cjs")}]}});
    compiler.run((error,stats) => compiler.close(() => error || stats.hasErrors() ? reject(error || Error(stats.toString({all:false,errors:true}))) : resolve()));
  });
  const source = fs.readFileSync(path.join(root,"app/globals.css"),"utf8").replace('@import "tailwindcss";', '@import "tailwindcss" source(none);\n@source "../components/explore/workflow-background-audio-picker.tsx";\n@source "../components/ui";');
  const css = (await require("postcss")([require("@tailwindcss/postcss")({base:root})]).process(source,{from:path.join(root,"app/globals.css")})).css;
  const server = http.createServer((req,res) => {
    const url = new URL(req.url,base || "http://fixture.test");
    const json = (value,status=200) => {res.writeHead(status,{"Content-Type":"application/json"});res.end(JSON.stringify(value));};
    if(url.pathname==="/bundle.js"){res.writeHead(200,{"Content-Type":"text/javascript"});res.end(fs.readFileSync(path.join(out,"bundle.js")));return;}
    if(url.pathname==="/style.css"){res.writeHead(200,{"Content-Type":"text/css"});res.end(css);return;}
    if(url.pathname.startsWith("/api/")){
      requests.push({method:req.method,path:url.pathname,source:url.searchParams.get("source"),id:url.searchParams.get("id")});
      assert.equal(req.method,"GET");assert.equal(req.headers.authorization,"Bearer fixture-token");
      if(url.pathname==="/api/explore/background-audio"){json(mode==="library-error"?{error:"Music catalogue unavailable"}:{tracks},mode==="library-error"?503:200);return;}
      if(url.pathname==="/api/explore/background-audio/file"){
        const track=tracks.find(t=>t.source===url.searchParams.get("source")&&t.id===url.searchParams.get("id"));assert.ok(track);
        if(mode==="file-error"){json({error:"This background track is no longer available. Refresh the library."},404);return;}
        res.writeHead(200,{"Content-Type":"audio/wav","Content-Length":String(wav.length),"X-Explore-Music-Loopable":String(track.loopable)});res.end(wav);return;
      }
      throw Error(`Unexpected API ${url.pathname}`);
    }
    res.writeHead(200,{"Content-Type":"text/html"});res.end('<!doctype html><html class="dark"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>');
  });
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));base=`http://127.0.0.1:${server.address().port}`;
  const browser=await playwright.chromium.launch({headless:true,...(process.platform==="win32"?{channel:"msedge"}:{})});
  try {
    const page=await browser.newPage({viewport:{width:1280,height:850}});const errors=[];page.on("pageerror",e=>errors.push(e.message));
    await page.goto(base);await page.getByRole("button",{name:"Audio Library",exact:true}).waitFor();assert.equal(requests.length,0);
    await page.getByRole("button",{name:"Audio Library",exact:true}).click();await page.getByRole("status").filter({hasText:`${tracks.length} tracks`}).waitFor();
    assert.equal(requests.some(r=>r.path==="/api/audio/history"),false);
    await page.screenshot({path:path.join(out,"library-desktop.png")});
    const search=page.getByRole("searchbox",{name:"Search background audio"});await search.fill("calm");
    assert.equal(await page.getByRole("button",{name:/^Use /}).count(),tracks.filter(t=>[t.name,t.source,t.energy,...t.moods].join(" ").toLowerCase().includes("calm")).length);
    await search.fill("does not exist");await page.getByText("No tracks match your search.").waitFor();await search.fill("Hook track 01");
    const hook=tracks.find(t=>t.source==="hook"&&!t.loopable);await search.fill(hook.name);
    await page.getByRole("button",{name:`Preview ${hook.name}`,exact:true}).click();await page.getByRole("button",{name:`Stop ${hook.name}`,exact:true}).locator(".lucide-pause").waitFor();
    assert.equal(await page.evaluate(()=>window.choices.length),0);await page.getByRole("button",{name:`Stop ${hook.name}`,exact:true}).click();
    await page.getByRole("button",{name:`Use ${hook.name}`,exact:true}).click();await page.getByLabel("Selected background audio").filter({hasText:"once"}).waitFor();
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem("selected")).playback),"once");
    const wall=tracks.find(t=>t.source==="wall"&&t.loopable);await page.getByRole("button",{name:"Audio Library",exact:true}).click();await search.fill(wall.name);
    await page.getByRole("button",{name:`Use ${wall.name}`,exact:true}).click();await page.getByLabel("Selected background audio").filter({hasText:"repeat"}).waitFor();
    mode="file-error";await page.getByRole("button",{name:"Audio Library",exact:true}).click();await search.fill(hook.name);
    await page.getByRole("button",{name:`Use ${hook.name}`,exact:true}).click();await page.getByRole("alert").filter({hasText:"no longer available"}).first().waitFor();
    assert.equal(await page.evaluate(()=>window.choices.length),2);assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem("selected")).playback),"repeat");
    mode="library-error";await page.getByRole("button",{name:"Refresh library",exact:true}).click();await page.getByRole("alert").filter({hasText:"Music catalogue unavailable"}).first().waitFor();
    mode="ok";await page.getByRole("button",{name:"Retry loading music",exact:true}).click();await page.getByRole("alert").filter({hasText:"Music catalogue unavailable"}).waitFor({state:"hidden"});
    await search.fill("");await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(out,"library-mobile.png")});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.keyboard.press("Escape");await page.getByRole("button",{name:"Change account"}).click();await page.getByRole("button",{name:"Audio Library",exact:true}).click();await page.getByText("Sign in to browse background music.").waitFor();
    assert.deepEqual(errors,[]);const report={tracks:tracks.length,previewDoesNotAttach:true,selectedPlayback:["once","repeat"],failedSelectionPreservesAudio:true,retryPassed:true,mobileOverflow:false,pageErrors:errors,requests};
    fs.writeFileSync(path.join(out,"results.json"),JSON.stringify(report,null,2));console.log(JSON.stringify({...report,requests:requests.length}));
  } finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
