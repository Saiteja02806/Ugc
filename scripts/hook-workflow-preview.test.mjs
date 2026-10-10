import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const page = read("app/explore/create-hook/page.tsx");
const workspace = read("components/explore/hook-workflow-preview.tsx");
const composer = read("components/explore/workflow-creation-form.tsx");
const panel = read("components/explore/workflow-creation-panel.tsx");
const controls = read("components/explore/hook-workflow-media-controls.tsx");
const media = read("components/explore/use-local-workflow-media.ts");
const composition = read("components/explore/workflow-composition-panel.tsx");
const audioReference = read("components/explore/workflow-audio-reference.tsx");
const frontend = workspace + composer + panel + controls + media + composition + audioReference;

test("Talking Head + Demo connects in production while explicit layout previews stay non-spending", async () => {
  assert.doesNotMatch(page, /notFound\(\)/);
  assert.match(read("lib/explore/workflows.ts"), /destination: "\/explore\/create-hook"/);
  assert.match(workspace, /HookWorkflowPreview/);
  const compiled = ts.transpileModule(page, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  new Function("require", "exports", compiled)(name => {
    if (name === "react/jsx-runtime") return { jsx: (type, props) => ({ type, props }) };
    assert.equal(name, "@/components/explore/hook-workflow-preview");
    return { HookWorkflowPreview: "HookWorkflowPreview" };
  }, exports);
  const flags = ["EXPLORE_GENERATION_ENABLED", "EXPLORE_DEMO_FRAMING_ENABLED"];
  const previous = flags.map(key => process.env[key]);
  try {
    process.env.EXPLORE_DEMO_FRAMING_ENABLED = "true";
    for (const enabled of ["true", "false"]) {
      process.env.EXPLORE_GENERATION_ENABLED = enabled;
      for (const preview of [undefined, "1"]) {
        const rendered = await exports.default({ searchParams: Promise.resolve({ preview }) });
        assert.equal(rendered.type, "HookWorkflowPreview");
        assert.equal(rendered.props.generationEnabled, enabled === "true" && preview !== "1");
        assert.equal(rendered.props.demoFramingEnabled, true);
      }
    }
  } finally {
    flags.forEach((key, index) => previous[index] === undefined ? delete process.env[key] : process.env[key] = previous[index]);
  }
});

test("layout review cannot generate, render, upload or spend credits", () => {
  assert.doesNotMatch(frontend, /\bfetch\(|localStorage|sessionStorage|getCurrentUserIdToken|\.trigger\(/);
  assert.match(panel, /<Button type="button" disabled aria-label=\{kind === "hook" \? "Generate hook" : "Generate phone video"\}/);
  assert.match(media, /URL\.createObjectURL/);
  assert.match(media, /URL\.revokeObjectURL/);
});

test("user-owned references and audio intent are separate from demo background audio", () => {
  assert.match(composer, /Upload creator/);
  assert.match(composer, /Attach video reference/);
  assert.match(audioReference, /Main voice reference/);
  assert.match(audioReference, /Voice guidance · Up to 30 seconds/);
  assert.match(workspace, /audioReference: hookAudio\.asset/);
  assert.match(workspace, /demoAudio=\{demoAudio\.asset\}/);
  assert.doesNotMatch(audioReference, />Exact recording<\/Button>/);
  assert.match(composition, /Your demo’s original sound is kept/);
  assert.match(composition, /Uploaded audio is mixed underneath it as background audio during the demo only/);
  assert.match(workspace, /demoAudioPlayback=\{demoAudioPlayback\}/);
  assert.match(composition, /Longer audio fades out at the demo’s end/);
});

test("the workflow keeps user instructions authoritative and removes test-hook controls", () => {
  assert.match(composer, /Nothing is prefilled or rewritten/);
  assert.match(composer, /onInstructionsChange\(event\.target\.value\)/);
  assert.match(workspace, /onInstructionsChange=\{setInstructions\}/);
  assert.match(workspace, /useState\(""\)/);
  assert.match(workspace, /Reference library/);
  assert.match(workspace, /WorkflowCompositionPanel/);
  assert.doesNotMatch(workspace, /Try with a hook video|Use this hook|Hook selected|Build your video/);
});

test("the Library follows a full first-screen creation area and has no example media", () => {
  assert.match(workspace, /data-hook-first-screen[^\n]*min-h-\[calc\(100dvh-4rem\)\][^\n]*md:min-h-dvh/);
  assert.ok(workspace.indexOf("<LibrarySection />") > workspace.indexOf("<HookWorkflowComposer"));
  const library = workspace.slice(workspace.indexOf("function LibrarySection()"));
  assert.match(library, /data-hook-library/);
  assert.match(library, /No videos yet/);
  assert.doesNotMatch(library, /<video|<Image|<img|\.mp4|poster=/);
  assert.doesNotMatch(workspace, /RailTabButton|<[^>]+role="tab"/);
});

test("the Library shortcut scrolls and moves focus without changing the workflow", () => {
  assert.match(workspace, /href="#hook-reference-library"/);
  assert.match(workspace, />Library ↓<\/a>/);
  assert.match(workspace, /library\.focus\(\{ preventScroll: true \}\)/);
  assert.match(workspace, /library\.scrollIntoView/);
  assert.match(workspace, /prefers-reduced-motion: reduce/);
  assert.match(workspace, /id="hook-reference-library" tabIndex=\{-1\}/);
});

test("the creation form has visible labels and reflows without remounting settings", () => {
  for (const label of ["Model", "Duration", "Quality", "Videos", "Ratio"]) {
    assert.ok(composer.includes(`<SettingField label="${label}"`));
  }
  assert.match(composer, /className=\{creation\.prompt\}/);
  assert.match(composer, /className=\{creation\.settingsGrid\}/);
  assert.match(composer, /One mounted form at every size/);
  assert.doesNotMatch(composer, /ResizeObserver|SettingsStrip/);
});

test("video/audio controls are permanent and demo changes clear background audio", () => {
  assert.match(workspace, /<WorkflowCreationPanel kind="hook"/);
  assert.ok(workspace.indexOf("<HookWorkflowComposer") < workspace.indexOf('<section aria-label="Hook creation workspace"'));
  assert.doesNotMatch(workspace, /demoOpen|audioOpen|Dialog|Attached demo|Attach audio/);
  assert.doesNotMatch(workspace, /<WorkflowCompositionPanel[^>]*key=/);
  assert.match(workspace, /function removeDemo\(\) \{\s*setDemoFraming\(null\);\s*demoAudio\.remove\(\);\s*demo\.remove\(\)/);
  assert.match(workspace, /if \(accepted\) \{ demoAudio\.remove\(\); setDemoAudioPlayback\("once"\); setDemoFraming\(null\); \}/);
});

test("local media is detached before cleanup and Creator selection adds no prompts", () => {
  assert.match(controls, /current\.current\.pause\(\)/);
  assert.match(controls, /current\.current\.removeAttribute\("src"\)/);
  assert.match(controls, /player\.setAttribute\("src", asset\.url\)/);
  assert.match(media, /asset\?\.url\.startsWith\("blob:"\)/);
  assert.match(media, /function chooseLibraryImage/);
  assert.doesNotMatch(frontend, /setInstructions\((?!\))/);
});

test("reference state is local to the layout preview", () => {
  assert.match(workspace, /const demo = useLocalWorkflowMedia\("video"\)/);
  assert.match(workspace, /const demoAudio = useLocalWorkflowMedia\("audio"\)/);
  assert.match(workspace, /const videoReference = useLocalWorkflowMedia\("video"\)/);
  assert.doesNotMatch(workspace, /\bfetch\(|localStorage|sessionStorage/);
});
