# AI Character cover v3 - 3 November 2026

**LOCALLY VERIFIED.** The 15-second cover now keeps the glossy black 3D cursor throughout pointer travel and every selection. The same six traits are selected from centre, right, left, right, centre and left; each side card moves into the existing hero/dock path. Generate now adapts the existing cover's dark pill, yellow hover glow, warm click flash and press/pop effect. Original timing, recipe, final portrait and model-label-free ending remain.

[Watch v3](C:/Users/chund/OneDrive/Desktop/UGC/output/remotion-review/ai-character-revision-v3-2026-11-03/ai-character-promo-v3.mp4)

## Scope and changed files

- `remotion/AICharacterPromo.tsx`: selected-slot data and image mapping, side-card recentering, matching cursor targets, persistent black cursor, independently preserved stage accents, and Generate feedback. No shared component or other promo source changed.
- `scripts/verify-ai-character-promo.test.mjs`: balanced selection positions, correct source image per slot, pointer hits, recentering, every visible cursor frame, Generate hover/flash/press/pop and retained progress/finale tests.
- `EXPLORE_CONTEXT.md`: current v3 direction and local evidence, superseding older centre-only/selective-cursor direction while retaining history.
- `docs/ai-context/clear.md`: UGC-VID-056 opened before implementation and followed by verified evidence; links UGC-VID-055 and the earlier AI Character UGC-VID-045 entry.
- `docs/ai-character-cover-v3-2026-11-03.md`: this receipt.
- Updated public media: `public/explore/covers/ai-character-promo-v1.mp4`, `public/explore/covers/ai-character-promo-v1.webp`, `public/explore/covers/ai-character-promo-contact-sheet.png`, `public/explore/characters/ai-character-create-yours-v5.mp4`, `public/explore/characters/ai-character-create-yours-v5.webp`.
- Updated standard review contact sheet and 12 milestone PNGs under `output/remotion-review/`. Exact paths, sizes and hashes, plus all v3 review files and snapshots, are enumerated in [delivery-manifest.json](C:/Users/chund/OneDrive/Desktop/UGC/output/remotion-review/ai-character-revision-v3-2026-11-03/delivery-manifest.json).

There are no dependency, schema, application-control, generation-model/prompt/API, worker or scheduling changes. No push/deployment or provider calls were performed. Existing unrelated worktree changes remain.

## Preflight and reference evidence

Re-read the context-memory, immutable-contracts, UI-clarity and regression-gate skills. The frame-analysis, video-prompt and frontend-design skills read earlier remain applicable. Inspected the repository instructions, protected contracts, current Explore/promo incident records, dirty status, v2 source/test snapshots and actual render implementation. `python tools/preflight.py --repo . --task "Correct AI Character cover persistent black 3D cursor varied selection slots and existing Generate effect"` passed required-source discovery/readability.

The new user instruction explicitly supersedes the previous selective 2D/3D cursor and centre-only policy. The attached screenshot is requested-change evidence, not a golden finished-video baseline.

Inspected `HookVideoPromo.tsx`, existing Hook clips, `TalkingHeadDemoPromo.tsx` and its rendered video. The actual existing Generate treatment is the V2B-style button in Talking Head: dark pill, yellow hover/6% scale lift, warm yellow-orange click fill, a press to 0.86 and pop to 1.18. The current HookVideoPromo has no Generate action. The existing Generate source and seven reference frames were examined before adapting the treatment. No shared source was modified to achieve the match.

## Protected behavior and acceptance

| Contract | Status / evidence |
| --- | --- |
| Persistent black, glossy, extruded pointer | VERIFIED - actual component tested at every visible frame 7-349; no white fallback path; full encoded overview and targeted selection frames reviewed. Existing fade/exit retained. |
| Left/centre/right selection | VERIFIED - each position chosen twice; same slot data determines card ordering and pointer hits. Three options before every click; only the intended original trait selected. |
| Recenter, flash and dock | VERIFIED - frame-state tests and 18 exact encoded before/click/after selection frames. Same chosen traits and authentic staged assets. |
| Generate reference feedback | VERIFIED - dark/hover/warm-flash/loading frames reviewed; executable press checks at frames 322/324/330/334 = 1/0.86/1.18/1. Finite shake and separate progress retained. |
| Headlines, recipe stack and odometer | VERIFIED - source sections byte-identical to v2 after newline normalization; recorded hashes. |
| Stage/reveal timing and ending | VERIFIED - selective stage tilt remains independent of permanent cursor depth; click/end times and 450-frame timeline retained. Finale source unchanged; native hold frames 430 and 449 pixel-identical to v2. |
| Final portrait and model-label removal | VERIFIED - original image provenance tests pass; same ending portrait, no Gemini model label. |
| Encoded media and duplicate copies | VERIFIED - 15.000s, 450 frames, 1920x1080, 30fps, H.264, no audio; complete decode exits 0; all MP4 copies match and both posters match. |
| Scaled video presentation | VERIFIED - native and proportional 390px film previews reviewed. This is fixed-aspect video review, not live application responsive acceptance. |
| Neighboring covers / playback contracts | VERIFIED by 38 combined source, component and asset tests; their source files were not edited. |
| Authenticated production / real generation / scheduling | NOT TESTED - outside this film edit; no deployment or provider call. |

Early reveal frame 372 has a tiny 15x17px corner raster difference versus the previous render (mean RGB difference below 0.00014/255). The finale source is unchanged; there is no claim of bitwise equality across every reveal frame. Both final hold images are exactly equal.

## Commands and outcomes

- `npx eslint remotion/AICharacterPromo.tsx scripts/verify-ai-character-promo.test.mjs`: PASS, no warnings/errors.
- `npx tsc --noEmit --incremental false`: PASS.
- `node --test scripts/verify-ai-character-promo.test.mjs scripts/verify-slideshow-promo.test.mjs scripts/verify-wall-of-text-promo.test.mjs scripts/verify-hook-video-promo.test.mjs scripts/verify-talking-head-promo.test.mjs scripts/explore-navigation-ui.test.mjs scripts/reference-cover-playback.test.mjs`: **38/38 PASS**, after exporting the updated media.
- Local Remotion bundle, 55 comparison stills, contact sheets, full 450-frame MP4 and posters: PASS. Rendering used approved local browser access; no remote media generation.
- `python tools/video_frames.py <v3.mp4> --out <review>/final-timeline --every 0.25`: 60 overview samples; both sheets visually inspected. Also decoded and inspected 18 exact selection frames and 8 Generate frames.
- `ffprobe` metadata and `ffmpeg -hide_banner -v error -i <v3.mp4> -f null NUL`: PASS; no decode errors.
- Scoped `git diff --check`: PASS.

MP4: 6,161,570 bytes; SHA-256 `c3f64b6bf284ff46a0c35ec5be4baf186591dcc103d65b875c30db6f95e2d602`.

Poster SHA-256: `d7f27f4cec39f7f3e0d335d0e55c8e3eb71ea124a72d54ba4f121f378720238a`.

## Review and rollback

- [Encoded varied selections](C:/Users/chund/OneDrive/Desktop/UGC/output/remotion-review/ai-character-revision-v3-2026-11-03/encoded-varied-selections.jpg)
- [Encoded Generate effect](C:/Users/chund/OneDrive/Desktop/UGC/output/remotion-review/ai-character-revision-v3-2026-11-03/encoded-generate-motion.jpg)
- [Existing Generate reference](C:/Users/chund/OneDrive/Desktop/UGC/output/remotion-review/ai-character-revision-v3-2026-11-03/generate-reference-detail.jpg)
- [Scaled video review](C:/Users/chund/OneDrive/Desktop/UGC/output/remotion-review/ai-character-revision-v3-2026-11-03/scaled-cover-review.jpg)
- [Preservation evidence](C:/Users/chund/OneDrive/Desktop/UGC/output/remotion-review/ai-character-revision-v3-2026-11-03/preservation-checks.json)
- [Previous v2 video](C:/Users/chund/OneDrive/Desktop/UGC/output/remotion-review/ai-character-revision-v3-2026-11-03/before/ai-character-promo-v1.mp4)

The v3 `before/` directory preserves the previous composition, tests, MP4 and poster. Earlier original/v2 artifacts also remain. If reverting, restore only this task's source/media boundary; preserve unrelated user work and append-only incident history. Production acceptance remains unverified.
