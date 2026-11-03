# Explore naming change — 2 November 2026

Local implementation: visible product name **Text on screen**. User explicitly deferred video changes; existing cover video/poster and Remotion source are unchanged. No deployment.

## Scope and protected behavior
- VERIFIED: Explore card, shortcut, workflow heading/page title, format label, editor/demo/preview accessible labels and relevant validation copy use the new wording.
- VERIFIED by source diff: existing `/explore/wall-of-text` route, `wall_text` discriminator, API/storage identifiers, generation prompts, source captions and user-authored content preserved. No CSS/layout/palette changes in this task. Existing cover URLs/source restored with zero Remotion source diff.
- VERIFIED locally: Explore at 1440x1000 and 390x844; workflow opened at its original URL with title Text on screen | Vidmake; visible old label absent, no horizontal overflow at mobile. Screenshots inspected; no approved same-fixture before baseline was available, so pixel-perfect before/after comparison NOT VERIFIED.
- NOT TESTED: authenticated production, real generation, publishing, entire-application naming beyond Explore. Local fixtures are not production acceptance.

## Files changed for this task
- app/explore/wall-of-text/page.tsx
- components/explore/explore-workspace.tsx
- components/explore/format-workspace.tsx
- components/explore/format-demo-section.tsx
- components/explore/format-video-editor.tsx
- components/explore/format-text-overlays-editor.tsx
- components/explore/recreate-generation-panel.tsx
- components/explore/wall-schedule-preview.tsx
- lib/explore/workflows.ts
- lib/explore/recreate-types.ts
- lib/explore/recreate-types.test.ts
- lib/explore/recreate-catalog.ts
- lib/explore/wall-pending-composition.ts
- lib/explore/remix-text-edit.ts
- lib/explore/reference-text.ts
- scripts/explore-clip-live-controls.test.mjs
- scripts/explore-format-source-workspace.test.mjs
- scripts/explore-format-ui.browser.cjs
- scripts/explore-demo-loading.browser.cjs
- EXPLORE_CONTEXT.md
- docs/ai-context/clear.md
- this receipt

These are scoped edits atop existing uncommitted work; unrelated work was preserved. Temporary rendering/review scripts and screenshots under .tmp are local artifacts, not release changes. New unused public cover outputs were removed after the user deferred video changes.

## Preflight actually used
User-provided AGENTS.md; Explore context, protected contracts and relevant incident entries from clear.md in this session; context-memory, immutable-contracts, UI-clarity and regression-gate skills; installed Next layouts/pages guide; Python preflight passed earlier in this task. Relevant portions were revisited rather than claiming a fresh full reread of the historical ledger.

## Validation
- `npx tsc --noEmit`: PASS, including final run.
- Scoped ESLint on changed application files: PASS; supplementary lint on reference-text/remix-text-edit/workflows/format-workspace PASS.
- Node tests with next-server-only loader and experimental-transform-types: recreate-types + explore-clip-live-controls + explore-format-source-workspace + explore-navigation-ui + explore-reference-preview: 124 PASS.
- remix-text + wall-heading-body-remix + wall-pending-composition: 22 PASS.
- Final explore-format-source-workspace rerun after accessible toolbar rename: 77 PASS (overlaps initial suite).
- git diff --check: PASS, line-ending warnings only before final documentation additions.
- Browser: actual local Explore and original workflow URL at desktop/mobile. Anonymous preview disables generation as intended. No paid/provider calls.

Artifacts: `.tmp/text-on-screen-rename/explore-desktop.png`, `explore-mobile.png`, `workflow-desktop.png`, `workflow-mobile.png`. Inspected current screenshots; no before/after pixel assertion.

## Incident and limits
UGC-UI-119 added and verification appended; later user instruction explicitly exempts the video. C: disk exhaustion interrupted render/browser checks; cleared only task-generated renderer cache entries, then browser navigation recovered. No production settings, IAM, deployment or shared build configuration changed. Application areas outside Explore still need the requested later naming pass. Rollback boundary is the display strings/test expectations/context entries listed above; preserve unrelated edits.
