# Idle slideshow opens the existing editor

IMPLEMENTED locally. No build, deployment, paid generation or production mutation. Integrated browser/hosted acceptance remains OPEN.

## Behavior

When an empty slideshow generation view has finished loading/recovering, show the existing Your slideshow assembly/editor instead of the generic Your images will appear here placeholder. Existing drafts and uploaded slides remain in the same mounted FormatSlideshowEditor. Create's instructions remain accessible; the fallback does not change the selected workflow step, source, draft or save state. Empty editors expose the existing Add slides action and minimum-slide guards.

The fallback does not run during submission, active jobs, unresolved submissions, job recovery, history/image loading, output resolution, inactive workflows, or when real visible images exist. Hook/Text on screen are excluded. Completed generation still follows existing assembly and onGeneratedSlideshow behavior. Manual Generated slides/History remains reachable; unchanged lifecycle dependencies do not repeatedly override that navigation. Late-restored clarification is included in dependencies so its old presentation cannot re-open a settled empty screen indefinitely. No automatic generation, save or paid retry occurs.

## Cause, scope and files

UGC-UI-20261105-SLIDESHOW-IDLE-EDITOR records the screenshots eca1ec6b/8945b396. Source confirms saved work/clarification triggers onGenerationRestore and showGenerationResults, even without image results. This establishes a route to the reported empty screen; the exact hosted session was not correlated with a request ID.

Task-owned changes:

- `components/explore/recreate-generation-view.ts`: optional onIdleEmpty presentation callback.
- `components/explore/format-workspace.tsx`: stable slideshow-only callback returns showGenerationResults to false; other view/job handlers unchanged. Preserve all pre-existing dirty changes.
- `components/workspace/ugc-chat-workspace.tsx`: call the callback only when actual result/lifecycle state is settled and empty. Include late-restored clarification and output resolution state.
- `scripts/slideshow-idle-editor.test.mjs`: execute actual source effect with idle/loading/recovery/pending/results/inactive/other-workflow states and verify asynchronous clarification dependencies versus unchanged manual navigation.
- `scripts/explore-format-source-workspace.test.mjs`: exercise actual parent render/callback, mounted editor visibility, synchronous generation presentation and retained Generated slides navigation without token/network actions.
- `EXPLORE_CONTEXT.md`, `docs/ai-context/clear.md`, this report and global `C:/Users/chund/.codex/mistakes.md`: append scope/evidence/prevention.

Rollback boundary: this optional callback wiring/effect and tests only. No API/schema/model prompt/job execution/storage/scheduling changes. Do not revert unrelated worktree edits.

## Preflight and wiring

Read latest user AGENTS/global no-build and functional acceptance rules, global mistake memory, verify-feature-wiring skill, project immutable/UI/regression/context-memory procedures and protected source/identity/draft rules from the continuing slideshow task. Reviewed relevant Explore/clear history (UI006/037/077 and latest slideshow full-wiring incidents) and current source/callers. Large historical context output was truncated; targeted sections read. Existing Next client documentation read in the preceding task remains applicable. `tools/preflight.py` prerequisites passed for this actual request.

Local presentation path: child history/job recovery→visibleImages and lifecycle flags→onIdleEmpty→parent showGenerationResults=false→existing slideshowOverviewVisible→mounted editor preview portal. Source-selected inputs, pending generation snapshots, job mapping, authoritative API/worker consumption and existing output assembly are not modified. This change displays existing output; it does not make a new backend execution promise.

| Check | Result |
| --- | --- |
| Empty idle editor fallback; late clarification; no repeated override of manual navigation | VERIFIED with actual source effect/parent handlers, isolated React/network boundaries. |
| Loading, recovering, pending/active/submitting/output-resolution states preserved | VERIFIED locally; no actual hosted jobs were started. |
| Exact uploaded slide order/progress, square side strip controls, vertical and legacy horizontal drag, save/reload/recovery guards | VERIFIED by combined preceding/new source-handler suites. |
| Generation client, job recovery, first-slide-only face targets, face API ownership and worker consumption regressions | VERIFIED with synthetic/isolated infrastructure tests. No real model output claim. |
| Current integrated browser UI, actual authenticated storage/save/result shown on production | NOT TESTED. No new fixture bundle/application build authorized. Prior four CSS-only layout checks validate styling alone. |
| Deployed behavior and generated face/slide quality | NOT VERIFIED. No deployment/paid calls. |

## Checks and artifacts

- Combined editor/source/upload/drag/idle regression suite: **175 PASS**,0fail/skip, `.tmp/slideshow-idle-editor-20261105/final-tests.log`; includes all previous side-strip/upload tests and new idle rules. Combined with the disjoint broader suite below: **376 PASS**.
- Broader generation/recovery/face regression: **201 PASS**,0fail/skip, `.tmp/slideshow-idle-editor-20261105/recovery-face-tests.log`. Files: explore-format-generation-ui, explore-workflow-job-recovery, slideshow-face-flow, slideshow-face-swap-ui, face-swap-api, generate-image and generate-image.hook-keyframe tests. Uses repository loader/module mocks/type transformation; no emitted bundle or external provider.
- `npx tsc --noEmit --incremental false`: PASS.
- Scoped ESLint: zero errors; two existing unused-code warnings in ugc-chat-workspace. Initial new stable-callback dependency omission was caught by lint and corrected by including the setter.
- Scoped diff whitespace check: PASS.
- Before source snapshots and logs: `.tmp/slideshow-idle-editor-20261105/`. No new browser screenshots, generated output or production receipts created.

Remaining check: an authorized current-component browser session for the combined idle/generating/recovered/editor view transitions, upload progress and square rail pointer/touch interactions; then authenticated upload→ready asset→Library save/readback if full live upload acceptance is requested. Neither requires paid generation. The existing detailed side-strip receipt remains `docs/slideshow-side-upload-2026-11-05.md`.

Final follow-up found the idle fallback could hide a failure and its retry controls. The existing results error now blocks the fallback. 92 focused tests passed, including the new failure case. Integrated browser acceptance remains open.

## Tab return and picker performance follow-up
Ordinary References, Your Slides and Create/Edit navigation now preserve the slideshow results flag. The existing lifecycle callback clears it when results settle empty and error-free. Explicit reference selection keeps its own reset behavior. The picker builds one ID index and renders each set by direct lookup, preserving group order, labels and selected asset IDs. Media fetching and save contracts are outside this patch.
Changed format-workspace.tsx, slideshow-add-slides.tsx, explore-format-source-workspace.test.mjs and slideshow-click-actions.test.mjs. Earlier tests that expected progress to disappear on a tab click were updated to assert retention and then invoke the idle callback explicitly. 154 source/handler tests passed. Isolated picker matching including index setup took 0.029 / 0.202 / 2.351 ms for 100 / 1000 / 10000 synthetic images. Previous measured scan was 0.141 / 14.938 / 1982.721 ms. These timings exclude fetch, grouping upstream and DOM rendering. Current browser and authenticated behavior remain open. No build, deployment or paid generation.
