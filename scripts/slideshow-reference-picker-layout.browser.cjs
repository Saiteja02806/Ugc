/* eslint-disable @typescript-eslint/no-require-imports -- Isolated real-component regression. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const postcss = require('postcss');
const tailwind = require('@tailwindcss/postcss');
const { webpack } = require('next/dist/compiled/webpack/webpack');
let playwright;
try { playwright = require('playwright'); }
catch { playwright = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
const root = path.resolve(__dirname, '..'), out = path.join(root, '.tmp/slideshow-reference-picker-layout');
fs.mkdirSync(out, { recursive: true });
const file = (name, content) => fs.writeFileSync(path.join(out, name), content);
file('loader.cjs', `const ts=require(${JSON.stringify(require.resolve('typescript'))});module.exports=source=>ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText;`);
file('css.cjs', `module.exports=function(source){const prefix=this.resourcePath.replace(/[^a-zA-Z]/g,'')+'_';const names=Object.fromEntries([...source.matchAll(/\\.([a-zA-Z][a-zA-Z0-9_-]*)/g)].map(m=>[m[1],prefix+m[1]]));const css=source.replaceAll(/:global\\(([^)]+)\\)/g,'$1').replaceAll(/\\.([a-zA-Z][a-zA-Z0-9_-]*)/g,(_,name)=>'.'+names[name]);return 'const style=document.createElement("style");style.textContent='+JSON.stringify(css)+';document.head.append(style);export default '+JSON.stringify(names)+';';};`);
file('services.ts', `export const useAuth=()=>({user:null});export const readAIStudioReferenceMetadata=async()=>({width:720,height:1280});export const uploadAIStudioReferenceMedia=async()=>{throw Error('Unexpected live upload');};`);
file('entry.tsx', `import {createRoot} from 'react-dom/client';import {useState} from 'react';import {SlideshowReferencePicker} from '@/components/explore/slideshow-reference-picker';import styles from '@/components/explore/format-workspace.module.css';
const fitness={id:'fitness',format:'slideshow',title:'Fitness',posterUrl:'/slide.webp',slides:[1,2,3,4,5,6].map(n=>({id:'slide-'+n,url:'/slide.webp',width:720,height:1280}))};
function App(){const [reference,setReference]=useState(null),[ids,setIds]=useState(['slide-1']),[index,setIndex]=useState(0),[previews,setPreviews]=useState(0);return <main style={{maxWidth:960,margin:'auto',padding:12}}><h1>Slideshows</h1><div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:16}}><button onClick={()=>{setReference(fitness);setIds(['slide-1']);}}>Choose Fitness reference</button><button onClick={()=>setReference({...fitness,title:'A very long selected slideshow title that must stay readable without pushing Upload slides outside the settings panel'})}>Choose long title</button></div><aside style={{width:'min(100%,408px)',border:'1px solid var(--border)',borderRadius:16,background:'var(--card)'}}><nav style={{display:'flex',justifyContent:'space-around',padding:16,borderBottom:'1px solid var(--border)'}}><span>Create</span><span>Edit slides</span><span>Schedule</span></nav><div className={styles.workflowContent} style={{padding:16}}><SlideshowReferencePicker reference={reference} slideIndex={index} selectedSlideIds={ids} disabled={false} localPreview onPreview={()=>setPreviews(v=>v+1)} onRemove={()=>setReference(null)} onUpload={value=>{setReference(value);setIds([value.slides[0].id]);setIndex(0);}} onSelectionChange={(value,next)=>{setIds(value);if(next!==undefined)setIndex(next);}} onBusy={()=>{}}/><label style={{display:'grid',gap:8}}>Your instructions<textarea aria-label="Your instructions" placeholder="What would you like to change?" style={{width:'100%',minHeight:160,border:'1px solid var(--border)',borderRadius:10,padding:12}}/></label></div></aside><p role="status">Preview opened {previews} times</p></main>};createRoot(document.getElementById('root')).render(<App/>);`);
async function main() {
  await new Promise((resolve,reject)=>{const compiler=webpack({mode:'development',devtool:false,entry:path.join(out,'entry.tsx'),output:{path:out,filename:'bundle.js'},resolve:{extensions:['.tsx','.ts','.js'],alias:{'@/contexts/auth-context':path.join(out,'services.ts'),'@/lib/ai-studio/reference-media-upload':path.join(out,'services.ts'),'@':root}},module:{rules:[{test:/\.tsx?$/,use:path.join(out,'loader.cjs')},{test:/\.css$/,use:path.join(out,'css.cjs')}]}});compiler.run((error,stats)=>compiler.close(()=>error||stats.hasErrors()?reject(error||Error(stats.toString({all:false,errors:true}))):resolve()));});
  const css=(await postcss([tailwind()]).process(`@import "${path.join(root,'app/globals.css').replaceAll(path.sep,'/')}";`,{from:path.join(out,'fixture.css')})).css;
  const server=http.createServer((req,res)=>{if(req.url==='/bundle.js'){res.setHeader('Content-Type','text/javascript');return res.end(fs.readFileSync(path.join(out,'bundle.js')));}if(req.url==='/slide.webp'){res.setHeader('Content-Type','image/webp');return res.end(fs.readFileSync(path.join(root,'public/try-ugcpilot/posters/card-22.webp')));}res.setHeader('Content-Type','text/html');res.end('<html class="dark"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'body{font-family:Arial,sans-serif}</style></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>');});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  if(process.env.SLIDESHOW_PICKER_SERVE==='1'){console.log('Local slideshow reference preview: http://127.0.0.1:'+server.address().port);return;}
  let browser;
  try {
    browser=await playwright.chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});const page=await browser.newPage(),errors=[],measurements=[];
    page.on('pageerror',error=>errors.push(error.message));
    for(const viewport of [{width:1280,height:720},{width:1440,height:900},{width:1900,height:806},{width:1024,height:700},{width:897,height:977},{width:390,height:844},{width:320,height:700}]){
      await page.setViewportSize(viewport);await page.goto('http://127.0.0.1:'+server.address().port);
      // Next can emit the containing workspace CSS after component CSS. The
      // screenshot's failure depends on that ordering, so exercise it here.
      await page.evaluate(()=>{for(const style of [...document.head.querySelectorAll('style')])if(style.textContent.includes('workflowContent')&&style.textContent.includes('data-workflow-tile'))document.head.append(style);});
      const upload=page.getByRole('button',{name:'Upload slides',exact:true});await upload.waitFor();
      await page.getByRole('button',{name:'Choose Fitness reference',exact:true}).click();
      const preview=page.getByRole('button',{name:'Preview selected slideshow',exact:true});
      const card=await preview.boundingBox();assert.ok(card.width<=64.5&&Math.abs(card.width-card.height)<1,'The selected reference uses a compact square preview');
      assert.equal(await preview.locator('img').evaluate(image=>getComputedStyle(image).objectFit),'contain','The reference image is shown in full inside its square');
      const remove=await page.getByRole('button',{name:'Remove slideshow reference',exact:true}).boundingBox();assert.ok(remove.x>=card.x&&remove.x+remove.width<=card.x+card.width&&remove.y>=card.y,'Remove belongs to the selected reference card');
      const size=await upload.evaluate(button=>{const panel=button.closest('[aria-label="Slideshow references"]'),row=button.parentElement,r=button.getBoundingClientRect(),p=panel.getBoundingClientRect();return{width:r.width,height:r.height,right:r.right,panelRight:p.right,rowOverflow:row.scrollWidth>row.clientWidth,panelOverflow:panel.scrollWidth>panel.clientWidth+2};});
      await page.screenshot({path:path.join(out,`selected-${viewport.width}.png`),fullPage:true});measurements.push({viewport,size});
      assert.ok(size.height<=48,'Selected-reference upload action stays compact: '+JSON.stringify({viewport,size}));
      assert.ok(size.right<=size.panelRight+1&&!size.rowOverflow&&!size.panelOverflow,'Selected reference, title and upload fit inside panel: '+JSON.stringify({viewport,size}));
      await page.getByRole('button',{name:'Preview selected slideshow',exact:true}).click();await page.getByRole('status').filter({hasText:'Preview opened 1 times'}).waitFor();
      assert.equal(await page.getByRole('button',{name:'Use all',exact:true}).count(),0);
      assert.equal(await page.getByRole('button',{name:'Choose images',exact:true}).count(),0);
      assert.equal(await page.getByText(/Creating slide|will guide the result|Pick one result/).count(),0);
      const slideTwo=page.getByRole('button',{name:'Slide 2 as generation reference',exact:true});
      await slideTwo.focus();await page.keyboard.press('Space');await page.getByText('2 selected',{exact:true}).waitFor();
      assert.equal(await slideTwo.getAttribute('aria-pressed'),'true');
      await slideTwo.click();await page.getByText('1 selected',{exact:true}).waitFor();
      const thumbnail=await slideTwo.boundingBox();assert.ok(thumbnail.height<=64.5&&thumbnail.width>=44,'Reference thumbnails stay compact and usable');
      await page.getByRole('button',{name:'Choose long title',exact:true}).click();
      assert.equal(await page.getByRole('region',{name:'Slideshow references',exact:true}).evaluate(panel=>panel.scrollWidth>panel.clientWidth+2),false,'Long titles fit without pushing the upload action');
      await page.getByLabel('Your instructions',{exact:true}).fill('Keep my instructions');
      await page.getByRole('button',{name:'Remove slideshow reference',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Preview selected slideshow',exact:true}).count(),0);assert.equal(await page.getByRole('group',{name:'Select reference slides',exact:true}).count(),0);assert.equal(await page.getByLabel('Your instructions',{exact:true}).inputValue(),'Keep my instructions');
      const chooser=page.waitForEvent('filechooser');await upload.click();await (await chooser).setFiles([path.join(root,'public/try-ugcpilot/posters/card-22.webp'),path.join(root,'public/try-ugcpilot/posters/card-21.webp')]);
      await page.getByText('Your uploaded slideshow',{exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Preview selected slideshow',exact:true}).count(),1);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    }
    assert.deepEqual(errors,[]);file('measurements.json',JSON.stringify(measurements,null,2));console.log('PASS selected slideshow reference: compact contained upload action, long titles, preview/removal, slide selection and local uploads at 320–1900px.');
  } finally {await browser?.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
