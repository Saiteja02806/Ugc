# Slideshow gallery names and Recreate corners — 27 October 2026

Status: **LOCALLY VERIFIED; NOT DEPLOYED**.

Requested scope: remove all visible slideshow/category names beneath slideshow gallery cards (Slideshow 1/2, Fitness, Marketing, etc.) and increase Recreate button border radius. This is now a format-wide rule, not a rename of stored references. Slideshow labelled and icon Recreate buttons use rounded-full. No dependencies, global styles, APIs, persistence or generation logic changed.

Files changed in this follow-up:

- `components/explore/recreate-workspace.tsx`: omit slideshow title text; omit empty caption rows when there is no source/selection; preserve source links and Selected feedback; round slideshow Recreate buttons.
- `scripts/slideshow-card-ui.test.mjs`: test every name type, callback/reference identity, source/selection retention and unchanged Hook/Wall captions/corners.
- `scripts/slideshow-source-links.browser.cjs`: check absent title nodes and computed pill radius; repair an existing missing useCreatorVideoPreview import and isolate fixture authentication so Firebase credentials are unnecessary.
- `docs/ai-context/nonnegotiables.md`: protected slideshow-gallery rule.
- `EXPLORE_CONTEXT.md`: product decision.
- `docs/ai-context/clear.md`: new UGC-UI-040-SLIDESHOW incident and local evidence.
- This report.

Preflight: inspected git status and target diffs/callers; preserved all prior work and unresolved conflicts. Read root engineering instructions, current Explore and manual slideshow context, incident/contract sources, context-memory, immutable-contracts, UI-clarity and regression-gate skills. Consulted installed Next.js server/client component guidance. Ran `python tools/preflight.py --repo . --task "Hide slideshow gallery names by rule and slightly increase Recreate button border radius; retain source links, previews, counts and existing actions"` (PASS prerequisite discovery).

Relevant historical safeguards: UGC-UI-003/004 forbid losing neighboring controls during visual cleanup; source links must not disappear with title captions. The new UGC-UI-040-SLIDESHOW rule supersedes earlier gallery naming presentation for slideshow cards only.

Validation:

- `node --experimental-transform-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/slideshow-card-ui.test.mjs scripts/explore-format-source-workspace.test.mjs`: **80/80 PASS**.
- `npx eslint components/explore/recreate-workspace.tsx scripts/slideshow-card-ui.test.mjs scripts/slideshow-source-links.browser.cjs`: **PASS**.
- `npx tsc --noEmit --incremental false`: **PASS**.
- `node scripts/slideshow-source-links.browser.cjs`: **PASS**, 38 source destinations, correct Creator profile/Original post labels, preview/Next/Previous, Recreate callback, keyboard source navigation, free-account upgrade gating and legacy cards at 1366/1280/390px. External destinations are intercepted fixtures, not live social-provider acceptance.
- Task-scoped `git diff --check`: **PASS**.

Before/after actual-component fixture screenshots were captured and visually compared:

- `.tmp/slideshow-card-ui/before-desktop.png`
- `.tmp/slideshow-card-ui/after-desktop.png`
- `.tmp/slideshow-card-ui/before-mobile.png`
- `.tmp/slideshow-card-ui/after-mobile.png`

The baseline is the actual pre-change local component, not an approved full-app golden design. Fixtures substitute authentication/billing, host shell/fonts and external social destinations. Static catalogue media is local; unavailable media uses the existing fixture fallback. Images/count badges are retained; after screenshots show source links and pill Recreate buttons without category captions.

Protected behavior: **VERIFIED locally** — hidden names, retained IDs/descriptive accessible labels, source links/entitlement, preview/recreation callbacks, selected feedback, responsive fit and unchanged Hook/Wall presentation. Generation/scheduling/backend are unchanged by source scope and **NOT TESTED live** in this visual follow-up. Production authenticated visual acceptance and deployment are **NOT VERIFIED**. No push/deployment, paid generation or private-input replay occurred.

Rollback boundary: only this follow-up's slideshow format conditions/radius, its test additions and appended rule/evidence. Preserve earlier recovery fixes and all unrelated worktree edits.
