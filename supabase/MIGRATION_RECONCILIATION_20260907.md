# September 7 migration history reconciliation

Production project: `kltxwijhluawgveykfbt`.
Verified Git revision: `e757178e7ff379e732e3e2a749c0bc70715456e3`.

Production had 33 migration records; Git had 36 files. The actual SQL changes
were already present. Four migrations had different timestamps, and three
functions had been updated without corresponding migration-history entries.
The earlier worker-release verification covered its four new migrations;
it did not establish parity across the complete history.

| Production version before repair | Canonical Git version | Change |
| --- | --- | --- |
| 20260906091911 | 20260906091416 | Carousel six-slide initialization |
| 20260906093527 | 20260906093500 | Sixth Carousel image usage slot |
| 20260906142833 | 20260906213000 | Wall terminalization V2 |
| 20260906142842 | 20260906220000 | Instagram analytics thumbnail refresh |
| Unrecorded | 20260906190000 | Reaction daily-feed failure marking |
| Unrecorded | 20260906200000 | Wall stale-layout terminalization V1 |
| Unrecorded | 20260906210000 | Reaction SQL column ambiguity fix |

The four renumbered migrations matched their production ledger SQL exactly
after normalizing line endings. The three unrecorded function bodies matched
the live definitions exactly; their signatures and required access grants
were inspected. The remaining post-baseline migration SQL matched after
accounting for statement separators, comments, and whitespace.

The complete production ledger was backed up before repair. A transaction
locked only `supabase_migrations.schema_migrations`, verified the expected
ledger and public-schema fingerprints, renamed the four version records,
recorded the three already-applied SQL files, and normalized one older
migration's display name. No migration SQL was re-executed. Existing baseline
and other migration records were retained. No application rows were changed.

The transaction first passed a rollback rehearsal, with the original ledger
fingerprint restored. After commit, a fresh export passed the version-parity
check: **36 Git versions, 36 production versions, zero unmatched versions**.
The public-schema fingerprint remained
`7f144e386a4ae0e1e2649cf96f6dcb04` before, during, and after repair. This covered
columns, constraints, indexes, function definitions and grants, triggers,
policies, and table RLS/grants. It is an unchanged-schema check, not a claim
that the complete migration chain was replayed on an empty database today.

Local recovery evidence is under
`.tmp/account-worker-investigation-20260906/`: the complete before/after JSON
ledger exports, SQL comparison report, fingerprint, and exact rollback/commit
transaction files. These are local investigation artifacts, not migrations.

## Required release verification

The existing reconciliation guard checks local filenames and release locks.
It does **not** connect to production. Passing it alone is insufficient.

1. Audit the release checkout for duplicate migration timestamps.
2. Export the complete production ledger using
   `scripts/export-supabase-migration-ledger.mjs`, or an equivalent read-only
   MCP query in that script's JSON envelope. Keep exports out of Git.
3. Compare versions before applying migrations. Investigate missing older
   versions and production-only versions; do not blindly replay them.
4. After applying the intended migrations, export production again and run:

   ```sh
   node scripts/check-supabase-migration-parity.mjs <ledger-json> kltxwijhluawgveykfbt
   ```

   The check requires the correct project and an export less than one hour old.
   It compares migration versions, not SQL or schema equivalence. When history
   diverges, inspect the recorded SQL and actual schema before marking a file
   applied or repairing its version.
5. Verify the relevant deployed functions and production flow. A matching
   ledger does not establish worker-image deployment or end-to-end correctness.

CI runs the local guard and parity-check regression tests. Live parity remains
a release check requiring an authenticated, fresh production export; CI does
not currently query production itself.

See the [Supabase migration repair documentation](https://supabase.com/docs/reference/cli/supabase-migration-repair)
for the distinction between repairing history and executing migration SQL.
