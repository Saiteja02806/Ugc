/* Actual Trending editor with isolated auth/API boundaries. No production calls. */
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const { webpack } = require('next/dist/compiled/webpack/webpack');
let playwright; try { playwright = require('playwright'); } catch { playwright = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
const root = path.resolve(__dirname, '..'), out = path.join(root, '.tmp/trending-carousel-text'); fs.mkdirSync(out, { recursive: true });
const write = (file, text) => fs.writeFileSync(path.join(out, file), text);
write('loader.cjs', `const ts=require(${JSON.stringify(require.resolve('typescript'))});module.exports=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText;`);
write('css.cjs', `module.exports=s=>'const style=document.createElement("style");style.textContent='+JSON.stringify(s)+';document.head.append(style);export default {};';`);
write('module-css.cjs', String.raw`module.exports=function(s){const prefix=require('node:path').basename(this.resourcePath).replace(/[^a-zA-Z]/g,'')+'_',names={};s=s.replace(/:global\(([^)]+)\)/g,(_,value)=>'GLOBALSTART'+Buffer.from(value).toString('hex')+'GLOBALEND');s=s.replace(/\.([a-zA-Z][a-zA-Z0-9_-]*)/g,(_,name)=>{names[name]=prefix+name;return '.'+prefix+name;});s=s.replace(/GLOBALSTART([a-f0-9]+)GLOBALEND/g,(_,value)=>Buffer.from(value,'hex').toString());return 'const style=document.createElement("style");style.textContent='+JSON.stringify(s)+';document.head.append(style);export default '+JSON.stringify(names)+';';};`);
write('auth.ts', `export const getCurrentUserIdToken=async()=> 'fixture-token';export const useAuth=()=>({user:{uid:'fixture-owner'},loading:false});`);
write('font.ts', `export default ()=>({variable:'fixture-inter'});`);
write('entry.tsx', `import {useState} from 'react';import {createRoot} from 'react-dom/client';import {QueryClient,QueryClientProvider} from '@tanstack/react-query';import {TrendingCreativeEditor} from '@/components/trending/trending-creative-editor';
const item={format:'carousel',creativeId:'creative',assignmentId:'assignment',creative:{title:'Useful habits'}};
function App(){const [open,so]=useState(true);return <main><button onClick={()=>so(true)}>Open slideshow editor</button><TrendingCreativeEditor item={open?item:null} onClose={()=>so(false)} onSaved={edit=>window.saved=edit}/></main>};createRoot(document.getElementById('root')).render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><App/></QueryClientProvider>);`);
async function main() {
  const manual = await import('../worker/dist/lib/carousel-manual-text.js'), { createCarouselManualSvg } = await import('../worker/dist/lib/carousel-manual-render.js');
  const baseSlide = n => ({ slideId: 'slide-'+n, slideNumber:n, headline:n===1?'Small steps, better work':'Useful habits', subtext:n===1?'':'Start with ten minutes.', ctaText:'', backgroundAssetId:'image-'+n, backgroundUrl:'/background.webp', originalBackgroundAssetId:'image-'+n, originalBackgroundUrl:'/background.webp', renderedUrl:'/background.webp', textPosition:{x:.5,y:.5}, renderFormat:'4:5', structureId:'structure_2', visualRole:'human', originalVisualRole:'human', storyLayoutVariant:'story_overlay_only', storyTextTreatment:'overlay' });
  let record={assignmentId:'assignment',creativeId:'creative',format:'carousel',id:'edit',revision:0,renderState:'ready',renderOutput:null,source:null,content:{format:'carousel',version:'trending-creative-edit-v1',slides:[baseSlide(1),baseSlide(2)]}};
  const patches=[],errors=[],requests=[]; let failSave=false;
  await new Promise((resolve,reject)=>{const c=webpack({mode:'development',devtool:false,context:root,entry:path.join(out,'entry.tsx'),output:{path:out,filename:'bundle.js'},resolve:{extensions:['.tsx','.ts','.js'],extensionAlias:{'.js':['.js','.ts','.tsx']},alias:{'next/font/local':path.join(out,'font.ts'),'@/lib/firebase/auth':path.join(out,'auth.ts'),'@/contexts/auth-context':path.join(out,'auth.ts'),'@':root}},module:{rules:[{test:/\.tsx?$/,use:path.join(out,'loader.cjs')},{test:/\.module\.css$/,use:path.join(out,'module-css.cjs')},{test:/\.css$/,exclude:/\.module\.css$/,use:path.join(out,'css.cjs')}]}});c.run((e,s)=>c.close(()=>e||s.hasErrors()?reject(e||Error(s.toString({all:false,errors:true}))):resolve()));});
  const css=(await require('postcss')([require('@tailwindcss/postcss')({base:root})]).process(fs.readFileSync(path.join(root,'app/globals.css'),'utf8').replace('@import "tailwindcss";','@import "tailwindcss" source(none);\n@source "../components/trending";\n@source "../components/ui";'),{from:path.join(root,'app/globals.css')})).css;
  const server=http.createServer(async(req,res)=>{try {
    const url=new URL(req.url,'http://fixture'),json=(body,status=200)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(body));};
    if(url.pathname==='/favicon.ico'){res.writeHead(204);return res.end();}
    if(url.pathname==='/')return res.end('<!doctype html><html class="dark"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><body style="background:#202020;color:white;font-family:Arial"><div id="root"></div><script src="/bundle.js"></script>');
    if(url.pathname==='/bundle.js'){res.setHeader('Content-Type','text/javascript');return res.end(fs.readFileSync(path.join(out,'bundle.js')));}
    if(url.pathname==='/style.css'){res.setHeader('Content-Type','text/css');return res.end(css);}
    if(url.pathname==='/background.webp'){res.setHeader('Content-Type','image/webp');return res.end(fs.readFileSync(path.join(root,'public/explore/characters/creator-office-v2.webp')));}
    if(/^\/explore-text-fonts\/[a-z]+-(400|500|700)\.woff2$/.test(url.pathname)){res.setHeader('Content-Type','font/woff2');return res.end(fs.readFileSync(path.join(root,'public',url.pathname)));}
    if(/^\/render-\d+-\d+\.svg$/.test(url.pathname)){res.setHeader('Content-Type','image/svg+xml');return res.end(fs.readFileSync(path.join(out,url.pathname.slice(1))));}
    assert.equal(req.headers.authorization,'Bearer fixture-token'); requests.push(url.pathname);
    if(url.pathname==='/api/trending/carousel-product-assets')return json({ok:true,assets:[]});
    assert.equal(url.pathname,'/api/trending/creatives/carousel/creative/edit');
    if(req.method==='PATCH'){
      let raw='';for await(const b of req)raw+=b;const body=JSON.parse(raw);patches.push(body);
      if(failSave){failSave=false;return json({ok:false,error:'Fixture save interrupted'},503);}
      assert.equal(body.expectedRevision,record.revision);
      const slides=record.content.slides.map((slide,index)=>({...slide,...body.slides[index],textStyle:manual.parseCarouselManualTextStyle(body.slides[index].textStyle)}));
      for(const slide of slides)if(slide.textStyle){const {svg}=await createCarouselManualSvg(slide);write('render-'+(record.revision+1)+'-'+slide.slideNumber+'.svg',svg);}
      record={...record,revision:record.revision+1,content:{...record.content,slides},renderOutput:{slides:slides.map(slide=>({slideNumber:slide.slideNumber,renderedUrl:slide.textStyle?'/render-'+(record.revision+1)+'-'+slide.slideNumber+'.svg':'/background.webp'}))}};
    }
    return json({ok:true,edit:record});
  } catch(e){errors.push(e.message);res.writeHead(500);res.end(JSON.stringify({ok:false,error:e.message}));}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const browser=await playwright.chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});const page=await browser.newPage({viewport:{width:1366,height:900}});page.on('pageerror',e=>errors.push(e.message));
  const preview=()=>page.locator('[data-carousel-editor-preview]'), state=()=>page.evaluate(()=>window.saved);
  async function save(){await page.getByRole('button',{name:'Confirm and save creative edit',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});}
  async function open(){await page.getByRole('button',{name:'Open slideshow editor',exact:true}).click();await page.getByLabel('Font',{exact:true}).waitFor();}
  try {
    await page.goto('http://127.0.0.1:'+server.address().port);await page.getByLabel('Font',{exact:true}).waitFor();
    assert.equal(await preview().getAttribute('data-carousel-editor-preview'),'exact-render');
    await page.getByLabel('Font',{exact:true}).selectOption('montserrat');await page.getByLabel('Hook size',{exact:true}).fill('44');await page.getByLabel('Hook color',{exact:true}).fill('#0088ff');
    assert.equal(await preview().getAttribute('data-carousel-editor-preview'),'live-render');
    const overlay=page.getByRole('button',{name:'Move text for slide 1',exact:true});await overlay.focus();await page.keyboard.press('ArrowLeft');await page.keyboard.press('ArrowUp');
    await page.getByRole('button',{name:'Next slide',exact:true}).click();await page.getByLabel('Font',{exact:true}).selectOption('dmsans');await page.getByLabel('Text size',{exact:true}).fill('32');await page.getByLabel('Heading size',{exact:true}).fill('40');await page.getByLabel('Text color',{exact:true}).fill('#ff8800');
    const move=page.getByRole('button',{name:'Move text for slide 2',exact:true});await move.scrollIntoViewIfNeeded();const a=await move.boundingBox();await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();await page.mouse.move(a.x+a.width/2-30,a.y+a.height/2+30,{steps:8});await page.mouse.up();
    await page.screenshot({path:path.join(out,'advanced-desktop.png')});
    failSave=true;await page.getByRole('button',{name:'Confirm and save creative edit',exact:true}).click();await page.getByText('Fixture save interrupted',{exact:true}).waitFor();assert.equal(await page.getByLabel('Text size',{exact:true}).inputValue(),'32');
    await save();const saved=await state();assert.equal(saved.content.slides[0].textStyle.font,'montserrat');assert.equal(saved.content.slides[1].textStyle.font,'dmsans');assert.equal(saved.content.slides[1].textStyle.color,'#ff8800');assert.ok(saved.content.slides[1].textPosition.x<.5);assert.ok(saved.content.slides[1].textPosition.y>.5);
    await open();await page.getByRole('button',{name:'Next slide',exact:true}).click();assert.equal(await page.getByLabel('Text size',{exact:true}).inputValue(),'32');assert.equal(await page.getByLabel('Font',{exact:true}).inputValue(),'dmsans');assert.equal(await preview().getAttribute('data-carousel-editor-preview'),'exact-render');
    for(const width of [1536,390]){await page.setViewportSize({width,height:844});await page.getByLabel('Text size',{exact:true}).scrollIntoViewIfNeeded();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:path.join(out,'advanced-'+width+'.png')});}
    await page.getByRole('button',{name:'Reset text layout',exact:true}).click();await save();assert.equal((await state()).content.slides[1].textStyle,null);assert.equal(patches.length,3);assert.deepEqual(errors,[]);
    const touchContext=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const touch=await touchContext.newPage();touch.on('pageerror',e=>errors.push(e.message));
    await touch.goto('http://127.0.0.1:'+server.address().port);await touch.getByLabel('Font',{exact:true}).waitFor();await touch.getByRole('button',{name:'Next slide',exact:true}).click();await touch.getByLabel('Text size',{exact:true}).fill('32');
    const textHandle=touch.getByRole('button',{name:'Move text for slide 2',exact:true});await textHandle.scrollIntoViewIfNeeded();const rect=await textHandle.boundingBox(),x=rect.x+rect.width/2,y=rect.y+rect.height/2,client=await touchContext.newCDPSession(touch);
    await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});for(let i=1;i<=8;i++)await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+15*i/8,y:y+15*i/8}]});await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await touch.getByRole('button',{name:'Confirm and save creative edit',exact:true}).click();await touch.getByRole('dialog').waitFor({state:'hidden'});const touchSaved=await touch.evaluate(()=>window.saved);assert.ok(touchSaved.content.slides[1].textPosition.x>.5);assert.ok(touchSaved.content.slides[1].textPosition.y>.5);await client.detach();await touchContext.close();assert.deepEqual(errors,[]);
    console.log('PASS actual Trending editor: appearance, independent slides, mouse/touch/keyboard position, failed save recovery, PATCH content, worker SVG, reopen, reset and desktop/mobile layout');
  } catch(e){await page.screenshot({path:path.join(out,'failure.png')});console.error(await page.locator('body').innerText());throw e;}
  finally {await browser.close();await new Promise(r=>server.close(r));}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
