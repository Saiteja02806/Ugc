# Explore cover activation — 3 November 2026

**LOCALLY VERIFIED; not deployed.** The finished promotional videos and their matching posters are now selected on all five Explore catalog cards.

| Card | MP4 / matching WebP base under `/explore/covers/` | Duration |
| --- | --- | --- |
| Talking Head + Demo | `talking-head-demo-promo-v1` | 10s |
| Hook video | `hook-video-promo-v1` | 9s |
| Text on screen | `wall-of-text-promo-v1` | 9s |
| Slideshows | `slideshow-promo-v1` | 7s |
| Build AI influencer | `ai-character-promo-v1` | 15s |

[Local Explore preview](http://127.0.0.1:3000/explore)

## Files changed and boundary

- `lib/explore/workflows.ts`: replace the four older workflow video/poster URL pairs with the completed promo exports.
- `components/explore/ai-character-card.tsx`: use the canonical AI Character promo video/poster instead of its older-named alias. The existing local alias already has the same film and remains available.
- `EXPLORE_CONTEXT.md`: record the current cover mapping and local acceptance.
- `docs/ai-context/clear.md`: append UGC-VID-058 before implementation and the verified result afterward.
- `docs/explore-cover-activation-2026-11-03.md`: this receipt.

No media was regenerated, recompressed or overwritten. All ten existing delivery assets remain unchanged. No tests, playback logic, CSS, labels, routes, application controls, models, APIs, schema, scheduling or deployment configuration changed. The pre-existing Text on screen label change remains intact; it was not introduced by this task. Unrelated worktree edits were preserved.

Snapshots, metadata, hashes, decoded overview frames, screenshots and browser receipts are in [the review manifest](C:/Users/chund/OneDrive/Desktop/UGC/output/remotion-review/explore-cover-activation-2026-11-03/delivery-manifest.json). Rollback only the two source files from its `before/` snapshots; do not reset the wider worktree or erase incident history.

## Preflight actually performed

Read `AGENTS.md`, the full `docs/ai-context/nonnegotiables.md`, applicable current cover/playback entries in `EXPLORE_CONTEXT.md` and `docs/ai-context/clear.md`, and the full context-memory, immutable-contracts, UI-clarity and regression-gate skills under `.agents/skills/`. The large historical archives were inspected selectively; this does not claim that every archival line was re-read. Relevant prior incidents are UGC-UI-087/097 and UGC-VID-055/056/057.

Inspected the actual workflow data, both card components, playback hook, CSS, callers, tests and dirty worktree. Read the installed Next public-folder and video guides. `python tools/preflight.py --repo . --task <check the finished videos and set all five Explore covers>` passed discovery/readability. The minimal scope contract is saved as `scope.md`.

## Evidence and protected behavior

| Check | Result |
| --- | --- |
| Correct active covers | VERIFIED — all five real local DOM videos use the expected MP4/poster pairs; local HTTP hashes match the audited files exactly. |
| Video validity and review | VERIFIED — all five are H.264, 1920×1080, 30fps, silent, and fully decode. Reviewed 100 half-second overview samples and all five posters; AI v4 also matches the previously reviewed export hash. Sampling is not a claim that every frame was manually inspected. |
| Autoplay, continuous playback and loop | VERIFIED — all five advance without hover on desktop, continue after pointer leave, and wrap to the beginning when tested near the end. Muted, inline and decorative controls remain correct. |
| Mobile and offscreen behavior | VERIFIED — each card plays after scrolling into view at 390×844; offscreen cards pause and release `src`. No horizontal overflow. Active cover bounds are approximately 342.4×192.6. |
| Reduced motion | VERIFIED — videos pause and clear sources; the matching posters remain visible. AI's existing CSS hides its decorative video in this mode. |
| Loading failure and recovery | VERIFIED — deliberately blocked Hook MP4 retains the correct decoded poster, clickable destination and dimensions; restoring the source resumes playback. The one expected error during this test is intentional. |
| Geometry, styling and neighboring behavior | VERIFIED by snapshot/source comparison — workflow card, playback hook, stylesheet and existing navigation tests remain byte-identical. Only media URLs changed in the two implementation files. Existing route, label, order and pending-feedback contracts pass. |
| Production | NOT VERIFIED for the new mapping — current production was inspected and still uses older URLs. No deployment or push was performed. |
| Generation, editing, persistence and scheduling | NOT TESTED — unaffected by this URL-only change; no provider calls or backend writes. |

Desktop screenshots are 1440×1000; mobile screenshots are 390×844. A production-before screenshot was captured. The controlled old/new desktop comparison temporarily displays the archived poster URLs in the unchanged local card layout and proves equal bounds; it is explicitly an asset comparison, not a captured pre-edit app run. The first local cold compilation took roughly three minutes before interactive checks became available.

## Commands and outcomes

- `npx eslint lib/explore/workflows.ts components/explore/ai-character-card.tsx`: PASS.
- `npx tsc --noEmit --incremental false`: PASS.
- `node --test scripts/verify-ai-character-promo.test.mjs scripts/verify-slideshow-promo.test.mjs scripts/verify-wall-of-text-promo.test.mjs scripts/verify-hook-video-promo.test.mjs scripts/verify-talking-head-promo.test.mjs scripts/explore-navigation-ui.test.mjs scripts/reference-cover-playback.test.mjs`: **42/42 PASS**. The Hook test's older title mentions 10.6s, but its actual assertions and the current export correctly verify 270 frames / 9s; that unrelated title was left unchanged.
- FFprobe metadata/counts, full FFmpeg decode and `tools/video_frames.py --every 0.5`: PASS for all five files.
- Actual Playwright Explore desktop/mobile, loop wrap, reduced motion, offscreen release, failure/poster/recovery, HTTP content type/status/hash and source-preservation checks: PASS.
- Scoped `git diff --check`: PASS.

## Visual receipts

- [Desktop posters](C:/Users/chund/OneDrive/Desktop/UGC/output/remotion-review/explore-cover-activation-2026-11-03/local-reduced-motion-posters.png)
- [Mobile posters](C:/Users/chund/OneDrive/Desktop/UGC/output/remotion-review/explore-cover-activation-2026-11-03/local-after-mobile-posters.png)
- [Desktop active playback](C:/Users/chund/OneDrive/Desktop/UGC/output/remotion-review/explore-cover-activation-2026-11-03/local-after-desktop.png)
- [Failure fallback](C:/Users/chund/OneDrive/Desktop/UGC/output/remotion-review/explore-cover-activation-2026-11-03/failed-video-poster.png)
- [Media audit and hashes](C:/Users/chund/OneDrive/Desktop/UGC/output/remotion-review/explore-cover-activation-2026-11-03/media-audit.json)
- [Source preservation](C:/Users/chund/OneDrive/Desktop/UGC/output/remotion-review/explore-cover-activation-2026-11-03/preservation-checks.json)

Production baseline: `https://www.getugcpilot.com/explore` redirects to `https://vidmake.io/explore?moved=1`. The newly selected covers will reach that site only through a later requested release and production verification.
