import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import * as sequence from "../lib/explore/sequence-preview.ts";
import { getReferenceAudioPreview } from "../lib/explore/reference-audio-preview.ts";

const settled = () => new Promise(resolve => setImmediate(resolve));
const editing = (start = 1000, end = 4000) => ({ version: 1, format: "hook", trimStartMs: start, trimEndMs: end, originalVolume: .7, musicVolume: .3,
  text: { value: "Opening only", width: .8, y: .18, fontSize: 48, color: "#ffffff", startMs: 0, endMs: end - start } });
const segment = (id, url) => ({ id, label: id, url, width: 1080, height: 1920, durationSeconds: 8, editing: editing() });
const media = (id, url, extra = {}) => ({ id, url, title: id, width: 1080, height: 1920, durationSeconds: 3, metadata: {}, ...extra });
const frame = { version: 1, width: .8, height: .8, points: [[0, 0, 0], [8000, .1, .1]] };
const rebased = { ...frame, points: [[0, .01, .01], [3000, .05, .05]] };
function nodes(node) { return !node || typeof node !== "object" ? [] : [node, ...[node.props?.children].flat(3).flatMap(nodes)]; }
function text(node) { return typeof node === "string" ? node : !node ? "" : [node.props?.children].flat(3).map(text).join(""); }
function harness(props = {}, load = async () => { throw new Error("Unexpected music load"); }) {
  const slots = [], effects = []; let cursor = 0, requests = 0, revoked = 0;
  const react = {
    useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial;
      return [slots[index], value => { slots[index] = typeof value === "function" ? value(slots[index]) : value; }]; },
    useEffect(callback, deps) { const index = cursor++, previous = slots[index];
      if (!previous || deps.some((value, i) => value !== previous.deps[i])) { previous?.cleanup?.(); const record = { deps }; slots[index] = record; effects.push(() => { record.cleanup = callback(); }); } },
  };
  const exports = {};
  const jsx = (type, props) => ({ type, props });
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL("../components/explore/workflow-edit-workspace.tsx", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, Error, fetch() { throw new Error("Unexpected network request"); }, URL: { createObjectURL: () => "blob:default-music", revokeObjectURL: () => revoked++ },
    require(name) {
      if (name === "react") return react;
      if (name === "react/jsx-runtime") return { jsx, jsxs: jsx };
      if (name === "@/lib/explore/sequence-preview") return sequence;
      if (name.endsWith("reference-audio-preview")) return { getReferenceAudioPreview };
      if (name.endsWith("workflow-default-music-client")) return { loadWorkflowDefaultMusic: async input => { requests++; return load(input); } };
      if (name.endsWith("firebase/auth")) return { getCurrentUserIdToken: async () => "fixture-token" };
      if (name.endsWith("workflow-scheduling-draft")) return { workflowSelectedPlatforms: () => [] };
      if (name.endsWith("workflow-scheduling-panel")) return { SCHEDULE_PLATFORMS: [] };
      if (name.endsWith(".module.css")) return { default: {} };
      return new Proxy({}, { get: (_, key) => String(key) });
    },
  });
  let currentProps = { draft: {}, active: true, ...props }, tree;
  const render = () => { cursor = 0; tree = exports.WorkflowScheduleWorkspace(currentProps); while (effects.length) effects.shift()(); return tree; };
  render();
  return { render, set: values => { currentProps = { ...currentProps, ...values }; return render(); }, nodes: () => nodes(render()),
    preview: () => nodes(render()).find(node => node.type === "WorkflowSequencePreview"),
    get requests() { return requests; }, get revoked() { return revoked; },
    cleanup() { for (const slot of slots) slot?.cleanup?.(); }, get tree() { return tree; } };
}

test("Talking Head Schedule previews current raw trims, text, framing and Demo audio without saving", () => {
  const h = harness({ openingPreview: { segment: segment("opening", "blob:opening"), referenceAudio: null },
    demoPreview: { segment: { ...segment("demo", "blob:demo"), editing: { ...editing(500, 2500), text: null } }, referenceAudio: null }, rawDemoFraming: frame,
    demoAudio: { url: "blob:demo-audio", name: "Narration" }, demoAudioPlayback: "repeat", options: { subtitles: true, backgroundMusic: false } });
  const preview = h.preview().props;
  assert.equal(preview.segments.length, 2); assert.equal(preview.playbackDisabledReason, null);
  assert.equal(preview.segments[0].editing.text.value, "Opening only"); assert.equal(preview.segments[1].editing.text, null);
  assert.deepEqual([preview.segments[0].editing.trimStartMs, preview.segments[1].editing.trimEndMs], [1000, 2500]);
  assert.deepEqual(preview.segments[1].framing, frame);
  assert.deepEqual(JSON.parse(JSON.stringify(preview.segments[1].addedAudio)), { url: "blob:demo-audio", volume: .2, playback: "repeat" });
  assert.match(text(h.tree), /Auto subtitles appear in the rendered file/); assert.equal(h.requests, 0);
});
test("prepared clips use their baked edits and rebased crop without applying trim or text twice", () => {
  const h = harness({ source: media("saved-opening", "https://media.test/opening.mp4"), demoSource: media("saved-demo", "https://media.test/demo.mp4"),
    openingPreview: { segment: segment("raw-opening", "blob:raw-opening") }, demoPreview: { segment: segment("raw-demo", "blob:raw-demo") },
    rawDemoFraming: frame, demoFraming: rebased });
  const [opening, demo] = h.preview().props.segments;
  assert.equal(opening.url, "https://media.test/opening.mp4"); assert.equal(opening.editing, undefined);
  assert.equal(demo.url, "https://media.test/demo.mp4"); assert.equal(demo.editing, undefined); assert.deepEqual(demo.framing, rebased);
});
test("opening reference continues across Demo and replaces its paired track while preserving added audio", () => {
  const reference = (id, volume) => ({ referenceId: id, title: id, audioUrl: `https://media.test/${id}.mp3`, cleanVideoUrl: `https://media.test/${id}-clean.mp4`, volume });
  const h = harness({ source: media("saved-opening", "https://media.test/opening.mp4", { metadata: { referenceAudioPreview: reference("opening", .4) } }),
    demoSource: media("saved-demo", "https://media.test/demo.mp4", { metadata: { referenceAudioPreview: reference("demo", .7) } }),
    demoAudio: { url: "blob:demo-voice" }, options: { backgroundMusic: true } });
  const preview = h.preview().props;
  assert.equal(preview.backgroundAudio.url, "https://media.test/opening.mp3"); assert.equal(preview.backgroundAudio.volume, .4);
  assert.equal(preview.segments[1].url, "https://media.test/demo-clean.mp4"); assert.equal(preview.segments[1].referenceAudio, null);
  assert.equal(preview.segments[1].addedAudio.url, "blob:demo-voice"); assert.equal(h.requests, 0);
});
test("a finished file arriving during playback waits for explicit selection and changed edits invalidate that choice", () => {
  const h = harness({ openingPreview: { segment: segment("opening", "blob:opening") } });
  h.preview().props.onPlaybackStart(); h.set({ finishedVideo: media("finished", "https://media.test/final.mp4") });
  assert.ok(h.preview(), "Do not interrupt the sequence to replace its player");
  h.nodes().find(node => node.type === "Button" && text(node) === "View finished video").props.onClick();
  assert.equal(h.preview(), undefined); assert.equal(h.nodes().find(node => node.type === "WorkflowMediaPlayer").props.asset.url, "https://media.test/final.mp4");
  h.set({ finishedVideo: null, openingPreview: { segment: { ...segment("opening", "blob:opening"), editing: editing(2000, 5000) } } });
  assert.ok(h.preview()); assert.equal(h.preview().props.segments[0].editing.trimStartMs, 2000);
});
test("unknown source dimensions load locally; media failure shows a useful reason instead of endless loading", () => {
  const h = harness({ sourcePreview: { url: "blob:opening", duration: 5 }, demo: { url: "blob:demo", duration: 8 } });
  assert.match(h.preview().props.playbackDisabledReason, /Loading video dimensions/);
  h.nodes().find(node => node.type === "video" && node.props.src === "blob:opening").props.onLoadedMetadata({ currentTarget: { videoWidth: 1920, videoHeight: 1080, duration: 5 } });
  h.nodes().find(node => node.type === "video" && node.props.src === "blob:demo").props.onLoadedMetadata({ currentTarget: { videoWidth: 1280, videoHeight: 720, duration: 8 } });
  assert.equal(h.preview().props.playbackDisabledReason, null); assert.equal(h.preview().props.segments[0].width, 1920);
  h.nodes().find(node => node.type === "video" && node.props.src === "blob:demo").props.onError();
  assert.match(h.preview().props.playbackDisabledReason, /could not load/); assert.equal(h.requests, 0);
});
test("selected default music waits for read-only loading and revokes its URL when switched off", async () => {
  let finish; const h = harness({ source: media("opening", "https://media.test/opening.mp4"), ownerId: "owner", enabled: true, options: { backgroundMusic: true } }, () => new Promise(resolve => { finish = resolve; }));
  assert.match(h.preview().props.playbackDisabledReason, /Loading your background music/); assert.equal(h.requests, 1);
  finish({ file: {}, playback: "repeat" }); await settled();
  assert.equal(h.preview().props.backgroundAudio.url, "blob:default-music"); assert.equal(h.preview().props.playbackDisabledReason, null);
  h.set({ options: { backgroundMusic: false } }); assert.equal(h.preview().props.backgroundAudio, null); assert.equal(h.revoked, 1);
});
test("failed selected music is not silently omitted, and a third Demo audio layer requires a saved mix", async () => {
  const h = harness({ source: media("opening", "https://media.test/opening.mp4"), ownerId: "owner", enabled: true, options: { backgroundMusic: true } }, async () => { throw new Error("Default track unavailable"); });
  await settled(); assert.equal(h.preview().props.playbackDisabledReason, "Default track unavailable");
  const extra = harness({ openingPreview: { segment: segment("opening", "blob:opening") },
    demoPreview: { segment: { ...segment("demo", "blob:demo"), addedAudio: { url: "blob:clip-music", volume: .3, playback: "once" } }, referenceAudio: { url: "blob:reference", volume: .2, playback: "repeat" } }, demoAudio: { url: "blob:voice" } });
  assert.match(extra.preview().props.playbackDisabledReason, /Save the demo's clip audio edits/);
});
