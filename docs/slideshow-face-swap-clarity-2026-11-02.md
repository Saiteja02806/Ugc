# Slideshow face-swap clarity — local implementation

## Result and interaction contract

The slideshow prompt now uses the ScanFace icon in the same outline button sizing as its attachment control. A count badge shows the number of confirmed face-swap slides. The button opens a larger responsive dialog instead of the small photo popover.

1. Select or upload up to four photos of the **same person**. First photo is primary; later photos support that identity. Clicking a selected photo removes it; removing the primary promotes the next selected photo.
2. Choose numbered slide thumbnails. Only source slides already selected for generation are eligible. Face selection does not silently expand normal generation.
3. **Done** commits photo and slide choices and closes the dialog. Cancel, Escape and outside dismissal discard unconfirmed edits. Neither selection nor Done starts generation. Both photos and slides must be chosen together, or both cleared.

Multiple files can be uploaded together. Uploads keep the dialog busy and prevent confirmation/closing until settled. Failed uploads preserve current photo choices. Existing saved-photo loading/error/retry behavior remains. Confirmed choices survive reopening during the current workflow session; in-progress face-job recovery stores the frozen reference IDs and supports legacy single-photo records. Unsubmitted face choices remain session-only, as before.

The slideshow Generate action uses existing app blue `#0078d4`, retaining disabled semantics. Other workflow buttons retain their default treatment. Dark containers and the underlying workflow layout remain unchanged; the dialog is the explicitly requested larger selection surface.

## Backend and model boundary

The face-swap API previously accepted a single influencer asset. It now accepts optional `influencerReferenceAssetIds` (up to three supporting photos). All selected assets must be ready, undeleted, owned images/influencers with image MIME types and trusted canonical URLs. Duplicate IDs/URLs, the target reused as identity, unavailable/foreign assets and invalid bodies fail before credit reservation.

The ordered durable payload is target scene, primary identity, then supporting identities. Worker forwards all references to the identity stage and existing harmonizer. Supporting-photo instructions explicitly retain target background, outfit, pose and composition. Legacy single-photo prompts and input order are unchanged. Pending submission acknowledgement and owner-scoped face-job recovery retain supporting IDs; the existing idempotency key includes the ordered identity IDs. The quote remains one swap per distinct marked slide, version1 only; supporting photo count does not multiply charges. These are wiring/fixture checks, not proof that a model will reproduce identity perfectly.

Future release ordering: deploy the compatible worker before the website/API/UI admits additional references. **No deployment performed.** No migration, dependency or configuration change.

## Files changed in this task

- `components/explore/slideshow-face-swap-control.tsx` — new dialog, numbered slides, draft confirmation, badge and aligned trigger.
- `components/explore/slideshow-face-choice.tsx` — same-person multi-photo selection, primary labels, batch upload, busy/error handling.
- `components/explore/recreate-generation-view.ts` — optional photo/slide presentation types.
- `components/explore/format-workspace.tsx` — provide original source-slide numbers/eligibility; remove obsolete outside-click mode handler and separate face-mode strip wiring.
- `components/workspace/ugc-chat-workspace.tsx` — dialog integration, frozen supporting-photo plans, compatible face-job recovery and request handoff.
- `components/generation/ai-studio-composer.tsx` — optional blue Generate treatment; existing default retained.
- `components/explore/workflow-creation.module.css` — scoped blue button class.
- `lib/ai-studio/face-swap-api.ts` — validate/forward owned supporting photos before billing.
- `lib/ai-studio/face-swap-api.test.mjs` — API positive/negative/legacy and ordered-reference tests.
- `lib/explore/slideshow-face-swap.ts` — carry supporting IDs with existing slide/version plan.
- `scripts/slideshow-face-swap-ui.test.mjs` — update moved-control assertion and supporting-reference planning test.
- `scripts/slideshow-face-swap.browser.mjs` — actual components with fixture photo reads/uploads; responsive interaction assertions.
- `worker/src/jobs/generate-image.ts` — accept target plus one–four identities and forward support refs.
- `worker/src/jobs/generate-image.test.mjs` — worker supporting-photo and excessive-reference regression test.
- `worker/src/lib/openrouter-gemini-image.ts` — ordered supporting identities and identity-only role instruction.
- `worker/src/lib/openrouter-gemini-image.test.ts` — actual multimodal request ordering/stage input test.
- `EXPLORE_CONTEXT.md`, `CAROUSEL_CONTEXT.md`, `docs/ai-context/clear.md` — product rule and UGC-UI-115 evidence.
- This receipt.

Preserved all unrelated existing worktree changes. Worker/composer/context files already contained other intentional changes; rollback only this task's scoped hunks, not whole files.

## Preflight and protected contracts

Applied repository AGENTS instructions, relevant Explore/Carousel context and incident history, protected nonnegotiables, and ugc-context-memory, ugc-immutable-contracts, ugc-ui-clarity, ugc-regression-gate and ugc-video-prompt guidance. These skills were actually read in the session. This receipt does not claim a fresh complete reread of all extensive historical context. Installed Next layouts/pages guidance was read earlier in this session. Python repository preflight passed. Source callers, selection roles, quote logic, pending/recovery storage, API and worker were traced before changing the handoff. No motion/timestamp prompt is rewritten in this patch; no reference video was supplied for frame analysis.

| Protected behavior | Status |
| --- | --- |
| Source selection/order independent from face marks | VERIFIED locally |
| Same-person primary/support roles reach API/worker identity stage | VERIFIED with local fixtures |
| One swap per marked source/version1, unchanged credit calculation | VERIFIED locally |
| Legacy one-photo payload/order and stored job reading | Payload/order tested; recovery parser inspected, full browser recovery NOT TESTED |
| Done does not generate, cancellation keeps confirmed choices | VERIFIED locally |
| Keyboard focus returns, disabled/ineligible choices, dialog bounds | VERIFIED at1440/390/320px |
| Underlying dark palette and other workflow default CTA | Scoped diff inspected; broad workflow checks below |
| Scheduling/provider-authenticated output quality | NOT TESTED; scheduling implementation unchanged |
| Real paid face-swap output or hosted acceptance | NOT VERIFIED; no paid calls/deploy |

## Commands, results and artifacts

- `npm run worker:build` — passed.
- `npx tsc --noEmit --incremental false` — passed during implementation; repeated final check recorded in task tools.
- Scoped `npx eslint` for touched application/test files — zero errors, two existing unused-variable warnings in `ugc-chat-workspace.tsx`.
- `node --import ./scripts/next-server-only-test-loader.mjs --experimental-test-module-mocks --experimental-transform-types --test lib/ai-studio/face-swap-api.test.mjs scripts/slideshow-face-swap-ui.test.mjs scripts/source-utf8.test.mjs worker/src/jobs/generate-image.test.mjs worker/src/jobs/generate-image.hook-keyframe.test.mjs` — **61 passed**.
- `node --test worker/dist/lib/openrouter-gemini-image.test.js` — **17 passed**, including supporting photos, historical single-photo and harmonizer failure propagation. Initial direct source invocation failed `.js` resolution; compiled worker invocation passes.
- Latest isolated API/helper repeat — **10 passed** (overlaps61above), with influencer collection represented.
- `node scripts/slideshow-face-swap.browser.mjs` — **passed1440/390/320px**. Actual dialog, photo chooser, composer, Button and Base UI primitives; fixture library/upload adapters. Covers primary/support selection, four-photo cap, numbered eligible slides, Done/Cancel/Escape, no generation on Done, focus restoration, batch upload, upload failure retaining choices, disabled actions, exact blue computed color and viewport bounds. Edge required execution outside the Windows sandbox; no paid API requests.
- Actual local app `/explore/slideshows?preview=1`: dialog opened/closed; actual face/attachment buttons both28x28 with bottom positions within0.4px; computed Generate background `rgb(0,120,212)`. It remains disabled in development preview. This is not an authenticated session test.
- Broader `scripts/explore-format-generation-ui.test.mjs` — **83/91 passed,8failed**. Running the same current test fixture with the prior HEAD `ugc-chat-workspace.tsx` reproduces the same8failures. These cover existing model/duration and clarification fixtures. Assertions were not weakened; full release gate is not green.
- Scoped `git diff --check` — passed during implementation; line-ending advisories only.

Logs under `.tmp/slideshow-face-ux/`: `final-tests.log`, `provider-tests.log`, `api-final.log`, `ui-api-tests.log`, `baseline-ui-tests.log`, `browser-final.log`, `lint.log`, `worker-build.log`.

Visual evidence: user-provided before screenshots; `.tmp/slideshow-face-ux/browser/dialog-{1440,390,320}.png`, `confirmed-{1440,390,320}.png`, `local-app-face-dialog.png`, `local-app-confirmed.png`. The mobile dialog/confirmed views were manually inspected. Library and upload browser adapters are fixtures, not real upload acceptance; the separate known live upload CORS blocker remains outside this task and is not claimed resolved.

Incident UGC-UI-115 has local verification evidence. No staging, commit, push, deployment, live storage configuration write or paid generation occurred.
