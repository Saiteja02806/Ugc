# Talking Head shared-feature fixes - 26 October 2026

Status: LOCALLY VERIFIED / PRODUCTION ACCEPTANCE OPEN. No deployment or provider calls submitted. This supersedes local implementation findings in the earlier audit; production-quality findings remain unverified.

## Implemented

- Interactive shared 24-hour hour/minute picker supports 00:00 through 23:59, keyboard, Escape/Done and the existing timezone-aware controlled draft. Backend conversion, account mapping and scheduling execution remain unchanged.
- Talking Head approved-frame animation reuses optional owned face-photo controls and validation. Ordered person references remain separate from the approved opening frame. Omni Flash 1.1 permits up to five; unsupported models, duplicates, frame-as-face and pending/failed selections block generation without silently discarding input. Script and Sound semantics stay intact. One approved frame preview has Change and removal.
- Explicit Generation history lists completed owned generations using the existing picker, separate owner/cache key and ready-video filtering. Opening cannot replace footage; accepted selection reuses owned-media recovery and preserves Demo/script.
- Both Talking Head clip editors receive canonical references so existing asset provenance can recover source text. The current gallery selection cannot substitute for the asset's source. No automatic transcription or invented text for arbitrary uploads.
- Nine archival exact frame-zero PNGs are prepared offline. Runtime checks source/frame SHA, dimensions and timestamp and reads the PNG without decoding an MP4. Both route bundles contain all nine PNGs. This removes the confirmed decode step; hosted latency is not measured.
- Two screenshot-marked fact-check cards remain hidden (seven visible), preserving historical restoration/media.
- Stale regression fixtures were repaired for current imports, actual model limits, async image resolution, current video preview composition, fake DOM and Windows temp-file behavior. Behavioral assertions still cover ownership, source order, failures and state transitions.

## Preflight and protected behavior

Actually read: AGENTS.md, EXPLORE_CONTEXT.md, docs/ai-context/clear.md, nonnegotiables.md, scheduling-contract.md and installed Next route-handler guidance. Mandatory skills: context-memory, immutable-contracts, ui-clarity, video-prompt, starting-frame, scheduling, regression-gate; frame-analysis in the preceding audit. Repository preflight and git status/diffs inspected before editing.

VERIFIED locally: source/identity separation; exact source hash/timestamp; script/Sound/ordered photos through real client/API admission; separate Demo/audio/clip edits; archived references; explicit owner-scoped history; invalid/model/pending/failure blockers; keyboard 24-hour selection and tab continuity; desktop/mobile Create/Demo/Schedule navigation and independent controls.

NOT VERIFIED: authenticated hosted draft/edit persistence, fresh model output identity/speech/motion, real schedule/targets/queue/provider delivery with browser closed, production timing/backlog, approved before/after pixel baseline, physical touch/zoom. Existing UGC-VID-010/011 recreation fidelity risks remain open. Local tests do not prove model quality or publication.

## Verification

- npm run test:explore: PASS 1,283/1,283, worker build and local media rendering. .tmp/talking-head-parity-explore-final.log.
- Focused Talking Head/draft/source suite: PASS 82/82. .tmp/talking-head-parity-targeted-final.log. Includes actual optional-face/history callbacks and download/decode traps for all nine prepared frames.
- History/source and direct-schedule service/local atomic DB: PASS 22/22. .tmp/talking-head-parity-history-schedule.log. Suites overlap; counts are not additive.
- Frame preparation verification: PASS nine source hashes and freshly decoded frame PNG hashes. .tmp/talking-head-parity-frames.log.
- npx tsc --noEmit: PASS. Scoped runtime/test ESLint: PASS. git diff --check: PASS (line-ending notices only).
- npm run build: PASS, including native bundle checks. Initial sandboxed build stalled and was stopped; elevated retry passed. .tmp/talking-head-parity-build-final.log. Both hook-keyframe/hook-starting-frame NFT manifests verified to include nine prepared PNGs plus manifest.
- node scripts/talking-head-workspace.browser.cjs: PASS at 1366x768,1536x864,390x844,320x740. Tested 00:00/09:30/21:30/23:59, keyboard ArrowUp/Escape, retained time on tab roundtrip, uploads, Demo text/volume and sequence continuity. Actual standalone History drawer signed-out state and Escape verified. No page errors/API writes. .tmp/talking-head-parity-workspace-final.log; .tmp/talking-head-full-workspace/results.json.
- Fresh images manually inspected: .tmp/talking-head-full-workspace/time-picker-1366.png, time-picker-320.png, generation-history-320.png; earlier reference/overview/Demo images inspected in the audit. No clipping observed. These are local fixtures, not production acceptance.
- Production recheck: https://www.getugcpilot.com/explore/create-hook redirects to https://getugcpilot.com/sign-in after hydration. Signed-in session requested; no credential extraction, deployment, paid generation or post submission.

## Files changed by this task

Runtime/configuration (concurrent changes in hook-source-frame.ts and next.config.ts preserved):
- components/scheduling/workflow-time-picker.tsx
- components/explore/workflow-scheduling-panel.tsx
- components/explore/starting-frame-animation-references.tsx
- components/explore/hook-workflow-preview.tsx
- components/explore/workflow-video-asset-picker.tsx
- components/explore/talking-head-clip-editing.tsx
- lib/explore/workflow-generation-client.ts
- lib/explore/hook-source-frame.ts
- lib/explore/talking-head-frames.json
- next.config.ts
- components/explore/talking-head-references.tsx
- lib/explore/talking-head-reference.ts

Prepared assets:
- public/explore/talking-head-frames/v1/talking-car-explainer.png
- public/explore/talking-head-frames/v1/talking-car-story.png
- public/explore/talking-head-frames/v1/talking-discovery.png
- public/explore/talking-head-frames/v1/talking-mug-story.png
- public/explore/talking-head-frames/v1/talking-outdoor-discovery.png
- public/explore/talking-head-frames/v1/talking-outdoor-reaction.png
- public/explore/talking-head-frames/v1/talking-room-explainer.png
- public/explore/talking-head-frames/v1/talking-surprised-story.png
- public/explore/talking-head-frames/v1/talking-warm-story.png

Support/tests:
- scripts/prepare-talking-head-frames.mjs
- scripts/workflow-demo-audio-state.test.mjs
- scripts/workflow-source-video-ui.test.mjs
- scripts/explore-recreate-source-action.test.mjs
- scripts/workflow-provider-errors.test.mjs
- scripts/explore-navigation-ui.test.mjs
- scripts/workflow-creation-form.test.mjs
- scripts/workflow-sections.test.mjs
- lib/ai-studio/audio-generation-api.test.mjs
- lib/ai-studio/openrouter-video-api.test.mjs
- scripts/explore-reference-images.test.mjs
- scripts/explore-catalog-update.test.mjs
- lib/ai-studio/reference-media-flow.test.ts
- scripts/workflow-studio-ui.test.mjs
- scripts/workflow-generation-client.test.mjs
- scripts/workflow-generation-recovery.test.mjs
- scripts/talking-head-saved-composition.test.mjs
- scripts/workflow-generation-api-contract.test.mjs
- scripts/talking-head-workspace.browser.cjs
- lib/explore/starting-frame-reference-source.test.ts
- scripts/explore-format-schedule-draft.test.mjs
- scripts/talking-head-references.test.mjs
- scripts/talking-head-references.browser.cjs

Documentation: EXPLORE_CONTEXT.md, append-only docs/ai-context/clear.md, docs/talking-head-hook-shared-audit-2026-10-26.md (earlier audit), this receipt.

Incidents: UGC-UI-012 added before implementation. UGC-SCH-001 recurrence, UGC-OPS-004 fixture drift and UGC-UI-011 removal receive local evidence; none marked production-fixed. Roll back only these feature hunks/assets/tests. Preserve concurrent Hook100 pilot, marketing, Carousel and publishing-retry work. No dependency, migration or worker deployment introduced by this task.

Deployment gate: closed pending signed-in acceptance. The repository regression skill requires unavailable credentials/infrastructure to remain unverified. User authorization to deploy is present; verification evidence is missing.
