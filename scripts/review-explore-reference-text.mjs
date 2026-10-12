import { existsSync, readFileSync } from "node:fs";
import { z } from "zod";
import { ReferenceTextBlockSchema, ReferenceTextSchema, referenceTextKey } from "../lib/explore/reference-text.ts";
import { sourceInventory } from "./explore-reference-text-inventory.mjs";
import { atomicJsonSync } from "./reference-text-atomic-write.mjs";

const file = process.argv[2];
if (!file) throw new Error("Supply a JSON file of visually reviewed text. Do not run while extraction is writing the catalogue.");
if (existsSync(".tmp/explore-reference-text-local/extract-v2.lock")) throw new Error("Extraction is still active. Save the review file and apply it after extraction completes.");
const reviewed = z.object({ items: z.array(z.object({ referenceId: z.string(), slideId: z.string().nullable(), sourceSha256: z.string(), status: z.enum(["ready", "no_text"]), blocks: z.array(ReferenceTextBlockSchema), notes: z.string().min(1).max(700) }).strict()).min(1) }).strict().parse(JSON.parse(readFileSync(file, "utf8")));
const cataloguePath = "lib/explore/reference-text-catalog.json", catalogue = JSON.parse(readFileSync(cataloguePath, "utf8"));
const originals = new Map(sourceInventory().flatMap(ref => ref.units.map(unit => [referenceTextKey(ref.referenceId, unit.slideId), unit.hash])));
const items = new Map(catalogue.items.map(item => [referenceTextKey(item.referenceId,item.slideId), ReferenceTextSchema.parse(item)]));
const seen = new Set();
for (const review of reviewed.items) {
  const key = referenceTextKey(review.referenceId,review.slideId), current = items.get(key);
  if (seen.has(key) || !current || current.sourceSha256 !== review.sourceSha256 || originals.get(key) !== review.sourceSha256) throw new Error("Review must match one unique saved source and its current fingerprint.");
  if (review.status === "no_text" && review.blocks.length) throw new Error("No-text review cannot contain text.");
  seen.add(key);
  items.set(key, ReferenceTextSchema.parse({ ...current, ...review, notes: `Visually reviewed ${new Date().toISOString()}. ${review.notes}` }));
}
atomicJsonSync(cataloguePath, {version:1,items:[...items.values()]});
console.log(JSON.stringify({reviewed:seen.size,ready:[...items.values()].filter(i=>i.status==="ready").length}));
