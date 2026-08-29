import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const repositoryRoot = resolve(import.meta.dirname, "..");
const canonicalMigrations = resolve(repositoryRoot, "supabase", "migrations");
const evidenceMigrations = resolve(
  repositoryRoot,
  "supabase",
  "supabase",
  "migrations",
);
const reconciliationLock = resolve(
  repositoryRoot,
  "supabase",
  "MIGRATION_RECONCILIATION_LOCK.md",
);

const failures = [];

if (!existsSync(canonicalMigrations)) {
  failures.push("The canonical supabase/migrations directory is missing.");
} else {
  const versions = new Map();

  for (const filename of readdirSync(canonicalMigrations)) {
    const match = /^(\d+)_.+\.sql$/u.exec(filename);
    if (!match) continue;

    const version = match[1];
    const previous = versions.get(version);
    if (previous) {
      failures.push(
        `Duplicate canonical migration version ${version}: ${previous} and ${filename}.`,
      );
    } else {
      versions.set(version, filename);
    }
  }

  if (versions.size === 0) {
    failures.push("The canonical supabase/migrations directory has no SQL migrations.");
  }
}

if (existsSync(reconciliationLock)) {
  failures.push(
    "Migration releases are frozen by supabase/MIGRATION_RECONCILIATION_LOCK.md until the production-history reconciliation is reset-tested in an isolated database.",
  );
}

if (existsSync(evidenceMigrations)) {
  failures.push(
    "The nested supabase/supabase/migrations evidence directory still exists. Do not treat it as a second migration source or remove it before the canonical history is proven.",
  );
}

if (failures.length > 0) {
  console.error("Supabase migration release blocked:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log("Supabase migration reconciliation guard passed.");
}
