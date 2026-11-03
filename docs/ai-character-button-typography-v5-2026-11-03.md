# AI influencer cover v5 — Generate and ending typography

**LOCALLY VERIFIED; not deployed.** Refined the AI influencer cover using the five supplied motion references. Generate now has a larger label, a distinct percentage/progress track and a yellow circular two-spark action. The black cursor presses the action, which compresses, releases with one brief square-pixel burst and settles. The ending reads **BUILD YOUR / OWN AI / INFLUENCER** in condensed Anton with a short perspective reveal and a stable final hold.

[Watch v5](C:/Users/chund/OneDrive/Desktop/UGC/output/remotion-review/ai-character-button-type-v5-2026-11-03/ai-character-promo-v5.mp4)

The first ten seconds, selected settings, original portrait, 15-second duration and other four covers remain preserved. Existing local AI cover MP4/poster copies are updated. A reproduced stale optimized-poster cache was fixed with a content-hashed poster filename so reduced-motion fallback also shows the new title.

## Scope and changed files

- `remotion/AICharacterPromo.tsx`: Generate graphics/effects, Generate-only cursor targets, left finale typography and conditional use of the existing bundled Anton font. Preserve the exact selection output for frames 0–299 and original right portrait source.
- `scripts/verify-ai-character-promo.test.mjs`: update intentionally superseded ending assertions; freeze selection behavior and test circular action, bounded burst/press/shake, legible progress, title wording and settled glyphs.
- `remotion/__fixtures__/ai-character-v4-selection.json`: 300 frozen selection markup hashes captured from the saved pre-edit v4 source. The old v3 ending fixture remains historical and unchanged.
- `components/explore/ai-character-card.tsx`: only the poster constant changes to `/explore/covers/ai-character-promo-2f03e6253d30.webp`. Video URL, links, layout and playback calls stay unchanged.
- `scripts/explore-navigation-ui.test.mjs`: check native/optimized poster agreement and that the poster filename hash matches its bytes.
- `EXPLORE_CONTEXT.md` and `docs/ai-context/clear.md`: current direction, UGC-VID-059 and UGC-VID-060 evidence; append-only incident history retained.
- `docs/ai-character-button-typography-v5-2026-11-03.md`: this receipt.
- Updated public files: `public/explore/covers/ai-character-promo-v1.mp4`, `ai-character-promo-v1.webp`, `ai-character-promo-contact-sheet.png`, `public/explore/characters/ai-character-create-yours-v5.mp4`, `ai-character-create-yours-v5.webp`.
- New public poster: `public/explore/covers/ai-character-promo-2f03e6253d30.webp` (105,046 bytes).
- Updated standard local contact sheet and 12 existing `aichar-*.png` milestone files under `output/remotion-review/`.

Exact paths, hashes, snapshots and all generated review artifacts are enumerated in [delivery-manifest.json](C:/Users/chund/OneDrive/Desktop/UGC/output/remotion-review/ai-character-button-type-v5-2026-11-03/delivery-manifest.json). Other uncommitted work was preserved. No new dependencies, global styles, real application Generate behavior, models/prompts/APIs, schema, worker, scheduling or deployment configuration changed.

## Sources and preflight

Read relevant `AGENTS.md` instructions, protected `docs/ai-context/nonnegotiables.md`, current Explore/promo decisions and applicable incident entries. The large Explore/ledger archives were inspected selectively; this is not a claim of rereading every archival line. Read the context-memory, immutable-contracts, UI-clarity, frame-analysis, video-prompt and regression-gate skills under `.agents/skills/`, plus the local frontend-design skill. Inspected dirty status, source/callers, existing tests, render registration and the previous v4 film. Read installed Next video guidance and the Image localPatterns guidance during the cache correction.

`tools/preflight.py` passed required-source discovery/readability. The edit boundary and later necessary poster fix are recorded in `scope.md`; pre-edit sources and MP4/poster are preserved under `before/`.

All five references were accessible and actually inspected: 233 quarter-second overview samples plus 54 native-timestamp samples around button/type events. The four-second Higgsfield clip provides circular press and square-burst inspiration. The FLAVOR and EXTEND clips provide condensed hierarchy and folding motion; the Arcjet clip provides measured text reveals, and the cursor clip action→confirmation pacing. Source filenames do not always describe their actual content. Visible prompt strings in reference pixels were treated as source content, never assistant instructions. No reference audio is copied. [Reference analysis](C:/Users/chund/OneDrive/Desktop/UGC/output/remotion-review/ai-character-button-type-v5-2026-11-03/references/analysis.md) records metadata, coverage and uncertainties.

The user's new request explicitly supersedes the prior v3/v4 ending freeze for the Generate and left title portions. Other protected contracts remain.

## Verification

| Contract | Status and evidence |
| --- | --- |
| First ten seconds and recipe | VERIFIED — all 300 component-output hashes match v4; original BEATS, recipe stack and selection study source unchanged. Varied slots, three choices, secondary settings and clean handoff tests pass. |
| Persistent black 3D cursor | VERIFIED — every visible frame 7–349 tested. Existing geometry retained; only Generate approach/hit coordinates change after the preserved frame300 handoff. |
| Generate feedback | VERIFIED — 0.82 press, 1.13 release, finite shake, 28 squares only during 325–338, separate monotonic 8→100% progress and final confirmation. Native and encoded event frames reviewed; label/progress remain separate. |
| Typography | VERIFIED — 26 glyphs in three rows, no invalid transforms; perspective entrance settles to `transform:none` at 398. Native, encoded and actual paused card captures reviewed without overlap/clipping. Small supporting copy remains secondary at cover size. |
| Original portrait and model-label removal | VERIFIED — right-side source byte-identical, same staged outcome image, same portrait animation/timing and no Gemini label. |
| Raster preservation | VERIFIED with limits — native selection frames 73/121/167/219/269 pixel-identical to prior render; 27/299 show tiny edge differences (largest mean channel difference about 0.00115/255). Portrait comparisons show only tiny corner raster differences; no claim of universal pixel/encoded-bit equality. |
| Other covers and Explore routing | VERIFIED — four other MP4 hashes unchanged; workflow mapping/shared typography source unchanged. Card source differs only in poster URL. Existing navigation/playback contracts pass. |
| Poster cache and reduced motion | VERIFIED — fresh Next Image optimization uses the new content-hashed asset and visually shows the new title; native poster matches. Reduced motion releases the video and shows that fallback. |
| Actual local cards | VERIFIED — 1440×1000 and 390×844 captures at 11.133s and 14.333s; playback resumes, remains muted/looping, and wraps after 15s without media errors. Mobile card remains 342.4×192.6 with no horizontal overflow. |
| Export | VERIFIED — 450 decoded frames, 15.000s, 1920×1080, 30fps, H.264, no audio. Complete decode exits 0. Three MP4s and poster copies match. Local HTTP serves the checked MP4 hash. |
| Hosted acceptance, real generation and scheduling | NOT TESTED — no deployment, provider call or backend write. |

UGC-VID-060 was caught during final browser review: the raw poster was new but its optimized image was cached. An initial query-string revision was rejected by this installed Next loader and temporarily reached the local error boundary. That attempt was removed. The final content-hashed filename fixes the stale image without configuration changes; fresh browser verification shows zero console errors. Earlier test-induced error/cache screenshots remain as diagnostic evidence, not final acceptance.

## Commands and outcomes

- `npx eslint remotion/AICharacterPromo.tsx components/explore/ai-character-card.tsx scripts/verify-ai-character-promo.test.mjs scripts/explore-navigation-ui.test.mjs`: PASS, no warnings/errors in final source.
- `npx tsc --noEmit --incremental false`: PASS.
- Combined existing AI/Hook/Wall/Slideshow/Talking Head cover, Explore navigation and reference-playback suite: **43/43 PASS** after final implementation/export.
- Local Remotion bundle, native still review and full 450-frame export: PASS. Used a scoped temporary renderer with approved local browser access; no unrelated cleanup/external backup steps were invoked.
- `tools/video_frames.py <v5.mp4> --every 0.25`: 60 overview samples; both sheets visually inspected. Also extracted 36 exact encoded event frames and reviewed native/encoded 390px previews.
- FFprobe frame/stream metadata, complete FFmpeg decode, duplicate hash and source-preservation checks: PASS.
- Actual Playwright card playback, frame-accurate paused captures, loop wrap and optimized-poster/reduced-motion checks: PASS on final content-hashed path.
- Scoped `git diff --check`: PASS.

MP4: 6,585,318 bytes; SHA-256 `8537f7eb4fd9c8fa2e65427699fa9624d711c8f52299039d5aab3350b6572fda`.

Poster SHA-256: `2f03e6253d30ab30ddec858acfcbffc30ab4f0d4e2781cecc909e865e04c7ba3`.

## Visual evidence and rollback

- [Before/after](C:/Users/chund/OneDrive/Desktop/UGC/output/remotion-review/ai-character-button-type-v5-2026-11-03/before-after.jpg)
- [Encoded Generate motion](C:/Users/chund/OneDrive/Desktop/UGC/output/remotion-review/ai-character-button-type-v5-2026-11-03/encoded-generate.jpg)
- [Encoded title motion](C:/Users/chund/OneDrive/Desktop/UGC/output/remotion-review/ai-character-button-type-v5-2026-11-03/encoded-title.jpg)
- [Final mobile poster](C:/Users/chund/OneDrive/Desktop/UGC/output/remotion-review/ai-character-button-type-v5-2026-11-03/cover-mobile-poster-v5.png)
- [Final mobile title frame](C:/Users/chund/OneDrive/Desktop/UGC/output/remotion-review/ai-character-button-type-v5-2026-11-03/cover-mobile-title-v5.png)
- [Final mobile Generate frame](C:/Users/chund/OneDrive/Desktop/UGC/output/remotion-review/ai-character-button-type-v5-2026-11-03/cover-mobile-generate-v5.png)
- [Preservation checks](C:/Users/chund/OneDrive/Desktop/UGC/output/remotion-review/ai-character-button-type-v5-2026-11-03/preservation-checks.json)

Rollback only this task's source/public-media boundary from `before/` and the prior v4 artifact directory; preserve unrelated work and append-only history. The old local poster aliases remain available. Keep future poster filenames tied to their content rather than overwriting a previously hashed name. Production remains NOT VERIFIED until a requested release and hosted check.
