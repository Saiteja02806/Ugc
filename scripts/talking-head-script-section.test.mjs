import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import ts from "typescript";
import { estimateTalkingHeadSpeechSeconds } from "../lib/explore/talking-head-script-remix.ts";
import { readTalkingHeadScriptDraft } from "../lib/explore/talking-head-script-draft.ts";

const source = { referenceId: "talking-test", sourceSha256: "a".repeat(64), transcriptSha256: "b".repeat(64), hookText: "Try this.", fullText: "Try this. Demo narration.", hookEndMs: 3000 };
const settle = async () => { for (let i = 0; i < 6; i++) await new Promise(setImmediate); };
const nodes = tree => Array.isArray(tree) ? tree.flatMap(nodes) : tree && typeof tree === "object" ? [tree, ...nodes(tree.props?.children)] : [];
const text = tree => Array.isArray(tree) ? tree.map(text).join(" ") : tree && typeof tree === "object" ? text(tree.props?.children) : typeof tree === "string" ? tree : "";
function harness({ values = new Map(), send, failSource = false, unavailableStorage = false, initialScript, preferInitialScript, selectedSource = source } = {}) {
  const slots = [], effects = [], calls = [], changes = []; let cursor = 0;
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => { if (unavailableStorage) throw Error("Storage denied"); values.set(key, value); } };
  const react = {
    useState(value) { const i = cursor++; if (!(i in slots)) slots[i] = typeof value === "function" ? value() : value; return [slots[i], next => { slots[i] = typeof next === "function" ? next(slots[i]) : next; }]; },
    useRef(value) { const i = cursor++; return slots[i] ??= { current: value }; },
    useEffect(run, deps) { const i = cursor++, old = slots[i]; if (!old || deps.some((value, j) => value !== old.deps[j])) effects.push(() => { old?.cleanup?.(); slots[i] = { deps, cleanup: run() }; }); },
  };
  const exports = {};
  const code = ts.transpileModule(readFileSync("components/explore/talking-head-script-section.tsx", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const json = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });
  const fetch = async (url, options) => {
    calls.push({ url, options, savedBeforeCall: [...values.values()] });
    if (url.includes("referenceId=")) return failSource ? json({ ok: false, message: "Source unavailable" }, 409) : json({ ok: true, source: selectedSource, enabled: true, business: { name: "Example", ready: true, version: 2 } });
    return send ? send(url, options, json) : json({ ok: true, script: "Try that!", referenceId: source.referenceId, sourceSha256: source.sourceSha256 });
  };
  vm.runInNewContext(code, { exports, require: name => {
    if (name === "react") return react;
    if (name === "react/jsx-runtime") return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
    if (name.endsWith("/ui/button")) return { Button: "button" };
    if (name.endsWith("/firebase/auth")) return { getCurrentUserIdToken: async () => "owner-token" };
    if (name.endsWith("/talking-head-script-remix")) return { estimateTalkingHeadSpeechSeconds };
    if (name.endsWith("/talking-head-script-draft")) return { readTalkingHeadScriptDraft };
    throw Error(`Unexpected import ${name}`);
  }, localStorage: storage, fetch, crypto: { randomUUID }, AbortController, AbortSignal, Error, JSON, encodeURIComponent });
  const onChange = value => changes.push(value);
  const render = () => { cursor = 0; const tree = exports.TalkingHeadScriptSection({ ownerId: "owner", referenceId: selectedSource.referenceId, sourceSha256: selectedSource.sourceSha256, draftId: "draft", initialScript, preferInitialScript, onChange }); while (effects.length) effects.shift()(); return tree; };
  return { render, calls, changes, values, nodes: () => nodes(render()), edit(value) { nodes(render()).find(node => node.type === "textarea").props.onChange({ target: { value } }); }, review() { nodes(render()).find(node => node.type === "input").props.onChange({ target: { checked: true } }); }, click(label) { const button = nodes(render()).find(node => node.type === "button" && text(node) === label); assert.ok(button, label); assert.equal(Boolean(button.props.disabled), false, label); button.props.onClick(); }, script: () => nodes(render()).find(node => node.type === "textarea").props.value };
}
test("opening is read-only, original draft is visible, and review precedes the paid Remix action", async () => {
  const h = harness(); h.render(); await settle(); assert.equal(h.script(), "Try this.");
  assert.equal(h.calls.length, 1); assert.equal(h.calls[0].options.method, undefined);
  assert.ok(h.nodes().find(node => node.type === "button" && text(node) === "Remix for my business").props.disabled);
  h.review(); h.click("Remix for my business"); await settle(); assert.equal(h.script(), "Try that!");
  const call = h.calls.find(item => item.options.method === "POST"), body = JSON.parse(call.options.body);
  assert.equal(body.script, "Try this."); assert.equal(body.reviewed, true);
  assert.ok(call.savedBeforeCall.some(value => JSON.parse(value).pending?.requestKey === body.requestKey));
  assert.equal(h.changes.at(-1), "Try that!");
});
test("newer user words survive a late Remix reply and an explicit empty draft survives reload", async () => {
  let release; const waiting = new Promise(resolve => { release = resolve; });
  const h = harness({ send: async (_url, _options, json) => { await waiting; return json({ ok: true, script: "Old result", referenceId: source.referenceId, sourceSha256: source.sourceSha256 }); } });
  h.render(); await settle(); h.review(); h.click("Remix for my business"); await settle(); h.edit("Newer manual words"); release(); await settle();
  assert.equal(h.script(), "Newer manual words"); assert.ok(h.nodes().some(node => text(node) === "Use remixed script"));
  h.edit(""); const restored = harness({ values: h.values }); restored.render(); await settle(); assert.equal(restored.script(), "");
});
test("uncertain request reload uses read-only recovery; an admission-race404 never erases its marker", async () => {
  const first = harness({ send: async () => { throw Error("Lost reply"); } }); first.render(); await settle(); first.review(); first.click("Remix for my business"); await settle();
  const restored = harness({ values: first.values, failSource: true, send: async (_url, _options, json) => json({ ok: false, message: "Not found yet" }, 404) });
  restored.render(); await settle(); assert.equal(restored.calls.filter(call => call.options.method === "POST").length, 0);
  restored.click("Check saved remix"); await settle();
  const recover = restored.calls.find(call => call.url.includes("requestKey=")); assert.equal(recover.options.method, "GET");
  assert.ok([...restored.values.values()].some(value => JSON.parse(value).pending));
});
test("unavailable browser storage blocks spending and leaves current words editable", async () => {
  const h = harness({ unavailableStorage: true }); h.render(); await settle(); h.review(); h.click("Remix for my business"); await settle();
  assert.equal(h.calls.filter(call => call.options.method === "POST").length, 0); assert.equal(h.script(), "Try this.");
});
test("active Create script, including explicit empty words, wins over an older preparation draft", async () => {
  const old = harness(); old.render(); await settle();
  const active = harness({ values: old.values, initialScript: "", preferInitialScript: true }); active.render(); await settle();
  assert.equal(active.script(), ""); assert.equal(active.changes.at(-1), "");
});

test("fresh reference ignores unrelated Create words and A to B to A preserves separate drafts", async () => {
  const a = harness(); a.render(); await settle(); a.edit("My source A script");
  const sourceB = { ...source, referenceId: "talking-second", sourceSha256: "c".repeat(64), hookText: "Source B opening." };
  const b = harness({ values: a.values, selectedSource: sourceB, initialScript: a.script(), preferInitialScript: false });
  b.render(); await settle();
  assert.equal(b.script(), sourceB.hookText);
  assert.equal(b.changes.at(-1), sourceB.hookText);
  b.edit("My source B script");
  const backToA = harness({ values: b.values, initialScript: b.script(), preferInitialScript: false });
  backToA.render(); await settle(); assert.equal(backToA.script(), "My source A script");
  const backToB = harness({ values: b.values, selectedSource: sourceB, initialScript: "Other Create words", preferInitialScript: false });
  backToB.render(); await settle(); assert.equal(backToB.script(), "My source B script");
  assert.equal([...a.calls, ...b.calls, ...backToA.calls, ...backToB.calls].filter(call => call.options.method === "POST").length, 0);
});

test("same-source active nonempty Create words override an older saved script without spending", async () => {
  const old = harness(); old.render(); await settle(); old.edit("Older preparation words");
  const active = harness({ values: old.values, initialScript: "Current Create words", preferInitialScript: true });
  active.render(); await settle();
  assert.equal(active.script(), "Current Create words");
  assert.equal(active.calls.filter(call => call.options.method === "POST").length, 0);
});

test("visiting another source preserves an uncertain Remix for read-only recovery", async () => {
  const a = harness({ send: async () => { throw Error("Lost reply"); } });
  a.render(); await settle(); a.review(); a.click("Remix for my business"); await settle();
  const sourceB = { ...source, referenceId: "talking-second", sourceSha256: "c".repeat(64), hookText: "Source B opening." };
  const b = harness({ values: a.values, selectedSource: sourceB, initialScript: a.script(), preferInitialScript: false });
  b.render(); await settle(); assert.equal(b.script(), sourceB.hookText);
  const back = harness({ values: b.values, initialScript: b.script(), preferInitialScript: false });
  back.render(); await settle();
  assert.equal(back.script(), source.hookText);
  assert.ok(back.nodes().find(node => node.type === "button" && text(node) === "Check saved remix"));
  assert.equal([...b.calls, ...back.calls].filter(call => call.options.method === "POST").length, 0);
});
test("a corrupt pending draft stays preserved and blocks new paid requests across reload", async () => {
  const valid = harness(); valid.render(); await settle(); const key = [...valid.values.keys()][0];
  const corrupt = '{"version":1,"pending":{"requestKey":"broken"}}'; valid.values.set(key, corrupt);
  const h = harness({ values: valid.values }); h.render(); await settle(); h.edit("My current words"); h.review();
  assert.equal(h.values.get(key), corrupt);
  assert.ok(h.nodes().find(node => node.type === "button" && text(node) === "Remix for my business").props.disabled);
  assert.equal(h.calls.filter(call => call.options.method === "POST").length, 0);
});
test("two clicks before React rerenders still submit only one paid request", async () => {
  const h = harness(); h.render(); await settle(); h.review();
  const action = h.nodes().find(node => node.type === "button" && text(node) === "Remix for my business").props.onClick;
  action(); action(); await settle();
  assert.equal(h.calls.filter(call => call.options.method === "POST").length, 1);
});
