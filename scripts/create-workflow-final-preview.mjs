import { mkdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import ffmpeg from "ffmpeg-static";

// A prepared, local-only visual fixture. No API, uploads or generation credits.
const root = fileURLToPath(new URL("../", import.meta.url));
await mkdir(new URL("../.tmp/", import.meta.url), { recursive: true });
const output = fileURLToPath(new URL("../.tmp/workflow-final-preview.mp4", import.meta.url));
const result = spawnSync(ffmpeg, [
  "-hide_banner", "-loglevel", "error", "-y",
  "-i", "public/marketing/showcase-part2/hook2-preview.mp4",
  "-i", "public/marketing/showcase-part2/demo-preview.mp4",
  "-f", "lavfi", "-t", "7.566667", "-i", "anullsrc=r=48000:cl=stereo",
  "-filter_complex", "[0:v]fps=30,setsar=1,setpts=PTS-STARTPTS[v0];[1:v]fps=30,setsar=1,setpts=PTS-STARTPTS[v1];[0:a]aresample=48000,aformat=channel_layouts=stereo,asetpts=PTS-STARTPTS[a0];[v0][a0][v1][2:a]concat=n=2:v=1:a=1[v][a]",
  "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-preset", "fast", "-crf", "24",
  "-pix_fmt", "yuv420p", "-c:a", "aac", "-movflags", "+faststart", output,
], { cwd: root, encoding: "utf8" });
if (result.error) throw result.error;
if (result.status !== 0) throw new Error(result.stderr || "Could not prepare the final-video fixture.");
console.log(output);
