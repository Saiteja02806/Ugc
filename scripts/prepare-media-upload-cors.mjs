import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const VIDMAKE_UPLOAD_ORIGINS = ["https://vidmake.io", "https://www.vidmake.io"];

/** Prepare an additive policy from a captured bucket configuration. Never applies it. */
export function prepareMediaUploadCors(config) {
  const rules = Array.isArray(config) ? config : config?.cors_config;
  if (!Array.isArray(rules) || !rules.length) throw Error("Provide the current bucket CORS rules before preparing a change.");
  const next = structuredClone(rules);
  const uploadRule = next.find(rule => Array.isArray(rule.method) && rule.method.includes("PUT") && Array.isArray(rule.origin));
  if (!uploadRule) throw Error("No existing PUT rule was found. Review the bucket configuration manually.");
  uploadRule.origin = [...new Set([...uploadRule.origin, ...VIDMAKE_UPLOAD_ORIGINS])];
  return next;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [input, output] = process.argv.slice(2);
  if (!input || !output || input === output) throw Error("Usage: node scripts/prepare-media-upload-cors.mjs <captured-bucket.json> <reviewed-cors.json>");
  writeFileSync(output, JSON.stringify(prepareMediaUploadCors(JSON.parse(readFileSync(input, "utf8"))), null, 2) + "\n", { flag: "wx" });
  console.log(`Prepared ${output}. No bucket configuration was changed.`);
}
