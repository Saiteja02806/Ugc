/* eslint-disable @typescript-eslint/no-require-imports -- Actual caption UI with isolated account HTTP fixtures. */
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), http = require("node:http");
const { webpack } = require("next/dist/compiled/webpack/webpack");
const root = process.cwd(), out = path.join(root, ".tmp/saved-captions-browser");
fs.mkdirSync(out, { recursive: true });
const write = (name, source) => fs.writeFileSync(path.join(out, name), source);
write("auth.ts", `export async function getCurrentUserIdToken(owner){return owner;}`);
write("loader.cjs", `const ts=require(${JSON.stringify(require.resolve("typescript"))});module.exports=function(s){return ts.transpileModule(s,{fileName:this.resourcePath,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText};`);
write("css.cjs", `const fs=require('node:fs'),path=require('node:path');module.exports=function(s){const p='ui_'+path.basename(this.resourcePath).replace(/[^a-z]/gi,'_')+'_';const m={};s=s.replace(/\\.([a-zA-Z_][\\w-]*)/g,(_,n)=>{m[n]=p+n;return '.'+p+n}).replace(/:global\\(([^)]+)\\)/g,'$1');fs.appendFileSync(${JSON.stringify(path.join(out,"modules.css"))},s+'\\n');return 'export default '+JSON.stringify(m)};`);
write("entry.tsx", `import{useState}from'react';import{createRoot}from'react-dom/client';import{QueryClient,QueryClientProvider}from'@tanstack/react-query';import{PostCaptionField}from'@/components/scheduling/post-caption-field';
function App(){const[post,setPost]=useState(1),[owner,setOwner]=useState('owner-a'),[workflow,setWorkflow]=useState(false),[draft,setDraft]=useState({caption:'',captionInitialized:false});return <main style={{maxWidth:900,margin:'auto',padding:16}}><h1 style={{fontSize:22,fontWeight:600,marginBottom:20}}>Saved post captions · local preview</h1><nav style={{display:'flex',gap:12,flexWrap:'wrap',marginBottom:24}}><button onClick={()=>{setPost(post+1);setDraft({caption:'',captionInitialized:false})}}>New post</button><button onClick={()=>{setPost(post+1);setDraft({caption:'My existing draft',captionInitialized:true})}}>Existing draft</button><button onClick={()=>{setWorkflow(!workflow);setPost(post+1);setDraft({caption:'',captionInitialized:false})}}>Switch workflow</button><button onClick={()=>{setOwner(owner==='owner-a'?'owner-b':'owner-a');setPost(post+1);setDraft({caption:'',captionInitialized:false})}}>Switch account</button></nav><h2 style={{marginBottom:12}}>{workflow?'Explore workflow':'Trending'} · {owner}</h2><div style={{background:'var(--card)',border:'1px solid var(--border)',padding:20,borderRadius:16}}><PostCaptionField key={owner+post} ownerId={owner} value={draft.caption} initialized={draft.captionInitialized} onChange={caption=>setDraft({caption,captionInitialized:true})}/></div><pre data-post-caption style={{display:'none'}}>{draft.caption}</pre></main>};createRoot(document.getElementById('root')).render(<QueryClientProvider client={new QueryClient()}><App/></QueryClientProvider>);`);
(async () => {
  write("modules.css", "");
  const globals = fs.readFileSync(path.join(root,"app/globals.css"),"utf8").replace('@import "tailwindcss";', '@import "tailwindcss" source(none);');
  write("global.css",(await require("postcss")([require("@tailwindcss/postcss")()]).process(globals,{from:path.join(root,"app/globals.css")})).css);
  await new Promise((resolve,reject) => {
    const compiler = webpack({ mode:"development",devtool:false,context:root,entry:path.join(out,"entry.tsx"),output:{path:out,filename:"bundle.js"},plugins:[new webpack.NormalModuleReplacementPlugin(/firebase\/auth$/,path.join(out,"auth.ts"))],resolve:{extensions:[".tsx",".ts",".js"],alias:{"@/lib/firebase/auth":path.join(out,"auth.ts"),"@":root}},module:{rules:[{test:/\.tsx?$/,use:path.join(out,"loader.cjs")},{test:/\.css$/,use:path.join(out,"css.cjs")}]}});
    compiler.run((error,stats)=>compiler.close(()=>error||stats.hasErrors()?reject(error||Error(stats.toString({all:false,errors:true}))):resolve()));
  });
  const rows = new Map(), requests=[]; let failNext=false, loseNext=false;
  const server = http.createServer(async (req,res) => {
    if(req.url==="/api/account/saved-captions"){
      const owner=req.headers.authorization?.replace("Bearer ",""); requests.push({owner,method:req.method});
      res.setHeader("Content-Type","application/json");
      if(!owner){res.statusCode=401;return res.end(JSON.stringify({ok:false}));}
      const current=rows.get(owner)||{revision:0,captions:[],defaultId:null};
      if(req.method==="GET")return res.end(JSON.stringify({ok:true,library:current}));
      const chunks=[];for await(const chunk of req)chunks.push(chunk);const input=JSON.parse(Buffer.concat(chunks));
      if(failNext){failNext=false;res.statusCode=503;return res.end(JSON.stringify({ok:false,message:"Saved captions unavailable. Your post caption is kept."}));}
      if(current.revision!==input.revision){res.statusCode=409;return res.end(JSON.stringify({ok:false,message:"Saved captions changed in another tab. Review and try again."}));}
      const next={...input,revision:input.revision+1};rows.set(owner,next);
      if(loseNext){loseNext=false;res.statusCode=503;return res.end(JSON.stringify({ok:false,message:"Could not confirm the save. Review saved captions."}));}
      return res.end(JSON.stringify({ok:true,library:next}));
    }
    const file=["/bundle.js","/global.css","/modules.css"].includes(req.url)?path.join(out,req.url):null;
    if(file){res.setHeader("Content-Type",file.endsWith(".js")?"text/javascript":"text/css");return fs.createReadStream(file).pipe(res);}
    res.setHeader("Content-Type","text/html");res.end('<!doctype html><html class="dark"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/global.css"><link rel="stylesheet" href="/modules.css"><div id="root"></div><script src="/bundle.js"></script></html>');
  });
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  const {chromium}=require(path.join(process.env.USERPROFILE,".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright"));
  let browser;
  try{
    browser=await chromium.launch({channel:"msedge",headless:true}); const receipts=[];
    for(const viewport of [{width:1280,height:900},{width:390,height:844},{width:320,height:568}]){
      rows.clear();const context=await browser.newContext({viewport}),page=await context.newPage(),errors=[];page.on("pageerror",error=>errors.push(error.message));
      await page.goto("http://127.0.0.1:"+server.address().port);
      const caption=page.getByRole("textbox",{name:"Post caption"}),save=page.getByRole("button",{name:"Save caption",exact:true});
      await caption.waitFor(); await page.getByRole("button",{name:"Saved captions",exact:true}).click(); await page.getByText(/Write a caption above/).waitFor();
      const first="That’s what I’m working on with UGCPilot.\n\ngetugcpilot.com\n\n#SaaS #BuildInPublic";
      await caption.fill(first);await save.click();await page.getByText("Caption saved as your default for new posts.",{exact:true}).waitFor();
      await page.getByRole("button",{name:"Clear post caption"}).click();assert.equal(await caption.inputValue(),"");
      assert.equal(rows.get("owner-a").captions.length,1);
      const second="Another caption\n#Founder";await caption.fill(second);await save.click();await page.getByText("Caption saved.",{exact:true}).waitFor();
      await page.getByRole("button",{name:"Make default",exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('[aria-pressed="true"]').length===1);
      await page.screenshot({path:path.join(out,viewport.width+"-library.png")});
      await page.getByRole("button",{name:"Switch workflow",exact:true}).click();await page.waitForFunction(expected=>document.querySelector('textarea').value===expected,second);
      await page.getByRole("button",{name:"Clear post caption"}).click();assert.equal(await caption.inputValue(),"");
      await page.getByRole("button",{name:/Saved captions/}).click();await page.getByRole("button",{name:"Default",exact:true}).click();await page.getByRole("button",{name:"Make default",exact:true}).first().waitFor();
      assert.equal(await caption.inputValue(),"","Changing defaults cannot refill a deliberately blank caption");
      await page.getByRole("button",{name:"Existing draft",exact:true}).click();await page.waitForFunction(()=>document.querySelector('textarea').value==='My existing draft');
      await page.getByRole("button",{name:"Switch account",exact:true}).click();await page.getByRole("button",{name:"Saved captions",exact:true}).click();await page.getByText(/Write a caption above/).waitFor();assert.equal(await caption.inputValue(),"");
      await page.getByRole("button",{name:"Switch account",exact:true}).click();await page.getByRole("button",{name:/Saved captions/}).click();
      const deletes=page.getByRole("button",{name:/Delete saved caption:/});await deletes.first().click();await page.waitForFunction(()=>document.querySelectorAll('button[title="Delete saved caption"]').length===1);
      assert.equal(await caption.inputValue(),"");
      failNext=true;await caption.fill("Unsaved draft stays here");await save.click();await page.getByRole("alert").waitFor();assert.equal(await caption.inputValue(),"Unsaved draft stays here");await page.getByRole("button",{name:"Retry",exact:true}).click();await save.waitFor({state:"visible"});await page.waitForFunction(()=>Array.from(document.querySelectorAll('button')).some(b=>b.textContent==='Save caption'&&!b.disabled));
      loseNext=true;await save.click();await page.getByRole("alert").waitFor();await page.getByRole("button",{name:"Retry",exact:true}).click();await page.getByRole("button",{name:"Saved",exact:true}).waitFor();assert.equal(rows.get("owner-a").captions.length,2,"Lost response is recovered without duplicate save");
      const previous=rows.get("owner-a"),otherId="00000000-0000-4000-8000-000000000099";
      rows.set("owner-a",{...previous,revision:previous.revision+1,captions:[...previous.captions,{id:otherId,text:"Saved in another tab"}]});
      await page.getByRole("button",{name:"Make default",exact:true}).first().click();await page.getByRole("alert").waitFor();await page.getByRole("button",{name:"Retry",exact:true}).click();
      await page.getByText("Saved in another tab",{exact:true}).waitFor();assert.equal(rows.get("owner-a").captions.length,3,"Stale updates cannot erase another tab's caption");
      await page.screenshot({path:path.join(out,viewport.width+"-field.png")});
      let held;await page.route("**/api/account/saved-captions",async route=>{if(route.request().method()==="GET"&&!held){held=route;return;}await route.continue();});
      await page.reload();await caption.fill("I typed before defaults loaded");
      const delayed={revision:1,captions:[{id:otherId,text:"Late default"}],defaultId:otherId};
      assert.ok(held);await held.fulfill({json:{ok:true,library:delayed}});
      await page.waitForFunction(()=>!document.body.innerText.includes('Loading saved captions…'));assert.equal(await caption.inputValue(),"I typed before defaults loaded");
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);receipts.push({viewport,multipleSaved:true,defaultAcrossWorkflow:true,clearPreserved:true,accountIsolation:true,failurePreservesDraft:true,lostResponseNoDuplicate:true,concurrentChangePreserved:true,lateDefaultCannotOverwriteTyping:true,noHorizontalOverflow:true});await context.close();
    }
    write("receipt.json",JSON.stringify({receipts,limitations:"Actual caption component, styles, query hook and authenticated client; HTTP and accounts are fixtures. No production data writes or publishing."},null,2));console.log(JSON.stringify(receipts,null,2));
  }finally{await browser?.close();server.closeAllConnections();server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
