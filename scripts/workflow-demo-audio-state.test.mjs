import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import * as schedulingDraft from "../lib/explore/workflow-scheduling-draft.ts";

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const element = (type, props) => typeof type === "function" ? type(props) : ({ type, props });
function nodes(value) {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!value || typeof value !== "object") return [];
  return [value, ...nodes(value.props?.children)];
}

/** Execute each real parent and its attachment callbacks, without requests or DOM media. */
function layout(kind) {
  let cursor = 0, mediaCursor = 0;
  const generationInputs = [];
  const slots = [];
  const attachments = Array.from({ length: 5 }, () => ({
    asset: { name: "selected", url: "blob:fixture", duration: 5 }, loading: false, error: null,
    accepted: true, removed: 0,
    async choose() { return this.accepted; },
    remove() { this.removed++; },
  }));
  const css = { default: new Proxy({}, { get: (_, key) => key }) };
  const imports = {
    react: {
      useState(initial) { const index = cursor++; slots[index] ??= { value: initial }; return [slots[index].value, (value) => { slots[index].value = typeof value === "function" ? value(slots[index].value) : value; }]; },
      useRef(initial) { const index = cursor++; slots[index] ??= { current: initial }; return slots[index]; },
      useEffect() {},
    },
    "@base-ui/react/tabs": { Tabs: { Root: "tabs", Panel: "tabpanel" } },
    "lucide-react": { ArrowLeft: "arrow", BookOpen: "book" },
    "next/link": { default: "link" },
    "@/components/explore/hook-workflow-composer": { HookWorkflowComposer: "composer" },
    "@/components/explore/phone-workflow-composer": { PhoneWorkflowComposer: "composer", AppScreenPicker: "app-screen" },
    "@/components/explore/workflow-composition-panel": { WorkflowCompositionPanel: "composition" },
    "@/components/explore/workflow-creation-panel": { WorkflowCreationPanel: "controls" },
    "@/components/explore/workflow-edit-workspace": { WorkflowEditWorkspace: "editing", WorkflowScheduleWorkspace: "scheduling" },
    "@/components/explore/workflow-scheduling-panel": { EMPTY_SCHEDULE_DRAFT: {}, WorkflowSchedulingPanel: "schedule-settings" },
    "@/components/explore/workflow-connected-accounts": { WorkflowConnectedAccounts: "accounts" },
    "@/lib/explore/workflow-scheduling-draft": schedulingDraft,
    "@/components/explore/workflow-preview-canvas": { WorkflowPreviewCanvas: "canvas" },
    "@/components/explore/use-local-app-screen": { useLocalAppScreen: () => ({ asset: null, loading: false }) },
    "@/components/explore/use-local-workflow-media": { useLocalWorkflowMedia: () => attachments[mediaCursor++] },
    "@/components/explore/use-workflow-generation-settings": { useWorkflowGenerationSettings: (initialDuration, initialModel) => {
      generationInputs.push({ initialDuration, initialModel });
      return { settings: {}, dirty: false, changeSettings() {} };
    } },
    "@/components/explore/workflow-generation-boundary": { WorkflowAccountBoundary: ({ children }) => children("owner"), WorkflowGenerationBoundary: ({ children }) => children(null) },
    "@/components/explore/workflow-finishing-boundary": { WorkflowFinishingBoundary: ({ children }) => children({ edit: undefined, schedule: undefined, output: null, options: { subtitles: false, style: "clean" }, setOptions() {} }) },
    "@/components/explore/workflow-studio.module.css": css,
    "@/components/explore/workflow-creation.module.css": css,
    "@/lib/utils": { cn: (...values) => values.join(" ") },
    "react/jsx-runtime": { jsx: element, jsxs: element, Fragment: "fragment" },
  };
  const exported = {};
  const compiled = ts.transpileModule(read(`components/explore/${kind}-workflow-preview.tsx`), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(compiled, { exports: exported, require(name) { assert.ok(name in imports, `Unexpected import ${name}`); return imports[name]; } });
  const component = exported[kind === "hook" ? "HookWorkflowPreview" : "PhoneWorkflowPreview"];
  return {
    render(props = {}) {
      cursor = 0; mediaCursor = 0;
      const tree = component({ generationEnabled: false, ...props });
      return {
        tree,
        composition: nodes(tree).find((node) => node.type === "composition").props,
        tabs: nodes(tree).find((node) => node.type === "tabs").props,
      };
    },
    demo: attachments[3], audio: attachments[4], generationInputs,
  };
}

test("Hook quick-start model and duration reach the settings owner through the actual layout", () => {
  const actual = layout("hook");
  actual.render({ initialModel: "kling_3_0", initialDuration: 10 });
  assert.deepEqual(actual.generationInputs, [{ initialModel: "kling_3_0", initialDuration: 10 }]);
  assert.equal(actual.demo.removed, 0);
  assert.equal(actual.audio.removed, 0);
});

for (const kind of ["hook", "phone"]) {
  test(`${kind}: audio replacement resets repeat only after successful selection`, async () => {
    const actual = layout(kind);
    let { composition } = actual.render();
    assert.equal(composition.demoAudioPlayback, "once");
    composition.onDemoAudioPlaybackChange("repeat");
    composition = actual.render().composition;
    assert.equal(composition.demoAudioPlayback, "repeat");
    actual.audio.accepted = false;
    assert.equal(await composition.demoAudio.choose({}), false);
    assert.equal(actual.render().composition.demoAudioPlayback, "repeat", "A failed replacement keeps the prior selection and preference");
    actual.audio.accepted = true;
    assert.equal(await actual.render().composition.demoAudio.choose({}), true);
    assert.equal(actual.render().composition.demoAudioPlayback, "once", "A new recording cannot inherit repeat");
    assert.equal(actual.demo.removed, 0);
  });

  test(`${kind}: audio removal and accepted demo changes clear repeat; failed demo changes preserve it`, async () => {
    const actual = layout(kind);
    actual.render().composition.onDemoAudioPlaybackChange("repeat");
    actual.render().composition.demoAudio.remove();
    assert.equal(actual.render().composition.demoAudioPlayback, "once");
    assert.equal(actual.audio.removed, 1);
    assert.equal(actual.demo.removed, 0);
    actual.render().composition.onDemoAudioPlaybackChange("repeat");
    actual.demo.accepted = false;
    assert.equal(await actual.render().composition.demo.choose({}), false);
    assert.equal(actual.render().composition.demoAudioPlayback, "repeat");
    assert.equal(actual.audio.removed, 1);
    actual.demo.accepted = true;
    assert.equal(await actual.render().composition.demo.choose({}), true);
    assert.equal(actual.render().composition.demoAudioPlayback, "once");
    assert.equal(actual.audio.removed, 2);
    actual.render().composition.onDemoAudioPlaybackChange("repeat");
    actual.render().composition.demo.remove();
    assert.equal(actual.render().composition.demoAudioPlayback, "once");
    assert.equal(actual.audio.removed, 3);
    assert.equal(actual.demo.removed, 1);
  });

  test(`${kind}: changing sections retains the audio timing preference and does not clear sources`, () => {
    const actual = layout(kind);
    actual.render().composition.onDemoAudioPlaybackChange("repeat");
    for (const section of ["edit", "schedule", "create", "edit"]) {
      actual.render().tabs.onValueChange(section);
      const current = actual.render();
      assert.equal(current.tabs.value, section);
      assert.equal(current.composition.demoAudioPlayback, "repeat");
    }
    assert.equal(actual.audio.removed, 0);
    assert.equal(actual.demo.removed, 0);
  });
}
