import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const [sqlFileArg, pgModuleRootArg, expectedProjectRef] = process.argv.slice(2);

if (!sqlFileArg || !pgModuleRootArg || !expectedProjectRef) {
  throw new Error(
    "Usage: node scripts/run-supabase-baseline-rehearsal.mjs <sql-file> <pg-module-root> <expected-project-ref>",
  );
}

const connectionString = process.env.UGC_BASELINE_REHEARSAL_DB_URL;
if (!connectionString) {
  throw new Error("UGC_BASELINE_REHEARSAL_DB_URL is required.");
}

const databaseUrl = new URL(connectionString);
if (!databaseUrl.username.includes(expectedProjectRef)) {
  throw new Error("Safety stop: the database URL is not for the expected disposable project.");
}

if (!databaseUrl.hostname.endsWith(".pooler.supabase.com")) {
  throw new Error("Safety stop: the database host is not a Supabase pooler.");
}

if (!process.env.PGPASSWORD) {
  throw new Error("PGPASSWORD is required and must be supplied only for this process.");
}

async function main() {
  const sqlFile = path.resolve(sqlFileArg);
  const sql = await readFile(sqlFile, "utf8");
  const executableLines = sql
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);

  if (executableLines[0]?.toLowerCase() !== "begin;") {
    throw new Error("Safety stop: rehearsal must begin with BEGIN.");
  }

  if (executableLines.at(-1)?.toLowerCase() !== "rollback;") {
    throw new Error("Safety stop: rehearsal must end with ROLLBACK.");
  }

  if (executableLines.some((line) => /^commit\s*;$/iu.test(line))) {
    throw new Error("Safety stop: rehearsal contains COMMIT.");
  }

  const requireFromModuleRoot = createRequire(
    path.resolve(pgModuleRootArg, "ugc-pg-loader.cjs"),
  );
  const pg = requireFromModuleRoot("pg");
  const client = new pg.Client({
    connectionString,
    password: process.env.PGPASSWORD,
    application_name: "ugc_baseline_transactional_rehearsal",
    // Supabase transaction/session pooler certificates may use a chain that is
    // not present in the local Node trust store. Host and project identity are
    // checked above before allowing this disposable-project-only connection.
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    const result = await client.query(sql);
    const results = Array.isArray(result) ? result : [result];
    const validation = results
      .flatMap((item) => item.rows ?? [])
      .find((row) => row.baseline_validation)?.baseline_validation;

    if (!validation) {
      throw new Error("Baseline validation result was not returned.");
    }

    process.stdout.write(
      `${JSON.stringify({
        databaseIdentityVerified: true,
        transactionRolledBack: true,
        validation,
      })}\n`,
    );
  } finally {
    await client.end().catch(() => undefined);
  }
}

main().catch((error) => {
  process.stderr.write(
    `${JSON.stringify({
      message: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
      position: error.position,
      internalPosition: error.internalPosition,
      where: error.where,
      schema: error.schema,
      table: error.table,
      constraint: error.constraint,
    })}\n`,
  );
  process.exitCode = 1;
});
