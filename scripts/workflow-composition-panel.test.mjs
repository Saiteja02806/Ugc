import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const source = read("components/explore/workflow-composition-panel.tsx");
const audioSource = read("components/explore/workflow-audio-reference.tsx");
const styles = read("components/explore/workflow-creation.module.css");
const element = (type, props = {}) => typeof type === "function" ? type(props) : ({ type, props });
const audioTiming = {};
const subtitleStyles = {};
vm.runInNewContext(ts.transpileModule(read("worker/src/subtitles/styles.ts"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText, { exports: subtitleStyles });
vm.runInNewContext(ts.transpileModule(read("worker/src/lib/explore-background-audio.ts"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText, { exports: audioTiming, Error });

function harness(code, exportName) {
  let cursor = 0;
  const slots = [];
  const imports = {
    react: { useState(initial) { const i = cursor++; slots[i] ??= initial; return [slots[i], (value) => { slots[i] = value; }]; } },
    "lucide-react": Object.fromEntries(["AudioLines", "Check", "ChevronDown", "Info", "Play", "Plus", "Video", "Volume2"].map((name) => [name, name])),
    "@/components/explore/hook-workflow-media-controls": { RemoveMediaButton: "remove", WorkflowFilePicker: "picker", WorkflowMediaPlayer: "player", formatMediaSeconds: (seconds) => `${seconds}s` },
    "@/components/generation/ai-studio-composer": { AiStudioSettingSelect: "select" },
    "@/components/explore/workflow-studio.module.css": { default: {} },
    "@/components/explore/workflow-creation.module.css": { default: new Proxy({}, { get: (_, key) => key }) },
    "@/components/ui/button": { Button: "button" },
    "@/components/explore/workflow-saved-audio-picker": { WorkflowSavedAudioPicker: "saved-audio-picker" },
    "@/components/explore/workflow-demo-controls": { WorkflowDemoControls: "demo-controls", WorkflowDemoPreview: "framed-demo" },
    "@/components/explore/workflow-saved-audio-choices": { WorkflowSavedAudioChoices: "saved-audio-choices" },
    "@/components/ui/popover": Object.fromEntries(["Popover", "PopoverContent", "PopoverTitle", "PopoverTrigger"].map((name) => [name, name])),
    "@/lib/utils": { cn: (...values) => values.join(" ") },
    "@/worker/src/subtitles/explore-policy": { EXPLORE_SUBTITLE_SCOPE_LABEL: "English · up to 60 seconds total" },
    "@/worker/src/lib/explore-background-audio": audioTiming,
    "@/worker/src/subtitles/styles": subtitleStyles,
    "@/components/explore/workflow-subtitle-preview": { WorkflowSubtitlePreview: "subtitle-preview" },
    "react/jsx-runtime": { jsx: element, jsxs: element, Fragment: "fragment" },
  };
  const exported = {};
  vm.runInNewContext(ts.transpileModule(code, { fileName: "panel.tsx", compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, { exports: exported, require: (name) => {
    assert.ok(name in imports, `Unexpected import ${name}`);
    return imports[name];
  }, Error });
  return { render(props) { cursor = 0; return exported[exportName](props); } };
}
function nodes(node) {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!node || typeof node !== "object") return [];
  return [node, ...nodes(node.props?.children)];
}
function text(node) {
  if (Array.isArray(node)) return node.map(text).join(" ").replace(/\s+/g, " ").trim();
  if (!node || typeof node === "boolean") return "";
  if (typeof node !== "object") return String(node);
  return text(node.props?.children);
}
const makeAttachment = (name, attached = false, duration = 3) => ({ asset: attached ? { name, url: `blob:${name}`, duration } : null, error: null, loading: false, choose() {}, remove() {} });
function render(overrides = {}) {
  const props = { videoLabel: "Hook", demo: makeAttachment("demo.mp4"), demoAudio: makeAttachment("demo.wav"), demoAudioPlayback: "once", onDemoAudioPlaybackChange() {}, ...overrides };
  return { props, tree: harness(source, "WorkflowCompositionPanel").render(props) };
}
function audioRender(overrides = {}) {
  const props = { audioLabel: "Hook audio", audio: makeAttachment("hook.wav"), audioMode: "voice", onAudioModeChange() {}, ...overrides };
  return { props, tree: harness(audioSource, "WorkflowAudioReference").render(props) };
}

test("the actual Edit video section offers optional demo without dummy result tiles or media", () => {
  const { tree } = render();
  assert.equal(tree.props["aria-label"], "Video finishing settings");
  assert.match(text(tree), /Edited demo.*Demo Optional/);
  assert.equal(nodes(tree).filter((node) => node.type === "ol").length, 0);
  assert.equal(nodes(tree).filter((node) => node.type === "player").length, 0);
  assert.ok(nodes(tree).some((node) => node.type === "button" && node.props.disabled && node.props["aria-label"] === "Select demo audio"));
});

test("demo controls are opt-in, tied only to the attached demo, and preserve its aspect target", () => {
  assert.equal(nodes(render({ demo: makeAttachment("demo.mp4", true) }).tree).some(node => node.type === "demo-controls"), false);
  for (const videoLabel of ["Hook", "Phone video"]) {
    const onDemoFramingChange = () => {}, { props, tree } = render({ videoLabel, demo: makeAttachment("demo.mp4", true), demoFramingEnabled: true, onDemoFramingChange, outputAspect: 9 / 16, editingBusy: true });
    const controls = nodes(tree).find(node => node.type === "demo-controls");
    assert.equal(controls.props.asset, props.demo.asset); assert.equal(controls.props.onChange, onDemoFramingChange);
    assert.equal(controls.props.outputAspect, 9 / 16); assert.equal(controls.props.disabled, true);
  }
});

test("unfinished finishing tools remain off, disabled and explained", () => {
  const { tree } = render();
  const switches = nodes(tree).filter((node) => node.props.role === "switch");
  assert.deepEqual(switches.map((node) => node.props["aria-label"]), ["Background music", "Auto subtitles"]);
  for (const control of switches) {
    assert.equal(control.props.disabled, true);
    assert.equal(control.props["aria-checked"], false);
    assert.equal(control.props.onClick, undefined);
    assert.equal(control.props["aria-describedby"], "hook-finishing-unavailable");
  }
  assert.equal(nodes(tree).find((node) => node.props["aria-label"] === "Scheduling"), undefined);
  assert.match(text(tree), /Music and subtitle rendering are not connected in this local preview/);
  assert.match(text(tree), /English · up to 60 seconds total/);
});

test("connected subtitle controls save real finishing options and Audio selection stays on the Demo attachment", () => {
  const changes = [];
  const { props, tree } = render({ connected: true, ownerId: "owner", demo: makeAttachment("demo.mp4", true), options: { subtitles: false, style: "clean", backgroundMusic: false }, onOptionsChange: value => changes.push(value) });
  const toggle = nodes(tree).find(n => n.props.role === "switch" && n.props["aria-label"] === "Auto subtitles");
  assert.notEqual(toggle.props.disabled, true); toggle.props.onClick(); assert.equal(changes[0].subtitles, true);
  const bold = nodes(tree).find(n => n.props["data-style"] === "bold-box"); bold.props.onClick(); assert.equal(changes[1].style, "bold-box");
  const editorial = nodes(tree).find(n => n.props["data-style"] === "editorial");
  assert.notEqual(editorial.props.disabled, true); editorial.props.onClick(); assert.equal(changes[2].style, "editorial");
  const music = nodes(tree).find(n => n.props.role === "switch" && n.props["aria-label"] === "Background music");
  assert.equal(music.props["aria-checked"], false); music.props.onClick(); assert.equal(changes[3].backgroundMusic, true);
  const picker = nodes(tree).find(n => n.type === "saved-audio-picker"); assert.equal(picker.props.attachment, props.demoAudio); assert.equal(picker.props.ownerId, "owner");
  assert.doesNotMatch(text(tree), /Music and subtitle rendering are not connected in this local preview/);
  assert.match(text(tree), /Apply edits to save captions on your video/);
});

test("visual subtitle choices default to Clean and rerender locally without enabling the generator", () => {
  const actual = harness(source, "WorkflowCompositionPanel");
  const props = render().props;
  const first = actual.render(props);
  const group = nodes(first).find((node) => node.props["aria-label"] === "Subtitle style samples (local preview only)");
  assert.equal(group.props.role, "group");
  const choices = nodes(group).filter((node) => node.type === "button");
  assert.deepEqual(choices.map((node) => node.props["data-style"]), Array.from(subtitleStyles.SUBTITLE_STYLES));
  assert.deepEqual(choices.filter((node) => node.props["aria-pressed"]).map((node) => node.props["data-style"]), ["clean"]);
  assert.ok(choices.every((node) => node.props.type === "button" && nodes(node).some(child => child.type === "img" && child.props.src.endsWith(".jpg"))));
  choices.find((node) => node.props["data-style"] === "active-word").props.onClick();
  const next = actual.render(props);
  assert.deepEqual(nodes(next).filter((node) => node.type === "button" && node.props["data-style"] && node.props["aria-pressed"]).map((node) => node.props["data-style"]), ["active-word"]);
  assert.equal(nodes(next).find((node) => node.type === "select"), undefined);
  assert.match(text(next), /Selecting a style changes your draft only/);
  assert.equal(nodes(next).find((node) => node.props.role === "switch" && node.props["aria-label"] === "Auto subtitles").props.disabled, true);
  assert.doesNotMatch(source, /\bfetch\(|localStorage|sessionStorage|setInstructions|onInstructionsChange/);
});

test("subtitle choices show real rendered posters with draft and timing scope explained", () => {
  const { tree } = render();
  const subtitles = nodes(tree).find((node) => node.props["aria-label"] === "Subtitles");
  const help = nodes(subtitles).find((node) => node.props.id === "hook-subtitle-style-help");
  assert.equal(help.props.className, "sr-only");
  assert.match(text(help), /These rendered examples use the same clip and transcript/);
  assert.match(text(help), /including both segments/);
  assert.equal(nodes(tree).find((node) => node.props.id === "hook-finishing-unavailable").props.className, "sr-only");
  assert.match(styles, /\.subtitleChoices[^}]*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.equal(nodes(tree).filter(node => node.type === "subtitle-preview").length, 1);
  assert.match(styles, /\.subtitleChoice\[aria-pressed="true"\][^}]*border-color: var\(--primary\)/);
});

test("both workflows expose the English/60-second combined limit without adding subtitle subtext", () => {
  for (const videoLabel of ["Hook", "Phone video"]) {
    const { tree } = render({ videoLabel });
    const help = nodes(tree).find((node) => node.type === "PopoverTrigger" && node.props.render.props["aria-label"] === "Subtitle scope");
    assert.equal(help.props.render.props.type, "button");
    const subtitles = nodes(tree).find((node) => node.props["aria-label"] === "Subtitles");
    assert.match(text(subtitles), /English · up to 60 seconds total/);
    assert.match(text(subtitles), new RegExp(`includes your ${videoLabel.toLowerCase()} and demo together`));
    assert.match(text(subtitles), /Nothing is trimmed automatically/);
    assert.match(text(subtitles), /Rendering is not connected in this preview/);
    assert.equal(nodes(subtitles).find((node) => node.props.id?.endsWith("subtitle-style-help")).props.className, "sr-only");
  }
});

test("approved workspace gives clear guidance without an empty player or dummy video", () => {
  const canvas = read("components/explore/workflow-preview-canvas.tsx");
  assert.match(canvas, /Create your first hook/);
  assert.match(canvas, /Create your first phone video/);
  const actual = harness(canvas, "WorkflowPreviewCanvas");
  for (const kind of ["hook", "phone"]) {
    for (const generation of [undefined, { results: [], busy: false, error: null }]) {
      const tree = actual.render({ kind, generation });
      assert.match(text(tree), new RegExp(`Create your first ${kind === "hook" ? "hook" : "phone video"}`));
      assert.equal(nodes(tree).filter((node) => ["player", "button", "video", "img", "Image"].includes(node.type)).length, 0);
    }
  }
  assert.doesNotMatch(canvas, /\.mp4|previewFrame/);
  assert.doesNotMatch(styles, /aspect-ratio: 9 \/ 16/);
  for (const kind of ["hook", "phone"]) assert.match(read(`components/explore/${kind}-workflow-preview.tsx`), new RegExp(`<WorkflowPreviewCanvas kind="${kind}"`));
});

test("connected workspaces preview only supplied saved outputs and preserve result selection", () => {
  const actual = harness(read("components/explore/workflow-preview-canvas.tsx"), "WorkflowPreviewCanvas");
  const results = [1, 2].map((index) => ({ id: `asset-${index}`, title: `Video ${index}`, url: `https://storage.googleapis.com/owned/${index}.mp4`, durationSeconds: 5 }));
  for (const kind of ["hook", "phone"]) {
    const selections = [];
    const tree = actual.render({ kind, generation: { results, selected: results[0], busy: false, error: null, selectResult: (id) => selections.push(id) } });
    const players = nodes(tree).filter((node) => node.type === "player");
    assert.deepEqual(players.map((node) => node.props.asset.url), results.map((asset) => asset.url));
    const buttons = nodes(tree).filter((node) => node.type === "button");
    assert.deepEqual(buttons.map((node) => node.props["aria-pressed"]), [true, false]);
    buttons[1].props.onClick();
    assert.deepEqual(selections, ["asset-2"]);
    assert.ok(players.every((node) => !node.props.autoPlay));
  }
});

test("creation pane has no internal scrolling; only long input text and picker menus scroll", () => {
  for (const selector of ["controls", "controlContent"]) {
    for (const block of styles.matchAll(new RegExp(`\\.${selector}\\s*\\{([^}]+)\\}`, "g"))) {
      assert.doesNotMatch(block[1], /overflow(?:-y)?:\s*(auto|scroll|hidden)|height: calc/);
    }
  }
  assert.match(styles, /\.prompt[^}]*height: 72px[^}]*resize: none[^}]*overflow-y: auto/);
  assert.match(styles, /\.floating[^}]*overflow-y: auto/);
  assert.match(styles, /\.actionFooter\s*\{\s*flex-shrink: 0/);
  assert.doesNotMatch(read("components/explore/workflow-creation-panel.tsx"), /tabIndex=\{0\}/);
  const explore = read("components/explore/explore-workspace.module.css");
  assert.doesNotMatch(explore, /overflow-x: auto|scroll-snap|grid-auto-flow: column/);
});

test("settings occupy two rows with Quality, Videos and Ratio alongside each other", () => {
  assert.match(styles, /\.settingsGrid[^}]*grid-template-columns: repeat\(6, minmax\(0, 1fr\)\)/);
  assert.match(styles, /\.settingField\s*\{[^}]*grid-column: span 2/);
  assert.match(styles, /\.settingField:nth-child\(-n\+2\)[^}]*grid-column: span 3/);
  assert.match(styles, /\.referenceGrid[^}]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(styles, /\.referenceButton\s*\{[^}]*width: 100%[^}]*aspect-ratio: 1/);
  assert.match(styles, /\.referenceButton\s*\{[^}]*border-radius: 8px/);
});

test("actual attachment pickers receive only their own media state", () => {
  const { props, tree } = render({ demo: makeAttachment("demo.mp4", true), demoAudio: makeAttachment("demo.wav", true) });
  const pickers = nodes(tree).filter((node) => node.type === "picker");
  assert.equal(pickers.find((node) => node.props.label === "Replace demo").props.attachment, props.demo);
  assert.equal(pickers.find((node) => node.props.label === "Replace demo audio").props.attachment, props.demoAudio);
  const ref = audioRender({ audio: makeAttachment("hook.wav", true) });
  assert.equal(nodes(ref.tree).find((node) => node.type === "picker").props.attachment.asset, ref.props.audio.asset);
  assert.match(text(tree), /Added audio belongs to the demo only—not your hook or its generation voice reference/);
});

test("Create audio keeps the recording as AI guidance without an unimplemented exact-recording mode", () => {
  const changes = [];
  const audio = makeAttachment("voice.wav", true);
  const { tree } = audioRender({ audio, onAudioModeChange: (mode) => changes.push(mode) });
  const buttons = nodes(tree).filter((node) => node.type === "button");
  assert.ok(buttons.every(node => !["Exact recording", "Voice reference"].includes(text(node))));
  assert.deepEqual(changes, []);
  assert.match(text(tree), /Voice guidance · Up to 30 seconds/);
  assert.doesNotMatch(text(tree), /exact copy|Files upload only|through OpenRouter/);
  assert.equal(audio.asset.name, "voice.wav");
  assert.doesNotMatch(audioSource, /setInstructions|onInstructionsChange|\bfetch\(|localStorage|sessionStorage/);
  const empty = audioRender().tree;
  assert.doesNotMatch(text(empty), /No audio selected. No sample audio is added/);
  assert.match(text(empty), /Select audio/);
  assert.ok(nodes(empty).some((node) => node.type === "AudioLines"));
  assert.doesNotMatch(audioSource, /Mic2/);
});

test("phone input is separate from the appended demo and longer audio describes fitting instead of rejecting", () => {
  const { tree } = render({ videoLabel: "Phone video", demo: makeAttachment("demo.mp4", true), demoAudio: makeAttachment("demo.wav", true, 30) });
  assert.equal(nodes(tree).filter((node) => node.props["aria-label"] === "App screen input").length, 0);
  const workspace = read("components/explore/phone-workflow-preview.tsx");
  assert.match(workspace, /<PhoneWorkflowComposer[^\n]*appScreenControl=\{<AppScreenPicker/);
  assert.match(text(tree), /Added audio will fade out at the demo’s end/);
  assert.equal(nodes(tree).filter((node) => node.props.role === "alert").length, 0);
});

test("permanent layout is limited to workflows 1 and 3, with narrow in-flow controls", () => {
  assert.match(styles, /grid-template-columns: 360px minmax\(0, 1fr\)/);
  assert.match(styles, /@media \(min-width: 1024px\)/);
  assert.match(styles, /\.controls, \.main\s*\{\s*align-self: stretch/);
  assert.doesNotMatch(styles, /position: sticky/);
  assert.doesNotMatch(styles, /position: fixed/);
  for (const kind of ["hook", "phone"]) {
    const workspace = read(`components/explore/${kind}-workflow-preview.tsx`);
    const header = workspace.slice(workspace.indexOf("<header"), workspace.indexOf("</header>"));
    assert.doesNotMatch(header, /Attach audio|Attached demo|Popover|<Button/);
    assert.doesNotMatch(workspace, /wideLayout|useSyncExternalStore|demoOpen|<Dialog/);
    assert.match(workspace, /<WorkflowCompositionPanel/);
  }
  assert.doesNotMatch(read("components/explore/recreate-workspace.tsx"), /workflow-creation|WorkflowCompositionPanel/);
  assert.doesNotMatch(read("components/explore/recreate-generation-panel.tsx"), /workflow-creation|WorkflowCompositionPanel/);
});

test("Demo audio is directly visible in editing, and section changes pause without clearing attachments", () => {
  const demoAudio = makeAttachment("background.wav", true);
  const { tree } = render({ demo: makeAttachment("demo.mp4", true), demoAudio });
  const sound = nodes(tree).find((node) => node.props["aria-label"] === "Demo audio details");
  assert.equal(nodes(tree).filter((node) => node.type === "details").length, 0);
  assert.match(text(sound), /Demo audio/);
  assert.doesNotMatch(text(tree), /Demo sound/);
  assert.equal(demoAudio.asset.name, "background.wav");
  assert.ok(nodes(sound).some((node) => node.type === "player" && node.props.asset === demoAudio.asset));
  for (const kind of ["hook", "phone"]) {
    const workspace = read(`components/explore/${kind}-workflow-preview.tsx`);
    assert.match(workspace, /querySelectorAll<HTMLMediaElement>\("audio, video"\)\.forEach\(\(?player\)? => player\.pause\(\)\)/);
    assert.ok(workspace.indexOf("player.pause()") < workspace.indexOf("setSection(value)"));
  }
});

test("stacked demo and audio controls keep their attachment ownership across states", () => {
  const empty = render().tree;
  const grid = nodes(empty).find((node) => node.props.className === "editMediaGrid");
  assert.deepEqual(nodes(grid).filter((node) => node.type === "section").map((node) => node.props["aria-label"]), ["Optional demo", "Demo audio attachment"]);
  assert.equal(nodes(grid).find((node) => node.type === "picker").props.className, "editUploadButton");
  const unavailable = nodes(grid).find((node) => node.type === "button");
  assert.equal(unavailable.props.disabled, true);
  assert.equal(unavailable.props.className, "editUploadButton editAudioButton");
  assert.equal(unavailable.props["aria-describedby"], "hook-demo-audio-help");
  const { props, tree } = render({ demo: makeAttachment("demo.mp4", true), demoAudio: { ...makeAttachment("demo.wav"), loading: true } });
  assert.equal(nodes(tree).find((node) => node.props["aria-label"] === "Demo audio attachment").props["aria-busy"], true);
  const preview = nodes(tree).find((node) => node.type === "PopoverTrigger" && node.props.render.props["aria-label"] === "Preview demo");
  assert.equal(preview.props.render.props.className, "editUploadButton");
  assert.equal(nodes(tree).find((node) => node.type === "picker" && node.props.label === "Select demo audio").props.attachment, props.demoAudio);
  assert.match(styles, /\.editMediaGrid[^}]*display: flex[^}]*flex-direction: column/);
  assert.match(styles, /\.editUploadButton\s*\{[^}]*height: 160px[^}]*min-height: 144px/);
  assert.match(styles, /\.editUploadButton\.editAudioButton[^}]*height: 44px[^}]*flex-direction: row/);
  assert.match(styles, /\.controls\[data-section="edit"\] \.uploadCard:first-child \.editUploadButton[^}]*flex: 1; height: auto/);
});

test("secondary demo-audio help uses an accessible popover while errors stay outside it", () => {
  const { tree } = render({ demo: makeAttachment("demo.mp4", true), demoAudio: { ...makeAttachment("demo.wav"), error: "Invalid audio." } });
  const help = nodes(tree).find((node) => node.type === "PopoverTrigger" && node.props.render.props["aria-label"] === "Demo audio details");
  assert.equal(help.props.render.props.type, "button");
  const audioDetails = nodes(tree).find((node) => node.props["aria-label"] === "Demo audio details");
  const popupNodes = nodes(tree).filter((node) => node.type === "PopoverContent").flatMap(nodes);
  const alerts = nodes(audioDetails).filter((node) => node.props.role === "alert");
  assert.equal(alerts.length, 1);
  assert.ok(alerts.every((alert) => !popupNodes.includes(alert)));
  assert.match(text(audioDetails), /Only the added audio is fitted; your video and source files are unchanged/);
  assert.equal(nodes(tree).find((node) => node.type === "h2").props.className, "sr-only");
});

test("both workflows expose explicit play-once/repeat choices and honest local timing guidance", () => {
  for (const videoLabel of ["Hook", "Phone video"]) {
    const changes = [], demo = makeAttachment("demo.mp4", true, 20), demoAudio = makeAttachment("short.wav", true, 5);
    const actual = harness(source, "WorkflowCompositionPanel");
    const props = { ...render().props, videoLabel, demo, demoAudio, onDemoAudioPlaybackChange: (mode) => changes.push(mode) };
    const first = actual.render(props);
    const group = nodes(first).find((node) => node.props["aria-label"] === "Demo audio playback (local draft only)");
    assert.equal(group.props.role, "group");
    const choices = nodes(group).filter((node) => node.type === "button");
    assert.deepEqual(choices.map((node) => [text(node), node.props["aria-pressed"]]), [["Play once", true], ["Repeat music", false]]);
    assert.match(text(first), /Added audio will play once and fade out; original demo sound continues/);
    choices[1].props.onClick();
    assert.deepEqual(changes, ["repeat"]);
    const next = actual.render({ ...props, demoAudioPlayback: "repeat" });
    assert.match(text(next), /Music will repeat to cover the demo, then fade out/);
    assert.match(text(next), /Timing preference only; combined playback is not connected yet/);
    assert.match(text(next), /not spoken recordings/);
    assert.equal(demoAudio.asset.name, "short.wav");
    assert.equal(nodes(next).find((node) => node.props.role === "switch" && node.props["aria-label"] === "Auto subtitles").props.disabled, true);
    const workspace = read(`components/explore/${videoLabel === "Hook" ? "hook" : "phone"}-workflow-preview.tsx`);
    assert.match(workspace, /useState<ExploreBackgroundPlayback>\("once"\)/);
    assert.match(workspace, /demoAudioPlayback=\{demoAudioPlayback\} onDemoAudioPlaybackChange=\{setDemoAudioPlayback\}/);
    assert.match(workspace, /if \(accepted\) \{ demoAudio\.remove\(\); setDemoAudioPlayback\("once"\); setDemoFraming\(null\); \}/);
    assert.match(workspace, /function removeDemoAudio\(\) \{\s*demoAudio\.remove\(\);\s*setDemoAudioPlayback\("once"\)/);
    assert.match(workspace, /if \(accepted\) setDemoAudioPlayback\("once"\)/);
    assert.doesNotMatch(workspace, /invalidDemoAudio|isDemoAudioTooLong/);
  }
});

test("invalid audio duration is an accessible error, while missing metadata is not falsely rejected", () => {
  const bad = render({ demo: makeAttachment("demo.mp4", true), demoAudio: makeAttachment("long.wav", true, 601) }).tree;
  assert.match(text(nodes(bad).find((node) => node.props.role === "alert")), /Choose background audio up to 10 minutes long/);
  const unknown = render({ demo: makeAttachment("demo.mp4", true), demoAudio: makeAttachment("loading.wav", true, null) }).tree;
  assert.equal(nodes(unknown).filter((node) => node.props.role === "alert").length, 0);
  assert.match(text(unknown), /Audio timing will use the measured demo duration/);
});

test("audio reference selection and validation states retain the waveform and recording", () => {
  for (const [state, attachment] of [["empty", makeAttachment("voice.wav")], ["selected", makeAttachment("voice.wav", true)], ["loading", { ...makeAttachment("voice.wav"), loading: true }], ["error", { ...makeAttachment("voice.wav"), error: "Invalid audio." }]]) {
    const { tree } = audioRender({ audio: attachment });
    const trigger = nodes(tree).find((node) => node.type === "PopoverTrigger");
    assert.equal(trigger.props.render.props["data-state"], state);
    assert.equal(trigger.props.render.props["aria-busy"], state === "loading");
    assert.equal(trigger.props.render.props.className, "referenceButton");
    assert.ok(nodes(trigger).some((node) => node.type === "AudioLines"));
  }
});

test("concise reference pickers preserve uploads, playback, removal, errors and the 30-second limit", async () => {
  for (const audioLabel of ["Hook audio", "Creator audio"]) {
    const chosen = [], removed = [], file = { name: "replacement.mp3", type: "audio/mpeg" };
    const audio = { ...makeAttachment("voice.mp3", true), choose: async (...args) => { chosen.push(args); return true; }, remove: () => removed.push(true) };
    const { tree } = audioRender({ audioLabel, audio });
    const popup = nodes(tree).find(node => node.type === "PopoverContent");
    const paragraphs = nodes(popup).filter(node => node.type === "p");
    assert.deepEqual(paragraphs.map(text), ["Voice guidance · Up to 30 seconds.", "voice.mp3"]);
    const picker = nodes(tree).find(node => node.type === "picker");
    assert.equal(await picker.props.attachment.choose(file), true);
    assert.equal(chosen[0][0], file);
    assert.equal(chosen[0][1].maxDuration, 30);
    assert.equal(nodes(tree).find(node => node.type === "player").props.asset, audio.asset);
    nodes(tree).find(node => node.type === "remove").props.onClick();
    assert.deepEqual(removed, [true]);
    const bad = audioRender({ audioLabel, audio: { ...audio, error: "Invalid audio." } }).tree;
    assert.equal(text(nodes(bad).find(node => node.props.role === "alert")), "Invalid audio.");
  }
  const actual = harness(audioSource, "WorkflowAudioReference");
  const props = { ...audioRender().props, ownerId: "owner" };
  const closed = actual.render(props);
  assert.equal(nodes(closed).filter(node => node.type === "saved-audio-choices").length, 0);
  nodes(closed).find(node => node.type === "Popover").props.onOpenChange(true);
  const open = actual.render(props);
  const saved = nodes(open).find(node => node.type === "saved-audio-choices");
  assert.equal(saved.props.ownerId, "owner");
  assert.equal(saved.props.audio, props.audio);
  assert.doesNotMatch(read("components/explore/workflow-saved-audio-choices.tsx"), /Use sample attaches existing audio|Your recordings up to 30 seconds/);
});

test("both workflows keep concise voice-reference guidance separate from demo-only playback", () => {
  for (const [audioLabel, videoLabel] of [["Hook audio", "Hook"], ["Creator audio", "Phone video"]]) {
    const reference = audioRender({ audioLabel, audio: makeAttachment("voice.wav", true) });
    assert.match(text(reference.tree), /Main voice reference/);
    assert.match(text(reference.tree), /Voice guidance · Up to 30 seconds/);
    assert.doesNotMatch(text(reference.tree), /background music|demo audio|OpenRouter|Files upload|exact copy/);
    const demo = render({ videoLabel, demo: makeAttachment("demo.mp4", true), demoAudio: makeAttachment("demo.wav", true) });
    const details = nodes(demo.tree).find((node) => node.props["aria-label"] === "Demo audio details");
    assert.match(text(details), new RegExp(`Added audio belongs to the demo only—not your ${videoLabel.toLowerCase()}`));
    assert.match(text(details), /combined playback is not connected yet/);
    assert.match(text(details), /Your demo’s original sound is kept/);
    assert.match(text(details), /Uploaded audio is mixed underneath it as background audio during the demo only/);
    assert.doesNotMatch(text(details), /original sound stays as it is|voice-over replaces/);
  }
});

test("generation drafts use only their own voice reference and never the demo or demo audio", () => {
  for (const [kind, audioName] of [["hook", "hookAudio"], ["phone", "creatorAudio"]]) {
    const file = `components/explore/${kind}-workflow-preview.tsx`;
    const tree = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const drafts = [];
    function visit(node) {
      if (ts.isJsxOpeningElement(node) && node.tagName.getText(tree) === "WorkflowGenerationBoundary") {
        const attribute = node.attributes.properties.find((property) => ts.isJsxAttribute(property) && property.name.getText(tree) === "draft");
        assert.ok(attribute?.initializer && ts.isJsxExpression(attribute.initializer));
        const value = attribute.initializer.expression;
        assert.ok(value && ts.isObjectLiteralExpression(value));
        assert.ok(value.properties.every((property) => ts.isPropertyAssignment(property) || ts.isShorthandPropertyAssignment(property)), "No spread may silently add demo inputs to a generation draft");
        drafts.push(new Map(value.properties.map((property) => [property.name.getText(tree), ts.isPropertyAssignment(property) ? property.initializer.getText(tree) : property.name.getText(tree)])));
      }
      ts.forEachChild(node, visit);
    }
    visit(tree);
    assert.equal(drafts.length, 1);
    assert.equal(drafts[0].get("audioReference"), `${audioName}.asset`);
    assert.ok([...drafts[0].values()].every((expression) => !/\bdemo(?:Audio)?\b/.test(expression)));
  }
});
