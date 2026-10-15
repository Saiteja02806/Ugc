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
function Fixture(){const [source,setSource]=useState(null),[section,setSection]=useState('edit'),[demoMedia,setDemo]=useState(demo),[ownedDemo,setOwnedDemo]=useState(null),[ownedAudio,setOwnedAudio]=useState(null),[playback,setPlayback]=useState(()=>localStorage.getItem('fixture-playback')??'once'); const dirty=useCallback(()=>{},[]);
useEffect(()=>{fetch('/fixture-media/${id(1)}').then(r=>r.json()).then(setSource);fetch('/fixture-media/${id(2)}').then(r=>r.json()).then(setOwnedDemo);fetch('/fixture-media/${id(3)}').then(r=>r.json()).then(setOwnedAudio);},[]);
useEffect(()=>{localStorage.setItem('fixture-playback',playback);},[playback]);
const attachment={asset:demoMedia,loading:false,error:null,choose:async()=>false,remove:()=>setDemo(null)}; const demoAudio={asset:demoMedia?audio:null,loading:false,error:null,choose:async()=>false,remove:()=>{}};
return <><nav>{['create','edit','schedule'].map(value=><button key={value} onClick={()=>setSection(value)}>{value}</button>)}<button onClick={()=>fetch('/fixture-media/${id(5)}').then(r=>r.json()).then(setSource)}>Replace opening fixture</button><button onClick={()=>setDemo(null)}>Remove demo fixture</button></nav>
<TalkingHeadClipEditing enabled ownerId="owner" source={source} sourcePreview={null} demo={attachment} demoSource={demoMedia?ownedDemo:null} demoFraming={demoMedia?frame:null} active={section==='edit'} onDirty={dirty}>{clips=><WorkflowFinishingBoundary enabled ownerId="owner" kind="hook" source={clips.source} demo={clips.demo} demoSource={clips.demoSource} demoAudio={null} demoAudioSource={demoMedia?ownedAudio:null} playback={playback} scheduleDraft={scheduleDraft} scheduleTimezone="Asia/Calcutta" demoFraming={clips.demoFraming} demoFramingError={clips.error} fastStatus composition={{version:1,sourceEditing:clips.openingState?.editing??null,demoEditing:clips.demoState?.editing??null,sourceAudioAssetId:clips.openingState?.backgroundAssetId??null,sourceAudioPlayback:clips.openingState?.backgroundPlayback??'once'}}>{finish=><>
<div hidden={section!=='edit'} style={{display:section==='edit'?'grid':'none',gridTemplateColumns:'1fr 1fr'}}><WorkflowCreationPanel kind="hook" section="edit" edit={finish.edit} actionContent={clips.editing?clips.actions:undefined}>{clips.controls}<div hidden={clips.editing}><WorkflowCompositionPanel videoLabel="Hook" connected ownerId="owner" options={finish.options} onOptionsChange={finish.setOptions} demo={attachment} demoAudio={demoAudio} demoAudioPlayback={playback} onDemoAudioPlaybackChange={setPlayback}/></div></WorkflowCreationPanel>
<div>{clips.preview}<div hidden={clips.editing}><WorkflowEditWorkspace kind="hook" demo={attachment} demoAudio={demoAudio} generatedVideo={clips.source} finishedVideo={finish.output} onEditSource={clips.openOpening} onEditDemo={clips.openDemo} editingBusy={clips.busy || finish.edit.busy}/></div></div></div>
<div hidden={section!=='schedule'}><WorkflowScheduleWorkspace draft={scheduleDraft} finishedVideo={finish.output}/><button disabled={finish.schedule.disabled} onClick={finish.schedule.onAction}>Schedule post</button><p>{finish.schedule.message}</p>{finish.schedule.error?<p role="alert">{finish.schedule.error}</p>:null}</div>
</>}</WorkflowFinishingBoundary>}</TalkingHeadClipEditing></>;}
createRoot(document.getElementById('root')).render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><Fixture/></QueryClientProvider>);`);
};
exports.run = async ({page, base, renders, schedules, uploads, receipts, clipSaves, waitRenders, complete, errors, overlapping}) => {
  const button = name => page.getByRole('button',{name,exact:true});
  const waitSaved = async count => {
    await page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => b.textContent === 'Edits saved' && !b.disabled));
    assert.equal(clipSaves.length,count);
    assert.equal(renders.length,0,'Save edits stores a snapshot without rendering a paid output');
  };
  await page.goto(base+'/fixture');
  await button('Edit hook video').click();
  await page.getByLabel('Trim start',{exact:true}).fill('1'); await page.getByLabel('Trim end',{exact:true}).fill('4');
  await page.getByLabel('Overlay text',{exact:true}).fill('Talking head line');
  await page.reload();
  await button('Edit hook video').click();
  assert.equal(await page.getByLabel('Overlay text',{exact:true}).inputValue(),'Talking head line','local clip draft recovers after reload without a render');
  assert.equal(await page.getByLabel('Trim start',{exact:true}).inputValue(),'1');
  assert.equal(renders.length,0);
  await button('Back to videos').click();
  assert.equal(await button('Prepare final video').isDisabled(),true,'unsaved custom text blocks final finishing');
  await button('schedule').click(); assert.equal(await button('Schedule post').isDisabled(),true); assert.equal(schedules.length,0);
  await button('edit').click(); await button('Edit hook video').click();
  await button('Save edits').click(); await waitSaved(1);
  assert.equal(clipSaves[0].content.sourceAssetId,id(1));
  assert.deepEqual([clipSaves[0].content.editing.trimStartMs,clipSaves[0].content.editing.trimEndMs],[1000,4000]);
  assert.equal(clipSaves[0].content.editing.textOverlays[0].value,'Talking head line');
  await button('Back to videos').click(); await button('Edit demo video').click();
  await page.getByLabel('Trim start',{exact:true}).fill('.5'); await page.getByLabel('Trim end',{exact:true}).fill('2.5');
  await page.getByLabel('Overlay text',{exact:true}).fill('Demo step'); await button('Save edits').click(); await waitSaved(2);
  assert.equal(clipSaves[1].content.sourceAssetId,id(2));
  assert.deepEqual([clipSaves[1].content.editing.trimStartMs,clipSaves[1].content.editing.trimEndMs],[500,2500]);
  assert.equal(clipSaves[1].content.editing.textOverlays[0].value,'Demo step');
  await button('Back to videos').click(); await button('Repeat music').click();
  assert.equal(uploads.length,0,'Restored owned demo and audio never upload again');
  await button('Prepare final video').evaluate(b=>{b.click();b.click();}); await waitRenders(1);
  const final=renders[0].draft;
  assert.equal(final.sourceAssetId,id(1)); assert.equal(final.demoAssetId,id(2));
  assert.equal(final.editing,undefined); assert.equal(final.demoAudioAssetId,id(3)); assert.equal(final.demoAudioPlayback,'repeat');
  assert.equal(final.backgroundAssetId,null); assert.equal(final.subtitles,null);
  assert.deepEqual([final.composition.sourceEditing.trimStartMs,final.composition.sourceEditing.trimEndMs],[1000,4000]);
  assert.deepEqual([final.composition.demoEditing.trimStartMs,final.composition.demoEditing.trimEndMs],[500,2500]);
  assert.equal(final.composition.sourceEditing.textOverlays[0].value,'Talking head line');
  assert.equal(final.composition.demoEditing.textOverlays[0].value,'Demo step');
  assert.equal(final.demoFraming.points[0][0],0); assert.equal(final.demoFraming.points.at(-1)[0],2000,'raw framing is rebased once for the final trimmed demo');
  let failedLookup=false;
  await page.route('**/fixture-media/'+receipts.get(renders[0].requestKey).outputId,async route=>{
    if(!failedLookup){failedLookup=true;await route.fulfill({status:503,body:'Unavailable fixture'});}else await route.continue();
  });
  complete(0); await page.getByText('Your final video is ready.',{exact:false}).waitFor();
  assert.equal(failedLookup,true); assert.equal(renders.length,1,'A completed output lookup failure is recovered by GET, never by a new render');
  await button('schedule').click();
  await button('Schedule post').evaluate(b=>{b.click();b.click();});
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('ugc-explore:schedule:v1:owner:hook')??'null')?.scheduleId);
  assert.equal(schedules.length,1); assert.equal(schedules[0].source.id,receipts.get(renders[0].requestKey).outputId);
  assert.equal(schedules[0].caption,'Shared editor result'); assert.equal(await page.getByRole('dialog').count(),0);
  await page.reload(); await page.getByText('Your final video is ready.',{exact:false}).waitFor();
  await button('schedule').click(); await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent==='Schedule post'&&b.disabled));
  assert.equal(renders.length,1); assert.equal(schedules.length,1); assert.equal(uploads.length,0);
  console.log('PASS Talking Head: JSON saves only; one final raw composition with both exact trims/text and rebased framing; late output GET recovery; one direct schedule despite double-click; reload makes no renders, uploads or posts.');
  await button('edit').click(); await button('Edit hook video').click(); await page.getByLabel('Overlay text',{exact:true}).fill('Unsaved revision'); await button('Back to videos').click();
  assert.equal(await button('Prepare final video').isDisabled(),true); assert.equal(await page.getByLabel('Finished video preview',{exact:true}).count(),0,'changed edits invalidate the old final preview');
  await button('Replace opening fixture').click();
  await button('Edit hook video').click(); assert.equal(await page.getByLabel('Overlay text',{exact:true}).inputValue(),'','replacement source has its own draft'); await button('Back to videos').click();
  await button('Remove demo fixture').click();
  await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent==='Prepare final video'&&!b.disabled));
  await button('Prepare final video').click(); await waitRenders(2);
  assert.equal(renders[1].draft.sourceAssetId,id(5)); assert.equal(renders[1].draft.demoAssetId,null); assert.equal(renders[1].draft.demoAudioAssetId,null); assert.equal(renders[1].draft.demoFraming,undefined);
  assert.equal(renders[1].draft.composition.demoEditing,null); assert.equal((renders[1].draft.composition.sourceEditing.textOverlays??[]).length,0); assert.equal(renders[1].draft.composition.sourceEditing.text,null);
  complete(1); await page.getByText('Your final video is ready.',{exact:false}).waitFor();
  assert.equal(overlapping(),0); assert.deepEqual(errors,[]); assert.equal(schedules.length,1);
  console.log('PASS Talking Head: unsaved changes invalidate the old final video; replacement/removal cannot reuse stale clip edits, audio or framing; no overlapping renders or automatic posts.');
};
