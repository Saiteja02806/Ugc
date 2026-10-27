/** Explicit catalogue preparation: no user uploads, AI calls or publishing.
 * node --env-file=.env.local --import ./scripts/next-server-only-test-loader.mjs
 *   --experimental-transform-types scripts/prepare-hook-source-frames.mjs [--write]
 * Default is verification only. --write prepares missing ordinary public frames.
 */
import { getHookReferenceGalleryItems } from "../worker/src/lib/explore-hook-reference-release.ts";
import { hasCuratedHookFrame } from "../worker/src/lib/hook-curated-frames.ts";
import { createHookSourceFrameService } from "../lib/explore/hook-source-frame.ts";
import { createStoredHookFrames } from "../lib/explore/hook-source-frame-store.ts";
import { getHookFullRecreationPilot } from "../worker/src/lib/hook-full-recreation-pilot.ts";

const args = process.argv.slice(2);
if (args.some(arg => arg !== "--write")) throw new Error("Only --write is supported.");
const items = getHookReferenceGalleryItems().filter(item => !hasCuratedHookFrame(item.id) || getHookFullRecreationPilot(item.id, item.videoSha256));
const store = createStoredHookFrames();
const extract = createHookSourceFrameService({ items: () => items, useCuratedFrame: false });
let missing = 0;
for (const item of items) {
  const frame = args.includes("--write") ? await store.prepare(item.videoSha256, () => extract(item.id)) : await store.read(item.videoSha256);
  if (!frame) missing++;
  console.log(JSON.stringify({ referenceId: item.id, state: frame ? "ready" : "missing", frameSha256: frame?.frameSha256 }));
}
console.log(JSON.stringify({ total: items.length, missing, mode: args.includes("--write") ? "prepare" : "verify" }));
if (missing) process.exitCode = 1;
