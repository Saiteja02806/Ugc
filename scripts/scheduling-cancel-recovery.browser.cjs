/* eslint-disable @typescript-eslint/no-require-imports -- Actual scheduling UI with isolated authentication and HTTP. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { webpack } = require("next/dist/compiled/webpack/webpack");
let playwright;
try { playwright = require("playwright"); }
catch { playwright = require(path.join(process.env.USERPROFILE, ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright")); }
const root = path.resolve(__dirname, ".."), out = path.join(root, ".tmp/scheduling-cancel-recovery");
fs.mkdirSync(out, { recursive: true });
const write = (name, value) => fs.writeFileSync(path.join(out, name), value);
write("loader.cjs", `const ts=require(${JSON.stringify(require.resolve("typescript"))});module.exports=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText;`);
write("css.cjs", `module.exports=()=> 'export default new Proxy({}, {get: (_, name) => name});';`);
write("auth.tsx", `import {createContext,useContext} from 'react';const Auth=createContext(null);export function FixtureAuth({children}){return <Auth value={{user:{uid:'owner-a',emailVerified:true,email:'fixture@example.com'}}}>{children}</Auth>};export const useAuth=()=>useContext(Auth);export const getCurrentUserIdToken=async expected=>{if(expected&&expected!=='owner-a')throw Error('Owner changed');return 'owner-a-token'};`);
write("timezone.ts", `export const useAccountTimeZone=()=> 'Asia/Calcutta';`);
write("link.tsx", `export default function Link({children,...props}){return <a {...props}>{children}</a>}`);
write("entry.tsx", `import {createRoot} from 'react-dom/client';import {useState} from 'react';import {QueryClient,QueryClientProvider} from '@tanstack/react-query';import {FixtureAuth,useAuth} from './auth';import {SchedulingWorkspace} from '@/components/scheduling/scheduling-workspace';
function Account(){const{user}=useAuth();const[client]=useState(()=>{const c=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:Infinity}}});c.setQueryData(['account',user.uid,'schedules'],{schedules:[window.seedPost],minimumScheduleLeadMinutes:5});return c});window.client=client;return <QueryClientProvider client={client}><SchedulingWorkspace/></QueryClientProvider>};function App(){const{user}=useAuth();return <Account key={user.uid}/>};window.calls={};const native=window.fetch;window.fetch=(url,init)=>{const p=new URL(url,location.href).pathname;window.calls[p]=(window.calls[p]||0)+1;window.lastMethod=p.startsWith('/api/schedules/')?init?.method||'GET':undefined;return native(url,init)};createRoot(document.getElementById('root')).render(<FixtureAuth><App/></FixtureAuth>);`);
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const at = new Date().toISOString(), due = new Date(Date.now() - 60_000).toISOString();
const basePost = { id:id(1), title:"Cancel fixture", caption:"Cancel this post", cancelledAt:null, createdAt:at, updatedAt:at, idempotencyKey:null, lastErrorCode:null, libraryItemId:id(10), mediaAssetId:null, metadata:{plannedScheduledFor:due}, projectId:null, publishedAt:null, scheduledFor:due, sourceKind:"library_item", status:"scheduled", timezone:"Asia/Calcutta",
  targets:[{id:id(2),platform:"instagram",socialConnectionId:id(3),status:"scheduled",scheduledFor:due,updatedAt:at,createdAt:at,settings:{},attemptCount:0}] };
const connections = [{id:id(3),platform:"instagram",platformAccountName:"Fixture",platformAccountUsername:"fixture",status:"connected",scopes:["instagram_business_content_publish"],supportsBackgroundRefresh:true}];
let mode = "conflict", post = structuredClone(basePost);
const requestedPaths = [];
function json(res, value, status = 200) { if(res.destroyed)return;res.writeHead(status,{"Content-Type":"application/json"});res.end(JSON.stringify(value)); }
function schedules(res) { return json(res,{ok:true,schedules:[post],minimumScheduleLeadMinutes:5}); }

async function main() {
  await new Promise((resolve,reject)=>{const compiler=webpack({mode:"development",devtool:false,context:root,plugins:[new webpack.NormalModuleReplacementPlugin(/(?:^|[\\/])firebase[\\/]auth$/,resource=>{resource.request=path.join(out,"auth.tsx")})],entry:path.join(out,"entry.tsx"),output:{path:out,filename:"bundle.js"},resolve:{extensions:[".tsx",".ts",".js"],alias:{"@/contexts/auth-context":path.join(out,"auth.tsx"),"@/lib/firebase/auth":path.join(out,"auth.tsx"),"@/components/providers/account-timezone-provider":path.join(out,"timezone.ts"),"next/link":path.join(out,"link.tsx"),"@":root}},module:{rules:[{test:/\.tsx?$/,use:path.join(out,"loader.cjs")},{test:/\.css$/,use:path.join(out,"css.cjs")}]}});compiler.run((error,stats)=>compiler.close(()=>error||stats.hasErrors()?reject(error||Error(stats.toString({all:false,errors:true}))):resolve()));});
  const server=http.createServer((req,res)=>{
    const url=new URL(req.url,"http://fixture");
    if(url.pathname.endsWith(".js")){res.writeHead(200,{"Content-Type":"text/javascript"});return fs.createReadStream(path.join(out,path.basename(url.pathname))).pipe(res);}
    if(!url.pathname.startsWith("/api/")){res.writeHead(200,{"Content-Type":"text/html; charset=utf-8"});return res.end(`<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font:14px Arial}svg{width:18px;height:18px}button{padding:8px;margin:4px}.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}[hidden]{display:none!important}</style><div id="root"></div><script>window.process={env:{}};window.seedPost=${JSON.stringify(basePost)}</script><script src="/bundle.js"></script>`);}
    requestedPaths.push(`${req.method} ${url.pathname}`);
    if(req.method==="DELETE"&&url.pathname===`/api/schedules/${basePost.id}`){
      if(mode==="conflict"){
        post={...post,status:"publishing",updatedAt:new Date().toISOString(),targets:post.targets.map(target=>({...target,status:"publishing",updatedAt:new Date().toISOString()}))};
        return json(res,{ok:false,code:"schedule_publish_started",message:"Publishing has already started, so this post can no longer be cancelled."},409);
      }
      post={...post,status:"cancelled",cancelledAt:new Date().toISOString(),updatedAt:new Date().toISOString(),targets:post.targets.map(target=>({...target,status:"cancelled",cancelledAt:new Date().toISOString(),updatedAt:new Date().toISOString()}))};
      return json(res,{ok:true,schedule:post});
    }
    if(req.method!=="GET")return json(res,{ok:false,message:"Mutation prohibited in this fixture"},405);
    if(url.pathname==="/api/social/connections")return json(res,{ok:true,connections});
    if(url.pathname==="/api/media")return json(res,{ok:true,assets:[]});
    if(url.pathname==="/api/account/publishing-preferences")return json(res,{ok:true,preferences:{containsSyntheticMedia:false,tiktokBrandOrganic:false}});
    if(url.pathname==="/api/schedules")return schedules(res);
    return json(res,{ok:false,message:"Unknown fixture endpoint"},404);
  });
  let browser;
  try {
    await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
    browser=await playwright.chromium.launch({channel:"msedge",headless:true});
    const page=await browser.newPage({viewport:{width:1366,height:900}}), errors=[];
    page.setDefaultTimeout(15_000);page.on("pageerror",error=>errors.push(error.message));
    const open=async()=>{
      post=structuredClone(basePost);
      await page.goto(`http://127.0.0.1:${server.address().port}/fixture?view=list&tab=upcoming`);
      await page.getByRole("heading",{name:"Content calendar",exact:true}).waitFor();
      await page.getByText("Cancel fixture").first().waitFor();
      await page.getByRole("button",{name:"Cancel",exact:true}).click();
      await page.getByRole("alertdialog").waitFor();
    };

    mode="conflict";
    await open();
    await page.getByText("This scheduled time has passed. If publishing has already started, this post can no longer be cancelled.",{exact:true}).waitFor();
    const schedulesBefore=await page.evaluate(()=>window.calls['/api/schedules']||0);
    await page.getByRole("button",{name:"Cancel schedule",exact:true}).click();
    await page.getByRole("alertdialog").getByRole("alert").getByText("Publishing has already started, so this post can no longer be cancelled.",{exact:true}).waitFor();
    assert.ok(await page.getByRole("alertdialog").isVisible(),"A refused cancel keeps the dialog open with the reason where the user acted");
    await page.waitForFunction(n=>(window.calls['/api/schedules']||0)>n,schedulesBefore);
    await page.getByRole("button",{name:"Keep schedule",exact:true}).click();
    await page.getByRole("alertdialog").waitFor({state:"detached"});
    await page.getByText("Publishing",{exact:true}).first().waitFor();
    assert.equal(await page.getByRole("button",{name:"Cancel",exact:true}).count(),0,"A publishing post no longer offers Cancel");
    assert.ok(requestedPaths.some(entry=>entry===`DELETE /api/schedules/${basePost.id}`),"The card cancels through the existing owner-authenticated DELETE route");

    mode="success";
    await open();
    await page.getByRole("button",{name:"Cancel schedule",exact:true}).click();
    await page.getByRole("alertdialog").waitFor({state:"detached"});
    await page.getByText("Schedule cancelled. No future platform publish will run.",{exact:true}).waitFor();
    assert.equal(await page.getByRole("button",{name:"Cancel",exact:true}).count(),0,"A cancelled post no longer offers Cancel");
    assert.deepEqual(errors,[]);
    await page.close();
    console.log("PASS cancel conflict keeps the dialog and reason, refreshes to the true status, success closes and confirms, no duplicate Cancel controls");
  } finally {
    if(browser)await browser.close();
    await new Promise(resolve=>server.close(resolve));
  }
}
main().catch(error=>{console.error(error);process.exitCode=1});
