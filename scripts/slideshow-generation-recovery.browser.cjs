/* eslint-disable @typescript-eslint/no-require-imports -- Actual panel and HTTP clients against a local fixture API. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { webpack } = require('next/dist/compiled/webpack/webpack');
let playwright;
try { playwright = require('playwright'); }
catch { playwright = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
const root = path.resolve(__dirname, '..'), out = path.join(root, '.tmp/slideshow-generation-recovery');
fs.mkdirSync(out, { recursive: true });
const write = (name, value) => fs.writeFileSync(path.join(out, name), value);
write('loader.cjs', `const ts=require(${JSON.stringify(require.resolve('typescript'))});module.exports=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText;`);
write('css.cjs', `module.exports=()=> 'export default new Proxy({},{get:(_,key)=>key});';`);
write('auth.ts', `export const useAuth=()=>({user:{uid:window.fixtureOwner??'owner-a'},loading:false});export async function getCurrentUserIdToken(owner){const current=window.fixtureOwner??'owner-a';if(owner&&owner!==current)throw Error('Account changed');return 'fixture-'+current;}`);
write('composer.tsx', `export const AiStudioComposer=p=><section aria-label='Generation instructions'><textarea aria-label='Your instructions' value={p.prompt} onChange={e=>p.onPromptChange(e.target.value)}/><button disabled={p.generateDisabled} onClick={()=>p.onSubmit()}>{p.generateLabel}</button>{p.promptFeedback}</section>;export const AiStudioSettingSelect=()=>null;export const AiStudioRatioPicker=()=>null;`);
write('entry.tsx', `import {createRoot} from 'react-dom/client';import {useState,useCallback} from 'react';import {QueryClient,QueryClientProvider} from '@tanstack/react-query';import {ImageGenerationStudioPanel} from '@/components/workspace/ugc-chat-workspace';
window.fixtureOwner=sessionStorage.getItem('owner')??'owner-a';
function App(){const [mounted,setMounted]=useState(true),[owner,setOwner]=useState(window.fixtureOwner),[view,setView]=useState('draft'),[assemblies,setAssemblies]=useState(0);const [client]=useState(()=>new QueryClient({defaultOptions:{queries:{retry:false}}}));const restore=useCallback(()=>setView('generated'),[]),start=useCallback(()=>setView('generated'),[]),assemble=useCallback(()=>{setAssemblies(n=>n+1);return true;},[]);
return <QueryClientProvider client={client}><header><button onClick={()=>{setMounted(false);history.replaceState({},'', '/other');}}>Leave workflow</button><button onClick={()=>{history.replaceState({},'', '/explore/slideshows');setMounted(true);}}>Return to Slideshows</button><button onClick={()=>{window.fixtureOwner=owner==='owner-a'?'owner-b':'owner-a';sessionStorage.setItem('owner',window.fixtureOwner);setOwner(window.fixtureOwner);}}>Switch account</button><button onClick={()=>setView('draft')}>Your Slides</button></header><p data-testid='owner'>{owner}</p><p data-testid='assemblies'>{assemblies}</p><p>Existing edited sequence stays intact.</p>{view==='draft'?<p data-testid='draft'>Your retained slides</p>:null}<div style={{display:view==='generated'?'block':'none'}}>{mounted?<ImageGenerationStudioPanel key={owner} active accessState='pro' recreateView={{preview:false,emptyContent:<p>No generated images</p>,referenceImageUrl:'https://fixture.test/source.webp',referenceImageUrls:['https://fixture.test/source.webp','https://fixture.test/source2.webp'],slideshowSlideCount:2,slideshowSources:[{referenceId:'source',slideId:'one',slideNumber:1},{referenceId:'source',slideId:'two',slideNumber:2}],workflow:{format:'slideshow',controlsTarget:null,resultsTarget:null,onGenerationStart:start,onGenerationRestore:restore,onGeneratedSlideshow:assemble}}}/>:null}</div>{view==='draft'&&mounted?<button onClick={()=>setView('generated')}>Generated slides</button>:null}</QueryClientProvider>}
createRoot(document.getElementById('root')).render(<App/>);`);
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
let jobs = [], submitted = [], responseMode = 'accept', lastKey;
const now = () => new Date().toISOString();
function asset(job) { return { id: job.output.mediaAssetId, collection:'image',sourceType:'generated_image',sourceRecordId:job.id,status:'ready',url:job.output.url,title:'Slide '+job.slideshowGeneration.slideIndex,createdAt:job.completedAt,updatedAt:job.updatedAt,ratio:'4:5',metadata:{exploreFormat:'slideshow',slideshowGeneration:job.slideshowGeneration},mimeType:'image/webp',width:1080,height:1350 }; }
const receipt = () => ({ok:true,jobId:jobs[0].id,jobs:jobs.map(j=>({jobId:j.id,generationId:id(200+j.slideshowGeneration.slideIndex),slideshowGeneration:j.slideshowGeneration})),partial:false,message:'Accepted'});
async function main(){
  const aliases={'@/contexts/auth-context':path.join(out,'auth.ts'),'@/lib/firebase/auth':path.join(out,'auth.ts'),'@/components/generation/ai-studio-composer':path.join(out,'composer.tsx'),'@':root};
  await new Promise((resolve,reject)=>{const compiler=webpack({mode:'development',devtool:false,context:root,entry:path.join(out,'entry.tsx'),output:{path:out,filename:'bundle.js'},resolve:{extensions:['.tsx','.ts','.js'],alias:aliases},module:{rules:[{test:/\.tsx?$/,use:path.join(out,'loader.cjs')},{test:/\.css$/,use:path.join(out,'css.cjs')}]}});compiler.run((error,stats)=>compiler.close(()=>error||stats.hasErrors()?reject(error||Error(stats.toString({all:false,errors:true}))):resolve()));});
  const server=http.createServer(async(req,res)=>{try {
    const url=new URL(req.url,'http://fixture'),json=(v,status=200)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(v));};
    if(url.pathname==='/bundle.js'){res.setHeader('Content-Type','text/javascript');return res.end(fs.readFileSync(path.join(out,'bundle.js')));}
    if(!url.pathname.startsWith('/api/')){res.setHeader('Content-Type','text/html');return res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:16px;background:#202020;color:white;font:14px Arial}header{display:flex;flex-wrap:wrap;gap:8px}button,textarea{background:#333;color:white;padding:10px;margin:4px;border:1px solid #777;border-radius:8px}textarea{display:block;width:min(80vw,400px)}img{max-width:180px}section{min-width:0;overflow-wrap:anywhere}main{max-width:100%}</style></head><body><div id="root"></div><script>window.process={env:{}}</script><script src="/bundle.js"></script></body></html>');}
    const owner=req.headers.authorization?.slice('Bearer fixture-'.length);assert.ok(['owner-a','owner-b'].includes(owner));
    const owned=jobs.filter(j=>j.owner===owner);
    if(url.pathname==='/api/jobs')return json({ok:true,jobs:owned.filter(j=>j.status==='processing')});
    if(url.pathname.startsWith('/api/jobs/')){const job=owned.find(j=>j.id===url.pathname.split('/').at(-1));return json(job?{ok:true,job}:{ok:false,error:'Not found'},job?200:404);}
    if(url.pathname==='/api/media')return json({ok:true,assets:owned.filter(j=>j.status==='completed').map(asset)});
    if(url.pathname.startsWith('/api/media/')){const job=owned.find(j=>j.output?.mediaAssetId===url.pathname.split('/').at(-1));return json(job?{ok:true,asset:asset(job)}:{ok:false,error:'Unavailable'},job?200:404);}
    if(url.pathname==='/api/ai-studio/generation-requests')return json({...receipt(),requestKey:lastKey,outcome:'accepted'});
    if(url.pathname==='/api/ai-studio/images/generate'){
      let raw='';for await(const part of req)raw+=part;const input=JSON.parse(raw);submitted.push(input);lastKey=req.headers['idempotency-key'];
      if(responseMode==='clarify')return json({ok:false,message:'Clarify the screen destination',clarifications:['Should Upload B appear on Source slide 1 or 2?']},422);
      jobs=[1,2].map(n=>({id:id(submitted.length*10+n),owner,jobType:'image_generation',exploreFormat:'slideshow',status:'processing',createdAt:now(),updatedAt:now(),progress:20,stage:'generating',output:null,error:null,slideshowGeneration:{version:1,batchKey:lastKey,slideIndex:n,slideCount:2,versionIndex:1,versionCount:1}}));
      return responseMode==='lost'?json({ok:false,message:'Acknowledgement interrupted'},503):json(receipt(),202);
    }
    throw Error('Unexpected API '+url.pathname);
  }catch(error){res.writeHead(500,{'Content-Type':'application/json'});res.end(JSON.stringify({ok:false,error:error.message}));}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await playwright.chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
  const page=await browser.newPage({viewport:{width:1366,height:768}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://fixture.test/**',r=>r.fulfill({contentType:'image/webp',body:fs.readFileSync(path.join(root,'public/try-ugcpilot/posters/card-22.webp'))}));
  const complete=()=>{jobs=jobs.map(j=>({...j,status:'completed',progress:100,updatedAt:now(),completedAt:now(),output:{mediaAssetId:id(500+j.slideshowGeneration.slideIndex),url:'https://fixture.test/slide-'+j.slideshowGeneration.slideIndex+'.webp'}}));};
  async function generate(){await page.getByLabel('Your instructions',{exact:true}).fill('Keep the scene and adapt the content');await page.getByRole('button',{name:'Generate 2 slides',exact:true}).click();}
  try {
    await page.goto('http://127.0.0.1:'+server.address().port+'/explore/slideshows');
    await page.getByRole('button',{name:'Generated slides',exact:true}).click();await generate();
    await page.waitForFunction(()=>new URLSearchParams(location.search).has('explore-slideshowJob'));
    await page.getByRole('button',{name:'Leave workflow',exact:true}).click();complete();
    await page.getByRole('button',{name:'Return to Slideshows',exact:true}).click();
    await page.locator('img[src="https://fixture.test/slide-2.webp"]').first().waitFor();
    assert.equal(submitted.length,1);assert.equal(await page.getByTestId('assemblies').textContent(),'0','Recovered history cannot overwrite an edited sequence');
    await page.screenshot({path:path.join(out,'completed-desktop.png')});
    await page.reload();await page.locator('img[src="https://fixture.test/slide-1.webp"]').first().waitFor();assert.equal(submitted.length,1);
    await page.getByRole('button',{name:'Your Slides',exact:true}).click();await page.getByTestId('draft').waitFor();
    await page.waitForTimeout(150);assert.equal(await page.getByTestId('draft').isVisible(),true,'A later render cannot reopen generated results');
    await page.getByRole('button',{name:'Switch account',exact:true}).click();await page.getByRole('button',{name:'Generated slides',exact:true}).click();await page.getByText('No generated images',{exact:true}).waitFor();
    assert.equal(await page.locator('img[src="https://fixture.test/slide-1.webp"]').count(),0,'Foreign account sees no previous image');
    await page.getByRole('button',{name:'Switch account',exact:true}).click();
    responseMode='clarify';await generate();await page.getByText('No images were started. Your previous slideshow request needs clarification.',{exact:true}).waitFor();
    await page.getByRole('button',{name:'Leave workflow',exact:true}).click();await page.getByRole('button',{name:'Return to Slideshows',exact:true}).click();
    await page.getByText('Should Upload B appear on Source slide 1 or 2?',{exact:true}).waitFor();await page.reload();await page.getByText('Should Upload B appear on Source slide 1 or 2?',{exact:true}).waitFor();
    assert.equal(submitted.length,2);await page.setViewportSize({width:390,height:844});await page.getByText('Should Upload B appear on Source slide 1 or 2?',{exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,'clarification-mobile.png')});
    responseMode='lost';await generate();await page.getByRole('button',{name:'Recover saved request',exact:true}).waitFor();
    await page.getByRole('button',{name:'Leave workflow',exact:true}).click();complete();await page.getByRole('button',{name:'Return to Slideshows',exact:true}).click();
    await page.getByRole('button',{name:'Recover saved request',exact:true}).click();await page.getByRole('button',{name:'Generate 2 slides',exact:true}).waitFor();
    assert.equal(submitted.length,3,'Lost response recovery must use GET without generating again');
    assert.equal(await page.getByText('Should Upload B appear on Source slide 1 or 2?',{exact:true}).count(),0,'Accepted request clears stale clarification');
    await page.evaluate(()=>localStorage.setItem('ugc-ai-studio.latest-image-job.v2.owner-a','["studio-history-hint"]'));
    await page.getByRole('button',{name:'New session',exact:true}).click();
    assert.equal(await page.evaluate(()=>localStorage.getItem('ugc-ai-studio.latest-image-job.v2.owner-a.slideshow')),null);
    assert.equal(await page.evaluate(()=>localStorage.getItem('ugc-ai-studio.latest-image-job.v2.owner-a')),'["studio-history-hint"]');
    await page.reload();await page.getByRole('button',{name:'Generated slides',exact:true}).click();await page.getByText('No generated images',{exact:true}).waitFor();
    assert.equal(submitted.length,3,'A new session does not replay the saved generation');
    assert.deepEqual(errors,[]);
    console.log('PASS actual image panel, job/media clients and pending-request client: completed while away, clean-route return, reload, explicit draft choice, owner isolation, persisted clarification, lost acknowledgement GET recovery, scoped New session; no duplicate generation POSTs.');
  } catch(error){console.error(await page.locator('body').innerText(),errors);await page.screenshot({path:path.join(out,'failure.png')});throw error;}
  finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
