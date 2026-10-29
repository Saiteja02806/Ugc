# Nano Banana 2.1, full Hook timing and tab recovery — 29 October 2026

## Findings and implementation
- Nano Banana 2.1 is distinct from Gemini3.1FlashImage. Added an explicit nano_banana_2_1 starting-image option, four person-photo cap, validated receipt/model identity, worker dispatch and Gemini adapter binding to gemini-nano-banana-2.1. Kept existing nano_banana_2 mapped to gemini-3.1-flash-image, existing Gemini Pro default, pending receipts, scene/identity roles and credit reservation semantics. No label-only substitution.
- No hard-coded two-second auto-trim was found. The real risk was a composer default of3seconds except selected six-second variants, with timeline min(source,generated). New Hook approvals/history now carry measured source duration; default and model changes select the smallest supported duration covering that source. Frontend warns on an insufficient duration; server independently uses canonical duration and rejects insufficient new original-opening Hook requests before credits, including client-forged shorter source metadata. For timed prompts, complete actions at the source endpoint and hold only generated excess. Initial trim retains source endpoint; raw video stays available.4s -> generate4s/trim4000ms;5s ->5s/5000ms;4.3s ->5s/4300ms;2.3s -> model minimum3or4s/2300ms. Sources beyond the selected model maximum require a longer supported model; never silently compress. Existing compressed timeline records remain parseable and saved edits untouched. Wall duration policy unchanged.
- Earlier fresh-tab busy fix retained: account-wide job hints no longer lock a fresh workflow or auto-promote another job into its foreground. Added tab-local approved-frame/custom-instruction snapshots for public Hook, plus tab-local same-frame identity-photo choices. Actual reload uses owned GET verification and fresh URLs. Explicit clears stay clear; no signed URLs stored. Legacy localStorage records remain untouched and a legacy frame is adopted only for an explicitly matching hookFrameDraft URL. Other workflow namespaces retain existing behavior.

## Model source verification
Google documentation read on29October2026 explicitly lists separate provider IDs and four character-image inputs for the Flash family:
https://ai.google.dev/gemini-api/docs/image-generation
https://firebase.google.com/docs/ai-logic/models
Initial local-label inference was corrected after this check. Model output quality is not established by documentation or mocks.

## Files changed for this task
worker/src/lib/hook-keyframe-image-model.ts
worker/src/lib/gemini-image.ts
worker/src/jobs/generate-image.ts
worker/src/lib/hook-starting-frame-video.ts
worker/src/lib/hook-source-timeline.ts
components/explore/hook-starting-frame-workspace.tsx
components/explore/use-hook-composer-selection.ts
components/explore/use-starting-frame-photos.ts
components/explore/format-workspace.tsx
components/video/video-generation-workspace.tsx
lib/explore/hook-keyframe-client.ts
lib/explore/hook-starting-frame-history.ts
lib/explore/hook-starting-frame-history-client.ts
lib/explore/hook-keyframe-prompt-preview.ts
lib/ai-studio/video-generation-api.ts
scripts/hook-composer-selection.test.mjs
scripts/starting-frame-animation-references.test.mjs
scripts/explore-format-generation-ui.test.mjs
scripts/hook-starting-frame-ui.test.mjs
scripts/hook-tab-recovery.browser.cjs
lib/ai-studio/video-generation-api.test.mjs
lib/explore/hook-keyframe-generation-api.test.mjs
lib/explore/hook-keyframe-prompt-preview.test.ts
worker/src/lib/hook-source-timeline.test.ts
worker/src/lib/gemini-image-curated.test.mjs
worker/src/jobs/generate-image.hook-keyframe.test.mjs
EXPLORE_CONTEXT.md
docs/ai-context/clear.md
docs/ai-context/nonnegotiables.md
docs/nano-source-duration-tabs-2026-10-29.md
Prior uncommitted picker, avatars and scheduling confirmation changes are preserved. No dependency/config/schema change or media/reference catalogue rewrite.

## Preflight and contracts
AGENTS, relevant Explore/history sections under prior relevant-sections authorization, full nonnegotiables and existing context-memory/immutable-contracts/UI-clarity/regression/scheduling skills already read in this session. Starting-frame and video-prompt skills read for this task; latest original-t=0 policy supersedes historical middle-frame skill guidance. No new source-video action descriptions authored; existing reviewed motion and canonical duration evidence used. Installed Next use-client guide already read. Git status/current callers and persistence paths inspected; repository preflight scan recorded. Minimal boundaries: model option/provider binding; new source-duration validation/defaults; Hook tab-local selection state. Rollback does not need database/provider changes.

## Checks
PASS278/278application/regression tests: model UI/API binding, source-length defaults and model-aware selection, source-aware prompt preview/final hold, server rejection-before-credit and frozen source endpoints, saved initial-edit and Wall full-duration preservation, legacy receipts, own-vs-shared job busy state, pending request recovery and frame/photo stale reads. Existing obsolete0.608/2.433 prose assertions corrected to current two-decimal0.61/2.43 while exact source duration assertions remain.
PASS82/82mocked provider/worker tests: actual new Gemini model ID, verified scene/portrait bytes and roles, worker dispatch/frozen model identity, legacy provider mappings.
PASSnative browser two-tab shared-origin fixture: separate frames/custom motion after reload, same-frame photo override independence, explicit clear remains clear, no generation POSTs. Uses actual selection/photo hooks with owned reads mocked locally; not live generation.
PASStsc --noEmit, worker build, scoped ESLint, git diff --check. Logs .tmp/nano-source-tabs-final-tests.log, nano-provider-tests.log, nano-worker-build.log, nano-source-tabs-types.log, nano-source-tabs-lint.log, hook-tab-recovery-browser.log.

## Protected status / remaining limits
VERIFIED locally: original opening metadata and scene/identity distinction retained; old image models/receipts and stored edits unchanged; source-length policy; no silent source compression for new Hook API calls; source-aware default; separate tab-local selected frame/custom motion/photo overrides; own-job active progress and fresh-composer freedom; pending idempotent recovery unchanged; Wall full duration unchanged.
NOT VERIFIED: authenticated production tabs, real paid parallel generations, starting-image likeness, ending gesture completion before trim, provider availability under this project's real credentials, deployed worker/site, full production Next build. No paid image/video call, charge, post or deployment performed.
Existing account-wide uncertain-submission locks remain intentionally conservative. If another tab's submission outcome is unresolved, recovery may still be required before another same-scope submission. Explicit same-job URL is still a resume of that job. Session storage survives reload in the same tab; closing a tab ends that tab-local snapshot. Owned generated jobs/media remain available through history. This is not a claim of complete cross-tab isolation for every workflow or ambiguous network state.

Future release must deploy the updated image worker before exposing the new model in the website. No release executed here.
Incidents: UGC-VID-031 and UGC-UI-061 local follow-up; hosted acceptance pending.
