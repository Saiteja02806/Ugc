# Compact workflow action footers — 5 November 2026

Status: VERIFIED for the scoped local presentation repair. Production acceptance and paid generation were NOT TESTED. No deployment or production setting changes.

Detailed readiness messages, errors and recovery controls previously expanded the fixed action area. They now appear in the scrolling form while the existing primary action stays in the footer. WorkflowCreationPanel covers Talking Head and the retained Phone panel. AiStudioComposer's workflow branches cover Hook Video, Text on Screen and manual Slideshow, including regeneration action portals. Focused estimated cost remains beside the primary action.

This is a source-order JSX relocation. Preserve text, handlers, disabled/busy conditions, form associations, mounted children and custom edit actions. Related shared finishing feedback follows the same placement rule; scheduling execution is unchanged. Nonworkflow AI Studio layouts, unrelated audio/history/dialog footers and automated Carousel behavior remain outside this patch.

Files changed for this repair:

- components/explore/workflow-creation-panel.tsx — feedback/recovery moves into existing scrolling settings.
- components/generation/ai-studio-composer.tsx — access/secondary feedback moves out of classic/focused/default workflow action slots; primary buttons describe their form feedback.
- scripts/workflow-action-feedback-fixture.mjs — isolated actual-component renderer.
- scripts/workflow-action-feedback.test.mjs — 19 behavioral cases.
- scripts/workflow-sections.test.mjs — existing assertions updated for feedback in scrolling settings.
- docs/ai-context/nonnegotiables.md — user's compact-footer contract.
- docs/ai-context/clear.md — append-only incident scope and evidence.
- EXPLORE_CONTEXT.md — shared presentation decision and acceptance limits.
- docs/compact-workflow-footers-2026-11-05.md — this receipt.

Preflight actually read: AGENTS.md engineering rules; full protected nonnegotiables; relevant complete Explore/clear sections under the user's existing read exception; Carousel boundaries; scheduling-contract.md; installed Next use-client guide; context-memory, immutable-contracts, UI-clarity, regression-gate and scheduling SKILL.md files. Ran tools/preflight.py and inspected git status, callers, portals, CSS and tests before editing. Existing unrelated/concurrent changes were preserved. No dependency, global-style, configuration, schema, provider or worker changes.

| Protected contract | Result |
| --- | --- |
| Compact footer, recoverable feedback | VERIFIED locally: all five component/CSS fixtures retain a 76.8 px footer in tested states; feedback is outside it. |
| Validation and unresolved-request guards | VERIFIED by scoped component/client/API/recovery tests: same disabled conditions, prompt limits, callbacks and form submit association. No pending request is cleared. |
| Editing and scrolling | VERIFIED in 1280×800 and 390×844 browser fixtures: long feedback scrolls; instructions can be clicked, focused and edited; Refresh increments once; blocked Generate remains disabled; no horizontal overflow. |
| Mounted content, custom edit toolbar and navigation | VERIFIED in component tests; actual local Talking Head Create → Demo → Schedule → Create returns to compact Generate. Fresh authenticated persistence acceptance NOT TESTED. |
| Source/identity, prompt and model routing | VERIFIED unchanged in the scoped source diff. ReAPI/Terra medium and transcript/media handling were not edited. Actual speech, face consistency and provider output NOT TESTED. |
| Scheduling/publishing | No picker/time conversion/job/worker changes. Live durable scheduling/publication NOT TESTED and not claimed. |

Commands and outcomes:

1. tools/preflight.py --repo . --task … — PASS prerequisite discovery; .tmp/local-https/compact-footer-preflight.log. This does not prove every historical file was reread in full.
2. node --experimental-transform-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/workflow-action-feedback.test.mjs — 19/19 PASS. These are included in the next group, not additional unique tests.
3. node --import ./scripts/next-server-only-test-loader.mjs --experimental-transform-types --experimental-test-module-mocks --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/workflow-action-feedback.test.mjs scripts/workflow-generation-client.test.mjs scripts/workflow-generation-api-contract.test.mjs scripts/workflow-generation-recovery.test.mjs scripts/workflow-demo-audio-state.test.mjs scripts/explore-format-generation-ui.test.mjs scripts/explore-workflow-job-recovery.test.mjs scripts/recreate-composer-sizing.test.mjs scripts/generate-button-ui.test.mjs — 251/251 PASS, zero skipped. Log: .tmp/local-https/compact-footer-regression-tests.log.
4. Initial workflow-sections/sizing/button group — 21 PASS, one existing CSS expectation FAIL. Unchanged test expects selected reference border var(--primary), unchanged CSS uses var(--foreground). Reproduced with --test-name-pattern 'shared polish'; neither CSS file changed. Do not alter unrelated appearance to satisfy this historical mismatch. Logs: compact-footer-initial-tests.log and compact-footer-baseline-css-test.log under .tmp/local-https.
5. npx tsc --noEmit --incremental false — PASS. npx eslint components/explore/workflow-creation-panel.tsx components/generation/ai-studio-composer.tsx — PASS. Scoped git diff --check — PASS.

Actual unsigned localhost development previews were inspected for Talking Head, Hook, Text on Screen and Slideshow: compact footer and feedback inside controls. Talking Head and Hook desktop footers measured 76.8 px. Actual Hook/Slideshow mobile previews had no horizontal overflow; Slideshow's compact Generate is at the end of the existing mobile page flow. Phone's ordinary route remains retired (notFound); its retained panel was fixture-tested, not presented as a live signed-in route.

Negative-state fixtures render actual component markup/module CSS with stubbed UI primitives and fixture controls, without backend/provider calls. Identical Talking Head fixtures measured error footer 172.8 px before versus 76.8 px after. All five desktop fixtures covered ready/long/pending/credit states; all five mobile fixtures covered ready/long states. Measurements: .tmp/local-https/compact-footer-browser-results.json. Long mobile feedback scrolled to 279.2 px; the textarea could be clicked/focused/edited and footer stayed 76.8 px. Fixture Refresh only increments a local counter; real HTTP recovery success is not implied. Callback wiring is separately tested.

Inspected visual artifacts, under .tmp/local-https/: compact-footer-before-desktop.png, compact-footer-after-desktop.png, compact-footer-before-mobile.png, compact-footer-after-mobile.png, compact-footer-live-talking-desktop.png, compact-footer-live-hook-desktop.png, compact-footer-live-hook-mobile.png, compact-footer-live-slideshow-mobile.png, compact-footer-long-error-scrolled-mobile.png.

Before/after comparison uses actual HEAD/current shared component markup in the isolated fixture, not an approved production golden. The user's screenshot is defect evidence. A cold Slideshow route compilation exceeded browser navigation timeout; its completed page was subsequently inspected successfully. Authorized HTTPS development compilation runs at https://localhost:3000. No production build, push, deployment or hosted setting mutation. Temporary fixture artifacts/listener are outside application code.

Incident: UGC-UI-20261105-TALKING-HEAD-FOOTER-ERROR-SPACE. Cause confirmed: detailed feedback inside fixed action slots. Presentation repair is locally VERIFIED; hosted acceptance remains OPEN. The user's original uncertain/prompt-too-long generation request was not submitted, cleared or diagnosed by this layout change. Fresh authenticated HTTP recovery and deployed desktop/mobile acceptance remain NOT VERIFIED.

Rollback boundary: only this task's presentation relocations, tests and documentation additions. Preserve all preceding Talking Head, audio, automation and concurrent work; never reset the dirty worktree.

Superseded by explicit user correction, 5 November 2026: reducing the footer alone did not recover editing space because the entire stack moved above the form. The approved right floating card and later requested X dismissal are implemented and documented in docs/workflow-floating-feedback-2026-11-05.md. The earlier local footer-only verification is historical and does not establish complete user acceptance.
