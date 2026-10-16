/* eslint-disable @typescript-eslint/no-require-imports -- Real image picker, isolated auth/API boundaries. */
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const { webpack } = require('next/dist/compiled/webpack/webpack');
let pw; try { pw = require('playwright'); } catch { pw = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
const root = path.resolve(__dirname, '..'), out = path.join(root, '.tmp/workflow-image-library-browser');
fs.mkdirSync(out, {recursive:true});
const write = (name, value) => fs.writeFileSync(path.join(out, name), value);
write('loader.cjs', `const ts=require(${JSON.stringify(require.resolve('typescript'))});module.exports=function(s){return ts.transpileModule(s,{fileName:this.resourcePath,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText;};`);
write('css.cjs', `module.exports=function(source){const prefix=this.resourcePath.replace(/[^a-zA-Z]/g,'')+'_';const names=Object.fromEntries([...source.matchAll(/\\.([a-zA-Z][a-zA-Z0-9_-]*)/g)].map(m=>[m[1],prefix+m[1]]));const css=source.replaceAll(/:global\\(([^)]+)\\)/g,'$1').replaceAll(/\\.([a-zA-Z][a-zA-Z0-9_-]*)/g,(_,name)=>'.'+names[name]);return 'const style=document.createElement("style");style.textContent='+JSON.stringify(css)+';document.head.append(style);export default '+JSON.stringify(names)+';';};`);
write('ui.tsx', `export const getCurrentUserIdToken=async()=> 'fixture-owner-token';export const WorkflowAudioReference=()=>null;export const AiStudioSettingSelect=()=>null;export const WorkflowDurationControl=()=>null;`);
write('entry.tsx', `import {createRoot} from 'react-dom/client';import {useState} from 'react';import {QueryClient,QueryClientProvider} from '@tanstack/react-query';import {WorkflowCreationForm} from '@/components/explore/workflow-creation-form';import {useLocalWorkflowImages} from '@/components/explore/use-local-workflow-images';
const empty={asset:null,loading:false,error:null,choose(){},remove(){},chooseLibraryImage(){}};function App(){const images=useLocalWorkflowImages(6),[instructions,setInstructions]=useState('Keep my instructions');return <main style={{padding:20,maxWidth:500}}><h1>Talking Head + Demo</h1><WorkflowCreationForm kind="hook" ownerId="fixture-owner" creator={images} imageReferences={images} videoReference={empty} audio={empty} audioMode="voice" onAudioModeChange={()=>{}} audioLabel="Hook audio" instructions={instructions} onInstructionsChange={setInstructions} generationSettings={{model:'seedance_2_5',duration:5,quantity:1,resolution:'720p',aspectRatio:'9:16'}} onGenerationSettingsChange={()=>{}}/><output aria-label="Selected images">{images.assets.map(image=>image.assetId??image.name).join(',')}</output></main>};createRoot(document.getElementById('root')).render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><App/></QueryClientProvider>);`);
async function main() {
  const aliases = {'../firebase/auth':path.join(out,'ui.tsx')};
  for (const name of ['lib/firebase/auth','components/explore/workflow-audio-reference','components/generation/ai-studio-composer','components/explore/workflow-duration-control']) aliases['@/'+name] = path.join(out,'ui.tsx');
  aliases['@']=root;
  await new Promise((resolve,reject)=>{const c=webpack({mode:'development',devtool:false,plugins:[new webpack.DefinePlugin({'process.env.NODE_ENV':JSON.stringify('development'),'process.env.NEXT_PUBLIC_ENABLE_OPENROUTER_SEEDANCE':JSON.stringify('true'),'process.env.NEXT_PUBLIC_ENABLE_OPENROUTER_WAN':JSON.stringify('true')})],entry:path.join(out,'entry.tsx'),output:{path:out,filename:'bundle.js'},resolve:{extensions:['.tsx','.ts','.js'],alias:aliases},module:{rules:[{test:/\.tsx?$/,use:path.join(out,'loader.cjs')},{test:/\.css$/,use:path.join(out,'css.cjs')}]}});c.run((e,s)=>c.close(()=>e||s.hasErrors()?reject(e||Error(s.toString({all:false,errors:true}))):resolve()));});
  const css=(await require('postcss')([require('@tailwindcss/postcss')()]).process(fs.readFileSync(path.join(root,'app/globals.css'),'utf8').replace('@import "tailwindcss";','@import "tailwindcss" source(none);')+'\n@source "../components/explore/workflow-creation-form.tsx";\n@source "../components/explore/workflow-image-library.tsx";\n@source "../components/ui";',{from:path.join(root,'app/globals.css')})).css;
  const image = fs.readFileSync(path.join(root,'public/ai-studio/creator-references/creator-01.png'));
  let listReads=0,ownedReads=0;
  const asset = {id:'00000000-0000-4000-8000-000000000001',title:'My product',fileName:'product.png',collection:'image',sourceType:'upload',status:'ready',mimeType:'image/png',projectId:'explore-reference',url:'/owned.png',thumbnailUrl:null};
  const server=http.createServer((req,res)=>{const url=new URL(req.url,'http://fixture');
    if(url.pathname==='/bundle.js'){res.setHeader('Content-Type','text/javascript');return res.end(fs.readFileSync(path.join(out,'bundle.js')));}
    if(url.pathname.startsWith('/api/media')){assert.equal(req.headers.authorization,'Bearer fixture-owner-token');res.setHeader('Content-Type','application/json');if(url.pathname==='/api/media'){listReads++;return res.end(JSON.stringify({ok:true,assets:[asset]}));}ownedReads++;return res.end(JSON.stringify({ok:true,asset}));}
    if(url.pathname.endsWith('.png')){res.setHeader('Content-Type','image/png');return res.end(image);}
    res.setHeader('Content-Type','text/html');res.end('<html class="dark"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'body{margin:0}</style><div id="root"></div><script>window.process={env:{NODE_ENV:"development"}};</script><script src="/bundle.js"></script></html>');});
  await new Promise(r=>server.listen(0,'127.0.0.1',r)); let browser;
  try {
    browser=await pw.chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})}); const page=await browser.newPage(),errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error('Fixture page error:',e.message)});
    for(const viewport of [{width:1536,height:864},{width:1366,height:768},{width:390,height:844}]){
      await page.setViewportSize(viewport);await page.goto('http://127.0.0.1:'+server.address().port);
      const before=listReads;await page.getByRole('button',{name:/Choose image, currently/}).click();
      await page.getByRole('tab',{name:'Your images',exact:true}).click();await page.getByRole('button',{name:'Use your image product.png',exact:true}).waitFor();
      assert.ok(listReads>before);
      const popup=page.locator('[data-slot="popover-content"]');await popup.evaluate(async el=>{await Promise.all(el.getAnimations().map(a=>a.finished));});
      const r=await popup.boundingBox();assert.ok(r.x>=0&&r.x+r.width<=viewport.width+1&&r.y>=0&&r.y+r.height<=viewport.height+1,JSON.stringify({viewport,r}));
      await page.screenshot({path:path.join(out,'your-images-'+viewport.width+'.png')});
      await page.getByRole('button',{name:'Use your image product.png',exact:true}).click();await popup.waitFor({state:'hidden'});
      assert.equal(await page.getByLabel('Selected images').innerText(),asset.id);assert.equal(await page.getByRole('textbox',{name:'Your instructions'}).inputValue(),'Keep my instructions');
      await page.getByRole('button',{name:/Choose image, currently/}).click();await page.getByRole('tab',{name:'UGC Pilot images',exact:true}).click();
      await page.getByRole('button',{name:'Use creator 1',exact:true}).click();await popup.waitFor({state:'hidden'});
      assert.match(await page.getByLabel('Selected images').innerText(),/creator-reference-01.png/);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      console.log(JSON.stringify({viewport,savedSelection:true,catalogueSelection:true,instructionsRetained:true}));
    }
    assert.equal(ownedReads,3);assert.deepEqual(errors,[]);console.log('PASS actual Talking Head form and image collection; auth/API are isolated fixtures.');
  } finally {await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
