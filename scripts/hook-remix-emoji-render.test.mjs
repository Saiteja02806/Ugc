import assert from "node:assert/strict";
import test from "node:test";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { join, resolve } from "node:path";
import sharp from "sharp";
import ffmpeg from "ffmpeg-static";
import ffprobe from "ffprobe-static";
import { applyVideoTextRemix } from "../lib/explore/remix-text-edit.ts";
import { readFormatEditDraft } from "../lib/explore/format-edit-draft.ts";
import { finishExploreVideo } from "../worker/dist/lib/explore-video-finishing.js";

const tools = { ffmpeg, ffprobe: ffprobe.path, fontsDir: resolve("worker/src/assets/fonts") };
const source = {
  referenceId: "manual:hook", slideId: null, sourceSha256: "a".repeat(64),
  format: "hook", status: "ready", extractedAt: "2026-10-21T00:00:00Z",
  model: "fixture", notes: "User's reported two-line Hook caption",
  blocks: [{ text: "Hiring UGC creators ❌\nCreating UGC with AI ✅", startMs: 0, endMs: 1500 }],
};

function ink(bytes) {
  let red = 0, green = 0, white = 0;
  for (let i = 0; i < bytes.length; i += 3) {
    const [r, g, b] = bytes.subarray(i, i + 3);
    if (r > 140 && r > g * 1.6 && r > b * 1.6) red++;
    if (g > 95 && g > r * 1.5 && g > b * 1.3) green++;
    if (r > 200 && g > 200 && b > 200) white++;
  }
  return { red, green, white };
}

test("Add to hook preserves the reported emoji caption through draft recovery, clip export and final composition", async () => {
  await mkdir(resolve(".tmp"), { recursive: true });
  const dir = await mkdtemp(resolve(".tmp/hook-remix-emoji-"));
  const sourcePath = join(dir, "source.mp4");
  execFileSync(ffmpeg, ["-v", "error", "-f", "lavfi", "-i", "color=c=black:s=540x960:r=30:d=1.5",
    "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo", "-t", "1.5", "-c:v", "libx264",
    "-pix_fmt", "yuv420p", "-c:a", "aac", sourcePath], { windowsHide: true });
  const original = await readFile(sourcePath);
  const edit = { version: 1, format: "hook", trimStartMs: 0, trimEndMs: 1500, originalVolume: 1, musicVolume: .2, text: null };
  for (const [index, [cross, check]] of [["❌", "✅"], ["✖️", "☑️"], ["✗", "✓"], ["✘", "✔️"]].entries()) {
    const copy = `Hiring UGC creators ${cross}\nCreating UGC with AI ${check}`;
    const remixed = applyVideoTextRemix(edit, { blocks: [copy], heading: "", body: "" }, source);
    const restored = readFormatEditDraft(JSON.parse(JSON.stringify(remixed)));
    assert.equal(restored.textOverlays[0].value, copy);
    assert.equal(restored.textOverlays[0].font, "inter");
    assert.equal(restored.textOverlays[0].fontWeight, 700);
    for (const mode of ["clip", "composition"]) {
      const parent = join(dir, `${index}-${mode}`);
      await mkdir(parent);
      const result = await finishExploreVideo({ sourcePath, tools, workDir: join(parent, "final"),
        ...(mode === "clip" ? { editing: restored } : {
          demoPath: sourcePath,
          clipComposition: { version: 1, sourceEditing: restored, demoEditing: null, sourceAudioPlayback: "once" },
        }),
      });
      const frame = ms => execFileSync(ffmpeg, ["-v", "error", "-ss", String(ms / 1000), "-i", result.outputPath,
        "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1"], { windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
      const pixels = frame(600), colors = ink(pixels);
      assert.ok(colors.red > 40 && colors.green > 40 && colors.white > 100,
        `${cross}/${check} in ${mode}: require red cross, green tick and white caption in decoded MP4 pixels`);
      if (mode === "composition") assert.deepEqual(ink(frame(2100)), { red: 0, green: 0, white: 0 }, "Hook caption must not bleed into the demo");
      if (index === 0 && mode === "clip") {
        await sharp(pixels, { raw: { width: 540, height: 960, channels: 3 } }).extract({ left: 0, top: 140, width: 540, height: 180 })
          .png().toFile(join(dir, "corrected-caption.png"));
        await writeFile(join(dir, "evidence.json"), JSON.stringify({ copy, source: "synthetic local clip, no provider generation", output: result.outputPath, colors }, null, 2));
      }
    }
    assert.equal(restored.textOverlays[0].value, copy, "Rendering must not rewrite authored Unicode");
  }
  assert.deepEqual(await readFile(sourcePath), original);
  console.log(`Hook Remix emoji evidence: ${dir}`);
});
