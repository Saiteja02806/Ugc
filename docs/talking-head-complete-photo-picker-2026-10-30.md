# Talking Head complete photo picker — local verification

This supersedes the layout-only boundary in `talking-head-photo-dialog-2026-10-29.md`. The user clarified that the actual Hook sections and capabilities are required, not merely a larger popup.

## Implemented

- Large centered Choose person photos dialog using the existing Hook picker CSS, selected-photo panel, large grid, mobile stacking/scrolling and fixed footer.
- Header Person photos / My Influencers, with the existing Photo guide & examples component.
- Person photos includes Uploaded photos and, when the existing starting-frame capability is enabled, Starting frames. UGC Pilot images remains a separate catalogue link. Upload, refresh, clearing, individual removal and Done are available.
- My Influencers reads the same owner-scoped Build AI Influencer history as Hook. Choosing an image re-resolves the current ready owned generated-image record, retains its asset ID and order, and never turns it into an upload or generates another image.
- Starting frames reads the existing owned frame history. Clicking a frame rechecks its exact job/asset/owner binding through the existing endpoint. Only a verified result enters the actual Talking Head starting-frame selection. Its frame/source/job/draft metadata and frozen motion directions are retained; no face-reference reinterpretation.
- The real parent clears conflicting ordinary image/video guidance after accepting the frame, preserves the user's script, Demo and audio, and uses a supported duration covering the measured source. Unsupported current models use the existing approved-frame fallback. Frame replacement never generates or bills for media.
- Returning from the catalogue to either header section retains selected photos. Creator Phone keeps its original compact picker function, and the original compact library has no functional diff. Existing approved-frame photo controls stay in place.

No new endpoints, schema, dependencies, worker code, model/prompt templates, environment settings or scheduling logic changed. Data access uses existing authenticated APIs. This is not a deployment or generated-output test.

## Checks

-238 focused checks PASS: creation form, image collection, actual Talking Head parent, Creator Phone, Demo/audio state, approved-frame references, generation UI/client/API contracts and owned influencer library client.
- Added coverage for influencer ID/owner resolution, duplicate suppression, wrong-ID/oversized rejection, exact stored-frame forwarding, foreign-owner rejection, five-second source duration, and script/Demo/audio preservation.
- One old parent test still targeted a checkbox even though the committed Sound control is already an accessible switch. Updated the assertion to exercise the actual switch; no Sound implementation changed.
- Actual-component Edge browser with project CSS PASS at1366x768 and390x844: all source sections, influencer selection/refresh,503 error/retry with selection retention, guide open/return, uploaded/catalogue selection, individual removal, clear, Done/reopen/Escape/focus, six/thirty limits and atomic overflow rejection. Starting-frame test rejects changed metadata, then passes the exact verified frame to the caller. Expected503 console messages come from the deliberate error fixture.
- Existing audio-name/Sound browser PASS at1366/1536/390px. Types and scoped lint PASS. Diff whitespace check PASS. No full production build or authenticated hosted test was run for this local patch.
- Screenshots inspected: `.tmp/talking-reference-browser/photo-dialog-empty-1366.png`, `photo-dialog-selected-390.png`, `photo-dialog-starting-390.png`. Original committed popover baseline screenshots remain in the same directory. Images and APIs are controlled local fixtures.

## Protected behavior

VERIFIED locally: owner/source isolation, selection order/limits, source-duration choice, exact frame metadata, user script/Demo/audio retention, unchanged Creator Phone picker and generation-client/API regressions. Existing successful closed/reopened selection remains. NOT VERIFIED: authenticated production UI, real provider generation, and a new persisted cross-reload guarantee. No generation, publication, deployment or live data mutation occurred.

## Files

- `components/explore/workflow-creation-form.tsx`
- `components/explore/talking-head-photo-library.tsx` (new)
- `components/explore/use-local-workflow-images.ts`
- `components/explore/hook-workflow-preview.tsx`
- `scripts/workflow-creation-form.test.mjs`
- `scripts/workflow-image-collection.test.mjs`
- `scripts/workflow-demo-audio-state.test.mjs`
- `scripts/talking-head-references.browser.cjs`
- `EXPLORE_CONTEXT.md`, append-only `docs/ai-context/clear.md` UGC-UI-068, prior partial receipt and this receipt.

Preflight/context: clean49869f19 baseline before the earlier local patch; user's AGENTS.md, nonnegotiables, relevant Explore/incident entries under the existing scoped-context authorization; ugc context-memory, immutable-contracts, UI-clarity, regression-gate and starting-frame/video-prompt procedures; installed Next use-client guide; actual frame/history/upload/auth clients and their tests. No prompt was rewritten, so prompt-writing mode routing was not required. Rollback boundary is the eight application/test files above; retain the append-only incident record. Local only, not pushed or deployed.
