import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const load = (file, imports = {}, suffix = "") => {
  const exported = {};
  vm.runInNewContext(ts.transpileModule(read(file), { fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText + suffix, {
    exports: exported, require(name) { assert.ok(name in imports, `Unexpected import ${name}`); return imports[name]; },
  });
  return exported;
};
const types = load("lib/social/types.ts");
const policy = load("lib/scheduling/social-connection-policy.ts");
const client = load("lib/explore/workflow-connected-accounts.ts", { "../social/types": types, "../scheduling/social-connection-policy": policy });
const account = (overrides = {}) => ({ id: "connection-a", platform: "instagram", platformAccountName: "Example App", platformAccountUsername: "example_app", status: "connected", scopes: ["instagram_business_content_publish"], supportsBackgroundRefresh: false, ...overrides });
const payload = (connections = [account()]) => ({ ok: true, connections });
const plain = (value) => JSON.parse(JSON.stringify(value));
const element = (type, props = {}) => ({ type, props });
const nodes = (value) => value == null ? [] : Array.isArray(value) ? value.flatMap(nodes) : typeof value === "object" ? [value, ...nodes(value.props?.children)] : [];
const text = (value) => value == null ? "" : Array.isArray(value) ? value.map(text).join(" ") : typeof value === "object" ? text(value.props?.children) : String(value);
function ui(state = {}) {
  const queries = [];
  const component = load("components/explore/workflow-connected-accounts.tsx", {
    "@tanstack/react-query": { useQuery(options) { queries.push(options); return { data: [account()], isPending: false, isError: false, isFetching: false, refetch() {}, ...state }; } },
    "lucide-react": { Check: "check" }, "next/link": { default: "link" },
    "@/components/ui/button": { Button: "button" },
    "@/components/explore/workflow-creation.module.css": { default: {} },
    "@/lib/explore/workflow-connected-accounts": client,
    "@/lib/firebase/auth": { getCurrentUserIdToken: async (owner) => `fake-token-${owner}` },
    "react/jsx-runtime": { jsx: element, jsxs: element },
  }, "\nexports.testConnectedAccounts = ConnectedAccounts;");
  return { ...component, queries };
}

test("connected account parser preserves only display/selection properties", () => {
  const result = client.parseWorkflowConnectedAccounts(payload([account({ accessToken: "must-not-retain", unexpected: true })]));
  assert.deepEqual(plain(result), [account()]);
  assert.equal(client.workflowAccountLabel(result[0]), "@example_app");
  assert.equal(client.workflowAccountLabel(account({ platformAccountUsername: "@@example_app" })), "@example_app");
  assert.equal(client.workflowAccountLabel(account({ platformAccountUsername: null })), "Example App");
});

test("malformed or duplicate accounts fail closed, never appear as an empty success", () => {
  for (const value of [null, { ok: false }, { ok: true, connections: null }, payload([account(), account()]),
    payload([account({ platform: "other" })]), payload([account({ id: "a/b" })]),
    payload([account({ scopes: null })]), payload([account({ status: "unknown" })]),
    payload([account({ platformAccountUsername: "x".repeat(513) })]), payload([account({ supportsBackgroundRefresh: "false" })])]) {
    assert.throws(() => client.parseWorkflowConnectedAccounts(value), /Could not/);
  }
  assert.deepEqual(plain(client.parseWorkflowConnectedAccounts(payload([]))), []);
});

test("account lookup uses only authenticated no-store GET and forwards cancellation", async () => {
  const calls = [], signal = new AbortController().signal;
  const result = await client.loadWorkflowConnectedAccounts({ getOwnerToken: async () => "fake-token-a", assertActive() {}, fetch: async (...args) => { calls.push(args); return new Response(JSON.stringify(payload())); } }, signal);
  assert.equal(result.length, 1);
  assert.equal(calls[0][0], "/api/social/connections");
  assert.equal(calls[0][1].method, "GET");
  assert.equal(calls[0][1].cache, "no-store");
  assert.equal(calls[0][1].headers.Authorization, "Bearer fake-token-a");
  assert.equal(calls[0][1].signal, signal);
  assert.equal(calls[0][1].body, undefined);
});

test("missing authentication and account changes prevent fetching or applying a stale result", async () => {
  let calls = 0;
  const fetch = async () => { calls++; return new Response(JSON.stringify(payload())); };
  await assert.rejects(client.loadWorkflowConnectedAccounts({ getOwnerToken: async () => null, fetch, assertActive() {} }), /Sign in/);
  assert.equal(calls, 0);
  let checks = 0;
  await assert.rejects(client.loadWorkflowConnectedAccounts({ getOwnerToken: async () => "fake-token", fetch, assertActive() { if (++checks === 2) throw new Error("account changed"); } }), /account changed/);
  assert.equal(calls, 0);
  checks = 0;
  await assert.rejects(client.loadWorkflowConnectedAccounts({ getOwnerToken: async () => "fake-token", fetch, assertActive() { if (++checks === 3) throw new Error("unmounted"); } }), /unmounted/);
  assert.equal(calls, 1);
});

test("failed authentication and malformed responses expose no accounts", async () => {
  for (const response of [new Response("{}", { status: 401 }), new Response("not json"), new Response(JSON.stringify({ ok: false }))]) {
    await assert.rejects(client.loadWorkflowConnectedAccounts({ getOwnerToken: async () => "fake-token", assertActive() {}, fetch: async () => response }), /Could not/);
  }
});

test("previews, inactive tabs and signed-out workflows do not mount account queries", () => {
  const actual = ui();
  const props = { enabled: true, active: true, ownerId: "owner-a", platform: "instagram", selectedId: "", onSelect() {} };
  assert.equal(actual.WorkflowConnectedAccounts({ ...props, enabled: false }), null);
  assert.equal(actual.WorkflowConnectedAccounts({ ...props, active: false }), null);
  assert.match(text(actual.WorkflowConnectedAccounts({ ...props, ownerId: null })), /Sign in/);
  assert.match(text(actual.WorkflowConnectedAccounts({ ...props, platform: "" })), /Choose a platform/);
  assert.equal(actual.queries.length, 0);
  assert.equal(actual.WorkflowConnectedAccounts(props).props.ownerId, "owner-a");
  assert.equal(actual.queries.length, 0); // The query mounts only in the connected child.
});

test("selection is explicit for one or multiple accounts and never crosses platforms", () => {
  for (const data of [[account()], [account(), account({ id: "connection-b", platformAccountUsername: "example_store" }), account({ id: "youtube-c", platform: "youtube", scopes: ["https://www.googleapis.com/auth/youtube.upload"] })]]) {
    const selected = [], actual = ui({ data });
    const tree = actual.testConnectedAccounts({ ownerId: "owner-a", platform: "instagram", selectedId: "", onSelect: (id) => selected.push(id) });
    const buttons = nodes(tree).filter((node) => node.type === "button");
    assert.equal(buttons.length, data.filter((item) => item.platform === "instagram").length);
    assert.ok(buttons.every((button) => button.props["aria-pressed"] === false));
    assert.deepEqual(selected, []);
    buttons[0].props.onClick();
    assert.deepEqual(selected, ["connection-a"]);
    assert.deepEqual(plain(actual.queries[0].queryKey), ["explore-connected-accounts", "owner-a"]);
    assert.equal(actual.queries[0].retry, false);
    assert.equal(actual.queries[0].staleTime, 0);
  }
});

test("expired or insufficient-permission accounts are visible but not selectable", () => {
  const actual = ui({ data: [account({ status: "expired" }), account({ id: "connection-b", scopes: [] })] });
  const tree = actual.testConnectedAccounts({ ownerId: "owner-a", platform: "instagram", selectedId: "connection-a", onSelect() {} });
  const buttons = nodes(tree).filter((node) => node.type === "button");
  assert.ok(buttons.every((button) => button.props.disabled && !button.props["aria-pressed"]));
  assert.match(text(tree), /Reconnect to schedule/);
  assert.equal(nodes(tree).filter((node) => node.type === "check").length, 0);
});

test("loading/error states cannot display cached accounts or imply posting succeeded", () => {
  for (const state of [{ isPending: true }, { isError: true }]) {
    const actual = ui(state);
    const tree = actual.testConnectedAccounts({ ownerId: "owner-a", platform: "instagram", selectedId: "connection-a", onSelect() {} });
    assert.doesNotMatch(text(tree), /example_app|scheduled|published/i);
    assert.match(text(tree), state.isPending ? /Loading/ : /Could not load/);
  }
});

test("both workflows share the guarded account control and reset destination on platform changes", () => {
  for (const kind of ["hook", "phone"]) {
    const source = read(`components/explore/${kind}-workflow-preview.tsx`);
    assert.match(source, /<WorkflowConnectedAccounts enabled=\{generationEnabled\} active=\{section === "schedule"\} ownerId=\{ownerId\}/);
    assert.match(source, /setScheduleDraft\(\(current\) => \(\{ \.\.\.current, connectionId \}\)\)/);
  }
  assert.match(read("components/explore/workflow-scheduling-panel.tsx"), /connectionId: draft.platform === value \? draft.connectionId : ""/);
  const source = read("components/explore/workflow-connected-accounts.tsx");
  assert.match(source, /getCurrentUserIdToken\(ownerId\)/);
  assert.match(source, /if \(signal.aborted\)/);
  assert.doesNotMatch(source, /localStorage|sessionStorage|POST|\.trigger\(|accessToken|refreshToken/);
});
