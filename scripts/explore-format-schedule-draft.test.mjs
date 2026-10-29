import * as timeDisplay from "../lib/scheduling/time-display.ts";
import * as scheduleTransport from "../lib/explore/workflow-schedule-transport.ts";
import assert from "node:assert/strict";
import { createScheduleCacheFixture } from "./scheduling-cache-test-helpers.mjs";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import * as drafts from "../lib/explore/format-schedule-draft.ts";
import * as scheduling from "../lib/explore/workflow-scheduling-draft.ts";
import { prepareSimpleWorkflowSchedule } from "../lib/explore/simple-workflow-schedule.ts";
import * as scheduleClient from "../lib/explore/workflow-schedule-client.ts";
import * as repeatIntent from "../lib/explore/schedule-repeat-intent.ts";

const empty = { platform: "", caption: "", date: "", time: "", connectionId: "" };
const output = { id: "00000000-0000-4000-8000-000000000001", kind: "media_asset", url: "/saved.mp4", title: "Saved video" };
const scope = { environment: "live", owner: "alice", format: "hook", output };
const draft = { caption: "My post", date: "2099-12-01", time: "18:30", platform: "instagram", platforms: ["instagram"], connectionId: "account-a", connectionIds: { instagram: "account-a" } };
const normalize = value => JSON.parse(JSON.stringify(value));
const nodes = tree => Array.isArray(tree) ? tree.flatMap(nodes) : tree && typeof tree === "object" ? [tree, ...nodes(tree.props?.children)] : [];

test("the shared workflow time field preserves 24-hour values and the rest of the scheduling draft", () => {
  const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
  const imports = {
    "@/components/scheduling/schedule-quick-actions": { ScheduleQuickActions: "quick-actions" },
    "@/components/scheduling/use-device-time-format": { useDeviceTimeFormat: () => false },
    "@/lib/scheduling/time-display": timeDisplay,
    react: { useId: () => "schedule-test" }, "react/jsx-runtime": jsx,
    "lucide-react": { Check: "Check" },
    "@/components/social/platform-icon": { SocialPlatformIcon: "SocialPlatformIcon" },
    "@/components/ui/button": { Button: "Button" }, "@/components/ui/input": { Input: "Input" },
    "@/components/scheduling/workflow-time-picker": { WorkflowTimePicker: "time-picker" },
    "@/components/scheduling/post-caption-field": { PostCaptionField: "PostCaptionField" },
    "@/components/explore/workflow-creation.module.css": { default: {} },
    "@/components/explore/workflow-schedule-review.module.css": { default: {} },
    "@/lib/social/platform-visibility": { isSocialPlatformVisible: () => true },
    "@/lib/explore/workflow-scheduling-draft": scheduling,
  };
  const exported = {};
  const code = ts.transpileModule(readFileSync(new URL("../components/explore/workflow-scheduling-panel.tsx", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { exports: exported, require(name) { assert.ok(name in imports, name); return imports[name]; } });
  for (const time of ["00:00", "05:30", "12:00", "17:30", "23:59"]) {
    const current = { ...draft, time, timezone: "Asia/Calcutta" };
    let next;
    const tree = exported.WorkflowSchedulingPanel({ draft: current, onChange: value => { next = value; }, timezone: current.timezone });
    const field = nodes(tree).find(node => node.type === "time-picker");
    assert.equal(field.props.value, time);
    field.props.onChange("17:30");
    assert.deepEqual(normalize(next), { ...current, time: "17:30", publishMode: "scheduled" });
    assert.equal(current.time, time, "Editing must not mutate the existing draft");
  }
  let current = { ...draft }, next;
  const render = () => exported.WorkflowSchedulingPanel({ draft: current, onChange: value => { next = value; }, timezone: "Asia/Calcutta" });
  for (const preset of [5, 60, 180, "tomorrow"]) {
    nodes(render()).find(node => node.type === "quick-actions").props.onSelect({ date: "2099-12-02", time: "09:00" }, preset);
    current = next;
    assert.equal(current.fiveMinutesFromSubmit === true, preset === 5);
    assert.equal(current.publishMode, "scheduled");
    assert.equal(current.caption, draft.caption);
    assert.deepEqual(current.connectionIds, draft.connectionIds);
  }
  for (const control of ["time-picker", "Input"]) {
    current = { ...draft, fiveMinutesFromSubmit: true };
    const field = nodes(render()).find(node => node.type === control);
    field.props.onChange(control === "Input" ? { target: { value: "2099-12-03" } } : "21:30");
    assert.equal(next.fiveMinutesFromSubmit, undefined, "Either manual field clears relative intent");
    assert.equal(next.caption, draft.caption);
  }
});

test("unsent schedule forms are versioned and isolated by owner, format, mode and exact output", () => {
  const key = drafts.formatScheduleDraftKey(scope);
  const raw = drafts.serializeFormatScheduleDraft(key, draft);
  assert.deepEqual(drafts.readFormatScheduleDraft(raw, key), draft);
  for (const changed of [{ owner: "bob" }, { format: "wall_text" }, { environment: "preview" }, { output: null }, { output: { ...output, id: "other" } }, { output: { ...output, kind: "library_item" } }]) {
    assert.equal(drafts.readFormatScheduleDraft(raw, drafts.formatScheduleDraftKey({ ...scope, ...changed })), null);
  }
});

test("a deliberately cleared caption survives draft reload without reapplying the account default", () => {
  const key = drafts.formatScheduleDraftKey(scope);
  const cleared = { ...draft, caption: "", captionInitialized: true };
  const restored = drafts.readFormatScheduleDraft(drafts.serializeFormatScheduleDraft(key, cleared), key);
  assert.equal(restored.caption, ""); assert.equal(restored.captionInitialized, true);
  assert.equal(drafts.readFormatScheduleDraft(JSON.stringify({ version: 1, key, draft: { ...cleared, captionInitialized: "true" } }), key), null);
});

test("five-minute intent survives unsent draft reload without changing exact legacy drafts", () => {
  const key = drafts.formatScheduleDraftKey(scope), relative = { ...draft, fiveMinutesFromSubmit: true };
  assert.deepEqual(drafts.readFormatScheduleDraft(drafts.serializeFormatScheduleDraft(key, relative), key), relative);
  for (const value of ["true", 5, {}]) assert.equal(drafts.readFormatScheduleDraft(JSON.stringify({ version: 1, key, draft: { ...draft, fiveMinutesFromSubmit: value } }), key), null);
  assert.deepEqual(drafts.readFormatScheduleDraft(drafts.serializeFormatScheduleDraft(key, draft), key), draft);
});

test("saved caption defaults wait for owned draft and schedule recovery before the form becomes eligible", () => {
  const h = harness();
  h.render(); assert.equal(h.form().captionEnabled, false);
  h.hydrate(); h.render(); assert.equal(h.form().captionEnabled, true);
  assert.equal(h.form().ownerId, "alice");
  h.form().onChange({ ...draft, caption: "", captionInitialized: true });
  h.render(); assert.equal(h.form().draft.captionInitialized, true);
  assert.equal(h.externalCalls, 0);
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
function harness(storage = new Map(), { allowReview = false, allowConfirm = false, reviewAccountId = "account-a", transport } = {}) {
  const cache = createScheduleCacheFixture("alice");
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
  const imports = {
    "@/components/scheduling/schedule-quick-actions": { ScheduleQuickActions: "quick-actions" },
    "@/components/scheduling/use-device-time-format": { useDeviceTimeFormat: () => false },
    "@/lib/scheduling/time-display": timeDisplay, react, "react/jsx-runtime": jsx, "react-dom": { createPortal: children => children },
    "@/lib/explore/schedule-repeat-intent": repeatIntent,
    "@tanstack/react-query": { useQueryClient: () => cache.queryClient },
    "@/lib/scheduling/account-data-query": cache.api,
    "lucide-react": { ArrowLeft: "ArrowLeft", ArrowRight: "ArrowRight" },
    "@/components/explore/workflow-schedule-review.module.css": { default: {} },
    "next/dynamic": { default: () => "ScheduleEditor" }, "next/link": { default: "Link" },
    "@/contexts/auth-context": { useAuth: () => ({ user: owner ? { uid: owner } : null }) },
    "@/components/providers/account-timezone-provider": { useAccountTimeZone: () => "Asia/Calcutta" },
    "@/components/explore/workflow-scheduling-panel": { EMPTY_SCHEDULE_DRAFT: empty, WorkflowSchedulingPanel: "WorkflowSchedulingPanel" },
    "@/lib/explore/workflow-schedule-transport": scheduleTransport, "@/lib/explore/simple-workflow-schedule": { prepareSimpleWorkflowSchedule },
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
      if (transport) { const response = await transport(url, options); if (response) return response; }
      if (options.method === "POST") {
        assert.equal(allowConfirm, true, "Review and Back must never create a schedule"); assert.equal(url, "/api/schedules");
        const input = JSON.parse(options.body);
        assert.ok([...storage.values()].some(raw => { try { return JSON.parse(raw).input?.idempotencyKey === input.idempotencyKey; } catch { return false; } }), "Persist the exact request before posting");
        return { ok: true, json: async () => ({ ok: true, schedule: { id: randomUUID(), idempotencyKey: input.idempotencyKey, status: "scheduled", [input.source.kind === "library_item" ? "libraryItemId" : "mediaAssetId"]: input.source.id, targets: input.targets.map(target => ({ socialConnectionId: target.connectionId, platform: target.platform })) } }) };
      }
      if (url === "/api/schedules?configOnly=1") return { ok: true, json: async () => ({ ok: true, minimumScheduleLeadMinutes: 5 }) };
      assert.equal(url, "/api/social/connections");
      return { ok: true, json: async () => ({ ok: true, connections: [{ id: reviewAccountId, platform: "instagram",status:"connected",platformAccountName:null,platformAccountUsername:null,scopes:["instagram_business_content_publish"],supportsBackgroundRefresh:true }] }) };
    }, require(name) { if (name in imports) return imports[name]; if (name.startsWith("@/components/")) return new Proxy({}, { get: (_, key) => String(key) }); throw new Error(name); } });
  const props = { output, format: "hook", localPreview: false, imageOnly: false, active: true };
  const render = () => { cursor = 0; tree = exported.FormatSchedulePanel(props); while (effects.length) effects.shift()(); return tree; };
  return { props, storage, requests, cache, owner(value) { owner = value; }, render,
    hydrate() { for (const [id, callback] of [...timers]) { timers.delete(id); callback(); } return render(); },
    form() { return nodes(tree).find(node => node.type === "WorkflowSchedulingPanel").props; },
    editor() { return nodes(tree).find(node => node.type === "ScheduleEditor")?.props ?? null; },
    get externalCalls() { return externalCalls; },
  };
}

const clickSchedule = h => nodes(h.form().footer).find(node => node.type === "Button" && node.props.size === "lg").props.onClick();
const settle = () => new Promise(setImmediate);

test("definite selection rejection releases the format request and corrected choices get a fresh identity", async () => {
  const account = randomUUID(); let rejected = false;
  const h = harness(new Map(), { allowReview: true, allowConfirm: true, reviewAccountId: account, transport: async (url, init) => {
    if (url === "/api/schedules" && init.method === "POST" && !rejected) { rejected = true; return Response.json({ ok: false, code: "schedule_selection_unavailable", message: "Choose your current account." }, { status: 409 }); }
    if (url === "/api/schedules" && !init.method) return Response.json({ ok: true, schedules: [] });
    return null;
  } });
  h.render(); h.hydrate(); h.form().onChange({ ...draft, connectionId: account, connectionIds: { instagram: account } }); h.render();
  clickSchedule(h); await settle(); h.render();
  assert.equal([...h.storage.values()].some(raw => { try { return Boolean(JSON.parse(raw).input?.idempotencyKey); } catch { return false; } }), false);
  h.form().onChange({ ...h.form().draft, caption: "Corrected caption" }); h.render(); clickSchedule(h); await settle(); h.render();
  const posted = h.requests.filter(r => r.options.method === "POST").map(r => JSON.parse(r.options.body));
  assert.equal(posted.length, 2); assert.notEqual(posted[1].idempotencyKey, posted[0].idempotencyKey);
  assert.equal(posted[1].caption, "Corrected caption");
});

test("format rejection cannot release a request when status reconciliation fails or the response is ambiguous", async () => {
  for (const scenario of ["read-failed", "malformed-read", "server-error", "unknown-conflict", "timeout", "rate-limit"]) {
    const account = randomUUID();
    const h = harness(new Map(), { allowReview: true, allowConfirm: true, reviewAccountId: account, transport: async (url, init) => {
      if (url !== "/api/schedules") return null;
      if (init.method === "POST") return Response.json({ ok: false, code: scenario === "unknown-conflict" ? "schedule_idempotency_conflict" : "schedule_selection_unavailable", message: "Rejected or unconfirmed" }, { status: scenario === "server-error" ? 503 : scenario === "timeout" ? 408 : scenario === "rate-limit" ? 429 : 409 });
      return Response.json(scenario === "read-failed" ? { ok: false } : scenario === "malformed-read" ? { ok: true } : { ok: true, schedules: [] }, { status: scenario === "read-failed" ? 500 : 200 });
    } });
    h.render(); h.hydrate(); h.form().onChange({ ...draft, connectionId: account, connectionIds: { instagram: account } }); h.render(); clickSchedule(h); await settle(); h.render();
    const first = h.requests.find(r => r.options.method === "POST").options.body;
    assert.ok([...h.storage.values()].some(raw => { try { return JSON.parse(raw).input?.idempotencyKey === JSON.parse(first).idempotencyKey; } catch { return false; } }), scenario);
    h.form().onChange({ ...h.form().draft, caption: "Changed after failure" }); h.render(); clickSchedule(h); await settle(); h.render();
    assert.equal(h.requests.filter(r => r.options.method === "POST")[1].options.body, first, scenario);
  }
});

test("Hook, Wall and Slideshow use the original simple form and schedule directly", async () => {
  for(const format of ["hook","wall_text","slideshow"]) {
    const account=randomUUID(), h=harness(new Map(),{allowReview:true,allowConfirm:true,reviewAccountId:account});
    h.props.format=format; h.props.imageOnly=format === "slideshow"; if(h.props.imageOnly)h.props.output={...output,kind:"library_item"};
    h.render(); h.hydrate(); h.form().onChange({...draft,connectionId:account,connectionIds:{instagram:account},timezone:"Asia/Dubai"}); h.render();
    assert.equal(h.editor(),null); assert.equal(h.externalCalls,0); clickSchedule(h); await settle(); h.render();
    const posts=h.requests.filter(request=>request.options.method === "POST"); assert.equal(posts.length,1); assert.equal(h.editor(),null);
    const actual=JSON.parse(posts[0].options.body); assert.deepEqual(actual.source,{id:output.id,kind:h.props.output.kind});
    assert.equal(actual.caption,draft.caption); assert.equal(actual.scheduledFor,"2099-12-01T14:30:00.000Z");
    assert.ok(nodes(h.render()).some(node=>node.props?.["aria-label"] === "Schedule summary"));
    assert.equal(h.cache.data().schedules.length, 1, "Confirmed posts reach the account cache before navigation");
    assert.equal(h.cache.data().schedules[0].idempotencyKey, actual.idempotencyKey);
    assert.equal(h.cache.queryClient.getQueryState(h.cache.key).isInvalidated, true);
    assert.equal(h.cache.foreign().schedules[0].id, "foreign-post");
  }
});

test("rejected format requests use the corrected time without changing their idempotency key", async () => {
  for(const format of ["hook","wall_text","slideshow"]) {
    const account=randomUUID(), kind=format === "slideshow" ? "library_item" : "media_asset";
    const prior={version:1,owner:"alice",kind:"hook",timeRejected:true,input:{caption:"Original",source:{kind,id:output.id},targets:[{platform:"instagram",connectionId:account}],scheduledFor:"2026-10-13T22:40:00.000Z",timezone:"Asia/Calcutta",idempotencyKey:`explore:${randomUUID()}`}};
    const key=`ugc-explore:schedule:v1:alice:format:${kind}:${output.id}`;
    const h=harness(new Map([[key,JSON.stringify(prior)]]),{allowReview:true,allowConfirm:true,reviewAccountId:account,transport:async(url)=>url === "/api/schedules" ? Response.json({ok:true,schedules:[]}) : null});
    h.props.format=format; h.props.imageOnly=kind === "library_item"; h.props.output={...output,kind};
    h.render(); h.hydrate(); h.form().onChange({...draft,connectionId:account,connectionIds:{instagram:account}}); h.render(); clickSchedule(h); await settle(); h.render();
    const posts=h.requests.filter(request=>request.options.method === "POST"); assert.equal(posts.length,1);
    const actual=JSON.parse(posts[0].options.body); assert.equal(actual.idempotencyKey,prior.input.idempotencyKey); assert.equal(actual.scheduledFor,"2099-12-01T13:00:00.000Z"); assert.equal(h.editor(),null);
  }
});

test("uncertain format requests replay exact input after visible time and caption changes", async () => {
  for (const relative of [false, true]) {
  const account=randomUUID(); let count=0;
  const h=harness(new Map(),{allowReview:true,allowConfirm:true,reviewAccountId:account,transport:async(_url,options)=>{ if(options.method === "POST" && ++count === 1) throw Error("Lost acknowledgement"); }});
  h.render(); h.hydrate(); h.form().onChange({...draft,...(relative ? { date: "2000-01-01", fiveMinutesFromSubmit: true, publishMode: "scheduled" } : {}),connectionId:account,connectionIds:{instagram:account}}); h.render(); clickSchedule(h); await settle(); h.render();
  h.form().onChange({...h.form().draft,caption:"Changed",time:"19:45"}); h.render(); clickSchedule(h); await settle(); h.render();
  const posts=h.requests.filter(request=>request.options.method === "POST"); assert.equal(posts.length,2); assert.equal(posts[1].options.body,posts[0].options.body);
  assert.equal(JSON.parse(posts[0].options.body).useDefaultScheduleTime, relative ? true : undefined);
  }
});

test("Hook, Wall and Slideshow can schedule the same output an hour later with a fresh intent", async () => {
  for (const format of ["hook", "wall_text", "slideshow"]) {
    const account = randomUUID(), h = harness(new Map(), { allowReview: true, allowConfirm: true, reviewAccountId: account });
    h.props.format = format; h.props.imageOnly = format === "slideshow";
    h.props.output = { ...output, kind: h.props.imageOnly ? "library_item" : "media_asset" };
    h.render(); h.hydrate(); h.form().onChange({ ...draft, connectionId: account, connectionIds: { instagram: account } }); h.render();
    clickSchedule(h); await settle(); h.render();
    const key = `ugc-explore:schedule:v1:alice:format:${h.props.output.kind}:${output.id}`;
    const previous = JSON.parse(h.storage.get(key));
    assert.ok(previous.scheduleId);
    const repeat = nodes(h.form().footer).find(node => node.type === "Button" && node.props.size === "lg");
    assert.equal(repeat.props.disabled, false);
    repeat.props.onClick(); repeat.props.onClick(); await settle(); h.render();
    assert.equal(h.requests.filter(r => r.options.method === "POST").length, 1, "Opening another intent never posts");
    assert.equal(h.storage.has(key), false);
    assert.equal(JSON.parse(h.storage.get(`${key}:confirmed:${encodeURIComponent(previous.input.idempotencyKey)}`)).scheduleId, previous.scheduleId);
    h.form().onChange({ ...h.form().draft, time: "19:30" }); h.render();
    clickSchedule(h); await settle(); h.render();
    const posts = h.requests.filter(r => r.options.method === "POST").map(r => JSON.parse(r.options.body));
    assert.equal(posts.length, 2); assert.deepEqual(posts[1].source, posts[0].source);
    assert.notEqual(posts[1].idempotencyKey, posts[0].idempotencyKey);
    assert.equal(Date.parse(posts[1].scheduledFor) - Date.parse(posts[0].scheduledFor), 3600000);
    assert.equal(h.cache.data().schedules.length, 2, "Both posts remain visible in Scheduling");
  }
});

test("a stale confirmed Format screen cannot discard another tab's unconfirmed request", async () => {
  const account = randomUUID(), h = harness(new Map(), { allowReview: true, allowConfirm: true, reviewAccountId: account });
  h.render(); h.hydrate(); h.form().onChange({ ...draft, connectionId: account, connectionIds: { instagram: account } }); h.render();
  clickSchedule(h); await settle(); h.render();
  const key = `ugc-explore:schedule:v1:alice:format:media_asset:${output.id}`;
  const current = JSON.parse(h.storage.get(key));
  const other = { ...current, scheduleId: undefined, input: { ...current.input, idempotencyKey: `explore:${randomUUID()}`, scheduledTime: "20:30", scheduledFor: "2099-12-01T15:00:00.000Z" } };
  h.storage.set(key, JSON.stringify(other));
  clickSchedule(h); await settle(); h.render();
  const posts = h.requests.filter(r => r.options.method === "POST").map(r => JSON.parse(r.options.body));
  assert.deepEqual(posts[1], other.input, "Resume the other tab's exact request instead of replacing it");
});

test("source or draft changes while settings load cannot submit a stale format schedule", async () => {
  for(const field of ["output","caption","time"]) {
    let complete; const account=randomUUID();
    const h=harness(new Map(),{allowReview:true,allowConfirm:true,reviewAccountId:account,transport:async(url)=>url === "/api/schedules?configOnly=1" ? new Promise(resolve=>{complete=resolve;}) : null});
    h.render(); h.hydrate(); h.form().onChange({...draft,connectionId:account,connectionIds:{instagram:account}}); h.render(); clickSchedule(h); await settle();
    if(field === "output")h.props.output={...output,id:randomUUID()}; else h.form().onChange({...h.form().draft,[field]:field === "time" ? "19:45" : "Changed"});
    h.render(); complete(Response.json({ok:true,minimumScheduleLeadMinutes:5})); await settle(); h.render();
    assert.equal(h.requests.some(request=>request.options.method === "POST"),false); assert.equal(h.editor(),null);
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


test("Post now keeps manual time/zone in saved drafts and rejects unknown modes", () => {
  const key = drafts.formatScheduleDraftKey(scope);
  const current = { ...draft, timezone: "Asia/Calcutta", publishMode: "now" };
  const restored = drafts.readFormatScheduleDraft(drafts.serializeFormatScheduleDraft(key,current),key);
  assert.deepEqual(restored,current);
  assert.equal(drafts.readFormatScheduleDraft(drafts.serializeFormatScheduleDraft(key,{...current,publishMode:"automatic-anything"}),key),null);
});

test("Post now in Hook, Wall and Slideshow needs no manual time and submits only on confirmation", async () => {
  for (const format of ["hook","wall_text","slideshow"]) {
    const account=randomUUID(), h=harness(new Map(),{allowReview:true,allowConfirm:true,reviewAccountId:account});
    h.props.format=format; h.props.imageOnly=format === "slideshow";
    if(h.props.imageOnly)h.props.output={...output,kind:"library_item"};
    h.render();h.hydrate(); h.form().onChange({...draft,date:"",time:"",publishMode:"now",connectionId:account,connectionIds:{instagram:account}});h.render();
    assert.equal(h.externalCalls,0); assert.match(String(nodes(h.form().footer).find(node=>node.type==="Button"&&node.props.size==="lg").props.children),/Post now/);
    clickSchedule(h);await settle();h.render();
    const posts=h.requests.filter(request=>request.options.method==="POST");assert.equal(posts.length,1);
    const request=JSON.parse(posts[0].options.body);assert.equal(request.useDefaultScheduleTime,true);
    assert.equal(request.targets[0].connectionId,account);assert.ok(Date.parse(request.scheduledFor)>Date.now());
    assert.equal(h.cache.data().schedules.length,1);
  }
});
