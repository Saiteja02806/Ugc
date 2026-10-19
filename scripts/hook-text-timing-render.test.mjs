import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";
import ffmpeg from "ffmpeg-static";
import ffprobe from "ffprobe-static";
import { fullDurationSingleHookText } from "../lib/explore/hook-text-timing.ts";
import { readFormatEditDraft } from "../lib/explore/format-edit-draft.ts";
import { finishExploreVideo } from "../worker/dist/lib/explore-video-finishing.js";

test("an expanded single Hook stays visible in the final video; independent demo timing stays short", async () => {
  await mkdir(resolve(".tmp"), { recursive: true });
  const root = await mkdtemp(resolve(".tmp/hook-text-timing-render-")), sourcePath = join(root, "source.mp4");
  execFileSync(ffmpeg, ["-v", "error", "-f", "lavfi", "-i", "color=c=blue:s=360x640:r=30:d=3", "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo", "-t", "3", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", sourcePath], { windowsHide: true });
  const original = { version: 1, format: "hook", trimStartMs: 0, trimEndMs: 3000, originalVolume: 1, musicVolume: .2, text: null,
    textOverlays: [{ value: "My hook", font: "inter", fontWeight: 700, width: .8, y: .18, fontSize: 64, color: "#ffffff", startMs: 0, endMs: 3000 }] };
  const short = fullDurationSingleHookText({ ...original, trimEndMs: 1500 });
  const expanded = fullDurationSingleHookText({ ...short, trimEndMs: 3000 });
  const independent = { ...short, trimEndMs: 3000 };
  for (const [mode, editing] of [["hook", expanded], ["demo", independent]]) {
    const output = await finishExploreVideo({ sourcePath, editing: readFormatEditDraft(JSON.parse(JSON.stringify(editing))), workDir: join(root, mode),
      tools: { ffmpeg, ffprobe: ffprobe.path, fontsDir: resolve("worker/src/assets/fonts") } });
    for (const at of [.1, 1.4, 1.6, 2.8]) {
      const frame = execFileSync(ffmpeg, ["-v", "error", "-ss", String(at), "-i", output.outputPath, "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1"], { windowsHide: true });
      let bright = 0; for (let i = 0; i < frame.length; i += 3) if (frame[i] > 200 && frame[i + 1] > 200 && frame[i + 2] > 200) bright++;
      assert.equal(bright > 80, mode === "hook" || at < 1.5, `${mode}: text visibility at ${at}s`);
    }
  }
});
