/* eslint-disable @typescript-eslint/no-require-imports -- Actual components with isolated owned-media fixtures. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { webpack } = require('next/dist/compiled/webpack/webpack');
const postcss = require('postcss');
const tailwind = require('@tailwindcss/postcss');
let playwright;
try { playwright = require('playwright'); }
catch { playwright = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
const root = path.resolve(__dirname, '..'), out = path.join(root, '.tmp/slideshow-reference-stack');
fs.mkdirSync(out, { recursive: true });
const file = (name, content) => fs.writeFileSync(path.join(out, name), content);
file('loader.cjs', `const ts=require(${JSON.stringify(require.resolve('typescript'))});module.exports=source=>ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText;`);
file('css.cjs', `module.exports=()=> 'export default new Proxy({}, {get:(_,name)=>name});';`);
file('auth.ts', `export async function getCurrentUserIdToken(){return 'fixture-owner';}`);
file('media.ts', `export const readAIStudioReferenceMetadata=async()=>({width:720,height:1280,ratio:'9:16'});export async function uploadAIStudioReferenceMedia(file,kind,limit,owner,options){if(file.name.startsWith('slow'))await new Promise(resolve=>setTimeout(resolve,400));if(file.name.startsWith('fail'))throw new Error('Upload failed. Try again.');return {kind,asset:window.makeAsset(file.name)};}export const fetchAIStudioMediaAssets=async()=>[window.makeAsset('saved-product.png','saved-1'),window.makeAsset('saved-style.png','saved-2')];export const fetchAIStudioMediaAsset=async(id)=>window.makeAsset(id==='saved-1'?'saved-product.png':'saved-style.png',id);`);
file('entry.tsx', `import {createRoot} from 'react-dom/client';import {useState} from 'react';import {QueryClient,QueryClientProvider} from '@tanstack/react-query';import {FormatInstructionImageReference} from '@/components/explore/format-instruction-image-reference';import {AiStudioComposer} from '@/components/generation/ai-studio-composer';import {Button} from '@/components/ui/button';import {Upload} from 'lucide-react';
let serial=0;window.makeAsset=(name,id)=>({id:id??'image-'+(++serial),collection:'image',status:'ready',sourceType:'upload',url:'/image/'+(name.includes('style')?2:1),thumbnailUrl:null,title:name,fileName:name,mimeType:'image/png',fileSizeBytes:128,width:720,height:1280,ratio:'9:16',durationSeconds:null,projectId:'explore-reference',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),metadata:{},sourceRecordId:null,parentAssetId:null});
function Fixture(){const [images,setImages]=useState([]),[prompt,setPrompt]=useState(''),[pending,setPending]=useState(false),[error,setError]=useState(null),[limit,setLimit]=useState(14);window.setReferenceLimit=setLimit;window.seedReferences=count=>setImages(Array.from({length:count},(_,index)=>({kind:'image',asset:window.makeAsset('reference-'+(index+1)+(index%2?'-style':'')+'.png')})));return <main className='shell' style={{padding:24,maxWidth:1100,margin:'auto'}}><p className='mb-5 text-sm text-muted'>Explore <span className='mx-2'>/</span> <span className='font-semibold text-foreground'>Slideshows</span></p><section className='controls' style={{width:'min(100%,408px)'}}><nav className='sectionTabs'><button className='sectionTab' data-active>Create</button><button className='sectionTab'>Edit slides</button><button className='sectionTab'>Schedule</button></nav><div className='controlContent'><h2 className='text-sm font-medium'>Slideshow reference</h2><Button variant='outline' style={{width:144,height:124}} className='flex flex-col gap-2'><Upload className='size-5'/>Upload slides</Button><p className='mb-3 text-xs leading-5 text-muted'>Choose a slideshow to guide the layout, or upload your slides.</p><AiStudioComposer active workflowDesign='classic' layout='workflow' compact ariaLabel='Your instructions' name='instructions' prompt={prompt} onPromptChange={setPrompt} placeholder='What would you like to change?' promptHelper='Describe how to use your reference images.' onTextareaKeyDown={()=>{}} onSubmit={event=>event?.preventDefault()} generationLocked={false} generateDisabled={pending||!!error||!prompt.trim()} generateLabel='Generate image' isGenerating={false} accessMessage='This generation uses 1 AI credit.' settings={<><label className='col-span-2 text-sm'>Model<select className='mt-2 h-10 w-full rounded-lg border border-border bg-card-muted px-3'><option>GPT Image 2.5</option><option>Nano Banana 2</option></select></label><p className='text-xs text-muted'>Ratio · 9:16</p><p className='text-xs text-muted'>Versions · 1 image</p></>} promptAttachmentControl={<FormatInstructionImageReference selections={images} onChange={setImages} onPendingChange={setPending} onErrorChange={setError} ownerId='owner-a' disabled={false} maxImages={limit}/>} hasAttachments={images.length>0||pending}/></div></section></main>;}
createRoot(document.getElementById('root')).render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><Fixture/></QueryClientProvider>);`);

async function compile() {
  await new Promise((resolve, reject) => {
    const compiler = webpack({mode:'development',devtool:false,context:root,entry:path.join(out,'entry.tsx'),output:{path:out,filename:'bundle.js'},resolve:{extensions:['.tsx','.ts','.js'],alias:{'@/lib/firebase/auth':path.join(out,'auth.ts'),'@/lib/ai-studio/reference-media-upload':path.join(out,'media.ts'),'@/lib/ai-studio/media-client':path.join(out,'media.ts'),'@':root}},module:{rules:[{test:/\.tsx?$/,use:path.join(out,'loader.cjs')},{test:/\.css$/,use:path.join(out,'css.cjs')}]}});
    compiler.run((error, stats) => compiler.close(() => error || stats.hasErrors() ? reject(error || new Error(stats.toString({all:false,errors:true}))) : resolve()));
  });
  const styles = await postcss([tailwind({base:root})]).process(fs.readFileSync(path.join(root,'app/globals.css'),'utf8'),{from:path.join(root,'app/globals.css')});
  file('styles.css', styles.css + '\n' + fs.readFileSync(path.join(root,'components/explore/workflow-creation.module.css'),'utf8').replace(/:global\(([^)]+)\)/g,'$1'));
}

async function main() {
  await compile();
  const server = http.createServer((request, response) => {
    const url = new URL(request.url, 'http://fixture');
    if (url.pathname === '/fixture') { response.setHeader('Content-Type','text/html');return response.end('<!doctype html><html class="dark"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>'); }
    if (['/bundle.js','/styles.css'].includes(url.pathname)) { response.setHeader('Content-Type',url.pathname.endsWith('.js')?'text/javascript':'text/css');return response.end(fs.readFileSync(path.join(out,url.pathname.slice(1)))); }
    if (url.pathname.startsWith('/api/media')) { assert.equal(request.headers.authorization,'Bearer fixture-owner');response.setHeader('Content-Type','application/json');const asset=(n)=>({id:'saved-'+n,collection:'image',status:'ready',sourceType:'upload',url:'/image/'+n,title:n===1?'saved-product.png':'saved-style.png',fileName:n===1?'saved-product.png':'saved-style.png',mimeType:'image/png',fileSizeBytes:128,projectId:'explore-reference'});return response.end(JSON.stringify(url.pathname==='/api/media'?{ok:true,assets:[asset(1),asset(2)]}:{ok:true,asset:asset(url.pathname.endsWith('saved-1')?1:2)}));}
    if (url.pathname.startsWith('/image/')) { response.setHeader('Content-Type','image/webp');return response.end(fs.readFileSync(path.join(root,'public/try-ugcpilot/posters',url.pathname.endsWith('/2')?'card-21.webp':'card-22.webp'))); }
    response.statusCode=404;response.end();
  });
  await new Promise(resolve => server.listen(process.env.REFERENCE_STACK_PORT ? Number(process.env.REFERENCE_STACK_PORT) : 0,'127.0.0.1',resolve));
  const url = `http://127.0.0.1:${server.address().port}/fixture`;
  if (process.env.REFERENCE_STACK_SERVE === '1') { console.log('Local reference stack preview: '+url);return; }
  let browser;
  try {
    browser = await playwright.chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
    const page = await browser.newPage({viewport:{width:1100,height:800}}), errors=[];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(url);
    const upload = page.getByLabel('Choose instruction reference images',{exact:true});
    const files = names => names.map(name => ({name,mimeType:'image/png',buffer:Buffer.from('fixture')}));
    assert.equal(await page.getByRole('group',{name:'Images attached to your instructions'}).count(),0);
    await upload.setInputFiles(files(['product.png','style.png']));
    const first = page.getByRole('button',{name:'Preview reference 1: product.png',exact:true}), second=page.getByRole('button',{name:'Preview reference 2: style.png',exact:true});
    await second.waitFor();
    const a = await first.boundingBox(), b = await second.boundingBox();
    assert.ok(b.x<a.x+a.width,'The images overlap as a card stack');
    const prompt = page.getByLabel('Your instructions',{exact:true});
    assert.ok(Number(await prompt.evaluate(node=>parseFloat(getComputedStyle(node).paddingBottom)))>=72,'Writing stays above the attachments');
    await page.screenshot({path:path.join(out,'desktop-stack.png')});
    await first.hover({position:{x:5,y:20}});
    await page.getByAltText('Reference 1: product.png',{exact:true}).waitFor();
    const previewImage=page.getByAltText('Reference 1: product.png',{exact:true}),previewBounds=await previewImage.boundingBox();assert.ok(previewBounds.width<=160&&previewBounds.height<=200);assert.equal(await previewImage.evaluate(node=>node.parentElement.children.length),1,'The hover preview contains only the image');await page.screenshot({path:path.join(out,'desktop-hover.png')});
    await first.press('Escape');
    await page.mouse.move(900,50);await first.focus();await first.press('Tab');
    await page.getByAltText('Reference 2: style.png',{exact:true}).waitFor();
    await second.press('Escape');
    await page.getByAltText('Reference 2: style.png',{exact:true}).waitFor({state:'hidden'});
    await upload.setInputFiles(files(['extra.png','fail-image.png']));
    await page.getByRole('alert').waitFor();assert.equal(await page.getByRole('button',{name:/^Preview reference /}).count(),3,'Successful uploads survive a later failure');
    await page.getByRole('button',{name:'Dismiss image upload error',exact:true}).click();
    await page.getByRole('button',{name:'Add images to your instructions',exact:true}).click();
    const saved1=page.getByRole('button',{name:'Attach your image saved-product.png',exact:true}), saved2=page.getByRole('button',{name:'Attach your image saved-style.png',exact:true});
    await saved1.click();await saved2.click();await saved1.click();
    assert.equal(await saved1.getAttribute('aria-pressed'),'true');
    await page.getByRole('button',{name:'Done',exact:true}).click();assert.equal(await page.getByRole('button',{name:/^Preview reference /}).count(),5);
    await page.evaluate(()=>window.setReferenceLimit(5));
    await page.getByRole('button',{name:'Add images to your instructions',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Upload images',exact:true}).isDisabled(),true);await page.getByRole('button',{name:'Done',exact:true}).click();
    await page.setViewportSize({width:320,height:800});await page.evaluate(()=>{window.setReferenceLimit(14);window.seedReferences(14);});await page.getByLabel('14 images',{exact:true}).waitFor();const lastCard=await page.getByRole('button',{name:/^Preview reference 14:/}).boundingBox(),writeBox=await prompt.boundingBox();assert.ok(lastCard.x+lastCard.width<=writeBox.x+writeBox.width,'All fourteen cards stay inside the instructions box');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'The maximum stack fits a narrow phone');
    await page.emulateMedia({reducedMotion:'reduce'});assert.ok(parseFloat(await page.getByRole('button',{name:/^Preview reference 1:/}).evaluate(node=>getComputedStyle(node).transitionDuration))<=0.001);
    assert.deepEqual(errors,[]);
    const mobile = await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true}), phone=await mobile.newPage();
    phone.on('pageerror', error=>errors.push(error.message));await phone.goto(url);await phone.getByLabel('Choose instruction reference images',{exact:true}).setInputFiles(files(['product.png','style.png']));
    const phoneCard=phone.getByRole('button',{name:'Preview reference 2: style.png',exact:true});await phoneCard.tap();await phone.getByAltText('Reference 2: style.png',{exact:true}).waitFor();
    const popup=await phone.getByAltText('Reference 2: style.png',{exact:true}).boundingBox();assert.ok(popup.x>=0&&popup.x+popup.width<=390);
    await phone.screenshot({path:path.join(out,'mobile-preview.png')});
    await phone.getByLabel('Your instructions',{exact:true}).tap({position:{x:250,y:15}});await phone.getByAltText('Reference 2: style.png',{exact:true}).waitFor({state:'hidden'});await phone.getByRole('button',{name:'Add images to your instructions',exact:true}).tap();await phone.getByRole('button',{name:'Remove reference 2: style.png',exact:true}).tap();await phone.getByRole('button',{name:'Done',exact:true}).tap();await phone.getByText('1 image',{exact:true}).waitFor();assert.equal(await phone.getByRole('button',{name:/^Preview reference /}).count(),1);
    assert.deepEqual(errors,[]);
    console.log('PASS real composer and reference UI: multi-upload, card overlap, correct hover and keyboard preview, Escape, partial upload failure, multiple saved images, duplicate prevention, full limit, 320px layout, reduced motion, mobile tap and removal');
  } finally { if(browser)await browser.close();await new Promise(resolve=>server.close(resolve)); }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
