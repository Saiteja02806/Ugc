import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const root=fs.realpathSync('outputs/Hook Reference Audio Review');
const map=JSON.parse(fs.readFileSync(path.join(root,'AUDIO-MAP.json')));
const rejected=JSON.parse(fs.readFileSync('scripts/data/hook-reference-rejected-background-audio.json')).items;
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const removals=[];
for(const decision of rejected){
 const item=map.items.find(r=>r.hookNumber===decision.ordinal&&r.referenceId===decision.referenceId);
 if(!item)throw Error('Reference mapping missing');
 const file=path.resolve(root,item.folderName,`Hook ${String(decision.ordinal).padStart(3,'0')} - Background.mp3`),relative=path.relative(root,file);
 if(relative.startsWith('..')||path.isAbsolute(relative)||!file.endsWith(' - Background.mp3'))throw Error('Unsafe deletion target');
 if(fs.existsSync(file)&&(fs.realpathSync(file)!==file||sha(file)!==decision.audioSha256))throw Error('Rejected audio identity mismatch');
 removals.push({hook:decision.ordinal,referenceId:decision.referenceId,file,sha256:decision.audioSha256});
}
const untouched=map.items.flatMap(item=>[...(item.backgroundAudio&&!rejected.some(r=>r.ordinal===item.hookNumber)?[item.backgroundAudio]:[]),...item.nativeVideoAudio].map(audio=>({file:path.join(root,item.folderName,audio.file),sha256:audio.sha256})));
for(const item of untouched)if(sha(item.file)!==item.sha256)throw Error('Other audio changed before operation');
if(!process.argv.includes('--apply')){console.log(JSON.stringify({deleteOnly:removals,preserveAudioFiles:untouched.length}));process.exit(0);}
for(const item of removals)if(fs.existsSync(item.file))fs.unlinkSync(item.file);
for(const item of untouched)if(sha(item.file)!==item.sha256)throw Error('Other audio changed after operation');
const result={deletedBackgroundTracks:removals,otherAudioFilesVerifiedUnchanged:untouched.length,sourceImportFilesDeleted:false,productionBlobFilesDeleted:false};
fs.writeFileSync('outputs/hook-reference-audit-2026-10-19/rejected-background-removal.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({deletedHooks:removals.map(r=>r.hook),otherAudioFilesVerifiedUnchanged:untouched.length}));
