# Combined release audit — 10 October 2026

Status: validated and prepared for deployment. Deployment receipts will be recorded after rollout.

## Scope and validation

Includes all intentional worktree changes: Trending slideshow queue separation, independent durable reconciliation, screenshot metadata compatibility, history refresh, exact slide reuse, measured copy fit and reservation recovery; Explore optional single-clip preparation and final-video scheduling review; private account publishing defaults and explicit TikTok visibility. No intentional source change is excluded.

Combined validation: worker 308 + 15 tests; Explore 660 tests; scheduling/preference 16 tests plus both actual-component browser suites; Trending database/history/status/routing 48 tests; creative-edit/slide-image contracts; TypeScript and production Next.js build. ESLint has no errors and two unused test-helper warnings. Existing focused renderer and real FFmpeg coverage is included in these runs.

Release order: additive migrations and both queues; new edit service and compatible video-render worker; website reconciliation API; remaining generation workers; production checks. Existing customer generations are not mass-retried and saved images are not rewritten for validation.

Authenticated production browser acceptance remains unavailable because the shared browser cannot sign in. Local fixtures do not establish provider posting success or observed production latency improvement.

## Included paths (74)

- .env.example
- CAROUSEL_CONTEXT.md
- app/api/account/publishing-preferences/route.ts
- app/api/internal/trending/reconcile/route.ts
- app/api/trending/creatives/[format]/[creativeId]/edit/route.ts
- components/explore/format-demo-section.tsx
- components/explore/format-schedule-panel.tsx
- components/explore/format-workspace.tsx
- components/explore/use-workflow-finishing.ts
- components/explore/workflow-finishing-boundary.tsx
- components/scheduling/schedule-editor.tsx
- components/settings/publishing-preferences-settings.tsx
- components/settings/settings-workspace.tsx
- components/trending/carousel-edit-render-status.tsx
- components/trending/trending-workspace.tsx
- docs/carousel-production-verification-2026-10-10.md
- docs/explore-scheduling-ui-verification-2026-10-10.md
- docs/release-audit-2026-10-10.md
- docs/trending-slideshow-production-root-causes-2026-10-10.md
- docs/trending-slideshow-repairs-2026-10-10.md
- infra/gcp/README.md
- infra/gcp/carousel-worker/edit-worker.tf
- infra/gcp/carousel-worker/outputs.tf
- infra/gcp/carousel-worker/terraform.tfvars.example
- infra/gcp/carousel-worker/variables.tf
- infra/gcp/foundation/cloud-tasks.tf
- lib/explore/workflow-finishing-api.ts
- lib/jobs/gcp-cloud-tasks-routing.test.mjs
- lib/jobs/gcp-cloud-tasks.ts
- lib/queues/config.test.ts
- lib/queues/config.ts
- lib/scheduling/platform-settings.test.ts
- lib/scheduling/platform-settings.ts
- lib/scheduling/publishing-preferences-client.ts
- lib/scheduling/publishing-preferences-db.ts
- lib/scheduling/publishing-preferences.test.mjs
- lib/scheduling/publishing-preferences.ts
- lib/trending/carousel-edit-render-status.test.ts
- lib/trending/carousel-edit-render-status.ts
- lib/trending/creative-edit-contract.ts
- lib/trending/creative-edit-history-access.test.mjs
- lib/trending/creative-edit-service.ts
- lib/trending/creative-edits.ts
- lib/trending/daily-feed.ts
- lib/trending/daily-replenishment-logic.test.ts
- lib/trending/daily-replenishment-logic.ts
- lib/trending/trending-reconciliation-route.test.mjs
- lib/trending/unified-daily-feed-db.ts
- package.json
- scripts/carousel-product-slide-six-db.test.mjs
- scripts/demo-framing-render.test.mjs
- scripts/demo-framing.test.mjs
- scripts/explore-format-demo-state.test.mjs
- scripts/explore-format-demo.test.mjs
- scripts/explore-schedule-review.browser.cjs
- scripts/format-hook-schedule.browser.cjs
- scripts/publishing-preferences-db.test.mjs
- scripts/workflow-finishing-api.test.mjs
- supabase/migrations/20261009202401_align_six_slide_product_screenshot_metadata.sql
- supabase/migrations/20261009204135_account_publishing_preferences.sql
- worker/src/jobs/finish-explore-video.ts
- worker/src/jobs/render-trending-carousel-edit.test.ts
- worker/src/jobs/render-trending-carousel-edit.ts
- worker/src/lib/carousel-structure-2-measured-copy-fit.test.ts
- worker/src/lib/carousel-structure-2-measured-copy-fit.ts
- worker/src/lib/carousel-structure-2-planner.test.ts
- worker/src/lib/carousel-structure-2-planner.ts
- worker/src/lib/carousel-structure-2-story-plan.ts
- worker/src/lib/explore-finishing-contract.ts
- worker/src/lib/explore-video-composition.ts
- worker/src/lib/trending-feed-reconciliation-dispatch.test.ts
- worker/src/lib/trending-feed-reconciliation-dispatch.ts
- worker/src/processor.test.ts
- worker/src/processor.ts

## Excluded paths (417)

Each directory below excludes its contents for the stated reason. Secrets and generated artifacts remain local.

| Path | Reason |
| --- | --- |
| .agents/ | Local credentials, tools, agent state or isolated working copies |
| .chrome-carousel-upgrade-check/ | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| .codex-artifacts/ | Generated visual QA, recovery or reference artifacts |
| .codex-audits/ | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| .codex-auth-check-stderr.log | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| .codex-auth-check-stdout.log | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| .codex-dev-4173.err.log | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| .codex-dev-4173.log | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| .codex-dev-4173.out.log | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| .codex-dev-4300.err.log | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| .codex-dev-4300.out.log | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| .codex-dev-error.log | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| .codex-dev-output.log | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| .codex-dev-shell.err.log | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| .codex-dev-shell.out.log | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| .codex-dev-stderr.log | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| .codex-dev-stdout.log | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| .codex-library-dev-4173.err.log | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| .codex-library-dev-4173.out.log | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| .codex-next-dev.err.log | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| .codex-next-dev.out.log | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| .codex/ | Local credentials, tools, agent state or isolated working copies |
| .env.development.local | Private local environment or infrastructure values; tracked examples are included |
| .env.local | Private local environment or infrastructure values; tracked examples are included |
| .mcp-audit-app-tests.log | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| .mcp-audit-lint.log | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| .mcp-audit-typecheck.log | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| .mcp-audit-worker-tests.log | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| .next-dev-4300.err.log | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| .next-dev-4300.out.log | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| .next-dev.err.log | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| .next-dev.out.log | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| .next-server-4300-direct.err.log | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| .next-server-4300-direct.out.log | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| .next-server-4300.err.log | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| .next-server-4300.out.log | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| .next-start-4300.err.log | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| .next-start-4300.out.log | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| .next/ | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| .playwright-mcp/ | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| .release-all-app-tests.log | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| .release-app-tests.log | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| .release-build.log | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| .release-cloud-build.log | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| .release-copy-validation.log | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| .release-env-names.log | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| .release-final-app.log | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| .release-final-next.log | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| .release-final-targeted.log | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| .release-final-worker.log | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| .release-merged-types.log | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| .release-merged-worker.log | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| .release-next-build.log | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| .release-production-ai-smoke.log | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| .release-production-render-smoke-final.log | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| .release-production-render-smoke.log | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| .release-production-smoke-final.log | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| .release-production-smoke.log | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| .release-reconcile-test.log | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| .release-validation-recheck.log | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| .release-validation.log | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| .release-vercel-errors.log | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| .release-vercel.log | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| .release-wall-simulation.log | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| .release-worker-identity.log | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| .release-worker-image.log | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| .release-worker-rollout.log | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| .release-worker-tests.log | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| .release-worktrees/ | Local credentials, tools, agent state or isolated working copies |
| .tmp-release-app-tests.log | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| .tmp-release-build.log | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| .tmp-release-carousel-tests.log | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| .tmp-release-extra.log | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| .tmp-release-final-extra.log | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| .tmp-release-targeted.log | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| .tmp-release-worker-tests.log | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| .tmp/ | Local credentials, tools, agent state or isolated working copies |
| .tools/ | Local credentials, tools, agent state or isolated working copies |
| .trigger-dev.err.log | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| .trigger-dev.out.log | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| .vercel/ | Local credentials, tools, agent state or isolated working copies |
| ai-studio-images-desktop.png | Generated visual QA, recovery or reference artifacts |
| artifacts/ | Generated visual QA, recovery or reference artifacts |
| auth-desktop.png | Generated visual QA, recovery or reference artifacts |
| carousel-candidate1-slide1.webp | Generated visual QA, recovery or reference artifacts |
| carousel-candidate1-slide5.webp | Generated visual QA, recovery or reference artifacts |
| carousel-candidate2-slide1.webp | Generated visual QA, recovery or reference artifacts |
| carousel-final-generated-deck.png | Generated visual QA, recovery or reference artifacts |
| carousel-final-polished-deck-styled.png | Generated visual QA, recovery or reference artifacts |
| carousel-final-polished-deck.png | Generated visual QA, recovery or reference artifacts |
| carousel-final-single-deck.png | Generated visual QA, recovery or reference artifacts |
| carousel-final-slide3-fixed.webp | Generated visual QA, recovery or reference artifacts |
| carousel-final-slide3-polished.webp | Generated visual QA, recovery or reference artifacts |
| carousel-final-slide5-fixed.webp | Generated visual QA, recovery or reference artifacts |
| carousel-final-slide5-polished.webp | Generated visual QA, recovery or reference artifacts |
| carousel-ui-check-ready.png | Generated visual QA, recovery or reference artifacts |
| carousel-upgrade-check.png | Generated visual QA, recovery or reference artifacts |
| design-qa-onboarding-flow-v3-comparison.jpg | Generated visual QA, recovery or reference artifacts |
| design-qa-onboarding-step1-comparison.jpg | Generated visual QA, recovery or reference artifacts |
| design-qa-onboarding-step1-desktop-v3.png | Generated visual QA, recovery or reference artifacts |
| design-qa-onboarding-step1-desktop.png | Generated visual QA, recovery or reference artifacts |
| design-qa-onboarding-step1-mobile-form.png | Generated visual QA, recovery or reference artifacts |
| design-qa-onboarding-step1-mobile-viewport-v3.png | Generated visual QA, recovery or reference artifacts |
| design-qa-onboarding-step1-mobile-viewport.png | Generated visual QA, recovery or reference artifacts |
| design-qa-onboarding-step2-desktop-v3.png | Generated visual QA, recovery or reference artifacts |
| design-qa-onboarding-step2-desktop.png | Generated visual QA, recovery or reference artifacts |
| design-qa-onboarding-step2-mobile-v3.png | Generated visual QA, recovery or reference artifacts |
| design-qa-onboarding-step2-mobile.png | Generated visual QA, recovery or reference artifacts |
| design-qa-onboarding-step3-desktop-v3.png | Generated visual QA, recovery or reference artifacts |
| design-qa-onboarding-step3-mobile-grid-v3.png | Generated visual QA, recovery or reference artifacts |
| design-qa-onboarding-step3-mobile-v3.png | Generated visual QA, recovery or reference artifacts |
| design-qa-onboarding-step3-selected-v3.png | Generated visual QA, recovery or reference artifacts |
| design-qa.md | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| design/explore-character-motion/Auto-Save/ | Generated visual QA, recovery or reference artifacts |
| "design/explore-character-motion/Auto-Save/Explore AI Character \342\200\224 Build Use Grow v2 auto-save 1.aep" | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| "design/explore-character-motion/Auto-Save/Explore AI Character \342\200\224 Build Use Grow v2 auto-save 2.aep" | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| "design/explore-character-motion/Auto-Save/Explore AI Character \342\200\224 Create Yours v4 auto-save 1.aep" | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| "design/explore-character-motion/Auto-Save/Explore AI Character \342\200\224 Create Yours v4 auto-save 2.aep" | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| "design/explore-character-motion/Auto-Save/Explore AI Character \342\200\224 Create Yours v4 auto-save 3.aep" | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| "design/explore-character-motion/Auto-Save/Explore AI Character \342\200\224 Create Yours v4 auto-save 4.aep" | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| design/explore-character-motion/Preview/review-frame-00.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/review-frame-01.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/review-frame-02.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/review-frame-03.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/review-frame-04.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/review-frame-05.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/review-frame-06.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/review-frame-07.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/review-frame-08.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/review-frame-09.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/review-frame-10.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/review-frame-11.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/review-frame-12.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/review-frame-13.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/review-frame-14.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/review-frame-15.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/review-frame-16.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/review-frame-17.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/review-frame-18.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/review-frame-19.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/review-frame-20.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/review-frame-21.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/review-frame-22.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/review-frame-23.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/storyboard-v2.jpg | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v2-review-0.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v2-review-1.4.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v2-review-10.7.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v2-review-4.8.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v2-review-7.8.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v3/layout-study.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v3/native-0.000.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v3/native-1.600.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v3/native-10.350.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v3/native-11.958.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v3/native-3.650.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v3/native-5.300.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v3/native-8.150.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v3/qa-long-copy-flat-depth.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v3/review-frame-00.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v3/review-frame-01.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v3/review-frame-02.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v3/review-frame-03.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v3/review-frame-04.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v3/review-frame-05.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v3/review-frame-06.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v3/review-frame-07.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v3/review-frame-08.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v3/review-frame-09.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v3/review-frame-10.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v3/review-frame-11.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v3/review-frame-12.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v3/review-frame-13.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v3/review-frame-14.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v3/review-frame-15.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v3/review-frame-16.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v3/review-frame-17.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v3/review-frame-18.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v3/review-frame-19.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v3/review-frame-20.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v3/review-frame-21.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v3/review-frame-22.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v3/review-frame-23.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v3/storyboard-v3.jpg | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v4/explore-desktop.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v4/explore-mobile.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v4/native-0.000.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v4/native-11.100.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v4/native-13.700.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v4/native-15.958.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v4/native-3.400.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v4/native-5.600.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v4/native-6.700.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v4/native-9.000.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v4/native-final-centered.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v4/review-00.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v4/review-01.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v4/review-02.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v4/review-03.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v4/review-04.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v4/review-05.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v4/review-06.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v4/review-07.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v4/review-08.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v4/review-09.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v4/review-10.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v4/review-11.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v4/review-12.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v4/review-13.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v4/review-14.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v4/review-15.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v4/review-16.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v4/review-17.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v4/review-18.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v4/review-19.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v4/review-20.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v4/review-21.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v4/review-22.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v4/review-23.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v4/review-24.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v4/review-25.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v4/review-26.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v4/review-27.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v4/review-28.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v4/review-29.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v4/review-30.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v4/review-31.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v4/review-32.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v4/review-33.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v4/review-34.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v4/review-35.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v4/review-36.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v4/storyboard-v4.jpg | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v5/explore-desktop.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v5/explore-mobile.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v5/native-business.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v5/native-examples.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v5/native-final-aligned.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v5/native-final.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v5/native-initial-reveal.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v5/native-opening.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v5/native-subject.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v5/native-transition-10.1.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v5/native-transition-2.4.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v5/review-00.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v5/review-01.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v5/review-02.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v5/review-03.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v5/review-04.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v5/review-05.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v5/review-06.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v5/review-07.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v5/review-08.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v5/review-09.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v5/review-10.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v5/review-11.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v5/review-12.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v5/review-13.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v5/review-14.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v5/review-15.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v5/review-16.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v5/review-17.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v5/review-18.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v5/review-19.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v5/review-20.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v5/review-21.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v5/review-22.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v5/review-23.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v5/review-24.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v5/review-25.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v5/review-26.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v5/review-27.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v5/review-28.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v5/review-29.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v5/review-30.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v5/review-31.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v5/review-32.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v5/review-33.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v5/review-34.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v5/review-35.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v5/review-36.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v5/review-37.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v5/review-38.png | Generated visual QA, recovery or reference artifacts |
| design/explore-character-motion/Preview/v5/storyboard-v5.jpg | Generated visual QA, recovery or reference artifacts |
| design/explore-hook-motion/Auto-Save/ | Generated visual QA, recovery or reference artifacts |
| "design/explore-hook-motion/Auto-Save/Explore Hook Cover \342\200\224 Editorial Motion v4 auto-save 1.aep" | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| "design/explore-hook-motion/Auto-Save/Explore Hook Cover \342\200\224 Editorial Motion v5 auto-save 1.aep" | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| "design/explore-hook-motion/Auto-Save/Explore Hook Cover \342\200\224 Editorial Motion v6 auto-save 1.aep" | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| design/explore-phone-motion/Auto-Save/ | Generated visual QA, recovery or reference artifacts |
| "design/explore-phone-motion/Auto-Save/Explore Phone Cover \342\200\224 Clean Loop v6 auto-save 1.aep" | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| "design/explore-phone-motion/Auto-Save/Explore Phone Cover \342\200\224 Screen to Creator v4 auto-save 1.aep" | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| "design/explore-phone-motion/Auto-Save/Explore Phone Cover \342\200\224 Screen to Creator v4 auto-save 2.aep" | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| "design/explore-phone-motion/Auto-Save/Explore Phone Cover \342\200\224 Screen to Creator v4 auto-save 3.aep" | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| "design/explore-phone-motion/Auto-Save/Explore Phone Cover \342\200\224 iPhone Motion v5 auto-save 1.aep" | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| desktop.ini | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| dev-header-preview-4174-error.log | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| dev-header-preview-4174.log | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| dev-header-preview-error.log | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| dev-header-preview.log | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| dev-header-test-error.log | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| dev-header-test.log | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| edit-screen-audit/ | Generated visual QA, recovery or reference artifacts |
| folderico-QfzIGG.ico | Generated visual QA, recovery or reference artifacts |
| hatch-pet-runs/ | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| infra/gcp/ai-generation-worker/.terraform/ | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| infra/gcp/ai-generation-worker/ai-generation-worker.tfplan | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| infra/gcp/ai-generation-worker/recovery-canary-fix.tfplan | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| infra/gcp/ai-generation-worker/release-214c1ad.tfplan | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| infra/gcp/ai-generation-worker/release-397b5c9.tfplan | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| infra/gcp/ai-generation-worker/release-5200bcc.tfplan | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| infra/gcp/ai-generation-worker/release-b5e81a3.tfplan | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| infra/gcp/ai-generation-worker/release.tfplan | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| infra/gcp/ai-generation-worker/terraform.tfvars | Private local environment or infrastructure values; tracked examples are included |
| infra/gcp/bootstrap/.terraform/ | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| infra/gcp/bootstrap/terraform.tfstate | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| infra/gcp/carousel-scheduler/.terraform/ | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| infra/gcp/carousel-scheduler/release-5200bcc.tfplan | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| infra/gcp/carousel-scheduler/release.tfplan | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| infra/gcp/carousel-scheduler/terraform.tfvars | Private local environment or infrastructure values; tracked examples are included |
| infra/gcp/carousel-worker/.terraform/ | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| infra/gcp/carousel-worker/release-5200bcc.tfplan | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| infra/gcp/carousel-worker/release-b5e81a3.tfplan | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| infra/gcp/carousel-worker/release.tfplan | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| infra/gcp/carousel-worker/terraform.tfvars | Private local environment or infrastructure values; tracked examples are included |
| infra/gcp/foundation/.terraform/ | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| infra/gcp/foundation/foundation-final-cutover.tfplan | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| infra/gcp/foundation/foundation-postcutover.tfplan | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| infra/gcp/foundation/foundation-queues-release.tfplan | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| infra/gcp/foundation/foundation-release.tfplan | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| infra/gcp/foundation/terraform.tfvars | Private local environment or infrastructure values; tracked examples are included |
| infra/gcp/reaction-render-worker/.terraform/ | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| infra/gcp/reaction-render-worker/release-5200bcc.tfplan | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| infra/gcp/reaction-render-worker/terraform.tfvars | Private local environment or infrastructure values; tracked examples are included |
| infra/gcp/social-publish-worker/.terraform/ | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| infra/gcp/social-publish-worker/release-5200bcc.tfplan | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| infra/gcp/social-publish-worker/release-f74a3431dfce.tfplan | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| infra/gcp/social-publish-worker/release.tfplan | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| infra/gcp/social-publish-worker/terraform.tfvars | Private local environment or infrastructure values; tracked examples are included |
| infra/gcp/video-render-worker/.terraform/ | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| infra/gcp/video-render-worker/hook_composition_audio.tfplan | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| infra/gcp/video-render-worker/release-214c1ad.tfplan | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| infra/gcp/video-render-worker/release-397b5c9.tfplan | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| infra/gcp/video-render-worker/release-5200bcc.tfplan | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| infra/gcp/video-render-worker/release-564af8d.tfplan | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| infra/gcp/video-render-worker/release-8b946e6.tfplan | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| infra/gcp/video-render-worker/release-f5cfe10.tfplan | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| infra/gcp/video-render-worker/release.tfplan | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| infra/gcp/video-render-worker/terraform.tfvars | Private local environment or infrastructure values; tracked examples are included |
| infra/gcp/video-render-worker/video-render-worker.tfplan | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| infra/gcp/worker-canary/.terraform/ | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| landing-all.png | Generated visual QA, recovery or reference artifacts |
| landing-bottom-preview.png | Generated visual QA, recovery or reference artifacts |
| landing-cards-peek-refined.png | Generated visual QA, recovery or reference artifacts |
| landing-cards-under-clean.png | Generated visual QA, recovery or reference artifacts |
| landing-cards-under-section.png | Generated visual QA, recovery or reference artifacts |
| landing-centered-badges.png | Generated visual QA, recovery or reference artifacts |
| landing-comparison-cards.png | Generated visual QA, recovery or reference artifacts |
| landing-comparison-clean-outline.png | Generated visual QA, recovery or reference artifacts |
| landing-comparison-emojis.png | Generated visual QA, recovery or reference artifacts |
| landing-comparison-explore-lib.png | Generated visual QA, recovery or reference artifacts |
| landing-comparison-focus.png | Generated visual QA, recovery or reference artifacts |
| landing-comparison-refined.png | Generated visual QA, recovery or reference artifacts |
| landing-complete.png | Generated visual QA, recovery or reference artifacts |
| landing-cta-closeup.png | Generated visual QA, recovery or reference artifacts |
| landing-cta-scrolled.png | Generated visual QA, recovery or reference artifacts |
| landing-flow-clean.png | Generated visual QA, recovery or reference artifacts |
| landing-formats-full.png | Generated visual QA, recovery or reference artifacts |
| landing-formats-shelf.png | Generated visual QA, recovery or reference artifacts |
| landing-full-buttons.png | Generated visual QA, recovery or reference artifacts |
| landing-full-page.png | Generated visual QA, recovery or reference artifacts |
| landing-hero-aurora-preview.png | Generated visual QA, recovery or reference artifacts |
| landing-hero-clean-full.png | Generated visual QA, recovery or reference artifacts |
| landing-hero-clean.png | Generated visual QA, recovery or reference artifacts |
| landing-hero-dark.png | Generated visual QA, recovery or reference artifacts |
| landing-hero-fixed-white.png | Generated visual QA, recovery or reference artifacts |
| landing-hero-padding-fixed.png | Generated visual QA, recovery or reference artifacts |
| landing-hero-scrolled-header.png | Generated visual QA, recovery or reference artifacts |
| landing-multi-account-detail.png | Generated visual QA, recovery or reference artifacts |
| landing-multi-account-flow.png | Generated visual QA, recovery or reference artifacts |
| landing-multi-account-verified.png | Generated visual QA, recovery or reference artifacts |
| landing-pill-clean.png | Generated visual QA, recovery or reference artifacts |
| landing-redesign-preview.png | Generated visual QA, recovery or reference artifacts |
| landing-screenshot-mobile.png | Generated visual QA, recovery or reference artifacts |
| landing-screenshot-tablet.png | Generated visual QA, recovery or reference artifacts |
| landing-screenshot.png | Generated visual QA, recovery or reference artifacts |
| landing-sections-2-and-3.png | Generated visual QA, recovery or reference artifacts |
| landing-swipe-buttons-zoom.png | Generated visual QA, recovery or reference artifacts |
| landing-swipe-deck-compact.png | Generated visual QA, recovery or reference artifacts |
| landing-swipe-deck-preview.png | Generated visual QA, recovery or reference artifacts |
| landing-swipe-focus.png | Generated visual QA, recovery or reference artifacts |
| landing-swipe-like-dislike.png | Generated visual QA, recovery or reference artifacts |
| landing-swipe-posted.png | Generated visual QA, recovery or reference artifacts |
| landing-trust-badges-moved.png | Generated visual QA, recovery or reference artifacts |
| landing-updated-hooks.png | Generated visual QA, recovery or reference artifacts |
| landing-updated-order-preview.png | Generated visual QA, recovery or reference artifacts |
| landing-updated-videos.png | Generated visual QA, recovery or reference artifacts |
| landing_page/ | Generated visual QA, recovery or reference artifacts |
| local-landing-page.png | Generated visual QA, recovery or reference artifacts |
| local-run-logs/ | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| next-env.d.ts | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| node_modules/ | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| onboarding-flow-audit/ | Generated visual QA, recovery or reference artifacts |
| output/ | Generated visual QA, recovery or reference artifacts |
| public/try-ugcpilot/media/ | Existing local media originals; production serves the versioned GCS media |
| scripts/__pycache__/ | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| supabase/.temp/ | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| supabase/supabase/ | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| tinder/ | Existing ignored local prototype; separate deployed demo is unchanged |
| tmp-logs/ | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| tmp/ | Local credentials, tools, agent state or isolated working copies |
| tsconfig.tsbuildinfo | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| ugc-home-desktop.png | Generated visual QA, recovery or reference artifacts |
| ugc-home-header-updated-mobile.png | Generated visual QA, recovery or reference artifacts |
| ugc-home-mobile.png | Generated visual QA, recovery or reference artifacts |
| ugcpilot_logo__1.png | Generated visual QA, recovery or reference artifacts |
| worker/dist/ | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
| worker/node_modules/ | Generated logs, dependency/build caches, Terraform state/plans or temporary test artifacts |
