import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import * as formatDemo from "../lib/explore/format-demo.ts";
import * as unchanged from "../lib/explore/unchanged-hook-source.ts";

const media = n => ({ id: `00000000-0000-4000-8000-${String(n).padStart(12,"0")}`, status: "ready", collection: "video", mimeType: "video/mp4", url: `/clip-${n}.mp4`, durationSeconds: 8, metadata: {} });
const opening = media(1), demo = media(2), prepared = media(3), audio = { ...media(4), collection: "audio", mimeType: "audio/mpeg" };
function render(save, outputs = {}) {
  const inputs = [], submissions = [], effects = [], exports = {};
  const jsx = (type, props) => ({ type, props });
  const imports = {
    react: { useRef: value => ({ current: value }), useEffect: fn => effects.push(fn) },
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "react-dom": { createPortal: child => child },
    "@/lib/explore/format-demo": formatDemo,
    "@/lib/explore/unchanged-hook-source": unchanged,
    "@/components/explore/use-workflow-finishing": { DEFAULT_FINISHING_OPTIONS: { subtitles: false, backgroundMusic: false }, useWorkflowFinishing(input) {
      inputs.push(input);
      return { output: outputs[input.scope.split(":")[0]] ?? null, action: { disabled: !input.enabled, busy: false, error: null, message: "Preparing", onAction: () => submissions.push(input.scope), refresh() {} } };
    } },
  };
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL("../components/explore/format-demo-section.tsx", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, require: name => imports[name] ?? new Proxy({}, { get: (_, prop) => String(prop) }) });
  exports.DemoSaveRun({ save, format: "hook", enabled: true, ownerId: "owner", onBusy() {}, onSaved() {}, onContinue() {} });
  for (const run of effects) run();
  return { inputs, submissions };
}
const save = overrides => ({ opening, openingRevision: 0, demo, audio, background: null,
  draft: { ...formatDemo.defaultDemoEdit(8), editing: formatDemo.defaultDemoEdit(8), playback: "repeat", backgroundMusic: false }, ...overrides });

test("a standalone ready opening can be reused instead of starting an unnecessary final render", () => {
  const result = render(save({ demo: null, audio: null }));
  const join = result.inputs.at(-1);
  assert.equal(join.source.id, opening.id);
  assert.equal(join.demoSource, null);
  assert.equal(join.reuseUnchangedSource, true);
});
test("standard-volume demo audio joins the original clips in one job without a sound-stage job", () => {
  const result = render(save());
  assert.equal(result.inputs[1].enabled, false);
  const join = result.inputs.at(-1);
  assert.equal(join.demoSource.id, demo.id);
  assert.equal(join.demoAudioSource.id, audio.id);
  assert.equal(join.playback, "repeat");
  assert.equal(join.reuseUnchangedSource, false);
  assert.deepEqual(result.submissions, [join.scope]);
});

test("an opening without a demo cannot attach a leftover demo audio selection", () => {
  const result = render(save({ demo: null }));
  const join = result.inputs.at(-1);
  assert.equal(join.demoSource, null);
  assert.equal(join.demoAudioSource, null);
  assert.equal(join.reuseUnchangedSource, true);
});
test("trimmed demo prep keeps its edits and feeds the same owned audio directly to the join", () => {
  const request = save(); request.draft.editing = { ...request.draft.editing, trimStartMs: 1000, trimEndMs: 7000 };
  const result = render(request, { "format-demo-prep": prepared });
  assert.equal(result.inputs[0].enabled, true);
  assert.equal(result.inputs[0].editing.trimStartMs, 1000);
  assert.equal(result.inputs[1].enabled, false);
  assert.equal(result.inputs.at(-1).demoSource.id, prepared.id);
  assert.equal(result.inputs.at(-1).demoAudioSource.id, audio.id);
});
test("custom-volume and demo-only requests retain the sound stage instead of dropping gain or audio", () => {
  for (const onlyDemo of [false, true]) {
    const request = save({ ...(onlyDemo ? { opening: null } : {}) });
    request.draft.editing.musicVolume = .6;
    const result = render(request);
    assert.equal(result.inputs[1].enabled, true);
    assert.equal(result.inputs[1].editing.musicVolume, .6);
    assert.equal(result.inputs.at(-1).demoAudioSource, null);
    assert.ok(result.submissions.every(scope => !scope.startsWith("format-demo:")));
  }
});
