# Compressed Explore covers activated locally — 4 November 2026

The five approved compressed covers are now active in local source. No deployment, push or production build. Only five URL substitutions in two source files; original media remains intact. Total video bytes3,891,228→1,588,513(-59.2%).

## Files changed

- lib/explore/workflows.ts: four content-hashed MP4 URLs.
- components/explore/ai-character-card.tsx: one content-hashed MP4 URL.
- public/explore/covers/talking-head-demo-promo-a4aa6e943cf2.mp4 (269855 bytes).
- public/explore/covers/hook-video-promo-31c869823edc.mp4 (282413 bytes).
- public/explore/covers/wall-of-text-promo-e3d92b47d085.mp4 (190829 bytes).
- public/explore/covers/slideshow-promo-f0669968ed21.mp4 (332045 bytes).
- public/explore/covers/ai-character-promo-08c4637b2b16.mp4 (513371 bytes).
- EXPLORE_CONTEXT.md: appended local activation note.
- docs/ai-context/clear.md: appended verification under WORKFLOW-LOAD.
- this receipt.

## Local results

Actual local Explore at1440×1000 in Chrome, without response interception or development preview query: warm cards visible369ms, first-byte152ms, DOM ready310ms, all5videos playing1749ms. Every video reports768×432, muted, loop enabled and no media error. First request cards177539ms/all-playing179303ms included a2.9-minute development compilation and is not a warm performance sample. No causal before/after speedup claim from one warm run.

390×844 mobile: no horizontal overflow, correct four workflow destinations and dark bodyrgb(18,18,18). Reduced-motion change pauses/releases all5video sources. Real local HTTP GETs for each new MP4 returned200 and exact expected byte counts. No JavaScript page errors. Desktop/mobile screenshots manually inspected: unchanged established layout, typography and dark palette. Animated frames differ from the earlier screenshots; no pixel-identical movie-frame claim. Evidence .tmp/activated-covers-local-20261104/results.json,desktop-warm.png,mobile.png and .tmp/activated-covers-local-20261104.log.

## Checks and boundaries

- Existing navigation/playback source tests16/16PASS: node --experimental-transform-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/explore-navigation-ui.test.mjs.
- Full TypeScript: node node_modules/typescript/bin/tsc --noEmit --incremental false,exit0.
- Scoped ESLint on both changed source files:exit0.
- Scoped git diff --check:PASS.
- Executable source comparison against HEAD permits exactly five URL substitutions; all other bytes match after newline normalization. Therefore posters,CSS/classes,dimensions,labels,destinations,playback hook and controls are unchanged.
- New public bytes match approved candidates exactly; all original SHA256s still match. Full media decode,frame counts,durations,30fps,silence,full range,fast-start and card-size visual/SSIM checks were completed during preparation; see docs/explore-cover-compression-review-2026-11-04.md.

No generation/provider,scheduling,authentication,API,worker or hosting changes. New hashed filenames prevent stale old-file caching without overwriting historical assets. Rollback only these5URL substitutions; retain unrelated work and old assets. Local server remains available at http://localhost:3000/explore.

Preflight: supplied AGENTS rules, preflight.py prerequisites PASS,current cover definitions,compression review,protected nonnegotiables/relevant Explore and mistake-memory entries,context-memory/immutable-contracts/UI-clarity/regression-gate procedures and installed Next video guide. Full large historical ledgers were not freshly reread; no claim otherwise. Prior user authorization for local development compilation applied. No production build or deployment.

VERIFIED: local asset selection/bytes/playback, desktop/mobile sanity, reduced-motion, unchanged source outside5URLs,types/lint/navigation tests. NOT VERIFIED: signed-in Slideshow data loading,production activation,universal low-end/high-DPI performance,or resolution of the wider recurring Explore complaint. WORKFLOW-LOAD remains OPEN for those independent issues. This is a verified local cover activation, not an app-wide performance clearance.
