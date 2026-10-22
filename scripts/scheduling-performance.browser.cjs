/* eslint-disable @typescript-eslint/no-require-imports -- Actual scheduling UI with isolated authentication and HTTP. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { webpack } = require("next/dist/compiled/webpack/webpack");
let playwright;
try { playwright = require("playwright"); }
catch { playwright = require(path.join(process.env.USERPROFILE, ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright")); }
const root = path.resolve(__dirname, ".."), out = path.join(root, ".tmp/scheduling-performance-browser");
fs.mkdirSync(out, { recursive: true });
const write = (name, value) => fs.writeFileSync(path.join(out, name), value);
write("loader.cjs", `const ts=require(${JSON.stringify(require.resolve("typescript"))});module.exports=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText;`);
write("css.cjs", `module.exports=()=> 'export default new Proxy({}, {get: (_, name) => name});';`);
write("auth.tsx", `import {createContext,useContext,useState} from 'react';const Auth=createContext(null);export function FixtureAuth({children}){const[uid,setUid]=useState('owner-a');window.currentOwner=uid;window.switchOwner=setUid;return <Auth value={{user:{uid,emailVerified:true,email:'fixture@example.com'}}}>{children}</Auth>};export const useAuth=()=>useContext(Auth);export const getCurrentUserIdToken=async expected=>{if(expected&&expected!==window.currentOwner)throw Error('Owner changed');return window.currentOwner+'-token'};`);
write("timezone.ts", `export const useAccountTimeZone=()=> 'Asia/Calcutta';`);
write("link.tsx", `export default function Link({children,...props}){return <a {...props}>{children}</a>}`);
write("entry.tsx", `import {createRoot} from 'react-dom/client';import {useState} from 'react';import {QueryClient,QueryClientProvider} from '@tanstack/react-query';import {FixtureAuth,useAuth} from './auth';import {SchedulingWorkspace} from '@/components/scheduling/scheduling-workspace';
function Account(){const{user}=useAuth();const[client]=useState(()=>{const c=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:Infinity}}});if(user.uid==='owner-a')c.setQueryData(['account',user.uid,'schedules'],{schedules:[window.seedPost],minimumScheduleLeadMinutes:5});return c});window.client=client;return <QueryClientProvider client={client}><SchedulingWorkspace/></QueryClientProvider>};function App(){const{user}=useAuth();return <Account key={user.uid}/>};window.visibleFixture=true;window.onlineFixture=true;Object.defineProperty(document,'visibilityState',{get:()=>window.visibleFixture?'visible':'hidden',configurable:true});Object.defineProperty(navigator,'onLine',{get:()=>window.onlineFixture,configurable:true});window.calls={};const native=window.fetch;window.fetch=(url,init)=>{const p=new URL(url,location.href).pathname;window.calls[p]=(window.calls[p]||0)+1;return native(url,init)};createRoot(document.getElementById('root')).render(<FixtureAuth><App/></FixtureAuth>);`);
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const at = new Date().toISOString(), due = new Date(Date.now() + 40_000).toISOString();
const post = { id:id(1), title:"Cached schedule", caption:"Keep my schedule visible", cancelledAt:null, createdAt:at, updatedAt:at, idempotencyKey:null, lastErrorCode:null, libraryItemId:id(10), mediaAssetId:null, metadata:{}, projectId:null, publishedAt:null, scheduledFor:due, sourceKind:"library_item", status:"scheduled", timezone:"Asia/Calcutta",
  targets:[{id:id(2),platform:"instagram",socialConnectionId:id(3),status:"scheduled",scheduledFor:due,updatedAt:at,createdAt:at,settings:{},attemptCount:0}] };
const connections = [{id:id(3),platform:"instagram",platformAccountName:"Fixture",platformAccountUsername:"fixture",status:"connected",scopes:["instagram_business_content_publish"],supportsBackgroundRefresh:true}];
let heldSchedules = true, failSchedules = false;
const held = [];
function json(res, value, status = 200) { if(res.destroyed)return;res.writeHead(status,{"Content-Type":"application/json"});res.end(JSON.stringify(value)); }
function schedules(res, owner) { return json(res,{ok:true,schedules:owner==="owner-b"?[]:[{...post,title:"Updated schedule",updatedAt:new Date(Date.parse(post.updatedAt)+1_000).toISOString()}],minimumScheduleLeadMinutes:5}); }
function release() { heldSchedules=false;for(const {res,owner} of held.splice(0))schedules(res,owner); }

async function main() {
  await new Promise((resolve,reject)=>{const compiler=webpack({mode:"development",devtool:false,context:root,plugins:[new webpack.NormalModuleReplacementPlugin(/(?:^|[\\/])firebase[\\/]auth$/,resource=>{resource.request=path.join(out,"auth.tsx")})],entry:path.join(out,"entry.tsx"),output:{path:out,filename:"bundle.js"},resolve:{extensions:[".tsx",".ts",".js"],alias:{"@/contexts/auth-context":path.join(out,"auth.tsx"),"@/lib/firebase/auth":path.join(out,"auth.tsx"),"@/components/providers/account-timezone-provider":path.join(out,"timezone.ts"),"next/link":path.join(out,"link.tsx"),"@":root}},module:{rules:[{test:/\.tsx?$/,use:path.join(out,"loader.cjs")},{test:/\.css$/,use:path.join(out,"css.cjs")}]}});compiler.run((error,stats)=>compiler.close(()=>error||stats.hasErrors()?reject(error||Error(stats.toString({all:false,errors:true}))):resolve()));});
  const server=http.createServer((req,res)=>{
    const url=new URL(req.url,"http://fixture");
    if(url.pathname.endsWith(".js")){res.writeHead(200,{"Content-Type":"text/javascript"});return fs.createReadStream(path.join(out,path.basename(url.pathname))).pipe(res);}
    if(!url.pathname.startsWith("/api/")){res.writeHead(200,{"Content-Type":"text/html; charset=utf-8"});return res.end(`<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font:14px Arial}svg{width:18px;height:18px}button{padding:8px;margin:4px}.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}[hidden]{display:none!important}</style><div id="root"></div><script>window.process={env:{}};window.seedPost=${JSON.stringify(post)}</script><script src="/bundle.js"></script>`);}
    if(req.method!=="GET")return json(res,{ok:false,message:"Mutation prohibited in this fixture"},405);
    const owner=req.headers.authorization==="Bearer owner-b-token"?"owner-b":"owner-a";
    if(url.pathname==="/api/social/connections")return json(res,{ok:true,connections:owner==="owner-b"?[]:connections});
    if(url.pathname==="/api/media")return json(res,{ok:true,assets:[]});
    if(url.pathname==="/api/account/publishing-preferences")return json(res,{ok:true,preferences:{containsSyntheticMedia:false,tiktokBrandOrganic:false}});
    if(url.pathname==="/api/schedules"){
      if(failSchedules)return json(res,{ok:false,message:"Fixture service unavailable"},503);
      if(heldSchedules)return held.push({res,owner});
      return schedules(res,owner);
    }
    return json(res,{ok:false,message:"Unknown fixture endpoint"},404);
  });
  let browser;
  try {
    await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
    browser=await playwright.chromium.launch({channel:"msedge",headless:true});
    for(const mobile of [false,true]) {
      heldSchedules=true;failSchedules=false;
      const page=await browser.newPage({viewport:mobile?{width:390,height:844}:{width:1440,height:1000}}), errors=[];
      page.setDefaultTimeout(10_000);page.on("pageerror",error=>errors.push(error.message));
      await page.clock.install();
      const advance=async ms=>{await page.clock.runFor(ms);await page.clock.resume()};
      await page.goto(`http://127.0.0.1:${server.address().port}/fixture`);
      await page.getByRole("heading",{name:"Content calendar",exact:true}).waitFor();
      await page.getByText(/Cached schedule/).first().waitFor().catch(async error=>{write("failure.txt",`${errors.join("\n")}\n${await page.locator("body").innerText()}`);throw error});
      await page.waitForFunction(()=>window.calls['/api/schedules']===1);
      await page.evaluate(()=>{window.dispatchEvent(new Event('focus'));document.dispatchEvent(new Event('visibilitychange'))});
      await advance(100);
      assert.equal(await page.evaluate(()=>window.calls['/api/schedules']),1,"Entry and focus share the same calendar HTTP read");
      release();await page.getByText(/Updated schedule/).first().waitFor();
      await page.waitForFunction(()=>window.client.getQueryState(['account','owner-a','schedules']).fetchStatus==='idle');
      await page.evaluate(()=>{window.visibleFixture=false;document.dispatchEvent(new Event('visibilitychange'));for(const q of window.client.getQueryCache().findAll({queryKey:['scheduling-workspace','owner-a','media-catalog']}))window.client.setQueryData(q.queryKey,q.state.data,{updatedAt:Date.now()-61_000})});
      const before=await page.evaluate(()=>({...window.calls}));
      await advance(30*60_000);
      assert.deepEqual(await page.evaluate(()=>({...window.calls})),before,"A hidden calendar does no polling during a simulated 30-minute idle");
      await page.evaluate(()=>{window.onlineFixture=false;window.dispatchEvent(new Event('offline'));window.visibleFixture=true;document.dispatchEvent(new Event('visibilitychange'))});
      await advance(100);assert.deepEqual(await page.evaluate(()=>({...window.calls})),before,"An offline resume does not start reads");
      await page.evaluate(()=>{window.onlineFixture=true;window.dispatchEvent(new Event('online'))});
      await page.waitForFunction(n=>window.calls['/api/schedules']===n+1,before['/api/schedules']);
      await page.waitForFunction(n=>window.calls['/api/media']===n+2,before['/api/media']);
      assert.ok(await page.getByText(/Updated schedule/).first().isVisible());
      failSchedules=true;await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
      await page.getByText("Could not refresh schedules.",{exact:true}).waitFor();
      assert.ok(await page.getByText(/Updated schedule/).first().isVisible(),"A failed refresh keeps the loaded schedule");
      failSchedules=false;await page.getByRole("button",{name:"Retry",exact:true}).click();
      await page.getByText("Could not refresh schedules.",{exact:true}).waitFor({state:"detached"});
      await page.evaluate(()=>window.switchOwner('owner-b'));
      await page.waitForFunction(()=>window.client.getQueryState(['account','owner-b','schedules'])?.fetchStatus==='idle');
      assert.equal(await page.getByText(/Updated schedule/).count(),0,"Account switch removes the previous owner's rows");
      assert.deepEqual(errors,[]);await page.close();
      console.log(`Scheduling ${mobile?"mobile":"desktop"}: warm snapshot, deduplication, hidden/offline idle, online resume, stale media, failure/retry, owner isolation passed.`);
    }
  } finally {release();if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error);process.exitCode=1});
