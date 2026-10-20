import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {renameWithRetrySync} from './reference-text-atomic-write.mjs';
const root=path.resolve('outputs/hook-reference-audit-2026-10-19');
const planPath=path.join(root,'original-replacement-plan.json'),plan=JSON.parse(fs.readFileSync(planPath));
const audit=JSON.parse(fs.readFileSync(path.join(root,'audit.json'))),verification=JSON.parse(fs.readFileSync(path.join(root,'reverification.json')));
const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const within=(parent,child)=>{const r=path.relative(parent,child);return r&&!r.startsWith('..')&&!path.isAbsolute(r);};
const approved=[1,2,3,4,6,7,20,30,39,40,42,43,53,54,71,78,88,89];
const allowedRoots=['D:/hook/videos (10)/New folder/HOOKS','D:/hookswithlinks','D:/hookswithlinks/new batch'].map(p=>fs.realpathSync(p));
if(plan.replacements.length!==18||JSON.stringify(plan.replacements.map(r=>r.ordinal).sort((a,b)=>a-b))!==JSON.stringify(approved))throw Error('Unexpected replacement scope');
if(!plan.protectedHook18||hash(plan.protectedHook18.path)!==plan.protectedHook18.sha256)throw Error('Hook18 protection failed');
for(const item of plan.replacements){
 const row=audit.items.find(r=>r.id===item.id&&r.ordinal===item.ordinal),checked=verification.checks.find(r=>r.id===item.id&&r.outputSha256===item.correctedSha256);
 if(!row?.receipt||row.approval!=='approved_by_user'||!checked||row.sourceSha256!==item.originalSha256||row.receipt.outputSha256!==item.correctedSha256)throw Error('Review binding failed');
 const actual=fs.realpathSync(item.targetPath),corrected=fs.realpathSync(item.correctedPath),sourceRoot=fs.realpathSync(item.sourceRoot);
 if(actual!==item.targetPath||!allowedRoots.includes(sourceRoot)||!within(sourceRoot,actual)||!actual.toLowerCase().endsWith('.mp4'))throw Error('Unsafe original target');
 if(corrected!==row.receipt.outputPath||!within(path.join(root,'cleaned',String(item.ordinal).padStart(3,'0')),corrected))throw Error('Unexpected corrected file');
 if(!within(path.join(root,'original-import-backups'),path.resolve(item.backupPath)))throw Error('Unsafe backup target');
 const current=hash(actual);if(current!==item.originalSha256&&current!==item.correctedSha256)throw Error('Original import changed since planning');
 if(hash(corrected)!==item.correctedSha256)throw Error('Corrected output changed since verification');
 for(const sibling of item.siblings){if(path.basename(sibling.file)!==sibling.file||hash(path.join(path.dirname(actual),sibling.file))!==sibling.sha256)throw Error('Sibling audio/text changed since planning');}
 if(fs.existsSync(item.backupPath)&&hash(item.backupPath)!==item.originalSha256)throw Error('Existing backup changed');
 if(current===item.correctedSha256&&!fs.existsSync(item.backupPath))throw Error('Missing original backup on resumed replacement');
}
// Prepare every backup before allowing a single original to be replaced.
for(const item of plan.replacements){
 fs.mkdirSync(path.dirname(item.backupPath),{recursive:true});
 if(!fs.existsSync(item.backupPath))fs.copyFileSync(item.targetPath,item.backupPath,fs.constants.COPYFILE_EXCL);
 if(hash(item.backupPath)!==item.originalSha256)throw Error('Original backup verification failed');
}
const backupManifest=path.join(root,'original-import-backups','BACKUP-MAP.json');
if(!fs.existsSync(backupManifest))fs.writeFileSync(backupManifest,JSON.stringify(plan,null,2)+'\n',{flag:'wx'});
if(!process.argv.includes('--apply')){console.log(JSON.stringify({backupsVerified:18,originalsChanged:false,readyToApply:true}));process.exit(0);}
const receipt={version:1,startedAt:new Date().toISOString(),planSha256:hash(planPath),replacements:[],finished:false,productionCatalogueChanged:false,audioContentAnalyzed:false};
const receiptPath=path.join(root,'original-replacement-receipt.json');
try{
 for(const item of plan.replacements){
  const current=hash(item.targetPath);
  if(current!==item.correctedSha256){
   if(current!==item.originalSha256)throw Error('Target changed during replacement; stop');
   const pending=path.join(path.dirname(item.targetPath),`.${path.basename(item.targetPath)}.ugc-trim-${process.pid}.pending`);
   fs.copyFileSync(item.correctedPath,pending,fs.constants.COPYFILE_EXCL);
   if(hash(pending)!==item.correctedSha256||hash(item.targetPath)!==item.originalSha256)throw Error('Staged replacement validation failed');
   renameWithRetrySync(pending,item.targetPath);
  }
  if(hash(item.targetPath)!==item.correctedSha256||hash(item.backupPath)!==item.originalSha256)throw Error('Replacement readback failed');
  for(const sibling of item.siblings)if(hash(path.join(path.dirname(item.targetPath),sibling.file))!==sibling.sha256)throw Error('Sibling changed after replacement');
  receipt.replacements.push({ordinal:item.ordinal,id:item.id,targetPath:item.targetPath,backupPath:item.backupPath,originalSha256:item.originalSha256,correctedSha256:item.correctedSha256,filenameRetained:true,backupVerified:true,installedHashVerified:true,siblingFilesUnchanged:true});
  fs.writeFileSync(receiptPath,JSON.stringify(receipt,null,2)+'\n');
  console.log(`Replaced and read back Hook ${item.ordinal}: ${item.targetPath}`);
 }
 if(hash(plan.protectedHook18.path)!==plan.protectedHook18.sha256)throw Error('Hook18 changed during replacement');
 receipt.hook18Unchanged=true;receipt.finished=true;receipt.completedAt=new Date().toISOString();
}catch(error){receipt.error=error.message;throw error;}
finally{fs.writeFileSync(receiptPath,JSON.stringify(receipt,null,2)+'\n');}
console.log(JSON.stringify({replaced:receipt.replacements.length,backupsVerified:18,filenamesRetained:true,siblingFilesUnchanged:true,receiptPath}));
