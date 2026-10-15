import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { workflowSessionAssetError } from "../lib/explore/workflow-session.ts";
import { withReadDeadline } from "../lib/http/read-deadline.ts";

const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const audio = n => ({ id: id(n), title: `Music ${n}`, url: `https://media.test/${n}.mp3`, status: "ready", collection: "audio", mimeType: "audio/mpeg", durationSeconds: 30 });
function harness() {
  const slots = [], cache = new Map(), reads = [], uploads = [], effects = []; let cursor = 0, fail = false, wait = null;
  let options = { backgroundMusic: false, subtitles: false, style: "clean" }, lastQuery;
  const react = { useRef: value => slots[cursor++] ??= { current: value }, useState(value) { const i = cursor++; if (!(i in slots)) slots[i] = value; return [slots[i], next => { slots[i] = typeof next === "function" ? next(slots[i]) : next; }]; }, useEffect(fn) { cursor++; effects.push(fn); } };
  const imports = { react, "@tanstack/react-query": { useQueryClient: () => ({ setQueryData: (key, value) => cache.set(JSON.stringify(key), value) }),
    useQuery: input => { lastQuery = input; const data = cache.get(JSON.stringify(input.queryKey)); return { data, isPending: !data, isError: false, refetch() {} }; } },
    "@/lib/ai-studio/media-client": { fetchAIStudioMediaAsset: async assetId => { reads.push(assetId); return audio(Number(assetId.slice(-1))); } },
    "@/lib/firebase/auth": { getCurrentUserIdToken: async () => "owner-token" }, "@/lib/http/read-deadline": { withReadDeadline },
    "@/lib/explore/workflow-session": { workflowSessionAssetError },
    "@/lib/ai-studio/reference-media-upload": { uploadAIStudioReferenceMedia: async file => { uploads.push(file); if (wait) await wait; if (fail) throw Error("Upload failed"); return { asset: audio(Number(file.name)) }; } },
    "./use-local-workflow-media": { useLocalWorkflowMedia: () => ({ loading: false, error: null, clearError() {}, cancelPending() {}, chooseRemote: async (load, _config, accept) => accept(await load()) }) } };
  const exported = {};
  vm.runInNewContext(ts.transpileModule(readFileSync("components/explore/use-workflow-background-music.ts", "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText,
    { exports: exported, Error, require: key => { assert.ok(key in imports, key); return imports[key]; } });
  return { get options() { return options; }, uploads, reads, fail() { fail = true; }, wait(promise) { wait = promise; },
    restore(value) { options = value; }, async load() { cache.set(JSON.stringify(lastQuery.queryKey), await lastQuery.queryFn({})); },
    render() { cursor = 0; const value = exported.useWorkflowBackgroundMusic({ ownerId: "owner", enabled: true, options, setOptions: change => { options = change(options); } }); while (effects.length) effects.shift()(); return value; } };
}

test("upload and library choices select one owned whole-video track without touching demo audio", async () => {
  const h = harness(); h.restore({ ...h.options, demoSentinel: "unchanged", corrections: [{ index: 0, text: "old" }] });
  assert.equal(await h.render().choose({ name: "1" }, "once"), true);
  assert.equal(h.options.backgroundAssetId, id(1)); assert.equal(h.options.backgroundMusic, false, "Selecting music does not enable it implicitly");
  assert.equal(h.options.demoSentinel, "unchanged"); assert.equal(h.options.corrections.length, 0);
  assert.equal(h.render().source.id, id(1)); assert.equal(h.render().playback, "once");
  const view = h.render(); assert.equal(await view.attachment.chooseRemote(async () => ({ name: "2" }), {}, file => view.choose(file, "repeat")), true);
  assert.equal(h.render().source.id, id(2)); assert.equal(h.options.backgroundPlayback, "repeat");
  h.restore({ ...h.options, backgroundMusic: true }); await h.render().choose({ name: "3" });
  assert.equal(h.options.backgroundMusic, true, "Replacing a track retains the user's explicit On setting");
});

test("failed replacement keeps accepted music; removing during upload rejects the late candidate", async () => {
  const h = harness(); await h.render().choose({ name: "1" }); h.fail();
  assert.equal(await h.render().choose({ name: "2" }), false); assert.equal(h.render().source.id, id(1));
  const later = harness(); let release; later.wait(new Promise(resolve => { release = resolve; }));
  later.restore({ ...later.options, backgroundMusic: true });
  const pending = later.render().choose({ name: "2" }); assert.match(later.render().selectionError, /Wait/);
  later.render().attachment.remove(); release(); assert.equal(await pending, false);
  assert.equal(later.options.backgroundAssetId, null); assert.equal(later.options.backgroundMusic, false);
});

test("reload restores the exact owned track read-only and removal clears only the music choice", async () => {
  const h = harness(); h.restore({ ...h.options, backgroundMusic: true, backgroundAssetId: id(2), backgroundPlayback: "once" });
  assert.equal(h.render().source, null); assert.match(h.render().selectionError, /Wait/); await h.load();
  assert.equal(h.render().source.id, id(2)); assert.deepEqual(h.reads, [id(2)]); assert.equal(h.uploads.length, 0);
  h.render().attachment.remove(); assert.equal(h.render().source, null); assert.equal(h.options.backgroundMusic, false);
});

test("a disabled optional track does not block preparing a video while its music is restoring", () => {
  const h = harness(); h.restore({ ...h.options, backgroundMusic: false, backgroundAssetId: id(2) });
  assert.equal(h.render().source, null); assert.equal(h.render().selectionError, null);
  assert.equal(h.uploads.length, 0);
});
