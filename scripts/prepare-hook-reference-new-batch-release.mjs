import { readFileSync } from "node:fs";
import path from "node:path";
import { prepareHookRelease } from "./prepare-hook-reference-release.mjs";

const sourceIndex = process.argv.indexOf("--source");
if (sourceIndex < 0 || !process.argv[sourceIndex + 1]) throw new Error("Supply --source with the new batch directory.");
// Folder 2 was corrected by the user to one MP4 and its supplied MP3.
// Folder 23 is empty and stays out of the import.
const includedFolders = ["New folder", ...Array.from({ length: 21 }, (_, i) => `New folder (${i + 2})`)];
const result = await prepareHookRelease({
  source: process.argv[sourceIndex + 1], stage: process.argv.includes("--stage"),
  includedFolders, sourcePolicy: "optional", titleStart: 76,
  manifestPath: path.resolve("worker/src/lib/explore-hook-reference-new-batch-release.json"),
  checksPath: path.resolve(".tmp/hook-new-batch/checks.json"),
});
const previous = ["explore-hook-reference-release.json", "explore-hook-reference-addition-release.json"]
  .flatMap(file => JSON.parse(readFileSync(path.join("worker/src/lib", file), "utf8")).items);
if (result.manifest.items.some(item => previous.some(old => old.id === item.id || old.videoSha256 === item.videoSha256))) throw new Error("A new video duplicates an existing reference; review before publishing.");
console.log(JSON.stringify({ count: result.manifest.items.length, skippedFolders: ["New folder (23)"], mediaStatus: result.manifest.mediaStatus, checks: result.checks }, null, 2));
