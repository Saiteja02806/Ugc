import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import ffmpeg from "ffmpeg-static";
import ffprobe from "ffprobe-static";

const source = path.resolve(process.argv[2] ?? "landing_page/heeo_Section/left_side.mp4");
const destination = path.resolve("public/marketing/showcase/hero-restored");
const staging = path.resolve(".tmp/landing-hero-left");
mkdirSync(staging, { recursive: true });
mkdirSync(destination, { recursive: true });
const temporary = mkdtempSync(path.join(staging, "v2-"));
const name = "left_side-v2";
const hash = file => createHash("sha256").update(readFileSync(file)).digest("hex");
const probe = file => JSON.parse(execFileSync(ffprobe.path, ["-v", "error", "-show_streams", "-of", "json", file], { windowsHide: true, encoding: "utf8" }));
const run = args => execFileSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", ...args], { windowsHide: true, encoding: "utf8" });
const sourceHash = hash(source);
const original = probe(source).streams.find(stream => stream.codec_type === "video");
if (original?.codec_name !== "h264" || original.pix_fmt !== "yuv420p" || !Number.isFinite(Number(original.duration)) || Number(original.duration) <= 0) {
  throw new Error("Expected a valid browser-compatible H.264 source clip.");
}
const video = path.join(temporary, `${name}.mp4`);
// Remux only: retain all original frames and their encoded quality.
run(["-i", source, "-map", "0:v:0", "-c:v", "copy", "-an", "-movflags", "+faststart", video]);
const output = probe(video);
const stream = output.streams.find(item => item.codec_type === "video");
if (!stream || ["width", "height", "nb_frames", "duration"].some(key => stream[key] !== original[key]) || output.streams.some(item => item.codec_type === "audio")) {
  throw new Error("Prepared video does not match the complete original clip.");
}
const encodedHash = file => run(["-i", file, "-map", "0:v:0", "-c:v", "copy", "-f", "hash", "-hash", "sha256", "-"]).trim();
if (encodedHash(source) !== encodedHash(video)) throw new Error("Encoded video changed during preparation.");
run(["-xerror", "-i", video, "-f", "null", "-"]);
const bytes = readFileSync(video);
const moov = bytes.indexOf(Buffer.from("moov")), mdat = bytes.indexOf(Buffer.from("mdat"));
if (moov < 0 || mdat < 0 || moov > mdat) throw new Error("Fast-start metadata missing.");
const posterTime = 0;
run(["-ss", String(posterTime), "-i", video, "-frames:v", "1", "-c:v", "libwebp", "-quality", "88", path.join(temporary, `${name}.webp`)]);
if (hash(source) !== sourceHash) throw new Error("Original source changed during preparation.");
for (const extension of ["mp4", "webp"]) copyFileSync(path.join(temporary, `${name}.${extension}`), path.join(destination, `${name}.${extension}`));
writeFileSync(path.join(destination, `${name}.json`), JSON.stringify({
  source: path.relative(process.cwd(), source).replaceAll("\\", "/"), sourceSha256: sourceHash,
  width: stream.width, height: stream.height, duration: Number(stream.duration), frames: Number(stream.nb_frames),
  fps: stream.avg_frame_rate, bytes: bytes.length, sha256: hash(video), posterTime,
  silent: true, fastStart: true, fullDecodeVerified: true, encodedVideoUnchanged: true,
}, null, 2) + "\n");
console.log(`Prepared ${name}: ${stream.width}×${stream.height}, ${stream.duration}s, ${stream.nb_frames} unchanged video frames; source unchanged.`);
