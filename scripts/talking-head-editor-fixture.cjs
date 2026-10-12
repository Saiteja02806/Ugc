/* eslint-disable @typescript-eslint/no-require-imports -- Isolated real-component browser fixture. */
const assert = require('node:assert/strict');
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
exports.setup = ({file, assets, makeAsset}) => {
  for (const n of [3, 4]) assets.set(id(n), {...makeAsset(id(n), n === 3 ? 'Demo narration' : 'Default music'), collection:'audio', mimeType:'audio/wav', durationSeconds:1});
  assets.set(id(5), makeAsset(id(5), 'Replacement talking head'));
  file('media.ts', `export async function fetchAIStudioMediaAsset(id) { const response = await fetch('/fixture-media/' + id); if (!response.ok) throw new Error('Unavailable fixture'); return response.json(); }
export async function uploadAIStudioReferenceMedia(file, kind) { return (await fetch('/fixture-upload?kind=' + kind + '&name=' + encodeURIComponent(file.name))).json(); }`);
  file('music.ts', `export async function loadWorkflowDefaultMusic() { return {file:new File(['fixture'],'default.wav',{type:'audio/wav'}),playback:'repeat'}; }`);
  file('ui.tsx', `export const Button=({variant,size,...props})=><button {...props}/>; export const Input=props=><input {...props}/>;
export const WorkflowFilePicker=()=>null; export const WorkflowSavedAudioPicker=()=>null;
export const WorkflowMediaPlayer=({asset,label})=><video aria-label={label} src={asset.url} controls style={{width:200}}/>;
export const WorkflowVideoStartActions=()=>null; export const WorkflowVideoAssetPicker=()=>null; export const useAccountTimeZone=()=> 'Asia/Calcutta';
export const formatMediaSeconds=value=>value+' seconds'; export const RemoveMediaButton=({label,onClick})=><button aria-label={'Remove '+label} onClick={onClick}>Remove</button>;`);
  file('entry.tsx', `import {createRoot} from 'react-dom/client'; import {useState,useCallback,useEffect} from 'react'; import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {TalkingHeadClipEditing} from '@/components/explore/talking-head-clip-editing'; import {WorkflowFinishingBoundary} from '@/components/explore/workflow-finishing-boundary'; import {WorkflowCreationPanel} from '@/components/explore/workflow-creation-panel'; import {WorkflowCompositionPanel} from '@/components/explore/workflow-composition-panel'; import {WorkflowEditWorkspace,WorkflowScheduleWorkspace} from '@/components/explore/workflow-edit-workspace';
const demo={name:'demo.mp4',url:'/video.mp4',duration:8,file:new File(['fixture'],'demo.mp4',{type:'video/mp4'})};
const audio={name:'demo.wav',url:'/sound.wav',duration:1,file:new File(['fixture'],'demo.wav',{type:'audio/wav'})};
const frame={version:1,width:.8,height:.8,points:[[0,0,0],[3000,.1,.1],[8000,.2,.2]]};
const scheduleDraft={platform:'instagram',connectionId:'${id(99)}',caption:'Shared editor result',date:'2026-12-01',time:'10:30'};
function Fixture(){const [source,setSource]=useState(null),[section,setSection]=useState('edit'),[demoMedia,setDemo]=useState(demo),[playback,setPlayback]=useState('once'); const dirty=useCallback(()=>{},[]);
useEffect(()=>{fetch('/fixture-media/${id(1)}').then(r=>r.json()).then(setSource);},[]);
const attachment={asset:demoMedia,loading:false,error:null,choose:async()=>false,remove:()=>setDemo(null)}; const demoAudio={asset:demoMedia?audio:null,loading:false,error:null,choose:async()=>false,remove:()=>{}};
return <><nav>{['create','edit','schedule'].map(value=><button key={value} onClick={()=>setSection(value)}>{value}</button>)}<button onClick={()=>fetch('/fixture-media/${id(5)}').then(r=>r.json()).then(setSource)}>Replace opening fixture</button><button onClick={()=>setDemo(null)}>Remove demo fixture</button></nav>
<TalkingHeadClipEditing enabled ownerId="owner" source={source} sourcePreview={null} demo={attachment} demoFraming={demoMedia?frame:null} active={section==='edit'} onDirty={dirty}>{clips=><WorkflowFinishingBoundary enabled ownerId="owner" kind="hook" source={clips.source} demo={clips.demo} demoSource={clips.demoSource} demoAudio={demoAudio.asset} playback={playback} scheduleDraft={scheduleDraft} demoFraming={clips.demoFraming} demoFramingError={clips.error}>{finish=><>
<div hidden={section!=='edit'} style={{display:section==='edit'?'grid':'none',gridTemplateColumns:'1fr 1fr'}}><WorkflowCreationPanel kind="hook" section="edit" edit={finish.edit} actionContent={clips.editing?clips.actions:undefined}>{clips.controls}<div hidden={clips.editing}><WorkflowCompositionPanel videoLabel="Hook" connected ownerId="owner" options={finish.options} onOptionsChange={finish.setOptions} demo={attachment} demoAudio={demoAudio} demoAudioPlayback={playback} onDemoAudioPlaybackChange={setPlayback}/></div></WorkflowCreationPanel>
<div>{clips.preview}<div hidden={clips.editing}><WorkflowEditWorkspace kind="hook" demo={attachment} demoAudio={demoAudio} generatedVideo={clips.source} finishedVideo={finish.output} onEditSource={clips.openOpening} onEditDemo={clips.openDemo} editingBusy={clips.busy || finish.edit.busy}/></div></div></div>
<div hidden={section!=='schedule'}><WorkflowScheduleWorkspace draft={scheduleDraft} finishedVideo={finish.output}/><button disabled={finish.schedule.disabled} onClick={finish.schedule.onAction}>Schedule post</button></div>
</>}</WorkflowFinishingBoundary>}</TalkingHeadClipEditing></>;}
createRoot(document.getElementById('root')).render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><Fixture/></QueryClientProvider>);`);
};
exports.run = async ({page, base, renders, schedules, uploads, receipts, waitRenders, complete, errors, overlapping}) => {
  const button = name => page.getByRole('button',{name,exact:true});
  await page.goto(base+'/fixture');
  await button('Edit talking-head video').click();
  await page.getByLabel('Trim start',{exact:true}).fill('1'); await page.getByLabel('Trim end',{exact:true}).fill('4');
  await page.getByLabel('Overlay text',{exact:true}).fill('Talking head line');
  await page.reload();
  await button('Edit talking-head video').click();
  assert.equal(await page.getByLabel('Overlay text',{exact:true}).inputValue(),'Talking head line','local clip draft recovers after reload without a render');
  assert.equal(await page.getByLabel('Trim start',{exact:true}).inputValue(),'1');
  assert.equal(renders.length,0);
  await button('Back to previews').click();
  assert.equal(await button('Apply edits').isDisabled(),true,'unsaved custom text blocks final finishing');
  await button('schedule').click(); assert.equal(await button('Schedule post').isDisabled(),true); assert.equal(renders.length,0); assert.equal(schedules.length,0);
  await button('edit').click(); await button('Edit talking-head video').click();
  assert.equal(await page.getByLabel('Overlay text',{exact:true}).inputValue(),'Talking head line','stage changes preserve clip draft');
  await button('Save edits').click(); await waitRenders(1);
  assert.equal(renders[0].draft.sourceAssetId,id(1)); assert.equal(renders[0].draft.demoAssetId,null); assert.equal(renders[0].draft.subtitles,null);
  assert.deepEqual([renders[0].draft.editing.trimStartMs,renders[0].draft.editing.trimEndMs],[1000,4000]);
  assert.equal(renders[0].draft.editing.textOverlays[0].value,'Talking head line');
  let failedLookup = false;
  await page.route('**/fixture-media/'+receipts.get(renders[0].requestKey).outputId, async route=> { if (!failedLookup) { failedLookup=true; await route.fulfill({status:503,body:'Unavailable fixture'}); } else await route.continue(); });
  complete(0);
  await button('Back to sequence').click(); await button('Edit demo video').click();
  assert.equal(failedLookup,true,'completed clip lookup was recovered'); assert.equal(renders.length,1,'recovering the saved clip does not render again');
  assert.equal(uploads.filter(u=>u.kind==='video').length,1,'demo is prepared once');
  await page.getByLabel('Trim start',{exact:true}).fill('.5'); await page.getByLabel('Trim end',{exact:true}).fill('2.5');
  await page.getByLabel('Overlay text',{exact:true}).fill('Demo step'); await button('Save edits').click(); await waitRenders(2);
  assert.equal(renders[1].draft.sourceAssetId,id(2)); assert.equal(renders[1].draft.demoAssetId,null); assert.equal(renders[1].draft.subtitles,null);
  assert.deepEqual([renders[1].draft.editing.trimStartMs,renders[1].draft.editing.trimEndMs],[500,2500]); assert.equal(renders[1].draft.editing.textOverlays[0].value,'Demo step'); complete(1);
  await button('Back to sequence').click();
  await button('Repeat music').click(); await page.getByRole('switch',{name:'Auto subtitles',exact:true}).click(); await page.getByRole('switch',{name:'Background music',exact:true}).click();
  await button('Apply edits').click(); await waitRenders(3);
  const final=renders[2].draft;
  assert.equal(final.sourceAssetId,receipts.get(renders[0].requestKey).outputId); assert.equal(final.demoAssetId,receipts.get(renders[1].requestKey).outputId);
  assert.equal(final.editing,undefined); assert.equal(final.demoAudioAssetId,id(3)); assert.equal(final.demoAudioPlayback,'repeat'); assert.equal(final.backgroundAssetId,id(4)); assert.equal(final.subtitles.style,'clean');
  assert.equal(final.demoFraming.points[0][0],0); assert.equal(final.demoFraming.points.at(-1)[0],2000,'demo framing is rebased after trim'); complete(2);
  await page.getByLabel('Finished video preview',{exact:true}).waitFor(); await button('schedule').click(); await button('Schedule post').click();
  await page.getByRole('dialog',{name:'Confirm schedule'}).waitFor(); assert.equal(schedules.length,0,'publishing requires explicit confirmation'); await button('Confirm fixture schedule').click();
  await page.waitForFunction(()=>!document.querySelector('[role="dialog"]')); assert.equal(schedules.length,1); assert.equal(schedules[0].source.id,receipts.get(renders[2].requestKey).outputId);
  console.log('PASS Talking Head: custom text and trim on both clips; saved clips feed final subtitles, music, demo audio and framing; scheduling uses only the confirmed final output');
  await button('edit').click(); await button('Edit talking-head video').click(); await page.getByLabel('Overlay text',{exact:true}).fill('Unsaved revision'); await button('Back to previews').click();
  assert.equal(await button('Apply edits').isDisabled(),true); assert.equal(await page.getByLabel('Finished video preview',{exact:true}).count(),0,'changed edits invalidate the old final preview');
  await button('Replace opening fixture').click(); await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent==='Apply edits'&&!b.disabled));
  await button('Edit talking-head video').click(); assert.equal(await page.getByLabel('Overlay text',{exact:true}).inputValue(),'','replacement source has its own draft'); await button('Back to previews').click();
  await button('Remove demo fixture').click(); await button('Apply edits').click(); await waitRenders(4);
  assert.equal(renders[3].draft.sourceAssetId,id(5)); assert.equal(renders[3].draft.demoAssetId,null); assert.equal(renders[3].draft.demoAudioAssetId,null); assert.equal(renders[3].draft.demoFraming,undefined);
  complete(3); await page.getByLabel('Finished video preview',{exact:true}).waitFor();
  assert.equal(overlapping(),0); assert.deepEqual(errors,[]); assert.equal(schedules.length,1);
  console.log('PASS Talking Head: unsaved changes invalidate the old final video; replacement/removal cannot reuse stale clip edits, audio or framing; no overlapping renders or automatic posts');
};
