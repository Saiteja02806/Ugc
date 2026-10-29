/* eslint-disable @typescript-eslint/no-require-imports -- Isolated local component fixture; never connects to the user's browser. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { webpack } = require('next/dist/compiled/webpack/webpack');
const postcss = require('postcss');
const tailwind = require('@tailwindcss/postcss');
let playwright;
try { playwright = require('playwright'); } catch { playwright = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
const root = path.resolve(__dirname, '..'), out = path.join(root, '.tmp/idle-sidebar-recovery');
fs.mkdirSync(out, { recursive: true });
const write = (file, text) => fs.writeFileSync(path.join(out, file), text);
write('loader.cjs', `const ts=require(${JSON.stringify(require.resolve('typescript'))});module.exports=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText;`);
write('css.cjs', `module.exports=s=>'export default new Proxy({}, {get:(_,key)=>String(key)});';`);
write('boundary.tsx', `export const useAuth=()=>({user:{uid:'fixture-owner',displayName:'Fixture owner'},loading:false});export const useBillingSubscription=()=>({data:{status:'active',planKey:'growth'}});export function Image({src,alt,...props}){return <img src={src} alt={alt} {...props}/>};export default Image;`);
write('link.tsx', `export default function Link({href,onNavigate,onClick,prefetch:_,children,...props}){return <a {...props} href={href} onClick={event=>{onClick?.(event);if(event.defaultPrevented||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||event.button!==0||props.target==='_blank')return;event.preventDefault();let cancelled=false;onNavigate?.({preventDefault(){cancelled=true}});if(!cancelled)window.requested=href;}}>{children}</a>}`);
write('entry.tsx', `import {createRoot} from 'react-dom/client';import {useState} from 'react';import {WorkspaceNavigationFeedback,WorkspaceLink} from '@/components/layout/workspace-navigation-feedback';import {AppSidebar} from '@/components/layout/app-sidebar';
function App(){const[shown,setShown]=useState(true),[collapsed,setCollapsed]=useState(false);window.hideFixture=()=>setShown(false);return shown?<WorkspaceNavigationFeedback><main className="instagram-theme flex min-h-dvh flex-col md:flex-row"><AppSidebar activeKey="explore" defaultCollapsed={collapsed}/><section className="p-8"><h1>Fixture workspace</h1><input aria-label="Unsaved draft" defaultValue="Keep my draft"/><button onClick={()=>setCollapsed(!collapsed)}>Fixture preference</button><WorkspaceLink href="/blocked" onNavigate={event=>event.preventDefault()}>Blocked navigation</WorkspaceLink><WorkspaceLink href="/explore">Current page</WorkspaceLink></section></main></WorkspaceNavigationFeedback>:<p>Closed</p>};createRoot(document.getElementById('root')).render(<App/>);`);

async function main() {
  const aliases = { 'next/link':path.join(out,'link.tsx'), 'next/image':path.join(out,'boundary.tsx'), '@/contexts/auth-context':path.join(out,'boundary.tsx'), '@/components/billing/use-billing-subscription':path.join(out,'boundary.tsx'), '@':root };
  await new Promise((resolve,reject)=>{const compiler=webpack({mode:'development',devtool:false,context:root,entry:path.join(out,'entry.tsx'),output:{path:out,filename:'bundle.js'},resolve:{extensions:['.tsx','.ts','.js'],alias:aliases},module:{rules:[{test:/\.tsx?$/,use:path.join(out,'loader.cjs')},{test:/\.css$/,use:path.join(out,'css.cjs')}]}});compiler.run((error,stats)=>compiler.close(()=>error||stats.hasErrors()?reject(error||Error(stats.toString({all:false,errors:true}))):resolve()));});
  const globals=fs.readFileSync(path.join(root,'app/globals.css'),'utf8').replace('@import "tailwindcss";', '@import "tailwindcss" source(none);');
  const css=(await postcss([tailwind()]).process(globals+`\n@source "${path.join(root,'components/layout').replaceAll(path.sep,'/')}";\n@source "${out.replaceAll(path.sep,'/')}";`, {from:path.join(root,'app/globals.css')})).css;
  let documents=0;
  const server=http.createServer((req,res)=>{const url=new URL(req.url,'http://fixture');if(url.pathname==='/bundle.js'){res.setHeader('Content-Type','text/javascript');return res.end(fs.readFileSync(path.join(out,'bundle.js')));}if(/\.(png|svg|woff2?)$/.test(url.pathname)){res.statusCode=404;return res.end();}documents++;res.setHeader('Content-Type','text/html');res.end(`<!doctype html><html class="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>`);});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let browser;
  try {
    browser=await playwright.chromium.launch({headless:true,channel:'msedge'});
    const base=`http://127.0.0.1:${server.address().port}`;
    const results=[];
    for(const width of [1440,390]) {
      const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage(),errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      await page.clock.install();await page.goto(base+'/explore');
      await page.getByRole('heading',{name:'Fixture workspace'}).waitFor();
      const sidebar=page.locator('#ugc-desktop-sidebar');
      const before=await sidebar.boundingBox();
      await page.screenshot({path:path.join(out,`before-${width}.png`)});
      await page.getByRole('link',{name:'Blocked navigation',exact:true}).click();
      assert.equal(await page.getByRole('status').count(),0);
      await page.getByRole('link',{name:'Current page',exact:true}).click();
      assert.equal(await page.getByRole('status').count(),0);
      if(width<768)await page.getByRole('button',{name:'Open navigation',exact:true}).click();
      await page.getByRole('link',{name:'Trending',exact:true}).filter({visible:true}).click();
      await page.getByRole('status').getByText('Opening page…').waitFor();
      if(width<768)assert.equal(await page.getByRole('dialog').count(),0);
      await page.clock.runFor(15000);
      const recover=page.getByRole('link',{name:'Open page in a new tab'});
      await recover.waitFor();assert.equal(await recover.getAttribute('href'),'/dashboard');
      assert.equal(await recover.getAttribute('target'),'_blank');
      assert.equal(await page.getByLabel('Unsaved draft').inputValue(),'Keep my draft');
      assert.equal(new URL(page.url()).pathname,'/explore');
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      assert.deepEqual(await sidebar.boundingBox(),before);
      await page.screenshot({path:path.join(out,`recovery-${width}.png`)});
      const popupPromise=page.waitForEvent('popup');await recover.click();const popup=await popupPromise;await popup.waitForLoadState();assert.equal(new URL(popup.url()).pathname,'/dashboard');await popup.close();
      assert.equal(await page.getByLabel('Unsaved draft').inputValue(),'Keep my draft');
      await page.getByRole('link',{name:'Current page',exact:true}).click();
      assert.equal(await page.getByRole('status').count(),0,'returning to the current page clears an older pending destination');
      if(width<768)await page.getByRole('button',{name:'Open navigation',exact:true}).click();
      await page.getByRole('link',{name:'Trending',exact:true}).filter({visible:true}).click();
      if(width<768)await page.getByRole('button',{name:'Open navigation',exact:true}).click();
      await page.getByRole('link',{name:'Demo',exact:true}).filter({visible:true}).click();
      await page.clock.runFor(15000);assert.equal(await recover.getAttribute('href'),'/library?tab=posts');
      await page.evaluate(()=>history.pushState(null,'','/library?tab=posts'));await page.clock.runFor(300);
      assert.equal(await page.getByRole('status').count(),0);
      await page.evaluate(()=>history.replaceState(null,'','/explore'));
      if(width<768)await page.getByRole('button',{name:'Open navigation',exact:true}).click();
      await page.getByRole('link',{name:'AI Studio',exact:true}).filter({visible:true}).click();
      await page.evaluate(()=>history.pushState(null,'','/explore?changed=1'));await page.clock.runFor(300);assert.equal(await page.getByRole('status').count(),0);
      if(width>=768){
        await page.getByRole('button',{name:'Collapse sidebar',exact:true}).click();
        await page.getByRole('link',{name:'Audio generation',exact:true}).filter({visible:true}).click();
        await page.clock.runFor(15000);assert.equal(await recover.getAttribute('href'),'/audio-generation');
        await page.screenshot({path:path.join(out,'recovery-collapsed-1440.png')});
        await page.evaluate(()=>history.pushState(null,'','/audio-generation'));await page.clock.runFor(300);assert.equal(await page.getByRole('status').count(),0);
      }
      await page.evaluate(()=>window.hideFixture());await page.clock.runFor(30000);await page.getByText('Closed',{exact:true}).waitFor();
      assert.deepEqual(errors,[]);results.push({width,slowRecovery:true,newerNavigationWins:true,mobileUnmountSurvives:true,draftPreserved:true,queryChangeClears:true,pageErrors:errors});await context.close();
    }
    write('results.json',JSON.stringify({scope:'Isolated actual-component fixture; Next Link transport substituted; production idle failure not reproduced',documents,results},null,2));console.log(JSON.stringify(results));
  } finally {if(browser)await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
