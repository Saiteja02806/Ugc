# Trending settings fixes — 28 October 2026

Scope: UGC-TREND-003's two reproduced defects, preserving the existing Automation UI, source rendering, stored slot receipts, account mapping, timezone conversion and publishing workers. No dependency, schema, migration, deployment, live activation, paid generation or publication change. Unrelated shared-worktree changes and merge conflicts remain untouched.

## Fixes

- Settings updates now atomically filter by owner, expected revision **and status**. Pause does not increment revision, so both predicates are necessary. A pause/settings change that commits first causes the old save to update zero rows and return409 with refresh guidance. No automatic retry overwrites the owner's newer intent. Database failures return503 rather than attempting an unfenced fallback-envelope write. Existing dedicated automation tables are required for these guarded writes; they were already migrated in the earlier backend repair.
- Activation uses the same conditional write, binding its final state change to the exact configuration/status it validated. A concurrent Pause or a newly edited draft blocks stale activation. Explicit activation of an unchanged valid paused setup still works.
- A shared structure-supply assertion now runs during activation and during edits to active/needs-attention setups. Mixed structures require at least ten daily generation items (two whole batches of five). Unsupported active changes return409 before any configuration write. Drafts and paused setups remain editable, including mixed drafts; activation still rejects unsupported mixtures. Supported mixed active setups and single-structure edits remain valid.

## Exact incremental files

1. `lib/trending/slideshow-automation-service.ts`: optional status/revision predicate on the existing persistence helper, guarded settings/activation writes, shared mixed-structure assertion.
2. `lib/trending/slideshow-automation-service.test.mjs`: eleven new regression tests, controlled pause/save interleavings and an installed Supabase client/local PostgreSQL integration check.
3. `CAROUSEL_CONTEXT.md`: append current settings-update contract.
4. `docs/ai-context/clear.md`: append UGC-TREND-003 verification; preserve original failures.
5. This receipt.

## Evidence

Before implementation, six initial new service regressions ran against the old code:27passed/4failed overall. The failing cases reproduced pause during collection lookup, pause immediately before the write, a same-status newer settings revision, and mixed active settings acceptance (`.tmp/trending-backend/fix-before.log`). Two positive/activation checks already passed. Added tests then expanded the matrix.

The final suite covers:

- Pause during collection lookup and immediately before UPDATE; settings/config/revision preserved and a subsequent sweep skips all rendering/publication.
- Newer settings with the same active status retain their revision and caption.
- Mixed active/needs-attention edits on a single-batch plan rejected without changing stored state.
- Identical mixed validation on activation; editable mixed drafts/paused setups, accepted mixed active setups at dailyLimit10, accepted single structures at dailyLimit5.
- Concurrent Pause and concurrent draft changes during activation both block stale activation.
- Saving a paused setup keeps it paused; explicit valid activation resumes it.
- Guarded write failures (network/missing table) never use legacy unfenced fallback storage.
- Real installed Supabase client produces PATCH owner/revision/status predicates. A local PGlite PostgreSQL engine executes the filtered UPDATE after Pause commits; zero rows are changed. The caller gets409, reload still reads paused/revision2, and a subsequent paused settings save succeeds with revision3. This uses a test HTTP-to-SQL adapter; it is **not hosted PostgREST acceptance**.

Regression logs are under `.tmp/trending-backend/`: `fix-service-db.log`, `fix-service-final.log`, `fix-acceptance-final.log`, `fix-types.log`, `fix-lint-final.log`, `fix-build.log`.

| Final check | Result |
| --- | --- |
| Node app/SQL regression suite with server-only loader, experimental module mocks/transform types; Automation service, mix, contracts, schema, storage, UI contracts, replenishment/reconciliation, atomic SQL and direct scheduling service tests | **83/83 PASS**, `fix-acceptance-final.log` |
| `node node_modules/typescript/bin/tsc --noEmit --incremental false` | **PASS**, `fix-types.log` |
| Scoped ESLint on service and service tests | **PASS**, zero errors/warnings, `fix-lint-final.log` |
| Scoped `git diff --check` | **PASS** (line-ending notices only) |
| `node node_modules/next/dist/bin/next build --webpack` | **PASS**, exit0 after compile, TypeScript,296static pages and build tracing; `fix-build.log` |

Preflight: root AGENTS.md, installed Next route-handler guide, context-memory/immutable-contracts/scheduling/regression-gate SKILL.md files, Supabase skill sections, nonnegotiables and scheduling contract; relevant Carousel/Explore context and append-only incident history, prior review and receipts. Large histories were consulted by relevant sections, not claimed as a complete reread. Repository preflight discoverability/readability PASS (`fix-preflight.log`). Supabase update/filter and maybeSingle semantics checked against installed source and [official update documentation](https://supabase.com/docs/reference/javascript/update), [maybeSingle documentation](https://supabase.com/docs/reference/javascript/maybesingle). Changelog markdown fetch was unavailable; no new API or platform feature is introduced.

Protected contracts: owner isolation, local time, selected accounts, accepted schedule/target/job receipts, cancellation outcomes, collection-only/screenshot rendering and immutable original slides remain covered by existing app/SQL/render tests. No UI source changed, so no new visual acceptance claim. Existing desktop/mobile browser acceptance is in the prior review. No worker source changed; worker tests were not repeated solely for this service-only correction.

Status: **LOCALLY VERIFIED; production execution NOT VERIFIED**. Website deployment is still required before the updated service behavior is live. No production data was changed in this task. Incident UGC-TREND-003's code defects are fixed locally; UGC-TREND-001/002 and UGC-SCH-011 retain their hosted acceptance limitations. Rollback boundary is only this incremental service/test diff and append-only documentation; do not revert the earlier shared-worktree backend repairs.
