# Slideshow side strip and upload clarity

IMPLEMENTED locally; partial local verification, hosted acceptance OPEN. Incident UGC-UI-20261105-SLIDESHOW-SIDE-UPLOAD. No build, deployment, paid generation or real upload was run.

The existing sequence now sits to the right of the preview instead of below it. Thumbnails are square:72×72 desktop,64×64 in compact containers. Full slide images use contain fitting without cropping. The main preview retains original proportions. The rail has bounded vertical scrolling (desktop144–280px; compact136–224px) and up/down controls for more than three slides. Selection, thumbnail deletion, drag handles and collapsed Earlier/Later remain.

The latest user correction (screenshot1e61160c) requested less height and square thumbnails after seeing the first CSS fixture. The initial taller rail is superseded by the dimensions above; no generated slide media was resized by this styling.

Add slides now calls its upload source **Upload slides**, including the hidden file input accessible name. The existing file chooser still opens directly. After files are selected, the sequence's Add slides button shows a spinner/Uploading and is locked. A nearby polite status reports Uploading slides… X of Y processed. The count follows actual preparation/upload task settlement, not a timer or fabricated percentage; a failed file counts as processed and existing partial-error reporting determines success. All-success/partial/failure exits release busy state. File-picker cancellation never starts a busy operation.

## Scope and files

- `components/explore/format-slideshow-editor.tsx`: renamed file-input label, real per-file progress, adjacent busy button/status and rail scroll buttons. Existing upload order/validation/save receipt logic retained.
- `components/explore/slideshow-add-slides.tsx`: rename upload action only.
- `components/explore/slideshow-editor.module.css`: right-side grid, compact square thumbnails, bounded vertical scrolling and insertion markers.
- `components/explore/use-slideshow-slide-drag.ts`: use actual computed rail orientation for pointer targeting/edge scrolling; add Up/Down alongside existing Left/Right/Home/End.
- `scripts/explore-slideshow-editor.test.mjs`: renamed selector, progress/scroll/selection/exact-save-ID test; numeric child text helper fixed to inspect rendered counts faithfully.
- `scripts/slideshow-click-actions.test.mjs`: renamed upload action assertion; immediate picker callback retained.
- `scripts/slideshow-vertical-drag.test.mjs`: source-hook pointer/axis/cancel/edge-scroll/keyboard/disabled tests.
- `scripts/slideshow-add-slides.browser.cjs`: updated upload labels and vertical drag/scroll/touch coordinates. Not executed: invokes webpack and no build is authorized for this task.
- `EXPLORE_CONTEXT.md`, `CAROUSEL_CONTEXT.md`, `docs/ai-context/clear.md`, this report; global reusable lesson appended to `C:/Users/chund/.codex/mistakes.md`.

Rollback boundary: task-owned rendering/CSS/axis-handling/test changes only. Preserve the worktree's unrelated changes. No new dependencies or changes to model prompts, face-swap pipeline, scheduling, API schema or database.

## Preflight and protected contracts

Read new user AGENTS instructions, global mistakes ledger and verify-feature-wiring skill; project nonnegotiables and relevant Explore/Carousel/clear history (UGC-UI-006 recovery, UGC-UI-077 toolbar and recent full-wiring incidents); context-memory, immutable-contracts, UI-clarity and regression-gate skills; installed Next use-client documentation. Large context output was truncated; relevant follow-up sections were read. `tools/preflight.py` passed prerequisite discovery. Inspected current status, targeted source, consumers and tests. All user changes retained.

Confirmed cause: existing CSS placed the horizontal sequence after the main preview, and Add slides had a static label; upload progress was only header feedback after picker close. Moving orientation requires drag-axis handling too. Global lesson records that dependency and visible feedback after picker handoff.

## Wiring evidence

| Boundary | Status and evidence |
| --- | --- |
| Upload slides → native picker | VERIFIED in real source-handler test; callback unchanged, label changed. |
| Files → fit→upload→ready assets→sequence | VERIFIED with isolated media adapters. Existing real uploader still calls authenticated create-upload-url→signed PUT→complete-upload and verifies returned owned ready asset; lost completion acknowledgement uses read recovery. Existing uploader tests pass. |
| Partial result ordering/progress | VERIFIED: finish second upload first; count increments while save stays blocked; final sequence/save uses original file order with exact returned ready IDs. Conversion failure retains good files and reports partial error. |
| Thumbnail selection/reorder/remove→save/reload | VERIFIED in editor and axis-hook tests: text/asset identity, dirty invalidation, exact serialized save order, locks and recovery retained. |
| Save API→Library | Existing slideshow API validates owned sources and uses existing persistence service; unchanged. Handler/API tests exercise actual local source with isolated infrastructure. No hosted mutation. |
| CSS placement and bounded scrolling | VERIFIED in Edge at1366/768/390/320 using actual scoped CSS with static synthetic markup; no bundle/build. Right-side position, no page overflow and actual rail scrollTop checked.390 screenshot inspected. This does not prove full current React+browser integration. |
| Authenticated storage upload, hosted save/readback, full current component pointer/touch integration | NOT TESTED; no production mutation or fixture bundling authorized. Updated full browser script remains pending explicit build permission. |
| Worker/provider | N/A to local thumbnail navigation; native slide upload/save path renders no model image. Existing exact ready asset IDs remain the persisted slide sources. Actual hosted rendering/publication NOT TESTED. |

## Checks

-84tests PASS,0fail/skip: `node --import ./scripts/next-server-only-test-loader.mjs --experimental-test-module-mocks --experimental-transform-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/explore-slideshow-editor.test.mjs scripts/explore-slideshow-actions.test.mjs scripts/explore-slideshow-reference-import.test.mjs scripts/slideshow-vertical-drag.test.mjs scripts/slideshow-click-actions.test.mjs scripts/reference-upload-latency.test.mjs`.
-`npx tsc --noEmit --incremental false`: PASS.
-Scoped ESLint for changed TSX/hooks/scripts: PASS.
-Scoped diff whitespace check: PASS (line-ending advisory only).
-CSS-only static browser check: four widths PASS, including shorter square rail revision. No actual component browser or hosted acceptance claim.

Artifacts: `.tmp/slideshow-side-upload-20261105/` contains before source/CSS snapshots, preflight.log, final-tests.log, types.log, final-lint.log, layout-square.log and layout-{1366,768,390,320}.png. User screenshots cbcb50b6/09c091a5 and correction1e61160c are problem evidence. New screenshots use synthetic markup and are layout-only evidence, not approved golden baselines.

Remaining acceptance: authorized fresh actual-component browser fixture or equivalent current application session for pointer/touch, all control geometry and file handoff, then authenticated upload→ready record→saved Library readback. No paid generation is required for these outstanding checks.
