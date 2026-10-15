import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import ffmpeg from "ffmpeg-static";
import ffprobe from "ffprobe-static";
import { atomicJsonSync } from "./reference-text-atomic-write.mjs";
import { readMp4DurationSeconds } from "../worker/src/lib/video-reference-input.ts";
import { scanHookRelease } from "./prepare-hook-reference-release.mjs";

const addition = process.argv.includes("--addition");
const release = JSON.parse(readFileSync(addition ? "worker/src/lib/explore-hook-reference-addition-release.json" : "worker/src/lib/explore-hook-reference-release.json", "utf8"));
const sourceIndex = process.argv.indexOf("--source");
const sourceLinkDifferences = [];
if (sourceIndex >= 0) {
  if (!process.argv[sourceIndex + 1]) throw new Error("Supply the original source directory after --source.");
  const pairs = scanHookRelease(process.argv[sourceIndex + 1], { sourcePolicy: addition ? "optional" : "instagram-required", includedFolders: release.items.map(item => item.sourceFolder) });
  for (const item of release.items) {
    const pair = pairs.find(value => value.folder === item.sourceFolder);
    if (!pair || createHash("sha256").update(readFileSync(pair.videoPath)).digest("hex") !== item.videoSha256 || createHash("sha256").update(readFileSync(pair.audioPath)).digest("hex") !== item.audioSha256) throw new Error(`Original folder pairing changed: ${item.sourceFolder}`);
    if ((pair.sourceUrl ?? null) !== (item.sourceUrl ?? item.instagramUrl ?? null)) sourceLinkDifferences.push({ folder: item.sourceFolder, registered: item.sourceUrl ?? item.instagramUrl ?? null, supplied: pair.sourceUrl ?? null });
  }
}
const file = key => path.resolve(".tmp/explore-paired-references/media", path.basename(key));
const run = args => execFileSync(ffmpeg, ["-nostdin", "-v", "error", "-xerror", ...args], { windowsHide: true, timeout: 120000, maxBuffer: 16 * 1024 ** 2 });
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const rows = [];
for (const item of release.items) {
  for (const type of ["video", "audio", "poster", "preview"]) if (sha(readFileSync(file(item[`${type}StorageKey`]))) !== item[`${type}Sha256`]) throw new Error(`Source checksum changed: ${item.id} ${type}`);
  const source = file(item.videoStorageKey), preview = file(item.previewStorageKey);
  const generationDuration = readMp4DurationSeconds(readFileSync(source));
  if (Math.abs(generationDuration - item.durationSeconds) > .2) throw new Error(`Generation duration differs from catalog: ${item.id}`);
  if (!release.excludedReferenceIds.includes(item.id) && generationDuration > 15) throw new Error(`Generation reference exceeds limit: ${item.id}`);
  // Decode the complete MP3 and audible preview audio, including their tails.
  for (const input of [file(item.audioStorageKey), preview]) run(["-i", input, "-map", "0:a:0", "-f", "null", "-"]);
  const pictures = input => run(["-i", input, "-map", "0:v:0", "-f", "framemd5", "pipe:1"]).toString().split(/\r?\n/).filter(line => line && !line.startsWith("#")).map(line => line.trim().split(/,\s*/).at(-1)).join("\n");
  if (pictures(source) !== pictures(preview)) throw new Error(`Preview changed decoded video pictures: ${item.id}`);
  const probe = JSON.parse(execFileSync(ffprobe.path, ["-v", "error", "-show_streams", "-show_format", "-of", "json", preview], { windowsHide: true, encoding: "utf8" }));
  if (!probe.streams.some(stream => stream.codec_type === "audio")) throw new Error(`Preview missing soundtrack: ${item.id}`);
  const duration = Number(probe.streams.find(stream => stream.codec_type === "video")?.duration ?? probe.format.duration);
  if (Math.abs(duration - item.durationSeconds) > .15) throw new Error(`Preview changed timing: ${item.id}`);
  // Independently decode the registered MP3 at the same interior time. AAC
  // compression is lossy; high waveform correlation checks the actual pairing.
  const seconds = Math.min(1, item.durationSeconds / 3, item.audioDurationSeconds / 3), length = Math.min(.5, item.durationSeconds / 3);
  const samples = input => { const bytes = run(["-i", input, "-ss", String(seconds), "-t", String(length), "-vn", "-ac", "1", "-ar", "16000", "-f", "f32le", "pipe:1"]); return new Float32Array(bytes.buffer, bytes.byteOffset, bytes.length / 4); };
  const original = samples(file(item.audioStorageKey)), actual = samples(preview), count = Math.min(original.length, actual.length);
  let dot = 0, left = 0, right = 0;
  for (let i = 0; i < count; i++) { dot += original[i] * actual[i]; left += original[i] ** 2; right += actual[i] ** 2; }
  const correlation = dot / Math.sqrt(left * right), gain = Math.sqrt(right / left);
  if (!Number.isFinite(correlation) || correlation < .90 || Math.abs(gain - .2) > .04) throw new Error(`Preview soundtrack differs from its registered MP3: ${item.id}, correlation=${correlation}, gain=${gain}`);
  rows.push({ id: item.id, picturesUnchanged: true, fullAudioDecode: true, generationDuration, durationSeconds: duration, audioCorrelation: correlation, gain });
}
const output = addition ? ".tmp/hook-reference-addition-review/media-audit.json" : ".tmp/hook-reference-review/media-audit.json";
mkdirSync(path.dirname(output), { recursive: true });
atomicJsonSync(output, { checked: rows.length, sourceLinkDifferences, rows });
console.log(JSON.stringify({ hooksChecked: rows.length, originalFoldersVerified: sourceIndex >= 0, sourceLinkDifferences, fullAudioDecode: true, picturesUnchanged: true, pairedAudioVerified: true, minimumAudioCorrelation: Math.min(...rows.map(row => row.audioCorrelation)), output }));
if (sourceLinkDifferences.length) process.exitCode = 1;
