import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync,existsSync,mkdtempSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {execFileSync} from 'node:child_process';
const options={encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe'],timeout:30000};
const cli=['--import','./scripts/next-server-only-test-loader.mjs','--experimental-transform-types','--disable-warning=MODULE_TYPELESS_PACKAGE_JSON','scripts/prepare-reviewed-hook-t0-frames.mjs'];
function rejects(args,pattern){try{execFileSync(process.execPath,[...cli,...args],options);assert.fail('Unexpected acceptance');}catch(error){assert.match(String(error.stderr??error.message),pattern);}}
test('preparation command rejects implicit action, unknown flags and incomplete/private inventories before storage or decoding',()=>{
 rejects([],/Choose --prepare-local/);
 rejects(['--verify-local','--activate','true'],/Invalid preparation argument/);
 mkdirSync('.tmp',{recursive:true});const folder=mkdtempSync(resolve('.tmp/t0-preparation-negative-'));
 const input=join(folder,'sources.json');writeFileSync(input,JSON.stringify({items:[{referenceId:'creator-account-1-01',sourceSha256:'a'.repeat(64),sourceFile:'private.mp4'}]}));
 rejects(['--prepare-local','--sources',input,'--out',join(folder,'output')],/Source inventory must cover exactly/);
 const prepared=JSON.parse(readFileSync('docs/prompt-reviews/frame-and-private-package-preparation-2026-10-26.json','utf8')).publicFrames;
 const sourceRows=prepared.map(r=>({...r,sourceFile:'unread-video.mp4'}));
 sourceRows[0].referenceId='creator-account-1-01';writeFileSync(input,JSON.stringify({items:sourceRows}));
 rejects(['--prepare-local','--sources',input,'--out',join(folder,'output')],/Unknown, private, missing or changed source/);

});
test('prepared hosted receipt binds104 exact t0 objects and separates21 missing from83 existing',{skip:!existsSync('.tmp/hook-t0-prepared-20261026/hosted-receipt.json')&&'Hosted preparation receipt is local operational evidence, absent in public clones.'},()=>{
 const receipt=JSON.parse(readFileSync('.tmp/hook-t0-prepared-20261026/hosted-receipt.json','utf8'));
 assert.equal(receipt.allVerified,true);assert.equal(receipt.count,104);assert.equal(receipt.created,21);assert.equal(receipt.existing,83);
 assert.equal(receipt.privateUploads,0);assert.equal(receipt.credentialFilesWritten,0);
 assert.equal(new Set(receipt.rows.map(r=>r.referenceId)).size,104);
 for(const row of receipt.rows){assert.equal(row.frameIndex,0);assert.equal(row.frameTimeSeconds,0);assert.match(row.frameSha256,/^[a-f0-9]{64}$/);assert.ok(row.imageKey.includes(row.sourceSha256));assert.ok(row.imageKey.includes(row.frameSha256));assert.equal(row.referenceId.startsWith('creator-account-'),false);}
});
test('normal audit is source-bound and keeps structural and generated-output qualifications separate',()=>{
 const audit=JSON.parse(readFileSync('docs/prompt-reviews/normal-opening-prompt-audit-2026-10-26.json','utf8'));
 assert.equal(audit.publicCount,83);assert.equal(audit.privateCount,2);assert.equal(audit.rows.length,85);assert.equal(audit.providerCalls,0);
 assert.equal(audit.numericActionTimelines,0);assert.equal(audit.publicNeedsDecision,5);
 for(const row of audit.rows){assert.equal(row.sourceHashMatchesEvidence,true);assert.equal(row.visualQualification,'not_tested');assert.equal(row.compilations.length,4);assert.ok(row.compilations.every(c=>c.status==='compiles'));if(row.dataset==='public'){assert.equal(row.sourceHashMatchesRewrite,true);assert.equal(row.customTextPreserved,true);assert.equal(row.imagePromptHasLaterAnchorRole,false);}}
 const sourceReview=JSON.parse(readFileSync('docs/prompt-reviews/normal-opening-visual-findings-2026-10-26.json','utf8'));
 assert.equal(sourceReview.reviewedSources,11);assert.equal(sourceReview.contactSheets,46);assert.equal(sourceReview.nativeFramesAtSheetResolution,1148);
});
