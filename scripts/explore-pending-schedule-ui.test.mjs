import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import * as schedulingDraft from "../lib/explore/workflow-scheduling-draft.ts";
import * as contract from "../lib/explore/pending-schedule-contract.ts";
import * as client from "../lib/explore/pending-schedule-client.ts";
import * as scheduleClient from "../lib/explore/workflow-schedule-client.ts";

const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const element = (type, props) => ({ type, props });
const nodes = value => value == null ? [] : Array.isArray(value) ? value.flatMap(nodes) : typeof value === "object" ? [value, ...nodes(value.props?.children), ...nodes(value.props?.footer)] : [];
const text = value => value == null || typeof value === "boolean" ? "" : Array.isArray(value) ? value.map(text).join("") : typeof value === "object" ? text(value.props?.children) + text(value.props?.footer) : String(value);
const settle = () => new Promise(setImmediate);
const finishDraft = { version: 1, kind: "hook", sourceAssetId: id(1), demoAssetId: id(2), demoAudioAssetId: null, demoAudioPlayback: "once", backgroundAssetId: null, backgroundPlayback: "once", subtitles: null,
  composition: { version: 1, sourceEditing: null, demoEditing: null, sourceAudioAssetId: null, sourceAudioPlayback: "once" } };
const submission = { caption: " My exact caption ", clipSelection: "secondary_only", openingMedia: null, useOpeningClip: false,
  scheduledSource: { kind: "media_asset", id: id(1) }, scheduledDate: "2099-12-01", scheduledTime: "16:30", scheduledFor: "2099-12-01T11:00:00.000Z", timezone: "Asia/Calcutta",
  targets: [{ connectionId: id(3), platform: "instagram", settings: { shareToFeed: false, containsSyntheticMedia: true } }] };
const input = () => contract.parseExplorePendingSchedule({ version: 1, requestKey: id(10), draft: finishDraft,
  schedule: { caption: submission.caption, title: "My video", targets: submission.targets, scheduledFor: submission.scheduledFor, timezone: submission.timezone } });
function reply(request = input(), state = "preparing") {
  return { ok: true, version: 1, requestKey: request.requestKey,
    schedule: state === "unconfirmed" ? null : { id: id(20), caption: request.schedule.caption.trim(), title: request.schedule.title, timezone: request.schedule.timezone,
      scheduledFor: request.schedule.scheduledFor, targets: [], metadata: { exploreFinishRequestKey: request.requestKey, exploreFinishFingerprint: "b".repeat(64), exploreFinishOutputAssetId: id(12),
        plannedTargetsJson: JSON.stringify(request.schedule.targets), plannedScheduledFor: request.schedule.scheduledFor } },
    preparation: { state, jobId: state === "unconfirmed" ? null : id(11), mediaAssetId: state === "scheduled" ? id(12) : null, message: state === "preparing" ? "Your schedule is saved. You can leave this screen." : state } };
}
const savedEntry = (confirmed = false) => ({ version: 1, owner: "owner-a", signature: "exact-clips-v1", confirmed, input: input() });

// Render the actual panel and execute its real handlers/effects. The transport,
// browser storage and React scheduling are isolated; parsers remain real.
function fixture(options = {}) {
  let cursor = 0, tree, serverReply = options.serverReply;
  const slots = [], effects = [], calls = [], timers = new Map(), values = new Map(), changes = [];
  let timerId = 0;
  const storageKey = "ugc-explore:background-schedule:v1:owner-a:hook";
  if (options.saved) values.set(storageKey, JSON.stringify(options.saved));
  const changed = (a, b) => !a || b.some((value, index) => !Object.is(value, a[index]));
  const react = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = { value: typeof initial === "function" ? initial() : initial }; return [slots[i].value, value => { slots[i].value = typeof value === "function" ? value(slots[i].value) : value; }]; },
    useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial }; },
    useMemo(create, deps) { const i = cursor++; if (changed(slots[i]?.deps, deps)) slots[i] = { deps, value: create() }; return slots[i].value; },
    useCallback(callback, deps) { return react.useMemo(() => callback, deps); },
    useEffect(create, deps) { const i = cursor++, prior = slots[i]; if (changed(prior?.deps, deps)) { slots[i] = { deps }; effects.push(() => { prior?.cleanup?.(); slots[i].cleanup = create(); }); } },
    useLayoutEffect(create, deps) { const i = cursor++, prior = slots[i]; if (changed(prior?.deps, deps)) { prior?.cleanup?.(); slots[i] = { deps, cleanup: create() }; } },
  };
  const imports = {
    react, "react/jsx-runtime": { jsx: element, jsxs: element }, "next/dynamic": { __esModule: true, default: () => "ScheduleEditor" }, "next/link": { __esModule: true, default: "Link" },
    "lucide-react": { ArrowLeft: "ArrowLeft", ArrowRight: "ArrowRight" }, "@tanstack/react-query": { useQuery: () => ({ data: true }) },
    "@/components/ui/button": { Button: "SharedButton" }, "@/components/explore/workflow-scheduling-panel": { WorkflowSchedulingPanel: "WorkflowSchedulingPanel" }, "@/components/explore/workflow-connected-accounts": { WorkflowConnectedAccounts: "WorkflowConnectedAccounts" },
    "@/lib/firebase/auth": { getCurrentUserIdToken: async () => "fixture-token" }, "@/lib/explore/workflow-scheduling-draft": schedulingDraft,
    "@/lib/explore/workflow-connected-accounts": { parseWorkflowConnectedAccounts: value => { assert.equal(value.ok, true); assert.ok(Array.isArray(value.connections)); return value.connections; } },
    "@/lib/explore/pending-schedule-contract": contract, "@/lib/explore/pending-schedule-client": client,
    "@/lib/explore/workflow-schedule-client": scheduleClient,
    "@/components/explore/workflow-schedule-review.module.css": { __esModule: true, default: new Proxy({}, { get: (_, name) => name }) },
  };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL("../components/explore/pending-schedule-panel.tsx", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, {
    exports, require: name => { assert.ok(name in imports, `Unexpected import ${name}`); return imports[name]; }, AbortSignal, Error, Date, crypto: { randomUUID }, console,
    navigator: { locks: { request: async (_key, _opts, callback) => callback({ name: storageKey }) } },
    localStorage: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) },
    setInterval: callback => { const key = ++timerId; timers.set(key, callback); return key; }, clearInterval: key => timers.delete(key),
    fetch: async (url, init) => {
      calls.push({ url, method: init?.method ?? "GET", body: init?.body });
      if (options.transport) { const custom = await options.transport(url, init); if (custom) return custom; }
      if (url === "/api/schedules?configOnly=1") return Response.json({ ok: true, minimumScheduleLeadMinutes: 5 });
      if (url === "/api/social/connections") return Response.json({ ok: true, connections: [ { id: id(3), platform: "instagram", status: "connected" } ] });
      if (init?.method === "POST") {
        const request = JSON.parse(init.body);
        assert.equal(JSON.parse(values.get(storageKey)).input.requestKey, request.requestKey, "Receipt must be stored before the mutation");
        assert.equal(init.headers["Idempotency-Key"], request.requestKey);
        serverReply = reply(request);
        if (options.loseResponse) throw new Error("Connection lost after the server saved the request");
        return Response.json(serverReply, { status: 202 });
      }
      assert.match(url, /\/api\/explore\/schedules\?requestKey=/);
      return Response.json(serverReply ?? reply(JSON.parse(values.get(storageKey) ?? "null")?.input ?? options.saved?.input ?? input(), "unconfirmed"));
    },
  });
  const props = { owner: "owner-a", scope: "hook", composition: { signature: "exact-clips-v1", sourceId: id(1), title: "My video", draft: finishDraft, error: null, resolve: async () => finishDraft },
    draft: { platform: "instagram", caption: submission.caption, date: submission.scheduledDate, time: submission.scheduledTime, connectionId: id(3) },
    onChange: value => changes.push(value), timezone: "Asia/Calcutta", active: true, ...options.props };
  return { props, calls, values, changes, setServerReply(value) { serverReply = value; },
    render() { cursor = 0; tree = exports.PendingExploreSchedulePanel(props); while (effects.length) effects.shift()(); return tree; },
    nodes() { return nodes(tree); }, text() { return text(tree) + (nodes(tree).find(node => node.type === "ScheduleEditor")?.props.errorMessage ?? ""); },
    button(label) { return nodes(tree).find(node => node.type === "SharedButton" && text(node) === label); },
    async review() { this.render(); await settle(); this.render(); await this.button("Review schedule").props.onClick(); await settle(); this.render(); return nodes(tree).find(node => node.type === "ScheduleEditor"); },
    async tick() { for (const callback of [...timers.values()]) await callback(); await settle(); this.render(); },
    unmount() { for (const slot of slots) slot?.cleanup?.(); },
  };
}

test("mount, receipt restoration and preparation polling never create a schedule", async () => {
  const empty = fixture(); empty.render(); await settle(); empty.render(); assert.equal(empty.calls.length, 0); empty.unmount();
  const h = fixture({ saved: savedEntry(true), serverReply: reply() }); h.render(); await settle(); h.render(); await h.tick();
  assert.equal(h.calls.length, 2); assert.ok(h.calls.every(call => call.method === "GET"));
  assert.match(h.text(), /Your schedule is saved/); h.unmount();
});

test("explicit inline confirmation saves exact clips, caption, time and provider settings before rendering", async () => {
  const h = fixture(), editor = await h.review(); assert.ok(editor); assert.equal(editor.props.presentation, "inline");
  assert.equal(editor.props.pendingVideo.status, "missing_render"); assert.ok(h.calls.every(call => call.method === "GET"));
  editor.props.onSave(submission); editor.props.onSave(submission); await settle(); h.render();
  const mutations = h.calls.filter(call => call.method === "POST"); assert.equal(mutations.length, 1);
  const request = JSON.parse(mutations[0].body); assert.deepEqual(request.draft, finishDraft); assert.deepEqual(request.schedule.targets, submission.targets);
  assert.equal(request.schedule.caption, submission.caption); assert.equal(request.schedule.scheduledFor, submission.scheduledFor);
  assert.equal(request.schedule.timezone, submission.timezone); assert.equal(h.changes[0].caption, submission.caption);
  assert.equal(JSON.parse(h.values.values().next().value).confirmed, true); assert.match(h.text(), /You can leave this screen/); h.unmount();
});

test("wrong media or clip-selection submissions cannot schedule a different video", async () => {
  for (const altered of [{ scheduledSource: { kind: "media_asset", id: id(99) } }, { scheduledSource: { kind: "library_item", id: id(1) } }, { clipSelection: "hook_and_secondary" }, { useOpeningClip: true }]) {
    const h = fixture(), editor = await h.review(); editor.props.onSave({ ...submission, ...altered }); await settle(); h.render();
    assert.equal(h.calls.filter(call => call.method === "POST").length, 0); assert.match(h.text(), /selected video changed/); h.unmount();
  }
});

test("clip or account changes during async source resolution block the stale confirmation", async () => {
  for (const field of ["clip", "account"]) {
    let resolve;
    const h = fixture(); h.props.composition.resolve = () => new Promise(done => { resolve = done; });
    const editor = await h.review(); editor.props.onSave(submission); await settle();
    if (field === "clip") h.props.composition = { ...h.props.composition, signature: "changed-clips-v2" };
    else h.props.draft = { ...h.props.draft, connectionId: id(90) };
    h.render(); resolve(finishDraft); await settle(); h.render();
    assert.equal(h.calls.filter(call => call.method === "POST").length, 0); assert.match(h.text(), /clips or accounts changed/); h.unmount();
  }
});

test("source resolver cannot substitute another opening asset", async () => {
  const h = fixture(); h.props.composition.resolve = async () => ({ ...finishDraft, sourceAssetId: id(99) });
  const editor = await h.review(); editor.props.onSave(submission); await settle(); h.render();
  assert.equal(h.calls.filter(call => call.method === "POST").length, 0); assert.match(h.text(), /prepared video changed/); h.unmount();
});

test("lost POST reply is recovered by read-only check or reload without a duplicate POST", async () => {
  const h = fixture({ loseResponse: true }), editor = await h.review(); editor.props.onSave(submission); await settle(); h.render();
  assert.equal(h.calls.filter(call => call.method === "POST").length, 1);
  const saved = JSON.parse(h.values.values().next().value); assert.equal(saved.confirmed, false);
  h.button("Check saved request").props.onClick(); await settle(); h.render();
  assert.equal(h.calls.filter(call => call.method === "POST").length, 1); assert.match(h.text(), /Your schedule is saved/); h.unmount();
  const reloaded = fixture({ saved, serverReply: reply(saved.input) }); reloaded.render(); await settle(); reloaded.render();
  assert.equal(reloaded.calls.length, 1); assert.equal(reloaded.calls[0].method, "GET"); assert.equal(JSON.parse(reloaded.values.values().next().value).confirmed, true); reloaded.unmount();
});

test("background workflows recover from an explicit time rejection and confirm the current time", async () => {
  const h = fixture({ transport: async (url, init) => url === "/api/explore/schedules" && init.method === "POST" && JSON.parse(init.body).schedule.scheduledTime === "04:10" ? Response.json({ ok: false, code: "schedule_time_too_soon", message: "Choose a time at least 5 minutes from now." }, { status: 409 }) : null });
  let editor = await h.review();
  editor.props.onSave({ ...submission, scheduledDate: "2026-10-14", scheduledTime: "04:10", scheduledFor: "2026-10-13T22:40:00.000Z" }); await settle(); h.render();
  const rejected = JSON.parse(h.values.values().next().value);
  assert.equal(rejected.timeRejected, true); assert.equal(rejected.confirmed, false);
  assert.ok(h.button("Review schedule")); assert.equal(h.button("Confirm the same saved request"), undefined);
  editor = await h.review(); assert.ok(editor);
  const updated = { ...submission, scheduledDate: "2026-10-14", scheduledTime: "04:18", scheduledFor: "2026-10-13T22:48:00.000Z" };
  editor.props.onSave(updated); await settle(); h.render();
  const mutations = h.calls.filter(call => call.method === "POST"); assert.equal(mutations.length, 2);
  const request = JSON.parse(mutations[1].body);
  assert.notEqual(request.requestKey, rejected.input.requestKey); assert.equal(request.schedule.scheduledTime, "04:18");
  assert.equal(JSON.parse(h.values.values().next().value).confirmed, true); h.unmount();
});

test("rejected background requests survive reload without automatic submissions", async () => {
  const saved = { ...savedEntry(), timeRejected: true };
  const h = fixture({ saved }); h.render(); await settle(); h.render();
  assert.equal(h.calls.filter(call => call.method === "POST").length, 0);
  assert.ok(await h.review()); assert.equal(h.calls.filter(call => call.method === "POST").length, 0); h.unmount();
});

test("an absent server receipt permits only explicit replay of the same durable input", async () => {
  const saved = savedEntry(), h = fixture({ saved }); h.render(); await settle(); h.render();
  assert.equal(h.calls.filter(call => call.method === "POST").length, 0);
  h.button("Confirm the same saved request").props.onClick(); await settle(); h.render();
  const mutation = h.calls.find(call => call.method === "POST"); assert.deepEqual(JSON.parse(mutation.body), saved.input);
  assert.equal(h.calls.filter(call => call.method === "POST").length, 1); h.unmount();
});

test("another tab's confirmed receipt is read before any new mutation", async () => {
  const h = fixture(), editor = await h.review(), saved = savedEntry(true);
  h.values.set("ugc-explore:background-schedule:v1:owner-a:hook", JSON.stringify(saved)); h.setServerReply(reply(saved.input));
  editor.props.onSave(submission); await settle(); h.render();
  assert.equal(h.calls.filter(call => call.method === "POST").length, 0); assert.match(h.text(), /Your schedule is saved/); h.unmount();
});

test("a verified preparation failure with no targets can be explicitly confirmed for a new future time", async () => {
  const saved = savedEntry(true), h = fixture({ saved, serverReply: reply(saved.input, "failed") });
  h.render(); await settle(); h.render();
  assert.equal(h.calls.filter(call => call.method === "POST").length, 0);
  const editor = await h.review(); assert.ok(editor);
  const next = { ...submission, scheduledDate: "2099-12-02", scheduledFor: "2099-12-02T11:00:00.000Z" };
  editor.props.onSave(next); await settle(); h.render();
  const mutation = h.calls.find(call => call.method === "POST"); assert.ok(mutation);
  const request = JSON.parse(mutation.body); assert.notEqual(request.requestKey, saved.input.requestKey);
  assert.equal(request.schedule.scheduledFor, next.scheduledFor); h.unmount();
});

test("platform failures with existing publishing targets cannot create a duplicate schedule", async () => {
  const saved = savedEntry(true), failed = reply(saved.input, "failed"); failed.schedule.targets = [{ id: id(80), status: "scheduled" }];
  const h = fixture({ saved, serverReply: failed }); h.render(); await settle(); h.render();
  assert.equal(h.button("Review schedule").props.disabled, true);
  assert.equal(h.calls.filter(call => call.method === "POST").length, 0); h.unmount();
});

test("reply verification rejects wrong snapshots and allows existing provider defaults", () => {
  const saved = savedEntry(); assert.equal(client.verifyExploreScheduleReply(reply(), saved).preparation.state, "preparing");
  const defaults = reply(); const planned = JSON.parse(defaults.schedule.metadata.plannedTargetsJson); planned[0].settings.extraDefault = false; defaults.schedule.metadata.plannedTargetsJson = JSON.stringify(planned);
  assert.equal(client.verifyExploreScheduleReply(defaults, saved).preparation.state, "preparing");
  for (const corrupt of [
    value => { value.schedule.caption = "Different caption"; }, value => { value.schedule.timezone = "UTC"; },
    value => { value.schedule.scheduledFor = "2099-12-02T11:00:00Z"; }, value => { value.schedule.metadata.plannedScheduledFor = "2099-12-02T11:00:00Z"; },
    value => { value.schedule.metadata.plannedTargetsJson = JSON.stringify([{ ...submission.targets[0], connectionId: id(99) }]); },
    value => { value.schedule.metadata.plannedTargetsJson = JSON.stringify([{ ...submission.targets[0], settings: { shareToFeed: true, containsSyntheticMedia: true } }]); },
    value => { value.schedule.metadata.plannedTargetsJson = "bad json"; }, value => { value.preparation.mediaAssetId = id(99); }, value => { value.requestKey = id(99); },
  ]) { const value = reply(); corrupt(value); assert.throws(() => client.verifyExploreScheduleReply(value, saved)); }
});
