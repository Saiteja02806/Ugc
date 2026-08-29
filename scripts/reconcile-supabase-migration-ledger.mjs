import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import path from "node:path";

const [pgModuleRootArg, expectedProjectRef, baselineVersion, mode = "rollback"] =
  process.argv.slice(2);

if (!pgModuleRootArg || !expectedProjectRef || !baselineVersion) {
  throw new Error(
    "Usage: node scripts/reconcile-supabase-migration-ledger.mjs <pg-module-root> <expected-project-ref> <baseline-version> [rollback|commit-disposable]",
  );
}

if (!/^\d{14}$/u.test(baselineVersion)) {
  throw new Error("Safety stop: the baseline version must be a 14-digit timestamp.");
}

if (!new Set(["rollback", "commit-disposable"]).has(mode)) {
  throw new Error("Safety stop: unsupported reconciliation mode.");
}

const productionProjectRef = "kltxwijhluawgveykfbt";
if (mode === "commit-disposable" && expectedProjectRef === productionProjectRef) {
  throw new Error("Safety stop: this script cannot commit against production.");
}

if (
  mode === "commit-disposable" &&
  process.env.UGC_DISPOSABLE_PROJECT_CONFIRMATION !== expectedProjectRef
) {
  throw new Error(
    "Safety stop: disposable-project confirmation does not match the expected project.",
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

const publicStateQuery = `
  select jsonb_build_object(
    'columns', coalesce((
      select jsonb_agg(
        jsonb_build_array(
          table_name, column_name, ordinal_position, data_type, udt_name,
          is_nullable, column_default
        ) order by table_name, ordinal_position
      )
      from information_schema.columns
      where table_schema = 'public'
    ), '[]'::jsonb),
    'constraints', coalesce((
      select jsonb_agg(
        jsonb_build_array(
          c.conrelid::regclass::text, c.conname, c.contype,
          pg_get_constraintdef(c.oid, true)
        ) order by c.conrelid::regclass::text, c.conname
      )
      from pg_constraint c
      join pg_namespace n on n.oid = c.connamespace
      where n.nspname = 'public'
    ), '[]'::jsonb),
    'indexes', coalesce((
      select jsonb_agg(
        jsonb_build_array(tablename, indexname, indexdef)
        order by tablename, indexname
      )
      from pg_indexes
      where schemaname = 'public'
    ), '[]'::jsonb),
    'functions', coalesce((
      select jsonb_agg(
        jsonb_build_array(
          p.proname, pg_get_function_identity_arguments(p.oid),
          pg_get_functiondef(p.oid)
        ) order by p.proname, pg_get_function_identity_arguments(p.oid)
      )
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
    ), '[]'::jsonb),
    'triggers', coalesce((
      select jsonb_agg(
        jsonb_build_array(
          c.relname, t.tgname, pg_get_triggerdef(t.oid, true)
        ) order by c.relname, t.tgname
      )
      from pg_trigger t
      join pg_class c on c.oid = t.tgrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and not t.tgisinternal
    ), '[]'::jsonb),
    'policies', coalesce((
      select jsonb_agg(to_jsonb(p) order by p.tablename, p.policyname)
      from pg_policies p
      where p.schemaname = 'public'
    ), '[]'::jsonb),
    'rls', coalesce((
      select jsonb_agg(
        jsonb_build_array(c.relname, c.relrowsecurity, c.relforcerowsecurity)
        order by c.relname
      )
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind in ('r', 'p')
    ), '[]'::jsonb)
  ) as state
`;

const referenceCountQuery = `
  select jsonb_build_object(
    'hook_formats', (select count(*) from public.hook_formats),
    'hook_text_formats', (select count(*) from public.hook_text_formats),
    'hook_text_format_variants', (select count(*) from public.hook_text_format_variants),
    'hook_text_format_evidence', (select count(*) from public.hook_text_format_evidence),
    'carousel_global_settings', (select count(*) from public.carousel_global_settings)
  ) as counts
`;

function hash(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

async function capturePublicState(client) {
  const state = (await client.query(publicStateQuery)).rows[0].state;
  const referenceCounts = (await client.query(referenceCountQuery)).rows[0].counts;
  return { schemaSha256: hash(state), referenceCounts };
}

async function main() {
  const requireFromModuleRoot = createRequire(
    path.resolve(pgModuleRootArg, "ugc-pg-loader.cjs"),
  );
  const pg = requireFromModuleRoot("pg");
  const client = new pg.Client({
    connectionString,
    password: process.env.PGPASSWORD,
    application_name: "ugc_migration_ledger_reconciliation",
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    const before = await capturePublicState(client);
    const beforeLedger = await client.query(
      "select version from supabase_migrations.schema_migrations order by version",
    );
    if (beforeLedger.rowCount === 0) {
      throw new Error("Safety stop: the existing migration ledger is empty.");
    }

    await client.query("begin");
    await client.query("set local lock_timeout = '5s'");
    await client.query("set local statement_timeout = '30s'");
    await client.query("lock table supabase_migrations.schema_migrations in exclusive mode");
    await client.query("delete from supabase_migrations.schema_migrations");
    await client.query(
      `insert into supabase_migrations.schema_migrations (version, statements, name)
       values ($1, $2::text[], $3)`,
      [
        baselineVersion,
        ["-- Existing schema verified separately; baseline recorded as applied."],
        "production_baseline_v1",
      ],
    );

    const stagedLedger = await client.query(
      "select version, name from supabase_migrations.schema_migrations order by version",
    );
    if (
      stagedLedger.rowCount !== 1 ||
      stagedLedger.rows[0].version !== baselineVersion ||
      stagedLedger.rows[0].name !== "production_baseline_v1"
    ) {
      throw new Error("Safety stop: staged ledger does not contain only the baseline.");
    }

    const during = await capturePublicState(client);
    if (
      during.schemaSha256 !== before.schemaSha256 ||
      JSON.stringify(during.referenceCounts) !== JSON.stringify(before.referenceCounts)
    ) {
      throw new Error("Safety stop: public schema or reference counts changed.");
    }

    if (mode === "rollback") {
      await client.query("rollback");
    } else {
      await client.query("commit");
    }

    const after = await capturePublicState(client);
    if (
      after.schemaSha256 !== before.schemaSha256 ||
      JSON.stringify(after.referenceCounts) !== JSON.stringify(before.referenceCounts)
    ) {
      throw new Error("Safety stop: public schema or reference counts changed after transition.");
    }

    const afterLedger = await client.query(
      "select version, name from supabase_migrations.schema_migrations order by version",
    );
    if (mode === "rollback" && afterLedger.rowCount !== beforeLedger.rowCount) {
      throw new Error("Safety stop: rollback did not restore the original ledger count.");
    }
    if (
      mode === "commit-disposable" &&
      (afterLedger.rowCount !== 1 || afterLedger.rows[0].version !== baselineVersion)
    ) {
      throw new Error("Safety stop: disposable ledger commit did not persist the baseline.");
    }

    process.stdout.write(
      `${JSON.stringify({
        expectedProjectRef,
        mode,
        oldLedgerCount: beforeLedger.rowCount,
        finalLedgerCount: afterLedger.rowCount,
        finalLedgerVersion: afterLedger.rows.at(0)?.version ?? null,
        publicSchemaUnchanged: true,
        referenceDataCountsUnchanged: true,
        schemaSha256: before.schemaSha256,
        referenceCounts: before.referenceCounts,
      })}\n`,
    );
  } finally {
    await client.end().catch(() => undefined);
  }
}

main().catch((error) => {
  process.stderr.write(
    `${JSON.stringify({ message: error.message, code: error.code })}\n`,
  );
  process.exitCode = 1;
});
