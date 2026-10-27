# Workflow video editor: supplied Proxima Nova A Semibold

Status: implemented locally; hosted acceptance and desktop/mobile UI acceptance NOT VERIFIED. No deployment.

## Scope

The supplied Proxima Nova A Semibold is the initial font for new shared video-text overlays in Hook, Wall-of-Text, and Talking Head/demo clip editors. New Remix/automatic Hook text with no prior style inherits this default. Existing saved styles, including implicit legacy Arial, remain authoritative. Keep existing white color, outline 8, sizing, positioning, text, timing, audio and compact controls.

The archive contains only one real Semibold face. Expose Semibold (600) for this family rather than fabricating Regular/Medium/Bold. Switching away selects a supported weight. Bundle the supplied WOFF2 for preview and the supplied TTF for direct glyph-outline export; preserve their exact bytes and archive notice. The importer records hashes and measured glyph advances. Font preparation requires no new dependency.

Carousel choices and validators remain isolated from this video-editor addition. Slideshow's separate text-design/rendering system and speech subtitles were not changed.

## Files changed by this task

- `components/explore/format-text-overlays-editor.tsx`
- `components/explore/explore-text-fonts.css`
- `worker/src/lib/explore-format-edit.ts`
- `worker/src/lib/explore-text-fonts.ts`
- `worker/src/lib/explore-text-font-metrics.json`
- `worker/src/lib/carousel-manual-text.ts` (preserve existing allowed font set)
- `worker/src/assets/fonts/explore-text/manifest.json`
- `worker/src/assets/fonts/explore-text/proximanovaa-600.ttf`
- `worker/src/assets/fonts/explore-text/proximanovaa-notice.txt`
- `public/explore-text-fonts/proximanovaa-600.woff2`
- `scripts/prepare-proxima-font.mjs`
- `scripts/prepare-explore-text-fonts.py` (preserve separately imported face during OFL rebuilds)
- `scripts/explore-text-fonts.test.mjs`
- `scripts/explore-text-fonts.browser.cjs` (updated expectations; NOT RUN)
- `EXPLORE_CONTEXT.md` (append-only decision)
- This receipt.

Local sample artifacts, not release assets: `outputs/proxima-comparison/`; real export `.tmp/proximanovaa-bold-WCLV23/render/composed.mp4`.

## Preflight and contracts

Inspected AGENTS.md, relevant EXPLORE_CONTEXT.md typography/history sections, CAROUSEL_CONTEXT.md introduction, nonnegotiables.md, relevant clear.md incidents, and local Next.js font guide. Read context-memory, immutable-contracts, UI-clarity and regression-gate skill files. Read-only `python tools/preflight.py --repo . --task ...` passed prerequisite discovery. Large pre-existing worktree remains intact.

Relevant historical protections: UGC-UI-003 (avoid unrelated UI changes), EX-50 (exact preview/export font assets). No new user-reported defect or new incident claimed fixed.

## Verification

- `npm run worker:build`: PASS.
- `npx tsc --noEmit --incremental false`: PASS.
- Scoped ESLint of editor, shared font/style modules, Carousel isolation, importer and font tests: PASS.
- `node --experimental-strip-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/explore-text-fonts.test.mjs`: 11/11 PASS. Includes exact asset hashes, every supported face/weight rasterization, legacy and saved draft identity, Remix preservation, blank drafts, missing font failure, real timed MP4s and Proxima glyph/black-outline pixel checks.
- Related tests (`scripts/format-edit-draft.test.mjs`, `scripts/automatic-hook-text-editor.test.mjs`, `scripts/explore-format-edit.test.mjs`, worker Carousel manual and automatic Hook text tests): 53/53 PASS.
- Extracted and visually inspected the Proxima real MP4 frame at 800ms: centered white Semibold, black outline, all three lines visible.
- `node --check scripts/explore-text-fonts.browser.cjs`: PASS; browser execution NOT TESTED because local browser access is disabled in Work settings.
- Targeted `git diff --check`: PASS.

VERIFIED locally: saved-edit serialization and explicit style retention, actual Proxima glyph export, old-font render behavior, timing/source-byte preservation, automatic Hook user-edit protection, Carousel render regressions.

NOT TESTED: actual desktop/mobile browser appearance and controls, browser WOFF2 load, authenticated production save/export, hosted worker asset packaging. No claim of production readiness from static tests. Scheduling, source frame generation and prompt behavior were not altered or live-tested.

Rollback boundary: revert only this task's listed changes and added font files; preserve unrelated edits and existing saved records. Any newly saved Proxima records require continued font support.

## Edit-screen verification follow-up

- Found and corrected local browser fixture gaps:600 WOFF2 route omitted; an explicit saved Poppins700 assertion accidentally expected Proxima600. Added real Proxima font-load/save/reopen/desktop-mobile assertions while retaining existing Poppins checks. No application runtime code changed in this follow-up.
- Asset-only fixture mode compiles actual editor components and checks actual temporary HTTP responses against packaged files. PASS:19/19WOFF2 responses (including Proxima600), correct content type and exact bytes. Sandbox localhost connection was denied EACCES; approved external-sandbox asset-only retry passed without launching a browser.
- Browser fixture syntax and scoped ESLint PASS. Browser assertions remain NOT RUN. CUA inventory and a subsequent live-domain tab attempt, including after the user reported browser access enabled, both returned Local browser use is disabled in Work settings. No screenshots or successful UI interaction are claimed.
- Incident UGC-TEST-001 records the fixture gaps and distinction between asset tests and UI acceptance. New browser assertions are prepared but not runtime verified.
