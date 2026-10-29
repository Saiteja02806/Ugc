import * as scheduleTransport from "../lib/explore/workflow-schedule-transport.ts";
import assert from "node:assert/strict";
import { createScheduleCacheFixture } from "./scheduling-cache-test-helpers.mjs";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import * as schedulingDraft from "../lib/explore/workflow-scheduling-draft.ts";
import * as contract from "../lib/explore/pending-schedule-contract.ts";
import * as client from "../lib/explore/pending-schedule-client.ts";
import { prepareSimpleWorkflowSchedule } from "../lib/explore/simple-workflow-schedule.ts";
import * as scheduleClient from "../lib/explore/workflow-schedule-client.ts";
import * as repeatIntent from "../lib/explore/schedule-repeat-intent.ts";

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
  const cache = createScheduleCacheFixture(options.props?.owner ?? "owner-a");
  let cursor = 0, tree, serverReply = options.serverReply;
  const slots = [], effects = [], calls = [], timers = new Map(), values = new Map(), changes = [];
  let timerId = 0;
  const polling = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL("../lib/http/foreground-polling.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports: polling, document: { visibilityState: "visible", addEventListener() {}, removeEventListener() {} },
    window: { addEventListener() {}, removeEventListener() {} }, navigator: { onLine: true },
    setTimeout: callback => { const key = ++timerId; timers.set(key, callback); return key; }, clearTimeout: key => timers.delete(key),
  });
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
    "@/lib/http/foreground-polling": polling,
    "@/lib/explore/schedule-repeat-intent": repeatIntent,
    react, "react/jsx-runtime": { jsx: element, jsxs: element }, "next/dynamic": { __esModule: true, default: () => "ScheduleEditor" }, "next/link": { __esModule: true, default: "Link" },
    "lucide-react": { ArrowLeft: "ArrowLeft", ArrowRight: "ArrowRight" }, "@tanstack/react-query": { useQuery: () => ({ data: true }), useQueryClient: () => cache.queryClient },
    "@/lib/scheduling/account-data-query": cache.api,
    "@/components/ui/button": { Button: "SharedButton" }, "@/components/explore/workflow-scheduling-panel": { WorkflowSchedulingPanel: "WorkflowSchedulingPanel" }, "@/components/explore/workflow-connected-accounts": { WorkflowConnectedAccounts: "WorkflowConnectedAccounts" },
    "@/lib/firebase/auth": { getCurrentUserIdToken: async () => "fixture-token" }, "@/lib/explore/workflow-scheduling-draft": schedulingDraft,
    "@/lib/explore/workflow-connected-accounts": { parseWorkflowConnectedAccounts: value => { assert.equal(value.ok, true); assert.ok(Array.isArray(value.connections)); return value.connections; } },
    "@/lib/explore/pending-schedule-contract": contract, "@/lib/explore/pending-schedule-client": client,
    "@/lib/explore/workflow-schedule-client": scheduleClient, "@/lib/explore/workflow-schedule-transport": scheduleTransport, "@/lib/explore/simple-workflow-schedule": { prepareSimpleWorkflowSchedule },
    "@/components/explore/workflow-schedule-review.module.css": { __esModule: true, default: new Proxy({}, { get: (_, name) => name }) },
  };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL("../components/explore/pending-schedule-panel.tsx", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, {
    exports, require: name => { assert.ok(name in imports, `Unexpected import ${name}`); return imports[name]; }, AbortSignal, Error, Date, crypto: { randomUUID }, console,
    navigator: { locks: { request: async (_key, _opts, callback) => callback({ name: storageKey }) } },
    localStorage: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) },
    setInterval: callback => { const key = ++timerId; timers.set(key, callback); return key; }, clearInterval: key => timers.delete(key),
    fetch: async (url, init) => {
      calls.push({ url, method: init?.method ?? "GET", body: init?.body });
      if (options.transport) { const custom = await options.transport(url, init); if (custom) return custom; }
      if (url === "/api/schedules?configOnly=1") return Response.json({ ok: true, minimumScheduleLeadMinutes: 5 });
      if (url === "/api/social/connections") return Response.json({ ok: true, connections: [ { id: id(3), platform: "instagram", status: "connected", platformAccountName: null, platformAccountUsername: null, scopes: ["instagram_business_content_publish"], supportsBackgroundRefresh: true } ] });
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
    onChange: value => { changes.push(value); props.draft = value; }, timezone: "Asia/Calcutta", active: true, ...options.props };
  return { props, calls, values, changes, cache, setServerReply(value) { serverReply = value; },
    render() { cursor = 0; tree = exports.PendingExploreSchedulePanel(props); while (effects.length) effects.shift()(); return tree; },
    nodes() { return nodes(tree); }, text() { return text(tree) + (nodes(tree).find(node => node.type === "ScheduleEditor")?.props.errorMessage ?? ""); },
    button(label) { return nodes(tree).find(node => node.type === "SharedButton" && text(node) === label); },
    async form() { for (let i = 0; i < 4; i++) { this.render(); await settle(); } this.render(); assert.equal(this.button("Review schedule"), undefined); assert.equal(nodes(tree).find(node => node.type === "ScheduleEditor"), undefined); return nodes(tree).find(node => node.type === "WorkflowSchedulingPanel"); },
    async tick() { for (const callback of [...timers.values()]) await callback(); await settle(); this.render(); },
    unmount() { for (const slot of slots) slot?.cleanup?.(); },
  };
}

test("mount, receipt restoration and preparation polling never create a schedule", async () => {
  const empty = fixture(); empty.render(); await settle(); empty.render(); assert.equal(empty.calls.filter(call => call.method === "POST").length, 0); empty.unmount();
  const h = fixture({ saved: savedEntry(true), serverReply: reply() }); h.render(); await settle(); h.render(); await h.tick();
  assert.equal(h.calls.length, 2); assert.ok(h.calls.every(call => call.method === "GET"));
  assert.match(h.text(), /Post scheduled/); h.unmount();
});

test("definite background rejection releases only an unconfirmed request so corrected choices can be submitted", async () => {
  let rejected = false;
  const h = fixture({ transport: async (url, init) => {
    if (url === "/api/explore/schedules" && init.method === "POST" && !rejected) { rejected = true; return Response.json({ ok: false, code: "schedule_selection_unavailable", message: "Choose your current account." }, { status: 409 }); }
    return null;
  } });
  await h.form(); h.button("Schedule post").props.onClick(); await settle(); h.render();
  assert.equal(h.values.has("ugc-explore:background-schedule:v1:owner-a:hook"), false);
  h.props.draft = { ...h.props.draft, caption: "Corrected caption" }; h.render();
  h.button("Schedule post").props.onClick(); await settle(); h.render();
  const posted = h.calls.filter(c => c.method === "POST").map(c => JSON.parse(c.body));
  assert.equal(posted.length, 2); assert.notEqual(posted[0].requestKey, posted[1].requestKey);
  assert.equal(posted[1].schedule.caption, "Corrected caption"); h.unmount();
});

test("a background selection rejection preserves an accepted post or an unavailable status read", async () => {
  for (const accepted of [true, false]) {
    let captured;
    const h = fixture({ transport: async (url, init) => {
      if (init.method === "POST") { captured = JSON.parse(init.body); return Response.json({ ok: false, code: "schedule_selection_unavailable", message: "Account changed" }, { status: 409 }); }
      if (url.startsWith("/api/explore/schedules?requestKey=")) return accepted ? Response.json(reply(captured)) : Response.json({ ok: false }, { status: 503 });
      return null;
    } });
    await h.form(); h.button("Schedule post").props.onClick(); await settle(); h.render();
    const stored = JSON.parse(h.values.get("ugc-explore:background-schedule:v1:owner-a:hook"));
    assert.equal(stored.input.requestKey, captured.requestKey); assert.equal(stored.confirmed, accepted);
    h.unmount();
  }
});

test("a pending preparation does not complete the editing draft; a verified scheduled result does",async()=>{
  let completed=0;const h=fixture({saved:savedEntry(true),serverReply:reply(),props:{onScheduled:()=>completed++}});
  h.render();await settle();h.render();assert.equal(completed,0);
  h.setServerReply(reply(input(),"scheduled"));await h.tick();assert.equal(completed,1);h.unmount();
});

test("an audio preparation timeout keeps the form usable and cannot submit a schedule", async () => {
  const h = fixture();
  h.props.composition.resolve = async () => { throw new DOMException("signal timed out", "TimeoutError"); };
  await h.form(); h.button("Schedule post").props.onClick(); await settle(); h.render();
  assert.match(h.text(), /video or background audio took too long/);
  assert.match(h.text(), /post has not been submitted/);
  assert.equal(h.calls.filter(call => call.method === "POST").length, 0);
  assert.equal(h.button("Schedule post").props.disabled, false);
  assert.equal(h.props.draft.caption, submission.caption);
  h.props.composition.resolve = async () => finishDraft;
  h.render(); h.button("Schedule post").props.onClick(); await settle(); h.render();
  assert.match(h.text(), /Post scheduled/);
  assert.equal(h.calls.filter(call => call.method === "POST").length, 1);
  h.unmount();
});

test("a settings timeout names the failed check and never submits the post", async () => {
  const h = fixture({ transport: async url => {
    if (url === "/api/social/connections") throw new DOMException("signal timed out", "TimeoutError");
  } });
  await h.form(); h.button("Schedule post").props.onClick(); await settle(); h.render();
  assert.match(h.text(), /connected accounts took too long/);
  assert.equal(h.calls.filter(call => call.method === "POST").length, 0);
  assert.equal(h.calls.filter(call => call.url === "/api/social/connections").length, 2);
  assert.equal(h.button("Schedule post").props.disabled, false);
  h.unmount();
});

test("the original simple form submits directly with one Schedule post click", async () => {
  const h = fixture(), form = await h.form(); assert.ok(form); assert.equal(form.props.presentation, "review");
  assert.equal(h.calls.length, 0, "Entering Schedule must not replace the form or create a schedule");
  const action=h.button("Schedule post"); action.props.onClick(); action.props.onClick(); await settle(); h.render();
  const mutations = h.calls.filter(call => call.method === "POST"); assert.equal(mutations.length, 1);
  const request = JSON.parse(mutations[0].body); assert.deepEqual(request.draft, finishDraft);
  assert.deepEqual(request.schedule.targets, [{ connectionId: id(3), platform: "instagram", settings: { shareToFeed: true } }]);
  assert.equal(request.schedule.caption, submission.caption); assert.equal(request.schedule.scheduledFor, submission.scheduledFor);
  assert.equal(request.schedule.timezone, submission.timezone); assert.equal(h.changes.length, 0);
  assert.equal(JSON.parse(h.values.values().next().value).confirmed, true); assert.match(h.text(), /Post scheduled/);
  assert.ok(h.button("Schedule post"));
  assert.doesNotMatch(h.text(), /Check saved|Confirm the same|unconfirmed/); h.unmount();
});

test("unavailable accounts and invalid compositions cannot enqueue video preparation", async () => {
  for (const mode of ["account", "composition"]) {
    const h=fixture(); if (mode === "account") h.props.draft.connectionId=id(99); else h.props.composition.error="Choose valid clips";
    await h.form(); h.button("Schedule post").props.onClick(); await settle(); h.render();
    assert.equal(h.calls.filter(call=>call.method === "POST").length,0); h.unmount();
  }
});

test("clip or account changes during async source resolution block the stale confirmation", async () => {
  for (const field of ["clip", "account"]) {
    let resolve;
    const h = fixture(); h.props.composition.resolve = () => new Promise(done => { resolve = done; });
    await h.form(); h.button("Schedule post").props.onClick(); await settle();
    if (field === "clip") h.props.composition = { ...h.props.composition, signature: "changed-clips-v2" };
    else h.props.draft = { ...h.props.draft, connectionId: id(90) };
    h.render(); resolve(finishDraft); await settle(); h.render();
    assert.equal(h.calls.filter(call => call.method === "POST").length, 0); assert.match(h.text(), /clips or accounts changed/); h.unmount();
  }
});

test("source resolver cannot substitute another opening asset", async () => {
  const h = fixture(); h.props.composition.resolve = async () => ({ ...finishDraft, sourceAssetId: id(99) });
  await h.form(); h.button("Schedule post").props.onClick(); await settle(); h.render();
  assert.equal(h.calls.filter(call => call.method === "POST").length, 0); assert.match(h.text(), /prepared video changed/); h.unmount();
});

test("confirmed background preparation reaches Scheduling while unconfirmed requests stay out of its cache", async () => {
  const h = fixture();
  await h.form(); h.button("Schedule post").props.onClick(); await settle(); h.render();
  assert.equal(h.calls.filter(call => call.method === "POST").length, 1);
  assert.equal(h.cache.data().schedules[0].id, id(20));
  assert.equal(h.cache.queryClient.getQueryState(h.cache.key).isInvalidated, true);
  assert.equal(h.cache.foreign().schedules[0].id, "foreign-post");
  h.unmount();
});

test("lost POST reply is recovered silently with one read and no duplicate POST or recovery questions", async () => {
  const h = fixture({ loseResponse: true }); await h.form(); h.button("Schedule post").props.onClick(); await settle(); h.render();
  assert.equal(h.calls.filter(call => call.method === "POST").length, 1);
  const saved = JSON.parse(h.values.values().next().value); assert.equal(saved.confirmed, true);
  assert.equal(h.cache.data().schedules[0].id, id(20));
  assert.equal(h.calls.filter(call => call.method === "POST").length, 1); assert.match(h.text(), /Post scheduled/);
  assert.equal(h.calls.filter(call => call.method === "GET" && call.url.startsWith("/api/explore/schedules?requestKey=")).length, 1);
  assert.doesNotMatch(h.text(), /Check saved|Confirm the same|unconfirmed/); h.unmount();
  const reloaded = fixture({ saved, serverReply: reply(saved.input) }); reloaded.render(); await settle(); reloaded.render();
  assert.equal(reloaded.calls.length, 1); assert.equal(reloaded.calls[0].method, "GET"); assert.equal(JSON.parse(reloaded.values.values().next().value).confirmed, true); reloaded.unmount();
});

test("background workflows correct explicit server time rejections in the same simple form", async () => {
  let rejectedOnce=false;
  const h=fixture({transport:async(url,init)=> { if(url === "/api/explore/schedules" && init.method === "POST" && !rejectedOnce) { rejectedOnce=true; return Response.json({ok:false,code:"schedule_time_too_soon",message:"Choose a later time"},{status:409}); } return null; }});
  await h.form(); h.button("Schedule post").props.onClick(); await settle(); h.render();
  const rejected=JSON.parse(h.values.values().next().value); assert.equal(rejected.timeRejected,true); assert.equal(rejected.confirmed,false);
  assert.equal(h.button("Confirm the same saved request"),undefined); assert.ok(await h.form());
  h.props.draft={...h.props.draft,time:"16:45"}; h.render(); h.button("Schedule post").props.onClick(); await settle(); h.render();
  const posts=h.calls.filter(call=>call.method === "POST"); assert.equal(posts.length,2);
  const request=JSON.parse(posts[1].body); assert.notEqual(request.requestKey,rejected.input.requestKey); assert.equal(request.schedule.scheduledTime,"16:45");
  assert.equal(JSON.parse(h.values.values().next().value).confirmed,true); h.unmount();
});

test("rejected background requests survive reload without automatic submissions", async () => {
  const saved = { ...savedEntry(), timeRejected: true };
  const h = fixture({ saved }); h.render(); await settle(); h.render();
  assert.equal(h.calls.filter(call => call.method === "POST").length, 0);
  assert.ok(await h.form()); assert.equal(h.calls.filter(call => call.method === "POST").length, 0); h.unmount();
});

test("an absent server receipt permits only explicit replay of the same durable input", async () => {
  const saved = savedEntry(), h = fixture({ saved }); h.render(); await settle(); h.render();
  assert.equal(h.calls.filter(call => call.method === "POST").length, 0);
  assert.equal(h.button("Confirm the same saved request"), undefined);
  assert.equal(h.button("Check saved request"), undefined);
  h.button("Try again").props.onClick(); await settle(); h.render();
  const mutation = h.calls.find(call => call.method === "POST"); assert.deepEqual(JSON.parse(mutation.body), saved.input);
  assert.equal(h.calls.filter(call => call.method === "POST").length, 1); h.unmount();
});

test("another tab's confirmed receipt is read before any new mutation", async () => {
  const h = fixture(), saved = savedEntry(true); await h.form();
  h.values.set("ugc-explore:background-schedule:v1:owner-a:hook", JSON.stringify(saved)); h.setServerReply(reply(saved.input));
  h.button("Schedule post").props.onClick(); await settle(); h.render();
  assert.equal(h.calls.filter(call => call.method === "POST").length, 0); assert.match(h.text(), /Post scheduled/); h.unmount();
});

test("a verified preparation failure with no targets can be explicitly confirmed for a new future time", async () => {
  const saved = savedEntry(true), h = fixture({ saved, serverReply: reply(saved.input, "failed") });
  h.render(); await settle(); h.render();
  assert.equal(h.calls.filter(call => call.method === "POST").length, 0);
  const editor = await h.form(); assert.ok(editor);
  const next = { ...submission, scheduledDate: "2099-12-02", scheduledFor: "2099-12-02T11:00:00.000Z" };
  h.props.draft={...h.props.draft,date:next.scheduledDate}; h.render(); h.button("Schedule post").props.onClick(); await settle(); h.render();
  const mutation = h.calls.find(call => call.method === "POST"); assert.ok(mutation);
  const request = JSON.parse(mutation.body); assert.notEqual(request.requestKey, saved.input.requestKey);
  assert.equal(request.schedule.scheduledFor, next.scheduledFor); h.unmount();
});

test("platform failures retain their schedule until an explicit new intent", async () => {
  const saved = savedEntry(true), failed = reply(saved.input, "failed"); failed.schedule.targets = [{ id: id(80), status: "scheduled" }];
  const h = fixture({ saved, serverReply: failed }); h.render(); await settle(); h.render();
  assert.equal(h.button("Schedule post").props.disabled, false);
  h.button("Schedule post").props.onClick(); await settle(); h.render();
  assert.equal(h.calls.filter(call => call.method === "POST").length, 0); h.unmount();
});

test("background Hook, Wall and Phone scheduling permits another post an hour later", async () => {
  for (const format of ["hook", "wall_text", "phone"]) {
    const h = fixture({ transport: async (_url, init) => {
      if (init?.method !== "POST") return;
      const value = reply(JSON.parse(init.body)); value.schedule.id = randomUUID();
      return Response.json(value, { status: 202 });
    } });
    h.props.composition = { ...h.props.composition, signature: format, draft: { ...finishDraft, kind: format === "phone" ? "phone" : "hook" }, resolve: async () => ({ ...finishDraft, kind: format === "phone" ? "phone" : "hook" }) };
    await h.form(); h.button("Schedule post").props.onClick(); await settle(); h.render();
    const storageKey = "ugc-explore:background-schedule:v1:owner-a:hook", previous = JSON.parse(h.values.get(storageKey));
    const repeat = h.button("Schedule post"); assert.equal(repeat.props.disabled, false);
    repeat.props.onClick(); repeat.props.onClick(); await settle(); h.render();
    assert.equal(h.calls.filter(c => c.method === "POST").length, 1);
    assert.equal(h.values.has(storageKey), false);
    assert.equal(JSON.parse(h.values.get(`${storageKey}:confirmed:${previous.input.requestKey}`)).input.requestKey, previous.input.requestKey);
    h.props.draft = { ...h.props.draft, time: "17:30" }; h.render();
    h.button("Schedule post").props.onClick(); await settle(); h.render();
    const posts = h.calls.filter(c => c.method === "POST").map(c => JSON.parse(c.body));
    assert.equal(posts.length, 2); assert.deepEqual(posts[1].draft, posts[0].draft);
    assert.notEqual(posts[1].requestKey, posts[0].requestKey);
    assert.equal(Date.parse(posts[1].schedule.scheduledFor) - Date.parse(posts[0].schedule.scheduledFor), 3600000);
    assert.equal(h.cache.data().schedules.length, 2); h.unmount();
  }
});

test("a delayed preparation poll cannot restore an archived intent or overwrite its replacement", async () => {
  let complete, reading = false;
  const original = savedEntry(true);
  const h = fixture({ saved: original, serverReply: reply(), transport: async (_url, init) => {
    if (reading && !init?.method) return new Promise(resolve => { complete = resolve; });
  } });
  await h.form(); reading = true;
  const polling = h.tick(); await settle(); assert.ok(complete);
  h.button("Schedule post").props.onClick(); await settle(); h.render();
  reading = false; h.props.draft = { ...h.props.draft, time: "17:30" }; h.render();
  h.button("Schedule post").props.onClick(); await settle(); h.render();
  const key = "ugc-explore:background-schedule:v1:owner-a:hook", replacement = h.values.get(key);
  complete(Response.json(reply(original.input, "scheduled"))); await polling;
  assert.equal(h.values.get(key), replacement, "Old status cannot restore the previous request"); h.unmount();
});

test("pending render schedules a stale five-minute preview at confirmation and recovers a lost reply without reposting", async () => {
  const h = fixture({ loseResponse: true });
  h.props.draft = { ...h.props.draft, date: "2000-01-01", fiveMinutesFromSubmit: true, publishMode: "scheduled" };
  await h.form();
  assert.equal(h.calls.some(call => call.method === "POST"), false);
  h.button("Schedule post").props.onClick(); await settle(); h.render();
  const posts = h.calls.filter(call => call.method === "POST");
  assert.equal(posts.length, 1);
  const request = JSON.parse(posts[0].body);
  assert.equal(request.schedule.useDefaultScheduleTime, true);
  assert.ok(Date.parse(request.schedule.scheduledFor) > Date.now());
  assert.deepEqual(request.draft, finishDraft);
  assert.equal(request.schedule.targets[0].connectionId, id(3));
  await h.tick();
  assert.equal(h.calls.filter(call => call.method === "POST").length, 1);
  h.unmount();
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
