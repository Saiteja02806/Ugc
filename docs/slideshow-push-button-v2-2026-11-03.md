# Slideshow cover — raised Regenerate button

**LOCALLY VERIFIED; not deployed.** Adapted the supplied Button82 style to the Slideshow promotional video: a raised pink face above a dark edge and shadow, a firm press/rebound, and a small splash before the generated slides appear. Removed the filling animation, percentage, shimmer and expanding button oval.

[Watch the updated cover](C:/Users/chund/OneDrive/Desktop/UGC/output/remotion-review/slideshow-push-button-v2-2026-11-03/slideshow-promo-v2.mp4)

The six original source/result slides, card spread/flip timeline, cursor, ending and seven-second duration remain preserved. Existing local Slideshow cover MP4 and review assets are updated; its approved poster remains byte-identical. Other four cover videos are unchanged.

## Scope and changed files

- `remotion/SlideshowPromo.tsx`: replace only `RegenerateActionButton` and related comments. The three layers use the supplied hot-pink face/dark-crimson edge structure; their hover/press/shadow offsets are driven by frames for deterministic export. Twelve droplets appear briefly on release. Labels are Regenerate, Regenerating… and 6 Slides Ready.
- `scripts/verify-slideshow-promo.test.mjs`: execute the real component to check layers, press/shadow offsets, bounded splash, no percentage/filling behavior, reveal order, authentic assets and frozen unaffected frames.
- `remotion/__fixtures__/slideshow-v1-preserved-frames.json`: 145 frozen hashes for frames 0–45 and 111–209, captured from the saved pre-edit source before implementation. The active button window 46–110 is the intentional change boundary.
- `EXPLORE_CONTEXT.md` and `docs/ai-context/clear.md`: current direction and UGC-VID-061 evidence; previous incident history retained.
- `docs/slideshow-push-button-v2-2026-11-03.md`: this receipt.
- Updated public delivery: `public/explore/covers/slideshow-promo-v1.mp4` and `public/explore/covers/slideshow-promo-contact-sheet.png`.
- Updated standard local review: `output/remotion-review/slideshow-promo-contact-sheet.png` and 12 existing `slide-*.png` milestones. Historical filenames containing loading-progress remain compatibility names; the new images have no filling bar.

The unchanged public poster is `public/explore/covers/slideshow-promo-v1.webp`. No dependencies, global styling, shared cursor/component code, real application Generate control, model/prompt/API, worker, schema, scheduling or deployment configuration changed. Other uncommitted work remains intact. Exact paths, hashes, snapshots and generated evidence are in [delivery-manifest.json](C:/Users/chund/OneDrive/Desktop/UGC/output/remotion-review/slideshow-push-button-v2-2026-11-03/delivery-manifest.json).

## Preflight and reference evidence

Read relevant `AGENTS.md` instructions, protected `docs/ai-context/nonnegotiables.md`, current Explore cover decisions and slideshow incidents including INC-20261102-11/12. Read the full context-memory, immutable-contracts, UI-clarity, regression-gate and frame-analysis skills under `.agents/skills/`, plus frontend-design and the installed Next video guide. The large historical context/ledger archives were inspected selectively; this does not claim every archive line was reread.

Inspected dirty status, actual source/tests/callers, shared cursor, render registration, current MP4 and supplied screenshot/CSS. The current video was reviewed through 28 quarter-second overview samples. The screenshot is single-frame evidence; the supplied CSS defines the requested raised/press behavior. `tools/preflight.py` passed required-source discovery/readability. Scope and pre-edit snapshots are saved under the review directory's `scope.md` and `before/`.

The current request explicitly supersedes the old historical filling/ripple requirement solely for this button. It does not request changing the real Slideshow application Generate behavior or recreating media through a provider.

## Protected behavior and verification

| Contract | Result |
| --- | --- |
| Supplied raised style | VERIFIED — separate shadow/edge/front; face offsets idle -10, hover -16, press -4, rebound -18, settled -10. Fixed 472×100 geometry and high-contrast label; native and small-cover views inspected. |
| Click splash instead of filling | VERIFIED — 12 droplets only during frames 71–81, then clear; no load percentage, progress fill, shimmer or button oval. Shared cursor contact feedback remains unchanged. |
| Generated-slide reveal order | VERIFIED — no result image before splash finishes, all six original outputs visible at 112; existing flip/gather/spread timestamps unchanged. |
| Source and ending preservation | VERIFIED — all 145 unaffected component hashes match; header, deck, cylindrical finale and cursor source are unchanged. Final poster bytes remain exactly the same. |
| Authentic assets | VERIFIED — six source and six output staged files match the original v6 assets byte-for-byte. |
| Other covers and routing | VERIFIED — other four cover MP4 hashes unchanged; Explore mapping source unchanged. Existing navigation/playback tests pass. |
| Encoded output | VERIFIED — 7.000s, 210 decoded frames, 1920×1080, 30fps, H.264, no audio; complete decode exits 0; public/review MP4 hashes match. |
| Visual review | VERIFIED — 43 native stills, 28 final quarter-second samples, 36 exact encoded event frames and 390px proportional previews inspected. Sampling is not a claim that every encoded frame was manually inspected. |
| Actual local Explore | VERIFIED — desktop 1440×1000 and mobile 390×844 paused captures at 2.1/2.467/3.733s as applicable; advancing muted inline playback, loop wrap and reduced-motion poster verified. Mobile card 342.4×192.6, no horizontal overflow or media errors. Served MP4 hash matches the checked file. |
| Production, real generation, editing/persistence and scheduling | NOT TESTED — no deployment, provider call or backend write; outside this film-only change. |

## Commands and outcomes

- `npx eslint remotion/SlideshowPromo.tsx scripts/verify-slideshow-promo.test.mjs`: PASS, no warnings/errors.
- `npx tsc --noEmit --incremental false`: PASS.
- `node --test scripts/verify-slideshow-promo.test.mjs`: 6/6 PASS.
- Combined AI/Slideshow/Wall/Hook/Talking Head cover, Explore navigation and reference-playback tests: **46/46 PASS**.
- Local Remotion bundle, native stills and 210-frame full export: PASS. Used a scoped temporary renderer with approved local browser access; did not invoke the original renderer's unrelated recursive cleanup/external backup steps.
- `tools/video_frames.py <updated.mp4> --every 0.25`: 28 samples; sheet inspected. FFmpeg extracted 36 exact event frames for labeled review boards.
- FFprobe metadata/count, full FFmpeg decode, source/asset/poster/video hashes and actual Playwright card checks: PASS.
- Scoped `git diff --check`: PASS.

MP4: 7,484,342 bytes; SHA-256 `16991cb0a2b739354bf98fae6ee3dddd3d6920f530e4797392ea8815ae18e12d`.

Unchanged poster SHA-256: `5bd86885449452b709fddbcad3a199390aea361c865510a099649d696e383aec`.

## Review and rollback

- [Before/after](C:/Users/chund/OneDrive/Desktop/UGC/output/remotion-review/slideshow-push-button-v2-2026-11-03/before-after.jpg) — explicitly compares previous encoded samples with new native stills.
- [Encoded button motion](C:/Users/chund/OneDrive/Desktop/UGC/output/remotion-review/slideshow-push-button-v2-2026-11-03/encoded-button.jpg)
- [Splash through results](C:/Users/chund/OneDrive/Desktop/UGC/output/remotion-review/slideshow-push-button-v2-2026-11-03/encoded-results.jpg)
- [Mobile splash](C:/Users/chund/OneDrive/Desktop/UGC/output/remotion-review/slideshow-push-button-v2-2026-11-03/cover-mobile-splash.png)
- [Mobile results](C:/Users/chund/OneDrive/Desktop/UGC/output/remotion-review/slideshow-push-button-v2-2026-11-03/cover-mobile-results.png)
- [Preservation evidence](C:/Users/chund/OneDrive/Desktop/UGC/output/remotion-review/slideshow-push-button-v2-2026-11-03/preservation-checks.json)

Restore only this task's source/public-video boundary from `before/` if reverting; preserve unrelated work and append-only history. Hosted acceptance remains NOT VERIFIED until a requested release and production check.
