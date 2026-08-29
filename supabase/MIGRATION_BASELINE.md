# Production migration baseline

## Purpose

The historical Git migration IDs and the production Supabase migration ledger
diverged even though production's current `public` schema was valid. The
canonical migration history now starts from one verified current-state
baseline instead of attempting to replay or rename every old ledger entry.

## Canonical migration

`migrations/20260829093001_production_baseline_v1.sql`

The baseline was generated from a strict declarative export of production's
`public` schema. It contains 98 tables, 155 functions, 37 triggers, row-level
security on all 98 tables, grants, required extensions, and 83 non-user static
reference rows. It explicitly verifies the scheduled-post foreign key and the
carousel-aware social-publish retry behavior.

User rows, billing rows, media catalogs, jobs, and outboxes are not copied into
the baseline.

## Rehearsal result

The complete baseline, including static reference rows and validation checks,
was executed inside a transaction on the disposable Supabase test project. The
validation passed and the transaction rolled back, proving the SQL can build
the expected current state without leaving a test change behind.

## Historical evidence

The former canonical history is preserved under
`migration_archive/pre_baseline_20260829/canonical_history`. The former nested
evidence directory is preserved under
`migration_archive/pre_baseline_20260829/nested_evidence`. These are evidence,
not active Supabase migration directories.

## Existing production database

Do **not** execute the baseline SQL on the existing production database. Its
objects already exist. The production cutover is ledger-only: after an exact
read-only ledger backup and a successful disposable-project rehearsal, the old
ledger records are replaced by one applied record for the baseline version.
That changes Supabase's migration bookkeeping only; it does not rerun the
baseline or modify application tables.

Keep `MIGRATION_RECONCILIATION_LOCK.md` until both test and production dry runs
are clean and production's schema has been reverified.
