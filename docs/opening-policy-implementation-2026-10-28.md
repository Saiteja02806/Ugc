# Original-opening recreation implementation — 28 October 2026

Status: implemented locally; partially verified. **No deployment, live data changes or paid generation.**

## Scope and implementation

- All new public/private starting-image submissions use the first decoded source frame at elapsed t=0. Draft v4 binds the selected frame; immutable image receipt v5 freezes prompt v7. No later clarity image is included. Historical accepted jobs are looked up before new-request validation and keep their frozen contract. Historical results remain usable; requesting a new original opening is explicit.
- Image prompt v7 separates source scene/lighting/clothing/pose/hands/props/camera from influencer identity. It removes captions, watermarks, physical branding/logos and readable text while preserving underlying materials and objects. New animation cleanup follows this policy. Older frozen image and animation behavior remains historical.
- Omni restores the approved image's owned identity assets in order via authenticated media reads. Scope is owner + image job + image asset. Explicit empty removals and replacements persist in browser storage; stale reads cannot replace newer selection. Unsupported WAN/Seedance starting-frame routes submit the first frame alone. Existing Change flow remains the selector.
- New timecoded Hook requests freeze source duration, action duration and trim endpoint. Source shorter than provider duration keeps source-speed actions, then holds; longer sources still use existing selected-duration compression. Custom untimed directions and historical requests do not acquire this policy. Worker rejects altered timing before submission, retains full raw video and returns an initial trim suggestion. Saved/local/pending/empty drafts take priority; suggestions create no fake saved revision.
- New automatic Hook plans freeze text layout v1. New unstyled manual Hook Remix shares the wider 94% fit and measured 24–84 font bounds. Copy and explicit line breaks remain unchanged. Existing styles and old unversioned automatic plans retain old behavior.

## Prompt audit result

The read-only structural script confirms **104 public local plans and 12 private local drafts** contain normalized phases and compile numeric action intervals. These are timed action directions, rather than emotion-only summaries. This does not establish that each beat is visually complete or every draft is live. The historical production export has 107 public entries (21 timed) and 12 private entries (10 timed); it is not a fresh production read. No private package release or catalogue activation was performed.

The existing source-to-prompt review evidence was reused; this implementation did not newly watch every source frame or rewrite all 116 prompt plans. No claim of perfect source recreation is made.

## Validation and evidence

All logs below are under `outputs/opening-policy-implementation-20261028/`.

| Check | Result |
| --- | --- |
| `python tools/preflight.py --repo . --task ...` | PASS prerequisite discovery; not a substitute for reading context |
| `npx tsc --noEmit` | PASS, types-final.log |
| `npm run worker:build` | PASS, worker-build-final.log |
| Scoped ESLint including new hook, timing, fitter and recovery files | PASS, lint-final.log and lint-recovery.log |
| API/image preparation/history/draft/editor/photo checks | 129 PASS, integration-final.log |
| Image/video worker, source timing, legacy receipts, automatic/manual layout checks | 101 PASS, worker-layout-final.log |
| Starting-frame UI/navigation/client/history/variation/recovery controls | 91 PASS, ui-recovery-final.log |
| Wider composer suite | 87 PASS, 1 FAIL, composer-final.log; Slideshow completed neighboring-slide auto-handoff fails. Cause not established; no slideshow application changes in this patch |
| Actual local editor browser fixture | PASS at 1366×768,1536×864,390×844; editor-browser.log |
| Timed prompt structure script | PASS 104 public +12 private drafts; prompt-audit-final.log |
| Scoped whitespace check | PASS, diff-check.log |

Test commands used Node's repository server-only loader, experimental module mocks and transform-types, then `--test` with the relevant files. Worker tests run compiled `worker/dist` contracts and actual worker jobs with isolated provider mocks, not paid services. Composer submission fixtures isolate asynchronous photo restoration; `scripts/starting-frame-photo-carryover.test.mjs` separately executes the actual restoration hook against owned-media mocks, including removal/replacement/stale/error cases. These are local integration/component tests, not hosted end-to-end acceptance.

Actual outlined-text raster comparisons were regenerated and all three inspected: `outputs/remix-layout-audit-20261028/implemented-{1,2,3}.png`. Three-line sample grows from 52% to 90% ink width, short sample retains one line and longer sample retains four lines. Local browser screenshots are in `.tmp/explore-text-fonts-browser/` (including Proxima desktop/mobile previews). The local font browser pass checks rendering, positioning, exact text and save/reopen. No approved full-workflow before/after screenshot baseline or authenticated new-policy production test was captured.

## Protected behavior status

- VERIFIED locally: new frame0 bindings, public/private source IDs and hashes, ordered image roles, historical accepted-request replay, ownership rejection before billing mocks, no automatic submit during recovery, variant-history compatibility, saved words/newlines/style/empty drafts, reversible trim, raw duration, supported versus unsupported payloads, editable overlay and font save/reopen.
- VERIFIED by scoped diff: no new duplicate ordinary chooser, no global stylesheet, schema, dependency, provider configuration or deployment change. Existing Create/Demo/Schedule controls retained.
- NOT TESTED: new real image fidelity (identity, lighting, clothing, cleanup), real Omni identity benefit, generated ending completion before trim, hosted storage/job recovery, full authenticated cross-tab journey, backend scheduling/publishing. Scheduling was not changed by this patch.
- FAILED in broader local suite: Slideshow neighboring-slide completed-version auto-handoff; cause UNKNOWN and not asserted to be pre-existing.

## Context and procedure

Read/consulted: AGENTS.md, EXPLORE_CONTEXT.md, docs/ai-context/clear.md, docs/ai-context/nonnegotiables.md, REPEATABLE_SOURCE_PROMPT_REVIEW.md and earlier source/frame/pilot audit artifacts. Task skills used: ugc-context-memory, ugc-immutable-contracts, ugc-ui-clarity, ugc-starting-frame, ugc-video-prompt, ugc-opening-frame-prompt, ugc-regression-gate. Source analysis evidence came from the preceding frame-analysis review; no new exhaustive video analysis claimed. Next.js installed use-client guide was read. Supabase skill/docs were consulted for owned read-only draft lookup, with no migration.

Preflight limitation: this continued session consulted relevant sections of the very large historical Explore/incident ledgers, rather than proving a fresh full reread of every historical line. The complete nonnegotiables and applicable skill contracts were read. No context file was missing. This receipt does not claim full procedural or production acceptance.

Incidents: UGC-VID-024-OPENING and UGC-UI-044-REMIX have appended local implementation evidence; generated-output/hosted acceptance remains OPEN. Recovery tests discovered new draft v4 missing from the variation parser; compatibility was added and the 91-test recovery group passed. New image prompt/role text had invalid em-dash bytes; only invalid bytes were converted to UTF8, doubled carriage returns removed, and replacement-character regression added. Font fixture expectations were corrected for the supplied Semibold-only face without altering application fonts or saved styles.

## Changed files for this implementation

These are the files touched in this task, not a release inventory of the shared worktree (over 500 entries). Existing unrelated work was not reset, staged or deployed.

### Source

- lib/explore/hook-keyframe-draft.ts
- lib/explore/hook-keyframe-client.ts
- lib/explore/hook-keyframe-variations.ts
- lib/explore/hook-keyframe-image-prompt.ts
- lib/explore/hook-keyframe-generation-api.ts
- lib/explore/hook-source-frame-api.ts
- lib/explore/hook-starting-frame-client.ts
- lib/explore/hook-keyframe-result.ts
- lib/explore/starting-frame-reference-source.ts
- lib/explore/hook-starting-frame-history.ts
- lib/explore/creator-accounts.ts
- lib/explore/hook-keyframe-prompt-preview.ts
- lib/explore/starting-frame-photo-selection.ts (new)
- lib/explore/clip-draft-store.ts
- lib/explore/clip-draft-api.ts
- lib/explore/clip-draft-client.ts
- lib/explore/automatic-hook-text-plan.ts
- lib/explore/remix-text-edit.ts
- lib/explore/hook-middle-frame-motion.ts
- lib/explore/hook-keyframe-motion.ts
- lib/explore/starting-frame-workflow.ts
- lib/ai-studio/video-generation-api.ts
- components/explore/hook-starting-frame-workspace.tsx
- components/explore/use-starting-frame-photos.ts (new)
- components/explore/use-clip-draft-save.ts
- components/explore/format-video-editor.tsx
- components/explore/format-demo-section.tsx
- components/video/video-generation-workspace.tsx
- worker/src/lib/hook-keyframe-generation-contract.ts
- worker/src/lib/hook-keyframe-image-model.ts
- worker/src/lib/hook-source-timeline.ts (new)
- worker/src/lib/hook-initial-text-layout.ts (new)
- worker/src/lib/automatic-hook-text.ts
- worker/src/jobs/generate-hook-video.ts

### Tests

- lib/explore/hook-keyframe-generation-api.test.mjs
- lib/explore/hook-source-frame-api.test.mjs
- lib/explore/hook-starting-frame-history.test.mjs
- lib/explore/hook-keyframe-image-prompt.test.ts
- lib/explore/hook-keyframe-prompt-preview.test.ts
- lib/explore/hook-keyframe-draft.test.ts
- lib/explore/hook-keyframe-client.test.ts
- lib/explore/hook-keyframe-motion.test.ts
- lib/explore/automatic-hook-text-plan.test.mjs
- lib/explore/remix-text.test.ts
- lib/explore/clip-draft-api.test.mjs
- lib/explore/clip-draft.test.mjs
- lib/explore/clip-initial-timing.test.mjs (new)
- lib/ai-studio/video-generation-api.test.mjs
- worker/src/lib/automatic-hook-text.test.ts
- worker/src/lib/hook-initial-text-layout.test.ts (new)
- worker/src/lib/hook-source-timeline.test.ts (new)
- worker/src/jobs/generate-hook-video.test.mjs
- worker/src/jobs/generate-image.test.mjs
- scripts/starting-frame-photo-carryover.test.mjs (new)
- scripts/automatic-hook-text-editor.test.mjs
- scripts/explore-text-fonts.browser.cjs
- scripts/explore-format-generation-ui.test.mjs
- scripts/hook-starting-frame-ui.test.mjs
- scripts/hook-starting-frame-client.test.mjs
- scripts/hook-starting-frame-variations.test.mjs

### Durable documentation / local evidence

- EXPLORE_CONTEXT.md (append)
- docs/ai-context/clear.md (append)
- docs/ai-context/nonnegotiables.md
- docs/prompt-reviews/REPEATABLE_SOURCE_PROMPT_REVIEW.md (append)
- this receipt
- local test/raster/prompt-audit evidence under outputs/opening-policy-implementation-20261028, outputs/remix-layout-audit-20261028 and outputs/source-rules-audit-20261028; these are not production assets.

## Next acceptance and rollback boundary

Before rollout, review one actual t=0-generated influencer image for pose/identity/lighting/outfit/hands/text cleanup; only after it passes, review one video with source comparison through every ending frame and verify its initial editor trim. No paid retry or production activation is implied by these local checks. Resolve the Slideshow suite failure before a combined release. Roll back only this task's scoped patch if necessary; never reset the shared worktree or mutate historical job receipts.
