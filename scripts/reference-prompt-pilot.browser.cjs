/* eslint-disable @typescript-eslint/no-require-imports */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const out=path.resolve('.tmp/reference-prompt-pilot');
async function main(){
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const page=await browser.newPage({viewport:{width:1366,height:768}});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:4173/e2e/explore-format-preview?format=hook&sources=1',{waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:'Recreate Hook 01',exact:true}).click({timeout:60000});
  const reference=page.getByRole('textbox',{name:'Reference instructions',exact:true});
  await reference.waitFor();
  assert.match(await reference.inputValue(),/pink keyboard/);
  assert.match(await reference.inputValue(),/Remove all existing on-screen text/);
  const personal=page.getByRole('textbox',{name:'Video prompt',exact:true});
  await personal.fill('Keep my own additional instructions.');
  await reference.fill('Edited reference performance. Remove the text.');
  await page.getByRole('button',{name:'Remove prompt',exact:true}).click();
  await reference.waitFor({state:'detached'});
  assert.equal(await personal.inputValue(),'Keep my own additional instructions.');
  assert.equal(await page.getByRole('button',{name:'Remove gallery video reference',exact:true}).count()>0,true);
  await page.getByRole('button',{name:'Restore prompt',exact:true}).click();
  assert.match(await reference.inputValue(),/pink keyboard/);
  await page.getByRole('button',{name:'Recreate Hook 02',exact:true}).click();
  assert.match(await reference.inputValue(),/glasses/);
  assert.equal(await personal.inputValue(),'Keep my own additional instructions.');
  await page.getByText('ⓘ About this prompt',{exact:true}).click();
  await reference.scrollIntoViewIfNeeded();
  await page.screenshot({path:path.join(out,'desktop.png')});
  await page.setViewportSize({width:390,height:844});
  await reference.scrollIntoViewIfNeeded();
  const bounds=await reference.boundingBox();
  assert.ok(bounds.x>=0&&bounds.x+bounds.width<=391,'Prompt fits mobile width');
  await page.screenshot({path:path.join(out,'mobile.png')});
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,'browser-verification.json'),JSON.stringify({desktop:'1366x768',mobile:'390x844',selection:true,editing:true,removalKeepsVideo:true,restore:true,switchPreservesUserText:true,info:true,noPageErrors:true,scope:'local read-only preview; no generation or production acceptance'},null,2));
  console.log('PASS reference selection, visible prompt, editing, removal, restore, reference switching, preserved user text, info and mobile bounds.');
 }finally{await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
