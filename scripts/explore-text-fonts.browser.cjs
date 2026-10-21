/* eslint-disable @typescript-eslint/no-require-imports -- Isolated production-component browser verification. */
const fs = require("node:fs"), path = require("node:path"), http = require("node:http"), assert = require("node:assert/strict");
const { webpack } = require("next/dist/compiled/webpack/webpack");
const root = path.resolve(__dirname, ".."), out = path.join(root, ".tmp/explore-text-fonts-browser");
fs.mkdirSync(out, { recursive: true });
const write = (name, value) => fs.writeFileSync(path.join(out, name), value);
write("loader.cjs", `const ts=require(${JSON.stringify(require.resolve("typescript"))});module.exports=function(s){return ts.transpileModule(s,{fileName:this.resourcePath,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText};`);
write("css.cjs", `module.exports=s=>'export default '+JSON.stringify(Object.fromEntries([...s.matchAll(/\\.([a-zA-Z][a-zA-Z0-9_-]*)/g)].map(m=>[m[1],m[1]])))+';';`);
write("entry.tsx", `import {createRoot} from 'react-dom/client';import {useState} from 'react';
import {FormatTextOverlaysEditor} from '@/components/explore/format-text-overlays-editor';import {FormatVideoTextOverlay} from '@/components/explore/format-video-text-overlay';
import {readFormatEditDraft} from '@/lib/explore/format-edit-draft';
const original={version:1,format:'hook',trimStartMs:0,trimEndMs:5000,originalVolume:1,musicVolume:.2,text:null,textOverlays:[{value:'One thing I wish I knew sooner',font:'inter',fontWeight:500,width:.8,y:.18,fontSize:64,color:'#ffffff',startMs:0,endMs:5000}]};
function App(){const [edit,setEdit]=useState(()=>readFormatEditDraft(JSON.parse(localStorage.getItem('font-draft')||JSON.stringify(original)))),[saved,setSaved]=useState(false),[advanced,setAdvanced]=useState(false);const wall=new URLSearchParams(location.search).has('wall');return <main><h1>{wall?'Wall of text':'Edit hook video'}</h1><div className='fixture'><section className='portrait'><img src='/background.png'/><FormatVideoTextOverlay text={edit.textOverlays[0]} label='Text preview' width={1080} height={1920} onChange={text=>{setSaved(false);setEdit({...edit,textOverlays:[text,...edit.textOverlays.slice(1)]})}}/></section><section className='settings'><div className='scroller'><FormatTextOverlaysEditor overlays={edit.textOverlays} wallText={wall} durationMs={5000} timeMs={1000} onSeek={()=>{}} showStyleControls={!wall||advanced} onChange={textOverlays=>{setSaved(false);setEdit({...edit,textOverlays})}}/>{wall?<button onClick={()=>setAdvanced(v=>!v)}>{advanced?'Back to text':'Edit'}</button>:null}</div><footer><button onClick={()=>{localStorage.setItem('font-draft',JSON.stringify(readFormatEditDraft(edit)));setSaved(true)}}>Save edits</button>{saved?<span role='status'>Saved</span>:null}</footer></section></div></main>};createRoot(document.getElementById('root')).render(<App/>);`);

async function main() {
  await new Promise((resolve,reject)=>{const compiler=webpack({mode:"development",devtool:false,context:root,entry:path.join(out,"entry.tsx"),output:{path:out,filename:"bundle.js"},plugins:[new webpack.DefinePlugin({"process.env":JSON.stringify({NODE_ENV:"development"})})],resolve:{extensions:[".tsx",".ts",".js"],alias:{"@":root}},module:{rules:[{test:/\.tsx?$/,use:path.join(out,"loader.cjs")},{test:/\.css$/,use:path.join(out,"css.cjs")}]}});compiler.run((e,s)=>compiler.close(()=>e||s.hasErrors()?reject(e||Error(s.toString({all:false,errors:true}))):resolve()));});
  const postcss=require("postcss"), globals=fs.readFileSync(path.join(root,"app/globals.css"),"utf8").replace('@import "tailwindcss";','@import "tailwindcss" source(none);')+'\n@source "../components/explore/format-text-overlays-editor.tsx";\n@source "../components/explore/format-video-text-overlay.tsx";\n@source "../components/ui/button.tsx";';
  let css=(await postcss([require("@tailwindcss/postcss")()]).process(globals,{from:path.join(root,"app/globals.css")})).css;
  for(const file of ["format-workspace.module.css","format-video-editor.module.css","explore-text-fonts.css"]) css+="\n"+fs.readFileSync(path.join(root,"components/explore",file),"utf8").replace(/:global\(([^)]+)\)/g,"$1");
  css+="\nmain{max-width:1100px;margin:auto;padding:20px}h1{font-size:18px;margin-bottom:16px}.fixture{display:grid;grid-template-columns:320px minmax(0,1fr);gap:24px}.portrait{position:relative;aspect-ratio:9/16;overflow:hidden;border-radius:20px;background:#111}.portrait img{width:100%;height:100%;object-fit:cover;filter:brightness(.65)}.settings{display:flex;flex-direction:column;min-height:0;height:calc(100dvh - 110px)}.scroller{overflow:auto;min-height:0;padding:4px 8px 16px}footer{display:flex;gap:12px;padding:12px 0}footer button{padding:8px 16px;border-radius:10px;background:var(--primary);color:var(--primary-foreground)}@media(max-width:600px){main{padding:12px}.fixture{grid-template-columns:minmax(0,1fr);gap:16px}.portrait{width:170px;justify-self:center}.settings{height:560px}}";
  const emojiManifest=JSON.parse(fs.readFileSync(path.join(root,"worker/src/lib/explore-emoji-manifest.json"),"utf8"));
  const emojiArt=JSON.parse(require("node:zlib").gunzipSync(fs.readFileSync(path.join(root,"worker/src/assets/emoji",emojiManifest.version+".json.gz"))));
  const server=http.createServer((req,res)=>{
    if(req.url.startsWith("/api/explore/emoji/")) {
      const match=req.url.match(/^\/api\/explore\/emoji\/([^/]+)\/([a-f0-9-]+)$/);
      if(!match||match[1]!==emojiManifest.version+'-'+emojiManifest.packSha256.slice(0,12)||!Object.hasOwn(emojiArt,match[2])) {res.statusCode=404;return res.end();}
      res.setHeader("Content-Type","image/svg+xml");return res.end(emojiArt[match[2]]);
    }
    if(req.url==="/bundle.js"){res.setHeader("Content-Type","text/javascript");return res.end(fs.readFileSync(path.join(out,"bundle.js")));}
    if(req.url.startsWith("/explore-text-fonts/")&&/^\/explore-text-fonts\/[a-z]+-(400|500|700)\.woff2$/.test(req.url)){res.setHeader("Content-Type","font/woff2");return res.end(fs.readFileSync(path.join(root,"public",req.url)));}
    if(req.url==="/background.png"){res.setHeader("Content-Type","image/png");return res.end(fs.readFileSync(path.join(root,"public/ai-studio/creator-references/creator-01.png")));}
    res.setHeader("Content-Type","text/html; charset=utf-8");res.end('<html class="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'</style></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>');
  });
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));let browser;
  try {
    let pw;try{pw=require("playwright");}catch{pw=require(path.join(process.env.USERPROFILE,".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright"));}
    browser=await pw.chromium.launch({headless:true,...(process.platform==="win32"?{channel:"msedge"}:{})});const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];page.on("pageerror",e=>errors.push(e.message));await page.goto(`http://127.0.0.1:${server.address().port}`);
    const select=page.getByRole("combobox",{name:"Text font",exact:true}),weight=page.getByRole("combobox",{name:"Text weight",exact:true});
    // Existing Medium choices remain; newly added text starts in Inter Bold.
    assert.equal(await weight.inputValue(),"500");
    await page.getByRole("button",{name:"Add text",exact:true}).click();assert.equal(await select.inputValue(),"inter");assert.equal(await weight.inputValue(),"700");
    await page.getByRole("button",{name:"Remove text block 2",exact:true}).click();assert.equal(await weight.inputValue(),"500");
    for(const font of ["inter","dmsans","robotocondensed","montserrat"]) for(const value of ["400","500","700"]) {
      await select.selectOption(font);await weight.selectOption(value);
      const selected=await page.locator('svg[aria-label="Text preview"] g').evaluate(async node=>{const family=node.getAttribute("font-family"),weight=node.getAttribute("font-weight");await document.fonts.load(weight+' 32px "'+family+'"');return {family,weight,loaded:document.fonts.check(weight+' 32px "'+family+'"'),width:node.getBBox().width};});
      assert.equal(selected.loaded,true);assert.equal(selected.weight,value);assert.ok(selected.family.startsWith("UGCExplore"));assert.ok(selected.width>0&&selected.width<1080);
    }
    await weight.selectOption("500");await page.getByRole("button",{name:"Save edits",exact:true}).click();await page.reload();assert.equal(await select.inputValue(),"montserrat");assert.equal(await weight.inputValue(),"500");
    assert.equal(await page.getByRole("textbox",{name:"Overlay text",exact:true}).inputValue(),"One thing I wish I knew sooner");
    async function checkPresetSwitch(wall=false) {
      const preset=page.getByRole("combobox",{name:"Text preset",exact:true}),text=page.getByRole("textbox",{name:wall?"Wall of text":"Overlay text",exact:true}),copy=await text.inputValue(),font=await select.inputValue();
      await preset.selectOption("snapchat-classic");
      assert.equal(await preset.inputValue(),"snapchat-classic");assert.equal(await page.locator('svg[aria-label="Text preview"] rect:not([data-text-handle])').count(),1);assert.equal(await weight.inputValue(),"400");
      await preset.selectOption("bold");
      assert.equal(await preset.inputValue(),"bold");assert.equal(await page.locator('svg[aria-label="Text preview"] rect:not([data-text-handle])').count(),0);assert.equal(await weight.inputValue(),"700");
      assert.equal(await page.getByRole("slider",{name:"Caption background opacity",exact:true}).count(),0);assert.equal(await select.inputValue(),font);assert.equal(await text.inputValue(),copy);
      await page.getByRole("button",{name:"Save edits",exact:true}).click();await page.getByRole("status").waitFor();await page.reload();
      if(wall)await page.getByRole("button",{name:"Edit",exact:true}).click();
      assert.equal(await preset.inputValue(),"bold");assert.equal(await text.inputValue(),copy);assert.equal(await select.inputValue(),font);assert.equal(await weight.inputValue(),"700");assert.equal(await page.locator('svg[aria-label="Text preview"] rect:not([data-text-handle])').count(),0);
      console.log("PASS preset Snapchat → Bold white, preview background removed, copy/font and save/reopen preserved: "+(wall?"Wall":"Hook")+" "+JSON.stringify(page.viewportSize()));
    }
    async function checkDrag() {
      const handle=page.getByRole('button',{name:'Move Text preview',exact:true}),svg=page.locator('svg[aria-label="Text preview"]'),first=svg.locator('text').first();
      await handle.scrollIntoViewIfNeeded();
      const box=await handle.boundingBox(),frame=await svg.boundingBox(),before={x:Number(await first.getAttribute('x')),y:Number(await first.getAttribute('y'))};
      await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+4,box.y+box.height/2+20,{steps:6});await page.mouse.up();
      assert.ok(Math.abs(Number(await first.getAttribute('x'))-before.x-4*1080/frame.width)<.1,'Horizontal drag uses displayed frame scale');
      assert.ok(Math.abs(Number(await first.getAttribute('y'))-before.y-20*1920/frame.height)<.1,'Vertical drag uses displayed frame scale');
      await handle.press('ArrowLeft');await handle.press('Shift+ArrowDown');
      if(page.viewportSize().width<600){
        const touch=await page.context().newCDPSession(page),b=await handle.boundingBox(),x=b.x+b.width/2,y=b.y+b.height/2,previous=Number(await first.getAttribute('y'));
        await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-3,y:y+6}]});await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await touch.detach();
        assert.ok(Number(await first.getAttribute('y'))>previous,'Real touch drag updates the caption');
      }
      const positioned={x:await first.getAttribute('x'),y:await first.getAttribute('y')};
      await page.getByRole('button',{name:'Save edits',exact:true}).click();await page.getByRole('status').waitFor();
      const draft=await page.evaluate(()=>JSON.parse(localStorage.getItem('font-draft')));assert.ok(draft.textOverlays[0].x!==undefined);
      await page.reload();assert.equal(await first.getAttribute('x'),positioned.x);assert.equal(await first.getAttribute('y'),positioned.y);
      assert.equal(draft.textOverlays[0].value,'One thing I wish I knew sooner');assert.equal(draft.textOverlays[0].startMs,0);assert.equal(draft.textOverlays[0].endMs,5000);
      console.log('PASS mouse/keyboard'+(page.viewportSize().width<600?'/touch':'')+' positioning and save/reopen '+JSON.stringify(page.viewportSize()));
    }
    await page.screenshot({path:path.join(out,"laptop.png")});
    for(const viewport of [{width:1366,height:768},{width:1536,height:864},{width:390,height:844}]) {await page.setViewportSize(viewport);await checkPresetSwitch();await checkDrag();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await select.scrollIntoViewIfNeeded();assert.equal(await select.isVisible(),true);await page.screenshot({path:path.join(out,`fonts-${viewport.width}.png`),fullPage:viewport.width<600});}
    const symbolCopy='Building more features ❌\nMarketing my SaaS ✅\nTry this → ✔️ 😂';
    await page.getByRole('textbox',{name:'Overlay text',exact:true}).fill(symbolCopy);
    await page.getByRole('button',{name:'Save edits',exact:true}).click();await page.reload();
    for(const viewport of [{width:1366,height:768},{width:390,height:844}]) {
      await page.setViewportSize(viewport);
      assert.equal(await page.getByRole('textbox',{name:'Overlay text',exact:true}).inputValue(),symbolCopy);
      const preview=page.locator('svg[aria-label="Text preview"]');
      assert.equal(await preview.locator('[data-format-inline-symbol]').count(),4);
      assert.equal(await preview.locator('[data-format-inline-symbol="cross"] path').getAttribute('fill'),'#e53935');
      assert.equal(await preview.locator('[data-format-inline-symbol="check-box"] path').first().getAttribute('fill'),'#22a447');
      assert.equal(await preview.locator('[data-format-inline-symbol="check"] path').getAttribute('fill'),'#22c55e');
      assert.equal(await preview.locator('image[aria-label="😂"]').count(),1);
      await page.screenshot({path:path.join(out,`symbols-${viewport.width}.png`),fullPage:true});
    }
    console.log('PASS: preview cross/right-arrow red, checks green, face emoji retained and exact Unicode survives save/reopen on laptop/mobile.');

    const emojiCopy='😂 😭 🔥 🚀\n❤️ 👍🏽 👩🏽‍💻 🇮🇳\n1️⃣ 💯 ✨ 🎉\n❌ ✅ ✔️ ☑️';
    await page.getByRole('textbox',{name:'Overlay text',exact:true}).fill(emojiCopy);
    await page.getByRole('button',{name:'Save edits',exact:true}).click();await page.reload();
    for(const viewport of [{width:1366,height:768},{width:390,height:844}]) {
      await page.setViewportSize(viewport);
      assert.equal(await page.getByRole('textbox',{name:'Overlay text',exact:true}).inputValue(),emojiCopy);
      const images=page.locator('svg[aria-label="Text preview"] [data-format-emoji]');
      assert.equal(await images.count(),12);
      const loaded=await images.evaluateAll(nodes=>Promise.all(nodes.map(node=>new Promise(resolve=>{
        const image=new Image();image.onload=()=>resolve(image.naturalWidth>0);image.onerror=()=>resolve(false);image.src=node.getAttribute('href');
      }))));
      assert.ok(loaded.every(Boolean),'Every preview glyph loads as actual bundled artwork');
      await page.screenshot({path:path.join(out,`emojis-${viewport.width}.png`),fullPage:true});
    }
    console.log('PASS: faces, heart, skin tone, joined person, flag, keycap and symbols use bundled artwork and survive save/reopen at laptop/mobile widths.');

    await page.goto(`http://127.0.0.1:${server.address().port}?wall=1`);assert.equal(await select.count(),0);await page.getByRole("button",{name:"Edit",exact:true}).click();await select.waitFor();assert.equal(await page.getByRole("spinbutton",{name:"Text start time"}).count(),0);
    await checkPresetSwitch(true);
    await page.getByRole("button",{name:"Add text",exact:true}).click();assert.equal(await select.inputValue(),"inter");assert.equal(await weight.inputValue(),"700");
    assert.deepEqual(errors,[]);console.log("PASS: new Hook/Wall text defaults to Inter Bold; all 12 bundled faces loaded, preview changed, save/reopen preserved choices, Wall advanced-only controls, laptop/mobile fit. "+out);
  } finally {if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
