# Starting-frame person-photo handoff — 4 November 2026

Status: selection/upload/recovery repaired locally; complete provider execution remains NOT VERIFIED / unsupported by the currently documented ReAPI frame routes. No build, deployment, Google switch, paid generation or provider configuration change.

## User requirement

The generated influencer image remains the actual starting frame. Raw influencer photos used to prepare it must be auto-selected as separate identity context, remain editable through the existing Change dialog, and accompany the video request where supported. They must not replace the scene frame, become last frames, disappear on a model change, or change the provider. User explicitly requires ReAPI and has not approved general-reference mode in place of a locked first frame. This applies to Hook Video, Talking Head and Text on screen.

## Confirmed regression and history

The supplied screenshots show an approved starting image, Change opening Choose person photos, unchecked library images, and `0 of 0 images selected`. Source review identifies a shared zero-capacity policy:

- `worker/src/lib/hook-starting-frame-video.ts:23` returns0for all models.
- `components/explore/use-starting-frame-photos.ts` previously required nonzero provider capacity to restore any `identityAssetIds` or save changes.
- `components/explore/starting-frame-animation-references.tsx` consequently passed maxImages0and disabled photo selection/upload.
- Hook and Text on screen's shared `components/video/video-generation-workspace.tsx` emptied `referenceImages` when the current starting-frame model had no extra-photo capacity.
- Talking Head's `components/explore/hook-workflow-preview.tsx` separately emptied `activeFacePhotos` using the same condition.

The photo identities themselves were retained: `components/explore/hook-starting-frame-workspace.tsx:494` hands over approved `imageAssetIds` as `identityAssetIds`; `lib/explore/hook-starting-frame-history.ts:27` recovers them from the owned image receipt. The missing selection was not evidence that the uploads were deleted.

Git commit `ef3ee9fe20d109e219ab1d68061c66ad3da3bc2c` (2 November2026) switched new Omni starting-frame jobs from Gemini to ReAPI and changed Omni's five-photo allowance to zero for all models. The then-current tests explicitly asserted that Omni no longer restores photos and sends the frame alone. Thus those green tests protected the removed behavior rather than the user's carryover requirement. The earlier October28Talking Head handoff incident UGC-VID-025 records the same expected photo reuse on supported routes.

## Implemented locally

Selection capacity is now separate from provider submission capacity. The existing selection store still allows at most5photos; no new payload, storage version or database schema was introduced.

1. All three workflows restore ordered, owned, ready image assets from the approved frame's identity IDs, unless the user has explicitly saved another selection or an empty list.
2. Change keeps the same dialog, image/frame roles and layout. Upload photos, Uploaded photos, and My Influencers selection use the existing callbacks with a real5photo selection limit.
3. Switching models no longer removes selection or prevents its recovery. Missing/failed assets remain a visible recovery error. Late restoration cannot overwrite a deliberate edit.
4. Hook/Wall and Talking Head pass the selected photo list to their existing request/validation logic instead of replacing it with an empty array.
5. Unsupported literal-frame routes block before submission with a clear message explaining the incompatibility and confirming selections are retained. Removing photos remains explicit. The ReAPI-only provider policy is unchanged.

This is a partial fix. It does not make an unsupported provider request valid. No claim is made that raw photos have reached a live ReAPI generation.

## Provider evidence and remaining limitation

The server (`lib/ai-studio/video-generation-api.ts:216`), worker (`worker/src/jobs/generate-hook-video.ts:676`) and ReAPI request builders also validate extra-image compatibility. They remain intact. Bypassing only the picker would otherwise yield rejected jobs or dropped inputs.

Official ReAPI documentation checked on4November2026:

- [Omni1.1](https://reapi.ai/docs/gemini-omni-1-1): frame mode requires exactly1image. Reference fusion accepts3total images and does not pin frame1. Two images or4+are rejected. Therefore a starting image plus arbitrary raw photos cannot be promised in literal-frame mode.
- [WAN3.0](https://reapi.ai/docs/wan-3-0): strict first/last frames and general reference media belong to separate families and cannot mix.
- [Seedance2.5](https://origin-slave1.reapi.ai/docs/seedance-2-5): `image_urls` and `image_with_roles` are mutually exclusive; frame roles and reference_image cannot share one array. Timed-reference inputs convert frames to general references. Consequently the broad claim “it supports both fields” would not establish the requested locked-frame-plus-identity combination.

Existing Talking Head `image_voice_reference` is a separate approved general-image-plus-voice exception. It is not a solution to the present locked-first-frame requirement and is not enabled/changed here. Historical Google jobs retain their recovery semantics; no new Google route is introduced.

A complete resolution needs a verified ReAPI endpoint/mode that documents this exact combination, or a separately approved change to the model/input contract. Do not silently switch provider/model, loosen the first-frame role, pad/duplicate/drop photos to satisfy cardinality, or pass unrecognized context fields and claim the model used them. No additional confirmation is inferred from the user's insistence on the existing behavior.

## Verification

- 23testsPASS: photo restoration across all3models, explicit-empty choices, model changes, disabled previews, failed owned assets, late async reads, separate frame/ordered-photo inputs, picker selection and history ownership/recovery.
- 79testsPASS: existing image upload/selection interactions, saved frame reads and video API admission/ownership/negative cases. Provider rejections remain tested; passing them is not proof of supported combined generation.
- 22ReAPI source-adapter testsPASS via `scripts/worker-source-test-loader.mjs`; no worker build. Includes locked-frame role, invalid combinations, frozen-task recovery and no paid retry behavior.
- TypeScript `npx tsc --noEmit --incremental false` PASS.
- ESLint:7changed filesPASS. `hook-workflow-preview.tsx` retains its existing `react-hooks/refs` error at line84; linting that file's HEAD text independently reproduced the identical error. No adjacent scheduling ref change was made to hide it.
- Scoped `git diff --check`PASS.
- Screenshots supplied by the user inspected as defect evidence. Fresh desktop/mobile visual comparisons NOT TESTED: existing browser fixtures bundle through webpack, and no builds are authorized. Component harnesses are not a production UI acceptance test.
- No live video submission, generated identity quality, signed-in production selection/reload, or deployed fix verified. No schedule/publication checks were run because those paths were unchanged.

Initial history-test invocation omitted the experimental module-mocks flag and failed; rerun with the repository loader and required flags passed. Test totals above are disjoint23+79+22=124.

## Changed files and rollback

- `lib/explore/starting-frame-photo-selection.ts`: explicit selection limit.
- `components/explore/use-starting-frame-photos.ts`: restore/save independently of provider capability.
- `components/explore/starting-frame-animation-references.tsx`: allow existing chooser/upload paths.
- `components/video/video-generation-workspace.tsx`: retain Hook/Wall photo arrays and picker capacity.
- `components/explore/hook-workflow-preview.tsx`: retain Talking Head photo array.
- `lib/explore/starting-frame-animation-input.ts`: clear unsupported-route message.
- `scripts/starting-frame-photo-carryover.test.mjs` and `scripts/starting-frame-animation-references.test.mjs`: replace removal assertions with carryover/removal/stale-read coverage.
- This report plus appended contract/context/incident records.

Rollback only these scoped hunks; preserve concurrent reference imports, workflow preload changes, Hook prompt work, user edits and all historical jobs. No API, provider adapter, worker, dependency, migration or scheduling runtime changed.

Preflight: AGENTS engineering rules, nonnegotiables, relevant Explore/Wall context and UGC-VID-025 ledger history, current callers/state/persistence/API/worker/provider, git diff/history and tools/preflight.py inspected. Skills read: ugc-context-memory, ugc-immutable-contracts, ugc-ui-clarity, ugc-starting-frame, ugc-regression-gate. Installed Next route-handler guide inspected. Large context/ledger reads were targeted/truncated, not a complete new historical read. Incident UGC-VID-20261104-RAW-PHOTO-CARRYOVER remainsOPEN for complete provider/production acceptance.

## Follow-up: Change editing and labels checked again

The user asked to verify that auto-selected photos can still be removed or added through Change, and that selection labeling is correct. Fresh inspection and actual component-handler tests confirm:

- All five preparation-photo IDs restore in order; the approved generated image is separate and does not count as a person photo. The preparation step itself allows at most five raw identity photos (four on Flash models), so the selection capacity covers its inputs.
- Uploaded photos and My Influencers indicate each selected asset through its ID and pressed/checkmark state. Existing selected photos remain removable at the cap. Once one is removed, adding another is enabled. The footer updates to the actual number of person photos, such as `5 of 5 images selected`; it does not count the generated starting frame.
- Uploading two additional files appends them in input order to the current person-photo list and never calls the scene-clear callback. The existing uploader and owner boundaries remain unchanged.
- Clear selection removes the person photos only. Closing/reopening keeps the selection. A fresh hook instance using the saved store restores edited IDs, and an explicitly saved empty selection stays empty rather than reinserting the original preparation photos.
- Both shared Hook/Wall callbacks and the separate Talking Head callback remember the edited IDs and update their current photo state. No second chooser or permanent UI was introduced.

Two label defects were corrected in `components/explore/format-generation-references.tsx`:

1. The visible Change button remains unchanged. When the combined chooser offers frame replacement/preparation, its accessible label now says `Change starting frame or person photos`; the tooltip names both. A photo-only caller says `Change person photos` and does not promise an unavailable frame selector. The person-photo description explains that adding/removing face references keeps the starting frame selected. Ordinary image pickers and scene-only selectors retain their previous copy.
2. The Starting frames shelf now checks the actual displayed approved-frame ID, including compact preview callers. Previously it checked only the scene-only `startingFrame` prop, so the active frame could appear unchecked. Person-photo checkmarks and the starting-frame checkmark remain independent. Switching to Starting frames uses the title `Choose starting frame`; returning to Uploaded photos uses `Choose person photos`.

Verification: 65 focused non-build tests pass across photo carryover, animation references, uploaded-photo interactions, history client and owned-frame history. New cases explicitly exercise full-cap removal/addition, labels and counts, upload appending without clearing the scene, separate frame/person checks, photo-only label accuracy, all-five restoration, and a genuinely fresh hook instance recovering saved edits/empty choices. An initial new upload assertion required conversion from the VM's array realm; it was corrected without changing application behavior.

Final follow-up checks: scoped ESLint PASS for the changed component and three test/fixture scripts; `npx tsc --noEmit --incremental false` PASS; scoped `git diff --check` PASS. The earlier unrelated Talking Head lint error remains outside this follow-up's modified application file. Incident UGC-UI-20261104-STARTING-FRAME-PHOTO-LABELS is locally verified by code/interaction tests, with visual/hosted acceptance still open.

Changed in this follow-up: `components/explore/format-generation-references.tsx`, `scripts/explore-format-reference-upload.test.mjs`, `scripts/starting-frame-photo-carryover.test.mjs`, `scripts/starting-frame-compact.browser.cjs` (locator only), this report, and appended entries in `EXPLORE_CONTEXT.md` / `docs/ai-context/clear.md`. Existing changes from the earlier repair were preserved. Scoped lint/types/diff results are recorded in `.tmp/starting-frame-photo-label-{lint,types,tests}.log`. The browser fixture was not run because it creates a webpack bundle, prohibited under the current no-build rule. No provider/model/API/job/prompt/layout change, build or deployment. Fresh visual comparison and authenticated production behavior remain NOT VERIFIED. The ReAPI first-frame-plus-person-context limitation above remains unresolved; these interaction tests do not prove provider use or output face consistency.

## Expanded verification requested again — final results

Status: selection/UI logic VERIFIED locally; complete combined provider generation and deployed visual acceptance remain NOT VERIFIED. No further application-code changes were necessary in this pass.

408 non-build tests PASS, zero failures/skips, in disjoint final groups:

- 111: photo carryover/labels, uploads, frame history/client and video API admission (`.tmp/starting-frame-final-reverification-tests.log`).
- 275: actual Hook/Wall video composers, Talking Head parent/composer photo handoff, job and draft recovery, manual client submission, reference inputs, source-video selection, neighboring Demo/audio behavior and composer controls (`.tmp/starting-frame-final-reverification-integration-final.log`).
- 22: actual ReAPI source-adapter contracts, rejection/recovery/no-retry cases (`.tmp/starting-frame-final-reverification-provider.log`).

Additional regression checks now exercise Hook's real session-storage branch separately from shared Wall/Talking Head storage: edited Hook choices survive same-tab reload without changing shared choices; an explicitly empty tab selection cannot inherit shared photos; changing frames ignores late previous-frame media reads. These test the actual restoration hook with isolated owned-media/auth boundaries. The expanded parent test explicitly checks that selected photos stay visible and submission is blocked on an unsupported route, and that frame-only submission becomes valid only after deliberate removal.

The first broad run exposed test-fixture gaps that earlier focused passes had not covered. Three VM fixtures did not load the newly imported photo-selection constant; those fixtures now load its actual module. Existing billing stubs in those tests lacked a currently used rate helper; the isolated4credit fixtures now expose that helper without modifying application pricing. The connected generation fixture now imports the actual pure credit policy; obsolete negative cases check invalid/insufficient balances instead of an unused legacy response-rate field. Its voice sample now meets the existing5second Seedance minimum. The source-video fixture now includes the actual pure schedule-draft updater. Two old assertions expecting photo loss were replaced with retention-and-blocking assertions. No application billing, voice policy, scheduling conversion, provider route, model or prompt was changed to make tests pass.

Changed in this verification pass only:

- `scripts/starting-frame-photo-carryover.test.mjs`
- `scripts/explore-format-generation-ui.test.mjs`
- `scripts/explore-workflow-job-recovery.test.mjs`
- `scripts/workflow-reference-inputs-ui.test.mjs`
- `scripts/workflow-demo-audio-state.test.mjs`
- `scripts/workflow-generation-client.test.mjs`
- `scripts/workflow-source-video-ui.test.mjs`
- This report and appended context/incident verification records.

Fresh `npx tsc --noEmit --incremental false` PASS. Scoped ESLint PASS for all10checked changed component/test files and all7expanded fixture files. Scoped diff check PASS. The previously established Talking Head `react-hooks/refs` error at line84 remains unchanged and outside these successful lint invocations; do not describe repository-wide lint as green. There were no builds, browser-bundle executions, pushes, deployments, paid provider calls or production mutations. Browser layout, production selections and generated face fidelity remain unverified. Earlier partial records are retained for audit history; the final green counts above follow the fixture corrections.
