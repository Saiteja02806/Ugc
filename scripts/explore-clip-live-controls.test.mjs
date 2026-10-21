import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import * as formatEdit from "../worker/src/lib/explore-format-edit.ts";
import * as emoji from "../worker/src/lib/explore-emoji.ts";

const nodes = tree => Array.isArray(tree) ? tree.flatMap(nodes) : tree && typeof tree === "object" ? [tree, ...nodes(tree.props?.children)] : [];
const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }), Fragment: "fragment" };
const styles = { default: new Proxy({}, { get: (_, name) => name }) };
function harness(file, dependencies = {}) {
  let cursor = 0;
  const slots = [], effects = [];
  const react = {
    useRef(value) { return slots[cursor++] ??= { current: value }; },
    useState(value) { const i = cursor++; if (!(i in slots)) slots[i] = typeof value === "function" ? value() : value;
      return [slots[i], next => { slots[i] = typeof next === "function" ? next(slots[i]) : next; }]; },
    useEffect(fn, deps) { const i = cursor++, previous = slots[i];
      if (!previous || deps.some((dep, n) => !Object.is(dep, previous.deps[n]))) effects.push(() => { previous?.cleanup?.(); slots[i] = { deps, cleanup: fn() }; }); },
  };
  const exports = {};
  const code = ts.transpileModule(readFileSync(new URL(`../components/explore/${file}.tsx`, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(code, { exports, require(name) {
    if (Object.hasOwn(dependencies, name)) return dependencies[name];
    if (name === "react") return react;
    if (name === "react/jsx-runtime") return jsx;
    if (name.endsWith(".css")) return styles;
    if (name === "react-dom") return { createPortal: (children, target) => ({ type: "portal", props: { children, target } }) };
    if (name === "@/worker/src/lib/explore-format-edit") return formatEdit;
    if (name === "@/worker/src/lib/explore-emoji") return emoji;
    if (name === "@/components/ui/button") return { Button: "button" };
    if (name === "lucide-react") return new Proxy({}, { get: (_, name) => name });
    throw Error(`Unexpected import ${name}`);
  } });
  return { exports, render(fn) { cursor = 0; const tree = fn(); effects.splice(0).forEach(fn => fn()); return tree; },
    unmount() { for (const slot of slots) slot?.cleanup?.(); } };
}
const labelled = (tree, label) => nodes(tree).find(node => node.props?.["aria-label"] === label);

test("preview uses colored artwork for cross/arrow/check while retaining emoji and authored text", () => {
  const h = harness("format-video-text-overlay");
  const text = { value: "Features ❌\nMarketing ✅ → ✔️ 😂", width: .9, y: .18, fontSize: 64, color: "#ffffff", startMs: 0, endMs: 2000, font: "inter", fontWeight: 700 };
  const tree = h.render(() => h.exports.FormatVideoTextOverlay({ text, width: 1080, height: 1920, label: "Caption" }));
  const symbols = nodes(tree).filter(node => node.props?.["data-format-inline-symbol"]);
  assert.deepEqual(symbols.map(node => node.props["data-format-inline-symbol"]), ["cross", "check-box", "arrow-right", "check"]);
  assert.equal(nodes(symbols[0]).find(node => node.type === "path").props.fill, "#e53935");
  assert.equal(nodes(symbols[1]).find(node => node.type === "path").props.fill, "#22a447");
  assert.ok(nodes(tree).some(node => node.type === "image" && node.props["aria-label"] === "😂" && node.props.href === emoji.exploreEmojiUrl("1f602")));
  assert.equal(text.value, "Features ❌\nMarketing ✅ → ✔️ 😂"); h.unmount();
});


test("preview text drags in both axes at display scale, clamps, and stops on release or cancellation", () => {
  const h = harness("format-video-text-overlay");
  let text = { value: "Move me", width: .8, y: .18, fontSize: 48, color: "#ffffff", startMs: 0, endMs: 2000 };
  const original = { ...text }, changes = []; let paused = 0, captured = null;
  const target = { ownerSVGElement: { getBoundingClientRect: () => ({ width: 270, height: 480 }) }, focus() {},
    setPointerCapture(id) { captured = id; }, hasPointerCapture(id) { return captured === id; }, releasePointerCapture() { captured = null; } };
  const event = (x, y, id = 7) => ({ pointerId: id, button: 0, clientX: x, clientY: y, currentTarget: target, preventDefault() {}, stopPropagation() {} });
  const render = (editable = true) => h.render(() => h.exports.FormatVideoTextOverlay({ text, width: 1080, height: 1920, label: "Caption",
    onMoveStart: () => paused++, onChange: editable ? next => { text = next; changes.push(next); } : undefined }));
  let handle = labelled(render(), "Move Caption");
  handle.props.onPointerDown(event(100, 100)); assert.equal(captured, 7); assert.equal(paused, 1);
  handle.props.onPointerMove(event(127, 148, 8)); assert.equal(changes.length, 0, "Ignore another finger");
  handle.props.onPointerMove(event(127, 148)); assert.equal(text.x, .6); assert.equal(text.y, .28);
  handle = labelled(render(), "Move Caption"); handle.props.onPointerMove(event(10000, 10000));
  const layout = formatEdit.formatTextLayout(text, 1080, 1920);
  assert.equal(layout.fits, true); assert.ok(layout.x + layout.textWidth / 2 <= 1080 * .97 + .001);
  handle.props.onPointerUp(event(127, 148)); assert.equal(captured, null);
  handle.props.onPointerMove(event(0, 0)); assert.equal(text.x, .6);
  handle = labelled(render(), "Move Caption"); handle.props.onPointerDown(event(127, 148));
  handle.props.onPointerMove(event(-10000, -10000)); assert.equal(text.y, .03);
  handle.props.onPointerCancel(event(0, 0)); const count = changes.length;
  handle.props.onPointerMove(event(100, 100)); assert.equal(changes.length, count);
  assert.equal(text.value, original.value); assert.equal(text.startMs, original.startMs); assert.equal(text.endMs, original.endMs);
  assert.equal(labelled(render(false), "Move Caption"), undefined, "Read-only overview has no drag target");
});

test("bottom-edge drag clamping passes strict fit checks across fonts, presets and frame ratios", () => {
  for (const { id: font } of formatEdit.EXPLORE_TEXT_FONTS) for (const fontSize of [24, 48, 56, 64, 84])
    for (const preset of [undefined, "snapchat-classic"]) for (const [width, height] of [[1080,1920], [720,1280], [1920,1080], [640,360]]) {
      const text = { value: "Move this text\nSecond line", font, fontWeight: 700, width: .8, y: .18, fontSize, color: "#ffffff", startMs: 0, endMs: 2000, ...(preset ? { preset } : {}) };
      const moved = formatEdit.positionFormatText(text, 5, 5, width, height);
      assert.equal(formatEdit.formatTextLayout(moved, width, height).fits, true, JSON.stringify({ font, fontSize, preset, width, height }));
    }
});

test("keyboard preview positioning persists through strict draft parsing without changing legacy shapes", () => {
  const h = harness("format-video-text-overlay");
  let text = { value: "Keyboard text", font: "inter", fontWeight: 700, width: .8, y: .18, fontSize: 48, color: "#ffffff", startMs: 0, endMs: 2000 };
  const edit = () => ({ version: 1, format: "hook", trimStartMs: 0, trimEndMs: 2000, originalVolume: 1, musicVolume: .2, text });
  assert.equal(Object.hasOwn(formatEdit.parseExploreFormatEdit(edit()).text, "x"), false);
  const render = () => h.render(() => h.exports.FormatVideoTextOverlay({ text, width: 1080, height: 1920, label: "Caption", onChange: next => { text = next; } }));
  const key = (key, shiftKey = false) => ({ key, shiftKey, preventDefault() {}, stopPropagation() {} });
  labelled(render(), "Move Caption").props.onKeyDown(key("ArrowRight")); assert.equal(text.x, .505);
  labelled(render(), "Move Caption").props.onKeyDown(key("ArrowDown", true)); assert.ok(Math.abs(text.y - .23) < 1e-10);
  const saved = formatEdit.parseExploreFormatEdit(JSON.parse(JSON.stringify(edit())));
  assert.equal(saved.text.x, text.x); assert.equal(saved.text.y, text.y);
  assert.match(formatEdit.createFormatTextSvg(saved.text, 1080, 1920), /<text x="545.4"/);
  for (const x of [NaN, Infinity, -.1, 1.1, "0.4"]) assert.throws(() => formatEdit.parseExploreFormatEdit({ ...edit(), text: { ...text, x } }));
  const classic = formatEdit.positionFormatText({ ...text, preset: "snapchat-classic" }, .9, 2, 1080, 1920);
  assert.equal(formatEdit.formatTextLayout(classic, 1080, 1920).fits, true);
  assert.equal(formatEdit.formatTextLayout(classic, 1080, 1920).background.x, 0);
});

test("returning to the overview keeps local clip edits visible and never applies another clip's preview", () => {
  const imports = Object.fromEntries([
    "@/components/explore/workflow-scheduling-panel", "@/lib/explore/workflow-scheduling-draft", "@/components/explore/workflow-demo-controls",
    "@/lib/explore/sequence-preview", "@/lib/explore/reference-audio-preview", "@/lib/explore/workflow-default-music-client", "@/lib/firebase/auth",
  ].map(name => [name, {}]));
  const h = harness("workflow-edit-workspace", { ...imports,
    "@/components/explore/hook-workflow-media-controls": { WorkflowMediaPlayer: "media-player", WorkflowFilePicker: "file-picker" },
    "@/components/explore/workflow-sequence-preview": { WorkflowSequencePreview: "sequence-preview" } });
  const preview = { segment: { id: "local-opening", url: "blob:opening", editing: { trimStartMs: 500, trimEndMs: 2500, text: "Current text" } } };
  const props = { kind: "hook", sourcePreview: { url: "blob:opening" }, openingPreview: preview, demo: {}, demoAudio: {} };
  let tree = h.exports.WorkflowEditWorkspace(props);
  const segments = nodes(tree).find(node => node.type === "sequence-preview").props.segments;
  assert.equal(segments.length, 1); assert.equal(segments[0], preview.segment);
  tree = h.exports.WorkflowEditWorkspace({ ...props, sourcePreview: { url: "blob:replacement" } });
  assert.equal(nodes(tree).some(node => node.type === "sequence-preview"), false);
  assert.equal(nodes(tree).find(node => node.type === "media-player").props.asset.url, "blob:replacement");
  tree = h.exports.WorkflowEditWorkspace({ ...props, generatedVideo: { id: "different-owned-clip" } });
  assert.equal(nodes(tree).some(node => node.type === "sequence-preview"), false, "Owned identity takes priority over a local URL");
});

test("overview source changes remain distinct from edits, including restored demo previews and empty openings", () => {
  const imports = Object.fromEntries([
    "@/components/explore/workflow-scheduling-panel", "@/lib/explore/workflow-scheduling-draft", "@/components/explore/workflow-demo-controls",
    "@/lib/explore/sequence-preview", "@/lib/explore/reference-audio-preview", "@/lib/explore/workflow-default-music-client", "@/lib/firebase/auth",
  ].map(name => [name, {}]));
  const h = harness("workflow-edit-workspace", { ...imports,
    "@/components/explore/hook-workflow-media-controls": { WorkflowMediaPlayer: "media-player", WorkflowFilePicker: "file-picker" },
    "@/components/explore/workflow-sequence-preview": { WorkflowSequencePreview: "sequence-preview" } });
  const calls = [], demo = { asset: null, choose: file => calls.push(file), remove() {} };
  const props = { kind: "hook", demo, demoAudio: {}, demoPreview: { name: "Restored demo", url: "/saved-demo.mp4" },
    sourcePreview: { name: "Uploaded hook", url: "blob:hook" }, onChangeSource: () => calls.push("change"), onEditSource: () => calls.push("edit") };
  const tree = h.exports.WorkflowEditWorkspace(props);
  labelled(tree, "Change hook video").props.onClick();
  nodes(tree).find(node => node.type === "button" && JSON.stringify(node.props.children).includes("Edit hook video")).props.onClick();
  const picker = nodes(tree).find(node => node.type === "file-picker");
  assert.equal(picker.props.label, "Replace demo video"); assert.equal(picker.props.buttonLabel, "Change");
  assert.equal(picker.props.attachment, demo, "Restored media still has the real replacement attachment");
  assert.deepEqual(calls, ["change", "edit"]);
  const empty = h.exports.WorkflowEditWorkspace({ ...props, sourcePreview: null });
  const add = nodes(empty).find(node => node.type === "button" && [node.props.children].flat().join("") === "Add hook video");
  assert.ok(add); add.props.onClick(); assert.equal(calls.at(-1), "change");
  assert.equal(labelled(empty, "Change hook video"), undefined, "Empty opening offers Add, not Change");
  for (const label of ["Hook video segment", "Demo segment"]) {
    assert.ok(nodes(labelled(empty, label)).filter(node => node.type === "h3").every(node => !JSON.stringify(node.props.children).includes("Optional")));
  }
});

test("dragging a trim handle uses the source timeline, clamps to a one-second clip, and stops on cancellation", () => {
  const h = harness("clip-trim-timeline"), changes = [];
  const props = { durationMs: 10000, startMs: 2000, endMs: 8000, onChange: (...value) => changes.push(value) };
  const tree = h.render(() => h.exports.ClipTrimTimeline(props));
  const track = nodes(tree).find(node => node.props?.onPointerDown);
  let captured, focused;
  track.props.ref.current = { getBoundingClientRect: () => ({ left: 100, width: 1000 }) };
  const event = (x, handle) => ({ clientX: x, button: 0, pointerId: 4, preventDefault() {},
    target: { closest: () => handle ? { dataset: { trimHandle: handle } } : null },
    currentTarget: { setPointerCapture: id => { captured = id; }, querySelector: selector => ({ focus: () => { focused = selector; } }) } });
  track.props.onPointerDown(event(300, "start"));
  track.props.onPointerMove(event(150));
  assert.deepEqual(changes.at(-1), [500, 8000]); assert.equal(captured, 4); assert.match(focused, /start/);
  track.props.onPointerMove(event(2000)); assert.deepEqual(changes.at(-1), [7000, 8000]);
  track.props.onPointerCancel(); const count = changes.length;
  track.props.onPointerMove(event(100)); assert.equal(changes.length, count);
  track.props.onPointerDown(event(900, "end")); track.props.onPointerMove(event(-100));
  assert.deepEqual(changes.at(-1), [2000, 3000]);
});

test("trim handles support keyboard steps and endpoints and cannot change a saving clip", () => {
  const h = harness("clip-trim-timeline"), changes = [];
  const props = { durationMs: 10000, startMs: 2000, endMs: 8000, onChange: (...value) => changes.push(value) };
  const tree = h.render(() => h.exports.ClipTrimTimeline(props));
  const event = (key, shiftKey = false) => ({ key, shiftKey, preventDefault() {} });
  labelled(tree, "Trim end handle").props.onKeyDown(event("ArrowLeft")); assert.deepEqual(changes.at(-1), [2000, 7900]);
  labelled(tree, "Trim start handle").props.onKeyDown(event("ArrowRight", true)); assert.deepEqual(changes.at(-1), [3000, 8000]);
  labelled(tree, "Trim start handle").props.onKeyDown(event("Home")); assert.deepEqual(changes.at(-1), [0, 8000]);
  labelled(tree, "Trim end handle").props.onKeyDown(event("End")); assert.deepEqual(changes.at(-1), [2000, 10000]);
  const disabled = h.render(() => h.exports.ClipTrimTimeline({ ...props, disabled: true })), count = changes.length;
  labelled(disabled, "Trim end handle").props.onKeyDown(event("ArrowLeft"));
  nodes(disabled).find(node => node.props?.onPointerDown).props.onPointerDown({});
  assert.equal(changes.length, count); assert.equal(labelled(disabled, "Trim end handle").props.tabIndex, -1);
});

test("preview playback seeks inside the selected trim and releases media listeners on closing", async () => {
  const h = harness("clip-preview-controls"), listeners = new Map(), seeks = [], mutes = [];
  const video = { paused: true, currentTime: 7.95, addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: name => listeners.delete(name), pause() { this.paused = true; listeners.get("pause")(); },
    play() { this.paused = false; listeners.get("play")(); return Promise.resolve(); } };
  const props = { player: { current: video }, startMs: 2000, endMs: 8000, timeMs: 1000,
    onSeek: ms => { seeks.push(ms); video.currentTime = (2000 + ms) / 1000; }, onMute: muted => mutes.push(muted) };
  const render = () => h.render(() => h.exports.ClipPreviewControls(props));
  let tree = render();
  labelled(tree, "Play preview").props.onClick(); await Promise.resolve(); assert.equal(seeks[0], 0);
  tree = render(); assert.ok(labelled(tree, "Pause preview"));
  labelled(tree, "Pause preview").props.onClick(); assert.equal(video.paused, true);
  labelled(tree, "Preview playback position").props.onChange({ target: { value: "6000" } });
  assert.equal(seeks.at(-1), 5950); assert.equal(video.currentTime, 7.95);
  labelled(tree, "Mute preview").props.onClick(); tree = render(); assert.equal(mutes.at(-1), true);
  labelled(tree, "Unmute preview").props.onClick(); assert.equal(mutes.at(-1), false);
  assert.equal(labelled(tree, "Preview playback position").props.max, 6000);
  h.unmount(); assert.equal(listeners.size, 0);
});

test("preview playback and unavailable fullscreen failures give an actionable message", async () => {
  const h = harness("clip-preview-controls");
  const props = { player: { current: { paused: true, currentTime: 0, addEventListener() {}, removeEventListener() {}, play: () => Promise.reject(Error("blocked")) } },
    startMs: 0, endMs: 3000, timeMs: 0, onSeek() {}, onMute() {} };
  const render = () => h.render(() => h.exports.ClipPreviewControls(props));
  labelled(render(), "Play preview").props.onClick(); await Promise.resolve();
  assert.match(nodes(render()).find(n => n.props?.role === "alert").props.children, /Try again/);
  labelled(render(), "Fullscreen preview").props.onClick();
  assert.match(nodes(render()).find(n => n.props?.role === "alert").props.children, /Fullscreen is unavailable/);
  let fullscreenCalls = 0;
  props.player.current.closest = () => ({ requestFullscreen: () => { fullscreenCalls++; return Promise.resolve(); } });
  labelled(render(), "Fullscreen preview").props.onClick(); await Promise.resolve();
  assert.equal(fullscreenCalls, 1, "Fullscreen includes the preview section and its playback controls");
});

test("changing a timed text block outside its visible range seeks into that block before styling", () => {
  const h = harness("format-text-overlays-editor"), seeks = [], updates = [];
  const overlay = { value: "Old text", width: .8, y: .18, fontSize: 48, color: "#ffffff", startMs: 1500, endMs: 3000 };
  const props = { overlays: [overlay], durationMs: 5000, timeMs: 0, onChange: value => updates.push(value), onSeek: ms => seeks.push(ms) };
  let tree = h.render(() => h.exports.FormatTextOverlaysEditor(props));
  labelled(tree, "Overlay text").props.onChange({ target: { value: "Visible now" } });
  assert.equal(seeks.at(-1), 1500); assert.equal(updates.at(-1)[0].value, "Visible now");
  tree = h.render(() => h.exports.FormatTextOverlaysEditor({ ...props, timeMs: 4000 }));
  labelled(tree, "Text color").props.onChange({ target: { value: "#ff0000" } }); assert.equal(seeks.at(-1), 1500);
  labelled(tree, "Text preset").props.onChange({ target: { value: "snapchat-classic" } }); assert.equal(updates.at(-1)[0].preset, "snapchat-classic");
  tree = h.render(() => h.exports.FormatTextOverlaysEditor({ ...props, timeMs: 2000 })); const count = seeks.length;
  labelled(tree, "Text size").props.onChange({ target: { value: "56" } }); assert.equal(seeks.length, count, "Already visible text keeps the current frame");
});

test("shared video preset dropdown switches Snapchat Classic back to Bold white and survives save/reopen", () => {
  for (const format of ["hook", "wall_text"]) for (const font of [undefined, "inter"]) {
    const h = harness("format-text-overlays-editor");
    const original = { value: "Keep this exact copy", width: .8, y: .18, fontSize: 48, color: "#ffffff", startMs: format === "wall_text" ? 0 : 1000, endMs: 5000, ...(font ? { font, fontWeight: 700 } : {}) };
    const neighbor = { ...original, value: "Another block", color: "#ff0000" };
    let editing = { version: 1, format, trimStartMs: 0, trimEndMs: 5000, originalVolume: 1, musicVolume: .2, text: null, textOverlays: [original, neighbor] };
    const render = () => h.render(() => h.exports.FormatTextOverlaysEditor({ overlays: editing.textOverlays, wallText: format === "wall_text", durationMs: 5000, timeMs: 2000, onSeek() {}, onChange: textOverlays => { editing = formatEdit.parseExploreFormatEdit({ ...editing, textOverlays }); } }));
    for (let cycle = 0; cycle < 2; cycle++) {
      labelled(render(), "Text preset").props.onChange({ target: { value: "snapchat-classic" } });
      assert.equal(labelled(render(), "Text preset").props.value, "snapchat-classic");
      labelled(render(), "Caption background opacity").props.onChange({ target: { value: "35" } });
      assert.match(formatEdit.createFormatTextSvg(editing.textOverlays[0], 1080, 1920), /<rect/);
      labelled(render(), "Text preset").props.onChange({ target: { value: "bold" } });
      assert.equal(labelled(render(), "Text preset").props.value, "bold");
      const bold = editing.textOverlays[0];
      assert.equal(Object.hasOwn(bold, "backgroundOpacity"), false);
      assert.equal(bold.preset, undefined);
      assert.equal(bold.font, font);
      assert.equal(labelled(render(), "Text weight").props.value, 700);
      assert.equal(bold.value, original.value); assert.equal(bold.startMs, original.startMs); assert.equal(bold.endMs, original.endMs);
      assert.deepEqual(editing.textOverlays[1], neighbor);
      assert.doesNotMatch(formatEdit.createFormatTextSvg(bold, 1080, 1920), /<rect/);
      editing = formatEdit.parseExploreFormatEdit(JSON.parse(JSON.stringify(editing)));
      assert.equal(labelled(render(), "Text preset").props.value, "bold");
    }
  }
});

test("single Hook text explains automatic timing; adding another block returns to timed controls", () => {
  const h = harness("format-text-overlays-editor");
  let overlays = [{ value: "Hook text", width: .8, y: .18, fontSize: 48, color: "#ffffff", startMs: 0, endMs: 3000 }];
  const render = () => h.render(() => h.exports.FormatTextOverlaysEditor({ overlays, durationMs: 3000, fullDuration: overlays.length === 1, onChange: next => { overlays = next; }, onSeek() {} }));
  let tree = render(); assert.equal(labelled(tree, "Text start time"), undefined);
  assert.ok(JSON.stringify(tree).includes("Its timing follows your trim"));
  nodes(tree).find(n => n.type === "button" && n.props.children === "Add text").props.onClick();
  tree = render(); assert.ok(labelled(tree, "Text start time")); assert.ok(labelled(tree, "Text end time"));
  labelled(tree, "Text start time").props.onChange({ target: { value: "1" } });
  assert.equal(overlays[1].startMs, 1000);
});

test("Wall manual text hides timing and style until advanced mode while keeping full-duration blocks", () => {
  const h = harness("format-text-overlays-editor"), updates = [];
  const overlay = { value: "Wall message", width: .8, y: .18, fontSize: 48, color: "#ffffff", startMs: 0, endMs: 5000 };
  const props = { overlays: [overlay], wallText: true, showStyleControls: false, durationMs: 5000, timeMs: 3000, onChange: value => updates.push(value), onSeek() {} };
  let tree = h.render(() => h.exports.FormatTextOverlaysEditor(props));
  assert.ok(labelled(tree, "Wall of text"));
  assert.equal(labelled(tree, "Text start time"), undefined); assert.equal(labelled(tree, "Text end time"), undefined);
  assert.equal(labelled(tree, "Text preset"), undefined);
  assert.equal(JSON.stringify(tree).includes("Each text block has its own timing"), false);
  assert.equal(JSON.stringify(tree).includes("0–5s"), false);
  labelled(tree, "Wall of text").props.onChange({ target: { value: "Updated wall" } });
  assert.equal(updates.at(-1)[0].value, "Updated wall");
  nodes(tree).find(n => n.type === "button" && n.props.children === "Add text").props.onClick();
  assert.equal(updates.at(-1)[1].startMs, 0); assert.equal(updates.at(-1)[1].endMs, 5000);
  tree = h.render(() => h.exports.FormatTextOverlaysEditor({ ...props, showStyleControls: true }));
  assert.ok(labelled(tree, "Text preset"));
  assert.equal(labelled(tree, "Text start time"), undefined, "Advanced Wall also keeps text for the whole clip");
});

test("font and weight controls preserve text/timing/position, support old drafts, and default new text to Inter Bold", () => {
  const h = harness("format-text-overlays-editor"), updates = [];
  const text = { value: "Existing message", width: .7, y: .4, fontSize: 42, color: "#ff00ff", startMs: 1000, endMs: 3000 };
  const props = { overlays: [text], durationMs: 5000, timeMs: 1500, onChange: next => updates.push(next), onSeek() {} };
  let tree = h.render(() => h.exports.FormatTextOverlaysEditor(props));
  assert.equal(labelled(tree, "Text font").props.value, ""); assert.equal(labelled(tree, "Text weight").props.value, 700);
  for (const { id } of formatEdit.EXPLORE_TEXT_FONTS) {
    labelled(tree, "Text font").props.onChange({ target: { value: id } });
    assert.deepEqual(JSON.parse(JSON.stringify(updates.at(-1)[0])), { ...text, font: id });
  }
  tree = h.render(() => h.exports.FormatTextOverlaysEditor({ ...props, overlays: [{ ...text, font: "dmsans", fontWeight: 700 }] }));
  labelled(tree, "Text weight").props.onChange({ target: { value: "500" } });
  assert.deepEqual(JSON.parse(JSON.stringify(updates.at(-1)[0])), { ...text, font: "dmsans", fontWeight: 500 });
  tree = h.render(() => h.exports.FormatTextOverlaysEditor({ ...props, overlays: [] }));
  assert.equal(labelled(tree, "Text font").props.value, "inter"); assert.equal(labelled(tree, "Text weight").props.value, 700);
  labelled(tree, "Overlay text").props.onChange({ target: { value: "New hook" } });
  assert.equal(updates.at(-1)[0].font, "inter"); assert.equal(updates.at(-1)[0].fontWeight, 700);
});
