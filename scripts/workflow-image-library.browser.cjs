/* eslint-disable @typescript-eslint/no-require-imports -- Real image picker, isolated auth/API boundaries. */
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), http = require('node:http');
// A separate locked runtime supports validation when workspace dependencies were cleaned.
const validationRuntime=process.env.PICKER_TEST_RUNTIME;
const fixtureRequire=validationRuntime?require('node:module').createRequire(path.resolve(validationRuntime,'package.json')):require;
const { webpack } = fixtureRequire('next/dist/compiled/webpack/webpack');
let pw; try { pw = require('playwright'); } catch { pw = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
const root = path.resolve(__dirname, '..'), out = path.join(root, '.tmp/workflow-image-library-browser');
fs.mkdirSync(out, {recursive:true});
const write = (name, value) => fs.writeFileSync(path.join(out, name), value);
write('loader.cjs', `const ts=require(${JSON.stringify(fixtureRequire.resolve('typescript'))});module.exports=function(s){return ts.transpileModule(s,{fileName:this.resourcePath,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText;};`);
write('css.cjs', `module.exports=function(source){const prefix=this.resourcePath.replace(/[^a-zA-Z]/g,'')+'_';const names=Object.fromEntries([...source.matchAll(/\\.([a-zA-Z][a-zA-Z0-9_-]*)/g)].map(m=>[m[1],prefix+m[1]]));const css=source.replaceAll(/:global\\(([^)]+)\\)/g,'$1').replaceAll(/\\.([a-zA-Z][a-zA-Z0-9_-]*)/g,(_,name)=>'.'+names[name]);return 'const style=document.createElement("style");style.textContent='+JSON.stringify(css)+';document.head.append(style);export default '+JSON.stringify(names)+';';};`);
write('ui.tsx', `export const getCurrentUserIdToken=async()=> 'fixture-owner-token';export const WorkflowAudioReference=()=>null;export const AiStudioSettingSelect=()=>null;export const WorkflowDurationControl=()=>null;export const readAIStudioReferenceMetadata=async()=>({});export const uploadAIStudioReferenceMedia=async(file,kind,duration,owner,options)=>({kind,asset:{id:'catalog-'+file.name,fileName:file.name,title:file.name,url:'/catalog.png',projectId:options?.purpose}});`);
write('entry.tsx', `import {createRoot} from 'react-dom/client';import {useState} from 'react';import {QueryClient,QueryClientProvider} from '@tanstack/react-query';import {WorkflowCreationForm} from '@/components/explore/workflow-creation-form';import {useLocalWorkflowImages} from '@/components/explore/use-local-workflow-images';import {FormatGenerationReferences} from '@/components/explore/format-generation-references';
const empty={asset:null,loading:false,error:null,choose(){},remove(){},chooseLibraryImage(){}};function App(){const images=useLocalWorkflowImages(6),[selected,setSelected]=useState([]),[instructions,setInstructions]=useState('Keep my instructions'),modern=new URLSearchParams(location.search).has('modern');return <main style={{padding:20,maxWidth:500}}><h1>{modern?'Hook video':'Talking Head + Demo'}</h1>{modern?<><FormatGenerationReferences ownerId="fixture-owner" selection={null} imageSelections={selected} maxImages={3} onChange={image=>setSelected(current=>[...current,image])} onImagesChange={setSelected} onPendingChange={()=>{}}/><textarea aria-label="Your instructions" value={instructions} onChange={event=>setInstructions(event.target.value)}/></>:<WorkflowCreationForm kind="hook" ownerId="fixture-owner" creator={images} imageReferences={images} videoReference={empty} audio={empty} audioMode="voice" onAudioModeChange={()=>{}} audioLabel="Hook audio" instructions={instructions} onInstructionsChange={setInstructions} generationSettings={{model:'seedance_2_5',duration:5,quantity:1,resolution:'720p',aspectRatio:'9:16'}} onGenerationSettingsChange={()=>{}}/>}<output aria-label="Selected images">{modern?selected.map(image=>image.asset.id).join(','):images.assets.map(image=>image.assetId??image.name).join(',')}</output></main>};createRoot(document.getElementById('root')).render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><App/></QueryClientProvider>);`);
async function main() {
  const aliases = {'../firebase/auth':path.join(out,'ui.tsx')};
  for (const name of ['lib/firebase/auth','lib/ai-studio/reference-media-upload','components/explore/workflow-audio-reference','components/generation/ai-studio-composer','components/explore/workflow-duration-control']) aliases['@/'+name] = path.join(out,'ui.tsx');
  aliases['@']=root;
  await new Promise((resolve,reject)=>{const c=webpack({mode:'development',devtool:false,plugins:[new webpack.DefinePlugin({'process.env.NODE_ENV':JSON.stringify('development'),'process.env.NEXT_PUBLIC_ENABLE_OPENROUTER_SEEDANCE':JSON.stringify('true'),'process.env.NEXT_PUBLIC_ENABLE_OPENROUTER_WAN':JSON.stringify('true')})],entry:path.join(out,'entry.tsx'),output:{path:out,filename:'bundle.js'},resolve:{extensions:['.tsx','.ts','.js'],alias:aliases,modules:validationRuntime?[path.resolve(validationRuntime,'node_modules'),'node_modules']:['node_modules']},module:{rules:[{test:/\.tsx?$/,use:path.join(out,'loader.cjs')},{test:/\.css$/,use:path.join(out,'css.cjs')}]}});c.run((e,s)=>c.close(()=>e||s.hasErrors()?reject(e||Error(s.toString({all:false,errors:true}))):resolve()));});
  let cssSource=fs.readFileSync(path.join(root,'app/globals.css'),'utf8');
  if(validationRuntime)for(const [name,target] of [['tailwindcss','node_modules/tailwindcss/index.css'],['tw-animate-css','node_modules/tw-animate-css/dist/tw-animate.css'],['shadcn/tailwind.css','package/dist/tailwind.css']])cssSource=cssSource.replace('@import "'+name+'";','@import "'+path.resolve(validationRuntime,target).replaceAll('\\','/')+'"'+(name==='tailwindcss'?' source(none)':'')+';');
  const css=(await fixtureRequire('postcss')([fixtureRequire('@tailwindcss/postcss')()]).process(cssSource.replace('@import "tailwindcss";','@import "tailwindcss" source(none);')+'\n@source "../components/explore/workflow-creation-form.tsx";\n@source "../components/explore/workflow-image-library.tsx";\n@source "../components/explore/format-generation-references.tsx";\n@source "../components/ui";',{from:path.join(root,'app/globals.css')})).css;
  const image = fs.readFileSync(path.join(root,'public/ai-studio/creator-references/creator-01.png'));
  const thumbnail = await fixtureRequire('sharp')(image).resize({width:256,withoutEnlargement:true}).webp({quality:75}).toBuffer();
  let listReads=0,ownedReads=0,largeInventory=false;const thumbnailRequests=[];
  const asset = {id:'00000000-0000-4000-8000-000000000001',title:'My product',fileName:'product.png',collection:'image',sourceType:'upload',status:'ready',mimeType:'image/png',projectId:'explore-reference',url:'/owned.png',thumbnailUrl:null};
  const second = {...asset,id:'00000000-0000-4000-8000-000000000002',fileName:'second.png',title:'Second image',url:'/second-owned.png'};
  const server=http.createServer((req,res)=>{const url=new URL(req.url,'http://fixture');
    if(url.pathname==='/bundle.js'){res.setHeader('Content-Type','text/javascript');return res.end(fs.readFileSync(path.join(out,'bundle.js')));}
    if(url.pathname==='/_next/image'){thumbnailRequests.push(url.searchParams.get('url'));assert.ok(['64','128','256'].includes(url.searchParams.get('w')));assert.equal(url.searchParams.get('q'),'75');res.setHeader('Content-Type','image/webp');return res.end(thumbnail);}
    if(url.pathname.startsWith('/api/media')){assert.equal(req.headers.authorization,'Bearer fixture-owner-token');res.setHeader('Content-Type','application/json');if(url.pathname==='/api/media'){listReads++;const assets=largeInventory?Array.from({length:114},(_,i)=>({...asset,id:'fixture-'+i,fileName:'product-'+i+'.png',url:'https://storage.googleapis.com/ugcsaas-media/fixture/product-'+i+'.png'})):[asset,second];return res.end(JSON.stringify({ok:true,assets}));}ownedReads++;return res.end(JSON.stringify({ok:true,asset:url.pathname.endsWith(second.id)?second:asset}));}
    if(url.pathname.endsWith('.png')){res.setHeader('Content-Type','image/png');return res.end(image);}
    res.setHeader('Content-Type','text/html');res.end('<html class="dark"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'body{margin:0}</style><div id="root"></div><script>window.process={env:{NODE_ENV:"development"}};</script><script src="/bundle.js"></script></html>');});
  await new Promise(r=>server.listen(0,'127.0.0.1',r)); let browser;
  if(process.argv.includes('--serve')){console.log('Image picker fixture: http://127.0.0.1:'+server.address().port+'/?modern=1');return;}
  try {
    browser=await pw.chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})}); const page=await browser.newPage(),errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error('Fixture page error:',e.message)});
    for(const modern of [true,false]) for(const viewport of [{width:1536,height:864},{width:1366,height:768},{width:390,height:844}]){
      await page.setViewportSize(viewport);await page.goto('http://127.0.0.1:'+server.address().port+(modern?'?modern=1':''));
      const trigger=()=>page.getByRole('button',{name:modern?/^(Add|Replace) image reference$/:/Choose image, currently/});
      const before=listReads;await trigger().click();
      await page.getByRole('tab',{name:'Uploaded photos',exact:true}).click();await page.getByRole('button',{name:'Use your image product.png',exact:true}).waitFor();
      assert.ok(listReads>before);
      const popup=modern?page.getByRole('dialog'):page.locator('[data-slot="popover-content"]');await popup.evaluate(async el=>{await Promise.all(el.getAnimations().map(a=>a.finished));});
      const r=await popup.boundingBox();assert.ok(r.x>=0&&r.x+r.width<=viewport.width+1&&r.y>=0&&r.y+r.height<=viewport.height+1,JSON.stringify({viewport,r}));
      const firstButton=()=>page.getByRole('button',{name:'Use your image product.png',exact:true}),secondButton=()=>page.getByRole('button',{name:'Use your image second.png',exact:true});
      await firstButton().click();await firstButton().filter({has:page.locator('svg')}).waitFor();
      await secondButton().click();await secondButton().filter({has:page.locator('svg')}).waitFor();
      assert.equal(await firstButton().getAttribute('aria-pressed'),'true');assert.equal(await secondButton().getAttribute('aria-pressed'),'true');
      assert.equal(await page.locator('output[aria-label="Selected images"]').innerText(),asset.id+','+second.id);
      await page.screenshot({path:path.join(out,(modern?'hook':'talking-head')+'-multiple-'+viewport.width+'.png')});
      await firstButton().click();await page.waitForFunction(expected=>document.querySelector('output').textContent===expected,second.id);
      assert.equal(await firstButton().getAttribute('aria-pressed'),'false');
      await page.getByRole('button',{name:'UGC Pilot images',exact:true}).click();
      const catalog=()=>page.getByRole('button',{name:'Use creator 1',exact:true});await catalog().click();await catalog().filter({has:page.locator('svg')}).waitFor();
      assert.match(await page.locator('output[aria-label="Selected images"]').innerText(),/creator-reference-01.png/);
      await catalog().click();await page.waitForFunction(expected=>document.querySelector('output').textContent===expected,second.id);
      await page.getByRole('button',{name:'Done',exact:true}).click();await popup.waitFor({state:'hidden'});
      await trigger().click();await page.getByRole('tab',{name:'Uploaded photos',exact:true}).click();assert.equal(await secondButton().getAttribute('aria-pressed'),'true');
      await page.keyboard.press('Escape');await popup.waitFor({state:'hidden'});
      assert.equal(await page.getByRole('textbox',{name:'Your instructions'}).inputValue(),'Keep my instructions');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      console.log(JSON.stringify({workflow:modern?'hook':'talking-head',viewport,multipleSelections:true,checkboxes:true,deselection:true,reopenRetained:true,instructionsRetained:true}));
    }
    assert.equal(ownedReads,12);
    largeInventory=true;thumbnailRequests.length=0;
    await page.setViewportSize({width:1366,height:768});await page.goto('http://127.0.0.1:'+server.address().port+'?modern=1');
    const openPicker=()=>page.getByRole('button',{name:'Add image reference',exact:true}).click();
    await openPicker();await page.getByRole('button',{name:'Use your image product-0.png',exact:true}).waitFor();
    const tiles=()=>page.getByRole('button',{name:/^Use your image /});
    assert.equal(await tiles().count(),24);
    const previews=await tiles().locator('img').evaluateAll(images=>images.map(image=>image.getAttribute('src')));
    assert.ok(previews.every(src=>src.startsWith('/_next/image?')&&src.includes('w=256')));
    assert.ok(thumbnailRequests.every(src=>!src.startsWith('/ai-studio/creator-references/')),'Hidden catalogue must not start image requests');
    await page.getByRole('button',{name:'Load more images',exact:true}).click();assert.equal(await tiles().count(),48);
    const reads=listReads;await page.getByRole('button',{name:'Done',exact:true}).click();await openPicker();
    assert.equal(await tiles().count(),24);assert.equal(listReads,reads,'Reopen inside freshness window must reuse metadata');
    const input=page.getByLabel('Choose optional image reference', {exact:true});assert.equal(await input.getAttribute('multiple'),'');
    await input.setInputFiles(['first.png','second.png','third.png'].map(name=>({name,mimeType:'image/png',buffer:image})));
    await page.waitForFunction(()=>document.querySelector('output').textContent==='catalog-first.png,catalog-second.png,catalog-third.png');
    assert.deepEqual(errors,[]);
    console.log(JSON.stringify({workflow:'hook',librarySize:114,initialTiles:24,loadMoreTiles:48,thumbnailWidth:256,hiddenCatalogueRequests:0,warmReopenMetadataRequests:0,multiFileUpload:true,originalReferenceUrlsPreserved:true}));
    console.log('PASS actual Hook and Talking Head image pickers; auth/upload/API and thumbnail responses are isolated fixtures, not production timing.');
  } finally {await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
