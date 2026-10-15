import { ReferenceTextSchema } from "../lib/explore/reference-text.ts";
import { canonicalHookSource, canonicalInstagramSource } from "../worker/src/lib/explore-instagram-source.ts";

/** A release cannot replace the gallery until every eligible source has reviewed text. */
export function validateHookRelease(release, textCatalog, { sourcePolicy = "instagram-required" } = {}) {
  if (!["instagram-required", "optional"].includes(sourcePolicy)) throw new Error("Invalid source-link policy.");
  if (release.version !== 1 || !["staged", "published"].includes(release.mediaStatus) || !["pending", "active"].includes(release.activation) || !Array.isArray(release.items) || !release.items.length) throw new Error("Invalid hook release.");
  if (!Array.isArray(release.excludedReferenceIds) || new Set(release.excludedReferenceIds).size !== release.excludedReferenceIds.length || release.excludedReferenceIds.some(id => !release.items.some(item => item.id === id))) throw new Error("Invalid excluded hook identities.");
  const ids = new Set(), urls = new Set(), assets = new Map();
  const textItems = textCatalog.items.filter(text => release.items.some(item => item.id === text.referenceId));
  if (new Set(textItems.map(text => JSON.stringify([text.referenceId, text.slideId]))).size !== textItems.length) throw new Error("Duplicate hook text identity.");
  const eligible = release.items.filter(item => !release.excludedReferenceIds.includes(item.id));
  if (!eligible.length) throw new Error("The new gallery would be empty.");
  for (const item of release.items) {
    if (item.format !== "hook" || !/^explore-paired-hook-[a-f0-9]{24}$/.test(item.id) || ids.has(item.id)) throw new Error("Invalid or duplicate hook identity.");
    ids.add(item.id);
    if (sourcePolicy === "instagram-required") {
      if (!canonicalInstagramSource(item.instagramUrl) || canonicalInstagramSource(item.instagramUrl) !== item.instagramUrl || urls.has(item.instagramUrl)) throw new Error("Invalid or duplicate Instagram source.");
      urls.add(item.instagramUrl);
    } else if (item.sourceUrl !== undefined || item.sourcePlatform !== undefined) {
      const source = canonicalHookSource(item.sourceUrl);
      if (!source || source.url !== item.sourceUrl || source.platform !== item.sourcePlatform) throw new Error("Invalid Hook source link.");
    }
    if (![item.durationSeconds, item.audioDurationSeconds, item.width, item.height].every(n => Number.isFinite(n) && n > 0) || item.durationSeconds > 120 || item.audioDurationSeconds > 600) throw new Error(`Invalid media dimensions or duration: ${item.id}`);
    for (const [type, extension, contentType] of [["video", "mp4", "video/mp4"], ["audio", "mp3", "audio/mpeg"], ["poster", "webp", "image/webp"], ["preview", "mp4", "video/mp4"]]) {
      const sha256 = item[`${type}Sha256`], key = item[`${type}StorageKey`];
      if (typeof sha256 !== "string" || !/^[a-f0-9]{64}$/.test(sha256) || key !== `explore/paired-references/v1/${sha256}.${extension}`) throw new Error(`Invalid ${type} storage mapping: ${item.id}`);
      assets.set(key, { key, sha256, file: `${sha256}.${extension}`, contentType });
    }
    if (release.excludedReferenceIds.includes(item.id)) continue;
    if (item.durationSeconds > 15) throw new Error(`Hook exceeds the generation reference limit: ${item.id}`);
    const text = textItems.find(text => text.referenceId === item.id && text.slideId === null);
    if (!text || !["ready", "no_text"].includes(text.status)) throw new Error(`Hook text has not been visually reviewed: ${item.id}`);
    if (text.status === "no_text" && text.blocks.length) throw new Error(`No-text Hook review cannot contain caption blocks: ${item.id}`);
    ReferenceTextSchema.parse(text);
    if (text.format !== "hook" || text.sourceSha256 !== item.videoSha256 || text.blocks.some(block => block.endMs > Math.ceil(item.durationSeconds * 1000) + 100)) throw new Error(`Hook text does not match its video: ${item.id}`);
  }
  return { eligible, assets: [...assets.values()], excluded: release.excludedReferenceIds };
}
