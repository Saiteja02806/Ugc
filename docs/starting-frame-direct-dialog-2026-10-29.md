# Direct starting-frame Change dialog — 29 October 2026

## Implemented scope
Change on the compact approved frame now directly opens the existing large centered photo dialog (920px desktop maximum, responsive mobile), with page backdrop and existing selected photos. Removed intermediate Choose image and nested anchored library for this path. No new permanent buttons or global CSS. A display-only frame prop keeps the scene image independent of identity photo additions/removal. Recent-frame replacement and Create starting frame remain inside this dialog. Explicit saved selections, source timestamps, prompts, model/provider inputs and persistence formats are unchanged. Noncompact preparation pickers retain their existing behavior. Rollback boundary is the two component changes; no backend/schema mutation.

## Files changed
- components/explore/starting-frame-animation-references.tsx
- components/explore/format-generation-references.tsx
- scripts/starting-frame-animation-references.test.mjs
- scripts/starting-frame-compact.browser.cjs
- scripts/explore-format-reference-upload.test.mjs
- scripts/explore-format-generation-ui.test.mjs (test loader only: resolve the existing motion-phase-display dependency)
- EXPLORE_CONTEXT.md
- docs/ai-context/clear.md
- docs/starting-frame-direct-dialog-2026-10-29.md (this receipt)

## Preflight
Read context-memory, immutable-contracts, UI-clarity and regression-gate skills; relevant AGENTS instructions, full nonnegotiables, relevant Explore/history sections and recurring UGC-UI-001/compact-frame incident evidence, under the user's existing relevant-sections authorization. Read current components, shared dialog/inline-picker implementations, callers and selection tests. Installed Next use-client guide read. python tools/preflight.py --repo . --task "Direct full-size starting-frame Change photo picker, local only" passed. Initial worktree clean. New UGC-UI-058 recorded before application changes.

## Verification
- 195/195 focused generation, starting-frame, upload, UI and source-control regressions passed. Initial 76 failures were all an unhandled existing motion-phase-display import in the VM test loader; adding that real dependency allowed all tests to run and pass.
- 34/34 upload/reference tests passed after adding the new display-only frame/identity separation regression.
- Actual-component desktop/mobile browser fixture: direct dialog, no Choose image or nested popover, centered desktop width, mobile bounds, original upload preselection, adding a second influencer, Done/reopen/Escape, WAN frame replacement and frame retention. No provider calls. Edge sandbox launch failed; outside-sandbox local test succeeded.
- TypeScript --noEmit passed. Scoped ESLint and git diff --check results recorded in .tmp/change-picker-*.
- Dark-theme screenshots visually inspected at desktop/mobile. Fixtures use local sample imagery and do not prove authenticated production inventory.

## Protected behavior status
VERIFIED locally: single compact frame/Change, photo selection order and explicit removals, starting frame not cleared by photo selection, separate first-frame/appearance payload roles, model limitations, stale request protection, existing general reference/upload/source-control tests, responsive dialog and original source timestamp logic unchanged.
NOT TESTED live: authenticated production dialog and owned hosted uploads. No deployment requested or performed. No real image/video generation, scheduling or publication attempted. No full production build repeated for this scoped UI patch; types, component/browser and regression tests provide local verification only.

## Visual artifacts
.tmp/starting-frame-compact/compact-1280.png
.tmp/starting-frame-compact/compact-390.png
.tmp/starting-frame-compact/chooser-1280.png
.tmp/starting-frame-compact/chooser-390.png
.tmp/starting-frame-compact/influencers-1280.png
.tmp/starting-frame-compact/influencers-390.png
The user's fifth screenshot is the target large-modal reference; screenshots 1–4 show the rejected stacked flow. Local fixture captures validate geometry/interaction, not exact production data or generated likeness.
