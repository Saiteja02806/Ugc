import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";
import ffmpeg from "ffmpeg-static";
import ffprobe from "ffprobe-static";
import { finishExploreVideo } from "../worker/dist/lib/explore-video-finishing.js";
import { applyFormatTextPreset, createFormatTextSvg, parseExploreFormatEdit, formatTextLayout, formatTextOverlays, MAX_FORMAT_TEXT_OVERLAYS } from "../worker/dist/lib/explore-format-edit.js";
import { parseExploreFinishDraft } from "../worker/dist/lib/explore-finishing-contract.js";
import { applyVideoTextRemix } from "../lib/explore/remix-text-edit.ts";

const edit = () => ({ version: 1, format: "wall_text", trimStartMs: 500, trimEndMs: 2500, originalVolume: 0, musicVolume: .2,
  text: { value: "First line\n\nSecond paragraph", width: .8, y: .1, fontSize: 48, color: "#ffffff", startMs: 0, endMs: 1000 } });
test("manual text keeps explicit lines and blank paragraphs, and rejects overflow", () => {
  const draft = parseExploreFormatEdit(edit());
  const layout = formatTextLayout(draft.text, 1080, 1920);
  assert.deepEqual(layout.lines, ["First line", "", "Second paragraph"]);
  assert.equal(layout.fits, true);
  assert.equal(formatTextLayout({ ...draft.text, value: "paragraph\n".repeat(40), y: .8 }, 1080, 1920).fits, false);
  assert.equal(formatTextLayout({ ...draft.text, value: "averylongunspacedword".repeat(8), width: .4 }, 1080, 1920).lines.join("").replaceAll(" ", ""), "averylongunspacedword".repeat(8));
});
test("trim and text timing are bounded, format editing never allows subtitles or appended demos", () => {
  for (const patch of [{ trimStartMs: -1 }, { trimEndMs: 700 }, { originalVolume: 2 }, { text: { ...edit().text, value: "\0unsafe" } }, { text: { ...edit().text, endMs: 2100 } }]) assert.throws(() => parseExploreFormatEdit({ ...edit(), ...patch }));
  const draft = { version: 1, kind: "hook", sourceAssetId: "00000000-0000-4000-8000-000000000001", demoAssetId: null, demoAudioAssetId: null, demoAudioPlayback: "once", backgroundAssetId: null, backgroundPlayback: "once", subtitles: null };
  assert.equal(Object.hasOwn(parseExploreFinishDraft(draft), "editing"), false);
  assert.deepEqual(parseExploreFinishDraft({ ...draft, editing: edit() }).editing, edit());
  assert.throws(() => parseExploreFinishDraft({ ...draft, editing: edit(), subtitles: { language: "en", style: "clean" } }), /no subtitles/);
  assert.throws(() => parseExploreFinishDraft({ ...draft, editing: edit(), kind: "phone" }), /one video/);
});

test("multiple text blocks retain independent styles and timing without changing legacy drafts", () => {
  const legacy = edit();
  assert.deepEqual(parseExploreFormatEdit(legacy), legacy);
  assert.equal(Object.hasOwn(parseExploreFormatEdit(legacy), "textOverlays"), false);
  const texts = [
    { ...legacy.text, value: "First message", endMs: 800, color: "#ff0000" },
    { ...legacy.text, value: "Second message", startMs: 1000, endMs: 1900, color: "#00ff00" },
  ];
  const parsed = parseExploreFormatEdit({ ...legacy, text: null, textOverlays: texts });
  assert.deepEqual(formatTextOverlays(parsed), texts);
  for (const textOverlays of [[...texts, { ...texts[0], endMs: 2001 }], Array.from({ length: MAX_FORMAT_TEXT_OVERLAYS + 1 }, () => texts[0])]) {
    assert.throws(() => parseExploreFormatEdit({ ...legacy, text: null, textOverlays }));
  }
  assert.throws(() => parseExploreFormatEdit({ ...legacy, textOverlays: texts }), /one supported text format/);
});

test("Snapchat Classic keeps a full-width translucent strip, regular type and complete wrapping", () => {
  const original = edit().text, classic = applyFormatTextPreset(original, "snapchat-classic");
  assert.equal(classic.value, original.value); assert.equal(classic.startMs, original.startMs); assert.equal(classic.endMs, original.endMs);
  const layout = formatTextLayout(classic, 1080, 1920);
  assert.equal(layout.fontWeight, 400); assert.equal(layout.background.width, 1080); assert.equal(layout.background.x, 0);
  assert.equal(layout.background.y, 144); assert.equal(layout.background.opacity, .58); assert.equal(layout.fontSize, 56);
  const markup = createFormatTextSvg({ ...classic, value: 'a < b & "quoted" 😭' }, 1080, 1920);
  assert.match(markup, /&lt;/); assert.match(markup, /&amp;/); assert.match(markup, /😭/); assert.doesNotMatch(markup, /stroke-width/);
  const reverted = applyFormatTextPreset(classic, "bold"); assert.equal(Object.hasOwn(reverted,"preset"),false); assert.equal(Object.hasOwn(reverted,"backgroundOpacity"),false);
  for(const patch of [{preset:"unknown"},{preset:"snapchat-classic",backgroundOpacity:1.1},{backgroundOpacity:.4}])assert.throws(()=>parseExploreFormatEdit({...edit(),text:{...original,...patch}}));
});

test("real caption export applies the full-width bar only during its interval, including emoji", async () => {
  await mkdir(resolve(".tmp"), { recursive: true });
  const dir = await mkdtemp(join(resolve(".tmp"), "explore-caption-render-")), sourcePath = join(dir, "source.mp4");
  execFileSync(ffmpeg, ["-hide_banner","-loglevel","error","-n","-f","lavfi","-i","color=c=blue:s=360x640:r=30:d=3","-f","lavfi","-i","anullsrc=r=48000:cl=stereo","-t","3","-c:v","libx264","-pix_fmt","yuv420p","-c:a","aac",sourcePath], { windowsHide:true });
  const text = { ...applyFormatTextPreset(edit().text,"snapchat-classic"), value:"Video editor era is over?!😭", startMs:200,endMs:1200 };
  const editing = { ...edit(),format:"hook",trimStartMs:0,trimEndMs:3000,text };
  const result = await finishExploreVideo({ sourcePath, editing, workDir:join(dir,"render"), tools:{ffmpeg,ffprobe:ffprobe.path,fontsDir:resolve("worker/src/assets/fonts")} });
  const frame = time=>execFileSync(ffmpeg,["-v","error","-ss",String(time),"-i",result.outputPath,"-frames:v","1","-vf","format=rgb24","-f","rawvideo","pipe:1"],{windowsHide:true,maxBuffer:4*1024*1024});
  const during=frame(.5),before=frame(.1),after=frame(1.5),layout=formatTextLayout(text,360,640);
  const stripY=Math.round(layout.background.y+3),blueAt=(buffer,x)=>buffer[(stripY*360+x)*3+2];
  for(const x of [2,357]){assert.ok(blueAt(during,x)<140,"bar spans both video edges");assert.ok(blueAt(before,x)>200);assert.ok(blueAt(after,x)>200);}
  let whites=0;for(let i=0;i<during.length;i+=3)if(during[i]>190&&during[i+1]>190&&during[i+2]>190)whites++;
  assert.ok(whites>80,"white caption text is present");
});

test("real export displays successive text blocks at their own times and preserves both in the draft", async () => {
  await mkdir(resolve(".tmp"), { recursive: true });
  const dir = await mkdtemp(join(resolve(".tmp"), "explore-text-sequence-"));
  const sourcePath = join(dir, "source.mp4");
  execFileSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-n", "-f", "lavfi", "-i", "color=c=blue:s=360x640:r=30:d=3", "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo", "-t", "3", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", sourcePath], { windowsHide: true });
  const legacy = edit();
  const editing = { ...legacy, text: null, textOverlays: [
    { ...legacy.text, value: "First message", color: "#ff0000", startMs: 100, endMs: 800 },
    { ...legacy.text, value: "Second message", color: "#00ff00", startMs: 1100, endMs: 1900 },
  ] };
  const result = await finishExploreVideo({ sourcePath, editing, workDir: join(dir, "render"), tools: { ffmpeg, ffprobe: ffprobe.path, fontsDir: resolve("worker/src/assets/fonts") } });
  const frame = time => execFileSync(ffmpeg, ["-v", "error", "-ss", String(time), "-i", result.outputPath, "-frames:v", "1", "-vf", "format=rgb24", "-f", "rawvideo", "pipe:1"], { windowsHide: true, maxBuffer: 4 * 1024 * 1024 });
  const colors = buffer => {
    const count = { red: 0, green: 0 };
    for (let i = 0; i < buffer.length; i += 3) {
      if (buffer[i] > 150 && buffer[i + 1] < 100 && buffer[i + 2] < 120) count.red++;
      if (buffer[i + 1] > 150 && buffer[i] < 100 && buffer[i + 2] < 120) count.green++;
    }
    return count;
  };
  const first = colors(frame(.4)), gap = colors(frame(.95)), second = colors(frame(1.5));
  assert.ok(first.red > 100); assert.equal(first.green, 0);
  assert.deepEqual(gap, { red: 0, green: 0 });
  assert.ok(second.green > 100); assert.equal(second.red, 0);
});
test("mixed caption presets keep their preview stacking order in the real export", async () => {
  await mkdir(resolve(".tmp"), { recursive: true });
  const dir = await mkdtemp(join(resolve(".tmp"), "explore-caption-layers-")), sourcePath = join(dir, "source.mp4");
  execFileSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-n", "-f", "lavfi", "-i", "color=c=blue:s=360x640:r=30:d=2", "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo", "-t", "2", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", sourcePath], { windowsHide: true });
  const bold = { ...edit().text, value: "STACK", color: "#ff0000", startMs: 0, endMs: 1500 };
  const classic = { ...applyFormatTextPreset(bold, "snapchat-classic"), value: "bar", y: bold.y, backgroundOpacity: 1 };
  const redPixels = async (textOverlays, name) => {
    const result = await finishExploreVideo({ sourcePath, editing: { ...edit(), trimStartMs: 0, trimEndMs: 2000, text: null, textOverlays }, workDir: join(dir, name), tools: { ffmpeg, ffprobe: ffprobe.path, fontsDir: resolve("worker/src/assets/fonts") } });
    const frame = execFileSync(ffmpeg, ["-v", "error", "-ss", "0.5", "-i", result.outputPath, "-frames:v", "1", "-vf", "format=rgb24", "-f", "rawvideo", "pipe:1"], { windowsHide: true, maxBuffer: 4 * 1024 * 1024 });
    let count = 0;
    for (let i = 0; i < frame.length; i += 3) if (frame[i] > 150 && frame[i + 1] < 100 && frame[i + 2] < 120) count++;
    return count;
  };
  assert.equal(await redPixels([bold, classic], "bar-on-top"), 0, "later opaque bar covers earlier text");
  assert.ok(await redPixels([classic, bold], "bold-on-top") > 80, "later bold text appears over the bar");
});
test("real export trims video/audio together, respects text timing, mutes original sound, and preserves source bytes", async () => {
  await mkdir(resolve(".tmp"), { recursive: true });
  const dir = await mkdtemp(join(resolve(".tmp"), "explore-format-render-"));
  const sourcePath = join(dir, "source.mp4");
  execFileSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-n", "-f", "lavfi", "-i", "color=c=blue:s=360x640:r=30:d=3", "-f", "lavfi", "-i", "sine=frequency=440:duration=3", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", sourcePath], { windowsHide: true });
  const digest = async () => createHash("sha256").update(await readFile(sourcePath)).digest("hex");
  const before = await digest();
  const result = await finishExploreVideo({ sourcePath, editing: edit(), workDir: join(dir, "render"), tools: { ffmpeg, ffprobe: ffprobe.path, fontsDir: resolve("worker/src/assets/fonts") } });
  assert.ok(Math.abs(result.durationMs - 2000) < 50);
  assert.equal(result.subtitleStyle, null);
  assert.equal(await digest(), before);
  const audio = execFileSync(ffmpeg, ["-v", "error", "-i", result.outputPath, "-vn", "-ac", "1", "-ar", "16000", "-f", "f32le", "pipe:1"], { windowsHide: true });
  let energy = 0; for (let i = 0; i < audio.length; i += 4) energy += audio.readFloatLE(i) ** 2;
  assert.ok(energy / (audio.length / 4) < 1e-7, "Original sound is muted in the export");
  function frame(time) { return execFileSync(ffmpeg, ["-v", "error", "-ss", String(time), "-i", result.outputPath, "-frames:v", "1", "-vf", "format=rgb24", "-f", "rawvideo", "pipe:1"], { windowsHide: true, maxBuffer: 4 * 1024 * 1024 }); }
  const during = frame(.4), after = frame(1.5);
  const bright = buffer => { let pixels = 0; for (let i = 0; i < buffer.length; i += 3) if (buffer[i] > 190 && buffer[i + 1] > 190 && buffer[i + 2] > 190) pixels++; return pixels; };
  assert.ok(bright(during) > 100, "Text is present inside its time range");
  assert.equal(bright(after), 0, "Text is absent after its time range");
});

test("remixed hook text is rendered on the opening and disappears when the appended demo starts", async () => {
  await mkdir(resolve(".tmp"), { recursive: true });
  const dir = await mkdtemp(join(resolve(".tmp"), "remix-hook-demo-boundary-"));
  const sourcePath = join(dir, "hook.mp4"), demoPath = join(dir, "demo.mp4");
  for (const [path, color, seconds] of [[sourcePath, "blue", 3], [demoPath, "green", 2]]) {
    execFileSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-n", "-f", "lavfi", "-i", `color=c=${color}:s=360x640:r=30:d=${seconds}`, "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo", "-t", String(seconds), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", path], { windowsHide: true });
  }
  const source = { referenceId: "hook-reference", slideId: null, sourceSha256: "a".repeat(64), format: "hook", status: "ready", blocks: [{ text: "Original hook text", startMs: 0, endMs: 4000 }], extractedAt: "2026-10-11T12:00:00Z", model: "fixture", notes: "" };
  const editing = applyVideoTextRemix({ version: 1, format: "hook", trimStartMs: 0, trimEndMs: 3000, originalVolume: 1, musicVolume: .2, text: null }, { blocks: ["Our own business hook"], heading: "", body: "" }, source);
  const tools = { ffmpeg, ffprobe: ffprobe.path, fontsDir: resolve("worker/src/assets/fonts") };
  const hook = await finishExploreVideo({ sourcePath, editing, workDir: join(dir, "edited-hook"), tools });
  const sequence = await finishExploreVideo({ sourcePath: hook.outputPath, demoPath, workDir: join(dir, "sequence"), tools });
  assert.ok(Math.abs(sequence.durationMs - 5000) < 80);
  const bright = time => {
    const frame = execFileSync(ffmpeg, ["-v", "error", "-ss", String(time), "-i", sequence.outputPath, "-frames:v", "1", "-vf", "format=rgb24", "-f", "rawvideo", "pipe:1"], { windowsHide: true, maxBuffer: 4 * 1024 * 1024 });
    let pixels = 0; for (let i = 0; i < frame.length; i += 3) if (frame[i] > 190 && frame[i + 1] > 190 && frame[i + 2] > 190) pixels++;
    return pixels;
  };
  assert.ok(bright(.5) > 80, "Adapted copy is visible on the generated hook");
  assert.ok(bright(2.8) > 80, "Hook copy remains visible until its selected end");
  assert.equal(bright(3.1), 0, "Reference remix does not enter the demo");
  assert.equal(bright(4.5), 0, "Demo remains free of the hook's text");
});
