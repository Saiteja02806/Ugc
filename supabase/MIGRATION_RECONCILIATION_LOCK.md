# Migration reconciliation lock

Database migration releases are temporarily frozen while the local migration
history is moved to the verified production baseline described in
`MIGRATION_BASELINE.md`.

Do not add, rename, remove, apply, repair, or deploy migrations until all of
the following are complete:

1. The production migration ledger has been exported read-only and retained as
   a recovery record.
2. The exact ledger-only transition has succeeded on the disposable test
   project without changing its application schema or reference data.
3. `supabase db push --dry-run` against that test project reports no pending
   migrations from the baseline workspace.
4. The baseline release is present in Git before production's ledger is moved
   to the same baseline version.
5. Production's schema is rechecked after the ledger-only transition and its
   own `supabase db push --dry-run` reports no pending migrations.

Application-only releases may continue when they do not depend on a database
schema change.
