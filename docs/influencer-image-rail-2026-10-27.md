# AI influencer image workspace — 27 October 2026

Implemented locally; not deployed. Hosted acceptance remains **NOT VERIFIED**.

## Scope and files

- `components/characters/character-workspace.tsx`: remove count/helper DOM, preserve batch prompt/Copy, one horizontal result rail, completed-image expand dialog with original URL, previous/next, arrow keys and existing close behavior.
- `components/characters/character-workspace.module.css`: two-line prompt clamp; fixed-width 9:16 cards; reserved prompt/footer/action heights; horizontal overflow; scoped lightbox and hover/focus/touch styles.
- `components/characters/character-reference.test.mjs`: completed-only enlargement, navigation, stale visibility, no reference/generation side effects and removed copy.
- `scripts/character-reference.browser.cjs`: replace obsolete full-prompt/vertical-layout assertions; verify rail, long-prompt clipboard, pending/completed geometry, modal behavior and touch controls while retaining reference/download/history/recovery coverage.
- `EXPLORE_CONTEXT.md`: append current product decision.
- `docs/ai-context/clear.md`: append UGC-UI-041-INFLUENCER with evidence and production gap.
- This receipt.

Rollback boundary: the two workspace component/style files and corresponding tests/docs only. Preserve extensive unrelated staged/unstaged work and existing merge conflicts. No dependencies, API, persistence, generation/provider, worker, scheduling or deployment changes.

## Preflight and contracts

Read `AGENTS.md`, `docs/ai-context/nonnegotiables.md`, relevant `EXPLORE_CONTEXT.md` and `docs/ai-context/clear.md` sections, and the influencer actions/notice audit documents dated 16 October. Context/ledger command output was truncated; this receipt does not claim exhaustive inspection of every historical entry. Read the full context-memory, immutable-contracts, UI-clarity and regression-gate skills. Reviewed installed Next.js CSS guidance and client component guidance. Ran `python tools/preflight.py --repo . --task "AI influencer image workspace: remove status/help copy, two-line prompt preview, fixed horizontal result rail, completed-image lightbox"`: prerequisites PASS.

Relevant lessons: UGC-UI-002 stable pending geometry; UGC-UI-003 localized changes and responsive verification. Existing × dismisses workspace only, selected references survive, owned IDs preserve order, uncertain admissions retry the same request, and full prompt copying must survive preview truncation.

## Verification

- **VERIFIED locally:** 32 tests via `node --experimental-transform-types --test components/characters/character-reference.test.mjs lib/characters/result-groups.test.ts lib/characters/batch-progress.test.ts lib/characters/client-session.test.ts`.
- **VERIFIED locally:** 57 tests via `node --import ./scripts/next-server-only-test-loader.mjs --experimental-test-module-mocks --experimental-transform-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test lib/characters/generation.test.mjs lib/characters/identity.test.ts lib/characters/identity-routes.test.mjs lib/characters/history.test.mjs`.
- **VERIFIED:** `npx tsc --noEmit --incremental false`; scoped ESLint; scoped `git diff --check` (line-ending warnings only).
- **VERIFIED locally:** `node scripts/character-reference.browser.cjs`, before and after changes, using real workspace, builder, composer and shared Dialog. Auth, API/storage responses and image data are fixtures. Edge launch failed inside the sandbox; approved external execution passed.
- **VERIFIED locally:** image selection, ordered mixed references, full long-prompt copying, download action, non-destructive removal, History, clean re-entry, reload, idle reset, upload errors, uncertain-request recovery, keyboard and mobile fit.
- **VERIFIED locally:** single rail, predictable dimensions, pending append extends horizontal width without increasing rail/page height, completion keeps dimensions, original image URL in lightbox, completed-only navigation, Escape/Close/outside dismissal and touch expand visibility/placement/hit target.
- **NOT TESTED:** neighboring production Hook/Demo/Schedule flows. Their components and backend code are outside this patch.
- **NOT VERIFIED:** authenticated production acceptance, actual generated image quality or hosted downloads. Production browser navigation failed because its profile is already in use. No deployment or paid generation was performed. Full project production build not run for this component/CSS-only change in the conflicted shared worktree.

## Visual evidence

Existing baseline captured at 1100×900 and 390×844 under `.tmp/influencer-rail-baseline/`; it is an observed pre-change baseline, not a user-approved golden design. After screenshots under `.tmp/character-reference-browser/`:

- `rail-desktop.png`, `rail-mobile.png`
- `lightbox-desktop.png`, `lightbox-mobile.png`
- `pending-rail-mobile.png`, `touch-rail-mobile.png`
- `mixed-references-desktop.png`, `mixed-references-mobile.png`

Desktop/mobile images manually inspected. Existing grouped prompt-to-batch relationship is retained. Cards are 220px desktop and 180px mobile, with 9:16 image areas. Lightbox uses the original stored output; it cannot restore resolution absent from that stored image.

Final touch hit-target assertion initially ran during the History dialog exit overlay and failed. Waiting for that existing overlay to leave before testing the workspace resolved the fixture timing issue; the complete browser suite then passed. The expand overlay has explicit local stacking above the portrait.
