import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";
import ffmpeg from "ffmpeg-static";
import ffprobe from "ffprobe-static";
import { finishExploreVideo } from "../worker/dist/lib/explore-video-finishing.js";
import { parseExploreFormatEdit, formatTextLayout } from "../worker/dist/lib/explore-format-edit.js";
import { parseExploreFinishDraft } from "../worker/dist/lib/explore-finishing-contract.js";

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
