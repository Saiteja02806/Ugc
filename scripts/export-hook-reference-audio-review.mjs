import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import ffmpeg from 'ffmpeg-static';
import ffprobe from 'ffprobe-static';
const auditRoot=path.resolve('outputs/hook-reference-audit-2026-10-19');
const root=path.resolve('outputs/Hook Reference Audio Review');
const inventory=JSON.parse(fs.readFileSync(path.join(auditRoot,'inventory.json'),'utf8'));
const audit=JSON.parse(fs.readFileSync(path.join(auditRoot,'audit.json'),'utf8'));
const labels=JSON.parse(fs.readFileSync('scripts/data/hook-reference-audio-review-labels.json','utf8'));
const rejected=JSON.parse(fs.readFileSync('scripts/data/hook-reference-rejected-background-audio.json','utf8')).items;
if(labels.length!==inventory.length||labels.length!==98||new Set(labels).size!==98)throw Error('Missing or ambiguous labels');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const run=(binary,args)=>execFileSync(binary,args,{encoding:'utf8',windowsHide:true,timeout:120000,maxBuffer:32*1024**2});
const writeImmutable=(file,bytes)=>{
 const value=Buffer.isBuffer(bytes)?bytes:Buffer.from(bytes);
 if(fs.existsSync(file)){if(sha(fs.readFileSync(file))!==sha(value))throw Error('Existing file differs; preserve it: '+file);return;}
 fs.writeFileSync(file,value,{flag:'wx'});
};
const writeGenerated=(file,text)=>{
 if(fs.existsSync(file)&&fs.readFileSync(file,'utf8')!==text){
  const old=fs.readFileSync(file),history=path.join(auditRoot,'audio-review-metadata-history');fs.mkdirSync(history,{recursive:true});
  const backup=path.join(history,sha(old)+'-'+path.basename(file));if(!fs.existsSync(backup))fs.writeFileSync(backup,old,{flag:'wx'});
 }
 fs.writeFileSync(file,text);
};
const packetHashes=(file,selector)=>JSON.parse(run(ffprobe.path,['-v','error','-select_streams',selector,'-show_packets','-show_data_hash','sha256','-show_entries','packet=data_hash','-of','json',file])).packets.map(p=>p.data_hash);
const esc=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const rel=file=>path.relative(root,file).split(path.sep).map(encodeURIComponent).join('/');
fs.mkdirSync(root,{recursive:true});
const items=[];
for(const [index,item]of inventory.entries()){
 const number=String(item.ordinal).padStart(3,'0'),label=labels[index];
 if(!/^[\w -]+$/.test(label))throw Error('Unsafe folder label');
 const folderName=`Hook ${number} - ${label}`,folder=path.join(root,folderName);fs.mkdirSync(folder,{recursive:true});
 const rejection=rejected.find(r=>r.referenceId===item.id);
 if(rejection&&(rejection.ordinal!==item.ordinal||rejection.audioSha256!==item.audioSha256))throw Error('Rejected-track identity mismatch');
 const bytes=fs.readFileSync(item.audioPath);if(sha(bytes)!==item.audioSha256)throw Error('Original paired audio checksum changed');
 const backgroundFile=path.join(folder,`Hook ${number} - Background.mp3`);
 if(rejection){if(fs.existsSync(backgroundFile))throw Error('Explicit rejected-track removal must run before export');}
 else writeImmutable(backgroundFile,bytes);
 const originalVideo=fs.readFileSync(item.sourcePath);if(sha(originalVideo)!==item.videoSha256)throw Error('Original video checksum changed');
 const info=JSON.parse(run(ffprobe.path,['-v','error','-show_streams','-show_entries','stream=codec_type,codec_name,start_time,duration','-of','json',item.sourcePath]));
 const nativeStreams=info.streams.filter(s=>s.codec_type==='audio'),native=[];
 for(const [audioIndex,stream]of nativeStreams.entries()){
  const extension={aac:'m4a',mp3:'mp3',opus:'ogg',vorbis:'ogg',pcm_s16le:'wav',pcm_s24le:'wav'}[stream.codec_name]??'mka';
  const file=path.join(folder,`Hook ${number} - Native video audio${nativeStreams.length>1?' '+(audioIndex+1):''}.${extension}`);
  const expected=packetHashes(item.sourcePath,`a:${audioIndex}`);
  if(!fs.existsSync(file))run(ffmpeg,['-nostdin','-v','error','-n','-protocol_whitelist','file,pipe','-i',item.sourcePath,'-map',`0:a:${audioIndex}`,'-vn','-c:a','copy',file]);
  const actual=packetHashes(file,'a:0');
  if(JSON.stringify(actual)!==JSON.stringify(expected))throw Error('Native audio packet payload changed: '+item.ordinal);
  native.push({file:path.basename(file),relativePath:rel(file),codec:stream.codec_name,sourceStartSeconds:Number(stream.start_time??0),durationSeconds:Number(stream.duration??0),packetPayloadsUnchanged:true,sha256:sha(fs.readFileSync(file))});
 }
 // Poster is an existing original-source frame. No generated interpretation.
 const previewFile=path.join(folder,`Hook ${number} - Reference.png`);
 const previewIndex=item.ordinal===18?30:0;
 writeImmutable(previewFile,fs.readFileSync(path.join(item.frameDirectory,`frame-${String(previewIndex).padStart(5,'0')}.png`)));
 const row=audit.items[index];
 const mapping={hookNumber:item.ordinal,folderName,description:label,referenceId:item.id,originalImportFolder:item.sourceFolder,
  originalReferenceTitle:item.title,sourceUrl:item.sourceUrl??item.instagramUrl??null,
  originalVideoSha256:item.videoSha256,videoDecision:item.ordinal===18?'keep_original_user_approved':row.receipt?'trim_approved_cleaned_copy_ready':'keep_original_no_unrelated_cut',
  cleanedVideoSha256:row.receipt?.outputSha256??null,
  backgroundAudio:rejection?null:{file:path.basename(backgroundFile),relativePath:rel(backgroundFile),originalFilename:item.audioTitle,sha256:item.audioSha256,durationSeconds:item.audioDurationSeconds,byteIdenticalToOriginal:true},
  ...(rejection?{removedBackgroundAudio:{originalFilename:item.audioTitle,sha256:item.audioSha256,reason:'User rejected incomplete background track',removed:true}}:{}),
  nativeVideoAudio:native,previewFrame:previewIndex,previewPath:rel(previewFile),
  audioReviewStatus:rejection?'background_rejected_by_user':'not_analyzed_manual_user_review',note:rejection?'Background track removed at your request. Reference video retained.':null};
 if(rejection)writeGenerated(path.join(folder,'mapping.json'),JSON.stringify(mapping,null,2)+'\n');
 else writeImmutable(path.join(folder,'mapping.json'),JSON.stringify(mapping,null,2)+'\n');
 const notes=`Hook ${number} — ${label}\n\nReference ID: ${item.id}\nOriginal import folder: ${item.sourceFolder}\nOriginal background filename: ${item.audioTitle}\n\nListen to Background for the complete paired track (${item.audioDurationSeconds.toFixed(2)} seconds).${native.length?' Native video audio contains the original clip sound, extracted without re-encoding.':' This original video has no embedded audio stream.'}\n\nYour review: [ ] Keep background music  [ ] Spoken commentary present  [ ] Unsure\nNative clip audio (if present): ____________________\nNotes / spoken words / timestamp: ____________________\n\nThese files have not been listened to or classified by an AI. Music is acceptable; flag spoken commentary according to your preference.\n`;
 const notesPath=path.join(folder,'REVIEW-NOTES.txt');if(!fs.existsSync(notesPath))fs.writeFileSync(notesPath,notes,{flag:'wx'});
 items.push(mapping);
 if((index+1)%10===0)console.log(`Copied and verified ${index+1}/98 reference audio folders`);
}
const stats={references:items.length,backgroundTracks:items.filter(r=>r.backgroundAudio).length,removedBackgroundTracks:rejected.length,nativeAudioTracks:items.reduce((sum,r)=>sum+r.nativeVideoAudio.length,0),backgroundMinutes:items.reduce((sum,r)=>sum+(r.backgroundAudio?.durationSeconds??0)/60,0),paidModelCalls:0,contentAnalysisPerformed:false};
writeGenerated(path.join(root,'AUDIO-MAP.json'),JSON.stringify({version:2,date:'2026-10-19',stats,items},null,2)+'\n');
const sections=items.map(r=>`<section id="hook-${r.hookNumber}"><img loading="lazy" src="${r.previewPath}" alt="Original source frame for Hook ${r.hookNumber}"><div><h2>${esc(r.folderName)}</h2><p class="meta">Original folder: ${esc(r.originalImportFolder)} · Original track: ${esc(r.backgroundAudio?.originalFilename??r.removedBackgroundAudio?.originalFilename)}</p>${r.backgroundAudio?`<p><strong>Paired background track · ${(r.backgroundAudio.durationSeconds/60).toFixed(2)} min</strong></p><audio controls preload="none" src="${r.backgroundAudio.relativePath}"></audio><p><a download href="${r.backgroundAudio.relativePath}">Download background audio</a></p>`:'<p><strong>Background track deleted: incomplete audio rejected by you.</strong></p>'}<p><a href="${encodeURIComponent(r.folderName)}/mapping.json">Reference mapping</a> · <a href="${encodeURIComponent(r.folderName)}/REVIEW-NOTES.txt">Review notes</a></p>${r.nativeVideoAudio.map(n=>`<p><strong>Native sound from original video · ${n.durationSeconds.toFixed(2)} sec</strong></p><audio controls preload="none" src="${n.relativePath}"></audio>`).join('')||'<p class="meta">Original video has no embedded audio.</p>'}${r.note?`<p class="meta">${esc(r.note)}</p>`:''}<p class="meta">${esc(r.referenceId)}${r.sourceUrl?` · <a href="${esc(r.sourceUrl)}" target="_blank" rel="noreferrer">Original source post</a>`:''}</p></div></section>`).join('');
const html=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Hook Reference Audio Review</title><style>*{box-sizing:border-box}body{font:16px/1.5 system-ui;color:#222;background:#f7f5f0;max-width:1100px;margin:32px auto;padding:0 20px}h1{font-size:30px}h2{font-size:19px;margin:0}section{display:grid;grid-template-columns:120px 1fr;gap:20px;background:white;border:1px solid #ddd;border-radius:12px;padding:18px;margin:18px 0;scroll-margin-top:12px}section>img{width:120px;border-radius:8px}.meta{font-size:13px;color:#555;overflow-wrap:anywhere}audio{width:min(100%,600px)}a{color:#205d45}input{font:inherit;padding:10px 12px;border:1px solid #bbb;border-radius:8px;width:100%}nav{display:flex;gap:9px;flex-wrap:wrap;margin:18px 0}nav a{padding:4px 8px;background:white;border:1px solid #ddd;border-radius:6px}@media(max-width:600px){section{grid-template-columns:70px 1fr;gap:12px;padding:12px}section>img{width:70px}body{padding:0 10px}h2{font-size:16px}}</style><h1>Hook Reference Audio Review</h1><p>${stats.backgroundTracks} full background tracks · ${stats.nativeAudioTracks} native clip-audio tracks · 98 named reference folders</p><p>Music is acceptable. Listen for unwanted spoken commentary. Every original background MP3 is copied byte-for-byte; native clip audio is extracted without re-encoding. No audio content analysis or paid model calls were performed. Hook 18's video remains unchanged.</p><p>Each folder name contains the permanent Hook number and a visual description. Its mapping file also records the original import folder, filename, source link and permanent reference ID.</p><label for="find">Find a Hook number, scene, original folder or audio filename</label><input id="find" type="search" placeholder="Example: 003, pillow, ReelAudio-77704"><nav>${items.map(r=>`<a href="#hook-${r.hookNumber}">${String(r.hookNumber).padStart(3,'0')}</a>`).join('')}</nav>${sections}<script>document.querySelector('#find').addEventListener('input',e=>{const q=e.target.value.toLowerCase().trim();for(const s of document.querySelectorAll('section'))s.hidden=!s.textContent.toLowerCase().includes(q)&&!s.id.endsWith('-'+Number(q));});document.addEventListener('play',e=>{if(e.target.tagName==='AUDIO')for(const a of document.querySelectorAll('audio'))if(a!==e.target)a.pause();},true);</script></html>`;
writeGenerated(path.join(root,'index.html'),html);
writeGenerated(path.join(root,'START-HERE.txt'),`Hook Reference Audio Review\n\nOpen index.html for thumbnails, names and audio players.\n\n${stats.backgroundTracks} background MP3s remain, plus ${stats.nativeAudioTracks} native clip-audio tracks. Background tracks for Hooks3,13,59 were deleted by request; videos/folders remain.\n\nEach folder name maps to its Hook number, scene, original import folder and permanent reference ID in mapping.json. Native audio is sound extracted from the original MP4, kept separately only for your review. REVIEW-NOTES.txt is editable and preserved.\n\nAll other audio files are unchanged. No paid model or audio-content analysis was performed. Hook18 stays unchanged. Production soundtrack deployment is tracked separately.\n`);
console.log(JSON.stringify({root,stats},null,2));
