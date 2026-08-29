import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const [schemaDirectoryArg, outputFileArg, referenceDataFileArg, modeArg = "rehearsal"] =
  process.argv.slice(2);

if (!schemaDirectoryArg || !outputFileArg) {
  throw new Error(
    "Usage: node scripts/build-supabase-baseline-rehearsal.mjs <schema-directory> <output-file>",
  );
}

if (!new Set(["rehearsal", "baseline"]).has(modeArg)) {
  throw new Error(`Unsupported output mode: ${modeArg}`);
}

const schemaDirectory = path.resolve(schemaDirectoryArg);
const outputFile = path.resolve(outputFileArg);
const manifestPath = path.join(schemaDirectory, ".pgdelta-export.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

if (!Array.isArray(manifest.loadOrder) || manifest.loadOrder.length === 0) {
  throw new Error("The pg-delta export manifest has no load order.");
}

const entrySql = new Map();
for (const relativePath of manifest.loadOrder) {
  if (typeof relativePath !== "string" || !relativePath.endsWith(".sql")) {
    throw new Error(`Unexpected manifest entry: ${String(relativePath)}`);
  }

  const sourcePath = path.resolve(schemaDirectory, relativePath);
  const relativeCheck = path.relative(schemaDirectory, sourcePath);
  if (relativeCheck.startsWith("..") || path.isAbsolute(relativeCheck)) {
    throw new Error(`Manifest path escapes the schema directory: ${relativePath}`);
  }

  entrySql.set(relativePath, await readFile(sourcePath, "utf8"));
}

const tableEntries = manifest.loadOrder.filter(
  (entry) => entry.startsWith("public/tables/") && !entry.endsWith(".fk.sql"),
);
const deferredForeignKeyEntries = manifest.loadOrder.filter((entry) =>
  entry.endsWith(".fk.sql"),
);
const tableEntryByName = new Map(
  tableEntries.map((entry) => [path.basename(entry, ".sql"), entry]),
);
const originalIndex = new Map(manifest.loadOrder.map((entry, index) => [entry, index]));
const dependencies = new Map();

for (const entry of tableEntries) {
  const sql = entrySql.get(entry);
  const referencedTables = new Set();
  const referencePattern = /\bREFERENCES\s+(?:"public"|public)\.(?:"([^"]+)"|([a-zA-Z_][a-zA-Z0-9_]*))/giu;
  for (const match of sql.matchAll(referencePattern)) {
    const referencedTable = match[1] ?? match[2];
    if (tableEntryByName.has(referencedTable) && tableEntryByName.get(referencedTable) !== entry) {
      referencedTables.add(tableEntryByName.get(referencedTable));
    }
  }
  dependencies.set(entry, referencedTables);
}

const sortedTableEntries = [];
const remainingTableEntries = new Set(tableEntries);
while (remainingTableEntries.size > 0) {
  const ready = [...remainingTableEntries]
    .filter((entry) =>
      [...dependencies.get(entry)].every((dependency) => !remainingTableEntries.has(dependency)),
    )
    .sort((left, right) => originalIndex.get(left) - originalIndex.get(right));

  if (ready.length === 0) {
    throw new Error(
      `Foreign-key dependency cycle remains in table definitions: ${[
        ...remainingTableEntries,
      ].join(", ")}`,
    );
  }

  for (const entry of ready) {
    remainingTableEntries.delete(entry);
    sortedTableEntries.push(entry);
  }
}

const schemaEntries = manifest.loadOrder.filter((entry) => entry === "public/schema.sql");
const extensionEntries = manifest.loadOrder.filter((entry) =>
  entry.startsWith("_cluster/extensions/"),
);
const defaultPrivilegeEntries = manifest.loadOrder.filter((entry) =>
  entry.endsWith("default_privileges.sql"),
);
const functionEntries = manifest.loadOrder.filter((entry) =>
  entry.startsWith("public/functions/"),
);
const triggerFunctionEntries = functionEntries.filter((entry) =>
  /\bRETURNS\s+TRIGGER\b/iu.test(entrySql.get(entry)),
);
const nonTriggerFunctionEntries = functionEntries.filter(
  (entry) => !triggerFunctionEntries.includes(entry),
);
const categorizedEntries = new Set([
  ...schemaEntries,
  ...extensionEntries,
  ...defaultPrivilegeEntries,
  ...tableEntries,
  ...deferredForeignKeyEntries,
  ...functionEntries,
]);
const otherEntries = manifest.loadOrder.filter((entry) => !categorizedEntries.has(entry));
const orderedEntries = [
  ...schemaEntries,
  ...extensionEntries,
  ...defaultPrivilegeEntries,
  ...otherEntries,
  ...triggerFunctionEntries,
  ...sortedTableEntries,
  ...deferredForeignKeyEntries,
  ...nonTriggerFunctionEntries,
];

const sqlParts = [];
let tableCount = 0;
let functionCount = 0;
let triggerCount = 0;
let rlsTableCount = 0;

for (const relativePath of orderedEntries) {
  let sql = entrySql.get(relativePath);
  if (relativePath.startsWith("_cluster/extensions/")) {
    sql = sql.replace(/\bCREATE\s+EXTENSION\s+(?!IF\s+NOT\s+EXISTS)/iu, "CREATE EXTENSION IF NOT EXISTS ");
  }
  sqlParts.push(`\n-- source: ${relativePath}\n${sql.trim()}\n`);
  tableCount += (sql.match(/\bcreate\s+table\b/gi) ?? []).length;
  functionCount += (sql.match(/\bcreate\s+(?:or\s+replace\s+)?function\b/gi) ?? [])
    .length;
  triggerCount += (sql.match(/\bcreate\s+trigger\b/gi) ?? []).length;
  rlsTableCount += (sql.match(/\benable\s+row\s+level\s+security\b/gi) ?? [])
    .length;
}

const expected = {
  tables: tableCount,
  functions: functionCount,
  triggers: triggerCount,
  rlsTables: rlsTableCount,
};

let referenceDataSql = "";
const referenceRowCounts = {};
if (referenceDataFileArg) {
  referenceDataSql = await readFile(path.resolve(referenceDataFileArg), "utf8");
  const referenceInsertPattern =
    /insert into public\.([a-zA-Z_][a-zA-Z0-9_]*)\s+select \* from jsonb_populate_recordset\(null::public\.\1, '([^\n]*)'::jsonb\);/giu;
  for (const match of referenceDataSql.matchAll(referenceInsertPattern)) {
    referenceRowCounts[match[1]] = JSON.parse(match[2].replaceAll("''", "'")).length;
  }
  if (Object.keys(referenceRowCounts).length === 0) {
    throw new Error("Reference data file contained no recognized baseline inserts.");
  }
}

const referenceValidationSql = Object.entries(referenceRowCounts)
  .map(
    ([table, count]) => `
  if (select count(*) from public.${table}) <> ${count} then
    raise exception 'baseline_reference_count_mismatch:${table}';
  end if;`,
  )
  .join("\n");

const validationSql = `
do $baseline_validation$
declare
  actual_tables integer;
  actual_functions integer;
  actual_triggers integer;
  actual_rls_tables integer;
begin
  select count(*)::integer
  into actual_tables
  from pg_catalog.pg_class as relation
  join pg_catalog.pg_namespace as namespace on namespace.oid = relation.relnamespace
  where namespace.nspname = 'public'
    and relation.relkind in ('r', 'p');

  select count(*)::integer
  into actual_functions
  from pg_catalog.pg_proc as procedure
  join pg_catalog.pg_namespace as namespace on namespace.oid = procedure.pronamespace
  where namespace.nspname = 'public';

  select count(*)::integer
  into actual_triggers
  from pg_catalog.pg_trigger as trigger
  join pg_catalog.pg_class as relation on relation.oid = trigger.tgrelid
  join pg_catalog.pg_namespace as namespace on namespace.oid = relation.relnamespace
  where namespace.nspname = 'public'
    and not trigger.tgisinternal;

  select count(*)::integer
  into actual_rls_tables
  from pg_catalog.pg_class as relation
  join pg_catalog.pg_namespace as namespace on namespace.oid = relation.relnamespace
  where namespace.nspname = 'public'
    and relation.relkind in ('r', 'p')
    and relation.relrowsecurity;

  if actual_tables <> ${expected.tables}
    or actual_functions <> ${expected.functions}
    or actual_triggers <> ${expected.triggers}
    or actual_rls_tables <> ${expected.rlsTables}
  then
    raise exception 'baseline_object_count_mismatch: tables=%, functions=%, triggers=%, rls_tables=%',
      actual_tables, actual_functions, actual_triggers, actual_rls_tables;
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conname = 'hook_video_drafts_scheduled_post_fk'
      and convalidated
  ) then
    raise exception 'baseline_missing_hook_video_schedule_foreign_key';
  end if;

  if position(
    'carousel' in lower(
      pg_catalog.pg_get_functiondef(
        'public.retry_social_publish_target(uuid,uuid,text)'::regprocedure
      )
    )
  ) = 0 then
    raise exception 'baseline_missing_carousel_publish_retry_behavior';
  end if;
${referenceValidationSql}
end;
$baseline_validation$;

select json_build_object(
  'tables', ${expected.tables},
  'functions', ${expected.functions},
  'triggers', ${expected.triggers},
  'rls_tables', ${expected.rlsTables},
  'foreign_key_verified', true,
  'carousel_retry_verified', true
) as baseline_validation;
`;

const outputSql =
  modeArg === "rehearsal"
    ? [
        "begin;",
        "set local lock_timeout = '5s';",
        "set local statement_timeout = '120s';",
        "set local check_function_bodies = off;",
        "drop schema if exists public cascade;",
        // The pg-delta load order applies default privileges before schema.sql.
        "create schema public;",
        ...sqlParts,
        referenceDataSql,
        validationSql,
        "rollback;",
        "",
      ].join("\n")
    : [
        "-- Production schema baseline captured after migration-history reconciliation.",
        "-- Existing production must mark this migration applied; never execute it there.",
        "set check_function_bodies = off;",
        "create schema if not exists public;",
        ...sqlParts,
        referenceDataSql,
        validationSql,
        "reset check_function_bodies;",
        "",
      ].join("\n");

await writeFile(outputFile, outputSql, "utf8");

const sha256 = createHash("sha256").update(outputSql).digest("hex");
process.stdout.write(
  `${JSON.stringify({
    outputFile,
    manifestEntries: manifest.loadOrder.length,
    tableEntriesTopologicallySorted: sortedTableEntries.length,
    deferredForeignKeyEntries: deferredForeignKeyEntries.length,
    triggerFunctionsLoadedBeforeTables: triggerFunctionEntries.length,
    bytes: Buffer.byteLength(outputSql),
    sha256,
    expected,
    referenceRowCounts,
    mode: modeArg,
    transactionEndsWithRollback: modeArg === "rehearsal",
  })}\n`,
);
