import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import ffmpeg from 'ffmpeg-static';
import sharp from 'sharp';
import { trimHookFrames } from './trim-hook-reference-frames.mjs';
import { referenceVideoPrompts,REFERENCE_TEXT_REMOVAL } from '../lib/explore/reference-video-prompts.ts';

const root=path.resolve('outputs/hook-reference-audit-2026-10-19');
const existingAudit=process.argv.includes('--report-only')?JSON.parse(fs.readFileSync(path.join(root,'audit.json'),'utf8')):null;
const inventory=JSON.parse(fs.readFileSync(path.join(root,'inventory.json'),'utf8'));
const rows=['batch-001-033.json','batch-034-066.json','batch-067-098.json'].flatMap(f=>JSON.parse(fs.readFileSync(path.join(root,f),'utf8'))).sort((a,b)=>a.ordinal-b.ordinal);
if(rows.length!==98||new Set(rows.map(r=>r.id)).size!==98)throw Error('Missing or duplicate review');
const captions=JSON.parse(fs.readFileSync('lib/explore/reference-text-catalog.json','utf8'));
const revised=[];
const esc=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const rel=file=>path.relative(root,file).split(path.sep).map(encodeURIComponent).join('/');
const identity="If an influencer image is attached, replace the performer's facial identity with the person in that image. Keep the source hairstyle, clothing and accessories unless requested otherwise. Use the image for appearance and the video for performance.";
for(const row of rows){
 const item=inventory[row.ordinal-1],prompt=referenceVideoPrompts[row.id];
 if(row.id!==item.id||row.sourceSha256!==item.videoSha256||row.reviewedFrameCount!==item.frameCount||prompt.sourceSha256!==item.videoSha256)throw Error('Evidence identity mismatch');
 for(const file of row.sheetsInspected)if(!fs.existsSync(file))throw Error('Missing sheet evidence');
 if(row.status==='trim_boundary'){
  if(!row.proposedPerformance||row.keepStartFrame!==0||row.keepEndFrameExclusive<=0||row.keepEndFrameExclusive>=item.frameCount)throw Error('Unsafe trim proposal');
  const unwanted=Array.from({length:item.frameCount-row.keepEndFrameExclusive},(_,i)=>i+row.keepEndFrameExclusive);
  const flagged=row.unwantedRanges.flatMap(r=>Array.from({length:r.endFrame-r.startFrame+1},(_,i)=>r.startFrame+i));
  if(JSON.stringify(unwanted)!==JSON.stringify(flagged))throw Error('Trim would remove unflagged frames');
  const outputDirectory=path.join(root,'cleaned',String(row.ordinal).padStart(3,'0'));
  const previous=existingAudit?.items.find(r=>r.id===row.id)?.receipt;
  if(existingAudit&&!previous)throw Error('Report-only mode requires an existing verified derivative for every trim');
  if(previous&&(previous.sourceSha256!==row.sourceSha256||previous.keepStartFrame!==row.keepStartFrame||previous.keepEndFrameExclusive!==row.keepEndFrameExclusive||
    createHash('sha256').update(fs.readFileSync(item.sourcePath)).digest('hex')!==row.sourceSha256||createHash('sha256').update(fs.readFileSync(previous.outputPath)).digest('hex')!==previous.outputSha256))throw Error('Prior derivative verification changed');
  const receipt=previous??trimHookFrames({sourcePath:item.sourcePath,expectedSha256:item.videoSha256,keepStartFrame:row.keepStartFrame,keepEndFrameExclusive:row.keepEndFrameExclusive,outputDirectory,preserveNativeAudio:true});
  const originalText=captions.items.find(r=>r.referenceId===row.id&&r.slideId===null&&r.sourceSha256===item.videoSha256);
  if(!originalText||!['ready','no_text'].includes(originalText.status))throw Error('Caption source missing');
  const sourceStartMs=Math.round(receipt.sourceStartSeconds*1000),durationMs=Math.round(receipt.durationSeconds*1000);
  const blocks=originalText.blocks.map(b=>({...b,startMs:Math.max(0,b.startMs-sourceStartMs),endMs:Math.min(durationMs,b.endMs-sourceStartMs)})).filter(b=>b.endMs>b.startMs);
  const stagedText={...originalText,sourceSha256:receipt.outputSha256,blocks,status:blocks.length?'ready':'no_text',notes:`Scene-cleanup proposal 2026-10-19: kept decoded frames ${row.keepStartFrame}–${row.keepEndFrameExclusive-1}, removed unrelated tail; original text clipped to retained timing without rewriting wording. Original record and source preserved. Not activated.`};
  const generationPrompt=[identity,row.proposedPerformance,REFERENCE_TEXT_REMOVAL].join('\n\n');
  fs.writeFileSync(path.join(outputDirectory,'proposed-prompt.txt'),generationPrompt+'\n');
  fs.writeFileSync(path.join(outputDirectory,'proposed-remix-text.json'),JSON.stringify(stagedText,null,2)+'\n');
  // Full-size final retained and excluded frames, with equal-sized labelled tiles.
  const indexes=[Math.max(0,row.keepEndFrameExclusive-2),row.keepEndFrameExclusive-1,...unwanted];
  const layers=[];for(let c=0;c<indexes.length;c++){
   const n=indexes[c],left=c*180,label=n<row.keepEndFrameExclusive?'KEEP':'REMOVE';
   layers.push({input:Buffer.from(`<svg width="180" height="28"><rect width="180" height="28" fill="${label==='KEEP'?'#e8f4e9':'#fde9e7'}"/><text x="5" y="19" font-size="14">${label} · frame ${n}</text></svg>`),left,top:0});
   layers.push({input:fs.readFileSync(path.join(item.frameDirectory,`frame-${String(n).padStart(5,'0')}.png`)),left,top:28});
  }
  const boundary=path.join(outputDirectory,'boundary.jpg');await sharp({create:{width:indexes.length*180,height:348,channels:3,background:'white'}}).composite(layers).jpeg({quality:95}).toFile(boundary);
  const outputFrames=path.join(outputDirectory,'verified-final.jpg');
  execFileSync(ffmpeg,['-nostdin','-v','error','-y','-i',receipt.outputPath,'-vf',`select=eq(n\\,${receipt.retainedFrameCount-1})`,'-frames:v','1','-update','1',outputFrames],{windowsHide:true,timeout:120000});
  revised.push({...row,receipt,stagedText,proposedGenerationPrompt:generationPrompt,boundaryEvidence:boundary,verifiedFinalFrame:outputFrames,
    proposedStorageKey:`explore/paired-references/v1/${receipt.outputSha256}.mp4`,activation:'pending_review',audio:'deferred_by_user'});
  console.log(`Verified Hook ${row.ordinal}: ${item.frameCount} -> ${receipt.retainedFrameCount} frames; ${receipt.durationSeconds}s`);
 }else revised.push({...row,audio:'deferred_by_user'});
}
// The one context-dependent opening remains exactly as supplied until user review.
const manual=inventory[17],manualDir=path.join(root,'manual-review','018');fs.mkdirSync(manualDir,{recursive:true});
const original=fs.readFileSync(manual.sourcePath);if(createHash('sha256').update(original).digest('hex')!==manual.videoSha256)throw Error('Manual source changed');
const manualVideo=path.join(manualDir,'original.mp4');if(!fs.existsSync(manualVideo))fs.writeFileSync(manualVideo,original,{flag:'wx'});
const opening=[0,12,18,19,20,21,22,23,24,26,30,40],openingLayers=[];
for(let i=0;i<opening.length;i++){
 const n=opening[i],left=i%6*180,top=Math.floor(i/6)*348;
 openingLayers.push({input:Buffer.from(`<svg width="180" height="28"><rect width="180" height="28" fill="white"/><text x="6" y="20" font-size="15">Frame ${n}</text></svg>`),left,top});
 openingLayers.push({input:fs.readFileSync(path.join(manual.frameDirectory,`frame-${String(n).padStart(5,'0')}.png`)),left,top:top+28});
}
const manualSheet=path.join(manualDir,'opening-review.jpg');await sharp({create:{width:1080,height:696,channels:3,background:'white'}}).composite(openingLayers).jpeg({quality:95}).toFile(manualSheet);
const stats={references:rows.length,decodedFrames:rows.reduce((a,r)=>a+r.reviewedFrameCount,0),clean:rows.filter(r=>r.status==='clean').length,
 cleaned:revised.filter(r=>r.receipt).length,manualReview:rows.filter(r=>r.status==='needs_review').length,removedFrames:revised.filter(r=>r.receipt).reduce((a,r)=>a+r.receipt.originalFrameCount-r.receipt.retainedFrameCount,0),
 audio:'deferred_by_user',paidModelCalls:0,productionChanged:false,catalogueActivated:false};
const cleanup={version:1,date:'2026-10-19',stats,manualReview:{ordinal:18,videoPath:manualVideo,framesPath:manualSheet,decision:'pending_user'},items:revised};
fs.writeFileSync(path.join(root,'audit.json'),JSON.stringify(cleanup,null,2)+'\n');
const table=rows.map(r=>`<tr><td><a href="#hook-${r.ordinal}">${String(r.ordinal).padStart(2,'0')}</a></td><td>${r.reviewedFrameCount}</td><td>${esc(r.status==='clean'?'No unrelated cut':r.status==='trim_boundary'?'Cleaned copy ready':'Manual review')}</td><td>${esc(r.unwantedRanges.map(r=>r.startFrame===r.endFrame?r.startFrame:`${r.startFrame}–${r.endFrame}`).join(', '))}</td></tr>`).join('');
const sections=revised.filter(r=>r.status!=='clean').sort((a,b)=>Number(a.status==='needs_review')-Number(b.status==='needs_review')||a.ordinal-b.ordinal).map(r=>{
 const changed=r.receipt,manualCase=r.status==='needs_review';
 const video=changed?changed.outputPath:manualVideo;
 const title=manualCase?'Manual decision: airplane-window opening':'Cleaned performer-only reference';
 return `<section id="hook-${r.ordinal}"><h2>Hook ${String(r.ordinal).padStart(2,'0')} · ${title}</h2><p class="meta">${esc(r.id)}</p><p>${esc(r.sceneDescription)}</p><div class="review"><div><video controls muted playsinline preload="metadata" src="${rel(video)}"></video><p><a href="${rel(video)}" download>${manualCase?'Original video for your decision':'Download cleaned video'}</a></p></div><div>${changed?`<p>Removed frames ${esc(r.unwantedRanges.map(v=>`${v.startFrame}–${v.endFrame}`).join(', '))} (zero based). Kept ${changed.retainedFrameCount}/${changed.originalFrameCount} frames; verified retained pixels and relative frame timestamps. New duration ${changed.durationSeconds.toFixed(3)}s.</p><img src="${rel(r.boundaryEvidence)}" alt="Labelled keep/remove frame boundary"><p><a href="${rel(path.join(path.dirname(video),'proposed-prompt.txt'))}">Exact proposed prompt</a> · <a href="${rel(path.join(path.dirname(video),'proposed-remix-text.json'))}">Proposed caption timing</a></p>`:`<p>Original unchanged. This is a continuous pan from a window to the performer, rather than an inserted demo. Please guide whether to retain the reveal or begin with the influencer.</p><img src="${rel(manualSheet)}" alt="Labelled opening frames for manual review">`}</div></div>${changed?`<details><summary>Proposed performance paragraph</summary><pre>${esc(r.proposedPerformance)}</pre></details>`:''}<details><summary>Every original frame inspected</summary>${r.sheetsInspected.map(s=>`<img loading="lazy" src="${rel(s)}" alt="All original frames for Hook ${r.ordinal}">`).join('')}</details></section>`;
}).join('');
const html=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Hook reference scene audit</title><style>*{box-sizing:border-box}body{font:16px/1.6 system-ui;margin:36px auto;max-width:1200px;padding:0 24px;background:#f7f5f0;color:#222}h1{font-size:32px;line-height:1.15}h2{font-size:23px}.meta{font-size:13px;color:#555;overflow-wrap:anywhere}section{background:white;border:1px solid #ddd;border-radius:14px;padding:24px;margin:24px 0;scroll-margin-top:16px}video{width:100%;max-width:280px;max-height:500px;background:#111;border-radius:12px}img{max-width:100%;height:auto}.review{display:grid;grid-template-columns:290px 1fr;gap:24px}pre{font:14px/1.6 system-ui;white-space:pre-wrap}a{color:#205c42}table{width:100%;border-collapse:collapse;background:white}th,td{text-align:left;padding:9px 12px;border-bottom:1px solid #ddd}.scroll{max-height:500px;overflow:auto}summary{cursor:pointer;padding:8px 0}button{font:inherit;padding:8px 14px;border:1px solid #ccc;border-radius:8px;background:white}button[aria-pressed=true]{background:#214e3b;color:white}@media(max-width:700px){body{padding:0 12px}.review{grid-template-columns:1fr}section{padding:16px}h1{font-size:27px}}</style><h1>Hook references: complete scene audit</h1><p>19 October 2026 · ${stats.references} references · ${stats.decodedFrames.toLocaleString()} decoded frames · Three audit agents</p><p><strong>${stats.clean} without unrelated scene cuts · ${stats.cleaned} cleaned copies ready · ${stats.manualReview} manual decision</strong></p><p>Audio review was skipped at your request. No paid model calls, uploads, deployments or catalogue activation. Originals, soundtracks and current production references remain unchanged. Source audio state is preserved: silent sources stay silent; native audio packets are copied without re-encoding or listening. Paired music has not been removed or reassessed.</p><p>All original frames were inspected in labelled sheets, then flagged boundaries were reopened at full tile size. ${stats.removedFrames} unrelated end frames were removed from the clear cases. Each derivative passed decoded-pixel equality and relative-timestamp checks. This is a local source audit and derivative verification, not generated-output or deployed workflow acceptance.</p><p><a href="#hook-18">Review the uncertain airplane opening</a> · <a href="audit.json">Full audit and proposed activation inputs</a></p><div class="scroll"><table><thead><tr><th>Hook</th><th>Frames</th><th>Result</th><th>Removed frames</th></tr></thead><tbody>${table}</tbody></table></div>${sections}<section><h2>What remains before rollout</h2><p>Resolve Hook 18, then release cleaned content-addressed media together with matching preview, duration, prompt and caption source hash/timing. Preserve historical source identities and receipts. These staged copies are not wired into the live catalogue; an existing reference can still send its original screen tail until that rollout is completed.</p></section></html>`;
fs.writeFileSync(path.join(root,'review.html'),html);
const summary=`# Hook reference scene audit — 19 October 2026\n\nThree agents visually inspected all ${stats.decodedFrames} decoded frames across ${stats.references} active Hook references.\n\n- ${stats.clean} have no unrelated scene cut.\n- ${stats.cleaned} cleaned derivatives prepared; ${stats.removedFrames} unwanted tail frames removed.\n- Hook 18's continuous airplane-window reveal remains unchanged for the user's manual decision.\n- Audio deferred by user; no paid model calls or external processing.\n- Originals, soundtrack files, active catalogue and production unchanged.\n\nOpen review.html for cleaned videos, labelled cut boundaries, all-frame sheets and exact proposed prompts. audit.json contains source hashes, complete evidence and staged text-timing proposals. All retained decoded pixels and relative timestamps match their source; source sample duration defines each cleaned duration, not assumed frame rate.\n\n| Hook | Remove frames (zero based) | Keep frames | Cleaned duration |\n| --- | --- | --- | --- |\n${revised.filter(r=>r.receipt).map(r=>`| ${r.ordinal} | ${r.unwantedRanges.map(v=>v.startFrame===v.endFrame?v.startFrame:`${v.startFrame}–${v.endFrame}`).join(', ')} | ${r.keepStartFrame}–${r.keepEndFrameExclusive-1} | ${r.receipt.durationSeconds.toFixed(3)}s |`).join('\n')}\n\nThe proposed prompt paragraphs remove requests to reproduce discarded scenes. Original on-screen captions remain baked into source pixels; existing generation text-removal instructions remain. Caption text proposals clip/drop blocks outside retained footage and bind to new media hashes. These proposals are not activated. No local or production generated-output quality acceptance is claimed.\n`;
fs.writeFileSync(path.join(root,'README.md'),summary);
console.log(JSON.stringify(stats));
