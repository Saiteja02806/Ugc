// Non-build, public GET only. Writes a review candidate; never changes the active registry.
// node --experimental-transform-types scripts/retrieve-public-reference-views.mjs <catalog.json> <output.json>
import { readFileSync, writeFileSync } from "node:fs";
import { canonicalHookSource } from "../worker/src/lib/explore-instagram-source.ts";
import { readPublicVideoViews } from "../lib/explore/public-video-views.ts";
import { formatReferenceViews } from "../lib/explore/video-reference-feed.ts";

const [inputPath, outputPath] = process.argv.slice(2);
if (!inputPath || !outputPath) throw new Error("Provide a catalogue inventory and candidate output path.");
const input = JSON.parse(readFileSync(inputPath, "utf8"));
if (!Array.isArray(input)) throw new Error("Expected a reference array.");
const urls = [...new Set(input.map(item => canonicalHookSource(item.sourceUrl ?? item.instagramUrl)?.url).filter(Boolean))];
const results = [], items = [];
let cursor = 0;
async function next() {
  while (cursor < urls.length) {
    const sourceUrl = urls[cursor++];
    try {
      const response = await fetch(sourceUrl, { signal: AbortSignal.timeout(6000), redirect: "error", headers: { "User-Agent": "Mozilla/5.0", Accept: "text/html" } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const reader = response.body.getReader();
      let size = 0;
      const chunks = [];
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        size += part.value.length;
        if (size > 8 * 1024 ** 2) { await reader.cancel(); throw new Error("Public response too large"); }
        chunks.push(part.value);
      }
      const count = readPublicVideoViews(Buffer.concat(chunks).toString("utf8"), sourceUrl);
      if (count === undefined) throw new Error("Matching source-post view metric unavailable");
      const entry = { sourceUrl, viewCount: count, formattedViews: formatReferenceViews(count), verifiedLive: true, retrievedAt: new Date().toISOString(), provider: "public-post-json" };
      items.push(entry); results.push({ sourceUrl, status: "retrieved", viewCount: count });
    } catch (error) { results.push({ sourceUrl, status: "unavailable", reason: error instanceof Error && /^(HTTP|Matching|Public)/.test(error.message) ? error.message : "Public source request failed or timed out" }); }
  }
}
await Promise.all(Array.from({ length: 16 }, next));
writeFileSync(outputPath, JSON.stringify({ version: 1, checkedAt: new Date().toISOString(), items, results }, null, 2) + "\n");
console.log(JSON.stringify({ checked: urls.length, retrieved: items.length, unavailable: results.length - items.length }));
