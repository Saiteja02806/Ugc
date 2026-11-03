import { ensureCharacterCatalogCache, readCatalogImage } from './character-catalog-test-cache.mjs';
await ensureCharacterCatalogCache();
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";

// Real workspace, React Query hook, canvas, preparation API/service and generation admission. Auth, stores, queue and provider are controlled; no paid requests.
const require = createRequire(import.meta.url);
let pw;
try { pw = require("playwright"); }
catch { pw = require(path.join(process.env.USERPROFILE, ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright")); }
const root = process.cwd();
const out = path.join(root, ".tmp/character-workflow/browser");
mkdirSync(out, { recursive: true });
const write = (name, value) => { writeFileSync(path.join(out, name), value); return path.join(out, name); };
const baselineOnly=process.env.CHARACTER_WORKFLOW_BASELINE==='1';

const aliases = {
 '@/contexts/auth-context':write('auth-context.ts', `export const useAuth=()=>({user:{uid:'character-fixture'},loading:false});`),
 '@/lib/firebase/auth':write('auth.ts', `export async function getCurrentUserIdToken(){if(window.failAuth)throw new TypeError('Failed to fetch');return 'fixture-token';}`),
 'next/link':write('link.tsx', `export default function Link({children,...props}){return <a {...props}>{children}</a>}`),
 'next/image':write('image.tsx', `export default function Image({fill,unoptimized,sizes,...props}){return <img {...props}/>}`),
};
if(baselineOnly)aliases['@/components/characters/character-workspace']=write('baseline-workspace.tsx',execFileSync('git',['show','b09e721f56d295304da91b362ec9c0f4133bf1ff:components/characters/character-workspace.tsx'],{encoding:'utf8'}).replaceAll('from "./','from "@/components/characters/'));
write('entry.tsx', `import {createRoot} from 'react-dom/client';import {QueryClient,QueryClientProvider} from '@tanstack/react-query';import {CharacterWorkspace} from '@/components/characters/character-workspace';const client=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});createRoot(document.getElementById('root')).render(<QueryClientProvider client={client}><CharacterWorkspace/></QueryClientProvider>);`);
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


process.env.GCP_STORAGE_BUCKET='workflow-fixture';process.env.GCP_STORAGE_PUBLIC_BASE_URL='https://storage.googleapis.com/workflow-fixture';
const {createStudioPreparer,encodeStudioImage,StudioPreparationError}=await import('../lib/characters/studio-preparation.ts');
const {createStudioPreparationHandler}=await import('../lib/characters/studio-preparation-api.ts');
const {createCharacterGenerationHandlers}=await import('../lib/characters/generation-api.ts');
const {characterAccessFromCredits}=await import('../lib/characters/access-policy.ts');
const {createCharacterIdentityService,serializeCharacterHistoryImage}=await import('../lib/characters/identity-service.ts');
const {findTraitById}=await import('../lib/characters/influencer-registry.ts');
const owner='character-fixture',rows=new Map(),objects=new Map(),jobs=new Map();let uploads=0,reservations=0,failBuild=false,statusOutage=false;const admissions=[];
const assetUrl=key=>'https://storage.googleapis.com/workflow-fixture/'+key;
const prepDeps={
 async get({userId,assetId}){const r=rows.get(assetId);return r?.user_id===userId?r:null},
 async fetchImage(p){if(failBuild&&p.includes('natural-casual'))throw new StudioPreparationError('build_natural','loading catalog image');return readCatalogImage(p)},encode:encodeStudioImage,url:assetUrl,
 async upload({key,buffer}){uploads++;if(objects.has(key))throw Error('412');objects.set(key,buffer);return{key,url:assetUrl(key)}},async readObject(key){if(!objects.has(key))throw Error('404');return objects.get(key)},
 async save(p){const row={id:p.assetId,user_id:p.userId,source_record_id:p.sourceRecordId,source_type:p.sourceType,status:'ready',deleted_at:null,collection:p.collection,project_id:p.projectId,storage_key:p.storageKey,url:p.url,mime_type:p.mimeType,file_size_bytes:p.fileSizeBytes,width:p.width,height:p.height,metadata:p.metadata,created_at:new Date().toISOString()};rows.set(row.id,row);return row}
};
const access=()=>characterAccessFromCredits(true,100-reservations,1),auth=async()=>({uid:owner,emailVerified:true});
let prep=createStudioPreparer(prepDeps);
const prepare=createStudioPreparationHandler({authenticate:auth,access:async()=>access(),prepare:(u,ids)=>prep(u,ids)});
const identity=createCharacterIdentityService({
 async getJob(id,u){return [...jobs.values()].find(j=>j.id===id&&j.userId===u)??null},
 async getCandidateAsset(id,u){return [...rows.values()].find(a=>a.source_record_id===id&&a.user_id===u)??null},
 async getAsset(id,u){const r=rows.get(id);return r?.user_id===u?r:null},
 async promoteCandidate({asset,marker,name}){Object.assign(asset,{collection:'influencer',title:name,metadata:{...asset.metadata,characterIdentity:marker}});return true},
 async listSelectedAssets(u){return [...rows.values()].filter(a=>a.user_id===u&&a.collection==='influencer')},
 async getJobs(ids,u){return [...jobs.values()].filter(j=>j.userId===u&&ids.includes(j.id))},
});
const generation={
 async getExistingJob(key,u){const j=jobs.get(key);return j?.userId===u?j:null},async requireAccess(){return{count:1,useFreeAllowance:false}},getReference:async()=>null,getReferenceAsset:(id,u)=>prepDeps.get({assetId:id,userId:u}),
 async reserveBatch({inputs,userId,batchId}){reservations++;return inputs.map((input,i)=>{const key='character:'+batchId+':'+(i+1);const job={id:crypto.randomUUID(),userId,jobType:'generate_image',status:'queued',input,output:null,idempotencyKey:key,queueName:'ai-generation',attemptCount:0,maxAttempts:3,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};jobs.set(key,job);return job})},
 async dispatch(job){setTimeout(()=>{const id=crypto.randomUUID(),key='results/'+id+'.jpg';const bytes=readCatalogImage('/explore/influencer-studio/characters/3.png');objects.set(key,bytes);rows.set(id,{id,user_id:owner,status:'ready',deleted_at:null,collection:'image',source_type:'generated_image',source_record_id:job.id,storage_key:key,url:assetUrl(key),width:1254,height:1254,ratio:'1:1',mime_type:'image/png',metadata:{},title:'Fixture influencer',created_at:new Date().toISOString()});job.status='completed';job.output={mediaAssetId:id,url:assetUrl(key),key,generationId:job.input.generationId,model:job.input.model};},500);return job},getImageCreditCost:()=>1,
};
const handlers=createCharacterGenerationHandlers({authenticate:auth,getAccess:async()=>access(),generation,getJob:async id=>[...jobs.values()].find(j=>j.id===id),getAsset:(id,u)=>prepDeps.get({assetId:id,userId:u}),deliverUsage:async()=>{},requireRuntime(){}});
const server = createServer(async(req,res)=>{
 const pathname=new URL(req.url,'http://fixture').pathname;
 if(pathname==='/'){res.setHeader('Content-Type','text/html');res.end(html);return;}

 if(pathname.startsWith('/api/')){
  const chunks=[];for await(const chunk of req)chunks.push(chunk);const body=Buffer.concat(chunks).toString();
  const request=new Request('https://vidmake.io'+req.url,{method:req.method,headers:{'Content-Type':'application/json'},...(req.method==='POST'?{body}: {})});
  let response;
  try{
   if(pathname==='/api/characters/studio-references')response=await prepare(request);
   else if(pathname==='/api/characters/generate'){admissions.push(JSON.parse(body));response=await handlers.generate(request)}
   else if(pathname==='/api/characters/status'){if(statusOutage){statusOutage=false;response=Response.json({ok:false,error:'Transient status failure'},{status:503})}else response=await handlers.status(request)}
   else if(pathname==='/api/characters/access')response=await handlers.access(request);
   else if(pathname==='/api/characters/preferences')response=Response.json({ok:true,preference:{seen:true,gender:null}});
   else if(pathname==='/api/characters/select')response=Response.json({ok:true,character:await identity.select({...JSON.parse(body),userId:owner})});
   else if(pathname==='/api/characters')response=Response.json({ok:true,characters:await identity.list(owner)});
   else if(pathname==='/api/characters/history')response=Response.json({ok:true,nextCursor:null,images:[...jobs.values()].filter(j=>j.status==='completed').flatMap(j=>{const a=[...rows.values()].find(a=>a.source_record_id===j.id);const h=serializeCharacterHistoryImage(j,a,owner);return h?[h]:[]})});
   else if(pathname.endsWith('/download'))response=Response.json({ok:true,fileName:'fixture.png',url:'https://storage.googleapis.com/workflow-fixture/download.png?response-content-disposition='+encodeURIComponent('attachment; filename="fixture.png"')});
   else response=Response.json({ok:false},{status:404});
  }catch(e){console.error(e);response=Response.json({ok:false,error:e.message},{status:500})}
  res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return;
 }
 const file=pathname.startsWith('/explore/')?path.join(root,'public',pathname):path.resolve(out,`.${pathname}`);
 if((!file.startsWith(out+path.sep)&&!file.startsWith(path.join(root,'public')+path.sep))||!existsSync(file)){res.writeHead(404);res.end();return;}

 res.setHeader('Content-Type',file.endsWith('.png')?'image/png':file.endsWith('.css')?'text/css':'text/javascript');res.end(readFileSync(file));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
 browser=await pw.chromium.launch({headless:true,channel:'msedge'});
 const page=await browser.newPage(),pageErrors=[];page.on('pageerror',e=>pageErrors.push(e.message));



 await page.route('https://storage.googleapis.com/workflow-fixture/**',async route=>{
  const u=new URL(route.request().url());if(u.pathname.endsWith('download.png')){await route.fulfill({body:readCatalogImage('/explore/influencer-studio/characters/3.png'),headers:{'Content-Type':'image/png','Content-Disposition':'attachment; filename="fixture.png"'}});return}
  const bytes=objects.get(u.pathname.replace('/workflow-fixture/',''));await route.fulfill({status:bytes?200:404,body:bytes??'',contentType:'image/png'})
 });
 const browserReads=[];page.on('request',r=>{if(r.resourceType()==='fetch')browserReads.push(new URL(r.url()).pathname)});
 async function choose(){await page.goto(origin);await page.getByTitle('Extreme',{exact:true}).waitFor();await page.getByTitle('Extreme',{exact:true}).click();await page.getByTitle('Bedroom',{exact:true}).click();await page.getByTitle('Vibrant Open',{exact:true}).click();await page.getByTitle('Natural / Casual',{exact:true}).click();await page.getByRole('radio',{name:'Half',exact:true}).click()}
 for(const viewport of [{width:1440,height:1000},{width:390,height:844}]){await page.setViewportSize(viewport);await choose();await page.mouse.move(0,0);await page.waitForFunction(()=>Array.from(document.images).every(i=>i.complete));await page.screenshot({path:path.join(root,`.tmp/character-workflow/${baselineOnly?'baseline':'current'}-${viewport.width}.png`),animations:'disabled'})}
 if(!baselineOnly){
 failBuild=true;await page.getByRole('button',{name:'Generate',exact:true}).click();await page.getByText(/Could not prepare Natural \/ Casual/).waitFor();assert.equal(reservations,0);const readyAfterFailure=rows.size;assert(readyAfterFailure>0);await page.screenshot({path:path.join(root,'.tmp/character-workflow/error.png')});
 failBuild=false;await choose();prep=createStudioPreparer(prepDeps);statusOutage=true;await page.getByRole('button',{name:'Generate',exact:true}).click();await page.getByRole('button',{name:'Save to My Influencers',exact:true}).waitFor({timeout:20000});
 assert.equal(reservations,1);assert.equal(rows.size,9);assert.equal(uploads,8);assert.equal(admissions.length,1);assert.equal(admissions[0].referenceImageAssetIds.length,8);assert.match(admissions[0].prompt,/head through the waist/);assert.equal(admissions[0].model,'gemini_3_pro');
 assert.equal(browserReads.some(p=>p.startsWith('/explore/influencer-studio/')),false);assert.equal(browserReads.includes('/api/media/create-upload-url'),false);
 await page.getByRole('button',{name:'Save to My Influencers',exact:true}).click();await page.getByRole('button',{name:'Saved to Influencers',exact:true}).waitFor();
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Download AI Influencer',exact:true}).click();assert.equal((await download).suggestedFilename(),'fixture.png');
 for(const viewport of [{width:1440,height:1000},{width:390,height:844}]){await page.setViewportSize(viewport);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:path.join(root,`.tmp/character-workflow/result-${viewport.width}.png`)})}
 await page.reload();await page.getByRole('button',{name:'History',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:/9:16 portrait.*Saved/}).click();await page.getByRole('button',{name:'Saved to Influencers',exact:true}).waitFor();assert.equal(reservations,1);assert.equal(uploads,8);
 assert.deepEqual(pageErrors,[]);
 const record={preparationFaultRecovered:true,readyAfterFailure,uploads,reservations,statusReadRecovered:true,model:admissions[0].model,referenceCount:8,saved:true,downloaded:true,historyAfterReload:true,browserCatalogFetches:0,pageErrors:0,viewports:[1440,390],mode:'controlled auth/storage/queue/provider; real preparation, generation admission, builder, identity service and UI'};console.log(JSON.stringify(record));writeFileSync(path.join(root,'.tmp/character-workflow/result.json'),JSON.stringify(record,null,2));
 }
}finally{await browser?.close();await new Promise(r=>server.close(r));}
