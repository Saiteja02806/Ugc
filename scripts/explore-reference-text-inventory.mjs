import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Local catalogue identity inventory; no credentials, provider imports or calls. */
export function sourceInventory() {
  const catalog = JSON.parse(readFileSync(path.join(root, "lib/explore/imported-catalog.json"), "utf8"));
  const refs = catalog.mediaStatus === "published" ? catalog.items.map(item => ({ referenceId: item.id, format: item.format,
    units: item.format === "slideshow" ? item.slides.map(s => ({ slideId: s.id, key: `explore/recreate/v1/${s.file}`, hash: s.file.split(".")[0] }))
      : [{ slideId: null, key: `explore/recreate/v1/${item.videoFile}`, hash: item.videoFile.split(".")[0] }] })) : [];
  for (const [file, format] of [["hook-video-library.ts", "hook"], ["wall-text-video-library.ts", "wall_text"]]) {
    const source = readFileSync(path.join(root, "lib/explore", file), "utf8");
    for (const match of source.matchAll(/id:\s*"(explore-(?:hook|wall-text)-\d+)"[\s\S]*?sourceFileSha256:\s*"([a-f0-9]{64})"/g)) {
      refs.push({ referenceId: match[1], format, units: [{ slideId: null, hash: match[2], key: `${format === "hook" ? "explore/hook-videos/2026-08-29" : "explore/wall-text-videos/2026-09-03"}/${match[2]}.mp4` }] });
    }
  }
  const pairedPath = path.join(root, "worker/src/lib/explore-paired-reference-catalog.json");
  if (existsSync(pairedPath)) {
    const paired = JSON.parse(readFileSync(pairedPath, "utf8"));
    if (paired.mediaStatus === "published") for (const item of paired.items) {
      refs.push({ referenceId: item.id, format: item.format,
        units: [{ slideId: null, hash: item.videoSha256, key: item.videoStorageKey }] });
    }
  }
  if (new Set(refs.map(r => r.referenceId)).size !== refs.length) throw new Error("Duplicate source identities.");
  return refs;
}
