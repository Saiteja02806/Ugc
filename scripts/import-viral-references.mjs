import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import {
  MAX_VIRAL_IMPORT_FILE_BYTES,
  parseInstagramPostInput,
  parseInstagramReelInput,
  prepareInstagramReelImports,
} from "../lib/viral/instagram-reel-import.ts";

loadEnvFile(path.resolve(".env.local"));

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  printHelp();
  process.exit(0);
}

const execute = Boolean(args.execute);
const section = parseSection(args.section);
if (execute && !args.yes) {
  throw new Error(
    "Refusing to write without --yes. Run the dry-run first, then use --execute --yes.",
  );
}
if (!execute && args.yes) {
  throw new Error("--yes is only valid together with --execute.");
}

const inputPath = resolveInputPath(args.file);
const inputText = readSafeInputFile(inputPath);
const parsedInput =
  section === "slideshow"
    ? parseInstagramPostInput(inputText)
    : parseInstagramReelInput(inputText);

if (parsedInput.reels.length === 0) {
  printInputSummary(parsedInput);
  throw new Error("The input file contains no valid Instagram URLs.");
}

const supabase = createClient(
  getRequiredEnv("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"),
  getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
  { auth: { autoRefreshToken: false, persistSession: false } },
);

await assertRemoteSchemaReady();
const existingReferences = await loadExistingReferences(
  parsedInput.reels.map((reel) => reel.sourceUrl),
);
const preparation = await prepareInstagramReelImports(parsedInput.reels, {
  existingSourceUrls: new Set(existingReferences.keys()),
  section,
});

printPlan({
  execute,
  existingReferences,
  inputPath,
  parsedInput,
  preparation,
  section,
});

if (!execute) {
  console.log("Dry run complete. No Supabase row was changed.");
  if (parsedInput.rejected.length + preparation.rejected.length > 0) {
    process.exitCode = 1;
  }
} else if (preparation.prepared.length === 0) {
  console.log("Nothing to import. No Supabase row was changed.");
  if (parsedInput.rejected.length + preparation.rejected.length > 0) {
    process.exitCode = 1;
  }
} else {
  const { data, error } = await supabase
    .from("viral_references")
    .upsert(preparation.prepared, {
      ignoreDuplicates: true,
      onConflict: "source_url",
    })
    .select("id,source_url,section,publish_status");

  if (error) {
    throw new Error(`Could not save Viral references: ${error.message}`);
  }

  const importedRows = Array.isArray(data) ? data : [];
  const importedSourceUrls = new Set(
    importedRows.map((row) => String(row.source_url)),
  );
  const concurrentDuplicates = preparation.prepared
    .map((row) => row.source_url)
    .filter((sourceUrl) => !importedSourceUrls.has(sourceUrl));

  const verifiedReferences = await loadExistingReferences(
    preparation.prepared.map((row) => row.source_url),
  );
  const missingReferences = preparation.prepared.filter(
    (row) => !verifiedReferences.has(row.source_url),
  );
  const wrongSectionReferences = preparation.prepared.filter(
    (row) => verifiedReferences.get(row.source_url)?.section !== section,
  );

  if (missingReferences.length > 0 || wrongSectionReferences.length > 0) {
    throw new Error(
      `Post-import verification failed: ${missingReferences.length} missing and ${wrongSectionReferences.length} stored in a different section.`,
    );
  }

  console.log("");
  console.log(
    `Import complete: ${importedRows.length} imported as pending_review in ${section}, ${concurrentDuplicates.length} skipped because another process inserted them first.`,
  );
  console.log(
    `Verified ${preparation.prepared.length} prepared reference(s) in ${section}.`,
  );
  console.log("No underlying Instagram media file was downloaded or stored.");

  if (parsedInput.rejected.length + preparation.rejected.length > 0) {
    process.exitCode = 1;
  }
}

async function assertRemoteSchemaReady() {
  const { error } = await supabase.from("viral_references").select("id").limit(1);
  if (!error) return;

  if (error.code === "42P01" || /viral_references/i.test(error.message)) {
    throw new Error(
      "The viral_references table is not available. Apply migration 20260812112037_create_viral_hook_data_foundation.sql before importing.",
    );
  }

  throw new Error(`Could not verify the Viral import schema: ${error.message}`);
}

async function loadExistingReferences(sourceUrls) {
  const { data, error } = await supabase
    .from("viral_references")
    .select("source_url,section")
    .in("source_url", sourceUrls);

  if (error) {
    throw new Error(`Could not check existing Viral references: ${error.message}`);
  }

  return new Map(
    (data ?? []).map((row) => [
      String(row.source_url),
      { section: String(row.section) },
    ]),
  );
}

function printPlan({
  execute: shouldExecute,
  existingReferences,
  inputPath: filePath,
  parsedInput,
  preparation,
  section: selectedSection,
}) {
  console.log(`Viral ${formatSectionLabel(selectedSection)} reference import`);
  console.log(`Mode: ${shouldExecute ? "EXECUTE" : "DRY RUN"}`);
  console.log(`Section: ${selectedSection}`);
  console.log(`Input: ${filePath}`);
  console.log(`Valid unique URLs: ${parsedInput.reels.length}`);
  console.log(`Duplicate lines in file: ${parsedInput.duplicateInputs.length}`);
  console.log(`Already in database: ${preparation.duplicateDatabaseUrls.length}`);
  console.log(`Ready to import: ${preparation.prepared.length}`);
  console.log(
    `Rejected: ${parsedInput.rejected.length + preparation.rejected.length}`,
  );

  for (const row of preparation.prepared) {
    console.log(`  READY ${row.source_url}`);
  }
  for (const sourceUrl of preparation.duplicateDatabaseUrls) {
    const existingSection = existingReferences.get(sourceUrl)?.section;
    console.log(
      `  SKIP  ${sourceUrl} (already imported in ${existingSection ?? "an unknown section"})`,
    );
  }
  for (const duplicate of parsedInput.duplicateInputs) {
    console.log(
      `  SKIP  line ${duplicate.lineNumber}: ${duplicate.sourceUrl} (duplicate input)`,
    );
  }
  for (const rejection of [
    ...parsedInput.rejected,
    ...preparation.rejected,
  ]) {
    console.log(
      `  REJECT line ${rejection.lineNumber}: ${rejection.input} (${rejection.reason})`,
    );
  }
  console.log("");
}

function printInputSummary(parsedInput) {
  console.log(`Viral ${formatSectionLabel(section)} reference import`);
  console.log(`Valid unique URLs: ${parsedInput.reels.length}`);
  console.log(`Duplicate lines in file: ${parsedInput.duplicateInputs.length}`);
  console.log(`Rejected: ${parsedInput.rejected.length}`);
  for (const rejection of parsedInput.rejected) {
    console.log(
      `  REJECT line ${rejection.lineNumber}: ${rejection.input} (${rejection.reason})`,
    );
  }
}

function readSafeInputFile(filePath) {
  if (!existsSync(filePath)) {
    throw new Error(`Input file does not exist: ${filePath}`);
  }

  const stats = statSync(filePath);
  if (!stats.isFile()) {
    throw new Error(`Input path is not a file: ${filePath}`);
  }
  if (stats.size > MAX_VIRAL_IMPORT_FILE_BYTES) {
    throw new Error(
      `Input file is too large. The safe limit is ${MAX_VIRAL_IMPORT_FILE_BYTES} bytes.`,
    );
  }

  return readFileSync(filePath, "utf8");
}

function resolveInputPath(value) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(
      "Missing --file. Example: npm run viral:import -- --file scripts/data/viral-hook-reels.txt",
    );
  }
  return path.resolve(value);
}

function parseArgs(rawArgs) {
  const parsed = {};
  const booleanFlags = new Set(["execute", "help", "yes"]);
  const valueFlags = new Set(["file", "section"]);

  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];
    if (!arg.startsWith("--")) {
      throw new Error(`Unexpected positional argument: ${arg}`);
    }

    const key = arg.slice(2);
    if (booleanFlags.has(key)) {
      parsed[key] = true;
      continue;
    }
    if (!valueFlags.has(key)) {
      throw new Error(`Unknown option: --${key}`);
    }

    const next = rawArgs[index + 1];
    if (!next || next.startsWith("--")) {
      throw new Error(`Missing value for --${key}.`);
    }
    parsed[key] = next;
    index += 1;
  }

  return parsed;
}

function parseSection(value) {
  const selectedSection = value ?? "hook_video";
  if (
    selectedSection !== "hook_video" &&
    selectedSection !== "wall_of_text" &&
    selectedSection !== "slideshow"
  ) {
    throw new Error(
      "Invalid --section. Use hook_video, wall_of_text, or slideshow.",
    );
  }
  return selectedSection;
}

function formatSectionLabel(selectedSection) {
  if (selectedSection === "wall_of_text") return "Wall of Text";
  if (selectedSection === "slideshow") return "Slideshow";
  return "Hook Video";
}

function printHelp() {
  console.log(`Usage:
  npm run viral:import -- --file <path> [--section hook_video|wall_of_text|slideshow]
  npm run viral:import -- --file <path> [--section hook_video|wall_of_text|slideshow] --execute --yes

The default mode is a read-only dry run. The importer accepts direct public
Instagram Reel URLs for Hook Videos and Wall of Text, or Instagram /p/ post
URLs for Slideshows. It retrieves one official Meta embed per source post and
never downloads or stores the underlying media. The default section is
hook_video.`);
}

function getRequiredEnv(...names) {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  throw new Error(`Missing required environment variable: ${names.join(" or ")}`);
}

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;

  const content = readFileSync(filePath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separator = line.indexOf("=");
    if (separator < 1) continue;

    const key = line.slice(0, separator).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) || process.env[key]) continue;

    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}
