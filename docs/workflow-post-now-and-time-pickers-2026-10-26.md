# Remaining workflow time pickers and Post now - 26 October 2026

UI decision superseded by the user: see post-now-simple-ui-2026-10-26.md. Separate now/later sections have been removed.

Status: LOCALLY VERIFIED / PRODUCTION ACCEPTANCE OPEN. Not deployed. No social post, paid generation or hosted data mutation submitted.

## Requested behavior implemented

The two remaining native time controls (Trending Hook drawer and shared platform-selection modal for Carousel/Wall/Reaction) now reuse WorkflowTimePicker, an explicit00:00-23:59 selector. Quick-slot text uses09:00/12:00/18:00. Explore already uses that shared selector; main Scheduling retains its existing custom24-hour rail picker. Repository component search finds no remaining type=time controls.

Explore Hook, Talking Head + Demo, Wall and Slideshow now expose Post now versus Schedule for later. Post now hides manual date/time, submits only on the final action, and retains manual values/timezone when toggled back. New schedules in the main Scheduling editor also support Post now, including a required destination even where ordinary draft saving allows no targets. Editing existing schedules retains explicit-time semantics. Trending Hook now has an explicit automatic/manual choice and Post now confirmation; the shared Trending modal's existing ASAP option is labelled Post now.

Post now means earliest supported queued publication, not an instantaneous provider result. It uses the existing server-owned useDefaultScheduleTime flag and configured lead time (repository default5 minutes), plus any required media preparation. No lead-time bypass, browser timer, new queue, schema, provider adapter or retry policy was introduced. Manual scheduling remains unchanged. Existing old drafts without publishMode retain manual semantics.

## Preflight and scope

Sources actually read: root AGENTS.md/user instructions; EXPLORE_CONTEXT.md and clear.md (full history in preceding task, newer tail/relevant entries this turn); nonnegotiables.md and scheduling-contract.md; relevant Carousel source-of-truth sections for shared publishing; installed Next route-handler guide. Skills actually read: ugc-context-memory, ugc-immutable-contracts, ugc-ui-clarity, ugc-scheduling, ugc-regression-gate and vercel:react-best-practices. Repository preflight passed; git status/diffs inspected; existing prior/concurrent work preserved.

Protected scope: date/time/zone restoration, caption and account choices, platform visibility/disclosure defaults, media ownership/readiness, durable request recovery, same-key idempotency, browser-independent queue execution, Create/Demo/editor behavior. No changes to prompt/model/media generation or existing targets/provider receipts.

## Actual publishing trace and evidence

| Step | Existing path reused | Evidence/status |
| --- | --- | --- |
| User selection | WorkflowSchedulingPanel draft.publishMode, existing mode=asap in platform modal, Hook hasManualScheduleTime, new Scheduling editor local postNow | Actual callbacks/browser tests; mode selection does not submit |
| Client preflight | prepareSimpleWorkflowSchedule resolves selected accounts, preferences and TikTok capabilities; manual times use resolveZonedDateTime | Unit/API-boundary fixtures; no-time automatic mode still rejects unavailable/expired/unpublishable accounts/defaults |
| Durable receipt | FormatSchedulePanel / WorkflowFinishingBoundary save ScheduleReceipt before POST; PendingExploreSchedulePanel saves exact parseExplorePendingSchedule input | Browser reload, double-click and lost-acknowledgement recovery; reads do not POST |
| API/auth/normalize | POST /api/schedules -> createUserSchedule -> normalizeScheduleCreateInput -> getDefaultScheduleTime | Existing server flag selects authoritative clock; default-time service replay test preserves first slot |
| Atomic schedule/targets | createUserSchedule -> insertDirectScheduledPost -> reconcileDirectScheduleHandoff | Existing service and local DB tests pass, including rollback and exactly one durable job per target |
| Background preparation | POST /api/explore/schedules -> reserveExplorePendingSchedule -> prepareExplorePendingSchedule; reconcileExplorePendingSchedule later uses scheduleRenderedPost | Existing route/service/local DB tests pass; flag preserved in exact background snapshot |
| Delivery/result | Existing target queue/scheduler, publish-social-post atomic claims, provider receipt/status projection and Scheduling view | Architecture unchanged; real hosted execution/provider result NOT TESTED |

## Checks and outcomes

- npm run test:explore: PASS1,285/1,285 including worker build/local media rendering. Log .tmp/all-workflows-post-now-explore.log.
- Focused draft/form/main-editor/direct-service/local atomic DB/database contract: PASS119/119. Log .tmp/all-workflows-post-now-focused.log. Includes Post now without manual time, manual restoration, clock advancing, accountless Post now blocked and server first-slot replay.
- Simple posting/pending preparation UI/service/route/local DB: PASS46/46. Log .tmp/all-workflows-post-now-pending.log. Counts overlap the broad suite and are not additive.
- TypeScript, scoped runtime ESLint and git diff --check: PASS. Logs .tmp/all-workflows-post-now-types.log, -lint.log, -diff.log (line-ending notices only).
- npm run build: PASS, including native media route tracing/executable checks. .tmp/all-workflows-post-now-build.log.
- node scripts/trending-publishing-preferences.browser.cjs: PASS. Existing defaults/visibility/disclosure/caption/failure/retry checks plus both actual pickers at1366px/390px; all24 hours/60 minutes,00:00/09:30/21:30/23:59, ArrowUp to23:58, manual/now/manual restoration, no unsolicited submit. .tmp/all-workflows-post-now-trending-browser.log.
- node scripts/simple-repeat-scheduling.browser.cjs: PASS. Actual pending video/Hook/Wall/slideshow on desktop/mobile; Post now, reload, lost acknowledgement resolved by read, explicit second later-time post and double-click guard. .tmp/all-workflows-post-now-explore-browser.log.
- node scripts/explore-schedule-review.browser.cjs: PASS. Existing main editor validation, UTC conversion/midnight, account settings and media checks; Post now at1366px/390px, no automatic request, selected source preserved and old10:30 restored. .tmp/all-workflows-post-now-editor-browser.log.

Fresh images inspected: .tmp/trending-publishing-preferences-browser/modal-24-hour-390.png and drawer-24-hour-1366.png; .tmp/explore-schedule-review-browser/post-now-390.png (settled CSS transition); .tmp/simple-repeat-scheduling/slideshow-mobile.png. Other desktop/mobile screenshots saved alongside them. No clipping observed in inspected changes. Approved before/after pixel baseline, zoom and physical touch are NOT TESTED. Existing browser fixture caption locators and saved-caption close behavior were updated to match current accessible UI rather than changing runtime behavior to satisfy stale tests.

VERIFIED locally: explicit24-hour controls in all remaining surfaces; Post now transport; manual time/zone and account/publishing-default preservation; no submission on mode changes; no targetless Post now; pending/negative/reload/retry/idempotent recovery; general Explore regressions.

NOT VERIFIED: signed-in production browser/API/save roundtrip, real target/job/provider IDs, browser-closed live execution, real production lead-time configuration, provider latency and publication. Production check again reaches https://getugcpilot.com/sign-in after opening https://www.getugcpilot.com/explore/create-hook. No production success claim. Deployment remains held by ugc-regression-gate pending required authenticated acceptance, as in the preceding task.

## Files changed in this follow-up

Runtime:
- components/social/platform-selection-modal.tsx
- components/trending/hook-video-schedule-drawer.tsx
- components/explore/workflow-scheduling-panel.tsx
- components/explore/format-schedule-panel.tsx
- components/explore/pending-schedule-panel.tsx
- components/explore/workflow-finishing-boundary.tsx
- components/explore/talking-head-schedule-review.tsx
- components/scheduling/schedule-editor.tsx
- components/scheduling/scheduling-workspace.tsx
- lib/explore/workflow-scheduling-draft.ts
- lib/explore/format-schedule-draft.ts
- lib/explore/simple-workflow-schedule.ts
- lib/explore/workflow-schedule-client.ts

Tests/browser fixtures:
- lib/scheduling/scheduling-database-contract.test.ts
- scripts/workflow-sections.test.mjs
- scripts/explore-format-schedule-draft.test.mjs
- scripts/schedule-editor-inline.test.mjs
- scripts/simple-workflow-schedule.test.mjs
- scripts/trending-publishing-preferences.browser.cjs
- scripts/simple-repeat-scheduling.browser.cjs
- scripts/explore-schedule-review.browser.cjs

Documentation: EXPLORE_CONTEXT.md, CAROUSEL_CONTEXT.md, docs/ai-context/clear.md (append-only), docs/ai-context/scheduling-contract.md, this receipt.

Incidents: UGC-SCH-001 recurrence and UGC-SCH-007 enhancement logged before implementation; local verification appended. Production remains open. Rollback only the listed follow-up hunks/tests and publishMode addition; keep the previous shared-picker/Talking Head fixes and all concurrent Hook100/marketing/publishing-retry changes. No migration/worker/config rollout needed from this patch.
