// Prepare a new, lossless streaming release. Never modify the input release.
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, openSync, closeSync, readSync, statSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import ffmpeg from "ffmpeg-static";

const { values } = parseArgs({
  options: {
    input: { type: "string", default: "public/try-ugcpilot/media" },
    output: { type: "string", default: ".tmp/try-ugcpilot/streaming-media" },
    posters: { type: "string", default: "public/try-ugcpilot/posters" },
  },
});
const input = path.resolve(values.input);
const output = path.resolve(values.output);
const posters = path.resolve(values.posters);
if (input.toLowerCase() === output.toLowerCase()) {
  throw new Error("The output must be a separate release directory, not the input.");
}
if (!ffmpeg) throw new Error("ffmpeg-static is required.");

function run(args) {
  const result = spawnSync(ffmpeg, ["-hide_banner", "-loglevel", "error", ...args], {
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 1024 * 1024,
  });
  if (result.status !== 0) throw new Error(result.stderr || result.error?.message || "FFmpeg failed.");
  return result.stdout.trim();
}

function verifyFastStart(file) {
  const descriptor = openSync(file, "r");
  try {
    const header = Buffer.alloc(16);
    let offset = 0;
    const length = statSync(file).size;
    while (offset + 8 <= length) {
      readSync(descriptor, header, 0, Math.min(16, length - offset), offset);
      const type = header.toString("ascii", 4, 8);
      let size = header.readUInt32BE(0);
      if (size === 1) size = Number(header.readBigUInt64BE(8));
      if (type === "moov") return;
      if (type === "mdat") throw new Error(`${file}: playback metadata still follows the video data.`);
      if (size < 8 || offset + size > length) break;
      offset += size;
    }
    throw new Error(`${file}: no MP4 playback metadata found.`);
  } finally {
    closeSync(descriptor);
  }
}

const cards = Array.from({ length: 29 }, (_, index) => String(index + 1).padStart(2, "0"));
// Fail before writing if the source deck is incomplete.
for (const number of cards) {
  statSync(path.join(input, "videos", `card-${number}.mp4`));
  statSync(path.join(input, "audio", `track-${number}.mp3`));
}
for (const directory of [path.join(output, "videos"), path.join(output, "audio"), posters]) {
  mkdirSync(directory, { recursive: true });
}

let posterBytes = 0;
for (const number of cards) {
  const source = path.join(input, "videos", `card-${number}.mp4`);
  const video = path.join(output, "videos", `card-${number}.mp4`);
  const poster = path.join(posters, `card-${number}.webp`);
  run(["-y", "-i", source, "-map", "0", "-c", "copy", "-movflags", "+faststart", video]);
  verifyFastStart(video);
  // Check the encoded streams themselves, so a container change cannot silently
  // alter the footage, sound, or stream selection.
  const hashArgs = ["-map", "0", "-c", "copy", "-f", "streamhash", "-hash", "sha256", "-"];
  if (run(["-i", source, ...hashArgs]) !== run(["-i", video, ...hashArgs])) {
    throw new Error(`card-${number}: remux changed an encoded stream.`);
  }
  run(["-y", "-i", source, "-frames:v", "1", "-vf", "scale=540:-2", "-c:v", "libwebp", "-quality", "80", poster]);
  copyFileSync(path.join(input, "audio", `track-${number}.mp3`), path.join(output, "audio", `track-${number}.mp3`));
  posterBytes += statSync(poster).size;
  console.log(`card-${number}: fast start verified; encoded streams unchanged.`);
}
console.log(`Prepared ${cards.length} videos and audio tracks in ${output}.`);
console.log(`Prepared ${cards.length} first-frame posters (${posterBytes} bytes) in ${posters}.`);
