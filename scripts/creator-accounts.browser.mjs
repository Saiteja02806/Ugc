import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { createRequire } from "node:module";
import { mock } from "node:test";
const require = createRequire(import.meta.url);
const { webpack } = require("next/dist/compiled/webpack/webpack");
const root = process.cwd(), out = path.join(root, ".tmp/creator-accounts-browser");
fs.mkdirSync(out, { recursive: true });
const write = (file, contents) => fs.writeFileSync(path.join(out, file), contents);
const owner = { uid: "creator-pilot-fixture", email: "vtu19403@veltech.edu.in", emailVerified: true };
class FirebaseAuthRequestError extends Error { constructor() { super("Sign in"); this.status = 401; } }
const authenticate = async request => {
  const token = request.headers.get("authorization");
  if (token === "Bearer pilot-fixture") return owner;
  if (token === "Bearer other-fixture") return { ...owner, uid: "other-fixture", email: "other@example.com" };
  throw new FirebaseAuthRequestError();
};
mock.module(new URL("../lib/firebase/server-auth.ts", import.meta.url), { namedExports: { FirebaseAuthRequestError, requireFirebaseUser: authenticate } });
mock.module(new URL("../lib/ai-studio/server-access.ts", import.meta.url), { namedExports: { requireAIStudioProUser: authenticate } });
const { GET: catalogue } = await import("../app/api/explore/creator-accounts/route.ts");
const { GET: media } = await import("../app/api/explore/creator-media/[referenceId]/route.ts");
const { GET: slideMedia } = await import("../app/api/explore/creator-slide-media/[referenceId]/[slideId]/route.ts");
const { handleHookStartingFrame } = await import("../lib/explore/hook-source-frame-api.ts");
process.env.ENABLE_HOOK_STARTING_FRAME_PREPARATION = "true";

write("auth.ts", `export const getCurrentUserIdToken=async()=>new URLSearchParams(location.search).has('other')?'other-fixture':'pilot-fixture';export const useAuth=()=>({user:${JSON.stringify(owner)},loading:false});`);
write("image.tsx", "export default function Image({fill,unoptimized,...props}){return <img {...props}/>;}");
write("navigation.ts", "export const useRouter=()=>({push(){}});export const useSearchParams=()=>new URLSearchParams();");
write("dynamic.tsx", "export default ()=>()=>null;");
write("photos.tsx", "export const FormatGenerationReferences=()=> <p>Choose your person photos</p>;");
write("loader.cjs", `const ts=require(${JSON.stringify(require.resolve("typescript"))});module.exports=function(s){return ts.transpileModule(s,{fileName:this.resourcePath,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText};`);
write("css-loader.cjs", `const fs=require('node:fs'),path=require('node:path');module.exports=function(s){const p='ui_'+path.basename(this.resourcePath).replace(/[^a-z]/gi,'_')+'_';const m={};s=s.replace(/\\.([a-zA-Z_][\\w-]*)/g,(_,n)=>{m[n]=p+n;return '.'+p+n}).replace(/:global\\(([^)]+)\\)/g,'$1');fs.appendFileSync(${JSON.stringify(path.join(out, "modules.css"))},s+'\\n');return 'export default '+JSON.stringify(m)};`);
write("entry.tsx", `import{useState}from'react';import{createRoot}from'react-dom/client';import{QueryClient,QueryClientProvider}from'@tanstack/react-query';import{CreatorAccountMenu}from'@/components/explore/creator-account-menu';import{useCreatorAccounts}from'@/components/explore/use-creator-accounts';import{HookStartingFrameWorkspace}from'@/components/explore/hook-starting-frame-workspace';import{ReferenceCard}from'@/components/explore/recreate-workspace';import{SlideshowReferencePicker}from'@/components/explore/slideshow-reference-picker';
function App(){const[reference,setReference]=useState(null);const other=new URLSearchParams(location.search).has('other');const user=other?{...${JSON.stringify(owner)},uid:'other-fixture',email:'other@example.com'}:${JSON.stringify(owner)};const creators=useCreatorAccounts(user,true,reference?.id);return <main className="min-h-screen bg-background p-5 text-foreground"><header className="mb-4 flex flex-wrap items-center justify-between gap-3"><h1>Hook video references</h1><CreatorAccountMenu accounts={creators.accounts} selectedId={creators.selectedId} onSelect={creators.select}/></header>{creators.loading?<p role="status">Loading creator videos…</p>:creators.error?<div role="alert">{creators.error}<button onClick={creators.retry}>Retry creator videos</button></div>:!creators.selectedId?<p>All references</p>:<div className="grid grid-cols-2 gap-3 md:grid-cols-4">{creators.account?.items.map(item=><ReferenceCard key={item.id} reference={item} compact showActionLabel overlayActions isSelected={reference?.id===item.id} onPreview={()=>{}} onRecreate={()=>setReference(item)}/>)}</div>}{reference?<HookStartingFrameWorkspace reference={reference} ownerId={user.uid} draftId="11111111-1111-4111-8111-111111111111" presentation="recreation" onClose={()=>setReference(null)}/>:null}</main>};createRoot(document.getElementById('root')).render(<QueryClientProvider client={new QueryClient()}><App/></QueryClientProvider>);`);
// A separate fixture branch uses the actual slideshow cards and source picker.
const entryPath=path.join(out,"entry.tsx");
let entrySource=fs.readFileSync(entryPath,"utf8");
entrySource=entrySource.replace('<App/></QueryClientProvider>',`{new URLSearchParams(location.search).has('slideshow')?<SlideApp/>:<App/>}</QueryClientProvider>`);
entrySource+=`\nfunction SlideApp(){const[reference,setReference]=useState(null),[ids,setIds]=useState([]),[index,setIndex]=useState(0);const other=new URLSearchParams(location.search).has('other');const user=other?{...${JSON.stringify(owner)},uid:'other-fixture',email:'other@example.com'}:${JSON.stringify(owner)};const creators=useCreatorAccounts(user,true,reference?.id,'slideshow');function choose(item){setReference(item);setIds(item.slides.map(s=>s.id));setIndex(0)}return <main className="min-h-screen bg-background p-5 text-foreground"><header className="mb-4 flex flex-wrap items-center justify-between gap-3"><h1>Slideshows</h1><CreatorAccountMenu accounts={creators.accounts} selectedId={creators.selectedId} onSelect={creators.select}/></header>{reference?<div className="mb-4 max-w-md"><SlideshowReferencePicker reference={reference} slideIndex={index} selectedSlideIds={ids} onPreview={()=>{}} onRemove={()=>setReference(null)} onSelectionChange={(ids,index)=>{setIds(ids);if(index!==undefined)setIndex(index)}} onBusy={()=>{}} onUpload={choose} disabled={false} localPreview={false}/></div>:null}{creators.loading?<p>Loading slides</p>:creators.account?<div className="grid grid-cols-2 gap-3 md:grid-cols-4">{creators.account.items.map(item=><ReferenceCard key={item.id} reference={item} compact showActionLabel isSelected={reference?.id===item.id} onPreview={()=>{}} onRecreate={()=>choose(item)}/>)}</div>:<p>All references</p>}</main>}`;
fs.writeFileSync(entryPath,entrySource);
write("modules.css", "");
const globals = fs.readFileSync("app/globals.css", "utf8").replace('@import "tailwindcss";', '@import "tailwindcss" source(none);') + `\n@source "../components";\n@source "${path.join(out, "entry.tsx").replaceAll("\\", "/")}";`;
write("global.css", (await require("postcss")([require("@tailwindcss/postcss")()]).process(globals, { from: path.join(root, "app/globals.css") })).css);
await new Promise((resolve, reject) => {
  const compiler = webpack({ mode: "development", devtool: false, context: root, entry: path.join(out, "entry.tsx"), output: { path: out, filename: "bundle.js" },
    plugins: [new webpack.NormalModuleReplacementPlugin(/firebase.auth/, path.join(out, "auth.ts")), new webpack.DefinePlugin({ "process.env": JSON.stringify({ NODE_ENV: "development" }) })],
    resolve: { extensions: [".tsx", ".ts", ".js"], alias: {
      "next/image": path.join(out, "image.tsx"), "next/navigation": path.join(out, "navigation.ts"), "next/dynamic": path.join(out, "dynamic.tsx"),
      "@/contexts/auth-context": path.join(out, "auth.ts"), "@/lib/firebase/auth": path.join(out, "auth.ts"),
      "@/components/explore/format-generation-references": path.join(out, "photos.tsx"), "@": root,
    } }, module: { rules: [{ test: /\.tsx?$/, use: path.join(out, "loader.cjs") }, { test: /\.css$/, use: path.join(out, "css-loader.cjs") }] },
  });
  compiler.run((error, result) => compiler.close(() => error || result.hasErrors() ? reject(error || Error(result.toString({ all: false, errors: true }))) : resolve()));
});

const requests = [];
const server = http.createServer(async (incoming, outgoing) => {
  try {
    const url = new URL(incoming.url, "http://127.0.0.1");
    if (url.pathname.startsWith("/api/")) {
      requests.push({ path: url.pathname, method: incoming.method, authorization: incoming.headers.authorization });
      const chunks = []; for await (const chunk of incoming) chunks.push(chunk);
      const request = new Request(url, { method: incoming.method, headers: incoming.headers, ...(chunks.length ? { body: Buffer.concat(chunks) } : {}) });
      let response;
      if (url.pathname === "/api/explore/creator-accounts") response = await catalogue(request);
      else if (url.pathname.startsWith("/api/explore/creator-media/")) response = await media(request, { params: Promise.resolve({ referenceId: url.pathname.split("/").at(-1) }) });
      else if (url.pathname.startsWith("/api/explore/creator-slide-media/")) { const parts=url.pathname.split("/");response=await slideMedia(request,{params:Promise.resolve({referenceId:parts.at(-2),slideId:parts.at(-1)})}); }
      else if (url.pathname === "/api/explore/hook-starting-frame") response = await handleHookStartingFrame(request);
      else if (url.pathname === "/api/explore/hook-keyframe" && url.searchParams.get("cost") === "1") response = Response.json({ ok: true, creditCost: 5, model: url.searchParams.get("model"), maxPersonImages: 5 });
      else if (url.pathname.includes("history")) response = Response.json({ ok: true, images: [], nextCursor: null });
      else response = Response.json({ ok: false }, { status: 404 });
      outgoing.writeHead(response.status, Object.fromEntries(response.headers)); outgoing.end(Buffer.from(await response.arrayBuffer())); return;
    }
    const file = url.pathname.slice(1);
    if (["bundle.js", "modules.css", "global.css"].includes(file)) { outgoing.setHeader("Content-Type", file.endsWith("css") ? "text/css" : "application/javascript"); outgoing.end(fs.readFileSync(path.join(out, file))); return; }
    outgoing.setHeader("Content-Type", "text/html; charset=utf-8");
    outgoing.end('<!doctype html><html class="dark"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/global.css"><link rel="stylesheet" href="/modules.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>');
  } catch (error) { outgoing.writeHead(500); outgoing.end(String(error)); }
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const { chromium } = require(path.join(process.env.USERPROFILE, ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright"));
let browser;
try {
  browser = await chromium.launch({ channel: "msedge", headless: true });
  const receipts = [];
  for (const [width, height] of [[1280,720], [1366,768], [1536,864], [1920,1080], [1280,600], [390,844], [320,568]]) {
    const context = await browser.newContext({ viewport: { width, height } }), page = await context.newPage(), errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.getByRole("button", { name: "Recreate the account" }).click().catch(async error => {
      fs.writeFileSync(path.join(out, "failure.html"), await page.content());
      console.error(JSON.stringify({ errors, requests })); throw error;
    });
    await page.getByText("2 creator accounts", { exact: true }).waitFor();
    if (width === 1280 && height === 720) await page.screenshot({ path: path.join(out, "account-dropdown.png") });
    await page.getByRole("button", { name: /Creator Account 1/ }).click();
    await page.locator('[data-reference-id="creator-account-1-01"]').waitFor();
    assert.equal(await page.locator("article").count(), 6);
    await page.waitForFunction(() => [...document.querySelectorAll('article img')].every(image => image.complete && image.naturalWidth > 0));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: path.join(out, `account-1-${width}.png`) });
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.screenshot({ path: path.join(out, `account-1-${width}-scrolled.png`) });
    await page.evaluate(() => window.scrollTo(0, 0));
    if (width === 1280 && height === 720) {
      await page.getByRole("button", { name: "Recreate the account" }).click();
      await page.keyboard.press("Escape");
      await page.getByText("2 creator accounts", { exact: true }).waitFor({ state: "hidden" });
      await page.getByRole("button", { name: "Recreate the account" }).click();
      await page.getByRole("button", { name: "All references", exact: true }).click();
      await page.locator("main > p").filter({ hasText: "All references" }).waitFor();
      assert.equal(await page.locator("article").count(), 0);
      await page.getByRole("button", { name: "Recreate the account" }).click();
      await page.getByRole("button", { name: /Creator Account 1/ }).click();
      await page.locator('[data-reference-id="creator-account-1-01"]').waitFor();
      await page.waitForFunction(() => [...document.querySelectorAll('article img')].every(image => image.complete && image.naturalWidth > 0));
      await page.locator("article").first().hover();
      await page.waitForFunction(() => [...document.querySelectorAll('article video')].some(video => video.readyState >= 2));
    }
    await page.getByRole("button", { name: "Recreate the account" }).click();
    await page.getByRole("button", { name: /Creator Account 2/ }).click();
    assert.equal(await page.locator('[data-reference-id^="creator-account-1-"]').count(), 0);
    assert.equal(await page.locator('[data-reference-id^="creator-account-2-"]').count(), 6);
    await page.locator('[data-reference-id="creator-account-2-01"]').getByRole("button", { name: "Recreate Hook", exact: true }).click();
    await page.getByText("Choose your person photos", { exact: true }).waitFor();
    assert.equal(await page.getByRole("button", { name: "Generate starting image", exact: true }).isDisabled(), true);
    await page.screenshot({ path: path.join(out, `preparation-${width}.png`) });
    assert.deepEqual(errors, []);
    await context.close(); receipts.push({ width, height, accountsSwitch: true, sixVideosEach: true, sourcePreparation: true, noPhotosNoGeneration: true });
  }
  const context = await browser.newContext(), page = await context.newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}?other=1`);
  await page.getByText("All references", { exact: true }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Recreate the account" }).count(), 0);
  assert.equal(requests.filter(request => request.authorization === "Bearer other-fixture").length, 0);
  assert.equal(requests.filter(request => request.method !== "GET" && request.path !== "/api/explore/hook-starting-frame").length, 0);
  const retryContext = await browser.newContext({ viewport: { width: 1280, height: 720 } }), retryPage = await retryContext.newPage();
  let failOnce = true;
  await retryPage.route("**/api/explore/creator-media/**", async route => {
    if (failOnce) { failOnce = false; await route.fulfill({ status: 503 }); } else await route.continue();
  });
  await retryPage.goto(`http://127.0.0.1:${server.address().port}`);
  await retryPage.getByRole("button", { name: "Recreate the account" }).click();
  await retryPage.getByRole("button", { name: /Creator Account 1/ }).click();
  await retryPage.getByRole("button", { name: "Retry creator videos" }).click();
  await retryPage.locator('[data-reference-id="creator-account-1-01"]').waitFor();
  assert.equal(await retryPage.locator("article").count(), 6);
  await retryContext.close();
  const slideshowReceipts=[];
  for(const viewport of [{width:1280,height:720},{width:390,height:844},{width:320,height:568}]){
    const ctx=await browser.newContext({viewport}),slidesPage=await ctx.newPage();const errors=[];slidesPage.on('pageerror',error=>errors.push(error.message));
    await slidesPage.goto(`http://127.0.0.1:${server.address().port}?slideshow=1`);
    await slidesPage.getByRole('button',{name:'Recreate the account'}).click();
    await slidesPage.getByRole('button',{name:/TikTok Creator Account/}).click();
    await slidesPage.locator('[data-reference-id="creator-slideshow-01"]').waitFor();
    assert.equal(await slidesPage.locator('article').count(),10);
    await slidesPage.waitForFunction(()=>[...document.querySelectorAll('article img')].every(image=>image.complete&&image.naturalWidth>0));
    await slidesPage.screenshot({path:path.join(out,`slideshow-${viewport.width}.png`)});
    for(const number of [1,2,3,4,5,6,7,8,9,10]){
      await slidesPage.locator('[data-reference-id="creator-slideshow-'+String(number).padStart(2,'0')+'"]').getByRole('button',{name:'Recreate Marketing',exact:true}).click();
      const sources=slidesPage.getByRole('button',{name:/Source slide \d+ as generation reference/});
      assert.ok(await sources.count()>=2);
      assert.equal(await sources.first().getAttribute('aria-pressed'),'true');await sources.first().click();assert.equal(await sources.first().getAttribute('aria-pressed'),'false');await sources.first().click();
    }
    assert.equal(await slidesPage.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
    slideshowReceipts.push({...viewport,tenSets:true,allSetRecreateSelections:true,slideSelectionPreserved:true});await ctx.close();
  }
  const otherSlides=await browser.newPage();await otherSlides.goto(`http://127.0.0.1:${server.address().port}?slideshow=1&other=1`);await otherSlides.getByText('All references',{exact:true}).waitFor();assert.equal(await otherSlides.getByRole('button',{name:'Recreate the account'}).count(),0);await otherSlides.close();
  fs.writeFileSync(path.join(out, "receipt.json"), JSON.stringify({ receipts,slideshowReceipts,otherEmailHidden: true, retryAfterReadFailure: true, returnToAllAndReopen: true, hoverPlaybackAfterReopen: true, keyboardEscape: true,
    limitations: "Local fixture: actual account menu, gallery cards, hook, authenticated APIs and preparation component; fixture auth/entitlements/photo picker and surrounding layout. No paid generation, hosted acceptance, zoom or coarse-pointer verification." }, null, 2));
  console.log(JSON.stringify({ cases: receipts.length, otherEmailHidden: true, paidRequests: 0, output: out }));
  await context.close();
} finally { await browser?.close(); server.closeAllConnections(); server.close(); }
