import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import ffmpeg from "ffmpeg-static";
import ffprobe from "ffprobe-static";

// Read the supplied originals; publish only verified, versioned cover assets.
const source = path.resolve(process.argv[2] ?? "landing_page/WOT");
const destination = path.resolve("public/explore/covers");
const staging = path.resolve(".tmp/explore-wall-text-cover");
for (const directory of [destination, staging]) {
  const relative = path.relative(source, directory);
  if (!relative || (!relative.startsWith("..") && !path.isAbsolute(relative))) {
    throw new Error("Outputs must stay outside the original source folder.");
  }
  mkdirSync(directory, { recursive: true });
}
const temporary = mkdtempSync(path.join(staging, "v3-"));
const NAME = "wall-of-text-v3", WIDTH = 960, HEIGHT = 540, FPS = 24, ZOOM_FRAMES = 8;
const hash = file => createHash("sha256").update(readFileSync(file)).digest("hex");
const run = args => execFileSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", ...args], { windowsHide: true, encoding: "utf8" });
const probe = file => JSON.parse(execFileSync(ffprobe.path, ["-v", "error", "-show_streams", "-of", "json", file], { windowsHide: true, encoding: "utf8" }));
const clips = [
  { file: "WOT_1-Vmake - Copy.mp4", focus: .56 },
  { file: "WOT_2-Vmake - Copy.mp4", focus: .50 },
].map(clip => {
  const input = path.join(source, clip.file);
  const stream = probe(input).streams.find(item => item.codec_type === "video");
  const duration = Number(stream?.duration);
  if (!Number.isFinite(duration) || duration <= 0) throw new Error(`Missing video duration: ${clip.file}`);
  return { ...clip, input, sourceDuration: duration, contentFrames: Math.ceil(duration * FPS), bytes: readFileSync(input).length, sha256: hash(input) };
});

const stages = clips.map((clip, index) => {
  const file = `${NAME}-${index}.mp4`;
  const crop = `scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=increase,crop=${WIDTH}:${HEIGHT}:0:max(0\\,min(ih-oh\\,ih*${clip.focus}-oh/2)),setsar=1`;
  // Same ending zoom as the older cover, after the full source clip has played.
  const zoom = `tpad=stop=${ZOOM_FRAMES}:stop_mode=clone,scale=1920:1080,zoompan=z='1+0.22*pow(max(0,min(1,(on-${clip.contentFrames}+1)/${ZOOM_FRAMES})),2)':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=1:s=${WIDTH}x${HEIGHT}:fps=${FPS}`;
  const frames = clip.contentFrames + ZOOM_FRAMES;
  run(["-i", clip.input, "-filter_threads", "2", "-vf", `fps=${FPS},tpad=stop=1:stop_mode=clone,trim=end_frame=${clip.contentFrames},setpts=PTS-STARTPTS,${crop},${zoom},format=yuv420p`,
    "-frames:v", String(frames), "-an", "-c:v", "libx264", "-preset", "fast", "-crf", "23", "-movflags", "+faststart", path.join(temporary, file)]);
  return { source: clip.file, file, focus: clip.focus, sourceDuration: clip.sourceDuration, contentFrames: clip.contentFrames, frames };
});
const list = path.join(temporary, "clips.txt");
writeFileSync(list, stages.map(stage => `file '${stage.file}'`).join("\n") + "\n");
const output = path.join(temporary, `${NAME}.mp4`);
run(["-f", "concat", "-safe", "1", "-i", list, "-c", "copy", "-an", "-movflags", "+faststart", output]);
const video = probe(output);
const stream = video.streams.find(item => item.codec_type === "video");
const frames = stages.reduce((count, stage) => count + stage.frames, 0);
if (stream?.width !== WIDTH || stream?.height !== HEIGHT || Number(stream.nb_frames) !== frames || video.streams.some(item => item.codec_type === "audio")) {
  throw new Error("Invalid cover dimensions, frame count or audio.");
}
const bytes = readFileSync(output);
const moov = bytes.indexOf(Buffer.from("moov")), mdat = bytes.indexOf(Buffer.from("mdat"));
if (moov < 0 || mdat < 0 || moov > mdat) throw new Error("Fast-start metadata missing.");
run(["-xerror", "-i", output, "-f", "null", "-"]);
const posterTime = 1;
run(["-ss", String(posterTime), "-i", output, "-frames:v", "1", "-c:v", "libwebp", "-quality", "88", path.join(temporary, `${NAME}.webp`)]);
for (const clip of clips) if (hash(clip.input) !== clip.sha256) throw new Error(`Original source changed: ${clip.file}`);
for (const extension of ["mp4", "webp"]) copyFileSync(path.join(temporary, `${NAME}.${extension}`), path.join(destination, `${NAME}.${extension}`));
writeFileSync(path.join(destination, `${NAME}.json`), JSON.stringify({
  version: 3, name: NAME, sourceFolder: path.relative(process.cwd(), source).replaceAll("\\", "/"),
  width: WIDTH, height: HEIGHT, fps: FPS, layout: "one example at a time, edge-to-edge crops", fullVideoDuration: true,
  zoomFrames: ZOOM_FRAMES, frames, duration: frames / FPS, bytes: bytes.length, sha256: hash(output),
  posterTime, silent: true, fastStart: true, fullDecodeVerified: true, stages,
  sources: clips.map(({ file, bytes, sha256 }) => ({ file, bytes, sha256 })),
}, null, 2) + "\n");
console.log(`Prepared ${NAME}: ${frames} frames, ${(frames / FPS).toFixed(2)}s, ${(bytes.length / 1024 / 1024).toFixed(2)} MiB; both original clips unchanged.`);
