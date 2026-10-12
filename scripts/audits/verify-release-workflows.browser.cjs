/* eslint-disable @typescript-eslint/no-require-imports -- Standalone real-component browser acceptance fixture. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
(async()=>{
  const browser=await chromium.launch({headless:true,channel:'msedge'});
  const page=await browser.newPage(); const errors=[],writes=[],results=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/**',async r=>{if(r.request().method()!=='GET'){writes.push(r.request().url());await r.abort();}else await r.continue();});
  fs.mkdirSync('.tmp/release-2026-10-12/current-screen-results',{recursive:true});
  try {
    for(const [width,height] of [[1280,720],[1366,768],[1440,900],[1536,864],[1920,1080],[1024,640],[390,844]]){
      await page.setViewportSize({width,height});
      for(const [name,query] of [['talking-head','legacy=hook'],['hook','format=hook&sources=1'],['wall_text','format=wall_text&sources=1'],['slideshow','format=slideshow']]){
        await page.goto((process.env.EXPLORE_PREVIEW_BASE_URL||'http://127.0.0.1:4317')+'/e2e/explore-format-preview?'+query,{waitUntil:'domcontentloaded'});
        const tabs=page.getByRole('tablist',{name:'Workflow sections',exact:true});await tabs.waitFor();
        assert.equal(await tabs.getByRole('tab').count(),3);
        const instructions=name==='talking-head'?page.locator('textarea[name="hookInstructions"]'):page.locator('form[data-layout="workflow"] textarea').first();
        const draft='Release verification: keep this instruction exactly.';
        await instructions.fill(draft);
        await tabs.getByRole('tab',{name:/^Edit/}).click();
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,name+' Edit overflow '+width);
        await tabs.getByRole('tab',{name:'Schedule',exact:true}).click();
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,name+' Schedule overflow '+width);
        await tabs.getByRole('tab',{name:'Create',exact:true}).click();
        assert.equal(await instructions.inputValue(),draft,name+' draft preserved '+width);
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,name+' Create overflow '+width);
        for(const tab of await tabs.getByRole('tab').all()){const b=await tab.boundingBox();assert.ok(b && b.height>=40&&b.width>=40,name+' accessible stage target');}
        if(width===1366||width===390)await page.screenshot({path:'.tmp/release-2026-10-12/current-screen-results/'+name+'-'+width+'.png',fullPage:true,animations:'disabled'});
        results.push({name,width,height});console.log('PASS '+name+' '+width+'x'+height+': Create/Edit/Schedule, drafts, accessible controls, overflow');
      }
    }
    assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);
    fs.writeFileSync('.tmp/release-2026-10-12/current-screen-results/results.json',JSON.stringify({results,errors,writes},null,2));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
