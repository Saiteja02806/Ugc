import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function compareMigrationVersions(filenames, migrations) {
  const failures = [];
  const local = new Map();
  const remote = new Set();
  for (const filename of filenames) {
    if (!filename.endsWith(".sql")) continue;
    const match = /^(\d{14})_.+\.sql$/u.exec(filename);
    if (!match) {
      failures.push(`Invalid migration filename: ${filename}`);
      continue;
    }
    if (local.has(match[1])) failures.push(`Duplicate Git migration version: ${match[1]}`);
    local.set(match[1], filename);
  }
  for (const migration of migrations) {
    if (!/^\d{14}$/u.test(migration.version ?? "")) {
      failures.push("Invalid production migration version.");
      continue;
    }
    if (remote.has(migration.version)) failures.push(`Duplicate production migration version: ${migration.version}`);
    remote.add(migration.version);
  }
  if (local.size === 0 || remote.size === 0) failures.push("Git and production histories must both be nonempty.");
  for (const [version, filename] of local) {
    if (!remote.has(version)) failures.push(`Missing production history entry: ${filename}`);
  }
  for (const version of remote) {
    if (!local.has(version)) failures.push(`Production migration missing from Git: ${version}`);
  }
  return failures;
}

export function validateLedgerExport(ledger, expectedProjectRef, now = Date.now()) {
  if (ledger.format !== "ugc-supabase-migration-ledger-v1" || !Array.isArray(ledger.migrations)) {
    throw new Error("Expected a complete migration-ledger export.");
  }
  if (!expectedProjectRef || ledger.expectedProjectRef !== expectedProjectRef) {
    throw new Error("Migration export project does not match the requested project.");
  }
  const age = now - Date.parse(ledger.exportedAt);
  if (!Number.isFinite(age) || age < -60_000 || age > 60 * 60_000) {
    throw new Error("Migration export must be from the last hour; export production again.");
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [ledgerPath, expectedProjectRef] = process.argv.slice(2);
    if (!ledgerPath || !expectedProjectRef) {
      throw new Error("Usage: node scripts/check-supabase-migration-parity.mjs <ledger-json> <expected-project-ref>");
    }
    const ledger = JSON.parse(readFileSync(resolve(ledgerPath), "utf8"));
    validateLedgerExport(ledger, expectedProjectRef);
    const filenames = readdirSync(resolve(import.meta.dirname, "../supabase/migrations"));
    const failures = compareMigrationVersions(filenames, ledger.migrations);
    if (failures.length) throw new Error(failures.join("\n"));
    console.log(`Migration version parity verified: ${ledger.migrations.length} Git and production entries. This does not verify schema or SQL equivalence.`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
