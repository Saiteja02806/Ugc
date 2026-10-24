import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { childDirectories, orderedSlideFiles } from "./prepare-explore-catalog.mjs";
import { canonicalSlideshowSource } from "../lib/explore/reference-source-link.ts";

const hash = value => createHash("sha256").update(value).digest("hex");
const slug = value => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const signature = slides => slides.map(slide => slide.file).join("|");

/** Prepare an additive release; the caller publishes only after media verification. */
export async function prepareSlideshowReferenceUpdate({ sourceRoot, catalog, stageDirectory }) {
  const items = structuredClone(catalog.items), additions = [], sources = [], mappings = [];
  const existing = new Map(items.filter(item => item.format === "slideshow").map(item => [signature(item.slides), item]));
  mkdirSync(path.join(stageDirectory, "media"), { recursive: true });
  for (const category of childDirectories(sourceRoot)) {
    const categoryRoot = path.join(sourceRoot, category), folders = childDirectories(categoryRoot);
    for (const folder of folders) {
      const directory = path.join(categoryRoot, folder), files = orderedSlideFiles(directory);
      if (files.length < 2 || childDirectories(directory).length) throw Error(`Invalid slideshow folder: ${category}/${folder}`);
      const slides = [], assets = [];
      for (const file of files) {
        const input = path.join(directory, file), bytes = readFileSync(input), digest = hash(bytes);
        const metadata = await sharp(bytes, { failOn: "error" }).metadata();
        if (!metadata.width || !metadata.height) throw Error(`Invalid image: ${input}`);
        const target = digest + path.extname(file).toLowerCase();
        slides.push({ id: `slide-${slides.length + 1}-${digest.slice(0, 12)}`, file: target, width: metadata.width, height: metadata.height });
        assets.push({ input, target });
      }
      let item = existing.get(signature(slides));
      if (!item) {
        const categoryId = slug(category), categoryLabel = category.replace(/\b\w/g, letter => letter.toUpperCase());
        const number = Math.max(0, ...items.filter(item => item.format === "slideshow" && item.category === categoryId).map(item => Number(item.title.match(/ (\d+)$/)?.[1] ?? 0))) + 1;
        item = { id: `explore-slideshow-${categoryId}-${hash(signature(slides)).slice(0, 16)}`, format: "slideshow", title: `${categoryLabel} ${String(number).padStart(2, "0")}`, category: categoryId, categoryLabel, posterFile: slides[0].file, slides };
        if (items.some(other => other.id === item.id)) throw Error(`Conflicting reference identity: ${item.id}`);
        items.push(item); additions.push(item); existing.set(signature(slides), item);
        for (const asset of assets) copyFileSync(asset.input, path.join(stageDirectory, "media", asset.target));
      }
      // Marketing has one set and its approved link lives in the category folder.
      const textFile = path.join(directory, "New Text Document.txt"), parentText = path.join(categoryRoot, "New Text Document.txt");
      const linkFile = existsSync(textFile) ? textFile : folders.length === 1 && existsSync(parentText) ? parentText : null;
      if (linkFile) {
        const source = canonicalSlideshowSource(readFileSync(linkFile, "utf8"));
        if (!source) throw Error(`Invalid supplied source: ${linkFile}`);
        sources.push({ referenceId: item.id, sourceUrl: source.url, sourcePlatform: source.platform, sourceKind: source.kind });
      }
      mappings.push({ folder: `${category}/${folder}`, referenceId: item.id, title: item.title, added: additions.includes(item), slideCount: slides.length });
    }
  }
  const sourceMap = new Map();
  for (const source of sources) {
    if (sourceMap.has(source.referenceId) && JSON.stringify(sourceMap.get(source.referenceId)) !== JSON.stringify(source)) throw Error("Conflicting source mappings");
    sourceMap.set(source.referenceId, source);
  }
  const result = { manifest: { ...catalog, mediaStatus: additions.length ? "staged" : catalog.mediaStatus, release: hash(JSON.stringify(items)).slice(0, 20), items }, additions,
    sources: { version: 1, items: [...sourceMap.values()] }, mappings };
  writeFileSync(path.join(stageDirectory, "candidate-catalog.json"), JSON.stringify(result.manifest, null, 2) + "\n");
  writeFileSync(path.join(stageDirectory, "sources.json"), JSON.stringify(result.sources, null, 2) + "\n");
  writeFileSync(path.join(stageDirectory, "upload-manifest.json"), JSON.stringify({ version: 1, mediaStatus: "staged", release: hash(JSON.stringify(additions)).slice(0, 20), items: additions }, null, 2) + "\n");
  writeFileSync(path.join(stageDirectory, "mappings.json"), JSON.stringify(mappings, null, 2) + "\n");
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const sourceRoot = process.argv[2] ?? "D:/slideshow/slideshow explore";
  const stageDirectory = path.resolve(process.argv[3] ?? ".tmp/slideshow-reference-release-20261022");
  const catalog = JSON.parse(readFileSync("lib/explore/imported-catalog.json", "utf8"));
  const result = await prepareSlideshowReferenceUpdate({ sourceRoot, stageDirectory, catalog });
  console.log(JSON.stringify({ additions: result.additions.length, slides: result.additions.reduce((n, item) => n + item.slides.length, 0), linked: result.sources.items.length, totalSlideshowReferences: result.manifest.items.filter(item => item.format === "slideshow").length, stageDirectory, remoteWrites: 0 }));
}
