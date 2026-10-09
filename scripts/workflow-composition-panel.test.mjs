import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import * as subtitleStyles from "../worker/dist/subtitles/styles.js";
import * as subtitlePolicy from "../worker/dist/subtitles/explore-policy.js";
import * as backgroundAudio from "../worker/dist/lib/explore-background-audio.js";

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const source = read("components/explore/workflow-composition-panel.tsx");
const audioSource = read("components/explore/workflow-audio-reference.tsx");
const styles = read("components/explore/workflow-creation.module.css");
const element = (type, props = {}) => typeof type === "function" ? type(props) : ({ type, props });

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
    "@/components/ui/popover": Object.fromEntries(["Popover", "PopoverContent", "PopoverTitle", "PopoverTrigger"].map((name) => [name, name])),
    "@/lib/utils": { cn: (...values) => values.join(" ") },
    "@/worker/src/subtitles/styles": subtitleStyles,
    "@/worker/src/subtitles/explore-policy": subtitlePolicy,
    "@/worker/src/lib/explore-background-audio": backgroundAudio,
    "@/components/explore/workflow-subtitle-preview": { WorkflowSubtitlePreview: "subtitle-preview" },
    "@/components/explore/workflow-saved-audio-picker": { WorkflowSavedAudioPicker: "saved-audio-picker" },
    "@/components/explore/workflow-demo-controls": { WorkflowDemoControls: "demo-controls" },
    "react/jsx-runtime": { jsx: element, jsxs: element, Fragment: "fragment" },
  };
  const exported = {};
  vm.runInNewContext(ts.transpileModule(code, { fileName: "panel.tsx", compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, { exports: exported, require: (name) => {
    assert.ok(name in imports, `Unexpected import ${name}`);
    return imports[name];
  } });
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
  assert.match(text(tree), /subtitles from your final audio/);
});

test("visual subtitle choices default to Clean and rerender locally without enabling the generator", () => {
  const actual = harness(source, "WorkflowCompositionPanel");
  const props = render().props;
  const first = actual.render(props);
  const group = nodes(first).find((node) => node.props["aria-label"] === "Subtitle style samples (local preview only)");
  assert.equal(group.props.role, "group");
  const choices = nodes(group).filter((node) => node.type === "button");
  assert.deepEqual(choices.map((node) => node.props["data-style"]), subtitleStyles.SUBTITLE_STYLES);
  assert.deepEqual(choices.filter((node) => node.props["aria-pressed"]).map((node) => node.props["data-style"]), ["clean"]);
  assert.ok(choices.every((node) => node.props.type === "button" && nodes(node).some(image => image.type === "img" && image.props.src === subtitleStyles.subtitlePreview(node.props["data-style"]).poster)));
  choices.find((node) => node.props["data-style"] === "active-word").props.onClick();
  const next = actual.render(props);
  assert.deepEqual(nodes(next).filter((node) => node.type === "button" && node.props["data-style"] && node.props["aria-pressed"]).map((node) => node.props["data-style"]), ["active-word"]);
  assert.equal(nodes(next).find((node) => node.type === "select"), undefined);
  assert.match(text(next), /changes your draft only/);
  assert.equal(nodes(next).filter(node => node.type === "subtitle-preview").length, 1);
  assert.equal(nodes(next).find(node => node.type === "subtitle-preview").props.style, "active-word");
  assert.equal(nodes(next).find((node) => node.props.role === "switch" && node.props["aria-label"] === "Auto subtitles").props.disabled, true);
  assert.doesNotMatch(source, /\bfetch\(|localStorage|sessionStorage|setInstructions|onInstructionsChange/);
});

test("subtitle choices show real rendered posters with draft and timing scope explained", () => {
  const { tree } = render();
  const subtitles = nodes(tree).find((node) => node.props["aria-label"] === "Subtitles");
  const help = nodes(subtitles).find((node) => node.props.id === "hook-subtitle-style-help");
  assert.equal(help.props.className, "sr-only");
  assert.match(text(help), /rendered examples use the same clip and transcript/);
  assert.match(text(help), /English · up to 60 seconds total\s*, including both segments/);
  assert.equal(nodes(tree).find((node) => node.props.id === "hook-finishing-unavailable").props.className, "sr-only");
  assert.match(styles, /\.subtitleChoices[^}]*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(styles, /\.subtitleChoice\[aria-pressed="true"\][^}]*border-color: var\(--primary\)/);
});

test("approved workspace gives clear guidance without an empty player or dummy video", () => {
  const canvas = read("components/explore/workflow-preview-canvas.tsx");
  for (const kind of ["hook", "phone"]) {
    const actual = harness(canvas, "WorkflowPreviewCanvas");
    const empty = actual.render({ kind });
    assert.match(text(empty), kind === "hook" ? /Create your first hook/ : /Create your first phone video/);
    assert.equal(nodes(empty).filter(node => ["video", "img", "player", "button"].includes(node.type) || node.props?.src).length, 0);
    const selected = { name: "My video", url: "blob:selected", duration: 5 };
    const populated = actual.render({ kind, source: selected, mode: "assets" });
    assert.equal(nodes(populated).find(node => node.type === "player").props.asset, selected);
  }
  assert.doesNotMatch(styles, /aspect-ratio: 9 \/ 16/);
  for (const kind of ["hook", "phone"]) assert.match(read(`components/explore/${kind}-workflow-preview.tsx`), new RegExp(`<WorkflowPreviewCanvas kind="${kind}"`));
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
  assert.equal(nodes(ref.tree).find((node) => node.type === "picker").props.attachment, ref.props.audio);
  assert.match(text(tree), /Original sound preserved/);
});

test("audio dropdown changes intent only and keeps the selected recording", () => {
  const changes = [];
  const audio = makeAttachment("voice.wav", true);
  const { tree } = audioRender({ audio, onAudioModeChange: (mode) => changes.push(mode) });
  const buttons = nodes(tree).filter((node) => node.type === "button");
  buttons.find((node) => text(node) === "Exact recording").props.onClick();
  buttons.find((node) => text(node) === "Voice reference").props.onClick();
  assert.deepEqual(changes, ["recording", "voice"]);
  assert.equal(audio.asset.name, "voice.wav");
  assert.doesNotMatch(audioSource, /setInstructions|onInstructionsChange|\bfetch\(|localStorage|sessionStorage/);
  const empty = audioRender().tree;
  assert.match(text(empty), /No audio selected. No sample audio is added/);
  assert.match(text(empty), /Select audio/);
  assert.ok(nodes(empty).some((node) => node.type === "AudioLines"));
  assert.doesNotMatch(audioSource, /Mic2/);
});

test("phone input is separate from the appended demo and long added audio fades at the demo end", () => {
  const { tree } = render({ videoLabel: "Phone video", demo: makeAttachment("demo.mp4", true), demoAudio: makeAttachment("demo.wav", true, 8) });
  assert.equal(nodes(tree).filter((node) => node.props["aria-label"] === "App screen input").length, 0);
  const workspace = read("components/explore/phone-workflow-preview.tsx");
  assert.match(workspace, /<PhoneWorkflowComposer[^\n]*appScreenControl=\{<AppScreenPicker/);
  assert.match(text(tree), /Added audio will fade out at the demo’s end/);
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
  assert.match(text(audioDetails), /Added audio plays during the demo only/);
  assert.equal(nodes(tree).find((node) => node.type === "h2").props.className, "sr-only");
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
