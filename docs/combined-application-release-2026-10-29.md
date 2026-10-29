# Combined application release — 29 October 2026

Status: VALIDATED LOCALLY AND IN ISOLATED CLOUD TESTS; deployment pending. User authorized all intentional application changes, SEO, Trending, Schedule, Analytics and screens. Earlier no-deployment instruction is superseded. No production mutation has occurred as of the validation freeze.

## Scope and minimal change contract

Include every intentional worktree file below and the existing branch commits absent from origin/main. Website, MCP and the shared worker must agree on source revision. Existing approved UI, old saved drafts, immutable provider receipts, source-frame timestamps, silent-video defaults, local-time conversion, durable scheduling and disabled Creator Phone route remain protected. Do not activate automations, replay failed historical jobs or create public test posts as part of deployment.

Release validation corrections are limited to stale test fixtures/catalogue audit metadata, a one-line private Hook image-role signing guard, JSX punctuation and complete structured metadata for two existing app-demo guides and shared TechArticle guides, plus source-confirmed comparison-copy corrections, stale tool-count wording and existing-card links for ten orphaned blog URLs. No new dependency, migration, IAM or production setting change is needed. Creator Phone has only the preexisting shared account-selector compatibility change; no additional Phone implementation changes were made during this audit.

## Preflight and source receipt

Read AGENTS.md, docs/ai-context/nonnegotiables.md, relevant EXPLORE_CONTEXT.md/WALL_TEXT_CONTEXT.md/CAROUSEL_CONTEXT.md history and docs/ai-context/clear.md; mandatory context-memory, immutable-contracts, regression-gate, UI-clarity, scheduling, starting-frame and video-prompt skills. Vercel-cost-guardian PR guard and Supabase procedures were applied. Installed Next testing overview and metadata/OG-image guide were read. Repository preflight and migration-reconciliation freeze check passed. Preserve the distinction between local fixtures and hosted acceptance.

## Validation so far

- Broad changed-path root suite: 2168 tests, 2160 pass, eight initially blocked Docker tests subsequently passed8/8 in approved disposable Cloud Build4eaa8f7b-23cc-4aa6-ae7d-ae08366795e1 (SUCCESS). Combined coverage2168/2168; no skips.
- Worker default suite: 251 pass plus 20 posttests.
- Additional worker jobs/adapters: 149/149 pass after private identity-role signing fix. Includes legacy/new private receipts and both image models, historical two-scene receipts and negative bindings. No paid providers.
- Additional compiled worker layout/render tests: 88/88 pass. Cross-project Wall layouts: 63/63 pass; source TS direct invocation was corrected to compiled JS for NodeNext imports.
- Typecheck passed; first full production build passed (353 static pages). Final exact application build after all SEO fixes PASS (353 static pages). Intermediate retries failed from local disk/memory pressure. Reproducible old temporary build directories/cache were removed, with resolved path/junction guards; source and dependencies preserved.
- Full lint found three JSX punctuation errors, now fixed. Final full lint: zero errors and 73 warnings. Additional shared-schema and factual-copy lint passes.
- Browser PASS: Analytics loading/refresh/owner isolation; Schedule same-platform multi-account selection, deselect/reselect/refresh/reload/mobile; Trending automation controls and no implicit activation; Wall structured heading/body Remix and old receipts; navigation recovery at 1440/390 widths; 97 actual Wall layouts and 22 Character workspace tests; caption preview/export glyph parity (white glyph IoU 0.952–0.965, one-pixel glyph coverage 1.0). These use isolated auth/API boundaries.
- Rendered SEO gate found missing common schema fields on two app-demo guides. Existing article/FAQ helpers now supply image/publisher/author, breadcrumb and shared visible FAQ data. Final rendered gate PASS119/119 pages, complete homepage reachability, canonical/sitemap match and schema matching visible guides. Initial full graph traversal found ten orphaned new blog pages; core/comparison related-article cards now connect them without changing application navigation. Shared workflow-guide TechArticle is retained as a valid Article subtype, with author/publisher/image fields added; exact-type checker assertions were corrected without inventing FAQs.
- No likely private keys, GitHub tokens, Google API keys or OpenAI project keys detected in changed release files by the scoped pattern check. This is not a comprehensive security scan.

## Database gate and release order

All nine migration names in the combined branch diff already exist in the production migration ledger. Normalized SQL bodies match every local file. Four remote timestamps differ but their names and bodies match. Do not bulk-push/reapply these migrations. Production schema remains unchanged.

1. Complete test, lint, final build, rendered SEO and visual gates; freeze all intended paths in one reviewed commit.
2. Build the exact committed worker source in the existing worker Cloud Build pipeline and record its immutable image digest.
3. Update the two existing Cloud Run jobs, then six services, preserving configuration and secrets. Verify exact image/source, readiness, configuration fingerprints and 100% traffic. Do not execute jobs manually.
4. Push the complete release to main after checking no competing remote change. Reuse the correct Git-triggered website deployment if present; do not duplicate it unnecessarily. Build MCP from the same SHA. Promote only after all eight worker targets verify.
5. Verify production aliases, source/runtime identity, public SEO/robots/sitemap, protected auth boundaries and read-only backend health. Authenticated provider-backed acceptance requires a valid production session; no local fixture proves actual publication or generated-media quality.

Read-only pre-release production baseline: landing and MCP health200; unauthenticated connections/schedules401. Creator Phone follows the canonical redirect and returns a streamed200 response containing not-found markers; public status alone does not establish route availability. The local route source remains notFound(); no working Phone flow was demonstrated. No authenticated live UI/provider acceptance was established.

## Recorded rollback baseline

Website: dpl_3vcd4TdXQoShibnHScGXNcPciw4e (ugc-8v7rfeua6-ugcpilot.vercel.app).
MCP: dpl_4WPJc55Rq6E1rX1G88KXdg6AR5nu (ugc-in14cok42-ugcpilot.vercel.app).
Both baseline source 20f9219012ca3be020da4b2a41951b7c6d2472b5.
All eight worker targets baseline image us-central1-docker.pkg.dev/ugcsaas/ugc-worker/ugc-worker@sha256:65caa1e849d86ae3125cfec9aeac980264de51a079ad06bf9a110ebdd176126e; services at their r-20f92190 revisions. No schema rollback is required because this release applies no database change. Before promotion, guard against concurrent alias/configuration drift.

## Exclusions

Only ignored local/generated/private material is excluded: .env* except tracked .env.example; .tools/ credentials and tool caches; .tmp/ scratch runners, release logs, temporary archives and screenshots; .vercel/ local auth/project metadata; .next/ output/cache; node_modules/ and worker/node_modules/; worker/dist/; *.tsbuildinfo and generated next-env.d.ts; output/, outputs/, build/, local-run-logs/, .playwright-mcp/; plaintext private creator catalogue/media/prompt files listed in .gitignore. Existing encrypted creator packages remain included wherever tracked. No intentional unignored project path is deferred. Precise changed paths are below; release evidence remains in .tmp/release-20261029/.

## Factual SEO copy findings

Official source checks disproved the new annual-only Synthesia billing and Billo $59–$120/extra ordinary ad-rights claims. These were corrected using [Synthesia pricing](https://www.synthesia.io/pricing) and [Billo’s pricing explanation](https://billo.app/blog/how-billo-pricing-works/), with source links added to the pages. The credit-based UGC Pilot service is no longer called unlimited Hook experimentation. Other unsourced performance percentages and broad competitor characterizations remain editorially NOT VERIFIED. Technical SEO validation does not establish those claims, indexing, rankings or traffic.

## Remaining verification / approvals

The eight real multi-session PostgreSQL tests PASS in the approved disposable Cloud Build environment. Automatic approval review rejected uploading the test and migration files to an isolated Cloud Build runner because this remote test destination was not explicitly authorized. The user subsequently explicitly approved Cloud Build testing. Approved disposable build4eaa8f7b-23cc-4aa6-ae7d-ae08366795e1 uploads only164 test/migration files (1.9MiB) without production credentials/data; its result is SUCCESS:8tests/8pass/0fail/0skip. The prior rejection was not bypassed. Remaining deployment/backend checks are NOT VERIFIED because nothing has been deployed.

Incidents appended: UGC-REL-20261029, UGC-VID-RELEASE-20261029, UGC-SEO-RELEASE-20261029. Preserve all prior incident history.

## Protected behavior receipt

VERIFIED in local/isolated tests: source/identity role separation and frame timestamps, old saved drafts/receipts, silent audio policy, shared editor validation/export, selection recovery, account ownership, timezone/24-hour scheduling contracts, durable atomic scheduling/idempotency, Trending pause/revision races, Analytics owner isolation and return refresh. VERIFIED from source: Creator Phone remains disabled. NOT VERIFIED: final production deployment/runtime revision, authenticated production UI writes, real provider generation quality or eventual social publication with browser closed; do not equate fixture tests with these outcomes.

## Worktree paths included

- `EXPLORE_CONTEXT.md`
- `WALL_TEXT_CONTEXT.md`
- `app/blog/ai-content-creation-tools-small-teams/page.tsx`
- `app/blog/ai-creator-avatars-tech-products/opengraph-image.tsx`
- `app/blog/ai-creator-avatars-tech-products/page.tsx`
- `app/blog/ai-creator-avatars-tech-products/twitter-image.tsx`
- `app/blog/ai-ugc-for-saas-startups/opengraph-image.tsx`
- `app/blog/ai-ugc-for-saas-startups/page.tsx`
- `app/blog/ai-ugc-for-saas-startups/twitter-image.tsx`
- `app/blog/ai-ugc-video-maker-software/opengraph-image.tsx`
- `app/blog/ai-ugc-video-maker-software/page.tsx`
- `app/blog/ai-ugc-video-maker-software/twitter-image.tsx`
- `app/blog/ai-video-generator-for-saas/opengraph-image.tsx`
- `app/blog/ai-video-generator-for-saas/page.tsx`
- `app/blog/ai-video-generator-for-saas/twitter-image.tsx`
- `app/blog/arcads-alternative-for-saas/opengraph-image.tsx`
- `app/blog/arcads-alternative-for-saas/page.tsx`
- `app/blog/arcads-alternative-for-saas/twitter-image.tsx`
- `app/blog/best-ai-ugc-tools-for-saas/opengraph-image.tsx`
- `app/blog/best-ai-ugc-tools-for-saas/page.tsx`
- `app/blog/best-ai-ugc-tools-for-saas/twitter-image.tsx`
- `app/blog/billo-alternative-for-saas/opengraph-image.tsx`
- `app/blog/billo-alternative-for-saas/page.tsx`
- `app/blog/billo-alternative-for-saas/twitter-image.tsx`
- `app/blog/capcut-vs-saas-ugc-generator/opengraph-image.tsx`
- `app/blog/capcut-vs-saas-ugc-generator/page.tsx`
- `app/blog/capcut-vs-saas-ugc-generator/twitter-image.tsx`
- `app/blog/cost-of-ugc-video-for-saas/opengraph-image.tsx`
- `app/blog/cost-of-ugc-video-for-saas/page.tsx`
- `app/blog/cost-of-ugc-video-for-saas/twitter-image.tsx`
- `app/blog/creatify-alternative-for-saas/opengraph-image.tsx`
- `app/blog/creatify-alternative-for-saas/page.tsx`
- `app/blog/creatify-alternative-for-saas/twitter-image.tsx`
- `app/blog/heygen-alternative-for-ugc-hooks/opengraph-image.tsx`
- `app/blog/heygen-alternative-for-ugc-hooks/page.tsx`
- `app/blog/heygen-alternative-for-ugc-hooks/twitter-image.tsx`
- `app/blog/how-to-make-ugc-ads-for-saas/opengraph-image.tsx`
- `app/blog/how-to-make-ugc-ads-for-saas/page.tsx`
- `app/blog/how-to-make-ugc-ads-for-saas/twitter-image.tsx`
- `app/blog/makeugc-alternative-for-b2b-saas/opengraph-image.tsx`
- `app/blog/makeugc-alternative-for-b2b-saas/page.tsx`
- `app/blog/makeugc-alternative-for-b2b-saas/twitter-image.tsx`
- `app/blog/saas-product-demo-video-generator/opengraph-image.tsx`
- `app/blog/saas-product-demo-video-generator/page.tsx`
- `app/blog/saas-product-demo-video-generator/twitter-image.tsx`
- `app/blog/short-form-video-marketing-saas/opengraph-image.tsx`
- `app/blog/short-form-video-marketing-saas/page.tsx`
- `app/blog/short-form-video-marketing-saas/twitter-image.tsx`
- `app/blog/synthesia-vs-ai-ugc-saas/opengraph-image.tsx`
- `app/blog/synthesia-vs-ai-ugc-saas/page.tsx`
- `app/blog/synthesia-vs-ai-ugc-saas/twitter-image.tsx`
- `app/blog/talking-head-hook-generator-saas/opengraph-image.tsx`
- `app/blog/talking-head-hook-generator-saas/page.tsx`
- `app/blog/talking-head-hook-generator-saas/twitter-image.tsx`
- `app/blog/trend-io-alternative-for-saas/opengraph-image.tsx`
- `app/blog/trend-io-alternative-for-saas/page.tsx`
- `app/blog/trend-io-alternative-for-saas/twitter-image.tsx`
- `app/blog/ugc-agency-vs-ai-ugc-software/opengraph-image.tsx`
- `app/blog/ugc-agency-vs-ai-ugc-software/page.tsx`
- `app/blog/ugc-agency-vs-ai-ugc-software/twitter-image.tsx`
- `app/blog/ugc-video-generator-examples/page.tsx`
- `app/guides/saas-demo-video-script/page.tsx`
- `app/guides/screen-recording-for-app-demo/page.tsx`
- `components/analytics/instagram-analytics-workspace.tsx`
- `components/auth/auth-guard.tsx`
- `components/characters/character-reference.test.mjs`
- `components/characters/character-workspace.tsx`
- `components/explore/ai-character-card.tsx`
- `components/explore/explore-workflow-card.tsx`
- `components/explore/explore-workspace.tsx`
- `components/explore/format-demo-section.tsx`
- `components/explore/format-schedule-panel.tsx`
- `components/explore/format-slideshow-editor.tsx`
- `components/explore/format-text-overlays-editor.tsx`
- `components/explore/format-video-editor.module.css`
- `components/explore/format-video-editor.tsx`
- `components/explore/format-video-text-overlay.tsx`
- `components/explore/format-workspace.module.css`
- `components/explore/hook-starting-frame-workspace.tsx`
- `components/explore/hook-workflow-preview.tsx`
- `components/explore/pending-schedule-panel.tsx`
- `components/explore/phone-workflow-preview.tsx`
- `components/explore/remix-text-section.tsx`
- `components/explore/talking-head-schedule-review.tsx`
- `components/explore/use-clip-draft-save.ts`
- `components/explore/use-cover-playback.ts`
- `components/explore/wall-schedule-preview.tsx`
- `components/explore/workflow-connected-accounts.tsx`
- `components/explore/workflow-edit-workspace.tsx`
- `components/explore/workflow-finishing-boundary.tsx`
- `components/explore/workflow-sequence-preview.tsx`
- `components/layout/app-shell.tsx`
- `components/layout/app-sidebar.tsx`
- `components/layout/workspace-navigation-feedback.tsx`
- `components/marketing/founder-workflow-guide.tsx`
- `components/scheduling/schedule-editor.tsx`
- `components/scheduling/scheduling-workspace.tsx`
- `components/settings/business-context-settings.tsx`
- `components/settings/settings-workspace.tsx`
- `components/trending/trending-slideshow-automation-workspace.tsx`
- `docs/ai-context/clear.md`
- `docs/analytics-freshness-fix-2026-10-29.md`
- `docs/analytics-return-refresh-2026-10-24.md`
- `docs/combined-application-release-2026-10-29.md`
- `docs/control-responsiveness-audit-2026-10-29.md`
- `docs/control-responsiveness-fix-2026-10-29.md`
- `docs/explore-six-confirmed-fixes-2026-10-29.md`
- `docs/explore-six-fixes-recheck-2026-10-29.md`
- `docs/hook-reference-decisions-2026-10-29.md`
- `docs/hook-stretch-test-fix-2026-10-29.md`
- `docs/idle-sidebar-diagnosis-2026-10-29.md`
- `docs/idle-sidebar-fix-2026-10-29.md`
- `docs/prompt-reviews/wall-complete-placement-review-2026-10-29.md`
- `docs/prompt-reviews/wall-end-to-end-recheck-2026-10-29.md`
- `docs/prompt-reviews/wall-next-three-admission-2026-10-29.md`
- `docs/reference-caption-fix-2026-10-29.md`
- `docs/schedule-account-selection-fix-2026-10-29.md`
- `docs/wall-layout-02-structured-remix-2026-10-29.md`
- `docs/workflow-font-match-audit-2026-10-29.md`
- `lib/analytics/use-analytics-resource.ts`
- `lib/analytics/use-analytics-wake.test.mjs`
- `lib/analytics/use-analytics-wake.ts`
- `lib/business-profiles/ai-context.ts`
- `lib/business-profiles/business-context-form.test.ts`
- `lib/business-profiles/business-context-settings-contract.test.ts`
- `lib/business-profiles/onboarding-domain-brand.test.mjs`
- `lib/business-profiles/profile-gate-query.ts`
- `lib/business-profiles/schema.ts`
- `lib/characters/prompt-skills.ts`
- `lib/explore/automatic-hook-text-plan.test.mjs`
- `lib/explore/automatic-hook-text-plan.ts`
- `lib/explore/clip-draft-client.ts`
- `lib/explore/clip-draft.test.mjs`
- `lib/explore/creator-accounts.test.mjs`
- `lib/explore/format-schedule-draft.ts`
- `lib/explore/hook-curated-frames.test.ts`
- `lib/explore/hook-keyframe-generation-api.test.mjs`
- `lib/explore/hook-keyframe-generation-api.ts`
- `lib/explore/hook-keyframe-motion-plans-b.json`
- `lib/explore/hook-keyframe-motion-plans-c.json`
- `lib/explore/hook-keyframe-motion.test.ts`
- `lib/explore/hook-middle-frame-motion.test.ts`
- `lib/explore/hook-motion-rewrite-contract.test.ts`
- `lib/explore/hook-user-decisions.test.ts`
- `lib/explore/reference-text.ts`
- `lib/explore/remix-text-api.test.mjs`
- `lib/explore/remix-text-api.ts`
- `lib/explore/remix-text-draft.ts`
- `lib/explore/remix-text-edit.ts`
- `lib/explore/remix-text-input.ts`
- `lib/explore/remix-text-prompt.ts`
- `lib/explore/remix-text.test.ts`
- `lib/explore/simple-workflow-schedule.ts`
- `lib/explore/slideshow-business-context.test.ts`
- `lib/explore/starting-frame-reference-source.test.ts`
- `lib/explore/starting-frame-reference-source.ts`
- `lib/explore/wall-heading-body-remix.test.ts`
- `lib/explore/wall-money-motion.ts`
- `lib/explore/wall-money-references.test.ts`
- `lib/explore/wall-reference-motion-catalog.json`
- `lib/explore/workflow-connected-accounts.ts`
- `lib/explore/workflow-schedule-client.ts`
- `lib/explore/workflow-schedule-transport.test.ts`
- `lib/explore/workflow-scheduling-draft.ts`
- `lib/explore/workflow-session.test.mjs`
- `lib/marketing/public-page-paths.json`
- `lib/mcp/reference-tools.ts`
- `lib/resources/hook-video-bundle.test.ts`
- `lib/scheduling/schedule-workspace-status.test.mjs`
- `lib/website-analysis/analyze-business.ts`
- `lib/website-analysis/schema.ts`
- `scripts/analytics-loading.browser.cjs`
- `scripts/automatic-hook-text-editor.test.mjs`
- `scripts/check-public-seo.mjs`
- `scripts/clip-draft-recovery.test.mjs`
- `scripts/direct-schedule-atomic-db.test.mjs`
- `scripts/explore-clip-live-controls.test.mjs`
- `scripts/explore-demo-loading.browser.cjs`
- `scripts/explore-format-common-editor.test.mjs`
- `scripts/explore-format-demo-state.test.mjs`
- `scripts/explore-format-schedule-draft.test.mjs`
- `scripts/explore-navigation-ui.test.mjs`
- `scripts/explore-pending-schedule-ui.test.mjs`
- `scripts/explore-reference-audio-job.test.mjs`
- `scripts/explore-reference-text-inventory.mjs`
- `scripts/explore-sequence-preview.test.mjs`
- `scripts/explore-slideshow-editor.test.mjs`
- `scripts/explore-text-fonts.browser.cjs`
- `scripts/explore-text-fonts.test.mjs`
- `scripts/hook-reference-prompts-release.test.mjs`
- `scripts/hook-reference-release.test.mjs`
- `scripts/hook-remix-emoji-render.test.mjs`
- `scripts/hook-starting-frame-ui.test.mjs`
- `scripts/idle-sidebar-diagnostics.mjs`
- `scripts/idle-sidebar-recovery.browser.cjs`
- `scripts/mcp-business-context-tools.test.mjs`
- `scripts/mcp-reference-tools.test.mjs`
- `scripts/normal-opening-preparation-evidence.test.mjs`
- `scripts/prepare-reference-caption-glyphs.mjs`
- `scripts/reference-caption-parity.browser.cjs`
- `scripts/reference-caption-style.test.mjs`
- `scripts/remix-text-catalog.test.mjs`
- `scripts/remix-text-db.test.mjs`
- `scripts/revised-recreate-prompts.test.mjs`
- `scripts/talking-head-schedule-preview.test.mjs`
- `scripts/test-public-seo-render.mjs`
- `scripts/trending-automation-ui.browser.cjs`
- `scripts/wall-alignment-length.test.ts`
- `scripts/wall-complete-catalogue.test.ts`
- `scripts/wall-complete-layouts.browser.cjs`
- `scripts/wall-gallery-placement.test.mjs`
- `scripts/wall-heading-body-remix.browser.cjs`
- `scripts/wall-layout-static-review.mjs`
- `scripts/workflow-account-selection.browser.cjs`
- `scripts/workflow-account-selection.test.mjs`
- `scripts/workflow-connected-accounts.test.mjs`
- `scripts/workflow-finishing-ui.test.mjs`
- `scripts/workflow-source-video-ui.test.mjs`
- `worker/src/jobs/generate-hook-video.test.mjs`
- `worker/src/jobs/generate-image.hook-keyframe.test.mjs`
- `worker/src/jobs/generate-image.ts`
- `worker/src/lib/automatic-hook-text.ts`
- `worker/src/lib/explore-format-edit.ts`
- `worker/src/lib/explore-hook-reference-release.json`
- `worker/src/lib/explore-text-outlines.ts`
- `worker/src/lib/reference-caption-glyphs.json`
- `worker/src/lib/reference-caption-paths.ts`
- `worker/src/lib/slideshow-business-context.ts`
- `worker/src/lib/wall-initial-text-layout.test.ts`
- `worker/src/lib/wall-initial-text-layout.ts`
- `worker/src/lib/wall-six-layouts.test.ts`

Final predeployment postbuild receipt: check-hook-frame-runtime PASS; check-hook-frame-bundles PASS outside sandbox after a sandbox-only EPERM hard-link failure. All four native route packages resolve/start native executables; lightweight MCP health/discovery exclude native media packages. No source fix was needed for the sandbox restriction.
