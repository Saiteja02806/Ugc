// Local, read-only review viewer. No CDN requests, uploads or catalogue writes.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const audit = JSON.parse(readFileSync(path.join(root, ".tmp/remix-text-audit/audit.json"), "utf8"));
const findings = JSON.parse(readFileSync(path.join(root, "docs/explore-remix-text-audit-findings.json"), "utf8"));
const output = path.join(root, ".tmp/remix-text-audit/review.html");
const localUrl = file => path.relative(path.dirname(output), file).split(path.sep).map(encodeURIComponent).join("/");
const rows = audit.rows.map(row => {
  const finding = findings.findings.find(f => f.referenceId === row.referenceId && f.slideId === row.slideId);
  return { ...row, source: localUrl(row.source), preview: localUrl(row.preview), rawPath: localUrl(row.rawPath), frames: row.frames.map(frame => ({ ...frame, path: localUrl(frame.path) })), alternateReadings: row.alternateReadings.map(reading => ({ ...reading, path: localUrl(reading.path) })), finding, priority: finding && row.status === "needs_review" ? "high" : row.priority };
}).sort((a, b) => ["high", "medium", "standard", "reviewed"].indexOf(a.priority) - ["high", "medium", "standard", "reviewed"].indexOf(b.priority));
const json = JSON.stringify({ rows, summary: audit.summary, scope: findings.visualScope }).replaceAll("<", "\\u003c");
writeFileSync(output, `<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Remix Text — source review</title>
<style>
:root{font:16px/1.5 system-ui,sans-serif;color:#25251f;background:#f6f5ef}*{box-sizing:border-box}body{margin:0}header{padding:28px 32px 18px;border-bottom:1px solid #d4d2c5}h1{font-size:28px;margin:0 0 8px}p{margin:8px 0;max-width:95ch}.muted{color:#66665a;font-size:14px}a{color:#135c58}label{display:block;font-size:14px;font-weight:600}select,input{font:inherit;padding:9px;border:1px solid #aaa899;border-radius:5px;width:100%;background:white}.filters{display:grid;grid-template-columns:1fr 1fr 2fr;gap:16px;padding:18px 32px}main{display:grid;grid-template-columns:320px minmax(0,1fr);gap:20px;padding:0 32px 32px}nav{max-height:75vh;overflow:auto;border:1px solid #d4d2c5;border-radius:7px;background:white}nav button{display:block;width:100%;text-align:left;border:0;border-bottom:1px solid #e7e5db;background:white;padding:12px;cursor:pointer;font:14px/1.4 system-ui;overflow-wrap:anywhere}nav button[aria-current=true]{background:#dcece8;box-shadow:inset 4px 0 #176259}button:focus-visible,a:focus-visible,input:focus-visible,select:focus-visible{outline:3px solid #b85220;outline-offset:2px}section{min-width:0}h2{font-size:19px;overflow-wrap:anywhere;margin:0 0 4px}h3{font-size:16px;margin:16px 0 6px}.notice{padding:14px;border-left:4px solid #b85220;background:#fff2df;margin:16px 0}.columns{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:20px}.source{background:#1c1c1c;display:block;width:100%;max-height:640px;object-fit:contain;border-radius:6px}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:15px/1.5 system-ui;margin:0;background:white;padding:12px;border:1px solid #d4d2c5;border-radius:5px}.block{margin-bottom:12px}.block small{display:block;padding:5px 0;color:#66665a}.counts{font-weight:600}summary{cursor:pointer;margin:12px 0}#frame-control{margin:12px 0}#frame-input{padding:0}.empty{padding:16px}#results{padding:0 32px 12px}@media(max-width:950px){main{grid-template-columns:1fr}nav{max-height:220px}.columns{grid-template-columns:1fr}.filters{grid-template-columns:1fr}header,.filters,main{padding-left:18px;padding-right:18px}#results{padding-left:18px}.source{max-height:650px}}
</style>
<header><h1>Remix Text: compare the source and saved copy</h1>
<p class="counts">${audit.summary.savedUnits} source units · ${audit.summary.status.ready ?? 0} text entries reviewed · ${audit.summary.status.no_text ?? 0} without eligible remix text · ${audit.summary.status.needs_review ?? 0} still need review</p>
<p>${rows.some(r => r.priority === "high") ? "Start with the " + rows.filter(r => r.priority === "high").length + " high-priority entries." : "All catalogue entries have been reviewed."} Use creator-added captions only; exclude app-interface text, screenshots, watermarks and scenery. Infographic/poster slides are excluded entirely, including titles and added Study tips captions. Raw OCR below is audit evidence and can contain excluded text.</p>
<p class="muted">This viewer reads a local snapshot. It cannot approve entries or change the application. OCR similarity flags are review hints, not proof of an error. The audit verifies transcription and source identity; it does not establish the truth of a post's claims or promise similar reach.</p><details><summary>Audit coverage</summary><p id="scope" class="muted"></p></details></header>
<div class="filters"><label>Review priority<select id="priority"><option value="high">High priority</option><option value="medium">Possible duplicate fragments</option><option value="standard">Remaining unreviewed</option><option value="reviewed">Reviewed entries</option><option value="all">All entries</option></select></label><label>Format<select id="format"><option value="all">All formats</option><option value="slideshow">Slideshow</option><option value="hook">Hook video</option><option value="wall_text">Wall of Text video</option></select></label><label>Find reference or text<input id="search" type="search" placeholder="Reference ID, slide ID, or saved words"></label></div>
<div id="results" role="status"></div><main><nav id="list" aria-label="References to review"></nav><section id="detail" aria-label="Original source and extracted text"></section></main>
<script id="data" type="application/json">${json}</script>
<script>
const data=JSON.parse(document.getElementById('data').textContent),el=id=>document.getElementById(id);
el('scope').textContent=data.scope;
let selected=null;
function node(tag,text,parent){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(parent)parent.append(n);return n;}
function link(text,url,parent){const a=node('a',text,parent);a.href=url;a.target='_blank';a.rel='noopener';return a;}
function show(row,button){
 selected=row;for(const b of el('list').querySelectorAll('button'))b.setAttribute('aria-current',String(b===button));
 const detail=el('detail');detail.replaceChildren();node('h2',row.referenceId,detail);node('p',row.slideId||'Video source',detail);
 node('p',row.status+' · '+row.savedBlocks.length+' saved blocks · '+row.rawBlockCount+' original OCR blocks'+(row.durationMs?' · '+(row.durationMs/1000).toFixed(2)+' seconds':''),detail).className='muted';
 if(row.finding){const box=node('details',undefined,detail);node('summary',row.finding.status==='resolved'?'Resolved extraction issue':'Extraction issue needing review',box);node('p',row.finding.issue,box);node('p',row.finding.status==='resolved'?'Resolution: '+row.finding.resolution:'Review: '+row.finding.action,box);}
 else if(row.status==='needs_review'){node('p','Unreviewed. Compare every intentional text line with the original before using this source for a remix.',detail).className='notice';}
 const columns=node('div',undefined,detail);columns.className='columns';const left=node('div',undefined,columns),right=node('div',undefined,columns);
 node('h3','Original source',left);link('Open original at full size',row.source,left);
 const media=node(row.format==='slideshow'?'img':'video',undefined,left);media.className='source';media.src=row.source;if(row.format==='slideshow')media.alt='Original '+row.referenceId+' '+row.slideId;else{media.controls=true;media.preload='metadata';}
 if(row.format!=='slideshow'){
  node('h3','Sampled frame and raw OCR',left);const control=node('label',undefined,left);control.id='frame-control';const label=node('span',undefined,control),slider=node('input',undefined,control);slider.type='range';slider.id='frame-input';slider.min='0';slider.max=String(row.frames.length-1);slider.value='0';
  const image=node('img',undefined,left);image.className='source';const raw=node('pre',undefined,left);
  const change=()=>{const index=Number(slider.value),frame=row.frames[index];label.textContent='Frame '+(index+1)+' of '+row.frames.length+' · sampled source time '+(frame.timestampMs/1000).toFixed(3)+'s · '+row.pipelineVersion;image.src=frame.path;image.alt='Sampled frame '+(index+1);raw.textContent=frame.text||'[No OCR detected in this frame]';};slider.addEventListener('input',change);change();
 }
 node('h3','Currently saved text',right);
 if(!row.savedBlocks.length)node('pre',row.status==='no_text'?'No eligible remix text: absent or explicitly excluded.':'No text saved — requires review.',right);
 for(let i=0;i<row.savedBlocks.length;i++){const block=row.savedBlocks[i],box=node('div',undefined,right);box.className='block';node('small','Block '+(i+1)+(block.startMs!==null?' · '+(block.startMs/1000).toFixed(2)+'–'+(block.endMs/1000).toFixed(2)+'s (approximate)':''),box);node('pre',block.text,box);}
 if(row.format==='slideshow'){const d=node('details',undefined,right);node('summary','Original OCR before manual corrections',d);node('pre',row.frames[0]?.text||'[No OCR detected]',d);}
 if(row.completeBlocks.length){const d=node('details',undefined,right);node('summary','Complete extraction: '+row.completeBlocks.length+' blocks (unapproved; includes incidental text)',d);for(const block of row.completeBlocks){node('p',block.startMs===null?'Slide':(block.startMs/1000).toFixed(3)+'–'+(block.endMs/1000).toFixed(3)+'s',d).className='muted';node('pre',block.text,d);}}
 if(row.alternateReadings.length){const d=node('details',undefined,right);node('summary','Alternate crop readings (evidence only)',d);for(const reading of row.alternateReadings){link('Open crop for frame '+(reading.frameIndex+1),reading.path,d);node('pre',reading.text||'[No OCR detected]',d);}}
 const meta=node('details',undefined,right);node('summary','Source identity and review evidence',meta);node('p','SHA-256: '+row.sourceSha256,meta).className='muted';node('p','Flags: '+(row.flags.join(', ')||'none'),meta).className='muted';link('Open complete raw OCR JSON',row.rawPath,meta);
}
function render(){
 const priority=el('priority').value,format=el('format').value,q=el('search').value.toLowerCase();
 const rows=data.rows.filter(r=>(priority==='all'||r.priority===priority)&&(format==='all'||r.format===format)&&(!q||(r.referenceId+' '+(r.slideId||'')+' '+r.savedBlocks.map(b=>b.text).join(' ')).toLowerCase().includes(q)));
 el('results').textContent=rows.length+' matching entries';el('list').replaceChildren();let chosen=null;
 for(const row of rows){const button=node('button',row.referenceId+' · '+(row.slideId||row.format)+' · '+row.status,el('list'));button.type='button';button.addEventListener('click',()=>show(row,button));if(!chosen||row===selected)chosen={row,button};}
 if(chosen)show(chosen.row,chosen.button);else{el('detail').replaceChildren();node('p','No entries match these filters.',el('detail'));}
}
for(const id of ['priority','format'])el(id).addEventListener('change',render);el('search').addEventListener('input',render);if(!data.rows.some(r=>r.priority==='high'))el('priority').value='all';render();
</script></html>`);
console.log(JSON.stringify({ output, entries: rows.length, highPriority: rows.filter(r => r.priority === "high").length }));
