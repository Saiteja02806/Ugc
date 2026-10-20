import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import ffmpeg from "ffmpeg-static";
import ffprobe from "ffprobe-static";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const numericOrder = new Intl.Collator("en", { numeric: true, sensitivity: "base" });
const imageExtensions = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const hash = (data) => createHash("sha256").update(data).digest("hex");
const slug = (name) => name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const label = (name) => name.replace(/\b\w/g, (letter) => letter.toUpperCase());
const catalogPath = path.join(root, "lib/explore/imported-catalog.json");

function readCatalog(filePath) {
  if (!existsSync(filePath)) return null;
  const catalog = JSON.parse(readFileSync(filePath, "utf8"));
  if (catalog.version !== 1 || !["staged", "published"].includes(catalog.mediaStatus) || !Array.isArray(catalog.items)) {
    throw new Error(`Invalid existing catalogue: ${filePath}`);
  }
  return catalog;
}

/** Additions only: never remove or renumber a saved reference on a folder rescan. */
export function mergeCatalogItems(previousItems, scannedItems) {
  const items = [...previousItems];
  const byId = new Map(items.map((item) => [item.id, item]));
  if (byId.size !== items.length) throw new Error("Existing catalogue has duplicate IDs.");
  const nextNumber = new Map();
  for (const item of items) {
    const group = `${item.format}:${item.category}`;
    const number = Number(item.title.match(/ (\d+)$/)?.[1] ?? 0);
    nextNumber.set(group, Math.max(nextNumber.get(group) ?? 0, number));
  }
  for (const item of scannedItems) {
    const previous = byId.get(item.id);
    if (previous) {
      // Directory insertion can change a newly scanned ordinal, never saved content.
      const withoutTitle = (item) => ({ ...item, title: undefined });
      if (JSON.stringify(withoutTitle(previous)) !== JSON.stringify(withoutTitle(item))) {
        throw new Error(`Refusing to replace an existing reference: ${item.id}`);
      }
      continue;
    }
    const group = `${item.format}:${item.category}`;
    const number = (nextNumber.get(group) ?? 0) + 1;
    nextNumber.set(group, number);
    const added = { ...item, title: `${item.categoryLabel ?? "Hook"} ${String(number).padStart(2, "0")}` };
    items.push(added);
    byId.set(added.id, added);
  }
  return items;
}

export function childDirectories(directory) {
  return readdirSync(directory, { withFileTypes: true }).filter((entry) => entry.isDirectory())
    .map((entry) => entry.name).sort(numericOrder.compare);
}

export function orderedSlideFiles(directory) {
  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && imageExtensions.has(path.extname(entry.name).toLowerCase()))
    .map((entry) => entry.name).sort(numericOrder.compare);
}

export async function prepareCatalog({ slidesRoot, wallRoot, hooksRoot, stage = false,
  manifestPath = catalogPath, previousCatalog = readCatalog(manifestPath),
  knownHookHashes = [], mediaRoot = path.join(root, ".tmp/explore-catalog/media") }) {
  if (stage) mkdirSync(mediaRoot, { recursive: true });
  const scannedItems = [];
  const ids = new Set();
  const skippedHooks = [];
  let sourceBytes = 0;

  function source(filePath) {
    const bytes = readFileSync(filePath);
    if (!bytes.length) throw new Error(`Empty asset: ${filePath}`);
    const digest = hash(bytes);
    const file = `${digest}${path.extname(filePath).toLowerCase()}`;
    sourceBytes += bytes.length;
    if (stage && !existsSync(path.join(mediaRoot, file))) copyFileSync(filePath, path.join(mediaRoot, file));
    return { digest, file, bytes };
  }

  for (const category of childDirectories(slidesRoot)) {
    let index = 0;
    for (const folder of childDirectories(path.join(slidesRoot, category))) {
      const setRoot = path.join(slidesRoot, category, folder);
      if (childDirectories(setRoot).length) throw new Error(`Unexpected nested slideshow: ${setRoot}`);
      const files = orderedSlideFiles(setRoot);
      if (files.length < 2) throw new Error(`A slideshow needs at least two slides: ${setRoot}`);
      const slides = [];
      for (const fileName of files) {
        const { digest, file, bytes } = source(path.join(setRoot, fileName));
        const metadata = await sharp(bytes).metadata();
        if (!metadata.width || !metadata.height) throw new Error(`Invalid image: ${fileName}`);
        slides.push({ id: `slide-${slides.length + 1}-${digest.slice(0, 12)}`, file, width: metadata.width, height: metadata.height });
      }
      const id = `explore-slideshow-${slug(category)}-${hash(slides.map((slide) => slide.file).join("|")).slice(0, 16)}`;
      if (ids.has(id)) throw new Error(`Duplicate slideshow in ${category}: ${folder}`);
      ids.add(id);
      scannedItems.push({ id, format: "slideshow", title: `${label(category)} ${String(++index).padStart(2, "0")}`,
        category: slug(category), categoryLabel: label(category), posterFile: slides[0].file, slides });
    }
  }

  for (const category of childDirectories(wallRoot)) {
    const categoryRoot = path.join(wallRoot, category);
    const files = readdirSync(categoryRoot).filter((name) => /\.mp4$/i.test(name)).sort(numericOrder.compare);
    let index = 0;
    for (const fileName of files) {
      const input = path.join(categoryRoot, fileName);
      const { digest, file } = source(input);
      const metadata = JSON.parse(execFileSync(ffprobe.path, ["-v", "error", "-show_streams", "-show_format", "-of", "json", input], { encoding: "utf8", windowsHide: true }));
      const video = metadata.streams.find((stream) => stream.codec_type === "video");
      const durationSeconds = Number(metadata.format.duration);
      if (!video?.width || !video?.height || !Number.isFinite(durationSeconds) || durationSeconds <= 0) throw new Error(`Invalid video: ${input}`);
      const id = `explore-wall-text-${digest.slice(0, 16)}`;
      if (ids.has(id)) throw new Error(`Duplicate video: ${input}`);
      ids.add(id);
      const posterFile = `${digest}-poster.webp`;
      if (stage && !existsSync(path.join(mediaRoot, posterFile))) {
        execFileSync(ffmpeg, ["-v", "error", "-i", input, "-frames:v", "1", "-vf", "scale=640:-2", "-y", path.join(mediaRoot, posterFile)], { windowsHide: true });
      }
      scannedItems.push({ id, format: "wall_text", title: `${label(category)} ${String(++index).padStart(2, "0")}`,
        category: slug(category), categoryLabel: label(category), posterFile, videoFile: file, durationSeconds, slides: [] });
    }
  }
  if (hooksRoot) {
    if (childDirectories(hooksRoot).length) throw new Error(`Unexpected nested Hook source: ${hooksRoot}`);
    const files = readdirSync(hooksRoot, { withFileTypes: true }).filter((entry) => entry.isFile() && /\.mp4$/i.test(entry.name))
      .map((entry) => entry.name).sort(numericOrder.compare);
    if (!files.length) throw new Error(`No Hook MP4 files found: ${hooksRoot}`);
    const hashes = new Set(knownHookHashes);
    for (const fileName of files) {
      const input = path.join(hooksRoot, fileName);
      if (statSync(input).size > 50 * 1024 * 1024) throw new Error(`Hook video exceeds 50 MB: ${input}`);
      const { digest, file } = source(input);
      if (hashes.has(digest)) { skippedHooks.push(fileName); continue; }
      hashes.add(digest);
      const metadata = JSON.parse(execFileSync(ffprobe.path, ["-v", "error", "-show_streams", "-show_format", "-of", "json", input], { encoding: "utf8", windowsHide: true }));
      const video = metadata.streams.find((stream) => stream.codec_type === "video");
      const durationSeconds = Number(metadata.format.duration);
      if (video?.codec_name !== "h264" || !video.width || !video.height || video.width * 16 !== video.height * 9 || !Number.isFinite(durationSeconds) || durationSeconds <= 0) {
        throw new Error(`Hook reference must be a valid 9:16 H.264 MP4: ${input}`);
      }
      const id = `explore-hook-${digest.slice(0, 16)}`;
      if (ids.has(id)) throw new Error(`Duplicate Hook ID: ${input}`);
      ids.add(id);
      const posterFile = `${digest}-poster.webp`;
      if (stage && !existsSync(path.join(mediaRoot, posterFile))) {
        execFileSync(ffmpeg, ["-v", "error", "-ss", String(Math.min(0.5, durationSeconds / 2)), "-i", input, "-frames:v", "1", "-vf", "scale=640:-2", "-y", path.join(mediaRoot, posterFile)], { windowsHide: true });
      }
      // Preserve the original clip (including audio); gallery playback is muted.
      scannedItems.push({ id, format: "hook", title: "Hook", category: null, categoryLabel: null,
        posterFile, videoFile: file, durationSeconds, slides: [] });
    }
  }
  const previousItems = previousCatalog?.items ?? [];
  const items = mergeCatalogItems(previousItems, scannedItems);
  const addedItems = items.slice(previousItems.length);
  const mediaStatus = addedItems.length ? "staged" : previousCatalog?.mediaStatus ?? "staged";
  const manifest = {
    version: 1,
    mediaStatus,
    release: hash(JSON.stringify(items)).slice(0, 20),
    items,
  };
  if (stage) {
    if (previousCatalog?.mediaStatus === "published" && addedItems.length) {
      throw new Error("Refusing to downgrade a published catalogue. Stage additions in a separate --manifest before planning a release.");
    }
    if (JSON.stringify(readCatalog(manifestPath)) !== JSON.stringify(previousCatalog)) {
      throw new Error("Catalogue changed during the scan; rerun before staging.");
    }
    // Atomic generated metadata update; source folders and saved items are untouched.
    const temporaryPath = `${manifestPath}.part`;
    writeFileSync(temporaryPath, `${JSON.stringify(manifest, null, 2)}\n`);
    renameSync(temporaryPath, manifestPath);
  }
  return { manifest, sourceBytes, addedItems, skippedHooks };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const value = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
  const result = await prepareCatalog({
    slidesRoot: value("--slides", "C:/Users/chund/OneDrive/Desktop/slideshow explore"),
    wallRoot: value("--wall", "C:/Users/chund/OneDrive/Desktop/WOT_real/notbeen/notbeen-explore"),
    hooksRoot: value("--hooks", undefined),
    manifestPath: path.resolve(value("--manifest", catalogPath)),
    knownHookHashes: [...readFileSync(path.join(root, "lib/explore/hook-video-library.ts"), "utf8").matchAll(/sourceFileSha256:\s*"([a-f0-9]{64})"/g)].map((match) => match[1]),
    stage: args.includes("--stage-local"),
  });
  console.log(JSON.stringify({ mode: args.includes("--stage-local") ? "local staging" : "read-only audit", release: result.manifest.release,
    wallVideos: result.manifest.items.filter((item) => item.format === "wall_text").length,
    slideshows: result.manifest.items.filter((item) => item.format === "slideshow").length,
    hooks: result.manifest.items.filter((item) => item.format === "hook").length,
    slides: result.manifest.items.reduce((sum, item) => sum + item.slides.length, 0),
    additions: result.addedItems.reduce((counts, item) => ({ ...counts, [item.format]: (counts[item.format] ?? 0) + 1 }), {}),
    skippedDuplicateHooks: result.skippedHooks,
    sourceMB: Math.round(result.sourceBytes / 1024 / 1024), remoteWrites: 0 }, null, 2));
}
