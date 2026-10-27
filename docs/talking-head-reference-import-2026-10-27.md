# Talking Head reference import — 27 October 2026

Status: LOCAL IMPORT VERIFIED; LIVE UPLOAD NOT COMPLETE.

## Scope
Eleven videos from D:/talking head links added in the existing Talking Head + Demo reference format. Ten TikTok links and one Instagram link preserved. One HEVC file (studyfetchlauren) converted to H.264/AAC-compatible playback copy with original duration/resolution; audio copied. Other13 supplied/replacement files copied byte-for-byte. Source files unchanged. No new UI, dependencies, schema, provider calls or publishing actions.

Three requested full versions replace short versions in new gallery discovery:
- Car story:48.500s, folder24/fullvideo_ignore.
- Room explainer:42.027s, folder25/4/fullvideo_ignore.
- Expressive discovery:43.838s, folder37/fullvideo_ignore.

User explicitly authorized these named fullvideo_ignore files. Other ignored files were not imported. Folder37/New folder has a different source link and was not silently treated as the same original. All nine archival catalogue rows, files and identities retained byte-for-byte; new -full IDs preserve old saved-frame hash bindings.23 archival entries,18 visible cards. Existing two fact-check exclusions remain. No Hook or Saved demos catalogue changes.

All23 canonical media/frame hashes verified; exact t=0 PNGs prepared offline. No later anchor introduced. Preview originals retain source speech/text and complete demonstration footage. Existing talking-head generation directions deliberately exclude copied app screens/captions/claims and preserve user script. No claim of full source-demo recreation by the generator. Legacy video-reference30s ceiling retained; long originals preview or use existing starting-frame Recreate mode.

## Verification
-49/49 focused tests PASS: talking-head suites and starting-frame-reference-source.test.ts; no skips.
-TypeScript npx tsc --noEmit PASS.
-Scoped ESLint PASS (final follow-up log checked separately).
-git diff --check PASS (line-ending notice only).
-All14 new/replacement videos decoded completely with ffmpeg -xerror; durations, H.264 codec and audio streams verified. Exact original source hashes and served hashes retained in .tmp/talking-head-additions-20261026/{prepared-media,full-prepared,decode-verification}.json.
-Nine previous catalogue entries confirmed unchanged. Tests assert stable full replacement source links, lengths, archival recovery and all23 frame hashes.
-Reviewed timestamped samples through the ending of all14 clips; this is sampled source screening, not exhaustive frame-by-frame motion qualification or speech transcription. Contact sheets: .tmp/talking-head-additions-20261026/review and full-review.
-Before changes, actual-component full workflow browser PASS at1366x768,1536x864,390x844,320x740: Create/Demo/Schedule, upload, editor and independent audio continuity. Baseline screenshots preserved under .tmp/talking-head-additions-20261026/baseline. Expanded post-import playback browser NOT RUN: automatic approval review could not complete because usage limit was reached. No bypass attempted.
-Signed-in production page reached through in-app browser: old nine-reference gallery visible and Car story preview decodes576x1024 and9.423s with custom controls. This confirms old production playback only, not new content.
-Active production deployment inspected: dpl_HF6A6phBxSDN9aMSpMXcuZ9jHQ5f / c630c66fd19538485cebafe1a254186694459050. No deployment made. Vercel connector subsequently unavailable; read-only CLI project inspect failed fetch. No auth extraction/config changes or broad worktree deployment.

## Protected behavior
VERIFIED locally: canonical source links/platform labels, full media durations, original file preservation, old source/frame bindings, exact t0 frame hashes, only requested replacement cards hidden, no shared layout changes.
NOT TESTED after import: responsive browser playback for18 cards, signed-in new-reference Recreate, generated output quality, live draft persistence, schedule/targets/queue/provider delivery. No new paid generation or social publication.

## Preflight receipt
Read AGENTS.md and inspected Explore context/history and clear ledger sections; nonnegotiables and scheduling contract consulted. Skill files read: ugc-context-memory, ugc-immutable-contracts, ugc-ui-clarity, ugc-frame-analysis, ugc-starting-frame, ugc-video-prompt, ugc-opening-frame-prompt, ugc-scheduling, ugc-regression-gate. Installed Next route-handler guide consulted. Ran python tools/preflight.py --repo . --task actual request. Existing large dirty worktree preserved; no commit/push.

Relevant historical safeguards:UGC-UI-003/005/011/012,UGC-VID-005/008 andUGC-OPS-003. UGC-UI-016 records full-video request; local evidence only, production remains OPEN. No claim that earlier context/ledger bulk reads with truncated output established a complete new historical review.

Rollback boundary: remove only these14 new media/poster/frame triplets and their catalogue/frame rows, revert this task's discovery/source-platform/test hunks; preserve original nine rows and concurrent changes. Files regenerated by prepare-talking-head-frames.mjs retain matching original hashes.

## Files changed by this task
- lib/explore/talking-head-reference-catalog.json
- lib/explore/talking-head-source-manifest.json
- lib/explore/talking-head-frames.json
- lib/explore/talking-head-reference-catalog.ts
- lib/explore/talking-head-reference.ts
- lib/explore/starting-frame-reference-source.test.ts
- scripts/talking-head-references.test.mjs
- scripts/talking-head-references.browser.cjs
- scripts/talking-head-full-sources.test.mjs
- EXPLORE_CONTEXT.md
- docs/ai-context/clear.md
- docs/talking-head-reference-import-2026-10-27.md
- public/explore/talking-head-references/v1/talking-sophia-designsthings.mp4
- public/explore/talking-head-references/v1/talking-sophia-designsthings.jpg
- public/explore/talking-head-frames/v1/talking-sophia-designsthings.png
- public/explore/talking-head-references/v1/talking-emmgr4c3.mp4
- public/explore/talking-head-references/v1/talking-emmgr4c3.jpg
- public/explore/talking-head-frames/v1/talking-emmgr4c3.png
- public/explore/talking-head-references/v1/talking-tessam-bible.mp4
- public/explore/talking-head-references/v1/talking-tessam-bible.jpg
- public/explore/talking-head-frames/v1/talking-tessam-bible.png
- public/explore/talking-head-references/v1/talking-websites-explainer.mp4
- public/explore/talking-head-references/v1/talking-websites-explainer.jpg
- public/explore/talking-head-frames/v1/talking-websites-explainer.png
- public/explore/talking-head-references/v1/talking-katiemeidt8.mp4
- public/explore/talking-head-references/v1/talking-katiemeidt8.jpg
- public/explore/talking-head-frames/v1/talking-katiemeidt8.png
- public/explore/talking-head-references/v1/talking-studyfetchlauren.mp4
- public/explore/talking-head-references/v1/talking-studyfetchlauren.jpg
- public/explore/talking-head-frames/v1/talking-studyfetchlauren.png
- public/explore/talking-head-references/v1/talking-sidghst.mp4
- public/explore/talking-head-references/v1/talking-sidghst.jpg
- public/explore/talking-head-frames/v1/talking-sidghst.png
- public/explore/talking-head-references/v1/talking-studywithsab.mp4
- public/explore/talking-head-references/v1/talking-studywithsab.jpg
- public/explore/talking-head-frames/v1/talking-studywithsab.png
- public/explore/talking-head-references/v1/talking-bittenbyaturtle.mp4
- public/explore/talking-head-references/v1/talking-bittenbyaturtle.jpg
- public/explore/talking-head-frames/v1/talking-bittenbyaturtle.png
- public/explore/talking-head-references/v1/talking-studywithsawyer.mp4
- public/explore/talking-head-references/v1/talking-studywithsawyer.jpg
- public/explore/talking-head-frames/v1/talking-studywithsawyer.png
- public/explore/talking-head-references/v1/talking-mumtipswithginny.mp4
- public/explore/talking-head-references/v1/talking-mumtipswithginny.jpg
- public/explore/talking-head-frames/v1/talking-mumtipswithginny.png
- public/explore/talking-head-references/v1/talking-car-story-full.mp4
- public/explore/talking-head-references/v1/talking-car-story-full.jpg
- public/explore/talking-head-frames/v1/talking-car-story-full.png
- public/explore/talking-head-references/v1/talking-room-explainer-full.mp4
- public/explore/talking-head-references/v1/talking-room-explainer-full.jpg
- public/explore/talking-head-frames/v1/talking-room-explainer-full.png
- public/explore/talking-head-references/v1/talking-discovery-full.mp4
- public/explore/talking-head-references/v1/talking-discovery-full.jpg
- public/explore/talking-head-frames/v1/talking-discovery-full.png
