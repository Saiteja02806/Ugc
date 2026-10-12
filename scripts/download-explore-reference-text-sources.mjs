// Read-only download of the exact already-published catalogue media. No AI calls.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { sourceInventory } from "./explore-reference-text-inventory.mjs";
import { buildPublicStorageUrl } from "../lib/storage/storage.ts";
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(path.resolve("."));

const target = path.resolve(".tmp/explore-catalog/media");
mkdirSync(target, { recursive: true });
let downloaded = 0;
for (const unit of sourceInventory().flatMap(r => r.units)) {
  const file = path.join(target, path.basename(unit.key));
  if (existsSync(file)) continue;
  const response = await fetch(buildPublicStorageUrl(unit.key), { redirect: "error", signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error(`Catalogue media unavailable: HTTP ${response.status}`);
  const chunks = []; let size = 0;
  for await (const chunk of response.body) { size += chunk.length; if (size > 100 * 1024 * 1024) throw new Error("Source exceeds byte limit."); chunks.push(chunk); }
  const bytes = Buffer.concat(chunks);
  if (createHash("sha256").update(bytes).digest("hex") !== unit.hash) throw new Error("Source fingerprint mismatch.");
  writeFileSync(file, bytes); downloaded++;
}
console.log(JSON.stringify({ downloaded, destination: ".tmp/explore-catalog/media", uploads: 0, providerRequests: 0 }));
