import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import ffmpeg from "ffmpeg-static";
import ffprobe from "ffprobe-static";
import { defaultDemoEdit, readFormatDemoDraft, trimmedDemoFraming } from "../lib/explore/format-demo.ts";
import { canReuseUnchangedHookSource } from "../lib/explore/unchanged-hook-source.ts";
import { finishExploreVideo } from "../worker/dist/lib/explore-video-finishing.js";

const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const asset = n => ({ id: id(n), status: "ready", collection: "video", mimeType: "video/mp4", durationSeconds: 2, url: `/owned-${n}.mp4`, title: `Video ${n}` });
const draft = () => ({ version: 1, demoId: id(2), audioId: null, editing: { ...defaultDemoEdit(3), trimStartMs: 500, trimEndMs: 2500 }, framing: null, playback: "once" });

test("demo drafts reject arbitrary IDs and invalid timing before saving", () => {
  assert.deepEqual(readFormatDemoDraft(JSON.stringify(draft())), draft());
  for (const patch of [{ demoId: "https://external/video.mp4" }, { audioId: "other-account-file" }, { editing: { ...draft().editing, trimEndMs: 600 } }, { editing: { ...draft().editing, format: "wall_text" } }, { playback: "unknown" }, { backgroundMusic: "on" }]) assert.equal(readFormatDemoDraft(JSON.stringify({ ...draft(), ...patch })), null);
  assert.deepEqual(readFormatDemoDraft(JSON.stringify({ ...draft(), backgroundMusic: true })), { ...draft(), backgroundMusic: true });
  assert.equal(readFormatDemoDraft("invalid JSON"), null);
  const text = { value: "Demo heading", width: .8, y: .18, fontSize: 48, color: "#ffffff", startMs: 0, endMs: 2000 };
  const withText = { ...draft(), editing: { ...draft().editing, text } };
  assert.deepEqual(readFormatDemoDraft(JSON.stringify(withText)), withText);
  assert.equal(readFormatDemoDraft(JSON.stringify({ ...withText, editing: { ...withText.editing, text: { ...text, endMs: 9000 } } })), null);
});

test("demo framing preserves interpolated positions after a trim and removes discarded timestamps", () => {
  const framing = { version: 1, width: .4, height: 1, points: [[0, 0, 0], [1000, .2, 0], [2000, .6, 0], [3000, .2, 0]] };
  const actual = trimmedDemoFraming(framing, draft().editing);
  assert.deepEqual(actual.points.map(point => point[0]), [0, 500, 1500, 2000]);
  assert.ok(Math.abs(actual.points[0][1] - .1) < 1e-9);
  assert.ok(Math.abs(actual.points.at(-1)[1] - .4) < 1e-9);
  assert.equal(trimmedDemoFraming(null, draft().editing), null);
});

function coordinator({ audio = false, disabled = false } = {}) {
  const props = { ownerId: "owner", enabled: !disabled, format: "wall_text", save: { opening: asset(1), demo: asset(2), audio: audio ? { ...asset(4), collection: "audio" } : null, draft: { ...draft(), audioId: audio ? id(4) : null } } };
  const slots = [], effects = [], calls = [], reported = [], busy = [];
  const outputs = { prep: null, sound: null, join: null }, errors = { prep: null, sound: null, join: null };
  let cursor = 0;
  const react = {
    useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial }; },
    useEffect(fn, deps) { const i = cursor++, previous = slots[i]; if (!previous || deps.some((d, n) => !Object.is(d, previous[n]))) { slots[i] = deps; effects.push(fn); } },
  };
  const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }), Fragment: "fragment" };
  const imports = { react, "react/jsx-runtime": jsx, "react-dom": {}, "@tanstack/react-query": {}, "lucide-react": {},
    "@/lib/explore/format-demo": { trimmedDemoFraming, defaultDemoEdit },
    "@/lib/explore/unchanged-hook-source": { canReuseUnchangedHookSource },
    "@/components/explore/use-workflow-finishing": { DEFAULT_FINISHING_OPTIONS: { subtitles: false, style: "clean", backgroundMusic: false }, useWorkflowFinishing(input) {
      const name = input.scope.startsWith("format-demo-prep:") ? "prep" : input.scope.startsWith("format-demo-sound:") ? "sound" : "join";
      const output = outputs[name];
      const stageDisabled = !input.enabled || !input.source || !!input.demoFramingError;
      return { output, status: errors[name] ? { outcome: "failed" } : null, action: { disabled: stageDisabled, busy: false, error: errors[name], message: name, onAction: () => calls.push({ name, input }), refresh() {} } };
    } } };
  const exported = {};
  const code = ts.transpileModule(readFileSync(new URL("../components/explore/format-demo-section.tsx", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { exports: exported, require: name => imports[name] ?? new Proxy({}, { get: (_, key) => String(key) }) });
  return { props, calls, outputs, errors, reported, busy, render() { cursor = 0; const result = exported.DemoSaveRun({ ...props, onSaved: output => reported.push(output), onBusy: value => busy.push(value), onContinue() {} }); while (effects.length) effects.shift()(); return result; } };
}

test("pending opening replacement pauses new final-save stages and blocks retry/Continue", () => {
  const nodes = tree => Array.isArray(tree) ? tree.flatMap(nodes) : tree && typeof tree === "object" ? [tree, ...nodes(tree.props?.children)] : [];
  const h = coordinator(); h.props.pendingSource = true; h.render(); assert.equal(h.calls.length, 0);
  h.props.pendingSource = false; h.render(); assert.deepEqual(h.calls.map(call => call.name), ["prep"]);
  h.props.pendingSource = true; h.outputs.prep = asset(3); h.render(); assert.deepEqual(h.calls.map(call => call.name), ["prep"]);
  h.errors.join = "Failed"; const retry = nodes(h.render()).find(node => node.type === "Button" && node.props.children === "Retry final video");
  assert.equal(retry.props.disabled, true); retry.props.onClick(); assert.equal(h.calls.length, 1);
  h.props.pendingSource = false; h.errors.join = null; h.render(); assert.deepEqual(h.calls.map(call => call.name), ["prep", "join"]);
  h.outputs.join = asset(5); h.props.pendingSource = true;
  const next = nodes(h.render()).find(node => node.type === "Button" && node.props.children === "Continue to Schedule"); assert.equal(next.props.disabled, true);
});

test("save coordinator waits for owned preparation, joins the saved opening first and reports only the final video", () => {
  const h = coordinator(); h.render(); h.render();
  assert.deepEqual(h.calls.map(c => c.name), ["prep"]);
  h.outputs.prep = asset(3); h.render();
  assert.deepEqual(h.calls.map(c => c.name), ["prep", "join"]);
  assert.equal(h.calls[1].input.source.id, id(1)); assert.equal(h.calls[1].input.demoSource.id, id(3));
  assert.equal(h.calls[1].input.options.subtitles, false); assert.equal(h.reported.length, 0);
  h.outputs.join = asset(5); h.render();
  assert.equal(h.reported.at(-1).id, id(5)); assert.equal(h.busy.at(-1), false);
});

test("added demo audio starts after trimming and is prepared before the final join", () => {
  const h = coordinator({ audio: true });
  const overlay = { value: "Demo only", width: .8, y: .18, fontSize: 48, color: "#ffffff", startMs: 0, endMs: 2000 };
  h.props.save.draft.editing.text = overlay; h.render(); h.outputs.prep = asset(3); h.render();
  assert.deepEqual(h.calls.map(c => c.name), ["prep", "sound"]);
  assert.equal(h.calls[0].input.backgroundSource, undefined);
  assert.deepEqual(h.calls[0].input.editing.text, overlay);
  assert.equal(h.calls[1].input.editing.text, null, "Audio preparation must not draw the demo text a second time");
  assert.equal(h.calls[1].input.backgroundSource.id, id(4));
  assert.equal(h.calls[1].input.editing.trimStartMs, 0); assert.equal(h.calls[1].input.editing.trimEndMs, 2000);
  h.outputs.sound = asset(6); h.render();
  assert.equal(h.calls.at(-1).input.demoSource.id, id(6));
});

test("default background audio is added once to the final sequence after Demo preparation", () => {
  const h = coordinator(); h.props.save.draft.backgroundMusic = true; h.render();
  assert.deepEqual(h.calls.map(c => c.name), ["prep"]);
  assert.equal(h.calls[0].input.options.backgroundMusic, false);
  h.outputs.prep = asset(3); h.render();
  assert.deepEqual(h.calls.map(c => c.name), ["prep", "join"]);
  assert.equal(h.calls[1].input.options.backgroundMusic, true);
  assert.equal(h.calls[1].input.editing, undefined, "No post-music trimming offsets the soundtrack");
  assert.equal(h.calls[1].input.source.id, id(1)); assert.equal(h.calls[1].input.demoSource.id, id(3));
});

test("background audio can finish a saved opening without requiring a Demo or preparing an empty clip", () => {
  const h = coordinator(); h.props.save.demo = null; h.props.save.draft.demoId = null; h.props.save.draft.backgroundMusic = true;
  h.render(); h.render();
  assert.deepEqual(h.calls.map(c => c.name), ["join"]);
  assert.equal(h.calls[0].input.source.id, id(1)); assert.equal(h.calls[0].input.demoSource, null);
  assert.equal(h.calls[0].input.options.backgroundMusic, true);
  h.outputs.join = asset(5); h.render(); assert.equal(h.reported.at(-1).id, id(5));
  const preview = coordinator({ disabled: true }); preview.props.save.demo = null; preview.props.save.draft.backgroundMusic = true;
  preview.render(); assert.equal(preview.calls.length, 0);
});

test("preview and failed preparation cannot submit the final join", () => {
  const preview = coordinator({ disabled: true }); preview.render(); assert.equal(preview.calls.length, 0);
  const failed = coordinator(); failed.render(); failed.errors.prep = "Render failed"; failed.render();
  assert.deepEqual(failed.calls.map(c => c.name), ["prep"]); assert.equal(failed.reported.length, 0); assert.equal(failed.busy.at(-1), false);
});

test("an unchanged demo alone uses its owned output without a fake opening or second clip", () => {
  const h = coordinator(); h.props.save.opening = null;
  h.props.save.draft.editing = defaultDemoEdit(2);
  h.render(); h.render();
  assert.deepEqual(h.calls.map(c => c.name), ["join"]);
  assert.equal(h.calls[0].input.source.id, id(2));
  assert.equal(h.calls[0].input.demoSource, null);
  assert.equal(h.calls[0].input.reuseUnchangedSource, true);
  h.outputs.join = asset(2); h.render();
  assert.equal(h.reported.at(-1).id, id(2));
});

test("a demo alone keeps trim, text, audio and rebased crop, with no duplicate clip", () => {
  const h = coordinator({ audio: true }); h.props.save.opening = null;
  h.props.save.draft.framing = { version: 1, width: .5, height: .5, points: [[0, 0, 0], [3000, .5, .5]] };
  h.props.save.draft.editing.text = { value: "Demo only", width: .8, y: .18, fontSize: 48, color: "#ffffff", startMs: 0, endMs: 2000 };
  h.render(); h.outputs.prep = asset(3); h.render(); h.outputs.sound = asset(6); h.render();
  assert.deepEqual(h.calls.map(c => c.name), ["prep", "sound", "join"]);
  assert.equal(h.calls[0].input.editing.trimStartMs, 500);
  assert.equal(h.calls[1].input.editing.text, null);
  const join = h.calls.at(-1).input;
  assert.equal(join.source.id, id(6)); assert.equal(join.demoSource, null);
  assert.equal(join.demoFraming, null); assert.equal(join.editing, undefined);
  assert.deepEqual(JSON.parse(JSON.stringify(join.sourceFraming)), trimmedDemoFraming(h.props.save.draft.framing, h.props.save.draft.editing));
});

test("a non-MP4 demo alone is prepared even when no visible edits were made", () => {
  const h = coordinator(); h.props.save.opening = null;
  h.props.save.demo.mimeType = "video/quicktime"; h.props.save.draft.editing = defaultDemoEdit(2);
  h.render(); assert.deepEqual(h.calls.map(c => c.name), ["prep"]);
});

test("offline renderer joins an edited wall opening and trimmed demo, keeping text and added sound in their segments", async () => {
  const dir = mkdtempSync(join(resolve(".tmp"), "format-demo-render-"));
  const rawOpening = join(dir, "opening.mp4"), rawDemo = join(dir, "demo.mp4"), added = join(dir, "added.wav");
  const run = args => execFileSync(ffmpeg, ["-nostdin", "-v", "error", ...args], { windowsHide: true, timeout: 30000, maxBuffer: 8 * 1024 * 1024 });
  for (const [path, color, seconds, hz] of [[rawOpening, "blue", 2, 440], [rawDemo, "red", 3, 660]]) run(["-n", "-f", "lavfi", "-i", `color=c=${color}:s=360x640:r=30:d=${seconds}`, "-f", "lavfi", "-i", `sine=frequency=${hz}:duration=${seconds}`, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", path]);
  run(["-n", "-f", "lavfi", "-i", "sine=frequency=880:duration=2", added]);
  const tools = { ffmpeg, ffprobe: ffprobe.path, fontsDir: resolve("worker/src/assets/fonts") };
  const opening = await finishExploreVideo({ sourcePath: rawOpening, workDir: join(dir, "edited-opening"), tools, editing: { ...defaultDemoEdit(2), format: "wall_text", text: { value: "My own message", width: .8, y: .2, fontSize: 60, color: "#ffffff", startMs: 0, endMs: 2000 } } });
  const demo = await finishExploreVideo({ sourcePath: rawDemo, workDir: join(dir, "trimmed-demo"), tools, editing: { ...draft().editing, originalVolume: 0, text: { value: "Demo heading", width: .8, y: .2, fontSize: 60, color: "#ffffff", startMs: 500, endMs: 1000 } } });
  const sound = await finishExploreVideo({ sourcePath: demo.outputPath, backgroundMusicPath: added, backgroundPlayback: "once", workDir: join(dir, "demo-audio"), tools, editing: { ...defaultDemoEdit(2), musicVolume: 1 } });
  const final = await finishExploreVideo({ sourcePath: opening.outputPath, demoPath: sound.outputPath, workDir: join(dir, "final"), tools });
  assert.ok(Math.abs(final.durationMs - 4000) < 100); assert.equal(final.subtitleStyle, null);
  const frame = seconds => run(["-ss", String(seconds), "-i", final.outputPath, "-frames:v", "1", "-pix_fmt", "rgb24", "-f", "rawvideo", "pipe:1"]);
  const white = buffer => { let count = 0; for (let i = 0; i < buffer.length; i += 3) if (buffer[i] > 180 && buffer[i + 1] > 180 && buffer[i + 2] > 180) count++; return count; };
  assert.ok(white(frame(.8)) > 50, "Wall text appears in the opening");
  assert.equal(white(frame(2.2)), 0, "Opening text does not bleed onto the demo");
  assert.ok(white(frame(2.8)) > 50, "Demo text appears at its own selected time");
  assert.equal(white(frame(3.4)), 0, "Demo text ends at its own selected time");
  const samples = (start, seconds) => run(["-ss", String(start), "-t", String(seconds), "-i", final.outputPath, "-vn", "-ac", "1", "-ar", "16000", "-f", "f32le", "pipe:1"]);
  const power = (buffer, hz) => { let a = 0, b = 0; for (let i = 0; i < buffer.length / 4; i++) { const phase = 2 * Math.PI * hz * i / 16000, v = buffer.readFloatLE(i * 4); a += v * Math.cos(phase); b += v * Math.sin(phase); } return a * a + b * b; };
  const first = samples(.2, .5), second = samples(2.2, .5);
  assert.ok(power(first, 440) > power(first, 880) * 50, "Opening keeps its own audio");
  assert.ok(power(second, 880) > power(second, 660) * 50, "Demo uses the added audio with original muted");
});
