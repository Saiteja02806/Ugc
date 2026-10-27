# Trending slideshow automation gap repairs — 27 October 2026

Status: **LOCAL FIXES VERIFIED; HOSTED ACCEPTANCE NOT VERIFIED. Not deployed.**

## Scope implemented

Collection backgrounds and saved typography are applied to derived rendered slides before Library save and scheduling. Each automation slot gets a deterministic isolated Library source identity, retaining references to the real source generation/slides without overwriting ordinary Library saves or existing Trending cards. Default appearance preserves original rendered pixels. Collection allocation uses the actual number of slides and rejects empty selected subsets. Saved style/position applies to cover/body/CTA. Missing raw backgrounds or stale manual edits block preparation; flattened slides are never used as raw replacement backgrounds.

Exact requested structure selection replaces the previous any-format fallback. Wrong-format availability produces a preparing slot. Render errors remain preparation errors, not fabricated account-reconnect errors. Subsequent sweep can retry the retained source. Schedule input points at the derived Library result; no original fallback is scheduled on rendering failure.

Pause persists paused state before cancellation. Cancellation and skip require the existing scheduler to return cancelled; exceptions and unconfirmed outcomes return409 without marking the failed slot cancelled. Successful partial cancellations remain recorded. Owner-modified slots and keep-scheduled choice remain intact. Automation status/revision is read after rendering, before scheduling, to stop stale preparation following pause/settings changes.

Shared renderer keeps existing worker behavior and gains an optional explicit font directory for the Next server. Font parsing handles the ESM package selected by Webpack and CommonJS package loaded by workers. Font trace includes are narrow to automation API/background entry points. Existing controls, layouts, date/time picker, platform account selection and underlying scheduling/publishing services were not edited.

## Every source/document file changed by this task

- lib/trending/slideshow-automation-service.ts
- lib/trending/slideshow-automation-contract.ts
- lib/library/db.ts
- next.config.ts
- worker/src/lib/carousel-manual-render.ts
- lib/trending/slideshow-automation-render.ts
- lib/trending/slideshow-automation-service.test.mjs
- lib/trending/slideshow-automation-database.test.mjs
- docs/ai-context/clear.md
- CAROUSEL_CONTEXT.md
- docs/trending-automation-gap-fixes-2026-10-27.md

These files include existing uncommitted work; task baselines were saved outside the repository before editing and no unrelated changes were reverted. The automation service/contract/UI were already untracked additions when work began.

## Verification receipt

- PASS91/91: automation service behavior, actual pixel rendering, actual local Library SQL function, actual local cancellation SQL function, automation migration/RLS/uniqueness/snapshot checks, automation contract/schema/UI, reconciliation, existing edit contracts, Library item reads, atomic schedule database/service/client and schedule-time tests. Exact command/log: automation-regression-final.log in the chat artifact directory.
- PASS41/41: worker carousel-manual-text, render-trending-carousel-edit and concurrency tests after worker TypeScript build. Log: automation-worker-regression-final.log.
- PASS: node node_modules/typescript/bin/tsc --noEmit --incremental false. Log: automation-types-final.log.
- PASS: ESLint on all eight changed TypeScript/JS/config implementation/test files. Log: automation-fix-lint-final.log.
- PASS: next build --webpack,230static pages, full TypeScript and route traces. Log: automation-fix-build-final.log. No final OpenType default-export warning.
- PASS: inspected fonts in API main/activate and internal replenish/reconcile/recover traces:18TTF files each,0missing.
- PASS: scripts/trending-slideshow-only.browser.cjs at1366x768 and390x844; source remains unchanged. Log: automation-existing-adjust-browser.log.
- PASS: scripts/trending-carousel-text.browser.cjs, including desktop/mobile controls, library backgrounds, all six body texts, save/reopen, independent typography, failed save recovery, remount/pending/lost response, no duplicate saves. Log: automation-existing-editor-browser.log.
- PASS: original/default slideshow unchanged in service tests; UI source hashes equal task baseline for TrendingWorkspace and automation workspace.
- Inspected visual outputs: automation-render-qa/slide-1.webp (yellow cover on selected blue background), slide-3.webp (body copy on selected blue), slide-4.webp (body+CTA on selected green). Browser screenshots inspected: pending-render-reopened-mobile.png and1366-adjust.png. These are isolated fixtures, not production screenshots or an approved full-screen before/after baseline.

Broader run including lib/scheduling/scheduling-database-contract.test.ts had three failures against untouched UI source: expected label Post Right away, expected step={SOCIAL_SCHEDULING_TIME_STEP_SECONDS}, and expected old24-hour helper copy. These files already had uncommitted UI changes before this task. No broad-suite green claim and no assertion weakening. The focused run excludes that unrelated suite and reports its failures here. The baseline broad run also caught an overly strict WebP text-color pixel threshold; output was visually inspected, chroma-subsampling tolerance calibrated, final rendered text/background checks PASS.

## Protected behaviors

| Behavior | Status/evidence |
|---|---|
| Trending main screen and Automation UI source preserved | VERIFIED: byte-for-byte baseline hashes |
| Existing editor/Adjust desktop/mobile/recovery | VERIFIED in isolated browser fixtures |
| Original slideshow and ordinary Library source unchanged | VERIFIED service assertions plus actual local SQL isolation/replay |
| Collection subset/background/cover/body/CTA pixels | VERIFIED real renderer and raster checks |
| Exact requested format, no substitution | VERIFIED wrong-format negative test |
| Cancellation, partial failure, too-late and owner boundaries | VERIFIED real local cancellation SQL and service tests |
| Local timezone conversion and duplicate database slot rejection | VERIFIED contract/time tests and local SQL |
| Production generation/publishing/browser-independent delivery | NOT TESTED; no deployment/activation |
| Full signed-in production/mobile UI acceptance | NOT TESTED |

## Remaining release gates and limits

The service tests run real orchestration and raster rendering while stubbing storage upload and external scheduler calls; they are not a provider end-to-end acceptance. Local PGlite runs real existing SQL but is not the hosted database. The prior production audit found none of the three dedicated automation tables, no fallback configuration and no auto-slot schedules. Migration/deployment/live storage/scheduler/provider checks are still required before rollout.

The post-render pause check narrows a race but is not a transactional pause/schedule fence; distributed concurrent pause/activation, simultaneous sweeps and crash-after-provider-acceptance require hosted concurrency/failure acceptance. Custom rendering executes in request/sweep paths; hosted time-budget and representative large-image latency acceptance remain unverified. No extra architecture/schema migration was introduced to claim these solved. Failed renders may leave orphaned derived storage outputs; no production objects were created here. Existing fallback storage is unchanged and should not be treated as proof of migration readiness.

## Preflight and history

Actually consulted: AGENTS.md; applicable excerpts of EXPLORE_CONTEXT.md and CAROUSEL_CONTEXT.md; clear.md incident/history excerpts; nonnegotiables.md; ugc-context-memory, ugc-immutable-contracts, ugc-scheduling, ugc-ui-clarity and ugc-regression-gate skills; relevant installed Next CLI/distDir documentation; source/callers/SQL/render contracts, existing tests and Git status/history. tools/preflight.py PASS discoverable/readable prerequisites. Large context documents were not fully reviewed line by line; this receipt does not claim otherwise.

Incident UGC-SCH-011 added OPEN before fixes and appended local evidence; remains OPEN for hosted acceptance. Historical preservation/UI/source/scheduling incidents informed source-isolation, visible-body-copy and cancellation safeguards. No external messages, paid generations, publications, database migrations, worker deployment or app deployment were performed. No commit/push requested or performed.
