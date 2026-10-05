/** Create a portable local review page; no app integration or external requests. */
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
const directory = resolve(process.argv[2] ?? ".tmp/subtitle-lab/user-video");
const info = JSON.parse(await readFile(resolve(directory, "source-info.json"), "utf8"));
const transcript = JSON.parse(await readFile(resolve(directory, "aligned/transcript.json"), "utf8"));
const original = (await readFile(resolve(directory, "source.mp4"))).toString("base64");
const rendered = (await readFile(resolve(directory, "active-word/captioned.mp4"))).toString("base64");
const audio = await readFile(resolve(directory, "audio.wav"));
let pcm;
for (let offset = 12; offset + 8 <= audio.length;) {
  const size = audio.readUInt32LE(offset + 4);
  if (audio.toString("ascii", offset, offset + 4) === "data") { pcm = audio.subarray(offset + 8, offset + 8 + size); break; }
  offset += 8 + size + (size % 2);
}
if (!pcm) throw new Error("PCM data missing");
const peaks = Array.from({ length: 3000 }, (_, i) => {
  let peak = 0;
  for (let sample = Math.floor(i * pcm.length / 2 / 3000); sample < Math.floor((i + 1) * pcm.length / 2 / 3000); sample++) {
    peak = Math.max(peak, Math.abs(pcm.readInt16LE(sample * 2)) / 32768);
  }
  return peak;
});
const data = JSON.stringify({ ...info, prediction: transcript.words, peaks }).replace(/</gu, "\\u003c");
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Subtitle timing review — 6-second sample</title>
<style>*{box-sizing:border-box}body{margin:0;background:#f6f5f1;color:#202c29;font:16px system-ui,sans-serif}main{max-width:1150px;margin:auto;padding:28px}h1{font-size:28px;margin:0 0 12px}p{line-height:1.5}.grid{display:grid;grid-template-columns:310px 1fr;gap:26px}video{width:100%;max-height:560px;background:#202c29;border-radius:10px}button,input,textarea,select{font:inherit}button{cursor:pointer;border:1px solid #b4bfb9;border-radius:6px;padding:7px 10px;background:white;color:#202c29}button:hover{background:#e3ebe4}button:focus-visible,input:focus-visible,textarea:focus-visible,select:focus-visible{outline:3px solid #3a7e68}input{width:90px;padding:5px}textarea{width:100%;padding:10px;min-height:75px}.controls{display:flex;gap:7px;flex-wrap:wrap;margin:12px 0}canvas{display:block;width:100%;height:140px;background:#e7ede8;border:1px solid #b4bfb9;cursor:crosshair}table{width:100%;border-collapse:collapse;margin-top:15px;font-size:14px}th,td{text-align:left;padding:7px;border-bottom:1px solid #d4dcd7}tr.selected{background:#deeadf}tr{cursor:pointer}.note{background:#fff4d5;padding:12px;border-radius:8px}.status{min-height:28px}label{display:block;margin:10px 0}label input[type=checkbox]{width:auto}#reviewer{width:100%;max-width:300px}details{margin:18px 0}pre{white-space:pre-wrap;font-size:12px}.scroll{max-height:500px;overflow:auto}@media(max-width:800px){.grid{grid-template-columns:1fr}video{max-height:400px}main{padding:16px}}
</style><main><h1>Check the words. Then check their timing.</h1>
<p class="note">This is a local evaluation, with human timing review pending. Predictions are hidden initially. Mark audible word starts and ends independently, using the original audio. Model agreement alone does not establish accuracy.</p>
<div class="grid"><section><video id="video" controls preload="metadata"></video><div class="controls"><button id="toggle">Show burned-in preview</button><select id="speed" aria-label="Playback speed"><option value="1">1× speed</option><option value="0.75">0.75× speed</option><option value="0.5">0.5× speed</option></select></div><p id="mode">Original video</p><p>Click the waveform to seek. Choose a word, then mark its audible start and end. Keys: I = start, O = end, Enter = replay, arrows = 10 ms seek.</p></section>
<section><label for="text">Human transcript: correct any missing, extra or mistaken words.</label><textarea id="text"></textarea><button id="apply">Apply corrected words (clears timing marks)</button>
<div class="controls"><button id="zoom">Zoom around cursor</button><button id="full">Full waveform</button><button id="back">−10 ms</button><button id="forward">+10 ms</button></div><canvas id="wave" width="900" height="140" aria-label="Audio waveform"></canvas><p id="clock" class="status"></p>
<div class="controls"><button id="start">Mark start (I)</button><button id="end">Mark end (O)</button><button id="replay">Replay word (Enter)</button><button id="next">Next word</button></div>
<div class="scroll"><table><thead><tr><th>#</th><th>Word</th><th>Start, ms</th><th>End, ms</th></tr></thead><tbody id="rows"></tbody></table></div>
<details><summary>Show model predictions after independent annotation</summary><pre id="predictions"></pre></details>
<label for="reviewer">Reviewer name</label><input id="reviewer" autocomplete="name"><label><input type="checkbox" id="confirmed"> I checked every spoken word and boundary against the original audio.</label><button id="save">Export human reference JSON</button><p id="status" class="status" aria-live="polite"></p>
</section></div><p>Times use the unchanged source timeline. After export, give Codex the saved JSON file path to calculate WER and timing errors. This single clean English clip is not a representative production benchmark.</p></main>
<script>const data=${data};const original='data:video/mp4;base64,${original}';const rendered='data:video/mp4;base64,${rendered}';
const $=id=>document.getElementById(id), video=$('video'), canvas=$('wave'), ctx=canvas.getContext('2d');let showingRender=false,selected=0,range=[0,data.durationMs],stopAt=null;
let words=data.prediction.map(w=>({text:w.text,startMs:null,endMs:null}));const storageKey='subtitle-reference-'+data.sourceSha256;
try{const saved=JSON.parse(localStorage.getItem(storageKey));if(saved&&Array.isArray(saved.words))words=saved.words;}catch{}
video.src=original;$('text').value=words.map(w=>w.text).join(' ');$('predictions').textContent=JSON.stringify(data.prediction,null,2);
function draft(){try{localStorage.setItem(storageKey,JSON.stringify({words}));}catch{}}
function seek(ms){video.pause();stopAt=null;video.currentTime=Math.max(0,Math.min(data.durationMs,ms))/1000;draw();}
function draw(){ctx.clearRect(0,0,900,140);ctx.strokeStyle='#628c78';ctx.beginPath();for(let x=0;x<900;x++){const ms=range[0]+x/900*(range[1]-range[0]);const peak=data.peaks[Math.min(2999,Math.floor(ms/data.durationMs*3000))];ctx.moveTo(x,70-peak*60);ctx.lineTo(x,70+peak*60);}ctx.stroke();const w=words[selected];if(w){ctx.fillStyle='#c68922';for(const time of [w.startMs,w.endMs])if(time!==null&&time>=range[0]&&time<=range[1])ctx.fillRect((time-range[0])/(range[1]-range[0])*900,0,2,140);}const now=video.currentTime*1000;ctx.fillStyle='#174f3c';ctx.fillRect((now-range[0])/(range[1]-range[0])*900,0,2,140);$('clock').textContent=Math.round(now)+' ms · waveform '+Math.round(range[0])+'–'+Math.round(range[1])+' ms · selected '+(w?w.text:'none');}
function rows(){const body=$('rows');body.replaceChildren();words.forEach((w,i)=>{const row=document.createElement('tr');row.classList.toggle('selected',i===selected);row.onclick=()=>{selected=i;rows();draw();};for(const value of [i+1,w.text]){const cell=document.createElement('td');cell.textContent=value;row.append(cell);}for(const key of ['startMs','endMs']){const cell=document.createElement('td'),input=document.createElement('input');input.type='number';input.min='0';input.max=data.durationMs;input.step='1';input.value=w[key]??'';input.setAttribute('aria-label',w.text+' '+key);input.onclick=e=>e.stopPropagation();input.oninput=()=>{w[key]=input.value===''?null:Number(input.value);draft();draw();};cell.append(input);row.append(cell);}body.append(row);});}
function mark(key){if(!words[selected])return;words[selected][key]=Math.round(video.currentTime*1000);draft();rows();draw();}
function replay(){const w=words[selected];if(w.startMs===null||w.endMs===null||w.endMs<=w.startMs){$('status').textContent='Mark both boundaries first.';return;}video.currentTime=Math.max(0,w.startMs-150)/1000;stopAt=Math.min(data.durationMs,w.endMs+150)/1000;video.play().catch(()=>{});}
$('apply').onclick=()=>{words=$('text').value.trim().split(/\\s+/).filter(Boolean).map(text=>({text,startMs:null,endMs:null}));selected=0;draft();rows();draw();};
$('start').onclick=()=>mark('startMs');$('end').onclick=()=>mark('endMs');$('replay').onclick=replay;$('next').onclick=()=>{selected=Math.min(words.length-1,selected+1);rows();draw();};$('back').onclick=()=>seek(video.currentTime*1000-10);$('forward').onclick=()=>seek(video.currentTime*1000+10);
$('zoom').onclick=()=>{const now=video.currentTime*1000;range=[Math.max(0,now-750),Math.min(data.durationMs,now+750)];draw();};$('full').onclick=()=>{range=[0,data.durationMs];draw();};canvas.onclick=e=>{const r=canvas.getBoundingClientRect();seek(range[0]+(e.clientX-r.left)/r.width*(range[1]-range[0]));};
$('speed').onchange=()=>{video.playbackRate=Number($('speed').value);};$('toggle').onclick=()=>{const now=video.currentTime;video.pause();showingRender=!showingRender;video.src=showingRender?rendered:original;video.addEventListener('loadedmetadata',()=>{video.currentTime=now;video.playbackRate=Number($('speed').value);},{once:true});$('toggle').textContent=showingRender?'Show original':'Show burned-in preview';$('mode').textContent=showingRender?'GPT + WhisperX burned-in preview (pending human timing review)':'Original video';};
function tick(){if(stopAt!==null&&video.currentTime>=stopAt){video.pause();stopAt=null;}draw();requestAnimationFrame(tick);}requestAnimationFrame(tick);
document.addEventListener('keydown',e=>{if(['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName))return;if(e.key.toLowerCase()==='i')mark('startMs');else if(e.key.toLowerCase()==='o')mark('endMs');else if(e.key==='Enter')replay();else if(e.key==='ArrowLeft'){e.preventDefault();seek(video.currentTime*1000-10);}else if(e.key==='ArrowRight'){e.preventDefault();seek(video.currentTime*1000+10);}});
$('save').onclick=()=>{let end=-1;for(const w of words){if(!w.text.trim()||!Number.isFinite(w.startMs)||!Number.isFinite(w.endMs)||w.startMs<end||w.endMs<=w.startMs||w.endMs>data.durationMs){$('status').textContent='Every word needs valid, ordered start/end marks.';return;}end=w.endMs;}const reviewer=$('reviewer').value.trim();if(!reviewer||!$('confirmed').checked){$('status').textContent='Enter the reviewer name and confirm the audio review.';return;}const reference={schemaVersion:1,sourceSha256:data.sourceSha256,durationMs:data.durationMs,reviewStatus:'human-checked',reviewer,checkedAt:new Date().toISOString(),words};const url=URL.createObjectURL(new Blob([JSON.stringify(reference,null,2)],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download='subtitle-human-reference.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);$('status').textContent='Exported. Give Codex the saved JSON path for scoring.';};rows();draw();</script></html>`;
await writeFile(resolve(directory, "review.html"), html, { flag: "wx" });
await writeFile(resolve(directory, "reference-pending.json"), JSON.stringify({ schemaVersion: 1, sourceSha256: info.sourceSha256,
  durationMs: info.durationMs, reviewStatus: "pending", reviewer: null, checkedAt: null,
  words: transcript.words.map(w => ({ text: w.text, startMs: null, endMs: null })) }, null, 2), { flag: "wx" });
console.log(resolve(directory, "review.html"));
