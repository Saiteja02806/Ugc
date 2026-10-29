# Main UGC release candidate — 29 October 2026

This records the reviewed local candidate before production rollout. Hosted completion evidence will be stored separately in `.tmp/release-20261029-followup-ugc/`; do not interpret this candidate receipt as authenticated live acceptance.

## Included scope

Direct large photo picker; compact starting-frame preview; editable starting-image prompt and provider image-role labels; connected-account avatars; compact schedule confirmation; per-tab recreation recovery; source-duration preservation; Nano Banana2.1; editor/save/read recovery; Talking Head Sound placement and approved image plus voice-reference mode; retained Explore hover buffers; newest-first Instagram/TikTok content and due TikTok background refresh during an Analytics visit. Include every intentional current worktree change. Main UGC only: no MCP build/deploy, no migrations or environment/config/IAM changes.

## Checks and evidence

- Main webpack production build PASS, including TypeScript/static generation and native Hook bundle postbuild checks.
- Final affected application plus analytics test selection:633/633PASS; previous combined application scope645/645PASS; worker checks118/118PASS. Runs overlap and must not be added as unique totals.
- Analytics full suite109/109PASS; actual-component browser fixture PASS (newest zero views, retained metric sort, TikTok refresh/recovery and existing isolation/error/hidden/offline checks). Types PASS; zero scoped lint errors and one pre-existing TikTok img warning.
- Real TikTok analytics job f2e6d717-6939-4580-8b0d-bcc3acaea734 completed on the hosted worker and saved all four snapshots. No media generation or social publication was submitted.
- Earlier release-specific tests and browser evidence are in the feature receipts listed below. Local fixtures do not establish production acceptance. The available production browser redirects to sign-in; user chose to continue without login.
- Source inventory passed strict UTF-8; `git diff --check` PASS. React changes preserve hook ordering, existing controls/classes and immutable source sorting; background refresh stays after response with cooldown and owner scope.
- Build-cost PR guard: no manifest, lockfile, Next/Vercel config, build script, workspace, migration or CI trigger change. UGC website is the only Vercel target. MCP project inspected without mutation: no Git connection, so this main push does not trigger its build. Actual future billable cost UNKNOWN; no invented savings.

## Rollout and rollback boundary

Review exact commit; build one worker image tagged with that commit, pin digest, update two worker jobs then six services; verify preserved settings, ready revisions and100%traffic. Push exact commit to main only after workers verify. Reuse matching Git website deployment when present; otherwise create one main-project deployment, verify exact source and readiness, then promote and verify apex/www aliases. Preserve existing Vercel project settings. Worker rollback uses before-image/revision receipts; website rollback uses the recorded baseline deployment. No production rollback/settings change is automatically authorized by this receipt.

## Exclusions

No intentional source/config/test/docs path is deferred. Gitignored `.tmp/` (including test outputs, temporary cloud helpers and release evidence), `.tools/` caches/auth, `.next/`, `node_modules/`, `worker/dist/`, and local environment/credential files remain excluded. No production secrets were exported. MCP deployment is explicitly excluded by user instruction.

## Preflight and memory

AGENTS.md and existing feature context/contracts/incident history were reviewed under the user's scoped-context authorization. Mandatory ugc context-memory, immutable-contracts, UI-clarity and regression-gate procedures applied; applicable starting-frame, prompt and scheduling skills were used for preceding feature work, and Vercel deployment/env/cost/React procedures for release. Installed Next guide read. Relevant incidents include UGC-UI-052/059/063/064/065/066/067, UGC-SCH-016 and UGC-OPS-018-ENCODING; full per-feature details remain in their receipts and append-only ledger.

## Intentional paths in the reviewed candidate

- `EXPLORE_CONTEXT.md`
- `app/api/social/connections/route.ts`
- `components/analytics/analytics-dashboard.tsx`
- `components/analytics/instagram-analytics-workspace.tsx`
- `components/analytics/tiktok-beta-analytics-panel.tsx`
- `components/explore/format-demo-section.tsx`
- `components/explore/format-generation-references.tsx`
- `components/explore/format-video-editor.tsx`
- `components/explore/format-workspace.tsx`
- `components/explore/hook-starting-frame-workspace.tsx`
- `components/explore/hook-workflow-preview.tsx`
- `components/explore/pending-schedule-panel.tsx`
- `components/explore/starting-frame-animation-references.tsx`
- `components/explore/use-clip-draft-save.ts`
- `components/explore/use-cover-playback.ts`
- `components/explore/use-hook-composer-selection.ts`
- `components/explore/use-starting-frame-photos.ts`
- `components/explore/workflow-audio-reference.tsx`
- `components/explore/workflow-connected-accounts.tsx`
- `components/explore/workflow-creation-form.tsx`
- `components/explore/workflow-schedule-review.module.css`
- `components/scheduling/schedule-editor.tsx`
- `components/social/connected-accounts-workspace.tsx`
- `components/social/social-account-avatar.tsx`
- `components/social/use-social-account-picture.ts`
- `components/trending/trending-slideshow-automation-workspace.tsx`
- `components/video/video-generation-workspace.tsx`
- `docs/ai-context/clear.md`
- `docs/ai-context/nonnegotiables.md`
- `docs/analytics-account-audit-2026-10-29.md`
- `docs/analytics-newest-refresh-fix-2026-10-29.md`
- `docs/combined-fixes-reaudit-2026-10-29.md`
- `docs/connected-account-avatars-2026-10-29.md`
- `docs/editor-schedule-recovery-2026-10-29.md`
- `docs/explore-hover-and-release-status-2026-10-29.md`
- `docs/nano-source-duration-tabs-2026-10-29.md`
- `docs/schedule-confirmation-and-tab-isolation-2026-10-29.md`
- `docs/starting-frame-direct-dialog-2026-10-29.md`
- `docs/starting-frame-prompt-editor-2026-10-29.md`
- `docs/talking-head-image-voice-reference-2026-10-29.md`
- `docs/talking-head-sound-placement-2026-10-29.md`
- `lib/ai-studio/video-generation-api.test.mjs`
- `lib/ai-studio/video-generation-api.ts`
- `lib/analytics/instagram-content-insights.test.ts`
- `lib/analytics/instagram-content-insights.ts`
- `lib/analytics/routes.test.mjs`
- `lib/explore/clip-draft-api.test.mjs`
- `lib/explore/clip-draft-api.ts`
- `lib/explore/clip-draft-client.ts`
- `lib/explore/hook-keyframe-client.ts`
- `lib/explore/hook-keyframe-draft.test.ts`
- `lib/explore/hook-keyframe-draft.ts`
- `lib/explore/hook-keyframe-generation-api.test.mjs`
- `lib/explore/hook-keyframe-generation-api.ts`
- `lib/explore/hook-keyframe-prompt-preview.test.ts`
- `lib/explore/hook-keyframe-prompt-preview.ts`
- `lib/explore/hook-keyframe-variations.ts`
- `lib/explore/hook-starting-frame-history-client.ts`
- `lib/explore/hook-starting-frame-history.ts`
- `lib/explore/pending-schedule-client.ts`
- `lib/explore/starting-frame-workflow.ts`
- `lib/explore/wall-pending-composition.ts`
- `lib/explore/workflow-connected-accounts.ts`
- `lib/explore/workflow-generation-client.ts`
- `lib/explore/workflow-scheduling-draft.ts`
- `lib/social/scheduling-account-ui-contract.test.ts`
- `scripts/analytics-loading.browser.cjs`
- `scripts/clip-draft-recovery.test.mjs`
- `scripts/connected-account-avatars.browser.cjs`
- `scripts/explore-demo-loading.browser.cjs`
- `scripts/explore-format-common-editor.test.mjs`
- `scripts/explore-format-generation-ui.test.mjs`
- `scripts/explore-format-reference-upload.test.mjs`
- `scripts/explore-pending-schedule-ui.test.mjs`
- `scripts/hook-composer-selection.test.mjs`
- `scripts/hook-starting-frame-ui.test.mjs`
- `scripts/hook-tab-recovery.browser.cjs`
- `scripts/hook-workflow-preview.test.mjs`
- `scripts/reference-cover-playback.test.mjs`
- `scripts/schedule-confirmation.browser.cjs`
- `scripts/starting-frame-animation-references.test.mjs`
- `scripts/starting-frame-compact.browser.cjs`
- `scripts/talking-head-references.browser.cjs`
- `scripts/trending-automation-ui.browser.cjs`
- `scripts/workflow-composition-panel.test.mjs`
- `scripts/workflow-connected-accounts.test.mjs`
- `scripts/workflow-creation-form.test.mjs`
- `scripts/workflow-generation-api-contract.test.mjs`
- `scripts/workflow-generation-client.test.mjs`
- `worker/src/jobs/generate-hook-video.reapi.test.mjs`
- `worker/src/jobs/generate-image.hook-keyframe.test.mjs`
- `worker/src/jobs/generate-image.ts`
- `worker/src/lib/gemini-image-curated.test.mjs`
- `worker/src/lib/gemini-image.ts`
- `worker/src/lib/hook-keyframe-generation-contract.ts`
- `worker/src/lib/hook-keyframe-image-labels.ts`
- `worker/src/lib/hook-keyframe-image-model.ts`
- `worker/src/lib/hook-source-timeline.test.ts`
- `worker/src/lib/hook-source-timeline.ts`
- `worker/src/lib/hook-starting-frame-video.ts`
- `docs/main-ugc-release-2026-10-29.md` (this receipt)
