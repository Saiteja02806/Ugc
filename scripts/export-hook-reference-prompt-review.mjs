import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { getReferenceVideoPrompt, referenceVideoPrompts } from '../lib/explore/reference-video-prompts.ts';

const delivery=path.resolve(process.argv[2]??'.tmp/hook-reference-prompt-review/export');
fs.mkdirSync(delivery,{recursive:true});
const inventory=JSON.parse(fs.readFileSync('.tmp/reference-prompt-pilot/inventory.json','utf8'));
const textCatalog=JSON.parse(fs.readFileSync('lib/explore/reference-text-catalog.json','utf8'));
const escaped=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const rows=[];
for(const item of inventory){
 const entry=referenceVideoPrompts[item.id];
 if(!entry||entry.reviewMethod!=='all_decoded_frames')continue;
 const directory=path.resolve('.tmp/hook-reference-prompt-review',item.id);
 const inspectionPath=path.join(directory,'inspection.json');
 const inspected=JSON.parse(fs.readFileSync(inspectionPath,'utf8'));
 if(inspected.sourceSha256!==entry.sourceSha256||inspected.decodedFrames!==entry.reviewedFrameCount)throw Error('Review evidence differs: '+item.id);
 if(createHash('sha256').update(fs.readFileSync(inspected.source)).digest('hex')!==entry.sourceSha256)throw Error('Source changed.');
 const prompt=getReferenceVideoPrompt(item.id,item.videoUrl);
 if(!prompt)throw Error('Reference prompt is unavailable.');
 const folder=path.join(delivery,item.id);
 fs.mkdirSync(folder,{recursive:true});
 fs.copyFileSync(inspected.source,path.join(folder,'source.mp4'));
 fs.writeFileSync(path.join(folder,'prompt.txt'),prompt);
 const remix=textCatalog.items.find(record=>record.referenceId===item.id&&record.slideId===null&&record.sourceSha256===entry.sourceSha256);
 if(!remix||!['ready','no_text'].includes(remix.status))throw Error('Reviewed Remix text is unavailable: '+item.id);
 fs.writeFileSync(path.join(folder,'remix-text.json'),JSON.stringify(remix,null,2));
 for(const sheet of inspected.sheets)fs.copyFileSync(sheet.file,path.join(folder,path.basename(sheet.file)));
 const receipt={...inspected,reviewStatus:'all_decoded_frames_inspected',promptVersion:entry.version,reviewNotes:entry.reviewNotes,generatedOutputTested:false};
 fs.writeFileSync(path.join(folder,'review.json'),JSON.stringify(receipt,null,2));
 rows.push({id:item.id,title:`Hook ${String(inventory.indexOf(item)+1).padStart(2,'0')}`,sourceSha256:entry.sourceSha256,prompt,remix,reviewedFrames:entry.reviewedFrameCount,notes:entry.reviewNotes,duration:inspected.durationSeconds,sheets:inspected.sheets.map(s=>path.basename(s.file))});
}
const html=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Hook reference prompt review</title><style>*{box-sizing:border-box}body{font:16px/1.6 system-ui;background:#f6f3ee;color:#252525;max-width:1200px;margin:32px auto;padding:0 24px}h1{font-size:28px}section{background:white;border-radius:12px;padding:24px;margin:24px 0}.pair{display:grid;grid-template-columns:300px 1fr;gap:24px}video{width:100%;max-height:540px;border-radius:8px;background:#111}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:15px/1.7 system-ui;margin-top:0}summary{cursor:pointer}details img{max-width:100%}.meta{font-size:14px;color:#555}@media(max-width:700px){.pair{grid-template-columns:1fr}video{max-height:480px}section{padding:16px}body{padding:0 12px}}</style><h1>Hook reference prompts: individual review</h1><p>${rows.length} of ${inventory.length} Hook videos reviewed frame by frame. Original detailed approach. Overlay-text removal included in every prompt.</p><p class="meta">All decoded video frames were inspected in sequence. This is frame review, not real-time playback, an audio evaluation or a generated-output quality test. No source footage was trimmed or changed.</p>${rows.map(row=>`<section><h2>${escaped(row.title)}</h2><p class="meta">${row.duration.toFixed(3)} seconds · ${row.reviewedFrames} frames inspected · permanent reference ID: ${escaped(row.id)}</p><div class="pair"><div><video controls muted playsinline preload="metadata" src="${row.id}/source.mp4"></video><p><a href="${row.id}/prompt.txt" download>Download exact prompt</a></p></div><pre>${escaped(row.prompt)}</pre></div><p class="meta">${escaped(row.notes)}</p><details><summary>Inspect every source frame</summary>${row.sheets.map(sheet=>`<img loading="lazy" src="${row.id}/${sheet}" alt="Sequential source frames from ${escaped(sheet)}">`).join('')}</details></section>`).join('')}</html>`;
// Keep the source caption beside its performance prompt without mixing it into generation instructions.
let combined=html;
for(const row of rows){
 const anchor=`<p class="meta">${escaped(row.notes)}</p>`;
 const blocks=row.remix.blocks.map(block=>`<p class="meta">${block.startMs}–${block.endMs} ms</p><pre>${escaped(block.text)}</pre>`).join('');
 combined=combined.replace(anchor,`${anchor}<h3>Remix source text</h3>${blocks||'<p>No eligible creator caption.</p>'}<p class="meta">${escaped(row.remix.notes)}</p><p><a href="${row.id}/remix-text.json" download>Download Remix text and timing</a></p>`);
}
fs.writeFileSync(path.join(delivery,'review.html'),combined);
fs.writeFileSync(path.join(delivery,'progress.json'),JSON.stringify({scope:'active_hook_video_workflow_only',total:inventory.length,frameReviewed:rows.length,remaining:inventory.length-rows.length,entries:rows.map(row=>({id:row.id,title:row.title,sourceSha256:row.sourceSha256,reviewedFrames:row.reviewedFrames,notes:row.notes,duration:row.duration}))},null,2));
console.log(JSON.stringify({review:path.join(delivery,'review.html'),reviewed:rows.length,remaining:inventory.length-rows.length}));
