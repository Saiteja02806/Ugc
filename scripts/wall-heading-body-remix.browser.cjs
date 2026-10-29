/* eslint-disable @typescript-eslint/no-require-imports -- Extend the existing isolated real-component fixture. */
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module');
const root = process.cwd(), filename = path.join(root, 'scripts/remix-text.browser.cjs');
let code = fs.readFileSync(filename, 'utf8');
function replace(before, after) { if (!code.includes(before)) throw Error('Base Remix fixture changed: '+before.slice(0,70)); code=code.replace(before,()=>after); }
replace("'.tmp/remix-text-browser'", "'.tmp/wall-layout-02/browser'");
replace("const refs=['hook'", "import catalog from '@/lib/explore/reference-text-catalog.json';import {initialWallHeadingBody,wallTextProfile} from '@/worker/src/lib/wall-initial-text-layout';\nconst wallSource=catalog.items.find(item=>item.referenceId==='explore-wall-text-04');\nconst refs=['hook'");
replace("??{...initial,format}),[slide", "??(target==='structured'?{...initial,format,text:null,textOverlays:initialWallHeadingBody('Saved heading','Saved body',wallTextProfile(wallSource.referenceId,wallSource.sourceSha256),8000,1)}:{...initial,format})),[slide");
replace("reference={linked?refs.find(r=>r.format===format):null}", "reference={linked?(target==='structured'?{...refs.find(r=>r.format===format),id:wallSource.referenceId}:refs.find(r=>r.format===format)):null}");
replace('const sourceFor = (referenceId,slideId) => (', 'const fallbackSourceFor = (referenceId,slideId) => (');
replace('async function main() {', "const wallSource=JSON.parse(fs.readFileSync(path.join(root,'lib/explore/reference-text-catalog.json'),'utf8')).items.find(item=>item.referenceId==='explore-wall-text-04');\nconst sourceFor=(id,slide)=>id===wallSource.referenceId?structuredClone(wallSource):fallbackSourceFor(id,slide);\nasync function main() {");
replace("output:source.format==='slideshow'?", "output:source.referenceId===wallSource.referenceId?{blocks:[],heading:'A structured heading',body:'First body paragraph.\\n\\nSecond body paragraph.'}:source.format==='slideshow'?");
replace('assert.deepEqual(errors,[]);', `
    mode='success';await change('Owner','owner-a');await change('Format','wall_text');await change('Target','structured');await open();
    const beforeStructured=await original(),beforePaid=paidCalls;
    await page.getByRole('button',{name:'Generate remix',exact:true}).click();
    await page.getByLabel('Remixed heading',{exact:true}).waitFor();
    assert.equal(await page.getByLabel('Remixed body',{exact:true}).getAttribute('maxlength'),'6000');
    assert.equal(await page.getByLabel('Remixed text',{exact:true}).count(),0);
    const apply=()=>page.getByRole('button',{name:'Apply to this clip',exact:true});
    await page.getByLabel('Remixed heading',{exact:true}).fill('');assert.equal(await apply().isDisabled(),true);
    await page.reload();await page.getByLabel('Remixed heading',{exact:true}).waitFor();assert.equal(await page.getByLabel('Remixed heading',{exact:true}).inputValue(),'');
    assert.equal(paidCalls,beforePaid+1,'Reload retains unfinished review without another generation');
    await page.getByLabel('Remixed heading',{exact:true}).fill('Reviewed heading');
    await page.getByLabel('Remixed body',{exact:true}).fill('x'.repeat(700));
    await page.reload();await page.getByLabel('Remixed body',{exact:true}).waitFor();assert.equal((await page.getByLabel('Remixed body',{exact:true}).inputValue()).length,700);
    const body='First body paragraph.\\n\\nA separately reviewed second paragraph.';
    await page.getByLabel('Remixed body',{exact:true}).fill(body);
    for(const width of [1100,390]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:path.join(out,'structured-review-'+width+'.png'),fullPage:true});}
    await apply().click();const structuredEdit=await original();
    assert.deepEqual(structuredEdit.textOverlays.map(layer=>layer.value),['Reviewed heading',body]);
    assert.deepEqual(structuredEdit.textOverlays.map(({value,...style})=>style),beforeStructured.textOverlays.map(({value,...style})=>style));
    assert.equal(structuredEdit.trimEndMs,beforeStructured.trimEndMs);assert.equal(structuredEdit.musicVolume,beforeStructured.musicVolume);
    await page.reload();await page.locator('[data-remix-trigger]').waitFor();assert.deepEqual(await original(),structuredEdit);
    await page.evaluate(source=>localStorage.setItem('ugc-explore:remix-request:v2:owner-a:wall_text:structured:'+source.referenceId+':null',JSON.stringify({version:1,requestKey:'00000000-0000-4000-8000-000000000004',referenceId:source.referenceId,slideId:null,format:'wall_text',instructions:'',outcome:'completed',source,reviewedDraft:{blocks:source.blocks.map(b=>b.text),heading:'',body:''}})),wallSource);
    await page.reload();await page.getByLabel('Remixed text',{exact:true}).waitFor();assert.equal(await page.getByLabel('Remixed heading',{exact:true}).count(),0);
    assert.equal(await page.getByLabel('Remixed text',{exact:true}).inputValue(),wallSource.blocks[0].text);
    await apply().click();assert.equal((await original()).textOverlays.length,2);assert.equal(paidCalls,beforePaid+1);
    console.log('PASS structured Wall: generate/review/empty validation/700-character reload/two paragraphs/style preservation/apply/reopen/legacy receipt; desktop1100/mobile390');
    assert.deepEqual(errors,[]);`);
const fixture = new Module(filename,module); fixture.filename=filename; fixture.paths=Module._nodeModulePaths(path.dirname(filename));fixture._compile(code,filename);
