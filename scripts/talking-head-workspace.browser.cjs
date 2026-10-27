/* eslint-disable @typescript-eslint/no-require-imports -- Full workflow UI with local files; generation disabled. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { webpack } = require('next/dist/compiled/webpack/webpack');
let playwright;
try { playwright = require('playwright'); } catch { playwright = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
const root = path.resolve(__dirname, '..'), out = path.join(root, '.tmp/talking-head-full-workspace');
fs.mkdirSync(out, { recursive: true });
const write = (name, content) => fs.writeFileSync(path.join(out, name), content);
write('loader.cjs', `const ts=require(${JSON.stringify(require.resolve('typescript'))});module.exports=function(source){return ts.transpileModule(source,{fileName:this.resourcePath,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText;};`);
write('css.cjs', String.raw`module.exports=function(source){if(!this.resourcePath.endsWith('.module.css'))return 'const style=document.createElement("style");style.textContent='+JSON.stringify(source)+';document.head.append(style);export default {};';const names={},prefix=require('node:path').basename(this.resourcePath).replace(/[^a-zA-Z]/g,'')+'_';source=source.replace(/:global\(([^)]+)\)/g,(_,value)=>'GLOBALSTART'+Buffer.from(value).toString('hex')+'GLOBALEND');source=source.replace(/\.([a-zA-Z][a-zA-Z0-9_-]*)/g,(_,name)=>{names[name]=prefix+name;return '.'+prefix+name;});source=source.replace(/GLOBALSTART([a-f0-9]+)GLOBALEND/g,(_,value)=>Buffer.from(value,'hex').toString());return 'const style=document.createElement("style");style.textContent='+JSON.stringify(source)+';document.head.append(style);export default '+JSON.stringify(names)+';';};`);
write('auth.ts', `export const useAuth=()=>({user:null,loading:false});export const getCurrentUserIdToken=async()=>null;export const useAIStudioAccess=()=> 'pro';export const useBillingSubscription=()=>({isSuccess:true,isFetching:false,isError:false,data:{isActive:true,planKey:'starter'}});`);
write('next.tsx', `export const useSearchParams=()=>new URLSearchParams(location.search);export const useRouter=()=>({push:url=>location.assign(url)});export default function Element({src,alt,href,priority,fill,unoptimized,prefetch,children,...props}){return src?<img src={src} alt={alt} {...props}/>:<a href={href} {...props}>{children}</a>;}`);
write('entry.tsx', `import {useState} from 'react';import {WorkflowVideoAssetPicker} from '@/components/explore/workflow-video-asset-picker';import {createRoot} from 'react-dom/client';import {QueryClient,QueryClientProvider} from '@tanstack/react-query';import {HookWorkflowPreview} from '@/components/explore/hook-workflow-preview';import {WorkflowNavigationProvider} from '@/components/layout/workflow-navigation';import catalog from '@/lib/explore/talking-head-reference-catalog.json';const client=new QueryClient({defaultOptions:{queries:{retry:false}}});client.setQueryData(['talking-head-references',null],catalog.items.map(item=>({...item,format:'hook',slides:[]})));function History(){const [open,setOpen]=useState(true);return <WorkflowVideoAssetPicker open={open} onOpenChange={setOpen} ownerId={null} library='generation_history' onSelect={()=>true}/>;}createRoot(document.getElementById('root')).render(<QueryClientProvider client={client}><WorkflowNavigationProvider enabled>{new URLSearchParams(location.search).has('history')?<History/>:<HookWorkflowPreview initialModel='seedance_2_5' generationEnabled={false} demoFramingEnabled/>}</WorkflowNavigationProvider></QueryClientProvider>);`);

async function main(){
  const aliases={ '../firebase/auth':path.join(out,'auth.ts'), '@/lib/firebase/auth':path.join(out,'auth.ts'), '@/contexts/auth-context':path.join(out,'auth.ts'), '@/components/generation/use-ai-studio-access':path.join(out,'auth.ts'), '@/components/billing/use-billing-subscription':path.join(out,'auth.ts'), 'next/link':path.join(out,'next.tsx'), 'next/image':path.join(out,'next.tsx'), 'next/navigation':path.join(out,'next.tsx'), '@':root };
  await new Promise((resolve,reject)=>{const compiler=webpack({mode:'development',devtool:false,context:root,entry:path.join(out,'entry.tsx'),output:{path:out,filename:'bundle.js'},plugins:[new webpack.DefinePlugin({'process.env.NEXT_PUBLIC_ENABLE_OPENROUTER_SEEDANCE':JSON.stringify('true'),'process.env.NEXT_PUBLIC_ENABLE_OPENROUTER_WAN':JSON.stringify('true')})],resolve:{extensions:['.tsx','.ts','.js'],alias:aliases},module:{rules:[{test:/\.tsx?$/,use:path.join(out,'loader.cjs')},{test:/\.css$/,use:path.join(out,'css.cjs')}]}});compiler.run((error,stats)=>compiler.close(()=>error||stats.hasErrors()?reject(error||Error(stats.toString({all:false,errors:true}))):resolve()));});
  console.log('Complete HookWorkflowPreview component compiled.');
  const css=(await require('postcss')([require('@tailwindcss/postcss')({base:root})]).process(fs.readFileSync(path.join(root,'app/globals.css'),'utf8').replace('@import "tailwindcss";','@import "tailwindcss" source(none);\n@source "../components/explore";\n@source "../components/ui";\n@source "../components/layout";'),{from:path.join(root,'app/globals.css')})).css;
  const apiRequests=[];
  const server=http.createServer((req,res)=>{
    const url=new URL(req.url,'http://fixture');
    if(url.pathname==='/bundle.js'){res.setHeader('Content-Type','text/javascript');return res.end(fs.readFileSync(path.join(out,'bundle.js')));}
    if(url.pathname.startsWith('/api/')){apiRequests.push({path:url.pathname,method:req.method});res.writeHead(500);return res.end('No live requests in layout preview');}
    const local=path.resolve(root,'public','.'+url.pathname);
    if(local.startsWith(path.join(root,'public')+path.sep)&&fs.existsSync(local)&&fs.statSync(local).isFile()){
      const bytes=fs.readFileSync(local),ext=path.extname(local);res.setHeader('Content-Type',({'.mp4':'video/mp4','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2'})[ext]??'application/octet-stream');
      const range=req.headers.range?.match(/bytes=(\d+)-(\d*)/);
      if(range){const start=Number(range[1]),end=range[2]?Math.min(Number(range[2]),bytes.length-1):bytes.length-1;res.writeHead(206,{'Accept-Ranges':'bytes','Content-Range':`bytes ${start}-${end}/${bytes.length}`,'Content-Length':end-start+1});return res.end(bytes.subarray(start,end+1));}
      return res.end(bytes);
    }
    res.setHeader('Content-Type','text/html');res.end('<html class="dark"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'body{margin:0}</style><div id="root"></div><script>window.process={env:{NODE_ENV:"development"}};</script><script src="/bundle.js"></script></html>');
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  if(process.argv.includes('--serve-only')){console.log('FULL_WORKFLOW_PREVIEW http://127.0.0.1:'+server.address().port);return;}
  let browser,page;
  const results=[];
  try{
    browser=await playwright.chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});page=await browser.newPage({locale:"en-GB"});const errors=[];page.on('pageerror',error=>{errors.push(error.message);console.error(error.stack);});page.on('dialog',dialog=>dialog.accept());
    for(const viewport of [{width:1366,height:768},{width:1536,height:864},{width:390,height:844},{width:320,height:740}]){
      await page.setViewportSize(viewport);await page.goto('http://127.0.0.1:'+server.address().port);
      const nav=page.getByRole('navigation',{name:'Creation views',exact:true});await nav.getByRole('button',{name:'References',exact:true}).waitFor();
      const checkTikTok = async (svg, label) => {
        const geometry=await svg.evaluate(element=>{const path=element.querySelector('path'),bounds=path.getBBox(),view=element.viewBox.baseVal,rect=element.getBoundingClientRect();return{path:{x:bounds.x,y:bounds.y,right:bounds.x+bounds.width,bottom:bounds.y+bounds.height},view:{x:view.x,y:view.y,right:view.x+view.width,bottom:view.y+view.height},width:rect.width,height:rect.height};});
        assert.ok(geometry.path.x>=geometry.view.x&&geometry.path.y>=geometry.view.y&&geometry.path.right<=geometry.view.right&&geometry.path.bottom<=geometry.view.bottom,label+' contains the entire TikTok mark: '+JSON.stringify(geometry));
        assert.ok(geometry.width>=14&&geometry.height>=14,label+' retains its icon size');
        return geometry;
      };
      assert.equal(await nav.getByRole('button',{name:'Your videos',exact:true}).isVisible(),true);
      assert.equal(await page.getByRole('heading',{name:'Talking head video',exact:true}).evaluate(el=>el.classList.contains('sr-only')),true);

      for(const name of ['Create','Demo','Schedule'])assert.equal(await page.getByRole('tab',{name,exact:true}).isVisible(),true);
      await page.getByRole('button',{name:'Use as reference',exact:true}).first().waitFor();
      const referenceIcon=await checkTikTok(page.locator('[data-reference-source-overlay] svg').first(),'Reference source');
      const gallery=page.getByRole('region',{name:'Talking-head references',exact:true});
      assert.equal(await gallery.locator('h2,h3').count(),0,'Reference cards have no repeated headings');
      assert.equal(await gallery.locator('p').count(),0,'Reference cards have no visible explanatory copy');
      await page.getByRole('button',{name:'Preview only',exact:true}).first().click();await page.getByRole('dialog').waitFor();await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});
      const card=await page.locator('[data-reference-id]').first().evaluate(el=>{const r=el.querySelector('video').parentElement.getBoundingClientRect();return{width:r.width,height:r.height};});
      if(viewport.width>=1024)assert.ok(card.width<270&&card.height<480,'References use Hook-sized cards: '+JSON.stringify(card));
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      await page.screenshot({path:path.join(out,'references-'+viewport.width+'.png')});
      await nav.getByRole('button',{name:'Your videos',exact:true}).click();
      const overview=page.getByRole('region',{name:'Video editing workspace',exact:true});await overview.waitFor();
      assert.equal(await page.getByRole('button',{name:'Choose hook video source',exact:true}).isVisible(),true);
      assert.equal(await page.getByRole('button',{name:'Choose demo video source',exact:true}).isVisible(),true);
      await page.screenshot({path:path.join(out,'your-videos-empty-'+viewport.width+'.png')});
      const upload=async(label,file)=>{await overview.getByRole('button',{name:'Choose '+label+' source',exact:true}).click();const event=page.waitForEvent('filechooser');await page.getByRole('button',{name:'Upload '+label,exact:true}).click();await(await event).setFiles(file);};
      await upload('hook video',path.join(root,'public/explore/talking-head-references/v1/talking-car-story.mp4'));
      await overview.getByRole('button',{name:'Edit hook video',exact:true}).waitFor();
      await upload('demo video',path.join(root,'public/marketing/showcase-part2/demo-preview.mp4'));
      await overview.getByRole('button',{name:'Edit demo video',exact:true}).waitFor();
      await page.waitForFunction(()=>[...document.querySelectorAll('[data-workflow-sequence] video')].every(video=>video.readyState>=2));
      await page.screenshot({path:path.join(out,'your-videos-selected-'+viewport.width+'.png')});
      await page.getByRole('tab',{name:'Demo',exact:true}).click();
      const settings=page.getByRole('region',{name:'Workflow section settings',exact:true});
      await settings.getByRole('region',{name:'Demo upload',exact:true}).waitFor();
      assert.equal(await settings.getByRole('button',{name:'Change demo video',exact:true}).isEnabled(),true);
      assert.equal(await settings.getByRole('button',{name:'Select demo audio',exact:true}).isEnabled(),true);
      await settings.getByRole('button',{name:'Change demo video',exact:true}).click();
      assert.equal(await page.getByRole('button',{name:'Choose demo video from Saved demos',exact:true}).isVisible(),true);
      assert.equal(await page.getByRole('button',{name:'Choose demo video from Creative Assets',exact:true}).count(),0);
      await page.keyboard.press('Escape');await page.getByRole('button',{name:'Choose demo video from Saved demos',exact:true}).waitFor({state:'hidden'});
      const volume=settings.getByLabel('Demo original volume',{exact:true});await volume.fill('35');
      await page.waitForFunction(()=>[...document.querySelectorAll('[data-workflow-sequence] video')].some(video=>Math.abs(video.volume-.35)<.001));
      assert.equal(await volume.inputValue(),'35');
      await page.screenshot({path:path.join(out,'demo-controls-'+viewport.width+'.png')});
      await overview.getByRole('button',{name:'Edit demo video',exact:true}).click();
      await page.getByRole('heading',{name:'Demo video · Live preview',exact:true}).waitFor();
      await page.getByLabel('Overlay text',{exact:true}).fill('Demo text check');await page.getByLabel('Text overlay 1 preview',{exact:true}).waitFor();
      assert.equal(await page.locator('[data-clip-media] video').evaluate(video=>video.volume),.35,'Demo editor shares the sidebar volume draft');
      await page.getByRole('button',{name:'Back to videos overview',exact:true}).click();
      assert.equal(await overview.getByRole('button',{name:'Edit hook video',exact:true}).isVisible(),true);
      await page.getByRole('tab',{name:'Schedule',exact:true}).click();
      const tiktok=page.getByRole('button',{name:'TikTok',exact:true});await tiktok.waitFor();
      const scheduleIcon=await checkTikTok(tiktok.locator('svg').first(),'Schedule platform');
      await tiktok.click();assert.equal(await tiktok.getAttribute('aria-pressed'),'true');
      await checkTikTok(tiktok.locator('svg').first(),'Selected Schedule platform');
      await page.getByRole('button',{name:'Choose publish time, currently not selected',exact:true}).click();
      assert.equal(await page.getByLabel('Hour',{exact:true}).locator('option').count(),24);
      assert.equal(await page.getByLabel('Minute',{exact:true}).locator('option').count(),60);
      for(const time of ['00:00','09:30','21:30','23:59']) {
        await page.getByLabel('Hour',{exact:true}).selectOption(time.slice(0,2));
        await page.getByLabel('Minute',{exact:true}).selectOption(time.slice(3));
        assert.equal(await page.locator('input[name="postTime"]').inputValue(),time);
      }
      await page.getByLabel('Minute',{exact:true}).focus(); await page.keyboard.press('ArrowUp');
      assert.equal(await page.locator('input[name="postTime"]').inputValue(),'23:58');
      await page.keyboard.press('Escape');
      await page.getByRole('button',{name:'Choose publish time, currently 23:58',exact:true}).click();
      await page.getByLabel('Minute',{exact:true}).selectOption('59');
      await page.screenshot({path:path.join(out,'time-picker-'+viewport.width+'.png')});
      await page.getByRole('button',{name:'Done',exact:true}).click();
      assert.equal(await page.getByRole('button',{name:'Choose publish time, currently 23:59',exact:true}).isVisible(),true);
      await page.screenshot({path:path.join(out,'schedule-tiktok-'+viewport.width+'.png')});
      await page.getByRole('tab',{name:'Create',exact:true}).click();await nav.getByRole('button',{name:'Your videos',exact:true}).click();
      assert.equal(await overview.getByRole('button',{name:'Edit demo video',exact:true}).isVisible(),true);
      await page.screenshot({path:path.join(out,'create-overview-after-demo-'+viewport.width+'.png')});
      await page.getByRole('tab',{name:'Schedule',exact:true}).click();
      assert.equal(await page.locator('input[name="postTime"]').inputValue(),'23:59','Tab roundtrip preserves wall-clock time');
      results.push({viewport,referenceCard:card,tabs:true,sharedOverview:true,demoUpload:true,demoChange:true,demoText:true,demoVolume:true,referenceIcon,scheduleIcon});
    }
    await page.goto('http://127.0.0.1:'+server.address().port+'/?history=1');
    await page.getByRole('heading',{name:'Generation history',exact:true}).waitFor();
    await page.getByText('Sign in to choose from Generation history.',{exact:true}).waitFor();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.screenshot({path:path.join(out,'generation-history-320.png')});
    await page.keyboard.press('Escape'); await page.getByRole('dialog').waitFor({state:'hidden'});
    assert.deepEqual(errors,[]);assert.deepEqual(apiRequests,[]);write('results.json',JSON.stringify(results,null,2));console.log('PASS actual full workflow: References/Your videos, Create/Demo/Schedule, compact cards, local hook/demo upload, Saved demos Change, demo text editing and shared overview continuity. No API writes.');
  }catch(error){if(page){await page.screenshot({path:path.join(out,'failure.png')});write('failure.txt',await page.locator('body').innerText());}throw error;}
  finally{await browser?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
