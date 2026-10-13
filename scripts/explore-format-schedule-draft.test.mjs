import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import * as drafts from "../lib/explore/format-schedule-draft.ts";
import * as scheduling from "../lib/explore/workflow-scheduling-draft.ts";
import * as scheduleClient from "../lib/explore/workflow-schedule-client.ts";

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

test("slideshow shares the review form while labeling Instagram as an image post", () => {
  const h = harness();
  h.props.format = "slideshow"; h.props.imageOnly = true;
  h.props.output = { ...output, kind: "library_item" };
  h.render(); h.hydrate(); h.form().onChange(draft);
  const tree = h.render();
  assert.equal(h.form().presentation, "review"); assert.equal(h.form().imageOnly, true);
  const summary = nodes(tree).find(node => node.props?.["aria-label"] === "Schedule summary");
  assert.equal(nodes(summary).find(node => node.type === "p").props.children, "Instagram");
  assert.equal(h.externalCalls, 0);
});

test("schedule actions stay inside the current form with no external footer portal", () => {
  const h = harness(); h.render(); h.hydrate();
  const footer = h.form().footer;
  assert.equal(footer.props["aria-label"], "Schedule actions");
  assert.ok(nodes(footer).some(node => node.type === "Button" && node.props.onClick));
  assert.equal(h.externalCalls, 0, "Rendering actions must not schedule or authenticate");
});

test("malformed or oversized drafts cannot hydrate a scheduling form", () => {
  const key = drafts.formatScheduleDraftKey(scope);
  for (const bad of [null, "not-json", "x".repeat(24_001), JSON.stringify({ version: 2, key, draft }),
    ...[{ caption: "x".repeat(10_001) }, { date: "yesterday" }, { time: "25:00" }, { platforms: "instagram" }, { platforms: ["fake"] }, { connectionIds: { youtube: "foreign" } }].map(change => JSON.stringify({ version: 1, key, draft: { ...draft, ...change } }))]) {
    assert.equal(drafts.readFormatScheduleDraft(bad, key), null);
  }
});

test("inline review timezone survives draft storage and invalid timezones cannot hydrate", () => {
  const key = drafts.formatScheduleDraftKey(scope);
  const snapshot = { ...draft, timezone: "America/New_York" };
  assert.deepEqual(drafts.readFormatScheduleDraft(drafts.serializeFormatScheduleDraft(key, snapshot), key), snapshot);
  for (const timezone of ["", "Unknown/Place", 123, "x".repeat(101)]) {
    assert.equal(drafts.readFormatScheduleDraft(JSON.stringify({ version: 1, key, draft: { ...draft, timezone } }), key), null);
  }
});

/** Actual panel lifecycle with opt-in isolated review/confirmation responses. */
function harness(storage = new Map(), { allowReview = false, allowConfirm = false, reviewAccountId = "account-a" } = {}) {
  let cursor = 0, owner = "alice", tree;
  const slots = [], effects = [], timers = new Map(), requests = []; let timerId = 0, externalCalls = 0;
  const localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) };
  const react = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = { value: typeof initial === "function" ? initial() : initial }; return [slots[i].value, next => { slots[i].value = typeof next === "function" ? next(slots[i].value) : next; }]; },
    useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial }; },
    useEffect(callback, deps) { const i = cursor++, previous = slots[i]; if (!previous || deps.some((value, n) => !Object.is(value, previous.deps[n]))) { slots[i] = { deps, cleanup: previous?.cleanup }; effects.push(() => { previous?.cleanup?.(); slots[i].cleanup = callback(); }); } },
  };
  react.useLayoutEffect = react.useEffect;
  const jsx = { jsx: (type, props, key) => ({ type, props, key }), jsxs: (type, props, key) => ({ type, props, key }), Fragment: "fragment" };
  const imports = { react, "react/jsx-runtime": jsx, "react-dom": { createPortal: children => children },
    "lucide-react": { ArrowLeft: "ArrowLeft", ArrowRight: "ArrowRight" },
    "@/components/explore/workflow-schedule-review.module.css": { default: {} },
    "next/dynamic": { default: () => "ScheduleEditor" }, "next/link": { default: "Link" },
    "@/contexts/auth-context": { useAuth: () => ({ user: owner ? { uid: owner } : null }) },
    "@/components/providers/account-timezone-provider": { useAccountTimeZone: () => "Asia/Calcutta" },
    "@/components/explore/workflow-scheduling-panel": { EMPTY_SCHEDULE_DRAFT: empty, WorkflowSchedulingPanel: "WorkflowSchedulingPanel" },
    "@/lib/explore/format-schedule-draft": drafts, "@/lib/explore/workflow-scheduling-draft": scheduling,
    "@/lib/explore/workflow-schedule-client": allowConfirm ? scheduleClient : { readScheduleReceipt: () => null },
    "@/lib/explore/workflow-connected-accounts": { parseWorkflowConnectedAccounts: value => { assert.equal(value.ok, true); assert.ok(Array.isArray(value.connections)); } },
    "@/lib/firebase/auth": { getCurrentUserIdToken: async () => { externalCalls++; if (allowReview) return "fixture-token"; throw new Error("Unexpected auth request"); } },
  };
  const exported = {};
  const code = ts.transpileModule(readFileSync(new URL("../components/explore/format-schedule-panel.tsx", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { exports: exported, localStorage, crypto: { randomUUID }, navigator: { locks: { request: async (_key, _options, run) => run({}) } }, setTimeout: callback => { timers.set(++timerId, callback); return timerId; }, clearTimeout: id => timers.delete(id),
    fetch: async (url, options) => {
      externalCalls++; requests.push({ url, options });
      if (!allowReview) throw new Error("Unexpected network request");
      assert.equal(options.headers.Authorization, "Bearer fixture-token");
      assert.equal(options.cache, "no-store");
      if (options.method === "POST") {
        assert.equal(allowConfirm, true, "Review and Back must never create a schedule"); assert.equal(url, "/api/schedules");
        const input = JSON.parse(options.body);
        assert.ok([...storage.values()].some(raw => { try { return JSON.parse(raw).input?.idempotencyKey === input.idempotencyKey; } catch { return false; } }), "Persist the exact request before posting");
        return { ok: true, json: async () => ({ ok: true, schedule: { id: randomUUID(), idempotencyKey: input.idempotencyKey, status: "scheduled", [input.source.kind === "library_item" ? "libraryItemId" : "mediaAssetId"]: input.source.id, targets: input.targets.map(target => ({ socialConnectionId: target.connectionId, platform: target.platform })) } }) };
      }
      if (url === "/api/schedules?configOnly=1") return { ok: true, json: async () => ({ ok: true, minimumScheduleLeadMinutes: 5 }) };
      assert.equal(url, "/api/social/connections");
      return { ok: true, json: async () => ({ ok: true, connections: [{ id: reviewAccountId, platform: "instagram" }] }) };
    }, require(name) { if (name in imports) return imports[name]; if (name.startsWith("@/components/")) return new Proxy({}, { get: (_, key) => String(key) }); throw new Error(name); } });
  const props = { output, format: "hook", localPreview: false, imageOnly: false, active: true };
  const render = () => { cursor = 0; tree = exported.FormatSchedulePanel(props); while (effects.length) effects.shift()(); return tree; };
  return { props, storage, requests, owner(value) { owner = value; }, render,
    hydrate() { for (const [id, callback] of [...timers]) { timers.delete(id); callback(); } return render(); },
    form() { return nodes(tree).find(node => node.type === "WorkflowSchedulingPanel").props; },
    editor() { return nodes(tree).find(node => node.type === "ScheduleEditor")?.props ?? null; },
    get externalCalls() { return externalCalls; },
  };
}

test("all format reviews stay inline, retain edits on Back, and close when the finished output changes", async () => {
  for (const format of ["hook", "wall_text", "slideshow"]) {
    const h = harness(new Map(), { allowReview: true });
    h.props.format = format; h.props.imageOnly = format === "slideshow";
    if (h.props.imageOnly) h.props.output = { ...output, kind: "library_item" };
    h.render(); h.hydrate(); h.form().onChange(draft); h.render();
    const openReview = () => nodes(h.form().footer).find(node => node.type === "Button" && node.props.size === "lg").props.onClick();
    openReview(); await new Promise(setImmediate); let tree = h.render();
    const editor = h.editor();
    assert.equal(editor.presentation, "inline");
    assert.equal(editor.initialCaption, draft.caption);
    assert.equal(editor.initialTimezone, "Asia/Calcutta");
    assert.equal(editor.initialLibraryItemId, h.props.imageOnly ? output.id : undefined);
    assert.equal(editor.finalVideo?.id, h.props.imageOnly ? undefined : output.id);
    assert.equal(nodes(tree).some(node => node.props?.["aria-label"] === "Schedule summary"), false, "Do not show the previous summary during editable review");
    assert.equal(h.requests.length, 2);
    editor.onCloseDraft({ caption: "Updated caption", date: "2026-10-21", time: "17:45", timezone: "Asia/Dubai" }); editor.onClose(); tree = h.render();
    assert.equal(h.editor(), null);
    assert.deepEqual(normalize(h.form().draft), { ...draft, caption: "Updated caption", date: "2026-10-21", time: "17:45", timezone: "Asia/Dubai" });
    assert.ok(nodes(tree).some(node => node.props?.["aria-label"] === "Schedule summary"));
    openReview(); await new Promise(setImmediate); h.render();
    assert.equal(h.editor().initialTimezone, "Asia/Dubai");
    h.props.output = { ...h.props.output, id: "replacement-output" }; h.render();
    assert.equal(h.editor(), null, "A review is tied to its exact output");
    assert.equal(h.requests.some(request => request.options.method === "POST"), false);
  }
});

test("confirmed inline values become the schedule summary while the exact request is persisted before submission", async () => {
  for (const format of ["hook", "wall_text", "slideshow"]) {
    const account = randomUUID();
    const h = harness(new Map(), { allowReview: true, allowConfirm: true, reviewAccountId: account });
    h.props.format = format; h.props.imageOnly = format === "slideshow";
    if (h.props.imageOnly) h.props.output = { ...output, kind: "library_item" };
    h.render(); h.hydrate(); h.form().onChange({ ...draft, connectionId: account, connectionIds: { instagram: account } }); h.render();
    nodes(h.form().footer).find(node => node.type === "Button" && node.props.size === "lg").props.onClick(); await new Promise(setImmediate); h.render();
    assert.equal(h.requests.some(request => request.options.method === "POST"), false);
    const confirmed = { caption: "Confirmed post", scheduledDate: "2026-10-21", scheduledTime: "17:45", timezone: "Asia/Dubai", scheduledFor: "2026-10-21T13:45:00.000Z", scheduledSource: { id: output.id, kind: h.props.output.kind }, targets: [{ platform: "instagram", connectionId: account }] };
    h.editor().onSave(confirmed); await new Promise(setImmediate); h.render();
    assert.equal(h.editor(), null);
    assert.equal(h.form().draft.caption, confirmed.caption); assert.equal(h.form().draft.date, confirmed.scheduledDate);
    assert.equal(h.form().draft.time, confirmed.scheduledTime); assert.equal(h.form().draft.timezone, confirmed.timezone);
    assert.ok(nodes(h.form().footer).some(node => node.props?.role === "status" && node.props.children === "Your post is scheduled. Review it in Scheduling."));
    const posts = h.requests.filter(request => request.options.method === "POST"); assert.equal(posts.length, 1);
    assert.deepEqual(JSON.parse(posts[0].options.body).source, confirmed.scheduledSource);
  }
});

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

test("posting settings can be completed during preparation and remain intact when the verified final file arrives", () => {
  const h = harness();
  h.props.output = null; h.props.preparing = true; h.props.draftScopeId = "selected-opening";
  h.render(); h.hydrate();
  h.form().onChange(draft); h.render();
  const waiting = nodes(h.form().footer);
  assert.ok(waiting.some(node => node.props?.role === "status" && /Choose your accounts, caption and time/.test(String(node.props.children))));
  assert.equal(waiting.find(node => node.type === "Button" && node.props?.size === "lg").props.disabled, true);
  h.props.output = { ...output, id: "verified-finished-video" }; h.props.preparing = false;
  h.render(); h.hydrate();
  assert.deepEqual(normalize(h.form().draft), draft);
  assert.equal(nodes(h.form().footer).find(node => node.type === "Button" && node.props?.size === "lg").props.disabled, false);
  assert.equal(h.externalCalls, 0);
});
