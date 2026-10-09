/* eslint-disable @typescript-eslint/no-require-imports -- Isolated browser regression runner. */
// Runs the real editors, durable finishing hook and scheduling panel. Auth,
// storage and publishing HTTP boundaries use fixtures; no live account writes.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { webpack } = require("next/dist/compiled/webpack/webpack");
let playwright;
try { playwright = require("playwright"); }
catch { playwright = require(path.join(process.env.USERPROFILE, ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright")); }
const root = path.resolve(__dirname, ".."), out = path.join(root, ".tmp/format-hook-schedule-browser");
fs.mkdirSync(out, { recursive: true });
const file = (name, content) => fs.writeFileSync(path.join(out, name), content);
file("loader.cjs", `const ts = require(${JSON.stringify(require.resolve("typescript"))}); module.exports = source => ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX } }).outputText;`);
file("css.cjs", `module.exports = () => 'export default new Proxy({}, {get: (_, name) => name});';`);
file("auth.ts", `export const useAuth = () => ({user: {uid: "owner"}}); export const getCurrentUserIdToken = async () => "fixture-owner";`);
file("media.ts", `export async function fetchAIStudioMediaAsset(id) { const response = await fetch('/fixture-media/' + id); if (!response.ok) throw new Error('Unavailable fixture'); return response.json(); }
export async function uploadAIStudioReferenceMedia() { throw new Error('Unexpected upload'); }`);
file("ui.tsx", `export const Button = ({variant, size, ...props}) => <button {...props}/>; export const Input = props => <input {...props}/>;
export const WorkflowFilePicker = () => null; export const WorkflowSavedAudioPicker = () => null;
export const WorkflowMediaPlayer = ({asset, label}) => <video aria-label={label} src={asset.url} controls style={{width: 200}}/>;
export const WorkflowVideoStartActions = () => <p>Add a video</p>;
export const WorkflowVideoAssetPicker = ({open, onSelect, onOpenChange}) => open ? <div role="dialog"><button onClick={async () => { const asset = await (await fetch('/fixture-media/00000000-0000-4000-8000-000000000002')).json(); onSelect(asset); onOpenChange(false); }}>Choose demo fixture</button></div> : null;
export const useAccountTimeZone = () => 'Asia/Calcutta';`);
file("dynamic.tsx", `import {lazy, Suspense} from 'react'; export default loader => { const Component = lazy(async () => ({default: await loader()})); return props => <Suspense fallback={null}><Component {...props}/></Suspense>; };`);
file("link.tsx", `export default props => <a {...props}/>;`);
file("schedule.tsx", `export function ScheduleEditor(props) { return <div role="dialog" aria-label="Confirm schedule"><p>{props.initialCaption}</p><button onClick={() => props.onSave({scheduledSource: {kind: 'media_asset', id: props.initialDemoMediaId}, targets: props.initialPlannedTargets, caption: props.initialCaption, scheduledFor: '2026-12-01T05:00:00Z', scheduledDate: props.initialScheduledDate, scheduledTime: props.initialScheduledTime, timezone: 'Asia/Calcutta'})}>Confirm fixture schedule</button></div>; }`);
file("entry.tsx", `import {createRoot} from 'react-dom/client'; import {useState, useCallback} from 'react'; import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {FormatVideoEditor} from '@/components/explore/format-video-editor'; import {FormatDemoWorkspace} from '@/components/explore/format-demo-workspace'; import {FormatSchedulePanel} from '@/components/explore/format-schedule-panel';
const video = {id: '00000000-0000-4000-8000-000000000001', mediaAssetId: '00000000-0000-4000-8000-000000000001', title: 'Original hook', url: '/video.mp4', durationSeconds: 8, ratio: '16:9'};
function Fixture() { const [step, setStep] = useState('demo'), [request, setRequest] = useState(0), [opening, setOpening] = useState(null), [combined, setCombined] = useState(null), [hasDemo, setHasDemo] = useState(false), [openingStatus, setOpeningStatus] = useState(null), [demoStatus, setDemoStatus] = useState(null);
const [editControls, ec] = useState(null), [editResults, er] = useState(null), [demoControls, dc] = useState(null), [demoResults, dr] = useState(null), [demoActions, da] = useState(null), [scheduleResults, sr] = useState(null);
const changeDemo = useCallback(present => { setHasDemo(present); setCombined(null); }, []); const dirtyHook = useCallback(() => {setOpening(null); setCombined(null);}, []);
const saveOpening = useCallback(setOpening, []), saveCombined = useCallback(setCombined, []), reportOpening = useCallback(setOpeningStatus, []), reportDemo = useCallback(setDemoStatus, []);
const schedule = () => {setRequest(n => n + 1); setStep('schedule');}; const final = hasDemo ? combined : opening;
return <><button onClick={() => setStep('demo')}>Demo tab</button><button onClick={schedule}>Schedule tab</button><button onClick={() => setStep('edit')}>Edit hook tab</button>
<div hidden={step !== 'edit'}><div ref={ec}/><div ref={er}/></div><div hidden={step !== 'demo'}><div ref={dc}/><div ref={dr}/><div ref={da}/></div><div hidden={step !== 'schedule'} ref={sr}/>
<FormatSchedulePanel output={final} localPreview={false} imageOnly={false} active={step === 'schedule'} preparing={!final}/>
<FormatVideoEditor format="hook" video={video} active={step === 'edit'} controlsTarget={editControls} resultsTarget={editResults} enabled onDirty={dirtyHook} onSaved={saveOpening} onContinue={() => setStep('demo')} prepareRequest={step === 'schedule' && !demoStatus?.busy ? request : 0} onPreparationChange={reportOpening}/>
<FormatDemoWorkspace ownerId="owner" enabled localPreview={false} active={step === 'demo'} opening={opening} sourcePreview={{name: video.title, url: video.url, duration: 8}} controlsTarget={demoControls} resultsTarget={demoResults} actionsTarget={demoActions} onChooseSource={() => {}} onDemoChange={changeDemo} onSaved={saveCombined} onContinue={schedule} scheduleActive={step === 'schedule'} scheduleResultsTarget={scheduleResults} prepareRequest={step === 'schedule' ? request : 0} finalOutput={final} openingPreparation={openingStatus} onEditOpening={() => setStep('edit')} sourceAssetId={video.id} onPreparationChange={reportDemo}/></>; }
createRoot(document.getElementById('root')).render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><Fixture/></QueryClientProvider>);`);

const makeAsset = (id, title) => ({ id, title, collection: "video", status: "ready", sourceType: "upload", createdAt: "2026-10-09T00:00:00Z", updatedAt: "2026-10-09T00:00:00Z", mimeType: "video/mp4", fileName: "video.mp4", fileSizeBytes: 2000, durationSeconds: 8, width: 1280, height: 720, ratio: "16:9", metadata: {}, parentAssetId: null, projectId: null, sourceRecordId: null, thumbnailUrl: null, url: "/video.mp4" });
const assets = new Map([1, 2].map(n => { const id = `00000000-0000-4000-8000-00000000000${n}`; return [id, makeAsset(id, n === 1 ? "Original hook" : "Original demo")]; }));
const connectionId = "00000000-0000-4000-8000-000000000099";
const connections = [{ id: connectionId, platform: "instagram", platformAccountName: "Fixture", platformAccountUsername: "fixture", status: "connected", scopes: ["instagram_business_content_publish"], supportsBackgroundRefresh: true }];
const receipts = new Map(), renders = [], schedules = [];
let overlappingRenders = 0;
function json(response, body) { response.setHeader("Content-Type", "application/json"); response.end(JSON.stringify(body)); }
async function main() {
  const ui = path.join(out, "ui.tsx"), media = path.join(out, "media.ts");
  const aliases = { "@/contexts/auth-context": path.join(out, "auth.ts"), "@/lib/firebase/auth": path.join(out, "auth.ts"), "@/lib/ai-studio/media-client": media, "@/lib/ai-studio/reference-media-upload": media, "@/components/scheduling/schedule-editor": path.join(out, "schedule.tsx"), "next/dynamic": path.join(out, "dynamic.tsx"), "next/link": path.join(out, "link.tsx"), "@": root };
  for (const modulePath of ['components/ui/button', 'components/ui/input', 'components/explore/hook-workflow-media-controls', 'components/explore/workflow-saved-audio-picker', 'components/explore/workflow-video-start-actions', 'components/explore/workflow-video-asset-picker', 'components/providers/account-timezone-provider']) aliases['@/' + modulePath] = ui;
  delete aliases['@']; aliases['@'] = root;
  await new Promise((resolve, reject) => { const compiler = webpack({mode: "development", devtool: false, context: root, entry: path.join(out, "entry.tsx"), output: {path: out, filename: "bundle.js"}, resolve: {extensions: ['.tsx', '.ts', '.js'], alias: aliases}, module: {rules: [{test: /\.tsx?$/, use: path.join(out, "loader.cjs")}, {test: /\.css$/, use: path.join(out, "css.cjs")}]}}); compiler.run((error, stats) => compiler.close(() => error || stats.hasErrors() ? reject(error || new Error(stats.toString({all:false, errors:true}))) : resolve())); });
  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, 'http://fixture');
    if (url.pathname === '/fixture') { response.setHeader('Content-Type', 'text/html'); return response.end('<div id="root"></div><script>window.process={env:{}}</script><script src="/bundle.js"></script>'); }
    if (url.pathname === '/bundle.js') { response.setHeader('Content-Type', 'text/javascript'); return response.end(fs.readFileSync(path.join(out, 'bundle.js'))); }
    if (/^\/[a-zA-Z0-9_-]+\.bundle\.js$/.test(url.pathname) && fs.existsSync(path.join(out, path.basename(url.pathname)))) { response.setHeader('Content-Type', 'text/javascript'); return response.end(fs.readFileSync(path.join(out, path.basename(url.pathname)))); }
    if (url.pathname === '/video.mp4') {
      const bytes = fs.readFileSync(path.join(root, 'public/explore/covers/hook-video-v1.mp4'));
      response.setHeader('Content-Type', 'video/mp4'); response.setHeader('Accept-Ranges', 'bytes');
      const range = /^bytes=(\d+)-(\d*)$/.exec(request.headers.range ?? '');
      if (range) { const start = Number(range[1]), end = range[2] ? Math.min(Number(range[2]), bytes.length - 1) : bytes.length - 1; response.statusCode = 206; response.setHeader('Content-Range', `bytes ${start}-${end}/${bytes.length}`); response.setHeader('Content-Length', end - start + 1); return response.end(bytes.subarray(start, end + 1)); }
      response.setHeader('Content-Length', bytes.length); return response.end(bytes);
    }
    if (url.pathname.startsWith('/fixture-media/')) return json(response, assets.get(url.pathname.split('/').at(-1)));
    if (url.pathname.startsWith('/api/')) assert.equal(request.headers.authorization, 'Bearer fixture-owner');
    if (url.pathname === '/api/social/connections') return json(response, {ok:true, connections});
    if (url.pathname === '/api/explore/finishes') {
      let receipt;
      if (request.method === 'POST') {
        let body = ''; for await (const chunk of request) body += chunk;
        const entry = JSON.parse(body); receipt = receipts.get(entry.requestKey);
        if (!receipt) {
          if ([...receipts.values()].some(value => value.outcome === 'pending')) { overlappingRenders++; response.statusCode = 409; return json(response, {ok:false, error:'A finishing job is already running.'}); }
          const n = renders.length + 10; const id = `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`; receipt = {ok:true, receiptVersion:1, requestKey:entry.requestKey, jobId:id, outcome:'pending', mediaAssetId:null, message:'Preparing fixture video…', outputId:id}; receipts.set(entry.requestKey, receipt); renders.push(entry); assets.set(id, makeAsset(id, entry.draft.demoAssetId ? 'Combined hook and demo' : 'Edited clip'));
        }
      } else receipt = receipts.get(url.searchParams.get('requestKey'));
      return json(response, receipt);
    }
    if (url.pathname === '/api/schedules' && request.method === 'GET') return json(response, {ok:true, minimumScheduleLeadMinutes:5});
    if (url.pathname === '/api/schedules' && request.method === 'POST') {
      let body = ''; for await (const chunk of request) body += chunk; const input = JSON.parse(body); schedules.push(input);
      return json(response, {ok:true, schedule:{id:'00000000-0000-4000-8000-000000000098', mediaAssetId:input.source.id, idempotencyKey:input.idempotencyKey, status:'scheduled', targets:input.targets.map(target => ({socialConnectionId:target.connectionId, platform:target.platform}))}});
    }
    response.statusCode = 404; response.end();
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try { browser = await playwright.chromium.launch({headless:true, ...(process.platform === 'win32' ? {channel:'msedge'} : {})}); }
  catch (e) { await new Promise(resolve => server.close(resolve)); throw e; }
  const page = await browser.newPage(); page.setDefaultTimeout(20000); const errors = []; page.on('pageerror', e => errors.push(e.message));
  const base = `http://127.0.0.1:${server.address().port}`;
  async function waitRenders(count) { const deadline = Date.now() + 20000; while (renders.length < count && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 50)); assert.equal(renders.length, count); }
  function complete(index) { const entry = renders[index], receipt = receipts.get(entry.requestKey); receipt.outcome = 'completed'; receipt.mediaAssetId = receipt.outputId; receipt.message = 'Saved fixture'; }
  try {
    await page.goto(base + '/fixture');
    await page.getByRole('button', {name:'Creative Assets', exact:true}).click(); await page.getByRole('button', {name:'Choose demo fixture'}).click();
    await page.getByRole('button', {name:'Edit demo video', exact:true}).click();
    await page.waitForFunction(() => document.querySelector('section[aria-label="Video edit preview"] video')?.readyState >= 2);
    assert.equal(await page.getByLabel('Overlay text', {exact:true}).inputValue(), '');
    await page.getByLabel('Overlay text', {exact:true}).fill('First message'); await page.getByLabel('Text end time').fill('2');
    await page.getByRole('button', {name:'Add text', exact:true}).click(); await page.getByLabel('Overlay text', {exact:true}).fill('Second message'); await page.getByLabel('Text start time').fill('3'); await page.getByLabel('Text end time').fill('5');
    await page.getByRole('button', {name:'Edit text block 2', exact:true}).click();
    await page.getByLabel('Text overlay preview', {exact:true}).getByText('Second message', {exact:true}).waitFor();
    await page.getByRole('button', {name:'Edit text block 1', exact:true}).click(); assert.equal(await page.getByLabel('Text overlay preview', {exact:true}).textContent(), 'First message');
    await page.getByRole('button', {name:'Add text', exact:true}).click();
    assert.equal(await page.getByLabel('Overlay text', {exact:true}).inputValue(), '');
    await page.getByRole('button', {name:'Back to previews', exact:true}).last().click();
    await page.getByRole('button', {name:'Schedule', exact:true}).evaluate(button => {button.click(); button.click();});
    await page.getByRole('region', {name:'Schedule video preview'}).waitFor();
    assert.equal(await page.getByLabel('Scheduled hook preview', {exact:true}).isVisible(), true); assert.equal(await page.getByLabel('Scheduled demo preview', {exact:true}).isVisible(), true);
    await page.getByRole('button', {name:'Instagram', exact:true}).click(); await page.getByRole('button', {name:'Post to @fixture on Instagram', exact:true}).click();
    await page.getByLabel('Post caption', {exact:true}).fill('My preserved caption'); await page.getByLabel('Date', {exact:true}).fill('2026-12-01'); await page.getByLabel('Time', {exact:true}).fill('10:30');
    assert.equal(await page.getByRole('button', {name:'Review schedule', exact:true}).isDisabled(), true); assert.equal(schedules.length, 0);
    await waitRenders(1); assert.equal(renders[0].draft.sourceAssetId, '00000000-0000-4000-8000-000000000001');
    assert.equal(renders[0].draft.editing.text, null); assert.equal(Object.hasOwn(renders[0].draft.editing, 'textOverlays'), false); complete(0);
    await waitRenders(2); assert.equal(renders[1].draft.sourceAssetId, '00000000-0000-4000-8000-000000000002'); assert.deepEqual(renders[1].draft.editing.textOverlays.map(t => [t.value,t.startMs,t.endMs]), [['First message',0,2000],['Second message',3000,5000]]); complete(1);
    await waitRenders(3); assert.equal(renders[2].draft.sourceAssetId, receipts.get(renders[0].requestKey).outputId); assert.equal(renders[2].draft.demoAssetId, receipts.get(renders[1].requestKey).outputId); complete(2);
    await page.getByRole('region', {name:'Final post preview'}).waitFor();
    assert.equal(await page.getByLabel('Post caption', {exact:true}).inputValue(), 'My preserved caption'); assert.equal(await page.getByLabel('Date', {exact:true}).inputValue(), '2026-12-01'); assert.equal(await page.getByLabel('Time', {exact:true}).inputValue(), '10:30');
    await page.getByRole('button', {name:'Review schedule', exact:true}).click(); await page.getByRole('dialog', {name:'Confirm schedule'}).waitFor(); assert.equal(schedules.length, 0);
    await page.getByRole('button', {name:'Confirm fixture schedule'}).evaluate(button => {button.click(); button.click();}); await page.getByRole('button', {name:'Check saved schedule'}).waitFor();
    assert.equal(schedules.length, 1); assert.equal(schedules[0].source.id, receipts.get(renders[2].requestKey).outputId); assert.equal(schedules[0].caption, 'My preserved caption');
    console.log('PASS: immediate two-clip preview, serialized hook/demo/combined preparation, timed text export, schedule settings retained, one confirmed combined-video schedule');
    await page.reload(); await page.getByLabel('Demo preview', {exact:true}).waitFor(); await page.getByRole('button', {name:'Edit demo video', exact:true}).click();
    await page.getByRole('button', {name:'Edit text block 2', exact:true}).click(); assert.equal(await page.getByLabel('Overlay text', {exact:true}).inputValue(), 'Second message'); assert.equal(await page.getByLabel('Text start time').inputValue(), '3');
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('ugc-explore:demo-selection:v1:owner:00000000-0000-4000-8000-000000000001')));
    assert.equal(stored.demoAssetId, '00000000-0000-4000-8000-000000000002'); assert.equal(stored.editedDemoAssetId, receipts.get(renders[1].requestKey).outputId);
    assert.equal(renders.length, 3); assert.equal(schedules.length, 1); assert.deepEqual(errors, []);
    console.log('PASS: reload restores the original demo, editable text sequence and saved results through read-only recovery');
    await page.evaluate(() => localStorage.clear()); await page.reload();
    await page.getByRole('button', {name:'Creative Assets', exact:true}).click(); await page.getByRole('button', {name:'Choose demo fixture'}).click();
    await page.getByRole('button', {name:'Edit demo video', exact:true}).click();
    await page.getByLabel('Overlay text', {exact:true}).fill('Manual demo edit');
    await page.getByRole('button', {name:'Apply demo edits', exact:true}).click(); await waitRenders(4);
    await page.getByRole('button', {name:'Cancel save', exact:true}).waitFor();
    await page.getByRole('button', {name:'Schedule', exact:true}).click();
    await page.getByLabel('Post caption', {exact:true}).fill('While the demo saves');
    assert.equal(renders[3].draft.sourceAssetId, '00000000-0000-4000-8000-000000000002'); assert.equal(renders.length, 4);
    complete(3); await waitRenders(5); assert.equal(renders[4].draft.sourceAssetId, '00000000-0000-4000-8000-000000000001'); complete(4);
    await waitRenders(6); assert.equal(renders[5].draft.demoAssetId, receipts.get(renders[3].requestKey).outputId); complete(5);
    await page.getByRole('region', {name:'Final post preview'}).waitFor();
    assert.equal(await page.getByLabel('Post caption', {exact:true}).inputValue(), 'While the demo saves'); assert.equal(overlappingRenders, 0); assert.equal(schedules.length, 1); assert.deepEqual(errors, []);
    console.log('PASS: entering Schedule during a manual demo render waits, then prepares the hook and combined video without concurrent jobs or automatic posting');
    await page.evaluate(() => localStorage.clear()); await page.reload();
    await page.getByRole('button', {name:'Creative Assets', exact:true}).click(); await page.getByRole('button', {name:'Choose demo fixture'}).click();
    await page.getByRole('button', {name:'Schedule', exact:true}).evaluate(button => {button.click(); button.click();});
    await page.getByRole('region', {name:'Schedule video preview'}).waitFor();
    assert.equal(await page.getByLabel('Scheduled hook preview', {exact:true}).isVisible(), true); assert.equal(await page.getByLabel('Scheduled demo preview', {exact:true}).isVisible(), true);
    await waitRenders(7);
    assert.equal(renders[6].draft.sourceAssetId, '00000000-0000-4000-8000-000000000001');
    assert.equal(renders[6].draft.editing.text, null); assert.equal(Object.hasOwn(renders[6].draft.editing, 'textOverlays'), false); complete(6);
    await waitRenders(8);
    assert.equal(renders[7].draft.sourceAssetId, receipts.get(renders[6].requestKey).outputId);
    assert.equal(renders[7].draft.demoAssetId, '00000000-0000-4000-8000-000000000002'); complete(7);
    await page.getByRole('region', {name:'Final post preview'}).waitFor();
    assert.equal(renders.length, 8); assert.equal(overlappingRenders, 0); assert.equal(schedules.length, 1); assert.deepEqual(errors, []);
    console.log('PASS: hook and demo with no edits prepare a final video, reuse the original demo, and never schedule before confirmation');
  } catch (e) { console.error({errors, body: await page.locator('body').innerText(), renders}); throw e; }
  finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => {console.error(error); process.exitCode = 1;});
