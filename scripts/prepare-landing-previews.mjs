import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, copyFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import ffmpeg from "ffmpeg-static";
import ffprobe from "ffprobe-static";

// Offline preparation only. Originals and their existing public URLs stay intact.
const output = "public/marketing/previews";
mkdirSync(output, { recursive: true });
mkdirSync(".tmp", { recursive: true });
const staging = mkdtempSync(path.resolve(".tmp/landing-previews-"));
const manifest = {};
for (const [id, source] of Object.entries({
  talkingHead: "public/marketing/showcase/hero-restored/left_side-v3.mp4",
  hookDemo: "landing_page/middle (online-video-cutter.com).mp4",
})) {
  const encoded = path.join(staging, `${id}.mp4`);
  execFileSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-nostdin", "-y",
    "-i", source, "-map", "0:v:0", "-an", "-map_metadata", "-1",
    "-vf", "scale=w='min(640,iw)':h=-2:flags=lanczos", "-c:v", "libx264",
    "-preset", "slow", "-crf", "26", "-pix_fmt", "yuv420p", "-threads", "2",
    "-movflags", "+faststart", encoded], { windowsHide: true, stdio: "inherit" });
  // Decode every frame, not just the MP4 header, before admitting the output.
  execFileSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-xerror", "-i", encoded,
    "-map", "0:v:0", "-f", "null", "-"], { windowsHide: true, stdio: "inherit" });
  const bytes = readFileSync(encoded);
  const hash = createHash("sha256").update(bytes).digest("hex");
  const name = `${id}.${hash.slice(0, 16)}.mp4`;
  copyFileSync(encoded, path.join(output, name));
  const probe = JSON.parse(execFileSync(ffprobe.path, ["-v", "error", "-show_streams", "-show_format", "-of", "json", encoded], { windowsHide: true, encoding: "utf8" }));
  const stream = probe.streams.find(item => item.codec_type === "video");
  manifest[id] = { src: `/marketing/previews/${name}`, bytes: bytes.length };
  console.log(JSON.stringify({ id, sourceBytes: readFileSync(source).length, ...manifest[id],
    width: stream.width, height: stream.height, duration: probe.format.duration, sha256: hash }));
}
mkdirSync("lib/marketing", { recursive: true });
writeFileSync("lib/marketing/landing-preview-assets.json", `${JSON.stringify(manifest, null, 2)}\n`);
