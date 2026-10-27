# Post now - simplified UI correction, 26 October 2026

Status: LOCALLY VERIFIED for broad/focused/browser/build checks. Production acceptance remains open; not deployed. This supersedes the mode-selector UI in workflow-post-now-and-time-pickers-2026-10-26.md.

## User-requested correction

Removed separate Post now/Schedule for later groups and the shared platform modal's choice cards. Default posting has one final Post now action. Removed the automatic-mode lead-time paragraph and live Now/Earliest block from the main review. No separate timing-mode section is needed before posting.

The final click uses the existing authenticated server-owned automatic-time path. A page left open does not freeze its posting time: client/server resolve a fresh earliest supported slot on confirmation, under the existing configured lead-time policy. It still creates durable targets/jobs and keeps the same request identity on retry. This UI change does not bypass the server's configured lead (repository default5 minutes) or claim instant provider publication.

Existing24-hour date/time controls remain functional. Deliberately changing them schedules that exact time through the existing action; empty untouched Explore forms default to Post now. Main review defaults to automatic posting, existing schedule edits remain manual, and restored/manual callers can explicitly set initialUseDefaultScheduleTime=false. No mode selection sends a request because there is no longer a mode-selection UI. Source/account/caption/defaults/ownership and recovery checks stay intact.

## Scope and preflight

Mandatory skills/context actually read in this active task: AGENTS.md, EXPLORE_CONTEXT.md (full history preceding task; incremental updates/relevant sections this turn), clear.md and nonnegotiables/scheduling-contract, applicable Carousel context, ugc-context-memory, immutable-contracts, ui-clarity, scheduling, regression-gate, React review checklist and installed Next route-handler guidance. Prior user work and earlier24-hour fixes preserved. UGC-UI-013 logged before this correction; root cause is the unnecessary mode controls, not a backend scheduling defect.

## Evidence

- Focused real component/draft/time/default-policy/direct-service/local atomic DB: PASS126/126. .tmp/post-now-simple-focused.log. Includes exactly one default Post now button/no Publishing time group, zero submission on render, clock advancing an hour before click, no-target automatic request blocked, explicit manual timing, source/account/default validation and same-slot replay.
- TypeScript and scoped runtime lint: PASS. .tmp/post-now-simple-types.log and .tmp/post-now-simple-lint.log.
- npm run build: PASS including native route bundle verification. .tmp/post-now-simple-build.log.
- Desktop/mobile main Scheduling browser: PASS existing24-hour/UTC/midnight/media/settings regressions plus no mode group, one Post now action, fresh automatic flag and source, manual picker still valid. .tmp/post-now-simple-editor-browser.log.
- Trending shared modal and Hook drawer browser: PASS defaults/captions/settings/failures and explicit24-hour selectors at1366px/390px; no now/later choice section. .tmp/post-now-simple-trending-browser.log.
- Explore Hook/Wall/Slideshow/background-preparation browser: PASS desktop/mobile Post now, reload, lost acknowledgement, explicit later post, double-click prevention. .tmp/post-now-simple-explore-browser.log.
- npm run test:explore: PASS1,285/1,285 including worker build and real local media renders. .tmp/post-now-simple-explore.log. Test groups overlap; counts not additive.
- git diff --check: PASS. No API/worker/database/queue/lead-policy change or provider call.

Fresh screenshots: .tmp/explore-schedule-review-browser/post-now-390.png and post-now-1366.png; .tmp/trending-publishing-preferences-browser/modal-24-hour-390.png and drawer-24-hour-1366.png. Earlier rejected screenshot is problem evidence, not an accepted baseline. Final corrected review image inspected; no mode buttons/extra automatic-time paragraph. No approved pixel baseline, physical touch or zoom test.

Protected status: VERIFIED locally for single-action default, explicit24-hour controls, manual UTC conversion, account/media/default validation, no unsolicited submissions, durable same-request retry/reload. NOT VERIFIED for signed-in production save/target/queue/provider roundtrip or browser-closed live publication. Last production browser check still redirects to sign-in. No deployment or post submitted. The repository regression gate keeps unavailable authenticated acceptance unverified.

## Changed files for this correction

Runtime:
- components/explore/workflow-scheduling-panel.tsx
- components/explore/format-schedule-panel.tsx
- components/explore/pending-schedule-panel.tsx
- components/explore/workflow-finishing-boundary.tsx
- components/explore/talking-head-schedule-review.tsx
- components/scheduling/schedule-editor.tsx
- components/trending/hook-video-schedule-drawer.tsx
- components/social/platform-selection-modal.tsx
- lib/explore/simple-workflow-schedule.ts

Tests/fixtures:
- scripts/schedule-editor-inline.test.mjs
- scripts/explore-format-schedule-draft.test.mjs
- lib/scheduling/scheduling-database-contract.test.ts
- scripts/trending-publishing-preferences.browser.cjs
- scripts/simple-repeat-scheduling.browser.cjs
- scripts/explore-schedule-review.browser.cjs

Documentation: this receipt, EXPLORE_CONTEXT.md, CAROUSEL_CONTEXT.md, docs/ai-context/clear.md (append-only), docs/ai-context/scheduling-contract.md; earlier report gets a supersession note.

Rollback only these correction hunks; retain prior24-hour picker/source/face/history fixes and all concurrent Hook100, marketing and publishing retry work. Incidents: UGC-UI-013 locally verified; UGC-SCH-001/007 remain production-open. No required permission was requested again; prior deployment authorization is present but hosted acceptance evidence is missing.
