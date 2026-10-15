import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ffmpeg from "ffmpeg-static";
import ffprobe from "ffprobe-static";
import sharp from "sharp";
import { canonicalHookSource } from "../worker/src/lib/explore-instagram-source.ts";
import { atomicJsonSync } from "./reference-text-atomic-write.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const order = new Intl.Collator("en", { numeric: true });
export const HOOK_RELEASE_PATH = "worker/src/lib/explore-hook-reference-release.json";

export function scanHookRelease(source, { sourcePolicy = "instagram-required", includedFolders = null } = {}) {
  const allFolders = readdirSync(source, { withFileTypes: true }).filter(f => f.isDirectory());
  const requested = includedFolders === null ? null : new Set(includedFolders);
  if (requested && (requested.size !== includedFolders.length || [...requested].some(name => !allFolders.some(folder => folder.name === name)))) throw new Error("An explicitly selected Hook source folder was not found.");
  return allFolders.filter(folder => !requested || requested.has(folder.name)).sort((a, b) => order.compare(a.name, b.name)).map(folder => {
    const directory = path.join(source, folder.name);
    const files = readdirSync(directory, { withFileTypes: true });
    // Windows creates these presentation-only folder files. They do not form
    // part of a reference set and must not make an otherwise valid pair fail.
    const sourceFiles = files.filter(file => file.isFile() && !(file.name.toLowerCase() === "desktop.ini" || /^folderico-.*\.ico$/iu.test(file.name)));
    const byExtension = extension => files.filter(f => f.isFile() && path.extname(f.name).toLowerCase() === extension);
    const videos = byExtension(".mp4"), audios = byExtension(".mp3"), links = byExtension(".txt");
    const expectedFiles = 2 + (links.length ? 1 : 0);
    if (sourceFiles.length !== expectedFiles || videos.length !== 1 || audios.length !== 1 || links.length > 1) throw new Error(`Expected exactly one MP4, MP3 and at most one source-link TXT: ${directory}`);
    const rawSource = links.length ? readFileSync(path.join(directory, links[0].name), "utf8").trim() : "";
    const sourcePost = rawSource ? canonicalHookSource(rawSource) : null;
    if (rawSource && !sourcePost) throw new Error(`Unsupported source link: ${directory}`);
    if (sourcePolicy === "instagram-required" && (!sourcePost || sourcePost.platform !== "instagram")) throw new Error(`Expected one HTTPS Instagram post link: ${directory}`);
    if (!["instagram-required", "optional"].includes(sourcePolicy)) throw new Error(`Unknown source-link policy: ${sourcePolicy}`);
    return { folder: folder.name, videoPath: path.join(directory, videos[0].name), audioPath: path.join(directory, audios[0].name),
      ...(sourcePost ? { sourceUrl: sourcePost.url, sourcePlatform: sourcePost.platform } : {}),
      ...(sourcePost?.platform === "instagram" ? { instagramUrl: sourcePost.url } : {}) };
  });
}

function probe(file, type, maxSeconds) {
  const data = JSON.parse(execFileSync(ffprobe.path, ["-v", "error", "-show_streams", "-show_format", "-of", "json", file], { windowsHide: true, encoding: "utf8" }));
  const stream = data.streams.find(s => s.codec_type === type), duration = Number(stream?.duration ?? data.format.duration);
  if (!stream || !Number.isFinite(duration) || duration <= 0 || duration > maxSeconds) throw new Error(`Unsupported ${type} duration: ${file}`);
  execFileSync(ffmpeg, ["-v", "error", "-xerror", "-i", file, "-map", `0:${stream.index}`, "-f", "null", "-"], { windowsHide: true, timeout: 120000, stdio: ["ignore", "ignore", "pipe"] });
  return { duration, width: stream.width, height: stream.height, hasEmbeddedAudio: data.streams.some(s => s.codec_type === "audio") };
}

export async function prepareHookRelease({ source, stage = false, excludedFolders = [], includedFolders = null, manifestPath = path.join(root, HOOK_RELEASE_PATH), mediaRoot = path.join(root, ".tmp/explore-paired-references/media"), sourcePolicy = "instagram-required", titleStart = 0, checksPath = path.join(root, ".tmp/hook-reference-release-checks.json") }) {
  const previous = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : null;
  const pairs = scanHookRelease(source, { sourcePolicy, includedFolders });
  if (!pairs.length) throw new Error("No hook sets found.");
  const items = [], checks = [];
  for (const pair of pairs) {
    const video = readFileSync(pair.videoPath), audio = readFileSync(pair.audioPath);
    if (!video.length || !audio.length || video.length > 50 * 1024 ** 2 || audio.length > 50 * 1024 ** 2) throw new Error(`Empty or oversized media: ${pair.folder}`);
    const info = probe(pair.videoPath, "video", 120), sound = probe(pair.audioPath, "audio", 600);
    const videoSha256 = hash(video), audioSha256 = hash(audio);
    const poster = execFileSync(ffmpeg, ["-v", "error", "-ss", String(Math.min(.5, info.duration / 2)), "-i", pair.videoPath, "-frames:v", "1", "-vf", "scale=360:-2", "-f", "image2pipe", "-vcodec", "png", "-"], { windowsHide: true, maxBuffer: 5 * 1024 ** 2 });
    const posterBytes = await sharp(poster).webp({ quality: 85 }).toBuffer(), posterSha256 = hash(posterBytes);
    const storageKey = (sha, ext) => `explore/paired-references/v1/${sha}.${ext}`;
    const id = `explore-paired-hook-${hash(`${videoSha256}:${audioSha256}`).slice(0, 24)}`;
    const registered = previous?.items.find(item => item.id === id);
    let preview = registered?.previewSha256 ? { previewSha256: registered.previewSha256, previewStorageKey: registered.previewStorageKey } : {};
    if (stage) {
      const { renderExploreReferenceAudio } = await import("../worker/dist/lib/explore-reference-audio-render.js");
      const previewRoot = path.join(root, ".tmp/hook-release-previews"); mkdirSync(previewRoot, { recursive: true });
      const directory = mkdtempSync(path.join(previewRoot, "preview-"));
      try {
        const rendered = await renderExploreReferenceAudio({ sourcePath: pair.videoPath, audioPath: pair.audioPath, workDir: directory, volume: .2, replaceOriginal: true, tools: { ffmpeg, ffprobe: ffprobe.path } });
        const bytes = readFileSync(rendered.outputPath), previewSha256 = hash(bytes);
        mkdirSync(mediaRoot, { recursive: true }); writeFileSync(path.join(mediaRoot, `${previewSha256}.mp4`), bytes);
        preview = { previewSha256, previewStorageKey: storageKey(previewSha256, "mp4") };
      } finally {
        if (path.dirname(directory) !== previewRoot || !path.basename(directory).startsWith("preview-")) throw new Error("Unsafe preview cleanup path.");
        rmSync(directory, { recursive: true, force: true });
      }
    }
    items.push({ id, format: "hook", title: `Hook ${String(titleStart + items.length + 1).padStart(2, "0")}`,
      ...(sourcePolicy === "instagram-required" ? { instagramUrl: pair.instagramUrl } : pair.sourceUrl ? { sourceUrl: pair.sourceUrl, sourcePlatform: pair.sourcePlatform } : {}),
      videoStorageKey: storageKey(videoSha256, "mp4"), audioStorageKey: storageKey(audioSha256, "mp3"), posterStorageKey: storageKey(posterSha256, "webp"),
      videoSha256, audioSha256, posterSha256, durationSeconds: info.duration, audioDurationSeconds: sound.duration, width: info.width, height: info.height,
      audioTitle: path.basename(pair.audioPath), sourceFolder: pair.folder, ...preview });
    checks.push({ id, folder: pair.folder, videoSeconds: info.duration, audioSeconds: sound.duration, hasEmbeddedAudio: info.hasEmbeddedAudio,
      exceeds15SecondGenerationLimit: info.duration > 15, audioShorterThanVideo: sound.duration < info.duration });
    if (stage) {
      mkdirSync(mediaRoot, { recursive: true });
      for (const [sha, ext, file] of [[videoSha256, "mp4", pair.videoPath], [audioSha256, "mp3", pair.audioPath]]) {
        const destination = path.join(mediaRoot, `${sha}.${ext}`);
        if (existsSync(destination)) { if (hash(readFileSync(destination)) !== sha) throw new Error(`Corrupt staged media: ${destination}`); }
        else copyFileSync(file, destination);
      }
      writeFileSync(path.join(mediaRoot, `${posterSha256}.webp`), posterBytes);
    }
  }
  if (new Set(items.map(i => i.id)).size !== items.length) throw new Error("Duplicate hook pair; review the source set.");
  if (sourcePolicy === "instagram-required" && new Set(items.map(i => i.instagramUrl)).size !== items.length) throw new Error("Duplicate Instagram source; review the source set.");
  if (previous?.mediaStatus === "published" && JSON.stringify(previous.items) !== JSON.stringify(items)) throw new Error("The published release changed. Use a separate release rather than replacing registered identities.");
  const excludedReferenceIds = items.filter(item => excludedFolders.includes(item.sourceFolder)).map(item => item.id);
  if (excludedReferenceIds.length !== excludedFolders.length) throw new Error("An excluded source folder was not found.");
  if (previous?.mediaStatus === "published" && JSON.stringify(previous.excludedReferenceIds) !== JSON.stringify(excludedReferenceIds)) throw new Error("Refusing to change exclusions on a published release.");
  const manifest = { version: 1, mediaStatus: previous?.mediaStatus ?? "staged", activation: previous?.activation ?? "pending", excludedReferenceIds, items };
  if (stage) {
    atomicJsonSync(manifestPath, manifest);
    atomicJsonSync(checksPath, { source, checks });
  }
  return { manifest, checks };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const sourceIndex = process.argv.indexOf("--source");
  if (sourceIndex < 0 || !process.argv[sourceIndex + 1]) throw new Error("Supply --source with the HOOKS folder.");
  const excludedFolders = process.argv.flatMap((arg, i) => arg === "--exclude-folder" ? [process.argv[i + 1]] : []);
  const result = await prepareHookRelease({ source: process.argv[sourceIndex + 1], excludedFolders, stage: process.argv.includes("--stage") });
  console.log(JSON.stringify({ count: result.manifest.items.length, mediaStatus: result.manifest.mediaStatus, checks: result.checks }, null, 2));
}
