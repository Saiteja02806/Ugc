import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const source = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const compile = text => ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
const settle = async () => { for (let i = 0; i < 40; i++) await Promise.resolve(); };
function fixture() {
  let now = 0, id = 0;
  const timers = new Map(), document = new EventTarget(), window = new EventTarget();
  document.visibilityState = 'visible';
  const globals = { document, window, navigator: { onLine: true }, Error, AbortController,
    setTimeout(fn, delay) { const key = ++id; timers.set(key, { fn, at: now + delay }); return key; },
    clearTimeout(key) { timers.delete(key); } };
  globals.AbortSignal = {
    any: AbortSignal.any.bind(AbortSignal),
    timeout(ms) { const controller = new AbortController(); globals.setTimeout(() => controller.abort(new DOMException('Read timed out', 'TimeoutError')), ms); return controller.signal; },
  };
  for (const file of ['lib/http/foreground-polling.ts', 'lib/http/read-deadline.ts']) {
    const exports = {};
    vm.runInNewContext(compile(source(file)), { ...globals, exports });
    Object.assign(globals, exports);
  }
  return { globals, async advance(ms) {
    const end = now + ms;
    while (true) {
      const next = [...timers].filter(([, value]) => value.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      now = next[1].at; timers.delete(next[0]); next[1].fn(); await settle();
    }
    now = end;
  } };
}
function runEffect(file, contains, globals) {
  const ast = ts.createSourceFile(file, source(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let callback;
  const visit = node => {
    if (ts.isCallExpression(node) && node.expression.getText(ast) === 'useEffect' && node.arguments[0]?.getText(ast).includes(contains)) callback = node.arguments[0].getText(ast);
    ts.forEachChild(node, visit);
  };
  visit(ast); assert.ok(callback);
  return vm.runInNewContext(compile(`const run = ${callback}; run();`), globals);
}
const terminal = new Set(['completed', 'failed', 'uncertain', 'cancelled']);
function audio(env, transport) {
  let data = { requests: [{ id: 'saved', requestKey: 'saved-key', status: 'running' }, { id: 'other', requestKey: 'other-key', status: 'running' }], assets: [] };
  const calls = [];
  const cleanup = runEffect('components/audio/audio-generation-workspace.tsx', 'pollInForeground', { ...env.globals,
    hasActive: true, hasOtherActiveJobs: true, restored: true, recoveryBlocked: false, activeRequests: data.requests,
    submission: { current: { key: 'saved-key' } }, uid: 'owner', liveId: 'saved', TERMINAL: terminal,
    api: async (path, init) => { calls.push(path); return transport(path, init); },
    queryClient: { getQueryState: () => ({ dataUpdatedAt: 123 }), setQueryData(key, update) { data = update(data); } },
    setSelectedAssetId() {}, setLiveId() {}, reconcileSubmission() {}, setError() {}, load: async () => {},
  });
  return { calls, cleanup, get data() { return data; } };
}
const pendingUntilAbort = signal => new Promise((resolve, reject) => {
  signal.throwIfAborted(); signal.addEventListener('abort', () => reject(signal.reason), { once: true });
});

test('Audio recurring reads recover after a hung request instead of pinning the single-flight loop', async () => {
  const env = fixture();
  const h = audio(env, (path, init) => pendingUntilAbort(init.signal));
  try {
    await env.advance(120_000);
    assert.ok(h.calls.length > 1, `Expected a bounded GET and retry; observed ${h.calls.length} read in two minutes`);
  } finally { h.cleanup(); await settle(); }
});

test('Reaction recurring reads recover after a hung request', async () => {
  const env = fixture(); let calls = 0;
  const cleanup = runEffect('components/trending/reaction-text-editor.tsx', 'pollInForeground', { ...env.globals,
    assignmentId: 'assignment', creativeId: 'creative', initializedIdentity: { current: null }, updatedRef: { current() {} },
    setEdit() {}, setText() {}, setError() {},
    fetchReactionTextEdit: async (item, body, signal) => { calls++; return pendingUntilAbort(signal); },
  });
  try { await env.advance(120_000); assert.ok(calls > 1, `Expected a bounded GET and retry; observed ${calls} read in two minutes`); }
  finally { cleanup(); await settle(); }
});

test('Audio absent saved receipt does not starve another active job of status recovery', async () => {
  const env = fixture();
  const h = audio(env, path => ({ assets: [], requests: path.includes('requestKey=') ? [] : [{ id: 'other', requestKey: 'other-key', status: 'completed' }] }));
  try {
    await env.advance(120_000);
    assert.equal(h.data.requests.find(job => job.id === 'other')?.status, 'completed', `Other job never reconciled; reads: ${h.calls.join(', ')}`);
  } finally { h.cleanup(); }
});

test('Audio successful general status survives failure reading a separate saved receipt', async () => {
  const env = fixture();
  const h = audio(env, path => {
    if (path.includes('requestKey=')) throw new Error('Saved receipt temporarily unavailable');
    return { assets: [], requests: [{ id: 'other', requestKey: 'other-key', status: 'completed' }] };
  });
  try {
    await env.advance(120_000);
    assert.equal(h.data.requests.find(job => job.id === 'other')?.status, 'completed', 'A failed independent receipt lookup must not discard the successful other-job status');
    assert.equal(h.data.requests.find(job => job.id === 'saved')?.status, 'running', 'The unresolved receipt must remain recoverable');
  } finally { h.cleanup(); }
});
