/* eslint-disable @typescript-eslint/no-require-imports -- Isolated browser check; no live account writes. */
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { webpack } = require('next/dist/compiled/webpack/webpack');
const postcss = require('postcss'), tailwind = require('@tailwindcss/postcss');
const root = path.resolve(__dirname, '..'), out = path.join(root, '.tmp/talking-head-music-browser');
fs.mkdirSync(out, { recursive: true });
const put = (name, text) => fs.writeFileSync(path.join(out, name), text);
put('loader.cjs', `const ts=require(${JSON.stringify(require.resolve('typescript'))});module.exports=source=>ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText;`);
put('css.cjs', `module.exports=source=>{const names=Object.fromEntries([...source.matchAll(/\\.([a-zA-Z][a-zA-Z0-9_-]*)/g)].map(m=>[m[1],m[1]]));return 'const style=document.createElement("style");style.textContent='+JSON.stringify(source.replaceAll(/:global\\(([^)]+)\\)/g,'$1'))+';document.head.append(style);export default '+JSON.stringify(names)+';';};`);
put('stubs.tsx', `export const getCurrentUserIdToken=async()=>"fixture-token";
export const fetchAIStudioMediaAsset=async id=>{const a=JSON.parse(localStorage.getItem('music-assets')||'{}')[id];if(!a)throw Error('Missing fixture asset');return a;};
export const uploadAIStudioReferenceMedia=async file=>{if(file.name.includes('reject'))throw Error('Rejected fixture replacement');const all=JSON.parse(localStorage.getItem('music-assets')||'{}');const id='00000000-0000-4000-8000-'+String(Object.keys(all).length+1).padStart(12,'0');const asset={id,title:file.name,url:location.origin+'/track.wav',collection:'audio',status:'ready',mimeType:'audio/wav',durationSeconds:1};all[id]=asset;localStorage.setItem('music-assets',JSON.stringify(all));return{asset};};
export const WorkflowSavedAudioPicker=()=>null;export const WorkflowSubtitlePreview=()=>null;export const WorkflowDemoControls=()=>null;export const WorkflowCaptionEditor=()=>null;
export default function Wrapper({children,...props}){return <a {...props}>{children}</a>;}`);
put('entry.tsx', `import {createRoot} from 'react-dom/client';import {useState,useEffect} from 'react';import {QueryClient,QueryClientProvider} from '@tanstack/react-query';import {WorkflowCompositionPanel} from '@/components/explore/workflow-composition-panel';import {useWorkflowBackgroundMusic} from '@/components/explore/use-workflow-background-music';
const empty={asset:null,loading:false,error:null,choose:async()=>false,chooseRemote:async()=>false,remove(){},clearError(){},chooseLibraryImage(){}};
function App(){const [options,setOptions]=useState(()=>JSON.parse(localStorage.getItem('music-options')||'{"subtitles":false,"style":"clean","backgroundMusic":false}'));useEffect(()=>{localStorage.setItem('music-options',JSON.stringify(options))},[options]);const music=useWorkflowBackgroundMusic({ownerId:'fixture-owner',enabled:true,options,setOptions});const demo={...empty,asset:{name:'Demo.mp4',url:'/clip.mp4',duration:3}};const demoAudio={...empty,asset:{name:'Demo-only.wav',url:'/track.wav',duration:1}};
return <main style={{maxWidth:1040,margin:'0 auto',padding:16}}><h1>Talking Head + Demo · isolated component check</h1><div style={{display:'grid',gridTemplateColumns:'minmax(0, 380px) minmax(0, 1fr)',gap:20}} className="fixture-grid"><aside style={{padding:16,border:'1px solid var(--border)',borderRadius:16}}><WorkflowCompositionPanel videoLabel="Talking head" demo={demo} demoAudio={demoAudio} demoAudioPlayback="once" onDemoAudioPlaybackChange={()=>{}} connected ownerId="fixture-owner" options={options} onOptionsChange={setOptions} backgroundMusic={music}/></aside><section><h2>Whole-video track</h2><p>Preview source: {options.backgroundMusic?music.source?.title||'Default music':'Off'}</p>{options.backgroundMusic&&music.source?<audio aria-label="Combined background audio" src={music.source.url} controls/>:null}<p>Demo-only.wav remains attached to the demo.</p></section></div></main>}
createRoot(document.getElementById('root')).render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><App/></QueryClientProvider>);`);
async function main() {
  const aliases = { '@': root };
  for (const name of ['lib/firebase/auth','lib/ai-studio/media-client','lib/ai-studio/reference-media-upload','components/explore/workflow-saved-audio-picker','components/explore/workflow-subtitle-preview','components/explore/workflow-demo-controls']) aliases['@/'+name]=path.join(out,'stubs.tsx');
  aliases['next/link']=path.join(out,'stubs.tsx');
  aliases[path.join(root,'components/explore/workflow-caption-editor.tsx')]=path.join(out,'stubs.tsx');
  await new Promise((resolve,reject)=>{const compiler=webpack({mode:'development',devtool:false,plugins:[new webpack.DefinePlugin({'process.env.NODE_ENV':JSON.stringify('development')})],entry:path.join(out,'entry.tsx'),output:{path:out,filename:'bundle.js'},resolve:{extensions:['.tsx','.ts','.js'],alias:aliases},module:{rules:[{test:/\.tsx?$/,use:path.join(out,'loader.cjs')},{test:/\.css$/,use:path.join(out,'css.cjs')}]}});compiler.run((error,stats)=>compiler.close(()=>error||stats.hasErrors()?reject(error||Error(stats.toString({all:false,errors:true}))):resolve()));});
  const css=(await postcss([tailwind()]).process(`@import "${path.join(root,'app/globals.css').replaceAll(path.sep,'/')}";`,{from:path.join(out,'fixture.css')})).css;
  const wav=Buffer.alloc(16044);wav.write('RIFF');wav.writeUInt32LE(16036,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(8000,24);wav.writeUInt32LE(16000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(16000,40);
  const server=http.createServer((req,res)=>{
    if(req.url==='/bundle.js'){res.setHeader('Content-Type','text/javascript');return res.end(fs.readFileSync(path.join(out,'bundle.js')));}
    if(req.url.startsWith('/track.wav')||req.url.startsWith('/api/explore/background-audio/file')){res.setHeader('Content-Type','audio/wav');res.setHeader('Content-Length',wav.length);res.setHeader('X-Explore-Music-Loopable','true');return res.end(wav);}
    if(req.url==='/api/explore/background-audio'){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({tracks:[{id:'sample',source:'hook',name:'Calm fixture music',durationSeconds:1,moods:['calm'],energy:'low',loopable:true}]}));}
    if(req.url==='/clip.mp4'){res.setHeader('Content-Type','video/mp4');return res.end(fs.readFileSync(path.join(root,'public/marketing/showcase-part2/hook2-preview.mp4')));}
    res.setHeader('Content-Type','text/html');res.end(`<html class="dark"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}body{margin:0}h1{margin-bottom:16px;font-size:18px}h2{font-size:16px}@media(max-width:700px){.fixture-grid{grid-template-columns:minmax(0,1fr)!important}}audio{max-width:100%}</style></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>`);
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  if(process.argv.includes('--serve-only')){console.log(`Fixture URL: http://127.0.0.1:${server.address().port}`);return;}
  let browser;
  try {
    let playwright;try{playwright=require('playwright')}catch{playwright=require(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'))}
    browser=await playwright.chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});const page=await browser.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
    for(const viewport of [{width:1280,height:720},{width:1536,height:864},{width:390,height:844}]){
      await page.setViewportSize(viewport);await page.goto(`http://127.0.0.1:${server.address().port}`);await page.evaluate(()=>localStorage.clear());await page.reload();
      const group=page.getByRole('region',{name:'Background music',exact:true});await group.getByRole('button',{name:'Audio Library',exact:true}).click();await page.getByRole('button',{name:'Use Calm fixture music',exact:true}).click();
      await group.getByText('Calm fixture music.wav',{exact:true}).waitFor();assert.equal(await page.getByLabel('Combined background audio').count(),0);assert.equal(await group.getByRole('switch',{name:'Background music',exact:true}).getAttribute('aria-checked'),'false');await group.getByRole('switch',{name:'Background music',exact:true}).click();await page.getByLabel('Combined background audio').waitFor();
      assert.equal(await page.getByText('Demo-only.wav',{exact:true}).count(),1);await group.getByLabel('Whole-video music playback').selectOption('once');
      await page.reload();await group.getByText('Calm fixture music.wav',{exact:true}).waitFor();assert.equal(await group.getByLabel('Whole-video music playback').inputValue(),'once');
      await group.locator('input[type=file]').setInputFiles({name:'reject.wav',mimeType:'audio/wav',buffer:wav});await group.getByRole('alert').getByText('Rejected fixture replacement',{exact:true}).waitFor();assert.equal(await group.getByText('Calm fixture music.wav',{exact:true}).count(),1);
      await group.scrollIntoViewIfNeeded();await page.screenshot({path:path.join(root,`outputs/talking-head-music-${viewport.width}.png`),fullPage:false});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      await group.getByRole('button',{name:'Remove music',exact:true}).click();assert.equal(await page.getByLabel('Combined background audio').count(),0);assert.equal(await page.getByText('Demo-only.wav',{exact:true}).count(),1);
    }
    assert.deepEqual(errors,[]);console.log('PASS actual music group/library: select, repeat/once, reload, failed replacement retention, removal, independent demo audio; 1280x720,1536x864,390x844. Isolated fixture only.');
  } finally {await browser?.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error);process.exitCode=1});
