import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { withReadDeadline, ReadDeadlineError } from '../lib/http/read-deadline.ts';

const read = p => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const turn = () => new Promise(setImmediate);
function load(path, imports, globals = {}) {
  const exports = {};
  const code = ts.transpileModule(read(path), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { exports, ...globals, require(name) {
    assert.ok(name in imports, `Unexpected import ${name}`);
    return imports[name];
  } });
  return exports;
}
function gate(token, fetch) {
  const owners = [];
  const mod = load('lib/business-profiles/profile-gate-query.ts', {
    '@/lib/firebase/auth': { getCurrentUserIdToken: owner => { owners.push(owner); return token(); } },
    '@/lib/http/read-deadline': { ReadDeadlineError, withReadDeadline },
  }, { fetch, TypeError });
  return { ...mod, owners };
}

test('profile gate blocks late fetch after a cancelled token wait and binds the owner', async () => {
  let release; const calls = [];
  const g = gate(() => new Promise(resolve => { release = resolve; }), async (...args) => { calls.push(args); return Response.json({ ok: true, profile: { onboardingComplete: true } }); });
  const abort = new AbortController();
  const pending = g.fetchBusinessProfileGate('owner-a', abort.signal);
  abort.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  release('late-token'); await turn();
  assert.equal(calls.length, 0);
  assert.deepEqual(g.owners, ['owner-a']);
});

test('current profile gate releases a stalled token at its 20-second deadline', async t => {
  const abort = new AbortController();
  t.mock.method(AbortSignal, 'timeout', ms => { assert.equal(ms, 20000); return abort.signal; });
  let calls = 0;
  const g = gate(() => new Promise(() => {}), async () => { calls++; });
  const pending = g.fetchBusinessProfileGate('owner-a'); abort.abort();
  await assert.rejects(pending, error => error instanceof ReadDeadlineError);
  assert.equal(calls, 0);
});

test('actual AuthGuard retains verified workspace only for temporary failures', async () => {
  const policy = gate(async () => 'token', async () => Response.json({}));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  const key = ['business-profile-gate', 'owner-a'];
  client.setQueryData(key, { onboardingComplete: true }, { updatedAt: Date.now() - 31 * 60000 });
  const observer = new QueryObserver(client, { queryKey: key, enabled: false, queryFn: async () => { throw new policy.BusinessProfileGateError('temporary outage', 503); }, retry: false });
  const unsubscribe = observer.subscribe(() => {});
  const result = await observer.refetch();
  assert.equal(result.isRefetchError, true);
  assert.equal(result.data.onboardingComplete, true);
  const element = (type, props) => ({ type, props });
  const { AuthGuard } = load('components/auth/auth-guard.tsx', {
    '@tanstack/react-query': { useQuery: () => result },
    'lucide-react': { AlertCircle: 'icon', LoaderCircle: 'icon', RefreshCw: 'icon' },
    'next/navigation': { useRouter: () => ({ replace() {} }) },
    react: { useEffect() {}, useSyncExternalStore: () => false },
    'react/jsx-runtime': { jsx: element, jsxs: element },
    '@/components/ui/alert': { Alert: 'alert', AlertTitle: 'title', AlertDescription: 'description' },
    '@/components/ui/button': { Button: 'button' },
    '@/contexts/auth-context': { useAuth: () => ({ user: { uid: 'owner-a', emailVerified: true }, loading: false }) },
    '@/lib/business-profiles/profile-gate-query': policy,
  });
  const workspace = { type: 'workspace-with-sidebar' };
  const tree = AuthGuard({ children: workspace });
  assert.equal(tree, workspace);
  for (const status of [401, 403, 400]) {
    result.error = new policy.BusinessProfileGateError('Access denied', status);
    assert.equal(AuthGuard({ children: workspace }).type, 'main');
  }
  result.error = new Error('Unknown failure');
  assert.equal(AuthGuard({ children: workspace }).type, 'main');
  result.error = new policy.BusinessProfileGateError('temporary outage', 503);
  result.data = undefined;
  assert.equal(AuthGuard({ children: workspace }).type, 'main', 'first-load failures remain blocked');
  unsubscribe(); observer.destroy(); client.clear();
});

test('sidebar and Explore links use shared navigation recovery without automatic reloads', () => {
  for (const file of ['components/layout/app-sidebar.tsx', 'components/explore/explore-workspace.tsx', 'components/explore/explore-workflow-card.tsx', 'components/explore/ai-character-card.tsx']) {
    assert.match(read(file), /WorkspaceLink as Link/);
  }
  const source = read('components/layout/workspace-navigation-feedback.tsx');
  assert.match(source, /Open page in a new tab/);
  assert.doesNotMatch(source, /location\.(assign|replace|reload)|router\.(push|replace)|fetch\(/);
});

test('profile gate distinguishes permission failures, upstream outages and incomplete setup', async () => {
  for (const status of [401, 403, 429, 500, 503]) {
    const g = gate(async () => 'token', async () => Response.json({ message: 'fixture failure' }, { status }));
    let error;
    try { await g.fetchBusinessProfileGate('owner-a'); } catch (value) { error = value; }
    assert.equal(error.status, status);
    assert.equal(g.canRetainBusinessProfileGate({ onboardingComplete: true }, error), status === 429 || status >= 500);
    assert.equal(g.canRetainBusinessProfileGate(undefined, error), false);
    assert.equal(g.canRetainBusinessProfileGate({ onboardingComplete: false }, error), false);
  }
  const g = gate(async () => { throw Error('Account changed'); }, async () => assert.fail('wrong-owner request'));
  await assert.rejects(g.fetchBusinessProfileGate('owner-a'), /Account changed/);
  const network = gate(async () => 'token', async () => { throw new TypeError('Network failed'); });
  let error;
  try { await network.fetchBusinessProfileGate('owner-a'); } catch (value) { error = value; }
  assert.equal(error.status, 503);
  assert.equal(network.canRetainBusinessProfileGate({ onboardingComplete: true }, error), true);
  assert.equal(network.canRetainBusinessProfileGate({ onboardingComplete: true }, new ReadDeadlineError()), true);
});

test('installed Next route transport has no request deadline for stalled headers', async t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const exports = {}; let captured, release;
  const code = read('node_modules/next/dist/client/components/router-reducer/fetch-server-response.js');
  vm.runInNewContext(code, {
    exports, module: { exports }, URL, console,
    process: { env: { NODE_ENV: 'production' } },
    setTimeout, clearTimeout,
    require(name) {
      if (name === '../segment-cache/fetch') return { fetch: (_url, init) => { captured = init; return new Promise(resolve => { release = resolve; }); } };
      if (name === './set-cache-busting-search-param') return { setCacheBustingSearchParam() {} };
      if (name === '../../../shared/lib/deployment-id') return { getDeploymentId() {} };
      return {};
    },
  });
  let settled = false;
  const pending = exports.createFetch(new URL('https://fixture.invalid/dashboard'), {}, 'auto', false);
  pending.then(() => { settled = true; });
  await turn();
  t.mock.timers.tick(30 * 60000); await turn();
  assert.equal(settled, false);
  assert.equal(captured.signal, undefined);
  release({ url: 'https://fixture.invalid/dashboard', ok: true, status: 200, redirected: false, headers: new Headers(), body: null });
  await pending;
  assert.equal(settled, true);
});
