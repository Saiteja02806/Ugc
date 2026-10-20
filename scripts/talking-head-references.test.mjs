import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { talkingHeadReferenceSettings } from "../lib/explore/talking-head-reference.ts";
import { getVideoReferencePolicy } from "../lib/ai-studio/video-reference-policy.ts";
import * as sessions from "../lib/explore/workflow-session.ts";

const catalogue = JSON.parse(readFileSync("lib/explore/talking-head-reference-catalog.json", "utf8"));
function load(file, imports, globals = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(file, "utf8"), { fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText,
    { exports, require: key => { assert.ok(key in imports, key); return imports[key]; }, AbortController, Error, ...globals });
  return exports;
}
function harness({ saved = {}, loadFile = async reference => ({ name: reference.id, type: "video/mp4" }), items = catalogue.items } = {}) {
  let cursor = 0, session = { ...sessions.createWorkflowSession("owner"), ...saved }, mediaRevision = 0;
  const slots = [], effects = [], settings = [], writes = [], downloads = [], limits = [];
  const react = {
    useState(value) { const i = cursor++; if (!(i in slots)) slots[i] = typeof value === "function" ? value() : value; return [slots[i], next => { slots[i] = typeof next === "function" ? next(slots[i]) : next; }]; },
    useRef(value) { const i = cursor++; return slots[i] ??= { current: value }; }, useCallback: fn => fn,
    useEffect(fn, deps) { const i = cursor++, previous = slots[i]; if (!previous || !deps || deps.some((value, n) => !Object.is(value, previous.deps?.[n]))) effects.push(() => { previous?.cleanup?.(); slots[i] = { deps, cleanup: fn() }; }); },
  };
  const media = { asset: null, loading: false, error: null,
    async chooseRemote(loader, options) { limits.push(options); const revision = ++mediaRevision; media.loading = true; try { const file = await loader(); if (revision !== mediaRevision) return false; media.asset = { name: file.name, file, url: "blob:"+file.name, duration: 3.3 }; return true; } catch { media.error = "Download failed"; return false; } finally { if (revision === mediaRevision) media.loading = false; } },
    async choose(file) { mediaRevision++; media.asset = { name: file.name, url: "blob:"+file.name, file }; return true; },
    remove() { mediaRevision++; media.asset = null; media.error = null; },
  };
  const query = { data: items, isPending: false, isError: false, refetch() {} };
  const mod = load("components/explore/use-talking-head-reference.ts", { react,
    "@tanstack/react-query": { useQuery: () => query }, "./use-local-workflow-media": { useLocalWorkflowMedia: () => media },
    "@/lib/explore/talking-head-reference": { talkingHeadReferenceSettings },
    "@/lib/ai-studio/video-reference-policy": { getVideoReferencePolicy },
    "@/lib/explore/talking-head-reference-client": { fetchTalkingHeadReferences() {}, loadTalkingHeadReferenceFile: async reference => { downloads.push(reference.id); return loadFile(reference); } },
  });
  const render = () => { cursor = 0; const result = mod.useTalkingHeadReference({ ownerId: "owner", enabled: true, session, settings: { ...session.generationSettings, model: "seedance_2_5" }, onSettingsChange: next => settings.push(next), updateSession: next => { session = next(session); writes.push(session); } }); while (effects.length) effects.shift()(); return result; };
  return { render, media, query, settings, writes, downloads, limits, session: () => session };
}
const tick = () => new Promise(setImmediate);

test("catalogue preserves all nine nonignored clips and their source links, including long previews", () => {
  assert.equal(catalogue.items.length, 9);
  assert.equal(catalogue.items.filter(item => item.durationSeconds > 30).length, 2);
  assert.equal(new Set(catalogue.items.map(item => item.id)).size, catalogue.items.length);
  for (const item of catalogue.items) {
    assert.match(item.id, /^talking-[a-z0-9-]+$/);
    assert.ok(item.durationSeconds > 0 && item.durationSeconds < 60);
    assert.match(item.sourceUrl, /^https:\/\/www\.tiktok\.com\/@[^/]+\/video\/\d+$/);
    assert.ok(existsSync("public"+item.videoUrl)); assert.ok(existsSync("public"+item.posterUrl));
    assert.match(item.generationPrompt, /user's own spoken message/);
    assert.doesNotMatch(JSON.stringify(item), /fullvideo_ignore|[A-Z]:\\/);
  }
});

test("reference model selection respects actual whole-clip limits without trimming", () => {
  assert.deepEqual(talkingHeadReferenceSettings("wan_3_0", 27.867, ["wan_3_0", "seedance_2_5"]), { model: "seedance_2_5", duration: 28 });
  assert.equal(talkingHeadReferenceSettings("wan_3_0", 14.14).model, "wan_3_0");
  for (const duration of [35.267, 46.416]) assert.throws(() => talkingHeadReferenceSettings("seedance_2_5", duration), /Preview only.*30 seconds/);
  assert.throws(() => talkingHeadReferenceSettings("wan_3_0", 27.867, ["wan_3_0"]), /unavailable/);
});

test("long previews cannot replace a usable attachment or be submitted as a shortened reference", async () => {
  const h = harness(); await h.render().choose(catalogue.items[0].id);
  assert.equal(await h.render().choose("talking-warm-story"), false);
  assert.equal(h.render().selectedId, catalogue.items[0].id);
  assert.match(h.render().videoReference.error, /Preview only/);
  assert.deepEqual(h.downloads, [catalogue.items[0].id]);
  assert.equal(await h.render().choose("talking-mug-story"), true);
  assert.equal(h.limits.at(-1).maxDuration, 30);
});

test("reference duration rounds to nearest supported second, retaining model bounds", () => {
  assert.equal(talkingHeadReferenceSettings("wan_3_0", 3.3).duration, 3);
  assert.equal(talkingHeadReferenceSettings("wan_3_0", 3.7).duration, 4);
  assert.equal(talkingHeadReferenceSettings("seedance_2_5", 3.3).duration, 4, "Seedance's minimum is four seconds; never send an unsupported duration");
  assert.ok(talkingHeadReferenceSettings("seedance_2_5", 1.567).duration >= 2);
});

test("choosing an example attaches one video and editable reference directions without changing user instructions or demo", async () => {
  const h = harness({ saved: { instructions: "Keep my product message", demoAssetId: "00000000-0000-4000-8000-000000000001" } });
  assert.equal(await h.render().choose(catalogue.items[0].id), true);
  assert.equal(h.render().selectedId, catalogue.items[0].id);
  assert.equal(h.render().instructions, catalogue.items[0].generationPrompt);
  assert.ok(h.render().videoReference.asset.file);
  assert.equal(h.session().instructions, "Keep my product message");
  assert.equal(h.session().demoAssetId, "00000000-0000-4000-8000-000000000001");
  h.render().changeInstructions("My reference direction");
  assert.equal(h.session().referenceInstructions, "My reference direction");
  h.render().videoReference.remove();
  assert.equal(h.render().selectedId, null); assert.equal(h.render().instructions, "");
  assert.equal(h.session().instructions, "Keep my product message");
});

test("reload reacquires the exact saved reference and retains edited directions without resetting model settings", async () => {
  const h = harness({ saved: { talkingReferenceId: catalogue.items[0].id, referenceInstructions: "Keep edited directions" } });
  h.render(); await tick();
  assert.equal(h.render().videoReference.loading, false);
  assert.deepEqual(h.downloads, [catalogue.items[0].id]);
  assert.equal(h.render().instructions, "Keep edited directions"); assert.equal(h.settings.length, 0);
});

test("editing reference directions while recovery downloads cannot be overwritten by its stale state", async () => {
  let finish;
  const h = harness({ saved: { talkingReferenceId: catalogue.items[0].id, referenceInstructions: "Earlier directions" }, loadFile: () => new Promise(resolve => { finish = resolve; }) });
  h.render(); h.render().changeInstructions("New directions while loading");
  finish({ name: catalogue.items[0].id }); await tick();
  assert.equal(h.render().instructions, "New directions while loading");
  assert.equal(h.session().referenceInstructions, "New directions while loading");
});

test("failed reference replacement preserves the previous attachment/directions and blocks stale generation", async () => {
  let fail = false;
  const h = harness({ loadFile: async reference => { if (fail) throw Error("Offline"); return { name: reference.id }; } });
  await h.render().choose(catalogue.items[0].id);
  const previous = h.render().videoReference.asset;
  fail = true; assert.equal(await h.render().choose(catalogue.items[2].id), false);
  assert.equal(h.render().videoReference.asset, previous);
  assert.equal(h.render().selectedId, catalogue.items[0].id);
  assert.ok(h.render().videoReference.error);
});

test("late downloads cannot replace a newer choice and cancelled choices cannot restore a reference", async () => {
  let finish;
  const h = harness({ loadFile: reference => reference.id === catalogue.items[0].id ? new Promise(resolve => { finish = resolve; }) : Promise.resolve({ name: reference.id }) });
  const first = h.render().choose(catalogue.items[0].id);
  await h.render().choose(catalogue.items[2].id);
  finish({ name: catalogue.items[0].id }); await first;
  assert.equal(h.render().selectedId, catalogue.items[2].id);
  assert.equal(h.render().videoReference.asset.name, catalogue.items[2].id);
  const pending = h.render().choose(catalogue.items[0].id);
  h.render().videoReference.remove(); finish({ name: catalogue.items[0].id }); await pending;
  assert.equal(h.render().selectedId, null); assert.equal(h.render().videoReference.asset, null);
});

test("catalogue ID and edited directions persist in verified sessions; malformed values fail recovery", () => {
  const session = { ...sessions.createWorkflowSession("owner"), talkingReferenceId: catalogue.items[0].id, referenceInstructions: "My directions" };
  assert.equal(sessions.readWorkflowSession(sessions.serializeWorkflowSession(session), "owner").referenceInstructions, "My directions");
  for (const patch of [{ talkingReferenceId: "https://untrusted.test/video" }, { referenceInstructions: "x".repeat(8001) }]) assert.throws(() => sessions.serializeWorkflowSession({ ...session, ...patch }));
});

test("catalogue access requires authentication before reading items", async () => {
  let allowed = false, reads = 0;
  class AuthError extends Error { status = 401; }
  const route = load("app/api/explore/talking-head-references/route.ts", {
    "@/lib/explore/talking-head-reference-catalog": { getTalkingHeadReferences() { reads++; return catalogue.items; } },
    "@/lib/firebase/server-auth": { FirebaseAuthRequestError: AuthError, requireFirebaseUser: async () => { if (!allowed) throw new AuthError(); } },
  }, { Response });
  assert.equal((await route.GET(new Request("https://app.test/api"))).status, 401); assert.equal(reads, 0);
  allowed = true;
  const response = await route.GET(new Request("https://app.test/api"));
  assert.equal(response.status, 200); assert.equal((await response.json()).items.length, catalogue.items.length);
});
