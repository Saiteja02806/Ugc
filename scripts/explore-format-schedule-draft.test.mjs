import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import * as drafts from "../lib/explore/format-schedule-draft.ts";
import * as scheduling from "../lib/explore/workflow-scheduling-draft.ts";

const empty = { platform: "", caption: "", date: "", time: "", connectionId: "" };
const output = { id: "00000000-0000-4000-8000-000000000001", kind: "media_asset", url: "/saved.mp4", title: "Saved video" };
const scope = { environment: "live", owner: "alice", format: "hook", output };
const draft = { caption: "My post", date: "2026-10-20", time: "18:30", platform: "instagram", platforms: ["instagram"], connectionId: "account-a", connectionIds: { instagram: "account-a" } };
const normalize = value => JSON.parse(JSON.stringify(value));
const nodes = tree => Array.isArray(tree) ? tree.flatMap(nodes) : tree && typeof tree === "object" ? [tree, ...nodes(tree.props?.children)] : [];

test("unsent schedule forms are versioned and isolated by owner, format, mode and exact output", () => {
  const key = drafts.formatScheduleDraftKey(scope);
  const raw = drafts.serializeFormatScheduleDraft(key, draft);
  assert.deepEqual(drafts.readFormatScheduleDraft(raw, key), draft);
  for (const changed of [{ owner: "bob" }, { format: "wall_text" }, { environment: "preview" }, { output: null }, { output: { ...output, id: "other" } }, { output: { ...output, kind: "library_item" } }]) {
    assert.equal(drafts.readFormatScheduleDraft(raw, drafts.formatScheduleDraftKey({ ...scope, ...changed })), null);
  }
});

test("malformed or oversized drafts cannot hydrate a scheduling form", () => {
  const key = drafts.formatScheduleDraftKey(scope);
  for (const bad of [null, "not-json", "x".repeat(24_001), JSON.stringify({ version: 2, key, draft }),
    ...[{ caption: "x".repeat(10_001) }, { date: "yesterday" }, { time: "25:00" }, { platforms: "instagram" }, { platforms: ["fake"] }, { connectionIds: { youtube: "foreign" } }].map(change => JSON.stringify({ version: 1, key, draft: { ...draft, ...change } }))]) {
    assert.equal(drafts.readFormatScheduleDraft(bad, key), null);
  }
});

/** Actual panel event/effect lifecycle; every external request fails the test. */
function harness(storage = new Map()) {
  let cursor = 0, owner = "alice", tree;
  const slots = [], effects = [], timers = new Map(); let timerId = 0, externalCalls = 0;
  const localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) };
  const react = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = { value: typeof initial === "function" ? initial() : initial }; return [slots[i].value, next => { slots[i].value = typeof next === "function" ? next(slots[i].value) : next; }]; },
    useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial }; },
    useEffect(callback, deps) { const i = cursor++, previous = slots[i]; if (!previous || deps.some((value, n) => !Object.is(value, previous.deps[n]))) { slots[i] = { deps, cleanup: previous?.cleanup }; effects.push(() => { previous?.cleanup?.(); slots[i].cleanup = callback(); }); } },
  };
  react.useLayoutEffect = react.useEffect;
  const jsx = { jsx: (type, props, key) => ({ type, props, key }), jsxs: (type, props, key) => ({ type, props, key }), Fragment: "fragment" };
  const imports = { react, "react/jsx-runtime": jsx, "react-dom": { createPortal: children => children },
    "next/dynamic": { default: () => "ScheduleEditor" }, "next/link": { default: "Link" },
    "@/contexts/auth-context": { useAuth: () => ({ user: owner ? { uid: owner } : null }) },
    "@/components/providers/account-timezone-provider": { useAccountTimeZone: () => "Asia/Calcutta" },
    "@/components/explore/workflow-scheduling-panel": { EMPTY_SCHEDULE_DRAFT: empty, WorkflowSchedulingPanel: "WorkflowSchedulingPanel" },
    "@/lib/explore/format-schedule-draft": drafts, "@/lib/explore/workflow-scheduling-draft": scheduling,
    "@/lib/explore/workflow-schedule-client": { readScheduleReceipt: () => null },
    "@/lib/explore/workflow-connected-accounts": {}, "@/lib/firebase/auth": { getCurrentUserIdToken: () => { externalCalls++; throw new Error("Unexpected auth request"); } },
  };
  const exported = {};
  const code = ts.transpileModule(readFileSync(new URL("../components/explore/format-schedule-panel.tsx", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { exports: exported, localStorage, setTimeout: callback => { timers.set(++timerId, callback); return timerId; }, clearTimeout: id => timers.delete(id),
    fetch: () => { externalCalls++; throw new Error("Unexpected network request"); }, require(name) { if (name in imports) return imports[name]; if (name.startsWith("@/components/")) return new Proxy({}, { get: (_, key) => String(key) }); throw new Error(name); } });
  const props = { output, format: "hook", localPreview: false, imageOnly: false, active: true };
  const render = () => { cursor = 0; tree = exported.FormatSchedulePanel(props); while (effects.length) effects.shift()(); return tree; };
  return { props, storage, owner(value) { owner = value; }, render,
    hydrate() { for (const [id, callback] of [...timers]) { timers.delete(id); callback(); } return render(); },
    form() { return nodes(tree).find(node => node.type === "WorkflowSchedulingPanel").props; },
    get externalCalls() { return externalCalls; },
  };
}

test("editing then remounting restores the form without any scheduling or authentication request", () => {
  const h = harness(); h.render(); h.hydrate(); h.form().onChange(draft);
  const reloaded = harness(h.storage); reloaded.render(); reloaded.hydrate();
  assert.deepEqual(normalize(reloaded.form().draft), draft); assert.equal(reloaded.externalCalls, 0);
});

test("hydration cannot overwrite typing and identity changes never inherit prior targets or timing", () => {
  const key = drafts.formatScheduleDraftKey(scope); const storage = new Map([[key, drafts.serializeFormatScheduleDraft(key, draft)]]);
  const h = harness(storage); h.render(); h.form().onChange({ ...empty, caption: "Typed before hydration" }); h.hydrate();
  assert.equal(h.form().draft.caption, "Typed before hydration");
  h.form().onChange(draft); h.props.output = { ...output, id: "new-output" }; h.render(); h.hydrate(); assert.deepEqual(normalize(h.form().draft), empty);
  h.props.output = output; h.render(); h.hydrate(); assert.deepEqual(normalize(h.form().draft), draft);
  h.owner("bob"); h.render(); assert.deepEqual(normalize(h.form().draft), empty); h.hydrate(); assert.deepEqual(normalize(h.form().draft), empty);
  h.owner("alice"); h.props.localPreview = true; h.render(); h.hydrate(); assert.deepEqual(normalize(h.form().draft), empty);
  assert.equal(h.externalCalls, 0);
});
