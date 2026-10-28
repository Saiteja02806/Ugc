/* eslint-disable @typescript-eslint/no-require-imports -- Local production-component fixture; no hosted writes. */
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {webpack}=require('next/dist/compiled/webpack/webpack');
const root=path.resolve(__dirname,'..'),out=path.join(root,'.tmp/wall-automatic-text-browser');fs.mkdirSync(out,{recursive:true});
const write=(name,value)=>fs.writeFileSync(path.join(out,name),value);
write('loader.cjs',`const ts=require(${JSON.stringify(require.resolve('typescript'))});module.exports=function(s){return ts.transpileModule(s,{fileName:this.resourcePath,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText};`);
write('auth.ts',`export const getCurrentUserIdToken=async()=> 'local-fixture';`);
write('css.cjs',`module.exports=s=>'export default '+JSON.stringify(Object.fromEntries([...s.matchAll(/\\.([a-zA-Z][a-zA-Z0-9_-]*)/g)].map(m=>[m[1],m[1]])))+';';`);
write('entry.tsx',`import {createRoot} from 'react-dom/client';import {useCallback,useRef,useState} from 'react';
import {FormatVideoTextFields} from '@/components/explore/format-video-text-fields';import {FormatVideoTextOverlay} from '@/components/explore/format-video-text-overlay';
import {useClipDraftSave} from '@/components/explore/use-clip-draft-save';import {readFormatEditDraft,prepareFormatEditForExport} from '@/lib/explore/format-edit-draft';
import {initialWallText,wallTextProfile} from '@/worker/src/lib/wall-initial-text-layout';import release from '@/worker/src/lib/explore-wall-money-reference-release.json';import catalog from '@/lib/explore/reference-text-catalog.json';
import trial03 from '@/outputs/wall-layout-batch-20261028/explore-wall-text-03-trial.json';import trial04 from '@/outputs/wall-layout-batch-20261028/explore-wall-text-04-trial.json';
const i=Number(new URLSearchParams(location.search).get('case')||2),item=i<6?release.items[i]:{id:['explore-wall-text-02','explore-wall-text-05','explore-wall-text-03','explore-wall-text-04','explore-wall-text-14','explore-wall-text-16','explore-wall-text-12','explore-wall-text-15','explore-wall-text-17','explore-wall-text-18','explore-wall-text-19','explore-wall-text-20','explore-wall-text-22','explore-wall-text-23','explore-wall-text-24','explore-wall-text-25','explore-wall-text-26','explore-wall-text-29','explore-wall-text-30','explore-wall-text-31','explore-wall-text-32','explore-wall-text-33','explore-wall-text-34','explore-wall-text-35','explore-wall-text-36','explore-wall-text-38','explore-wall-text-39','explore-wall-text-40','explore-wall-text-41'][i-6]},source=catalog.items.find(s=>s.referenceId===item.id),asset='11111111-1111-4111-8111-111111111111',key='wall-local-'+i;
const initial={version:1,sourceAssetId:asset,backgroundAssetId:null,backgroundPlayback:'once',editing:i===8||i===9?(i===8?trial03:trial04):{version:1,format:'wall_text',trimStartMs:0,trimEndMs:12000,originalVolume:1,musicVolume:.2,text:null,textOverlays:[initialWallText(source.blocks[0].text,wallTextProfile(item.id),12000)]}};
function App(){const restored=useRef(Boolean(localStorage.getItem(key)));const [edit,setEdit]=useState(()=>localStorage.getItem(key)?readFormatEditDraft(JSON.parse(localStorage.getItem(key))):{...initial.editing,textOverlays:[]});
const onRestore=useCallback((draft,explicit)=>{if(!explicit&&restored.current)return;restored.current=true;setEdit(draft.editing)},[]);
const save=useClipDraftSave({owner:'fixture',sourceAssetId:asset,scope:'wall_text',content:{...initial,editing:edit},enabled:true,onRestore});
function change(next){restored.current=true;setEdit(next);localStorage.setItem(key,JSON.stringify(next))}
return <main><h1>Wall text · local editor test</h1><p>Original source words on a neutral canvas; no generated footage.</p><section className='fixture'><div className='portrait'>{edit.textOverlays?.map((text,i)=>text.value.trim()?<FormatVideoTextOverlay key={i} text={text} width={1080} height={1920} label='Wall preview' onChange={next=>change({...edit,textOverlays:edit.textOverlays.map((old,n)=>n===i?next:old)})}/>:null)}</div><section className='settings'><div className='scroller'><FormatVideoTextFields editing={edit} onChange={change}/></div><button disabled={!save.loaded||save.busy} onClick={()=>save.save()}>Save edits</button><button onClick={()=>{window.exported=prepareFormatEditForExport(edit);document.querySelector('#export').textContent=JSON.stringify(window.exported)}}>Inspect export</button><span role='status'>{save.error||(!save.loaded?'Loading':save.saved?'Saved':'Ready')}</span><p>12 seconds retained</p></section></section><pre id='export'/></main>};
window.initial=initial;createRoot(document.getElementById('root')).render(<App/>);`);

async function main(){
 await new Promise((resolve,reject)=>{const c=webpack({mode:'development',devtool:false,context:root,entry:path.join(out,'entry.tsx'),output:{path:out,filename:'bundle.js'},plugins:[new webpack.DefinePlugin({'process.env.NODE_ENV':JSON.stringify('development')})],resolve:{extensions:['.tsx','.ts','.js'],alias:{'@/lib/firebase/auth':path.join(out,'auth.ts'),'@':root}},module:{rules:[{test:/\.tsx?$/,use:path.join(out,'loader.cjs')},{test:/\.css$/,use:path.join(out,'css.cjs')}]}});c.run((e,s)=>c.close(()=>e||s.hasErrors()?reject(e||Error(s.toString({all:false,errors:true}))):resolve()));});
 const postcss=require('postcss');let source=fs.readFileSync(path.join(root,'app/globals.css'),'utf8').replace('@import "tailwindcss";','@import "tailwindcss" source(none);')+'\n@source "../components/explore/format-text-overlays-editor.tsx";\n@source "../components/explore/format-video-text-overlay.tsx";\n@source "../components/ui/button.tsx";';
 let css=(await postcss([require('@tailwindcss/postcss')()]).process(source,{from:path.join(root,'app/globals.css')})).css+fs.readFileSync(path.join(root,'components/explore/explore-text-fonts.css'),'utf8');
 css+=' main{max-width:1100px;margin:auto;padding:20px}h1{font-size:18px}p{font-size:12px;color:#bbb;margin:10px 0}.fixture{display:grid;grid-template-columns:320px minmax(0,1fr);gap:24px}.portrait{position:relative;aspect-ratio:9/16;background:#282a30;overflow:hidden;border-radius:20px}.settings{height:650px;min-width:0}.scroller{height:540px;overflow:auto;padding:6px}button{margin:6px}pre{display:none}@media(max-width:600px){main{padding:12px}.fixture{grid-template-columns:minmax(0,1fr)}.portrait{width:220px;justify-self:center}.settings{height:650px}}';
 const saved=new Map();let writes=0;
 const server=http.createServer(async(req,res)=>{
  if(req.url.startsWith('/api/explore/clip-drafts')){res.setHeader('Content-Type','application/json');
   const caseId=req.headers['x-fixture-case']||'current';
   if(req.method==='POST'){let raw='';for await(const chunk of req)raw+=chunk;const body=JSON.parse(raw);writes++;const draft={id:'22222222-2222-4222-8222-222222222222',scope:'wall_text',revision:(saved.get(caseId)?.revision||0)+1,content:body.content,updatedAt:new Date().toISOString()};saved.set(caseId,draft);return res.end(JSON.stringify({ok:true,draft,requestId:body.requestId,replayed:false}));}
   // Browser supplies the exact production-initializer result via this fixture endpoint.
   return res.end(JSON.stringify({ok:true,draft:saved.get(caseId)||null,initialContent:JSON.parse(decodeURIComponent(req.headers['x-fixture-initial']||'null'))}));
  }
  if(req.url.startsWith('/explore-text-fonts/')&&/^\/explore-text-fonts\/[a-z]+-(400|500|600|700)\.woff2$/.test(req.url)){res.setHeader('Content-Type','font/woff2');return res.end(fs.readFileSync(path.join(root,'public',req.url)));}
  if(req.url==='/bundle.js'){res.setHeader('Content-Type','text/javascript');return res.end(fs.readFileSync(path.join(out,'bundle.js')));}
  res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<html class="dark"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'</style></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>');
 });await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{let pw;try{pw=require('playwright')}catch{pw=require(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'))}
 browser=await pw.chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});const page=await browser.newPage({viewport:{width:1280,height:850}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/explore/clip-drafts*',async route=>{const initial=await page.evaluate(()=>window.initial);await route.continue({headers:{...route.request().headers(),'x-fixture-initial':encodeURIComponent(JSON.stringify(initial))}})});
 const base='http://127.0.0.1:'+server.address().port;
 for(const i of [0,1,2,3,4,5]){saved.clear();await page.goto(base+'/?case='+i);await page.getByRole('status').filter({hasText:'Ready'}).waitFor();await page.locator('svg[aria-label="Wall preview"]').waitFor();await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:path.join(out,'reference-'+(i+1)+'-desktop.png'),fullPage:true});
  const layout=await page.locator('svg[aria-label="Wall preview"] g').first().evaluate(g=>{const b=g.getBBox();return{x:b.x,y:b.y,width:b.width,height:b.height}});assert.ok(layout.x>=0&&layout.x+layout.width<=1080&&layout.y+layout.height<1920);
 }
 for(const [i,color] of [[6,'#f2c8ec'],[7,'#ffffff'],[10,'#ffffff'],[11,'#ffffff'],[12,'#ffffff'],[13,'#ffffff'],[14,'#ffffff'],[15,'#ffffff'],[16,'#ffffff'],[17,'#ffffff'],[18,'#ffffff'],[19,'#ffffff'],[20,'#fff2a3'],[21,'#ffffff'],[22,'#ffffff'],[23,'#fff2a3'],[24,'#ffffff'],[25,'#ffffff'],[26,'#ffffff'],[27,'#ffffff'],[28,'#ffffff'],[29,'#fff2a3'],[30,'#ffffff'],[31,'#ffffff'],[32,'#fff2a3'],[33,'#fff2a3'],[34,'#ffffff']]){
  saved.clear();await page.setViewportSize({width:1280,height:850});await page.goto(base+'/?case='+i);
  await page.getByRole('status').filter({hasText:'Ready'}).waitFor();await page.locator('svg[aria-label="Wall preview"]').waitFor();
  assert.equal(await page.locator('svg[aria-label="Wall preview"] g').first().getAttribute('fill'),color);
  const field=page.getByRole('textbox',{name:'Wall of text',exact:true});await field.fill('My reviewed words\nRemain editable');
  await page.getByRole('slider',{name:'Text width',exact:true}).fill('72');await page.getByRole('button',{name:'Save edits',exact:true}).click();
  await page.getByRole('status').filter({hasText:'Saved'}).waitFor();
  await page.evaluate(()=>{for(const key of Object.keys(localStorage))if(key.startsWith('wall-local-'))localStorage.removeItem(key)});
  await page.reload();await page.getByRole('status').filter({hasText:'Saved'}).waitFor();assert.equal(await field.inputValue(),'My reviewed words\nRemain editable');
  await page.getByRole('button',{name:'Inspect export',exact:true}).click();const savedEdit=await page.evaluate(()=>window.exported);
  assert.equal(savedEdit.trimEndMs,12000);assert.equal(savedEdit.textOverlays[0].endMs,12000);assert.equal(savedEdit.textOverlays[0].width,.72);assert.equal(savedEdit.textOverlays[0].color,color);
  await page.screenshot({path:path.join(out,'batch-'+i+'-desktop.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({path:path.join(out,'batch-'+i+'-mobile.png'),fullPage:true});
 }
 for(const i of [8,9]){
  saved.clear();await page.setViewportSize({width:1280,height:850});await page.goto(base+'/?case='+i);
  await page.getByRole('status').filter({hasText:'Ready'}).waitFor();assert.equal(await page.locator('svg[aria-label="Wall preview"]').count(),i===8?1:2);
  if(i===9){await page.getByRole('textbox',{name:'Wall of text',exact:true}).fill('Edited heading');await page.getByRole('button',{name:'Edit text block 2'}).click();await page.getByRole('textbox',{name:'Wall of text',exact:true}).fill('Edited body\nStill editable');}
  await page.getByRole('button',{name:'Save edits',exact:true}).click();await page.getByRole('status').filter({hasText:'Saved'}).waitFor();
  await page.evaluate(()=>{for(const key of Object.keys(localStorage))if(key.startsWith('wall-local-'))localStorage.removeItem(key)});await page.reload();
  await page.getByRole('status').filter({hasText:'Saved'}).waitFor();await page.getByRole('button',{name:'Inspect export',exact:true}).click();
  const restored=await page.evaluate(()=>window.exported);assert.equal(restored.trimEndMs,12000);assert.equal(restored.textOverlays.length,i===8?1:2);
  assert.ok(restored.textOverlays.every(t=>t.endMs===12000));if(i===9){assert.equal(restored.textOverlays[0].value,'Edited heading');assert.equal(restored.textOverlays[1].value,'Edited body\nStill editable');}await page.screenshot({path:path.join(out,'trial-'+i+'-desktop.png'),fullPage:true});
 }
 saved.clear();await page.goto(base+'/?case=5');await page.getByRole('status').filter({hasText:'Ready'}).waitFor();
 const text=page.getByRole('textbox',{name:'Wall of text',exact:true});await text.fill('My own words\nKeep this layout');await page.getByRole('combobox',{name:'Text font',exact:true}).selectOption('inter');await page.getByRole('slider',{name:'Text width',exact:true}).fill('70');
 await page.getByRole('button',{name:'Save edits',exact:true}).click();await page.getByRole('status').filter({hasText:'Saved'}).waitFor();
 await page.evaluate(()=>{for(const key of Object.keys(localStorage))if(key.startsWith('wall-local-'))localStorage.removeItem(key)});await page.reload();await page.getByRole('status').filter({hasText:'Saved'}).waitFor();assert.equal(await text.inputValue(),'My own words\nKeep this layout');assert.equal(await page.getByRole('combobox',{name:'Text font',exact:true}).inputValue(),'inter');
 await page.getByRole('button',{name:'Inspect export',exact:true}).click();let exported=await page.evaluate(()=>window.exported);assert.equal(exported.trimEndMs,12000);assert.equal(exported.textOverlays[0].value,'My own words\nKeep this layout');assert.equal(exported.textOverlays[0].width,.70);assert.equal(exported.textOverlays[0].endMs,12000);write('saved-export.json',JSON.stringify(exported,null,2));
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:path.join(out,'saved-mobile.png'),fullPage:true});
 await text.fill('');await page.getByRole('button',{name:'Save edits',exact:true}).click();await page.getByRole('status').filter({hasText:'Saved'}).waitFor();await page.reload();assert.equal(await text.inputValue(),'');assert.equal(await page.locator('svg[aria-label="Wall preview"]').count(),0);assert.deepEqual(errors,[]);assert.equal(writes,31);console.log('PASS Wall profiles editable styles and reopen, Wall 03/04 local layered trials reopen, blank removal, full 12s export JSON, mobile bounds; no hosted/provider calls.');
 }finally{await browser?.close();server.close();}
}main().catch(e=>{console.error(e);process.exitCode=1});
