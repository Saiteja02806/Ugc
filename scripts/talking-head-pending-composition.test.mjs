/* eslint-disable @next/next/no-assign-module-variable -- Replaces the test module loader inside an isolated fixture. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { parseExploreFinishDraft } from "../worker/src/lib/explore-finishing-contract.ts";
import { trimmedDemoFraming } from "../lib/explore/format-demo.ts";

function harness() {
  let cursor = 0, waitUpload = null; const slots = [], effects = [], uploads = [], musicReads = [];
  const source = { id: randomUUID(), title: "My talking head", status: "ready", collection: "video" };
  const props = { owner: "owner", kind: "hook", source, demo: { url: "blob:demo", file: { name: "demo.mp4" } }, demoSource: null,
    demoAudio: { url: "blob:audio", file: { name: "demo.mp3" } }, playback: "repeat", options: { subtitles: false, style: "clean", backgroundMusic: false }, captionDraft: null, captionsReady: false };
  const module = {}, react = { useRef(value) { const i = cursor++; return slots[i] ??= { current: value }; }, useLayoutEffect(fn) { effects.push(fn); } };
  const code = ts.transpileModule(readFileSync(new URL("../components/explore/talking-head-pending-composition.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const imports = { react, "@/worker/src/lib/explore-finishing-contract": { parseExploreFinishDraft }, "@/lib/explore/format-demo": { trimmedDemoFraming },
    "@/lib/explore/reference-audio-preview": { getReferenceAudioPreview: () => null },
    "@/lib/firebase/auth": { getCurrentUserIdToken: async () => "token" },
    "@/lib/explore/workflow-default-music-client": { loadWorkflowDefaultMusic: async () => { musicReads.push(true); return { file: { name: "default.mp3" }, playback: "repeat" }; } },
    "@/lib/ai-studio/reference-media-upload": { uploadAIStudioReferenceMedia: async (file, collection, limit, owner, options) => {
      assert.equal(owner, "owner"); assert.equal(limit, 120); assert.equal(options.purpose, "explore-demo");
      uploads.push({ file, collection }); if (waitUpload) await waitUpload; return { asset: { id: randomUUID() } };
    } } };
  vm.runInNewContext(code, { exports: module, Error, fetch() {}, require(name) { assert.ok(name in imports, name); return imports[name]; } });
  return { props, uploads, musicReads, wait(promise) { waitUpload = promise; }, render() { cursor = 0; const value = module.useTalkingHeadPendingComposition(props); while (effects.length) effects.shift()(); return value; } };
}

test("review performs no upload/render; explicit resolution snapshots two raw clips and the exact soundtrack", async () => {
  const h = harness(); h.props.options.backgroundMusic = true;
  const view = h.render(); assert.equal(view.error, null); assert.equal(h.uploads.length, 0); assert.equal(h.musicReads.length, 0);
  const result = await view.resolve(); assert.ok(result.demoAssetId); assert.ok(result.demoAudioAssetId); assert.ok(result.backgroundAssetId);
  assert.equal(result.demoAudioPlayback, "repeat"); assert.equal(result.backgroundPlayback, "repeat");
  assert.equal(h.uploads.length, 3); await view.resolve(); assert.equal(h.uploads.length, 3, "Retry reuses acknowledged owned uploads");
});

test("owned edited demo and reviewed captions preserve trim-relative framing, sound and word corrections", async () => {
  const h = harness(); h.props.demoSource = { id: randomUUID() }; h.props.demo = null; h.props.demoAudio = null;
  const edit = { version: 1, format: "hook", trimStartMs: 1000, trimEndMs: 4000, originalVolume: .6, musicVolume: .25, text: null };
  h.props.composition = { version: 1, sourceEditing: edit, demoEditing: edit, sourceAudioAssetId: randomUUID(), sourceAudioPlayback: "repeat" };
  h.props.demoAudioAssetId = randomUUID();
  h.props.framing = { version: 1, width: .5, height: 1, points: [[0, .3, 0], [5000, .4, 0]] };
  h.props.options = { subtitles: true, style: "active-word", placement: "top", backgroundMusic: true, corrections: [{ index: 0, text: "Exactly" }] };
  h.props.captionsReady = true; h.props.captionDraft = { backgroundAssetId: randomUUID(), backgroundPlayback: "repeat" };
  const result = await h.render().resolve(); assert.deepEqual(result.composition, h.props.composition);
  assert.equal(result.demoAudioAssetId, h.props.demoAudioAssetId); assert.equal(result.subtitles.placement, "top");
  assert.equal(result.subtitles.corrections[0].text, "Exactly"); assert.equal(result.backgroundAssetId, h.props.captionDraft.backgroundAssetId);
  assert.equal(result.demoFraming.points[0][0], 0); assert.equal(result.demoFraming.points.at(-1)[0], 3000);
  assert.equal(h.uploads.length, 0); assert.equal(h.musicReads.length, 0);
});

test("missing caption review and conflicting soundtracks cannot reach confirmation", async () => {
  const h = harness(); h.props.options.subtitles = true;
  assert.match(h.render().error, /review captions/); await assert.rejects(h.render().resolve(), /review captions/);
  h.props.options.subtitles = false; h.props.demoAudioAssetId = randomUUID();
  assert.match(h.render().error, /one demo audio/); assert.equal(h.uploads.length, 0);
});

test("a changed selection while upload is running cannot schedule the stale composition", async () => {
  const h = harness(); let release; h.wait(new Promise(resolve => { release = resolve; }));
  const saving = h.render().resolve(); h.props.source = { ...h.props.source, id: randomUUID() }; h.render(); release();
  await assert.rejects(saving, /clips changed/);
});
