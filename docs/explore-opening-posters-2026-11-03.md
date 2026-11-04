# Explore cover opening posters — 3 November 2026

Implemented locally. No build, development server, push, deployment or generation.

## Change

All five Explore loading posters now use lossless WebP made from the first decoded frame of their existing video. New content-addressed names avoid stale cached posters; old assets remain available. Only the four coverPoster values in lib/explore/workflows.ts and the CHARACTER_POSTER constant in components/explore/ai-character-card.tsx changed. The latter constant supplies both its image layer and video poster. No video, CSS, layout, autoplay/hovers, navigation, saved edits, source prompts, audio, generation or scheduling behavior changed.

New asset files:
- `public/explore/covers/talking-head-demo-promo-opening-7c934e951780.webp` (36992 bytes)
- `public/explore/covers/hook-video-promo-opening-5532968569bd.webp` (58632 bytes)
- `public/explore/covers/wall-of-text-promo-opening-dd074765077d.webp` (43838 bytes)
- `public/explore/covers/slideshow-promo-opening-200b809f68f2.webp` (45360 bytes)
- `public/explore/covers/ai-character-promo-opening-5d3b46093a26.webp` (44862 bytes)

Other files: scripts/explore-opening-posters.test.mjs; this receipt; append-only EXPLORE_CONTEXT.md and docs/ai-context/clear.md incident UGC-UI-20261103-EXPLORE-RETURN-POSTER-FLASH updates. Existing unrelated worktree changes preserved.

## Evidence and verification

- Previous recording inspected at4fps across11.433seconds, with15fps near initial return. Original poster versus actual opening confirmed different compositions. Comparison .tmp/workflow-flash-20261103/poster-before-after.png inspected: left old poster/right matched opening for all five. New posters may show the video's intentional opening blur; that is part of matching the real opening, rather than substituting a sharp later frame.
- All five new WebP pixel buffers exactly equal FFmpeg's first-frame PNG RGB buffers at960x540. Each below100KB. All five video SHA256 hashes unchanged. Old assets retained; rollback needs only restoring five poster references.
-14direct Node tests PASS: explore-opening-posters, explore-cover-budget, reference-cover-playback, explore-reference-preview and reference-video-player. Coverage includes video-size/faststart budgets, source fallback, reduced motion, focus/hover/visibility and unchanged reference action separation.
- Scoped ESLint PASS: lib/explore/workflows.ts, components/explore/ai-character-card.tsx, scripts/explore-opening-posters.test.mjs. Scoped git diff --check PASS.
- Preflight PASS. Used context-memory, immutable-contracts, UI-clarity, frame-analysis and regression-gate skills already read; relevant Explore/history under existing scoped-history authorization, protected contracts and Next Image guide node_modules/next/dist/docs/01-app/03-api-reference/02-components/image.md consulted. First attempted .mdx guide path was absent; actual .md guide located/read. No Image API changed.

## Limits

VERIFIED: exact opening/poster asset match, unchanged video bytes and unchanged layout/playback implementation. NOT TESTED: fresh authenticated hosted return navigation and actual desktop/mobile end-to-end appearance after deployment. No new browser fixture or application build started. This removes the confirmed poster-to-opening composition mismatch; does not promise elimination of every network/rendering delay or natural video cut.
