import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as client from '../lib/explore/clip-draft-client.ts';
import * as contract from '../lib/explore/clip-draft-contract.ts';

const source = '11111111-1111-4111-8111-111111111111', other = '22222222-2222-4222-8222-222222222222';
const content = { version: 1, sourceAssetId: source, editing: { version: 1, format: 'hook', trimStartMs: 0, trimEndMs: 5000, originalVolume: 1, musicVolume: .2, text: null }, backgroundAssetId: null, backgroundPlayback: 'once' };
const receipt = (value = content, revision = 1) => ({ id: '33333333-3333-4333-8333-333333333333', scope: 'hook:demo', revision, content: value, updatedAt: '2026-10-29T00:00:00Z' });
const tick = () => new Promise(resolve => setImmediate(resolve));
const transpiled = ts.transpileModule(readFileSync(new URL('../components/explore/use-clip-draft-save.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
function fixture() {
  let cursor = 0, state, denyRead = false, denyWrite = false;
  const slots = [], effects = [], storage = new Map(), writes = [], restores = [];
  const same = (a, b) => a && b && a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
  const react = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = { value: typeof initial === 'function' ? initial() : initial }; return [slots[i].value, next => { slots[i].value = typeof next === 'function' ? next(slots[i].value) : next; }]; },
    useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial }; },
    useCallback(fn, deps) { const i = cursor++; if (!slots[i] || !same(slots[i].deps, deps)) slots[i] = { fn, deps }; return slots[i].fn; },
    useEffect(fn, deps) { const i = cursor++; if (!slots[i] || !same(slots[i].deps, deps)) { const prior = slots[i]; slots[i] = { deps, cleanup: prior?.cleanup }; effects.push(() => { slots[i].cleanup?.(); slots[i].cleanup = fn(); }); } },
  };
  const props = { owner: 'owner-a', sourceAssetId: source, scope: 'hook:demo', content, enabled: true, onRestore: (value, explicit) => restores.push({ value, explicit }) };
  let read = async () => ({ ok: true, draft: null });
  let send = async body => ({ ok: true, requestId: body.requestId, replayed: false, draft: receipt(body.content) });
  const exports = {};
  vm.runInNewContext(transpiled, { exports, Error, AbortController,
    localStorage: { getItem(key) { if (denyRead) throw Error('Denied'); return storage.get(key) ?? null; }, setItem(key, value) { if (denyWrite) throw Error('Quota'); storage.set(key, value); }, removeItem(key) { if (denyWrite) throw Error('Quota'); storage.delete(key); } },
    fetch: async (url, options) => { if (options.method === 'GET') return Response.json(await read(url)); const body = JSON.parse(options.body); writes.push(body); return Response.json(await send(body)); },
    require(name) { if (name === 'react') return react; if (name.includes('firebase/auth')) return { getCurrentUserIdToken: async () => 'fixture' }; if (name.includes('clip-draft-client')) return client; if (name.includes('clip-draft-contract')) return contract; throw Error(name); },
  });
  const h = { props, storage, writes, restores, get state() { return state; }, set read(fn) { read = fn; }, set send(fn) { send = fn; }, denyReads(value) { denyRead = value; }, denyWrites(value) { denyWrite = value; },
    render() { cursor = 0; state = exports.useClipDraftSave(props); effects.splice(0).forEach(fn => fn()); return state; },
    async settle() { for (let i = 0; i < 3; i++) { await tick(); h.render(); } },
    cleanup() { for (const slot of slots) slot?.cleanup?.(); },
  };
  return h;
}

test('storage denial is actionable; retry loading preserves the current draft and never submits', async () => {
  const h = fixture(); h.read = async () => ({ ok: true, draft: receipt() }); h.denyReads(true); h.render(); await h.settle();
  assert.equal(h.state.loaded, false); assert.match(h.state.error, /Allow site storage.*keep it open/); assert.equal(h.writes.length, 0);
  h.props.content = { ...content, editing: { ...content.editing, originalVolume: .4 } };
  h.denyReads(false); h.state.reload(); h.render(); await h.settle();
  assert.equal(h.state.loaded, true); assert.equal(h.state.error, null); assert.equal(h.state.dirty, true);
  assert.equal(h.restores.at(-1).explicit, false, 'retry of failed initial load must not force server content over newer typing');
  assert.equal(h.writes.length, 0); h.cleanup();
});
test('storage write failure cannot submit; a same-screen retry retains the exact request', async () => {
  const h = fixture(); h.render(); await h.settle(); assert.equal(h.state.loaded, true);
  h.denyWrites(true); await h.state.save(); h.render();
  assert.match(h.state.error, /Browser storage is unavailable/); assert.equal(h.writes.length, 0); assert.equal(h.state.busy, false);
  h.denyWrites(false); const saved = await h.state.save(); h.render();
  assert.equal(saved.revision, 1); assert.equal(h.writes.length, 1); assert.equal(h.state.dirty, false);
  const key = client.clipDraftPendingKey('owner-a', 'hook:demo', source);
  assert.equal(h.storage.has(key), false); assert.equal(h.storage.get(`${key}:revision`), '1'); h.cleanup();
});
test('lost save acknowledgement replays one persisted request before accepting newer edits', async () => {
  const h = fixture(); h.render(); await h.settle(); let loseReply = true;
  h.send = async body => { if (loseReply) { loseReply = false; throw Error('Reply lost'); } return { ok: true, requestId: body.requestId, replayed: true, draft: receipt(body.content) }; };
  await h.state.save(); h.render(); assert.equal(h.state.busy, false); assert.match(h.state.error, /Reply lost/);
  const key = client.clipDraftPendingKey('owner-a', 'hook:demo', source), pending = JSON.parse(h.storage.get(key));
  const saved = await h.state.save(); h.render(); assert.equal(saved.revision, 1);
  assert.equal(h.writes.length, 2); assert.equal(h.writes[0].requestId, pending.requestId); assert.equal(h.writes[1].requestId, pending.requestId); h.cleanup();
});
test('old owner/source reads and save errors cannot overwrite the selected clip', async () => {
  const h = fixture(); let finishOldRead;
  h.read = () => new Promise(resolve => { finishOldRead = resolve; }); h.render(); await tick();
  h.props.owner = 'owner-b'; h.props.sourceAssetId = other; h.props.content = { ...content, sourceAssetId: other };
  h.read = async () => ({ ok: true, draft: null }); h.render(); await h.settle();
  finishOldRead({ ok: true, draft: receipt() }); await h.settle();
  assert.equal(h.state.loaded, true); assert.equal(h.restores.length, 0); assert.equal(h.state.saved, null);
  let rejectSave; h.send = () => new Promise((_, reject) => { rejectSave = reject; });
  const oldSave = h.state.save(); await tick();
  h.props.sourceAssetId = source; h.props.content = content; h.render(); await h.settle();
  rejectSave(Error('old save failed')); await oldSave; h.render();
  assert.equal(h.state.error, null); assert.equal(h.state.saved, null); assert.equal(h.state.busy, false); h.cleanup();
});
test('explicit reload of a loaded draft still replaces the revision after conflict', async () => {
  const h = fixture(); h.read = async () => ({ ok: true, draft: receipt() }); h.render(); await h.settle();
  h.read = async () => ({ ok: true, draft: receipt(content, 2) }); h.state.reload(); h.render(); await h.settle();
  assert.equal(h.restores.at(-1).explicit, true); assert.equal(h.state.saved.revision, 2);
  assert.equal(h.storage.get(`${client.clipDraftPendingKey('owner-a', 'hook:demo', source)}:revision`), '2'); h.cleanup();
});


test('retry after a failed draft read preserves unsaved local words and performs no save',async()=>{
 const h=fixture();h.read=async()=>{throw Error('Loading your saved edits took too long')};h.render();await h.settle();assert.equal(h.state.loaded,false);
 h.props.content={...content,editing:{...content.editing,originalVolume:.6}};
 h.read=async()=>({ok:true,draft:receipt()});h.state.reload();h.render();assert.equal(h.state.error,null);await h.settle();
 assert.equal(h.state.loaded,true);assert.equal(h.state.dirty,true);assert.equal(h.props.content.editing.originalVolume,.6);assert.equal(h.restores.at(-1).explicit,false);assert.equal(h.writes.length,0);h.cleanup();
});

test('changing restore callbacks cannot restart an in-flight or completed draft read', async () => {
  const h = fixture(); let reads = 0, release;
  h.read = () => { reads++; return new Promise(resolve => { release = resolve; }); };
  h.render(); await tick();
  for (let i = 0; i < 4; i++) { h.props.onRestore = (value, explicit) => h.restores.push({ value, explicit, latest: i }); h.render(); await tick(); }
  assert.equal(reads, 1);
  release({ ok: true, draft: receipt() }); await h.settle();
  assert.equal(h.state.loaded, true); assert.equal(h.restores.at(-1).latest, 3);
  h.props.onRestore = () => { throw Error('A parent render must not reload the draft'); }; h.render(); await h.settle();
  assert.equal(reads, 1); assert.equal(h.state.error, null); h.cleanup();
});

test('editing while a save is pending keeps newer work dirty and prevents duplicate saves', async () => {
  const h = fixture(); h.render(); await h.settle(); let release;
  h.send = body => new Promise(resolve => { release = () => resolve({ ok: true, requestId: body.requestId, replayed: false, draft: receipt(body.content) }); });
  const saving = h.state.save(); await tick(); h.render(); assert.equal(h.state.busy, true);
  h.props.content = { ...content, editing: { ...content.editing, originalVolume: .6 } }; h.render();
  await h.state.save(); assert.equal(h.writes.length, 1);
  release(); await saving; h.render();
  assert.equal(h.state.busy, false); assert.equal(h.state.dirty, true);
  assert.equal(h.props.content.editing.originalVolume, .6); assert.equal(h.state.saved.content.editing.originalVolume, 1);
  assert.equal(h.restores.length, 0); h.cleanup();
});

test('canceling an old draft load during authentication cannot fetch after the token arrives', async () => {
  let releaseToken, reads = 0;
  const controller = new AbortController();
  const loading = client.loadClipDraftWithInitial({ token: () => new Promise(resolve => { releaseToken = resolve; }), fetch: async () => { reads++; throw Error('late fetch'); } }, source, 'hook', controller.signal);
  const rejected = assert.rejects(loading, /cancelled/);
  controller.abort(Error('cancelled')); await rejected;
  releaseToken('fixture'); await tick(); assert.equal(reads, 0);
});
