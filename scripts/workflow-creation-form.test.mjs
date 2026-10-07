import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const source = read("components/explore/workflow-creation-form.tsx");
const element = (type, props = {}) => typeof type === "function" ? type(props) : ({ type, props });
function nodes(node) {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!node || typeof node !== "object") return [];
  return [node, ...nodes(node.props?.children)];
}
function generationModules(seedanceEnabled = false) {
  const load = (file, imports = {}) => {
    const exported = {};
    vm.runInNewContext(ts.transpileModule(read(file), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText, {
      exports: exported,
      process: { env: { NEXT_PUBLIC_ENABLE_OPENROUTER_SEEDANCE: String(seedanceEnabled) } },
      require: (name) => { assert.ok(name in imports, `Unexpected import ${name}`); return imports[name]; },
    });
    return exported;
  };
  const backend = load("lib/ai-studio/generation-settings.ts");
  const workflow = load("lib/explore/workflow-generation-settings.ts", { "../ai-studio/generation-settings": backend });
  return { backend, workflow };
}

function harness({ seedanceEnabled = false } = {}) {
  let cursor = 0;
  const slots = [];
  const { backend, workflow } = generationModules(seedanceEnabled);
  let generationSettings = workflow.createWorkflowGenerationSettings();
  const imports = {
    react: {
      useId() { return `field-${cursor++}`; },
      useState(initial) { const i = cursor++; slots[i] ??= initial; return [slots[i], (value) => { slots[i] = value; }]; },
      useRef(initial) { const i = cursor++; slots[i] ??= { current: initial }; return slots[i]; },
      useCallback(callback) { cursor++; return callback; },
    },
    "next/image": { default: "image" },
    "lucide-react": Object.fromEntries(["Check", "UserRound", "Video"].map((name) => [name, name])),
    "@/components/explore/hook-workflow-media-controls": { WorkflowFilePicker: "picker", WorkflowMediaPlayer: "player" },
    "@/components/explore/workflow-audio-reference": { WorkflowAudioReference: "audio-reference" },
    "@/components/generation/ai-studio-composer": { AiStudioSettingSelect: "select" },
    "@/components/explore/workflow-duration-control": { WorkflowDurationControl: "duration-control" },
    "@/components/ui/button": { Button: "button" },
    "@/components/ui/popover": Object.fromEntries(["Popover", "PopoverContent", "PopoverTitle", "PopoverTrigger"].map((name) => [name, name])),
    "@/lib/ai-studio/creator-references": { CREATOR_REFERENCES: [{ id: "c1", src: "/creator.png", fileName: "creator.png" }] },
    "@/lib/ai-studio/generation-settings": backend,
    "@/lib/explore/workflow-generation-settings": workflow,
    "@/lib/utils": { cn: (...values) => values.join(" ") },
    "@/components/explore/workflow-studio.module.css": { default: {} },
    "@/components/explore/workflow-creation.module.css": { default: new Proxy({}, { get: (_, key) => key }) },
    "react/jsx-runtime": { jsx: element, jsxs: element, Fragment: "fragment" },
  };
  const exported = {};
  vm.runInNewContext(ts.transpileModule(source, { fileName: "form.tsx", compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, {
    exports: exported, require: (name) => { assert.ok(name in imports, `Unexpected import ${name}`); return imports[name]; },
  });
  const attachment = { asset: null, error: null, loading: false, choose() {}, remove() {}, chooseLibraryImage() {} };
  return { render(overrides = {}) { cursor = 0; return exported.WorkflowCreationForm({ kind: "hook", instructions: "", onInstructionsChange() {}, creator: attachment, videoReference: attachment, audio: attachment, audioLabel: "Hook audio", audioMode: "voice", onAudioModeChange() {}, generationSettings, onGenerationSettingsChange(patch) { generationSettings = workflow.normalizeWorkflowGenerationSettings({ ...generationSettings, ...patch }); }, ...overrides }); } };
}

test("the actual shared form has labelled fields and forwards user text verbatim", () => {
  const changes = [];
  const tree = harness().render({ onInstructionsChange: (value) => changes.push(value) });
  const input = nodes(tree).find((node) => node.type === "textarea");
  const label = nodes(tree).find((node) => node.type === "label");
  assert.equal(label.props.htmlFor, input.props.id);
  assert.equal(input.props.value, "");
  const exact = "  Keep my spacing.\nDo not rewrite @creator.  ";
  input.props.onChange({ target: { value: exact } });
  assert.deepEqual(changes, [exact]);
  assert.deepEqual(nodes(tree).filter((node) => ["select", "duration-control"].includes(node.type)).map((node) => node.props.ariaLabel), [
    "Hook model", "Hook duration", "Hook quality", "Number of hook videos", "Hook aspect ratio",
  ]);
});

test("settings retain their selections when the form rerenders with attachments or instructions", () => {
  const actual = harness();
  const first = actual.render();
  nodes(first).find((node) => node.type === "select" && node.props.ariaLabel === "Hook model").props.onChange("google_omni");
  nodes(actual.render()).find((node) => node.type === "select" && node.props.ariaLabel === "Hook quality").props.onChange("1080p");
  nodes(first).find((node) => node.type === "select" && node.props.ariaLabel === "Number of hook videos").props.onChange("4");
  const next = actual.render({ instructions: "Still mine.", videoReference: { asset: { name: "my.mp4", url: "blob:my" } } });
  assert.equal(nodes(next).find((node) => node.type === "select" && node.props.ariaLabel === "Hook quality").props.value, "1080p");
  assert.equal(nodes(next).find((node) => node.type === "select" && node.props.ariaLabel === "Number of hook videos").props.value, "4");
  assert.equal(nodes(next).find((node) => node.type === "textarea").props.value, "Still mine.");
});

test("each workflow offers only the duration and quality choices accepted by the configured application API", () => {
  const { backend } = generationModules(true);
  for (const kind of ["hook", "phone"]) {
    const actual = harness({ seedanceEnabled: true });
    const label = kind === "hook" ? "Hook" : "Phone video";
    for (const model of backend.AI_STUDIO_VIDEO_MODELS) {
      const first = nodes(actual.render({ kind }));
      first.find((node) => node.type === "select" && node.props.ariaLabel === `${label} model`).props.onChange(model);
      const next = nodes(actual.render({ kind }));
      const durations = next.find((node) => node.type === "duration-control" && node.props.ariaLabel === `${label} duration`);
      const qualities = next.find((node) => node.type === "select" && node.props.ariaLabel === `${label} quality`);
      assert.equal(durations.props.model, model);
      assert.ok(backend.getAIStudioVideoDurations(model).includes(durations.props.value));
      assert.deepEqual(Array.from(qualities.props.options, (option) => option.value), Array.from(backend.getAIStudioVideoResolutions(model)));
      assert.ok(qualities.props.options.some((option) => option.value === qualities.props.value));
    }
  }
});

test("disabled Seedance is neither offered nor used as the default", () => {
  const all = nodes(harness().render());
  const model = all.find((node) => node.type === "select" && node.props.ariaLabel === "Hook model");
  assert.equal(model.props.value, "kling_3_0");
  assert.deepEqual(Array.from(model.props.options, (option) => option.value), ["kling_3_0", "google_omni"]);
  assert.equal(model.props.options[1].label, "Omni Flash 1.1");
  const enabled = nodes(harness({ seedanceEnabled: true }).render()).find((node) => node.type === "select" && node.props.ariaLabel === "Hook model");
  assert.equal(enabled.props.value, "seedance_2_5");
  assert.ok(enabled.props.options.some((option) => option.value === "seedance_2_5"));
});

test("model changes atomically reset incompatible settings but retain valid output and ratio choices", () => {
  const { workflow } = generationModules(true);
  const seedance = workflow.normalizeWorkflowGenerationSettings({ model: "seedance_2_5", duration: 30, resolution: "480p", quantity: 4, aspectRatio: "16:9" });
  const omni = workflow.normalizeWorkflowGenerationSettings({ ...seedance, model: "google_omni" });
  assert.equal(omni.duration, 5);
  assert.equal(omni.resolution, "720p");
  assert.equal(omni.quantity, 4);
  assert.equal(omni.aspectRatio, "16:9");
  const kling = workflow.normalizeWorkflowGenerationSettings({ ...omni, resolution: "1080p", duration: 10, model: "kling_3_0" });
  assert.equal(kling.duration, 10);
  assert.equal(kling.resolution, "720p");
  const disabled = generationModules().workflow.normalizeWorkflowGenerationSettings(seedance);
  assert.equal(disabled.model, "kling_3_0");
  assert.equal(disabled.duration, 5);
  assert.equal(disabled.resolution, "720p");
});

test("the shared settings hook owns the draft, applies rapid changes to current state, and tracks unsaved settings", () => {
  const { workflow } = generationModules(true);
  let current;
  const exported = {};
  const imports = {
    react: { useState(initial) { current ??= initial(); return [current, (update) => { current = update(current); }]; } },
    "@/lib/explore/workflow-generation-settings": workflow,
  };
  vm.runInNewContext(ts.transpileModule(read("components/explore/use-workflow-generation-settings.ts"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
    exports: exported, require: (name) => { assert.ok(name in imports); return imports[name]; },
  });
  let hook = exported.useWorkflowGenerationSettings(10);
  assert.equal(hook.settings.duration, 10);
  assert.equal(hook.dirty, false);
  hook.changeSettings({ quantity: 4 });
  hook.changeSettings({ aspectRatio: "16:9" });
  hook = exported.useWorkflowGenerationSettings(10);
  assert.equal(hook.settings.quantity, 4);
  assert.equal(hook.settings.aspectRatio, "16:9");
  assert.equal(hook.dirty, true);
  hook.changeSettings({ quantity: 1, aspectRatio: "9:16" });
  assert.equal(exported.useWorkflowGenerationSettings(10).dirty, false);
  for (const file of ["hook-workflow-preview", "phone-workflow-preview"]) {
    const parent = read(`components/explore/${file}.tsx`);
    assert.match(parent, /useWorkflowGenerationSettings\(/);
    assert.match(parent, /generationSettings=\{generation.settings\}/);
    assert.match(parent, /onGenerationSettingsChange=\{generation.changeSettings\}/);
    assert.match(parent, /const dirty = Boolean\(selection.dirty \|\| generation.dirty/);
  }
});

test("text-only prompts remain valid and local reference previews do not promise unsupported generation behavior", () => {
  const text = nodes(harness().render()).filter((node) => node.type === "p").map((node) => node.props.children).join(" ");
  assert.match(text, /Text-only prompts are supported; reference images are optional/);
  assert.match(text, /Use Seedance 2.5 for a video reference up to 30 seconds/);
  assert.doesNotMatch(source, /disabled=\{!creator.asset|instructions.*creator.asset/);
  const audio = read("components/explore/workflow-audio-reference.tsx");
  assert.match(audio, /Main voice reference/);
  assert.match(audio, /Voice guidance · Up to 30 seconds/);
  assert.doesNotMatch(audio, /voice—not background music or demo audio/);
  assert.doesNotMatch(audio, /Exact recording<\/Button>/);
  assert.match(audio, /maxDuration: 30/);
  assert.doesNotMatch(audio, /Use exact recording for the spoken words/);
});

test("the hook example is placeholder text only and never becomes an instruction value", () => {
  const actual = harness();
  const changes = [];
  const empty = nodes(actual.render({ onInstructionsChange: (value) => changes.push(value) })).find((node) => node.type === "textarea");
  assert.match(empty.props.placeholder, /^Example: A creator looks into the camera/);
  assert.match(empty.props.placeholder, /natural lighting, a close-up shot, and a casual, friendly tone/);
  assert.equal(empty.props.value, "");
  assert.deepEqual(changes, []);
  const draft = "  Only my own words.\nKeep these spaces.  ";
  empty.props.onChange({ target: { value: draft } });
  assert.deepEqual(changes, [draft]);
  const filled = nodes(actual.render({ instructions: draft })).find((node) => node.type === "textarea");
  assert.equal(filled.props.value, draft);
  assert.equal(filled.props.placeholder, empty.props.placeholder);
  assert.doesNotMatch(read("components/explore/hook-workflow-preview.tsx"), /HookPromptExamples|useExamplePrompt/);
});

test("the phone example is placeholder text only and keeps its app-screen-specific guidance", () => {
  const actual = harness();
  const changes = [];
  const empty = nodes(actual.render({ kind: "phone", onInstructionsChange: (value) => changes.push(value) })).find((node) => node.type === "textarea");
  assert.match(empty.props.placeholder, /^Example: A creator holds a phone/);
  assert.match(empty.props.placeholder, /Show the attached app screen inside the phone/);
  assert.equal(empty.props.value, "");
  assert.deepEqual(changes, []);
  const draft = "  Show my own app.\nKeep my wording.  ";
  empty.props.onChange({ target: { value: draft } });
  assert.deepEqual(changes, [draft]);
  const filled = nodes(actual.render({ kind: "phone", instructions: draft })).find((node) => node.type === "textarea");
  assert.equal(filled.props.value, draft);
  assert.equal(filled.props.placeholder, empty.props.placeholder);
});

test("both long creation placeholders are visually hidden below the desktop breakpoint without hiding user text", () => {
  const css = read("components/explore/workflow-creation.module.css");
  const desktop = css.match(/@media \(min-width: 1024px\)\s*\{([\s\S]*?)\n\}/)?.[1];
  assert.ok(desktop);
  const hiddenHint = '.composer .prompt::placeholder { font-size: 0; opacity: 0; }';
  assert.ok(css.indexOf(hiddenHint) >= 0 && css.indexOf(hiddenHint) < css.indexOf("@media"));
  assert.match(desktop, /\.composer \.prompt::placeholder\s*\{\s*font-size: inherit; opacity: 1;\s*\}/);
  assert.doesNotMatch(css, /\.prompt\[name="(?:hook|phone)Instructions"\](?!::placeholder)\s*\{/);
});

test("the phone app screen is above instructions and separate from video references", () => {
  const appScreen = element("app-screen");
  const tree = harness().render({ kind: "phone", appScreenControl: appScreen });
  const all = nodes(tree);
  assert.ok(all.indexOf(appScreen) < all.findIndex((node) => node.type === "textarea"));
  assert.equal(all.find((node) => node.type === "textarea").props.name, "phoneInstructions");
  assert.ok(all.some((node) => node.props["aria-label"] === "Optional references"));
});

test("the form cannot call providers, persist drafts or inject instructions", () => {
  assert.doesNotMatch(source, /\bfetch\(|localStorage|sessionStorage|setInstructions\(|\.trigger\(/);
  const changes = source.match(/onInstructionsChange\(/g);
  assert.equal(changes.length, 1);
  assert.doesNotMatch(source, /onInstructionsChange\(.*(?:trim|replace|concat)/);
});

test("available creator imagery is blurred without selecting it; selected imagery is sharp", () => {
  const actual = harness();
  const available = nodes(actual.render()).filter((node) => node.type === "image" && node.props.fill);
  assert.equal(available.length, 1);
  assert.equal(available[0].props.src, "/creator.png");
  assert.equal(available[0].props.className, "referenceAvailable");
  assert.equal(available[0].props["aria-hidden"], "true");
  const asset = { name: "chosen.png", url: "blob:chosen" };
  const selected = nodes(actual.render({ creator: { asset } })).filter((node) => node.type === "image" && node.props.fill);
  assert.equal(selected.length, 1);
  assert.equal(selected[0].props.src, asset.url);
  assert.equal(selected[0].props.className, "referenceMedia");
  const css = read("components/explore/workflow-creation.module.css");
  assert.match(css, /\.referenceAvailable[^}]*filter: blur\(2px\)/);
  assert.doesNotMatch(css.match(/\.referenceMedia, \.referenceAvailable\s*\{[^}]+\}/)?.[0] ?? "", /filter:/);
});

test("reference video appears only after a user selects it, with no stock-video fallback", () => {
  const actual = harness();
  assert.equal(nodes(actual.render()).filter((node) => node.type === "video").length, 0);
  const asset = { name: "mine.mp4", url: "blob:mine" };
  const selected = nodes(actual.render({ videoReference: { asset } }));
  const video = selected.find((node) => node.type === "video");
  assert.equal(video.props.src, asset.url);
  assert.equal(video.props.className, "referenceMedia");
  assert.equal(video.props.muted, true);
  assert.equal(video.props.autoPlay, undefined);
  assert.doesNotMatch(source, /HOOK_VIDEOS|stockVideo|sampleVideo|fetch\(/);
});

test("reference states show selection, loading and errors without changing instructions or tile geometry", () => {
  const actual = harness();
  const tile = (tree, label) => nodes(tree).find((node) => node.type === "PopoverTrigger" && node.props.render.props["aria-label"].startsWith(label)).props.render;
  const empty = actual.render();
  assert.equal(tile(empty, "Choose image").props["data-state"], "available");
  assert.equal(tile(empty, "Choose video").props["data-state"], "empty");
  const loading = actual.render({ videoReference: { asset: null, error: null, loading: true } });
  assert.equal(tile(loading, "Choose video").props["data-state"], "loading");
  assert.equal(tile(loading, "Choose video").props["aria-busy"], true);
  assert.equal(nodes(loading).find((node) => node.props.role === "status").props.children, "Reading your reference…");
  const selected = actual.render({ creator: { asset: { name: "mine.png", url: "blob:mine" }, loading: false, error: null } });
  assert.equal(tile(selected, "Choose image").props["data-state"], "selected");
  assert.equal(tile(selected, "Choose image").props.title, "mine.png");
  const failed = actual.render({ instructions: "  Keep exactly this.  ", videoReference: { asset: null, error: "Not a video.", loading: false } });
  assert.equal(tile(failed, "Choose video").props["data-state"], "error");
  assert.ok(nodes(failed).some((node) => node.props.role === "alert" && node.props.children === "Not a video."));
  assert.equal(nodes(failed).find((node) => node.type === "textarea").props.value, "  Keep exactly this.  ");
  assert.ok([empty, loading, selected, failed].every((tree) => tile(tree, "Choose video").props.className === "referenceButton"));
  assert.equal(nodes(empty).find((node) => node.type === "h2").props.className, "sr-only");
});
