# Landing hero gallery completion receipt — 2026-10-26

Status: PARTIALLY VERIFIED. Local visual acceptance passed; production build and production acceptance remain unverified.

## Scope and files

Implemented seven real Explore content pieces in a symmetric arch, with one dominant center Hook. Desktop card widths are 112, 146, 188, 270, 188, 146, 112 pixels; mobile/tablet use an internally scrollable gallery initially centered on the primary Hook. Only that Hook autoplays. Playback and slideshow controls appear on hover or keyboard focus.

Files changed for this task:

- `app/page.tsx`
- `components/marketing/landing-hero-gallery.tsx`
- `components/marketing/landing-preview-video.tsx`
- `components/marketing/landing-hero-showcase.tsx` (manifest compatibility)
- `lib/marketing/landing-preview-assets.json`
- `next.config.ts` (immutable headers for the curated assets)
- `scripts/prepare-landing-hero-gallery.mjs`
- `scripts/marketing-layout.browser.mjs`
- `scripts/landing-performance.browser.cjs`
- `public/marketing/hero-gallery/` (22 content-hashed media files)
- This receipt.

Other dirty worktree changes were preserved and are outside this task.

## Sources and procedures actually read

`AGENTS.md`, `EXPLORE_CONTEXT.md`, `docs/ai-context/clear.md`, `docs/ai-context/nonnegotiables.md`; UGCPilot context-memory, immutable-contracts, UI-clarity and regression-gate skills; frontend-design; Product Design image-to-code, router, user-context, critical-overrides and design-QA instructions; bundled Next.js server/client component and image guidance.

The UGCPilot preflight passed for extending five cards to seven while preserving the focal Hook and unrelated behavior. No incident was added: this is a requested design change. Relevant historical safeguards were UGC-UI-003/004 and UGC-OPS-003.

## Visual comparison

Reference: `C:/Users/chund/AppData/Local/Temp/codex-clipboard-f68eea69-1edb-49ec-84d3-73f9df651647.png` (798 × 502).

Implementation: `.tmp/marketing-layout-browser/home-1440.png` (1440 × 900, dark, local development).

Comparison: `.tmp/landing-gallery-reference-comparison.png`, reference normalized with contain to 1440 × 900 above implementation. Reviewed manually: the two outer slots are filled; center hierarchy, spacing, typography, colors and existing copy are retained. No blocking visual findings. The small differences in gallery width accommodate the seven complete cards. The Next.js development indicator is tooling, not landing-page content.

Responsive screenshots reviewed: `.tmp/marketing-layout-browser/home-390.png`, `home-1050.png`, `home-1440.png`. At narrow widths the gallery opens centered and scrolls internally without document overflow. Visual QA result: passed.

## Verification evidence

- Scoped ESLint: passed, including the final control and test changes.
- `npx tsc --noEmit`: passed.
- `node scripts/marketing-layout.browser.mjs`: passed outside the restricted sandbox; receipt at `.tmp/marketing-layout-browser/receipt.json`. Forty combinations across four public routes, five widths and both themes; clipboard and setup navigation passed; zero page errors. Assertions cover exact seven-source order, card geometry, mobile initial focus, one playing focal video and unloaded passive videos.
- Scoped `git diff --check`: passed.
- All 22 manifest assets exist; five optimized videos fully decoded successfully. Total video bytes: 1,504,399.
- Production build: NOT VERIFIED. Turbopack stalled; webpack attempts encountered Windows/OneDrive EPERM errors while creating generated `.next` directories. No successful production build is claimed.
- Production performance script: NOT TESTED; it requires a successful production build.
- Deployment/live verification: NOT TESTED; this gallery revision has not been deployed.

## Protected behavior and limits

- VERIFIED locally: hero heading/copy and CTA destinations, social pill, seven selected Explore references, responsive document width, public MCP routes, clipboard/setup navigation and absence of runtime errors.
- VERIFIED by scoped source review: no Explore workflow, prompt/model, generation, scheduling, authentication or database implementation was edited for this gallery.
- NOT TESTED: authenticated production Explore flows, server scheduling and paid generation; none are part of this change.
- NOT TESTED after this revision: production caching/range delivery, reduced-motion/save-data playback and offline/visibility lifecycle in the production performance suite. These assertions were adapted but are not reported as executed.

Rollback boundary: landing gallery/component wiring, curated manifest/media, immutable media headers and the task-specific test/preparation updates. No unrelated worktree changes should be reverted.
