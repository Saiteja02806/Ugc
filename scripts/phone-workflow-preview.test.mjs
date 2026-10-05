import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const page = read("app/explore/creator-phone/page.tsx");
const workspace = read("components/explore/phone-workflow-preview.tsx");
const composer = read("components/explore/phone-workflow-composer.tsx");
const form = read("components/explore/workflow-creation-form.tsx");
const panel = read("components/explore/workflow-creation-panel.tsx");
const media = read("components/explore/use-local-app-screen.ts");
const composition = read("components/explore/workflow-composition-panel.tsx");
const audioReference = read("components/explore/workflow-audio-reference.tsx");
const frontend = workspace + composer + form + panel + media + composition + audioReference;

function loadModule(source, imports, globals = {}) {
  const compiled = ts.transpileModule(source, { fileName: "source.tsx", compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const exported = {};
  vm.runInNewContext(compiled, { exports: exported, require: (name) => {
    if (!(name in imports)) throw new Error(`Unexpected import ${name}`);
    return imports[name];
  }, ...globals });
  return exported;
}
const policy = loadModule(read("lib/explore/phone-workflow.ts"), {});
const rollout = loadModule(read("lib/explore/workflow-generation-rollout.ts"), {});

test("third workflow is visible in the live catalogue with generation controlled by rollout", () => {
  assert.match(page, /getWorkflowGenerationMode/);
  assert.match(page, /if \(mode === "hidden"\) notFound\(\)/);
  assert.match(page, /generationEnabled=\{mode === "generation"\}/);
  const registry = read("lib/explore/workflows.ts");
  const live = registry.slice(registry.indexOf("export const EXPLORE_WORKFLOWS"), registry.indexOf("export const LOCAL_PREVIEW_WORKFLOWS"));
  assert.match(live, /creator-phone/);
  assert.match(registry, /id: "creator-phone"[^\n]*status: "available"/);
});

test("actual route remains visible and non-spending when production generation is not enabled", async () => {
  for (const [environment, query] of [["production", { preview: "1" }], ["development", {}], ["development", { preview: "0" }], ["development", { preview: "1" }]]) {
    const route = loadModule(page, {
      "next/navigation": { notFound() { throw new Error("NOT_FOUND"); } },
      "@/components/explore/phone-workflow-preview": { PhoneWorkflowPreview: "phone-preview" },
      "@/lib/explore/workflow-generation-rollout": rollout,
      "react/jsx-runtime": { jsx: (type) => ({ type }) },
    }, { process: { env: { NODE_ENV: environment } } });
    assert.equal((await route.default({ searchParams: Promise.resolve(query) })).type, "phone-preview");
  }
});

test("preview has no generation, upload, persistence or credit side effects", () => {
  assert.doesNotMatch(frontend, /\bfetch\(|localStorage|sessionStorage|getCurrentUserIdToken|\.trigger\(|useChat|use server/);
  assert.match(panel, /<Button type="button" disabled aria-label=\{kind === "hook" \? "Generate hook" : "Generate phone video"\}/);
  assert.match(panel, /Generation, music, subtitles and scheduling are not connected/);
  assert.match(workspace, /beforeunload/);
});

test("instructions are empty initially and only change through user input", () => {
  assert.match(workspace, /\[instructions, setInstructions\] = useState\(""\)/);
  assert.match(workspace, /onInstructionsChange=\{setInstructions\}/);
  assert.match(form, /onInstructionsChange\(event\.target\.value\)/);
  assert.doesNotMatch(frontend, /setInstructions\(/);
  assert.match(form, /Your instructions stay unchanged/);
  assert.match(form, /Your instructions decide how the creator appears/);
});

test("app screen, optional references, creator audio and appended demo are independent", () => {
  assert.match(workspace, /const appScreen = useLocalAppScreen\(\)/);
  for (const name of ["creator", "videoReference", "creatorAudio", "demo", "demoAudio"]) assert.match(workspace, new RegExp(`const ${name} = useLocalWorkflowMedia`));
  assert.match(composer, /accept="image\/\*,video\/\*"/);
  assert.match(composer, /Screen recordings require Seedance 2.5 through OpenRouter/);
  assert.match(audioReference, /not background music or demo audio/);
  assert.match(audioReference, /an exact copy of the voice or recording is not guaranteed/);
  assert.doesNotMatch(audioReference, />Exact recording<\/Button>/);
  assert.match(composition, /during the demo only/);
  assert.match(composition, /Your demo’s original sound is kept/);
  assert.match(composition, /Uploaded audio is mixed underneath it as background audio during the demo only/);
  assert.match(workspace, /if \(accepted\) \{ demoAudio\.remove\(\); setDemoAudioPlayback\("once"\); \}/);
  assert.match(workspace, /function removeDemo\(\) \{\s*demoAudio\.remove\(\);\s*demo\.remove\(\)/);
});

test("Library stays below the first screen and contains no unapproved media", () => {
  assert.match(workspace, /data-phone-first-screen[^\n]*min-h-\[calc\(100dvh-4rem\)\][^\n]*md:min-h-dvh/);
  assert.ok(workspace.indexOf("<PhoneLibrary />") > workspace.indexOf("<PhoneWorkflowComposer"));
  const library = workspace.slice(workspace.indexOf("function PhoneLibrary()"));
  assert.match(library, /No videos yet/);
  assert.doesNotMatch(library, /<video|<Image|<img|\.mp4|poster=/);
  assert.match(workspace, /library\.focus\(\{ preventScroll: true \}\)/);
  assert.match(workspace, /prefers-reduced-motion: reduce/);
});

test("responsive settings and permanent controls retain mounted composer state", () => {
  assert.match(composer, /<WorkflowCreationForm kind="phone"/);
  assert.match(form, /className=\{creation\.settingsGrid\}/);
  assert.doesNotMatch(form, /ResizeObserver|SettingsStrip/);
  assert.doesNotMatch(workspace, /<PhoneWorkflowComposer[^>]*key=/);
  assert.match(workspace, /<WorkflowCreationPanel kind="phone"/);
  assert.match(workspace, /appScreenControl=\{<AppScreenPicker attachment=\{appScreen\}/);
  assert.doesNotMatch(workspace, /demoOpen|audioOpen|Dialog|Attached demo|Attach audio/);
});

test("app screens keep their full media, detaching video before releasing URLs", () => {
  assert.match(composer, /alt="Attached app screen"[^\n]*h-auto[^\n]*w-auto max-w-full[^\n]*object-contain/);
  assert.match(composer, /current\.current\.pause\(\)/);
  assert.match(composer, /player\.setAttribute\("src", asset\.url\)/);
  assert.match(media, /request !== revision\.current/);
  assert.match(media, /URL\.revokeObjectURL/);
});

test("app-screen validation accepts either source kind and rejects empty, oversized or unrelated files", () => {
  for (const type of ["image/png", "image/jpeg", "image/webp", "video/mp4", "video/webm"]) assert.equal(policy.validateAppScreenFile({ type, size: 200 }).error, null);
  for (const file of [{ type: "audio/wav", size: 200 }, { type: "", size: 200 }, { type: "image/png", size: 0 }, { type: "video/mp4", size: NaN }, { type: "image/png", size: 21 * 1024 ** 2 }, { type: "video/mp4", size: 251 * 1024 ** 2 }]) assert.notEqual(policy.validateAppScreenFile(file).error, null);
});

test("phone demo audio uses the same duration-fitting preference as the hook workflow", () => {
  assert.doesNotMatch(workspace, /isDemoAudioTooLong|invalidDemoAudio/);
  assert.match(workspace, /demoAudioPlayback=\{demoAudioPlayback\}/);
  assert.match(workspace, /useState<ExploreBackgroundPlayback>\("once"\)/);
  assert.match(composition, /planExploreBackgroundAudio\(audioSeconds \* 1000, demoSeconds \* 1000, playback\)/);
});

/** Execute the actual hook with a small deterministic React/DOM harness. */
function createMediaHarness() {
  const slots = [];
  const effects = [];
  const readers = [];
  const released = [];
  let cursor = 0;
  let urlIndex = 0;
  const react = {
    useState(initial) { const index = cursor++; slots[index] ??= { value: initial }; return [slots[index].value, (value) => { slots[index].value = value; }]; },
    useRef(initial) { const index = cursor++; slots[index] ??= { current: initial }; return slots[index]; },
    useEffect(callback, deps) {
      const index = cursor++;
      const previous = slots[index];
      if (!previous || deps.some((value, i) => !Object.is(value, previous.deps[i]))) {
        effects.push(() => { previous?.cleanup?.(); slots[index] = { deps, cleanup: callback() }; });
      }
    },
  };
  class FakeImage {
    naturalWidth = 720;
    naturalHeight = 1280;
    constructor() { readers.push(this); }
    removeAttribute() {}
  }
  class FakeVideo {
    duration = 5;
    constructor() { readers.push(this); }
    removeAttribute() {}
    load() {}
  }
  const hookModule = loadModule(media, { react, "@/lib/explore/phone-workflow": policy }, {
    Image: FakeImage, HTMLVideoElement: FakeVideo,
    document: { createElement: () => new FakeVideo() },
    URL: { createObjectURL: () => `blob:test-${++urlIndex}`, revokeObjectURL: (url) => released.push(url) },
    setTimeout, clearTimeout,
  });
  const runActualHook = hookModule.useLocalAppScreen;
  return {
    render() { cursor = 0; const result = runActualHook(); while (effects.length) effects.shift()(); return result; },
    complete(index) { const reader = readers[index]; (reader.onload ?? reader.onloadedmetadata)(); },
    fail(index) { readers[index].onerror(); },
    unmount() { for (const slot of slots) slot?.cleanup?.(); },
    released,
  };
}
const screenshot = { name: "app.png", type: "image/png", size: 200 };
const recording = { name: "app.mp4", type: "video/mp4", size: 200 };

test("actual app-screen hook preserves the prior image after invalid or corrupt replacements", async () => {
  const harness = createMediaHarness();
  let hook = harness.render();
  const initial = hook.choose(screenshot);
  harness.complete(0);
  assert.equal(await initial, true);
  hook = harness.render();
  const firstUrl = hook.asset.url;
  assert.equal(await hook.choose({ name: "bad.wav", type: "audio/wav", size: 200 }), false);
  hook = harness.render();
  assert.equal(hook.asset.url, firstUrl);
  const corrupt = hook.choose(recording);
  harness.fail(1);
  assert.equal(await corrupt, false);
  hook = harness.render();
  assert.equal(hook.asset.url, firstUrl);
  assert.ok(hook.error);
  assert.deepEqual(harness.released, ["blob:test-2"]);
  harness.unmount();
  assert.deepEqual(harness.released, ["blob:test-2", firstUrl]);
});

test("actual app-screen hook keeps the newest cross-kind choice when metadata finishes out of order", async () => {
  const harness = createMediaHarness();
  let hook = harness.render();
  const slow = hook.choose(screenshot);
  const latest = hook.choose(recording);
  harness.complete(1);
  assert.equal(await latest, true);
  hook = harness.render();
  harness.complete(0);
  assert.equal(await slow, false);
  hook = harness.render();
  assert.equal(hook.asset.name, "app.mp4");
  assert.equal(hook.asset.kind, "video");
  assert.equal(hook.asset.duration, 5);
  assert.equal(hook.loading, false);
  assert.deepEqual(harness.released, ["blob:test-1"]);
  harness.unmount();
});

test("actual app-screen hook removes both pending and current assets without late state restoration", async () => {
  const harness = createMediaHarness();
  let hook = harness.render();
  const pending = hook.choose(recording);
  hook.remove();
  harness.complete(0);
  assert.equal(await pending, false);
  hook = harness.render();
  assert.equal(hook.asset, null);
  assert.equal(hook.loading, false);
  const selected = hook.choose(screenshot);
  harness.complete(1);
  assert.equal(await selected, true);
  hook = harness.render();
  hook.remove();
  hook = harness.render();
  assert.equal(hook.asset, null);
  assert.equal(hook.error, null);
  assert.deepEqual(harness.released, ["blob:test-1", "blob:test-2"]);
  harness.unmount();
});

test("actual app-screen hook ignores metadata completing after unmount", async () => {
  const harness = createMediaHarness();
  const hook = harness.render();
  const pending = hook.choose(recording);
  harness.unmount();
  harness.complete(0);
  assert.equal(await pending, false);
  assert.deepEqual(harness.released, ["blob:test-1"]);
});
