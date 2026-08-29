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
objects already exist. On 2026-08-29, after an exact read-only ledger backup
and successful disposable-project and production rollback rehearsals, the old
production ledger records were replaced by one applied record for baseline
version `20260829093001`. The baseline SQL was not executed.

The transition reverified the complete public-schema fingerprint and static
reference counts before and after the transaction. A final production
`supabase migration list` matched the local baseline and
`supabase db push --dry-run` reported the database was up to date with no
pending migrations, seeds, or roles.

All future schema changes must be new, forward-only migrations with versions
later than `20260829093001`.
