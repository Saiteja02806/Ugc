/* eslint-disable @typescript-eslint/no-require-imports -- Render real account avatars with isolated auth and transport. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { webpack } = require("next/dist/compiled/webpack/webpack");
let playwright;
try { playwright = require("playwright"); }
catch { playwright = require(path.join(process.env.USERPROFILE, ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright")); }
const root = path.resolve(__dirname, ".."), out = path.join(root, ".tmp/social-account-photos-browser");
fs.mkdirSync(out, { recursive: true });
const write = (name, value) => fs.writeFileSync(path.join(out, name), value);
write("loader.cjs", `const ts=require(${JSON.stringify(require.resolve("typescript"))});module.exports=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText;`);
write("auth.tsx", `import {createContext,useContext,useState} from 'react';const Auth=createContext(null);export function FixtureAuth({children}){const[uid,setUid]=useState('owner-a');window.switchOwner=setUid;window.currentOwner=uid;return <Auth value={{user:{uid}}}>{children}</Auth>};export const useAuth=()=>useContext(Auth);export const getCurrentUserIdToken=async owner=>{if(owner!==window.currentOwner)throw Error('Owner changed');return owner};`);
write("entry.tsx", `import {createRoot} from 'react-dom/client';import {useState} from 'react';import {QueryClient,QueryClientProvider} from '@tanstack/react-query';import {FixtureAuth,useAuth} from './auth';
import {SocialAccountAvatar} from '@/components/social/social-account-avatar';import {InstagramAccountAvatar} from '@/components/social/instagram-account-avatar';
const make=(id,platform)=>({id,platform,authorizationRevision:'consent-1',connectedAt:'2026-10-01',platformAccountName:id,profilePictureUrl:id==='tiktok'?'https://p16.tiktokcdn.com/expired.jpg':null});
const accounts=[make('tiktok','tiktok'),make('instagram','instagram'),make('missing','instagram'),make('unavailable','tiktok')];
function Workspace(){const{user}=useAuth();const[client]=useState(()=>new QueryClient());const[shown,setShown]=useState(true);window.toggleWorkspace=setShown;return <QueryClientProvider client={client}><main><h1>Account photo verification</h1>{shown?<>{['Analytics','Settings'].map(section=><section key={section} aria-label={section}><h2>{section}</h2>{accounts.map(account=><div className='account' data-account={account.id} key={account.id}><span>{account.id}</span>{section==='Settings'&&account.platform==='instagram'?<InstagramAccountAvatar connection={account}/>:<SocialAccountAvatar connection={account}/>}</div>)}</section>)}</>:<p>Closed</p>}<p>Signed in as {user.uid}</p></main></QueryClientProvider>}
function App(){const{user}=useAuth();return <Workspace key={user.uid}/>};createRoot(document.getElementById('root')).render(<FixtureAuth><App/></FixtureAuth>);`);
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64");
const calls = new Map();
let hold = true;
const held = [];
function respond(res, id, owner) {
  if (res.destroyed) return;
  if (id === "missing" || owner === "owner-b") { res.writeHead(404); return res.end(); }
  if (id === "unavailable") { res.writeHead(502); return res.end(); }
  res.writeHead(200, { "Content-Type": "image/png", "Cache-Control": "private, no-store" }); res.end(png);
}
async function main() {
  await new Promise((resolve, reject) => {
    const compiler = webpack({mode:"development",devtool:false,context:root,entry:path.join(out,"entry.tsx"),output:{path:out,filename:"bundle.js"},resolve:{extensions:[".tsx",".ts",".js"],alias:{"@/contexts/auth-context":path.join(out,"auth.tsx"),"@/lib/firebase/auth":path.join(out,"auth.tsx"),"@":root}},module:{rules:[{test:/\.tsx?$/,use:path.join(out,"loader.cjs")}]}});
    compiler.run((error,stats)=>compiler.close(()=>error||stats.hasErrors()?reject(error||Error(stats.toString({all:false,errors:true}))):resolve()));
  });
  const server = http.createServer((req, res) => {
    if (req.url === "/bundle.js") { res.writeHead(200, { "Content-Type": "text/javascript" }); return fs.createReadStream(path.join(out,"bundle.js")).pipe(res); }
    const match = req.url.match(/^\/api\/social\/connections\/([a-z]+)\/picture$/);
    if (match) {
      const id = match[1], owner = req.headers.authorization?.replace("Bearer ", "");
      assert.ok(owner === "owner-a" || owner === "owner-b");
      const key = `${owner}:${id}`;
      calls.set(key, (calls.get(key) || 0) + 1);
      if (hold) return held.push({res,id,owner});
      return respond(res,id,owner);
    }
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(`<style>body{font:16px Arial;background:#252525;color:#fff}main{max-width:700px;margin:40px auto}section{display:inline-block;width:280px;padding:20px}.account{display:flex;justify-content:space-between;align-items:center;margin:16px 0}[data-slot=avatar]{display:flex;width:36px;height:36px;border-radius:50%;overflow:hidden;background:#ff704d}[data-slot=avatar-image]{width:100%;height:100%;object-fit:cover}[data-slot=avatar-fallback]{display:flex;align-items:center;justify-content:center;width:100%}svg{width:18px;height:18px}</style><div id="root"></div><script>window.process={env:{}}</script><script src="/bundle.js"></script>`);
  });
  let browser;
  try {
    await new Promise(resolve => server.listen(0,"127.0.0.1",resolve));
    browser = await playwright.chromium.launch({channel:"msedge",headless:true});
    const page = await browser.newPage({viewport:{width:1000,height:650}}), errors = [], external = [];
    page.on("pageerror", e => errors.push(e.message));
    page.on("request", req => { if (!req.url().startsWith("http://127.0.0.1") && !req.url().startsWith("data:")) external.push(req.url()); });
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.getByRole("heading",{name:"Analytics",exact:true}).waitFor();
    await page.waitForFunction(()=>document.querySelectorAll('[data-slot="avatar-fallback"]').length===8);
    assert.equal(await page.locator('[data-slot="avatar-image"]').count(), 0, "account lists render before slow photo requests");
    hold = false;
    for (const item of held.splice(0)) respond(item.res,item.id,item.owner);
    await page.waitForFunction(()=>document.querySelectorAll('[data-slot="avatar-image"]').length===4 && [...document.images].every(img=>img.complete&&img.naturalWidth>0));
    for (const section of ["Analytics","Settings"]) {
      for (const id of ["tiktok","instagram"]) assert.equal(await page.getByRole("region",{name:section}).locator(`[data-account="${id}"] img`).count(),1);
    }
    assert.equal(calls.get("owner-a:tiktok"),1,"duplicate avatars share one owned photo request");
    assert.equal(calls.get("owner-a:instagram"),1);
    assert.equal(await page.locator('[data-slot="avatar-fallback"]').count(),4);
    assert.deepEqual(external,[],"no browser requests to expiring social CDN URLs");
    await page.screenshot({path:path.join(out,"account-photos.png")});
    await page.evaluate(()=>window.toggleWorkspace(false));
    await page.getByText("Closed",{exact:true}).waitFor();
    await page.evaluate(()=>window.toggleWorkspace(true));
    await page.waitForFunction(()=>document.querySelectorAll('[data-slot="avatar-image"]').length===4);
    assert.equal(calls.get("owner-a:unavailable"),1,"failed photos do not loop on remount");
    await page.evaluate(()=>window.switchOwner("owner-b"));
    await page.getByText("Signed in as owner-b",{exact:true}).waitFor();
    await page.waitForFunction(()=>document.querySelectorAll('[data-slot="avatar-fallback"]').length===8);
    assert.equal(await page.locator('[data-slot="avatar-image"]').count(),0,"previous owner photos disappear on account switch");
    assert.deepEqual(errors,[]);
    console.log("PASS: Analytics/Settings avatars, missing and expired sources, shared fetch, safe fallback, remount and owner isolation");
  } finally { await browser?.close(); await new Promise(resolve=>server.close(resolve)); }
}
main().catch(error=>{console.error(error);process.exitCode=1});
