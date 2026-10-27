# Moving landing gallery — 27 October 2026

Status: gallery LOCALLY VERIFIED against a production build. Not deployed. The full performance suite retains a separate font-preload failure; see limitations.

## Implemented scope

The original seven-card composition now moves continuously right to left, taking6.5seconds per position. Each piece grows toward the center to the existing270×480desktop maximum (252×448compact maximum), then shrinks toward the edges. Wrapping happens outside the clipped stage. The existing stage height, hero copy, CTAs, color/type system and surrounding page remain intact.

Eleven pieces rotate: the original seven plus a full42.027second Talking Head reference, an8second demo excerpt from that same original at11–19seconds, another Hook and another Wall reference. This means four additional pieces from three additional source references. The two existing slideshows remain included. The original Explore source files/catalogues were not modified.

Only the nearest-center video may load/play. Hover, keyboard focus and touch contact pause movement; previous/next, arrow keys and swipe allow manual browsing. The small track control supplies explicit pause/resume. Reduced-motion and save-data preferences stop automatic motion and video loading. Hidden/offscreen/offline tracks stop advancing; video sources release when inactive or unavailable. Manual pause and reload behavior are tested.

## Exact files changed in this task

- `components/marketing/landing-hero-gallery.tsx`
- `components/marketing/landing-preview-video.tsx` (optional playback admission; existing callers default to previous behavior)
- `lib/marketing/landing-gallery-motion.ts`
- `lib/marketing/landing-preview-assets.json`
- `scripts/prepare-landing-hero-gallery.mjs` (retain separately curated additions on refresh)
- `scripts/prepare-landing-loop-additions.mjs`
- `scripts/landing-gallery-motion.test.mjs`
- `scripts/landing-gallery.browser-checks.mjs`
- `scripts/landing-gallery.fixture.browser.cjs`
- `scripts/marketing-layout.browser.mjs`
- `scripts/landing-performance.browser.cjs`
- `docs/ai-context/clear.md` (append-only findings/evidence)
- This receipt.
- `public/marketing/hero-gallery/talkingDemo.6b86d8d03ce7f7be.mp4`
- `public/marketing/hero-gallery/talkingDemo-poster.3b0775f5767f1742.webp`
- `public/marketing/hero-gallery/demoExample.6b0528c218faefa6.mp4`
- `public/marketing/hero-gallery/demoExample-poster.5bdaf244aa6a00b1.webp`
- `public/marketing/hero-gallery/hookExtra.9d94329380e65fcc.mp4`
- `public/marketing/hero-gallery/hookExtra-poster.8d95a96dd5af7740.webp`
- `public/marketing/hero-gallery/wallExtra.b1a621e5f2610066.mp4`
- `public/marketing/hero-gallery/wallExtra-poster.b9c2974f1dc7d494.webp`

The worktree contains extensive other intentional work. It was preserved. No staging, commit, push or deployment was performed. Previous gallery changes such as app/page.tsx and manifest-driven next.config.ts headers are reused; those files were not edited again in this task.

## Preflight receipt and change boundary

Read/reviewed: supplied and on-disk AGENTS.md; Explore context's workflow, recurring UI failure, reference and recent release records; clear.md and nonnegotiables.md; UGCPilot context-memory, immutable-contracts, UI-clarity and regression-gate skills; frontend-design skill; bundled Next.js use-client and image guides. Existing gallery, preview lifecycle, callers, manifest/preparation/caching and browser assertions were inspected. Mandatory read-only tools/preflight.py passed.

Relevant safeguards: UGC-UI-003/004 for localized UI changes, UGC-VID-008 for actual video/source provenance, UGC-OPS-003 for local versus hosted acceptance. This request authorizes replacing static gallery positioning with continuous motion; it does not authorize Explore workflow or generation changes.

Rollback boundary: these gallery/motion/media/test updates only. Keep unrelated user changes and historical ledger entries. No new dependencies, migrations, global CSS, font, authentication, API, generation, scheduler or worker changes.

## Selected media evidence

Source IDs: `talking-room-explainer-full`, `explore-paired-hook-4585ee949081c4e5cd835cd3`, `explore-paired-wall_text-d3259c1239762b2daa319893`. Demo derivative ID: `talking-room-explainer-full:demo-11-19`, with explicit parent and trim bounds. Source hashes match canonical catalogue/manifests. The Hook is in an active published public release and is not excluded.

Reviewed eight sampled source images per selected original and the demo's actual first image. The Talking Head source includes both the person and real laptop demonstrations; the isolated demo piece shows that segment directly. This was asset curation, not frame-by-frame prompt analysis or generated-fidelity acceptance. Four optimized additions fully decode through their ends and contain no audio; originals remain untouched. Content hash/size assertions cover all nine manifest videos and posters. All video bytes total6,486,222; a cold mobile visit still requests only the195,963byte primary Hook.

## Verification

- `node --experimental-strip-types --test scripts/landing-gallery-motion.test.mjs`:4/4 PASS. Covers original slot dimensions, continuous gaps, center traversal, invisible wrap boundaries, canonical provenance, demo trim, encoded hashes and sizes.
- Scoped ESLint: PASS. `npx tsc --noEmit`: PASS.
- `npm run build -- --webpack` outside the Windows sandbox: PASS,230static pages, TypeScript and native decoder/traced-route postbuild checks.
- `node scripts/marketing-layout.browser.mjs --base-url http://127.0.0.1:8194`:40/40 PASS on the production build across /,/mcp,/mcp/claude,/mcp/codex;360/390/768/1050/1440widths;both themes. Clipboard/setup links PASS. Zero page errors and zero image-parent warnings. Includes all11center sources, one focal video, pause/hover, keyboard/swipe, preference guards, failed-media browsing, offline release and reload recovery.
- `node scripts/landing-gallery.fixture.browser.cjs`: PASS. Actual gallery and application CSS; native image adapter and static hero shell disclosed. Separate visual recording and snapshots of each addition. No authentication/backend/provider mocked into a production-acceptance claim.
- `node scripts/landing-performance.browser.cjs --gallery-only`:15checks PASS. Immutable headers/range delivery, static cookie-independent homepage, source release/resume, cold-mobile request budget, reduced motion/save data, six exact editor font faces and five isolated real-auth-component state cases. Those auth cases are browser fixtures, not real sign-ins.
- Scoped git diff whitespace checks: PASS.

## Visual evidence

Before: user screenshots codex-clipboard-417d6083-9827-436a-ba93-aea547f94ecc.png and codex-clipboard-476a734d-b175-499d-9cee-7409a85486b2.png; prior local baseline .tmp/marketing-layout-browser/home-{1440,390}.png.

Actual production-build page screenshots manually reviewed: `.tmp/marketing-layout-browser-production/home-1440.png` and `home-390.png`. Existing copy/buttons/themes remain, cards now travel through the established size profile; no document overflow. The separate Playwright receipt also covers tablet/laptop widths.

Actual gallery fixture images manually reviewed: `.tmp/landing-loop-browser/gallery-desktop-still.png`, `gallery-desktop-moving.png`, `gallery-mobile-moving.png`, `gallery-demo.png`; source-review sheets under `.tmp/landing-loop-additions/`. Full fixture video: `.tmp/landing-loop-browser/landing-gallery-motion.webm`. Cropped gallery-only viewing copy: `.tmp/landing-loop-browser/gallery-motion-preview.webm`.

Receipts: `.tmp/marketing-layout-browser-production/receipt.json`, `.tmp/landing-loop-browser/receipt.json`, `.tmp/landing-performance-browser/receipt.json`.

## Incidents, protected contracts and limitations

- UGC-UI-018: caught the new slideshow fill-parent warning; corrected the direct wrapper to relative positioning. LOCALLY VERIFIED by explicit parent assertions and zero warnings on the real production build.
- UGC-OPS-009: cold local dev /mcp returned500/socket hang up. No proxy changes made; all MCP routes subsequently PASS on the production build. Cold-dev cause remains unknown.
- UGC-OPS-010: unscoped performance test FAILS the older font-preload budget (actual0,expected2). No root font configuration changed. The scoped run explicitly excludes only that assertion and retains the full failure for separate investigation. Do not report the full performance suite green.
- Earlier cold dev runs timed out during compilation; one later screenshot waited indefinitely for unrelated lazy fonts. Actual production build and final40-layout production sweep completed; dedicated recording avoids those dev/harness delays.
- VERIFIED locally: current landing header/copy/CTA/social destinations, initial gallery source order/size profile, continuous source traversal, controls/preferences/recovery, production-build MCP layout and links, static caching/media delivery.
- VERIFIED by task-scope source review: Explore source catalogue files, prompt/model/provider wiring, scheduler/account/timezone behavior and shared preview callers' defaults are untouched by this patch.
- NOT TESTED: real signed-in Explore generation/editing/scheduling, hosted provider execution and fresh production-domain acceptance. No paid generation, publication, backend write, source-media replacement or live rollout occurred.

The safe next release step must audit the entire dirty worktree according to AGENTS.md if the user requests deploying all current changes. This receipt verifies this gallery scope and is not authorization to omit other intentional work.
