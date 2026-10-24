import path from "node:path";
import { fileURLToPath } from "node:url";
import { prepareHookRelease } from "./prepare-hook-reference-release.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceIndex = process.argv.indexOf("--source");
if (sourceIndex < 0 || !process.argv[sourceIndex + 1]) throw new Error("Supply --source with the folder that contains the complete Hook sets.");
const requestedFolders = [
  "New folder (11)", "New folder (12)", "New folder (13)", "New folder (14)",
  "New folder (3)", "New folder (4)", "New folder (5)", "New folder (6)", "New folder (7)", "New folder (8)", "New folder (9)", "New folder (10)",
  "New folder (20)", "New folder (21)", "New folder (22)", "New folder (18)", "New folder (19)",
  "New folder (33)", "New folder (26)", "New folder (27)", "New folder (28)", "New folder (29)", "New folder (30)", "New folder (31)", "New folder (32)",
  "New folder (39)", "New folder (45)", "New folder (46)", "New folder (47)", "New folder (48)", "New folder (43)", "New folder (44)", "New folder (17)",
];
// These two supplied folders cannot yet produce a safe paired reference: 45
// lacks its standalone audio, and 44 contains four video candidates but no
// paired audio. They are intentionally kept out until their source is chosen.
const skippedFolders = ["New folder (44)", "New folder (45)"];
const includedFolders = requestedFolders.filter(folder => !skippedFolders.includes(folder));

const result = await prepareHookRelease({
  source: process.argv[sourceIndex + 1],
  stage: process.argv.includes("--stage"),
  includedFolders,
  sourcePolicy: "optional",
  titleStart: 45,
  manifestPath: path.join(root, "worker/src/lib/explore-hook-reference-addition-release.json"),
  checksPath: path.join(root, ".tmp/hook-reference-addition-release-checks.json"),
});
console.log(JSON.stringify({ count: result.manifest.items.length, skippedFolders, mediaStatus: result.manifest.mediaStatus, checks: result.checks }, null, 2));
