import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const [outputFileArg, pgModuleRootArg, expectedProjectRef] = process.argv.slice(2);

if (!outputFileArg || !pgModuleRootArg || !expectedProjectRef) {
  throw new Error(
    "Usage: node scripts/export-supabase-migration-ledger.mjs <output-file> <pg-module-root> <expected-project-ref>",
  );
}

const connectionString = process.env.UGC_MIGRATION_LEDGER_DB_URL;
if (!connectionString || !process.env.PGPASSWORD) {
  throw new Error("The database URL and process-only password are required.");
}

const databaseUrl = new URL(connectionString);
if (!databaseUrl.username.includes(expectedProjectRef)) {
  throw new Error("Safety stop: database URL does not match the expected project.");
}

if (!databaseUrl.hostname.endsWith(".pooler.supabase.com")) {
  throw new Error("Safety stop: database host is not a Supabase pooler.");
}

async function main() {
  const requireFromModuleRoot = createRequire(
    path.resolve(pgModuleRootArg, "ugc-pg-loader.cjs"),
  );
  const pg = requireFromModuleRoot("pg");
  const client = new pg.Client({
    connectionString,
    password: process.env.PGPASSWORD,
    application_name: "ugc_migration_ledger_read_only_export",
    ssl: { rejectUnauthorized: false },
  });

  let rows = [];
  try {
    await client.connect();
    await client.query("begin transaction read only");
    await client.query("set local statement_timeout = '30s'");
    const result = await client.query(`
      select version, name, statements
      from supabase_migrations.schema_migrations
      order by version
    `);
    rows = result.rows;
    await client.query("rollback");
  } finally {
    await client.end().catch(() => undefined);
  }

  const payload = `${JSON.stringify(
    {
      format: "ugc-supabase-migration-ledger-v1",
      expectedProjectRef,
      exportedAt: new Date().toISOString(),
      migrations: rows,
    },
    null,
    2,
  )}\n`;
  const outputFile = path.resolve(outputFileArg);
  await writeFile(outputFile, payload, "utf8");

  process.stdout.write(
    `${JSON.stringify({
      outputFile,
      databaseWrites: false,
      transactionMode: "read only",
      migrationCount: rows.length,
      firstVersion: rows.at(0)?.version ?? null,
      lastVersion: rows.at(-1)?.version ?? null,
      bytes: Buffer.byteLength(payload),
      sha256: createHash("sha256").update(payload).digest("hex"),
    })}\n`,
  );
}

main().catch((error) => {
  process.stderr.write(
    `${JSON.stringify({ message: error.message, code: error.code })}\n`,
  );
  process.exitCode = 1;
});
