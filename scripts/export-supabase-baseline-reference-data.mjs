import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const [outputFileArg, pgModuleRootArg, expectedProjectRef] = process.argv.slice(2);

if (!outputFileArg || !pgModuleRootArg || !expectedProjectRef) {
  throw new Error(
    "Usage: node scripts/export-supabase-baseline-reference-data.mjs <output-file> <pg-module-root> <expected-project-ref>",
  );
}

const connectionString = process.env.UGC_BASELINE_REFERENCE_DB_URL;
if (!connectionString || !process.env.PGPASSWORD) {
  throw new Error("The production database URL and process-only password are required.");
}

const databaseUrl = new URL(connectionString);
if (!databaseUrl.username.includes(expectedProjectRef)) {
  throw new Error("Safety stop: database URL does not match the expected project.");
}

if (!databaseUrl.hostname.endsWith(".pooler.supabase.com")) {
  throw new Error("Safety stop: database host is not a Supabase pooler.");
}

const referenceTables = [
  { name: "hook_formats", orderBy: "id" },
  { name: "hook_text_formats", orderBy: "id" },
  { name: "hook_text_format_variants", orderBy: "id" },
  { name: "hook_text_format_evidence", orderBy: "hook_text_format_id, id" },
  { name: "carousel_global_settings", orderBy: "singleton" },
];

async function main() {
  const requireFromModuleRoot = createRequire(
    path.resolve(pgModuleRootArg, "ugc-pg-loader.cjs"),
  );
  const pg = requireFromModuleRoot("pg");
  const client = new pg.Client({
    connectionString,
    password: process.env.PGPASSWORD,
    application_name: "ugc_baseline_reference_data_export",
    ssl: { rejectUnauthorized: false },
  });

  const sections = [
    "-- Static, non-user reference data captured from the verified production baseline.",
    "-- Media catalogs, user rows, billing rows, jobs, and outboxes are intentionally excluded.",
    "",
  ];
  const rowCounts = {};

  try {
    await client.connect();
    await client.query("begin transaction read only");
    await client.query("set local statement_timeout = '30s'");

    for (const table of referenceTables) {
      const result = await client.query(
        `select * from public.${table.name} order by ${table.orderBy}`,
      );
      rowCounts[table.name] = result.rowCount;
      const json = JSON.stringify(result.rows).replaceAll("'", "''");
      sections.push(
        `insert into public.${table.name}`,
        `select * from jsonb_populate_recordset(null::public.${table.name}, '${json}'::jsonb);`,
        "",
      );
    }

    await client.query("rollback");
  } finally {
    await client.end().catch(() => undefined);
  }

  const output = `${sections.join("\n").trim()}\n`;
  const outputFile = path.resolve(outputFileArg);
  await writeFile(outputFile, output, "utf8");
  const sha256 = createHash("sha256").update(output).digest("hex");

  process.stdout.write(
    `${JSON.stringify({
      outputFile,
      productionWrites: false,
      transactionMode: "read only",
      rowCounts,
      bytes: Buffer.byteLength(output),
      sha256,
    })}\n`,
  );
}

main().catch((error) => {
  process.stderr.write(
    `${JSON.stringify({ message: error.message, code: error.code, table: error.table })}\n`,
  );
  process.exitCode = 1;
});
