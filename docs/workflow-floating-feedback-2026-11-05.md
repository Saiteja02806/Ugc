# Workflow feedback placement and dismiss button — 5 November 2026

Status: VERIFIED locally for the scoped presentation behavior. Production acceptance and real provider failure/recovery remain NOT VERIFIED. No deployment or production settings changed.

The previous repair was incomplete: it moved the entire feedback stack from the fixed footer to the top of the left form. The footer shrank, but the prompt and settings were displaced by the same messages. Acceptance tested the footer rather than the user's usable editing space.

The user approved the floating upper-right card in screenshot codex-clipboard-6c39a5a6-ab28-445e-9235-d1cf9514bfb4.png. That layout is now implemented with a body portal across Talking Head, Hook Video, Text on Screen, Slideshow and the retained Phone panel. Detailed feedback occupies no left-form or footer space. A screen-reader-only description retains the Generate button's explanation. Inactive composers do not show notices. Long content scrolls within a bounded card.

The user rejected the agent-added Generation status collapse/reopen pill, then explicitly requested an X mark to dismiss the card. Final behavior: show issues directly; X removes the card completely; no replacement status/details/reopen button. Existing Refresh/check/cancel actions remain in the visible notification. Dismissal is local presentation state and never clears a pending request, changes validation or enables generation. A changed message gets a fresh keyed notice; an inactive→active cycle or reload also restores its current notice.

On mobile, the card is at the lower right and stays within the viewport. Browser hit-testing found it could cover the final settings row. The requested X resolves this obstruction: after dismissal Quality, Videos and Ratio are uncovered while Generate remains disabled. No padding/clearance spacer was implemented. Close stays pinned and clickable even after scrolling a long message to the bottom. The portal uses the existing app-canvas theme class to preserve the app palette.

Files changed for this correction (preserving preceding/concurrent changes):

- components/explore/workflow-feedback.tsx — body portal, accessible description, direct display and keyed local X dismissal.
- components/explore/workflow-feedback.module.css — approved floating placement, bounded scroll, pinned X, mobile layout.
- components/explore/workflow-creation-panel.tsx — replace inline feedback wrapper; retain original handlers/guards/actions.
- components/generation/ai-studio-composer.tsx — same shared notification in workflow layouts only; inactive visibility respected.
- app/e2e/workflow-feedback-preview/page.tsx and preview.tsx — development-only actual workflow chrome with synthetic feedback, local Refresh and scenario controls.
- scripts/workflow-action-feedback-fixture.mjs and workflow-action-feedback.test.mjs — actual component/portal coverage and no editor-flow feedback.
- scripts/workflow-floating-feedback.test.mjs — direct visibility, full text, recovery callback, SSR/inactive/empty states and X dismissal with no replacement pill.
- scripts/workflow-sections.test.mjs, workflow-composition-panel.test.mjs, workflow-source-video-ui.test.mjs and recreate-composer-sizing.test.mjs — only imports/expectations needed for shared feedback wiring; unrelated existing assertions retained.
- docs/ai-context/clear.md, docs/ai-context/nonnegotiables.md and EXPLORE_CONTEXT.md — append-only incident evidence and explicit user revisions.
- docs/compact-workflow-footers-2026-11-05.md — supersession note for the earlier incomplete repair.
- docs/workflow-floating-feedback-2026-11-05.md — this receipt.

Preflight actually read: AGENTS.md engineering rules; protected nonnegotiables in full; relevant complete Explore/clear sections under the user's prior read exception; ugc-context-memory, ugc-immutable-contracts, ugc-ui-clarity, ugc-regression-gate and ugc-scheduling SKILL.md files; installed Next use-client guide; existing source/callers/portal/CSS/tests. tools/preflight.py ran with this task, log .tmp/local-https/compact-feedback-preflight.log. No dependencies, global CSS, schema, auth, provider, prompt, worker or scheduling-execution edits.

| Protected behavior | Evidence / status |
| --- | --- |
| Editor/footer geometry independent of issues | VERIFIED: actual React development previews, 1440×900 and 390×844, all five retained workflows. Prompt, settings and footer rectangles match exactly between ready/error states; no feedback descendants in editor DOM; no horizontal overflow. Ten rows in .tmp/local-https/floating-feedback-geometry.json. |
| Full error and recovery visibility | VERIFIED: complete long message retained; card scrolls rather than expanding the editor. Browser Refresh updates the synthetic fixture only; actual callbacks are covered by component tests. Real HTTP recovery success NOT VERIFIED. |
| X dismissal, no status pill | VERIFIED: browser click removes the notice; no Generation status button; Generate stays disabled. New active cycle restores the notification. Long mobile notice max-height 280 px, scrollHeight 3448 px; pinned X remains visible/clickable at scrollTop 3169.6 px. |
| Pending/billing/validation protection | VERIFIED by unchanged source wiring and scoped component/client/API/recovery tests. X only updates local dismissed state. |
| Mounted forms, source/identity and saved work | No owner/state/request/prompt/selection code changed. Component preservation and unchanged handlers tested. Full authenticated saved-draft acceptance after this correction NOT TESTED. |
| ReAPI / Terra medium / transcripts | VERIFIED unchanged by this presentation patch. New media, speech/identity quality and paid-provider behavior NOT TESTED. |
| Scheduling | Presentation in a shared wrapper only; no picker, conversion, targets, durable jobs or worker edits. Live schedule/publication NOT TESTED. |

Validation:

- Final focused group: 257/257 PASS, zero skipped; .tmp/local-https/floating-feedback-complete-tests.log. Command uses the existing next-server-only test loader, experimental transform-types/test-module-mocks and --test with workflow-action-feedback, workflow-floating-feedback, workflow-generation-client, workflow-generation-api-contract, workflow-generation-recovery, workflow-demo-audio-state, explore-format-generation-ui, explore-workflow-job-recovery, recreate-composer-sizing and generate-button-ui test files.
- Direct notification/component group: 24/24 PASS after adding X, .tmp/local-https/floating-feedback-dismiss-tests.log (overlaps focused group; do not sum).
- Broader group: 315 tests, 312 PASS, three unrelated existing expectation failures in workflow-composition-panel (selected subtitle color, reference border radius, newly expanded Seedance helper copy). These runtime paths/CSS/copy were not edited here. .tmp/local-https/floating-feedback-final-tests.log.
- Separate sections group: 37 tests, 35 PASS, two failures: unchanged selected-reference CSS expectation and a source-string expectation for hidden={!overviewActive} superseded by concurrent Talking Head result-review work. This correction did not edit hook-workflow-preview.tsx. .tmp/local-https/floating-feedback-sections-tests.log. Do not claim a completely green repository suite.
- npx tsc --noEmit --incremental false and scoped ESLint PASS; logs floating-feedback-dismiss-types.log and floating-feedback-dismiss-lint.log. Final scoped diff check recorded separately.

Browser method/limits: actual workflow React components rendered on a development-only route with synthetic feedback. Its local controls drive ready/error/long cases; its Refresh only changes local fixture state. It replaces the normal preview-access notice for that scenario, and never submits generation. Shared-parent error wiring is separately tested with actual component fixtures. This is presentation validation, not a real provider failure, successful paid job or production acceptance. Existing AppShell access/billing/timezone lifecycle requests were observed in server logs; no new settings mutation was introduced. Phone's public route remains retired; only its retained development component was inspected.

Placement prototypes were DOM-only comparisons on actual localhost Hook chrome: current left stack, right inline stack, compact right row and floating right card. Prompt y552 with the synthetic left stack versus y374.4 with right placement at1440×900; floating preserved gallery positions. User approved the floating variant. Approved screenshot is a real design baseline; earlier before/after fixture screenshots remain evidence of the incomplete repair.

Artifacts under .tmp/local-https/: feedback-placement-current-desktop.png, feedback-placement-right-panel-desktop.png, feedback-placement-right-floating-desktop.png, feedback-placement-right-compact-desktop.png; floating-feedback-hook-desktop.png, floating-feedback-hook-mobile.png, floating-feedback-long-mobile.png, floating-feedback-slideshow-desktop.png, floating-feedback-phone-mobile.png; final X screenshots and interaction readbacks added at completion. Earlier screenshots without X are historical stages. Layout-check controls belong only to the development fixture and may be hidden for final screenshots; product controls/errors are not masked.

Development caveats: cold compilation/Fast Refresh repeatedly exceeded browser navigation timeouts. Initial navigation observed an old-server/new-client hydration mismatch; after compilation, fresh Slideshow console check had zero errors/warnings. Test-control clicks during refresh were detached/intercepted; those failed attempts were not counted as successful transitions. Accepted geometry records require real React ready/error transitions with 0→1 visible notice and matching rectangles. A blank initial Hook screenshot was discarded and overwritten after successful rendering.

Incidents: UGC-UI-20261105-TALKING-HEAD-FOOTER-ERROR-SPACE, UGC-UI-20261105-FEEDBACK-STACK-RELOCATED and UGC-UI-20261105-FEEDBACK-STATUS-BUTTON. Local correction verified; hosted acceptance remains OPEN. Preserve all historical claims and their later corrections.

Rollback: revert only this correction's shared presentation component/styles, wiring, test updates and documentation additions. Preserve unrelated/concurrent Talking Head result-review, audio, automation and other work. No production build, push or deployment occurred; the existing authorized HTTPS development server remains available.

Final X verification: inspected floating-feedback-with-close-desktop.png, floating-feedback-dismissed-desktop.png and floating-feedback-with-close-mobile.png. Browser desktop X removed the card; changing to a different message restored it. Mobile X removed the notice, exposed Quality/Videos/Ratio and kept Generate disabled. The long-content pinned X was visible and clickable after scrolling. Final portal theme readback matches app-canvas background rgb(23,23,28). Final theme-only ESLint and nonincremental noEmit types PASS; logs floating-feedback-theme-lint.log and floating-feedback-theme-types.log. Scoped diff check PASS. No Generation status pill remains.
