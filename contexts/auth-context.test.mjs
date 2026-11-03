import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { beforeEach, mock, test } from "node:test";
import ts from "typescript";

// Execute the actual provider callbacks with a small hook harness. This tests
// asynchronous state writes without pretending to be a DOM/browser test.
let cells, cursor, effects, observer, refresh, logout;
mock.module("react", { namedExports: {
  createContext: () => ({ Provider: "provider" }),
  useContext: () => undefined,
  useState(initial) {
    const slot = cursor++;
    if (!(slot in cells)) cells[slot] = initial;
    return [cells[slot], value => { cells[slot] = value; }];
  },
  useEffect: effect => { effects.push(effect); },
  useCallback: callback => callback,
  useMemo: compute => compute(),
} });
mock.module("react/jsx-runtime", { namedExports: {
  jsx: (type, props) => ({ type, props }),
} });
mock.module("../lib/firebase/auth.ts", { namedExports: {
  listenToAuthState: (onUser, onError) => { observer = { onUser, onError }; return () => {}; },
  refreshCurrentFirebaseUser: () => refresh(),
  logout: () => logout(),
} });
const providerUrl = new URL("./auth-context.tsx", import.meta.url).href;
registerHooks({ load(url, context, nextLoad) {
  if (url !== providerUrl) return nextLoad(url, context);
  return { format: "module", shortCircuit: true, source: ts.transpileModule(
    readFileSync(new URL(url), "utf8"),
    { compilerOptions: { module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX } },
  ).outputText };
} });
const { AuthProvider } = await import("./auth-context.tsx");
const owner = { uid: "owner", emailVerified: true };
const other = { uid: "other", emailVerified: true };
function render() {
  cursor = 0;
  return AuthProvider({ children: null }).props.value;
}
function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}
beforeEach(() => {
  cells = []; effects = []; cursor = 0;
  refresh = async () => owner;
  logout = async () => observer.onUser(null);
  render();
  effects[0]();
  observer.onUser(owner);
});

test("a late refresh completion cannot overwrite a newer signed-in account", async () => {
  const pending = deferred();
  refresh = () => pending.promise;
  const request = render().refreshUser();
  observer.onUser(other);
  pending.resolve(owner);
  await request;
  assert.equal(render().user, other);
});

test("a late refresh completion cannot resurrect a signed-out session", async () => {
  const pending = deferred();
  refresh = () => pending.promise;
  const request = render().refreshUser();
  await render().signOut();
  pending.resolve(owner);
  await request;
  assert.equal(render().user, null);
});

test("an older refresh cannot overwrite a newer same-account verification notification", async () => {
  const pending = deferred();
  refresh = () => pending.promise;
  const request = render().refreshUser();
  const verified = { ...owner, emailVerified: true };
  observer.onUser(verified);
  pending.resolve({ ...owner, emailVerified: false });
  await request;
  assert.equal(render().user, verified);
});

test("refresh failures retain the current observer-owned user and propagate the error", async () => {
  const offline = new Error("offline");
  refresh = async () => { throw offline; };
  await assert.rejects(render().refreshUser(), error => error === offline);
  assert.equal(render().user, owner);
  assert.equal(render().error, offline);
});
