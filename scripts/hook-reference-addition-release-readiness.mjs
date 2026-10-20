import { readFileSync } from "node:fs";
import { validateHookRelease } from "./hook-reference-release-readiness.mjs";

const manifestPath = "worker/src/lib/explore-hook-reference-addition-release.json";

export function validateHookAdditionRelease(release, textCatalog) {
  return validateHookRelease(release, textCatalog, { sourcePolicy: "optional" });
}

if (process.argv[1]?.endsWith("hook-reference-addition-release-readiness.mjs")) {
  const release = JSON.parse(readFileSync(manifestPath, "utf8"));
  const textCatalog = JSON.parse(readFileSync("lib/explore/reference-text-catalog.json", "utf8"));
  const { eligible, assets, excluded } = validateHookAdditionRelease(release, textCatalog);
  console.log(JSON.stringify({ hooks: eligible.length, excluded, objects: assets.length }));
}
