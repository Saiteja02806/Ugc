# Onboarding data preparation and automatic Carousel hold

2 November 2026 — local implementation only, not deployed.

## Result
Second onboarding screen now says Preparing your data. It describes business context and Explore, removes automation/slideshow-idea promises and the unsupported less-than-a-minute estimate. Completed setup shows Open Explore using the existing /dashboard redirect. User correction supersedes the interim slideshow-idea copy.

Automatic Carousel generation defaults to held unless AUTOMATIC_CAROUSEL_GENERATION_PAUSED is explicitly false (case/whitespace tolerant) on app and worker. No environment file or production setting was changed.

## Protected behavior and implementation
- VERIFIED: first source-screen component byte-identical to pre-task snapshot; all onboarding className expressions unchanged. Palette/layout untouched. Existing retry/change-source controls and completion navigation retained.
- VERIFIED locally with mocked boundaries: onboarding prebuild returns status paused without feed generation; content-plan guard runs before reservation; existing single/batch dispatch runtime assertion fences queue creation. Unified feed preparation returns existing-content reads and disables requiresPreparation rather than starting new plans.
- VERIFIED worker tests: queued generate_carousel and carousel_content_plan_generation messages are acknowledged before claim/run, leaving the durable job status, inputs, outputs and attempts unchanged. Database recovery skips held jobs. Direct handler invocation throws DeferredJobError rather than reporting success. Cancel-requested jobs retain the cancellation path. Hold does not include manual Explore generate_image/generate_hook_video, existing render or publish job types.
- Reversible hold: explicit false restores admission; existing receipts/idempotency stay intact. Read/recovery polling can continue. This prevents the tested generation/provider calls, not all infrastructure overhead.
- NOT VERIFIED: live onboarding, actual cloud-cost reduction, production queues/provider integrations, or real publication. Old deployed workers and already-submitted provider calls remain unaffected until release. No production generation was paused in this task.

## Validation
- App pause/resume/guard tests:3PASS (`lib/carousel/generation-hold.test.mjs`). Module mocks assert zero reservation/dispatch/feed calls under default hold and original plan attachment/dispatch with explicit false.
- Existing onboarding UI/access/schema/source-name/route/analysis-quality and Carousel dispatch behavior:35PASS. Historical unheld paths run with process-local AUTOMATIC_CAROUSEL_GENERATION_PAUSED=false; new pause assertion explicitly enables it.
- Compiled worker processor + hold + existing Trending policy:35PASS. New hold cases explicitly enable/default the hold; historical execution cases run with process-local false.
- Feed schema/profile-version contracts:27PASS. Total100PASS, no failures in final focused runs. Earlier32onboarding tests overlap the35regressions.
- `npm run worker:build`:PASS after initial host memory exhaustion; retry used process-local NODE_OPTIONS=--max-old-space-size=4096. No build/package configuration changed.
- `npx tsc --noEmit`:PASS final. Scoped ESLint:PASS. `git diff --check`:PASS (line-ending notices only).
- Browser actual local /e2e/onboarding-preview step2:1440x1000 and390x844, updated wording and no horizontal overflow. Completion screenshot shows Open Explore, error fixture exposes Retry setup and Use a different source. Current screenshots manually inspected alongside pre-change baseline. Fixture callbacks do not prove real authenticated backend completion.
- Artifacts `.tmp/onboarding-second/before-desktop.png`, before-mobile.png, after-desktop.png, after-mobile.png, complete-desktop.png. Source baseline compressed to background-before.tsx.gz to reduce local disk use. Intermittent local browser navigation timeouts recovered on subsequent reads; low disk/memory affected verification speed.

## Sources read and change boundary
User AGENTS instructions; context-memory, immutable-contracts, UI-clarity and regression-gate skills read/reused; nonnegotiables and relevant Explore/Carousel/onboarding/incident sections; actual onboarding/draft completion/prebuild/format-policy/dispatch/processor source. Installed Next layouts/pages guide read earlier in this session. Python preflight PASS. Large historical contexts were inspected by relevant sections; no claim of a fresh full reread. New policy changes recorded in both source-of-truth context files and UGC-UI-120.

All changes were scoped above an existing dirty worktree. No dependency, migration, style, source media or deployment configuration edits. No paid media calls. Rollback removes only the guards/copy and matching tests/context entries listed here, preserving other changes.

## Future release order (not performed)
Deploy worker hold first to prevent queued paid execution, then application guards/copy. Verify both targets default held and no environment sets false. Resume only deliberately by setting false on both targets; recover queued jobs through the existing durable mechanism. In-flight old-version calls may finish. No deploy or cloud pause claim is made here.

## Every file changed
- components/business-profiles/background-business-onboarding.tsx
- lib/carousel/generation-hold.ts
- lib/carousel/generation-hold.test.mjs
- lib/carousel/content-plan-generation-job.ts
- lib/carousel/generation-jobs.ts
- lib/carousel/generation-jobs-behavior.test.ts
- lib/trending/onboarding-prebuild.ts
- lib/trending/unified-daily-feed.ts
- worker/src/lib/carousel-generation-hold.ts
- worker/src/lib/carousel-generation-hold.test.ts
- worker/src/processor.ts
- worker/src/processor.test.ts
- worker/src/jobs/index.ts
- CAROUSEL_CONTEXT.md
- EXPLORE_CONTEXT.md
- docs/ai-context/clear.md
- docs/onboarding-data-carousel-hold-2026-11-02.md
