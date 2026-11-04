# Slideshow face swap: explicit photo and slide steps

Local implementation, **PARTIALLY VERIFIED**. No build, bundling, dev server, push, deployment or paid generation was run. Incident: UGC-UI-20261104-SLIDESHOW-FACE-STEPS (recurrence of UGC-UI-082/099/115).

## Reported issue and verified cause

The user screenshots show a primary photo outlined as selected and a disabled Done button. Source confirms Done required both a photo and an eligible slide, while the slide-selection section followed the entire portrait gallery inside one scrolling area. A large gallery could hide the required next choice. The selection outline alone was not evidence that the photo click failed.

Separately, source confirms that multi-file uploads accumulated successful files but applied the selection only after the whole loop succeeded. If a later file failed, earlier successful uploads were not selected. Selected photos were also hidden whenever either library query reported loading. The original screenshot's exact upload request/network outcome remains UNKNOWN; these code findings do not establish its network cause. Historical CORS findings are superseded by the later approved/read-back policy repair and are not reused as this incident's diagnosis.

## Resulting user flow

1. Select source slides in Create to decide which slides to regenerate. For a six-slide recreation, select all six there.
2. Open the existing Face swap icon. Step 1 shows face photos only. Choose/upload up to four photos of the same person; first is primary.
3. **Next: choose slides** becomes available after a face is selected and source slides are eligible. It opens Step 2 directly, rather than requiring the user to scroll past the photo library.
4. Select **Slide 1** only for a first-slide-only swap. Unmarked eligible slides retain normal generation. Ineligible slides are dimmed and labeled Not generating. Select all/Clear slides remain explicit actions.
5. The footer states the exact selected slide numbers. **Done** requires at least one face and one eligible slide, commits choices, then closes. It does not submit a paid generation.
6. Click the existing Generate action. The existing frozen selection maps the requested face swap to marked generated slides. The established policy remains one swap per distinct marked source on version 1.

Back retains draft photos/slide marks. Cancel, Escape and outside dismissal retain the previous confirmed choices. Reopening starts from those confirmed choices. Remove face swap explicitly clears a previously confirmed configuration; it replaces the former implicit ability to clear both selections and press Done. Unsubmitted choices remain session-only, as before; this task does not introduce reload persistence for unsubmitted settings.

The existing modal uses a stable bounded height, scrolling only its current step with footer controls outside that scroll region. Step changes replace the scroll region so the slide choice starts at the top. Current palette/button treatment and the existing four-photo limit are retained.

Successful uploads remain selected in primary/support order even if another file fails. Errors identify partial success. A synchronous lock prevents duplicate upload starts before a rerender. Unmount prevents late upload completion from changing an abandoned dialog. Already selected portraits remain visible while library reads load or fail.

## Edit boundary and files

Application:

- `components/explore/slideshow-face-swap-control.tsx`: two explicit steps, next/back actions, exact selected-slide summary, guarded confirmation, explicit removal and bounded step scrolling.
- `components/explore/slideshow-face-choice.tsx`: partial upload retention, duplicate-start protection, unmount guard and selected-photo visibility during loading.

Verification:

- `scripts/slideshow-face-flow.test.mjs`: new non-build source-handler regression suite for six slides/first-only, selection/upload/primary roles, Cancel/Back/dismiss/reopen/removal, eligibility, partial failure, duplicate upload and unmount. Source is evaluated in memory with isolated library/upload adapters; no app bundle is created.
- `scripts/slideshow-face-swap.browser.mjs`: update existing fixture expectations for two steps, a 30-photo gallery and six numbered slides. **Not executed**: this fixture invokes webpack and Tailwind compilation, requiring explicit build authorization under the user's rule.

Memory/docs:

- `docs/ai-context/clear.md`: append OPEN incident before implementation and verification update afterward.
- `EXPLORE_CONTEXT.md`: append current slideshow interaction rule and limits.
- This report.

No API, worker, model prompt, credits, queue, source selection, editor or scheduling implementation was changed. Rollback is limited to these two application files and associated test/docs changes. Unrelated dirty worktree changes were preserved.

## Preflight receipt

Read root AGENTS.md engineering rules and the explicit user-supplied no-build replacement; `docs/ai-context/nonnegotiables.md`; applicable Explore/Carousel context and historical face/upload/recovery entries in `docs/ai-context/clear.md`; prior `docs/slideshow-face-swap-clarity-2026-11-02.md`; installed Next `use-client.md`; and ugc-context-memory, ugc-immutable-contracts, ugc-ui-clarity, ugc-video-prompt, ugc-starting-frame and ugc-regression-gate skills. Large context output was truncated; targeted follow-up reads covered the relevant current face-swap, partial upload, CORS and recovery contracts. No source video or generated output was claimed inspected; no prompt-writing or source-frame change was needed.

`python tools/preflight.py --repo . --task "Repair slideshow face swap step-by-step photo and per-slide selection, disabled Done clarity and uploaded photo selection without builds"` passed prerequisites. Inspected status, caller graph, leaf controls, generation selection/pending request snapshot, owner-scoped face-job mapping, uploader, face-swap API and worker contracts before editing.

## Pipeline audit and protection evidence

| Boundary | Evidence/status |
| --- | --- |
| Source selection → eligible face targets | `format-workspace.tsx` derives face targets from generation-selected source IDs. VERIFIED by source inspection and eligibility handler tests; unchanged. |
| Photo + slide choices → confirmed configuration | Only Done or explicit Remove applies changes. VERIFIED by actual handler tests with primitive/library boundaries isolated. No generation invoked by those handlers. |
| Configuration → generation request | `ugc-chat-workspace.tsx` freezes selected primary/support IDs, slide IDs and source order in pending request input. Source inspection; unchanged. |
| Generated jobs → swap targets | `planSlideshowFaceSwaps` maps version-1 job slots through frozen source order. Six-source/two-version fixture with only Slide 1 selected returns exactly one swap. VERIFIED locally. |
| Swap request → ownership/billing | Existing `face-swap-api.ts` validates distinct owned ready assets and trusted URLs before reserving credits; identity/support order retained. VERIFIED with API fixture tests. |
| Durable job → identity/harmonizer | Existing generate-image worker forwards target, primary and supporting photos and fails on excess/processing errors. VERIFIED with worker fixture tests; no provider call. |
| Cancel/upload failure/reopen | Existing confirmed selection retained; partial successful uploads selected; late unmount completion ignored. VERIFIED with handler tests. |
| Other workflows, timestamps, prompts, scheduling | No changes in their runtime files for this task. Scoped diff inspected; no full cross-feature browser acceptance claimed. |
| Desktop/mobile visual layout, focus/trap, actual uploaded media and real provider output | NOT TESTED for this revision. Browser fixture builds and is deferred under the no-build rule. User screenshots are before evidence, not approved after baselines. |
| Production activation | NOT VERIFIED; no deployment or hosted write. |

## Commands and outcomes

- `node --import ./scripts/next-server-only-test-loader.mjs --experimental-test-module-mocks --experimental-transform-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/slideshow-face-flow.test.mjs scripts/slideshow-face-swap-ui.test.mjs lib/ai-studio/face-swap-api.test.mjs worker/src/jobs/generate-image.test.mjs worker/src/jobs/generate-image.hook-keyframe.test.mjs`: **67 passed**, no failures/skips.
- Same loader/options with `--test scripts/reference-upload-latency.test.mjs`: **4 passed**. Existing uploader validates upload/ready boundaries and lost-acknowledgement recovery with fixtures.
- `npx tsc --noEmit --incremental false`: PASS.
- Scoped ESLint for both changed components, new handler test and updated browser script: PASS.
- Scoped `git diff --check`: PASS; CRLF advisory only.

Initial new upload-error tests needed the host Error constructor supplied to their VM so simulated errors matched the component's Error realm. Final suite passes with the actual component error handling unchanged.

Logs and before source snapshots: `.tmp/slideshow-face-flow-20261104/{tests.log,upload-tests.log,types.log,lint.log,control-before.tsx,choice-before.tsx}`. No new browser screenshots were produced. This is a local UI/selection repair with non-build verification, not proof of perfect generated face identity or a fully accepted hosted flow.

## Local browser follow-up
User requested showing locally after being asked to authorize only the fixture build. That narrow fixture was built and tested:1440/390/320allPASS. Replaced obsolete sample-image path with an existing local talking-frame PNG and made allsix sample slides eligible. Actual desktopstep2 screenshot reviewed; photos are repeatedfixtureimages, not realaccountintegration. Artifacts .tmp/slideshow-face-ux/browser/photos-1440.png and dialog-1440.png; log .tmp/slideshow-face-flow-20261104/browser-visible.log. Interactive prebuiltfixture served at http://127.0.0.1:4317 with automaticFaceSwapopening. No production/developmentapplicationbuild/deployment/paidgeneration. Earlier deferredbrowserstatus is historical; hosted/provideracceptance remainsNOTVERIFIED.

## Independent no-paid-generation recheck
71current source component/API/worker/upload testsPASS; fresh noEmitTypeScript,scopedlint,diffPASS. Reused existing compiled localfixture without rebuilding. Browser1440/390/320PASS primaryNextDone,onlySlide1,BackCancelEscapeRemove,partialuploadretention,dialogbounds/overflow and0generation. All externalorigins and allnonGETrequests intercepted/blocked;0attempts. Logs recheck-tests.log,recheck-types.log,recheck-lint.log,recheck-browser-complete.log in .tmp/slideshow-face-flow-20261104; screenshots recheck-{1440,390,320}.png. Found/fixed syntax-error quoteescaping in temporary previewserver auto-open script, then removed duplicateopeningclick from recheck harness to avoid racingautomaticopening. Applicationruntimeunchanged; localpreview nowautoopens. No builds/deployments/liveuploads/paidcalls. Hosted integration/actual identity output remainNOTVERIFIED.
