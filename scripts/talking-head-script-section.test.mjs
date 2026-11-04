import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import ts from "typescript";
import { estimateTalkingHeadSpeechSeconds } from "../lib/explore/talking-head-script-remix.ts";
import { readTalkingHeadScriptDraft } from "../lib/explore/talking-head-script-draft.ts";
import { buildTalkingHeadPromptExport } from "../lib/explore/talking-head-prompt.ts";

const source = { referenceId: "talking-test", sourceSha256: "a".repeat(64), transcriptSha256: "b".repeat(64), selectionSha256: "d".repeat(64), hookText: "Try this.", fullText: "Try this. Demo narration.", hookEndMs: 3000 };
const settle = async () => { for (let i = 0; i < 6; i++) await new Promise(setImmediate); };
const nodes = tree => Array.isArray(tree) ? tree.flatMap(nodes) : tree && typeof tree === "object" ? [tree, ...nodes(tree.props?.children)] : [];
const text = tree => Array.isArray(tree) ? tree.map(text).join(" ") : tree && typeof tree === "object" ? text(tree.props?.children) : typeof tree === "string" ? tree : "";
function harness({ values = new Map(), send, failSource = false, unavailableStorage = false, initialScript, preferInitialScript, selectedSource = source, sceneDirections = "Stable phone camera, natural window light.", failClipboard = false, business = { name: "Example", ready: true, version: 2 }, enabled = true, failCompletedSave = false } = {}) {
  const slots = [], effects = [], calls = [], changes = [], reviewChanges = [], copied = []; let cursor = 0;
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => { if (unavailableStorage || failCompletedSave && JSON.parse(value).videoPrompt) throw Error("Storage denied"); values.set(key, value); } };
  const react = {
    useState(value) { const i = cursor++; if (!(i in slots)) slots[i] = typeof value === "function" ? value() : value; return [slots[i], next => { slots[i] = typeof next === "function" ? next(slots[i]) : next; }]; },
    useRef(value) { const i = cursor++; return slots[i] ??= { current: value }; },
    useCallback(value, deps) { const i = cursor++, old = slots[i]; if (!old || deps.some((value, j) => value !== old.deps[j])) slots[i] = { value, deps }; return slots[i].value; },
    useEffect(run, deps) { const i = cursor++, old = slots[i]; if (!old || deps.some((value, j) => value !== old.deps[j])) effects.push(() => { old?.cleanup?.(); slots[i] = { deps, cleanup: run() }; }); },
  };
  const exports = {};
  const code = ts.transpileModule(readFileSync("components/explore/talking-head-script-section.tsx", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const json = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });
  const fetch = async (url, options) => {
    calls.push({ url, options, savedBeforeCall: [...values.values()] });
    if (url.includes("referenceId=")) return failSource ? json({ ok: false, message: "Source unavailable" }, 409) : json({ ok: true, source: selectedSource, enabled, business });
    return send ? send(url, options, json) : json({ ok: true, script: "Try that!", referenceId: source.referenceId, sourceSha256: source.sourceSha256 });
  };
  vm.runInNewContext(code, { exports, require: name => {
    if (name === "react") return react;
    if (name === "react/jsx-runtime") return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
    if (name.endsWith("/ui/button")) return { Button: "button" };
    if (name.endsWith("/firebase/auth")) return { getCurrentUserIdToken: async () => "owner-token" };
    if (name.endsWith("/talking-head-script-remix")) return { estimateTalkingHeadSpeechSeconds };
    if (name.endsWith("/talking-head-script-draft")) return { readTalkingHeadScriptDraft };
    if (name.endsWith("/talking-head-prompt")) return { buildTalkingHeadPromptExport };
    throw Error(`Unexpected import ${name}`);
  }, localStorage: storage, fetch, crypto: { randomUUID }, navigator: { clipboard: { async writeText(value) { if (failClipboard) throw Error("Clipboard denied"); copied.push(value); } } }, AbortController, AbortSignal, Error, JSON, encodeURIComponent });
  const onChange = (value, reviewed) => { changes.push(value); reviewChanges.push(reviewed); };
  const render = () => { cursor = 0; const tree = exports.TalkingHeadScriptSection({ ownerId: "owner", referenceId: selectedSource.referenceId, sourceSha256: selectedSource.sourceSha256, draftId: "draft", initialScript, preferInitialScript, sceneDirections, onChange }); while (effects.length) effects.shift()(); return tree; };
  return { render, calls, changes, reviewChanges, copied, values, nodes: () => nodes(render()), edit(value) { nodes(render()).find(node => node.type === "textarea").props.onChange({ target: { value } }); }, review() { nodes(render()).find(node => node.type === "input").props.onChange({ target: { checked: true } }); }, click(label) { const button = nodes(render()).find(node => node.type === "button" && text(node) === label); assert.ok(button, label); assert.equal(Boolean(button.props.disabled), false, label); button.props.onClick(); }, script: () => nodes(render()).find(node => node.type === "textarea").props.value };
}

test("one action personalizes the complete hook then exports an editable prompt; reload and Copy never repay", async () => {
  const longHook = "These are the complete introduction words. ".repeat(10) + "Let me show you.";
  const personalized = longHook.replace("These are", "For this business, these are");
  const h = harness({ selectedSource: { ...source, hookText: longHook, fullText: longHook + " Demo narration starts here.", hookEndMs: 20000 }, send: async (_url, _options, json) => json({ ok: true, script: personalized, referenceId: source.referenceId, sourceSha256: source.sourceSha256 }) });
  h.render(); await settle(); h.review(); h.click("Generate prompt"); await settle();
  let output = h.nodes().find(node => node.props?.["aria-label"] === "Talking Head video prompt");
  assert.ok(output); assert.ok(output.props.value.includes(JSON.stringify(personalized)));
  assert.equal(output.props.value.split(JSON.stringify(personalized)).length - 1, 1);
  assert.doesNotMatch(output.props.value, /Demo narration starts here/u);
  assert.ok(h.nodes().some(node => text(node).includes("15-second single-clip limit")));
  const custom = output.props.value + "\nMy extra camera note.";
  output.props.onChange({ target: { value: custom } });
  h.click("Copy prompt"); await settle(); assert.equal(h.copied.at(-1), custom);
  const restored = harness({ values: h.values, selectedSource: { ...source, hookText: longHook, hookEndMs: 20000 } });
  restored.render(); await settle();
  output = restored.nodes().find(node => node.props?.["aria-label"] === "Talking Head video prompt");
  assert.equal(output.props.value, custom);
  assert.equal([...h.calls, ...restored.calls].filter(call => call.options.method === "POST").length, 1);
  const posted = JSON.parse(h.calls.find(call => call.options.method === "POST").options.body);
  assert.equal(posted.script, longHook); assert.equal(posted.businessProfileVersion, 2);
  assert.equal(posted.pendingPrompt, undefined, "UI snapshot never changes the API payload/idempotency hash");
});

test("script, scene or selection changes retain an earlier prompt but disable stale copying", async () => {
  const first = harness(); first.render(); await settle(); first.review(); first.click("Generate prompt"); await settle();
  const cases = [
    { values: new Map(first.values), initialScript: "Changed script", preferInitialScript: true },
    { values: new Map(first.values), sceneDirections: "A different camera direction." },
    { values: new Map(first.values), selectedSource: { ...source, selectionSha256: "e".repeat(64) } },
    { values: new Map(first.values), business: { name: "New business", ready: true, version: 3 } },
  ];
  for (const options of cases) {
    const h = harness(options); h.render(); await settle();
    assert.ok(h.nodes().find(node => node.props?.["aria-label"] === "Talking Head video prompt").props.value);
    assert.ok(h.nodes().find(node => node.type === "button" && text(node) === "Copy prompt").props.disabled);
    assert.ok(h.nodes().some(node => text(node).includes("generate a new prompt; your previous prompt is kept")));
    assert.equal(h.calls.filter(call => call.options.method === "POST").length, 0);
  }
});

test("clipboard failure keeps the prompt editable with a manual-copy recovery message", async () => {
  const h = harness({ failClipboard: true }); h.render(); await settle(); h.review(); h.click("Generate prompt"); await settle(); h.click("Copy prompt"); await settle();
  assert.ok(h.nodes().some(node => text(node).includes("copy it manually")));
  assert.ok(h.nodes().find(node => node.props?.["aria-label"] === "Talking Head video prompt").props.value);
  assert.equal(h.calls.filter(call => call.options.method === "POST").length, 1);
});

test("review binds to the exact hook selection and survives only unchanged same-source words", async () => {
  const first = harness(); first.render(); await settle(); first.review(); first.render();
  assert.equal(first.reviewChanges.at(-1), true);
  const unchanged = harness({ values: first.values, initialScript: first.script(), preferInitialScript: true });
  unchanged.render(); await settle(); unchanged.render();
  assert.equal(unchanged.reviewChanges.at(-1), true);
  const revised = harness({ values: first.values, selectedSource: { ...source, selectionSha256: "e".repeat(64) } });
  revised.render(); await settle(); revised.render();
  assert.equal(revised.script(), first.script());
  assert.equal(revised.reviewChanges.at(-1), false);
  assert.ok(revised.nodes().find(node => node.type === "button" && text(node) === "Generate prompt").props.disabled);
  const edited = harness({ values: unchanged.values, initialScript: "New Create words", preferInitialScript: true });
  edited.render(); await settle(); edited.render();
  assert.equal(edited.reviewChanges.at(-1), false);
  assert.equal([...first.calls, ...unchanged.calls, ...revised.calls, ...edited.calls].filter(call => call.options.method === "POST").length, 0);
});

test("legacy review without a selection fingerprint cannot authorize a new remix", async () => {
  const first = harness(); first.render(); await settle(); first.review();
  for (const [key, raw] of first.values) { const value = JSON.parse(raw); delete value.reviewedSelectionSha256; first.values.set(key, JSON.stringify(value)); }
  const restored = harness({ values: first.values }); restored.render(); await settle(); restored.render();
  assert.equal(restored.reviewChanges.at(-1), false);
  assert.ok(restored.nodes().find(node => node.type === "button" && text(node) === "Generate prompt").props.disabled);
});
test("opening is read-only, original draft is visible, and review precedes the paid Remix action", async () => {
  const h = harness(); h.render(); await settle(); assert.equal(h.script(), "Try this.");
  assert.equal(h.calls.length, 1); assert.equal(h.calls[0].options.method, undefined);
  assert.ok(h.nodes().find(node => node.type === "button" && text(node) === "Generate prompt").props.disabled);
  h.review(); h.click("Generate prompt"); await settle(); assert.equal(h.script(), "Try that!");
  const call = h.calls.find(item => item.options.method === "POST"), body = JSON.parse(call.options.body);
  assert.equal(body.script, "Try this."); assert.equal(body.reviewed, true);
  assert.ok(call.savedBeforeCall.some(value => JSON.parse(value).pending?.requestKey === body.requestKey));
  assert.equal(h.changes.at(-1), "Try that!");
  h.render(); assert.equal(h.reviewChanges.at(-1), false, "new AI wording needs its own human review");
  assert.ok(h.nodes().find(node => node.type === "button" && text(node) === "Generate prompt").props.disabled);
  assert.ok(!h.nodes().some(node => node.type === "button" && text(node) === "Remix for my business"));
  assert.equal(h.nodes().filter(node => node.type === "button" && text(node) === "Generate prompt").length, 1);
  assert.ok(!h.nodes().find(node => node.type === "button" && text(node) === "Copy prompt").props.disabled, "draft Copy does not approve a paid video");
  const snapshot = call.savedBeforeCall.map(raw => JSON.parse(raw)).find(saved => saved.pending?.requestKey === body.requestKey);
  assert.equal(snapshot.pendingPrompt.requestKey, body.requestKey);
  assert.equal(snapshot.pendingPrompt.selectionSha256, source.selectionSha256);
  assert.ok(h.nodes().find(node => node.props?.["aria-label"] === "Talking Head video prompt").props.value.includes('"Try that!"'));
});
test("newer user words survive a late Remix reply and an explicit empty draft survives reload", async () => {
  let release; const waiting = new Promise(resolve => { release = resolve; });
  const h = harness({ send: async (_url, _options, json) => { await waiting; return json({ ok: true, script: "Old result", referenceId: source.referenceId, sourceSha256: source.sourceSha256 }); } });
  h.render(); await settle(); h.review(); h.click("Generate prompt"); await settle(); h.edit("Newer manual words"); release(); await settle();
  assert.equal(h.script(), "Newer manual words"); assert.ok(h.nodes().some(node => text(node) === "Use generated prompt"));
  h.edit(""); const restored = harness({ values: h.values }); restored.render(); await settle(); assert.equal(restored.script(), "");
  restored.click("Use generated prompt"); assert.equal(restored.script(), "Old result");
  assert.equal(restored.reviewChanges.at(-1), false);
  assert.ok(restored.nodes().find(node => node.props?.["aria-label"] === "Talking Head video prompt").props.value.includes('"Old result"'));
  assert.equal(restored.calls.filter(call => call.options.method === "POST").length, 0);
});
test("uncertain request reload uses read-only recovery; an admission-race404 never erases its marker", async () => {
  const first = harness({ send: async () => { throw Error("Lost reply"); } }); first.render(); await settle(); first.review(); first.click("Generate prompt"); await settle();
  const restored = harness({ values: first.values, failSource: true, send: async (_url, _options, json) => json({ ok: false, message: "Not found yet" }, 404) });
  restored.render(); await settle(); assert.equal(restored.calls.filter(call => call.options.method === "POST").length, 0);
  restored.click("Check saved prompt"); await settle();
  const recover = restored.calls.find(call => call.url.includes("requestKey=")); assert.equal(recover.options.method, "GET");
  assert.ok([...restored.values.values()].some(value => JSON.parse(value).pending));
});
test("unavailable browser storage blocks spending and leaves current words editable", async () => {
  const h = harness({ unavailableStorage: true }); h.render(); await settle(); h.review(); h.click("Generate prompt"); await settle();
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
  a.render(); await settle(); a.review(); a.click("Generate prompt"); await settle();
  const sourceB = { ...source, referenceId: "talking-second", sourceSha256: "c".repeat(64), hookText: "Source B opening." };
  const b = harness({ values: a.values, selectedSource: sourceB, initialScript: a.script(), preferInitialScript: false });
  b.render(); await settle(); assert.equal(b.script(), sourceB.hookText);
  const back = harness({ values: b.values, initialScript: b.script(), preferInitialScript: false });
  back.render(); await settle();
  assert.equal(back.script(), source.hookText);
  assert.ok(back.nodes().find(node => node.type === "button" && text(node) === "Check saved prompt"));
  assert.equal([...b.calls, ...back.calls].filter(call => call.options.method === "POST").length, 0);
});
test("a corrupt pending draft stays preserved and blocks new paid requests across reload", async () => {
  const valid = harness(); valid.render(); await settle(); const key = [...valid.values.keys()][0];
  const corrupt = '{"version":1,"pending":{"requestKey":"broken"}}'; valid.values.set(key, corrupt);
  const h = harness({ values: valid.values }); h.render(); await settle(); h.edit("My current words"); h.review();
  assert.equal(h.values.get(key), corrupt);
  assert.ok(h.nodes().find(node => node.type === "button" && text(node) === "Generate prompt").props.disabled);
  assert.equal(h.calls.filter(call => call.options.method === "POST").length, 0);
});
test("two clicks before React rerenders still submit only one paid request", async () => {
  const h = harness(); h.render(); await settle(); h.review();
  const action = h.nodes().find(node => node.type === "button" && text(node) === "Generate prompt").props.onClick;
  action(); action(); await settle();
  assert.equal(h.calls.filter(call => call.options.method === "POST").length, 1);
});

test("uncertain combined request recovers its frozen prompt context with GET even when source details fail", async () => {
  const first = harness({ sceneDirections: "The original window-lit scene.", send: async () => { throw Error("Lost response"); } });
  first.render(); await settle(); first.review(); first.click("Generate prompt"); await settle();
  const snapshot = [...first.values.values()].map(value => JSON.parse(value))[0];
  assert.ok(snapshot.pending); assert.equal(snapshot.pendingPrompt.sceneDirections, "The original window-lit scene.");
  const restored = harness({ values: first.values, failSource: true, sceneDirections: "New scene must not replace the accepted request." });
  restored.render(); await settle(); restored.click("Check saved prompt"); await settle();
  const output = restored.nodes().find(node => node.props?.["aria-label"] === "Talking Head video prompt");
  assert.match(output.props.value, /The original window-lit scene/u);
  assert.doesNotMatch(output.props.value, /New scene must not replace/u);
  assert.equal(restored.script(), "Try that!");
  assert.equal(restored.calls.filter(call => call.options.method === "POST").length, 0);
  assert.equal(restored.calls.find(call => call.url.includes("requestKey="))?.options.method, "GET");
  assert.equal(JSON.parse([...restored.values.values()][0]).pending, null);
});

test("a legacy script-only pending receipt remains recoverable without a new paid request", async () => {
  const first = harness({ send: async () => { throw Error("Lost response"); } });
  first.render(); await settle(); first.review(); first.click("Generate prompt"); await settle();
  for (const [key, raw] of first.values) { const saved = JSON.parse(raw); delete saved.pendingPrompt; first.values.set(key, JSON.stringify(saved)); }
  const restored = harness({ values: first.values }); restored.render(); await settle(); restored.click("Check saved prompt"); await settle();
  assert.equal(restored.script(), "Try that!");
  assert.ok(restored.nodes().find(node => node.props?.["aria-label"] === "Talking Head video prompt"));
  assert.equal(restored.calls.filter(call => call.options.method === "POST").length, 0);
});

test("completed-result storage failure retains the pending receipt for read-only reload recovery", async () => {
  const first = harness({ failCompletedSave: true }); first.render(); await settle(); first.review(); first.click("Generate prompt"); await settle();
  assert.equal(first.script(), "Try that!");
  assert.ok(JSON.parse([...first.values.values()][0]).pending, "never clear a paid receipt before its complete output is saved");
  const restored = harness({ values: first.values }); restored.render(); await settle(); restored.click("Check saved prompt"); await settle();
  assert.equal(restored.script(), "Try that!");
  assert.ok(restored.nodes().find(node => node.props?.["aria-label"] === "Talking Head video prompt"));
  assert.equal([...first.calls, ...restored.calls].filter(call => call.options.method === "POST").length, 1);
});

test("missing business context or disabled personalization never falls back to a generic prompt", async () => {
  for (const options of [{ business: { name: null, ready: false, version: null } }, { enabled: false }]) {
    const h = harness(options); h.render(); await settle(); h.review();
    const button = h.nodes().find(node => node.type === "button" && text(node) === "Generate prompt");
    assert.ok(button.props.disabled); button.props.onClick(); await settle();
    assert.equal(h.calls.filter(call => call.options.method === "POST").length, 0);
    assert.ok(!h.nodes().some(node => node.props?.["aria-label"] === "Talking Head video prompt"));
  }
});

test("invalid scene directions stop the combined action before a paid request is saved or sent", async () => {
  const h = harness({ sceneDirections: "x".repeat(6001) }); h.render(); await settle(); h.review(); h.click("Generate prompt"); await settle();
  assert.equal(h.calls.filter(call => call.options.method === "POST").length, 0);
  assert.ok(!JSON.parse([...h.values.values()][0]).pending);
});

test("definite provider failure keeps the authored script and does not fabricate a prompt or retry", async () => {
  const h = harness({ send: async (_url, _options, json) => json({ ok: false, outcome: "failed", message: "Failed once" }, 502) });
  h.render(); await settle(); h.review(); h.click("Generate prompt"); await settle();
  assert.equal(h.script(), source.hookText); assert.equal(h.calls.filter(call => call.options.method === "POST").length, 1);
  assert.equal(JSON.parse([...h.values.values()][0]).pending, null);
  assert.ok(!h.nodes().some(node => node.props?.["aria-label"] === "Talking Head video prompt"));
});

test("mismatched pending prompt snapshots are preserved and block a new generation", async () => {
  const first = harness({ send: async () => { throw Error("Lost response"); } }); first.render(); await settle(); first.review(); first.click("Generate prompt"); await settle();
  for (const [key, raw] of first.values) { const saved = JSON.parse(raw); saved.pendingPrompt.requestKey = randomUUID(); first.values.set(key, JSON.stringify(saved)); }
  const before = [...first.values.values()][0];
  const restored = harness({ values: first.values }); restored.render(); await settle(); restored.review();
  assert.ok(restored.nodes().find(node => node.type === "button" && text(node) === "Generate prompt").props.disabled);
  assert.equal([...restored.values.values()][0], before);
  assert.equal(restored.calls.filter(call => call.options.method === "POST").length, 0);
});

test("a late regeneration cannot overwrite prompt text edited while it was processing", async () => {
  let submissions = 0, release;
  const waiting = new Promise(resolve => { release = resolve; });
  const h = harness({ send: async (_url, _options, json) => { submissions++; if (submissions > 1) await waiting; return json({ ok: true, script: submissions === 1 ? "Try that!" : "Second result", referenceId: source.referenceId, sourceSha256: source.sourceSha256 }); } });
  h.render(); await settle(); h.review(); h.click("Generate prompt"); await settle();
  h.review(); h.click("Generate prompt"); await settle();
  h.nodes().find(node => node.props?.["aria-label"] === "Talking Head video prompt").props.onChange({ target: { value: "My newer authored prompt." } });
  release(); await settle();
  assert.equal(h.nodes().find(node => node.props?.["aria-label"] === "Talking Head video prompt").props.value, "My newer authored prompt.");
  assert.equal(h.script(), "Try that!");
  const restored = harness({ values: h.values }); restored.render(); await settle();
  assert.ok(restored.nodes().find(node => node.type === "button" && text(node) === "Use generated prompt"));
  assert.equal(restored.nodes().find(node => node.props?.["aria-label"] === "Talking Head video prompt").props.value, "My newer authored prompt.");
  assert.equal([...h.calls, ...restored.calls].filter(call => call.options.method === "POST").length, 2);
});
