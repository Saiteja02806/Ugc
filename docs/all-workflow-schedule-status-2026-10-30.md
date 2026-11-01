# Consistent Explore scheduling confirmation — 2026-10-30

Implemented locally: Hook, Wall, Slideshow and Talking Head use the existing Hook presentation: one compact `Post scheduled` status and `View in Scheduling` link together above the action buttons. The shared pending-composition path already matched; completed-output paths now match too. No deployment or real post was created.

## Scope and files

- `components/explore/format-schedule-panel.tsx`: place the existing confirmed receipt link beside its status; suppress the duplicate standalone confirmed status.
- `components/explore/talking-head-schedule-review.tsx`: move the existing completed-action link beside the status.
- `scripts/explore-format-schedule-draft.test.mjs`: assert one confirmed link/status row above buttons for each format.
- `scripts/talking-head-schedule-review.test.mjs`: assert compact confirmed layout and absence of a success link for unconfirmed, busy and failed actions.
- `scripts/simple-repeat-scheduling.browser.cjs`: assert link count, status grouping, compact typography, viewport containment and placement above buttons across desktop/mobile workflows.
- `EXPLORE_CONTEXT.md`, `CAROUSEL_CONTEXT.md`, `docs/ai-context/clear.md`: record the rule, scope and UGC-UI-076-SCHEDULE-LINK verification.
- This report.

Rollback boundary: the two rendering edits and their regression assertions. Existing shared CSS is reused. No new controls, dependencies, APIs, schemas, time conversion, account selection, schedule requests or worker behavior were changed. Existing unrelated worktree changes were preserved.

## Preflight and evidence

Read AGENTS.md; applicable Explore/Carousel context; historical scheduling incidents in clear.md; nonnegotiables.md; scheduling-contract.md; and the ugc-context-memory, ugc-immutable-contracts, ugc-ui-clarity, ugc-scheduling and ugc-regression-gate skills. Consulted installed Next server/client component documentation and the prior schedule-confirmation report. Inspected shared schedule components, their workflow callers, persistence tests and existing confirmation gates. `python tools/preflight.py --repo . --task <scheduling placement request>` passed.

Source evidence established the inconsistency: PendingExploreSchedulePanel already grouped status/link; FormatSchedulePanel and TalkingHeadScheduleActions rendered the link below their action row. Format still requires a verified saved schedule ID, and Talking Head retains its existing completed-action gate.

## Verification

- 68 focused tests PASS using the repository loader: `node --import ./scripts/next-server-only-test-loader.mjs --experimental-test-module-mocks --experimental-transform-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/explore-format-schedule-draft.test.mjs scripts/talking-head-schedule-review.test.mjs scripts/explore-pending-schedule-ui.test.mjs lib/explore/pending-schedule-client.test.ts lib/explore/workflow-schedule-transport.test.ts`.
- Scoped ESLint PASS for both components and all three changed scripts.
- `npx tsc --noEmit --incremental false` PASS; scoped `git diff --check` PASS.
- `node scripts/simple-repeat-scheduling.browser.cjs`: PASS before and after. Real components with fixture APIs cover pending, Hook/video, Wall and Slideshow desktop/mobile; Talking Head confirmation presentation also passes. Checks include reload, repeat an hour later, double clicks and lost acknowledgement reconciliation.
- Visually compared slideshow mobile before/after and inspected Talking Head desktop. Status/link are readable together above the buttons without overflow. Artifacts: `.tmp/all-workflow-schedule-status-20261030/before-slideshow-mobile.png`, `after-slideshow-mobile.png`, `after-talking-desktop.png`; additional workflow desktop/mobile screenshots and browser logs are in the same directory.
- Initial test invocation lacked the repository loader and failed module resolution; the corrected command above passes without an application workaround.

Protected behavior: confirmation gates, errors/preparation states, local repeat/reload recovery and double-click protection VERIFIED by source and fixture tests. Existing caption/account/date/time controls and layout retained; desktop/mobile fixture layout VERIFIED. Live authenticated production scheduling, durable hosted jobs/targets, provider delivery, and cross-tab behavior against production NOT TESTED. Fixture receipts do not prove publication. No prompt/model changes or paid generation in this task.

Incident UGC-UI-076-SCHEDULE-LINK: local placement regression verified; production acceptance remains open. This report concerns scheduling presentation only.
