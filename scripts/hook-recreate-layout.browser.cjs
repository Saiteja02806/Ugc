/* eslint-disable @typescript-eslint/no-require-imports -- Actual component with isolated generation/auth/picker boundaries. */
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {webpack}=require('next/dist/compiled/webpack/webpack');
const root=process.cwd(),out=path.join(root,'.tmp/hook-recreate-layout');fs.mkdirSync(out,{recursive:true});
const write=(n,v)=>fs.writeFileSync(path.join(out,n),v); write('card.tsx','export const ReferenceCard=({onRecreate})=><button onClick={onRecreate}>Recreate</button>;'); write('refs.tsx','export function FormatGenerationReferences({imageSelections}){return <div><button type=\"button\">Choose person</button><div style={{display:\"flex\",gap:8}}>{imageSelections.map((item,i)=><figure key={item.asset.id}><img src={item.asset.url} width={88} height={108}/><figcaption>{i?\"Supporting view\":\"Main photo\"}</figcaption></figure>)}</div></div>}');
write('auth.ts',`export const useAuth=()=>({user:{uid:'local-ui-preview'},loading:false});export const getCurrentUserIdToken=async()=>null;`);
write('image.tsx', 'export default function Image({fill,unoptimized,...props}){return <img {...props}/>;}');write('dynamic.tsx','export default ()=>()=>null;');write('navigation.ts','export const useRouter=()=>({push(){}});export const useSearchParams=()=>new URLSearchParams();');write('video.tsx',`export const VideoGenerationStudioPanel=()=> <p>Starting frame selected for the video form.</p>;`);
write('loader.cjs',`const ts=require(${JSON.stringify(require.resolve('typescript'))});module.exports=function(s){return ts.transpileModule(s,{fileName:this.resourcePath,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText};`);
write('css-loader.cjs',`const fs=require('node:fs'),path=require('node:path');module.exports=function(s){const p='ui_'+path.basename(this.resourcePath).replace(/[^a-z]/gi,'_')+'_';const m={};s=s.replace(/\\.([a-zA-Z_][\\w-]*)/g,(_,n)=>{m[n]=p+n;return '.'+p+n}).replace(/:global\\(([^)]+)\\)/g,'$1');fs.appendFileSync(${JSON.stringify(path.join(out,'modules.css'))},s+'\\n');return 'export default '+JSON.stringify(m)};`);
write('entry.tsx',`import{createRoot}from'react-dom/client';import{QueryClient,QueryClientProvider}from'@tanstack/react-query';import{HookKeyframePreview}from'@/app/e2e/hook-keyframe-preview/preview';createRoot(document.getElementById('root')).render(<QueryClientProvider client={new QueryClient()}><HookKeyframePreview preparationFormat={new URLSearchParams(location.search).get("workflow")||"hook"}/></QueryClientProvider>);`);
(async()=>{
write('modules.css','');
const globals=fs.readFileSync('app/globals.css','utf8').replace('@import "tailwindcss";','@import "tailwindcss" source(none);')+'\n@source "../components";\n@source "../app/e2e/hook-keyframe-preview";';
write('global.css',(await require('postcss')([require('@tailwindcss/postcss')()]).process(globals,{from:path.join(root,'app/globals.css')})).css);
await new Promise((resolve,reject)=>{const compiler=webpack({mode:'development',devtool:false,context:root,entry:path.join(out,'entry.tsx'),output:{path:out,filename:'bundle.js'},plugins:[new webpack.NormalModuleReplacementPlugin(/firebase.auth/,path.join(out,'auth.ts')),new webpack.DefinePlugin({'process.env':'('+JSON.stringify({NODE_ENV:'development'})+')'})],resolve:{extensions:['.tsx','.ts','.js'],alias:{'@/components/explore/recreate-workspace':path.join(out,'card.tsx'),'next/image':path.join(out,'image.tsx'),'next/dynamic':path.join(out,'dynamic.tsx'),'next/navigation':path.join(out,'navigation.ts'),'@/components/video/video-generation-workspace':path.join(out,'video.tsx'),'@/contexts/auth-context':path.join(out,'auth.ts'),'@/lib/firebase/auth':path.join(out,'auth.ts'),'@':root}},module:{rules:[{test:/\.tsx?$/,use:path.join(out,'loader.cjs')},{test:/\.css$/,use:path.join(out,'css-loader.cjs')}]}});compiler.run((e,s)=>compiler.close(()=>e||s.hasErrors()?reject(e||Error(s.toString({all:false,errors:true}))):resolve()))});
const scene=path.join(root,'public/ai-studio/creator-references/creator-01.png');
const server=http.createServer((req,res)=>{const u=new URL(req.url,'http://localhost');let file;if(u.pathname==='/e2e/hook-keyframe-preview/scene')file=scene;else if(u.pathname.startsWith('/ai-studio/')||u.pathname.startsWith('/explore/curated-hook-frames/'))file=path.join(root,'public',u.pathname);else if(['/bundle.js','/modules.css','/global.css'].includes(u.pathname))file=path.join(out,u.pathname);if(!file&&u.pathname.endsWith('.js')){const candidate=path.join(out,path.basename(u.pathname));if(fs.existsSync(candidate))file=candidate;}if(file){res.setHeader('Content-Type',file.endsWith('.css')?'text/css':file.endsWith('.js')?'text/javascript':'image/png');return fs.createReadStream(file).pipe(res);}res.setHeader('Content-Type','text/html');res.end('<!doctype html><html class="dark"><link rel="stylesheet" href="/global.css"><link rel="stylesheet" href="/modules.css"><body><div id="root"></div><script src="/bundle.js"></script></body></html>')});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const {chromium}=require(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));let browser;
try {
 browser=await chromium.launch({channel:'msedge',headless:true});
 const receipts=[];
 for(const workflow of ["hook","talking_head","wall_text"]) for(const viewport of [{width:1440,height:900},{width:1280,height:720},{width:390,height:844},{width:320,height:568}]) {
  const context=await browser.newContext({viewport}); const page=await context.newPage(); const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/components_explore_hook-starting-frame-workspace_tsx.bundle.js',async route=>{await new Promise(resolve=>setTimeout(resolve,350));await route.continue();});
  await page.goto('http://127.0.0.1:'+server.address().port+'?workflow='+workflow);
  await page.getByRole('button',{name:'Recreate',exact:true}).click();
  await page.getByText('Opening your starting frame…',{exact:true}).waitFor();
  await page.keyboard.press('Escape');
  await page.waitForFunction(()=>!document.querySelector('[role="dialog"]'));
  await page.getByRole('button',{name:'Recreate',exact:true}).click();
  const result=page.locator('[data-recreation-step="result"]');
  const generate=result.getByRole('button',{name:'Generate starting image',exact:true});
  await generate.waitFor().catch(async error=>{console.error(errors,await page.locator('body').innerText());await page.screenshot({path:path.join(out,'failure.png')});throw error;});
  const use=result.getByRole('button',{name:'Use selected frame',exact:true});
  assert.equal(await use.count(),0);
  assert.equal(await page.locator('[role="dialog"] footer').count(),0);
  if(workflow!=="hook") await page.getByText(workflow==="talking_head"?"After choosing an image, review your own spoken script and Sound setting. Your Demo stays separate.":"Create the background image here. Add and style your editable overlay text in Edit after generating the video.",{exact:true}).waitFor();
  const visible=async(control=use)=>{await control.scrollIntoViewIfNeeded();const b=await control.boundingBox();assert.ok(b&&b.y>=0&&b.y+b.height<=viewport.height+1&&b.x>=0&&b.x+b.width<=viewport.width+1,'Action must be reachable inside viewport');};
  await visible(generate);
  assert.ok(await page.locator('[role="dialog"]').first().evaluate(element=>parseFloat(getComputedStyle(element).borderTopLeftRadius)>=20));
  await page.screenshot({path:path.join(out,`${workflow}-${viewport.width}-initial.png`)});
  await page.getByLabel('Number of starting frame variations').selectOption('4');
  await page.getByRole('button',{name:'Generate 4 starting images',exact:true}).click();
  const third=page.getByRole('button',{name:'Select variation 3',exact:true}); await third.waitFor();
  await page.waitForFunction(()=>document.querySelectorAll('[aria-label^="Select variation"]').length===4);
  await page.waitForTimeout(300); await visible();
  assert.equal(await use.isEnabled(),true);
  await third.click(); await page.getByText('Selected: 3 of 4',{exact:true}).waitFor();
  assert.equal(await third.getAttribute('aria-pressed'),'true'); await visible();
  const scroller=page.locator('[data-recreation-scroll]');
  await scroller.evaluate(el=>{el.scrollTop=el.scrollHeight;}); await visible();
  await page.screenshot({path:path.join(out,`${workflow}-${viewport.width}-results.png`)});
  await page.getByRole('button',{name:'Enlarge variation 3',exact:true}).click();
  await page.getByRole('heading',{name:'Your starting image',exact:true}).waitFor();
  await page.keyboard.press('Escape'); await use.waitFor(); await visible();
  await scroller.evaluate(el=>{el.scrollTop=0;}); await visible();
  const overflow=await page.locator('[role="dialog"]').first().evaluate(el=>el.scrollWidth>el.clientWidth+1);assert.equal(overflow,false);
  await page.screenshot({path:path.join(out,`${workflow}-${viewport.width}-settings.png`)});
  await use.click(); await page.getByText('Starting frame selected for the video form.',{exact:true}).waitFor();
  assert.deepEqual(errors,[]); receipts.push({workflow,viewport,lazyLoadingDismissal:true,actionsInsideResult:true,noSeparateFooter:true,fourVariations:true,selectionThenApproval:true,enlarge:true,horizontalOverflow:false});
  await context.close();
 }
 write('receipt.json',JSON.stringify({receipts,limitations:'Actual preparation component, styles and dialog. Fixture auth, source delivery, owned face-photo assets, image results and final video form; actual photo-picker UI. No paid generation or production acceptance.'},null,2));
  console.log(JSON.stringify(receipts,null,2));
} finally {await browser?.close();server.closeAllConnections();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
