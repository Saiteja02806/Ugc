import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

export async function checkLightweightCatalogueTraces() {
  for (const route of ["mcp/health", ".well-known/oauth-protected-resource/mcp"]) {
    const { files } = JSON.parse(await readFile(`.next/server/app/${route}/route.js.nft.json`, "utf8"));
    assert.ok(!files.some(file => /\/lib\/explore\/creator-[^/]+\.json\.enc$/.test(file.replaceAll("\\", "/"))), `${route}: unused encrypted catalogue included`);
  }
  // The real tool endpoint must still carry every encrypted catalogue required
  // by its dynamic file reader; optimization must not disable private references.
  const { files } = JSON.parse(await readFile(".next/server/app/mcp/route.js.nft.json", "utf8"));
  for (const name of ["creator-accounts", "creator-account-reviews", "creator-middle-frame-prompts", "creator-slideshows", "creator-slide-text"]) {
    assert.ok(files.some(file => file.replaceAll("\\", "/").endsWith(`/lib/explore/${name}.json.enc`)), `mcp: ${name} catalogue missing`);
  }
  console.log("MCP encrypted catalogues retained only in their consuming endpoint, absent from health/discovery.");
}
