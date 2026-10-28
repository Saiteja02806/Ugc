# Trending automation backend reliability — 2026-10-28

Status: **PARTIALLY VERIFIED**. Backend repairs and local regression checks are complete. Two database migrations are applied and read back in production. Matching website/worker deployment and an activated, browser-independent production run remain NOT VERIFIED. No automation was activated, no historical failed generation was replayed, and no paid generation or publication was initiated.

## Implemented scope

- Migrated legacy fallback automation storage transactionally into dedicated owner-scoped tables. The sole production draft remains draft, revision9, with identical configuration/cursor and no slots.
- Added a revision-bound execution lease, durable preparation checkpoints and an atomic schedule handoff. Schedule, targets, jobs and the slot's schedule receipt commit together. Pausing, changing revision, lease expiry and cancellation fence the handoff; lost acknowledgements retain the accepted schedule instead of reposting.
- Prevented sweep overlap, stale checkpoint overwrites, reuse of already scheduled sources, retry of accepted/cancelled/past slots and silent defaults after entitlement/preferences failures. Manual schedule changes are retained. Recent slot history is loaded before chronological presentation.
- Source inventory must belong to the current business/profile version and be available by the posting date. Active automation guides future generation structures without overwriting manual Adjust preferences or existing pack snapshots. Mixed structures receive balanced generation inventory because generation reserves whole batches of five; actual posting retains exact saved counts. A daily entitlement below ten cannot supply two generation batches, so mixed activation reports that limitation explicitly.
- Initial transient planner failures enter durable job retry without five candidate repair calls or premature failure settlement. Provider timeout is bounded at120seconds with SDK retries disabled. Image reservation retries once only for known rolled-back SQL timeout/lock errors, with identical inputs.
- Structure2 heading-only repair may replace headings alone; body, CTA and slide roles remain unchanged and all fit, duplicate-copy and claim validation still runs. Structure1's earlier fixed-position schema and CTA screenshot behavior remain covered.
- Background sweep/reconciliation failures now leave bounded diagnostic messages instead of disappearing silently.

## Files changed in this follow-up

Application:

- `lib/scheduling/service.ts`
- `lib/trending/slideshow-automation-service.ts`
- `lib/trending/slideshow-automation-generation-mix.ts` (new)
- `lib/trending/unified-daily-feed-db.ts`
- `lib/trending/unified-daily-feed.ts`
- `lib/trending/daily-replenishment-sweep.ts`
- `lib/trending/reconcile-completed-feed.ts`

Worker:

- `worker/src/jobs/generate-carousel.ts`
- `worker/src/lib/carousel-generate.ts`
- `worker/src/lib/carousel-llm-slide-plan.ts`
- `worker/src/lib/carousel-structure-2-generate.ts`
- `worker/src/lib/carousel-structure-2-planner.ts`
- `worker/src/lib/content-plan-provider-retry.ts`
- `worker/src/lib/supabase.ts`

Migrations:

- `supabase/migrations/20261026141500_trending_slideshow_automation.sql`
- `supabase/migrations/20261027185410_harden_trending_automation_checkpoints.sql` (new)

Tests:

- `lib/trending/slideshow-automation-service.test.mjs`
- `lib/trending/slideshow-automation-generation-mix.test.ts` (new)
- `lib/trending/slideshow-automation-schema-contract.test.ts`
- `scripts/direct-schedule-atomic-db.test.mjs`
- `scripts/direct-schedule-service.test.mjs`
- `worker/src/lib/carousel-structure-2-planner.test.ts`
- `worker/src/jobs/generate-carousel.retry.test.mjs` (new)
- `worker/src/lib/carousel-reservation-retry.test.mjs` (new)
- `worker/src/lib/carousel-provider-interruption.test.mjs` (new)

Documentation: this receipt, append-only `docs/ai-context/clear.md` and `CAROUSEL_CONTEXT.md`.
Earlier UI, CTA and numbered-slide changes are documented separately in `docs/trending-automation-followup-2026-10-28.md`. Existing unrelated edits and merge conflicts are preserved; nothing was staged, pushed or deployed.

## Preflight and contracts

Read root AGENTS.md; mandatory context-memory, immutable-contracts, scheduling and regression-gate SKILL.md files; video-prompt skill sections applicable to planner work; installed Next route-handlers guide; Supabase skill and Postgres best-practices material. Consulted relevant sections of EXPLORE_CONTEXT.md, CAROUSEL_CONTEXT.md, nonnegotiables.md, clear.md and scheduling/history documents. The large context documents were consulted by relevant sections, not claimed to have been read in full. `python tools/preflight.py --repo . --task <backend automation/slideshow request>` passed source discovery/readability.

Minimal contract: only automation storage/execution and evidenced planner recovery paths. Preserve owner isolation, source copy, current screenshot exception, selected collection restrictions, saved style snapshots, schedule targets/time conversion, existing UI and quality rejection. Rollback boundary is this incremental patch; SQL rollback must preserve newly accepted schedule receipts and not blindly drop live tables.

## Verification evidence

- Final app/SQL suite: **70/70 PASS**, `.tmp/trending-backend/acceptance-final.log`. Command: Node test runner with `--import ./scripts/next-server-only-test-loader.mjs --experimental-test-module-mocks --experimental-transform-types`, covering automation service/mix/contracts/schema/database, daily replenishment/reconciliation and direct schedule service/atomic SQL tests. Includes10real PGlite SQL tests exercising migration/backfill, leases, pause/cancel/expiry fences, role restrictions, same-transaction targets/jobs and stable replay.
- Compiled Carousel/planner/renderer/edit worker suite: **103/103 PASS**, `.tmp/trending-backend/worker-suite.log`.
- Worker durable retry, provider interruption and reservation rollback tests: **3/3 PASS**, `.tmp/trending-backend/recovery-acceptance.log`; command `node --experimental-test-module-mocks --test worker/src/jobs/generate-carousel.retry.test.mjs worker/src/lib/carousel-reservation-retry.test.mjs worker/src/lib/carousel-provider-interruption.test.mjs`.
- `npm run worker:build`: PASS, `.tmp/trending-backend/worker-build-final.log`.
- `node node_modules/typescript/bin/tsc --noEmit --incremental false`: PASS, `.tmp/trending-backend/types-acceptance.log`.
- Scoped ESLint: zero errors; two existing unused-variable warnings (`hasGenericCopy`, `_id`), `.tmp/trending-backend/lint-acceptance.log`.
- Final `node node_modules/next/dist/bin/next build --webpack`: PASS, exit0 after compilation, TypeScript and page generation; `.tmp/trending-backend/build-acceptance.log`.
- No UI files changed in this follow-up, so no new visual acceptance claim. Previous rounded-control/mobile evidence remains in the earlier receipt.

## Production database evidence

Bound Supabase project URL verified as `https://kltxwijhluawgveykfbt.supabase.co`. Hosted migrations applied individually after local SQL tests:

| Local migration | Hosted version |
| --- | --- |
| `20261026141500_trending_slideshow_automation.sql` | `20261027194354` |
| `20261027185410_harden_trending_automation_checkpoints.sql` | `20261027194405` |

MCP assigned the hosted versions; unrelated migration drift was not bulk-applied. Readback confirms all three automation tables have RLS, service-only access/RPC execution, one unchanged draft at revision9, no lease and zero automation slots. Claiming the actual draft returns false. No private user identifiers are included in this receipt. The atomic schedule wrapper preserves ordinary manual scheduling while requiring trusted execution guards for automatic slot keys.

Protected behavior status:

| Contract | Result |
| --- | --- |
| Draft never schedules; migrated config/cursor retained | VERIFIED in production readback and local SQL |
| Competing sweeps, pause/cancel, expiry, stable replay | VERIFIED locally with service and real SQL tests |
| Durable schedule/targets/jobs/slot transaction | VERIFIED locally; live activated handoff NOT TESTED |
| Owner/RLS/browser restrictions | VERIFIED SQL tests and hosted privilege readback |
| CTA screenshot/collection fallback; original copy and style | VERIFIED local regression tests; hosted screenshots NOT TESTED |
| Quality, unsupported claims, duplicate copy remain blocking | VERIFIED local worker regressions |
| Time conversion/manual picker/neighboring UI | Code paths retained; production interaction NOT TESTED |
| Provider delivery with browser closed | NOT TESTED for automation |
| New generated slideshow visual/model quality | NOT TESTED against a live model |

UGC-TREND-002 is locally verified for the repaired paths but remains open with UGC-TREND-001/UGC-SCH-011 for hosted website/worker acceptance. Production must receive matching application and worker code before activation. Historical semantic-quality failures still require their normal validation/review; these changes do not promise that every model output succeeds.
