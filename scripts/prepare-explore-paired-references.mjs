import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ffmpeg from "ffmpeg-static";
import ffprobe from "ffprobe-static";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const PAIRED_REFERENCE_PREFIX = "explore/paired-references/v1";
const digest = bytes => createHash("sha256").update(bytes).digest("hex");
const order = new Intl.Collator("en", { numeric: true });

export function scanPairFolders(source, format) {
  const pairs = [], skipped = [];
  for (const folder of readdirSync(source, { withFileTypes: true }).filter(f => f.isDirectory()).sort((a, b) => order.compare(a.name, b.name))) {
    const directory = path.join(source, folder.name);
    const files = readdirSync(directory, { withFileTypes: true }).filter(f => f.isFile()).map(f => f.name);
    if (!files.length) { skipped.push(directory); continue; }
    const videos = files.filter(f => /\.mp4$/i.test(f)), audios = files.filter(f => /\.mp3$/i.test(f));
    if (videos.length !== 1 || audios.length !== 1 || files.length !== 2) throw new Error(`Expected exactly one MP4 and one MP3: ${directory}`);
    pairs.push({ format, folder: folder.name, videoPath: path.join(directory, videos[0]), audioPath: path.join(directory, audios[0]) });
  }
  if (!pairs.length) throw new Error(`No video/audio pairs in ${source}`);
  return { pairs, skipped };
}

function probe(file, type, maxDuration) {
  const data = JSON.parse(execFileSync(ffprobe.path, ["-v", "error", "-show_streams", "-show_format", "-of", "json", file], { windowsHide: true, encoding: "utf8" }));
  const stream = data.streams.find(s => s.codec_type === type);
  const duration = Number(stream?.duration ?? data.format?.duration);
  if (!stream || !Number.isFinite(duration) || duration <= 0 || duration > maxDuration) throw new Error(`Invalid ${type} duration: ${file}`);
  // Decode all packets before staging; a successful metadata probe alone can miss corruption.
  execFileSync(ffmpeg, ["-v", "error", "-xerror", "-i", file, "-map", `0:${stream.index}`, "-f", "null", "-"], { windowsHide: true, stdio: ["ignore", "ignore", "pipe"] });
  return { durationSeconds: duration, width: stream.width, height: stream.height };
}

export async function preparePairedReferences({ hooks = "D:/hookswithlinks", wall = "D:/wotwithlinks", stage = false } = {}) {
  const scans = [scanPairFolders(hooks, "hook"), scanPairFolders(wall, "wall_text")];
  const mediaRoot = path.join(root, ".tmp/explore-paired-references/media");
  const manifestPath = path.join(root, "worker/src/lib/explore-paired-reference-catalog.json");
  if (stage) mkdirSync(mediaRoot, { recursive: true });
  const items = [];
  for (const pair of scans.flatMap(s => s.pairs)) {
    const video = readFileSync(pair.videoPath), audio = readFileSync(pair.audioPath);
    if (!video.length || video.length > 50 * 1024 ** 2 || !audio.length || audio.length > 50 * 1024 ** 2) throw new Error(`Empty or oversized pair: ${pair.folder}`);
    const info = probe(pair.videoPath, "video", 120), audioInfo = probe(pair.audioPath, "audio", 600);
    const videoSha256 = digest(video), audioSha256 = digest(audio);
    const id = `explore-paired-${pair.format}-${digest(`${videoSha256}:${audioSha256}`).slice(0, 24)}`;
    const poster = execFileSync(ffmpeg, ["-v", "error", "-ss", String(Math.min(.5, info.durationSeconds / 2)), "-i", pair.videoPath, "-frames:v", "1", "-vf", "scale=360:-2", "-f", "image2pipe", "-vcodec", "png", "-"], { windowsHide: true, maxBuffer: 5 * 1024 ** 2 });
    const posterBytes = await sharp(poster).webp({ quality: 85 }).toBuffer();
    const posterSha256 = digest(posterBytes);
    const videoFile = `${videoSha256}.mp4`, audioFile = `${audioSha256}.mp3`, posterFile = `${posterSha256}.webp`;
    if (stage) {
      if (!existsSync(path.join(mediaRoot, videoFile))) copyFileSync(pair.videoPath, path.join(mediaRoot, videoFile));
      if (!existsSync(path.join(mediaRoot, audioFile))) copyFileSync(pair.audioPath, path.join(mediaRoot, audioFile));
      writeFileSync(path.join(mediaRoot, posterFile), posterBytes);
    }
    items.push({ id, format: pair.format, title: `${pair.format === "hook" ? "Hook" : "Wall of text"} with reference audio ${items.filter(i => i.format === pair.format).length + 1}`,
      videoStorageKey: `${PAIRED_REFERENCE_PREFIX}/${videoFile}`, audioStorageKey: `${PAIRED_REFERENCE_PREFIX}/${audioFile}`, posterStorageKey: `${PAIRED_REFERENCE_PREFIX}/${posterFile}`,
      videoSha256, audioSha256, posterSha256, durationSeconds: info.durationSeconds, audioDurationSeconds: audioInfo.durationSeconds,
      width: info.width, height: info.height, audioTitle: path.basename(pair.audioPath), sourceFolder: pair.folder });
  }
  if (new Set(items.map(i => i.id)).size !== items.length) throw new Error("Duplicate video/audio pairs.");
  const previous = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : null;
  // Re-scanning cannot change an existing ID's mapping, remove it, or downgrade publication.
  if (previous) for (const item of previous.items) {
    const next = items.find(i => i.id === item.id);
    if (!next || JSON.stringify(next) !== JSON.stringify(item)) throw new Error(`Previously registered pair changed: ${item.id}`);
  }
  const manifest = { version: 1, mediaStatus: previous?.mediaStatus === "published" && previous.items.length === items.length ? "published" : "staged", items };
  if (stage && previous?.mediaStatus === "published" && previous.items.length !== items.length) throw new Error("Stage a new release separately before adding to a published paired catalog.");
  if (stage) writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return { manifest, skipped: scans.flatMap(s => s.skipped), mediaRoot };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await preparePairedReferences({ stage: process.argv.includes("--stage") });
  console.log(JSON.stringify({ mediaStatus: result.manifest.mediaStatus, hooks: result.manifest.items.filter(i => i.format === "hook").length, wallText: result.manifest.items.filter(i => i.format === "wall_text").length,
    skippedEmptyFolders: result.skipped, pairs: result.manifest.items.map(i => ({ id: i.id, sourceFolder: i.sourceFolder, audio: i.audioTitle, videoSeconds: i.durationSeconds, audioSeconds: i.audioDurationSeconds, dimensions: `${i.width}x${i.height}` })) }, null, 2));
}
