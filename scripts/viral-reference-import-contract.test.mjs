import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const importer = readFileSync("scripts/import-viral-references.mjs", "utf8");
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));

test("Viral importer is a local, confirmation-gated command", () => {
  assert.match(packageJson.scripts["viral:import"], /import-viral-references\.mjs/);
  assert.match(importer, /execute && !args\.yes/);
  assert.match(importer, /Dry run complete\. No Supabase row was changed\./);
});

test("Viral importer stores only official embed references as pending review", () => {
  assert.match(importer, /prepareInstagramReelImports/);
  assert.match(importer, /\.from\("viral_references"\)/);
  assert.match(importer, /ignoreDuplicates: true/);
  assert.doesNotMatch(importer, /\.storage\s*\.|download\s*\(|fetch\([^)]*\.mp4/i);
  assert.doesNotMatch(importer, /viral_hook_config|hook_start_ms|hook_end_ms/);
});

test("Viral importer does not create a frontend or public API boundary", () => {
  assert.doesNotMatch(importer, /app\/api|NextRequest|NextResponse|use client/);
});
