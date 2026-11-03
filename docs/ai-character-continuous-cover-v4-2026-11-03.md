# Continuous AI Character cover v4 — 3 November 2026

**LOCALLY VERIFIED.** Finished the already built three-second selection study into the complete fifteen-second cover. The first ten seconds now scroll one continuous panel through all six original groups. Each group presents three choices; the selected positions are centre, right, left, right, centre and left. The glossy black cursor follows the same camera coordinates as the choices. Selected settings accumulate on the left and hand off cleanly into the original Generate sequence.

[Watch the finished video](C:/Users/chund/OneDrive/Desktop/UGC/output/remotion-review/ai-character-continuous-v4-2026-11-03/ai-character-promo-v4.mp4)

The Generate button, click feedback, progress, portrait and influencer-building ending from frames 300–449 retain the exact v3 component output. The ending has no Gemini label. Duration remains 450 frames at 30fps, 1920×1080, silent. No deployment was performed.

## Scope and every changed file

- `remotion/AICharacterSelectionStudy.tsx`: share the existing study panel with a full-cover mode; add six-group camera/cursor travel, detail headers, accumulated selections and the ending handoff. The original 90-frame two-pick study remains available.
- `remotion/AICharacterPromo.tsx`: derive the continuous-flow data from the existing original BEATS and render it for frames 0–299. Preserve the old Generate/finale branch from300 onward.
- `scripts/verify-ai-character-promo.test.mjs`: test real component output for three choices, balanced selected positions, authentic assets, pointer hits, every visible black-cursor frame, secondary settings, clean summary transition, study behavior and retained ending.
- `remotion/__fixtures__/ai-character-v3-ending.json`: frozen SHA-256 component-markup hashes for every frame300–449, captured from the saved pre-edit v3 source. Tests do not regenerate this fixture.
- `EXPLORE_CONTEXT.md`: record the current continuous-flow direction and local acceptance evidence.
- `docs/ai-context/clear.md`: append UGC-VID-057 before correcting the observed overlapping summaries; append the verification evidence afterward. Earlier incidents remain intact.
- `docs/ai-character-continuous-cover-v4-2026-11-03.md`: this receipt.
- Public media: `public/explore/covers/ai-character-promo-v1.mp4`, `public/explore/covers/ai-character-promo-v1.webp`, `public/explore/covers/ai-character-promo-contact-sheet.png`, `public/explore/characters/ai-character-create-yours-v5.mp4`, `public/explore/characters/ai-character-create-yours-v5.webp`.
- Standard local review outputs: `output/remotion-review/ai-character-promo-contact-sheet.png` and the 12 existing `aichar-*.png` milestone files. The exact paths and hashes are in the manifest below.

All generated snapshots, review frames, temporary rendering/verification scripts, exact encoded-frame manifest, metadata and delivery files are enumerated in [delivery-manifest.json](C:/Users/chund/OneDrive/Desktop/UGC/output/remotion-review/ai-character-continuous-v4-2026-11-03/delivery-manifest.json). Other pre-existing worktree changes were preserved. No dependencies, application controls, shared layout, model/prompt/API, worker, schema or scheduling code changed.

## Preflight and source evidence

Read repository instructions, the full protected `docs/ai-context/nonnegotiables.md`, relevant current Explore/promo sections of `EXPLORE_CONTEXT.md`, and applicable historical ledger entries in `docs/ai-context/clear.md`. The large Explore context and ledger archives were inspected selectively; this is not a claim that every historical line was read. Inspected dirty status, current/source callers, render registration, tests, v3 output and the already built study and its native/390px review images. The scope contract and pre-change snapshots are under the review directory's `scope.md` and `before/`.

Skills actually read and applied: `.agents/skills/ugc-context-memory/SKILL.md`, `ugc-immutable-contracts/SKILL.md`, `ugc-ui-clarity/SKILL.md`, `ugc-frame-analysis/SKILL.md`, `ugc-video-prompt/SKILL.md`, and `ugc-regression-gate/SKILL.md`. The Vercel React best-practices skill was read for the two TSX files. The earlier reference pass also read the frontend-design and PDF skills. The local bundled Next documentation index was inspected; no Next APIs were edited.

`python tools/preflight.py --repo . --task <finish existing continuous selection study into full AI Character cover>` passed required-source discovery/readability. Its output is saved as `preflight.txt`; discovery alone is not runtime verification.

The supplied Higgsfield video was previously reviewed through 46 quarter-second samples and 44 native-timestamp samples; its feasibility analysis remains in `output/remotion-review/higgsfield-selection-feasibility-2026-11-03/feasibility.md`. The resulting direction is a continuous selector, restrained scroll blur and accumulated choices, followed by the existing ending. The supplied PDF/screenshots are reference evidence; the latest user request authorizes completing the current build.

## Protected behavior and acceptance

| Contract | Status and evidence |
| --- | --- |
| Three choices and varied positions | VERIFIED — six active groups, same authentic selected assets, centre/right/left/right/centre/left ; 18 exact encoded before/click/after frames reviewed. Each position is chosen twice. |
| Original selected recipe and secondary settings | VERIFIED — original gender/age, skin, eyes/iris, hair colours and outfit/framing are retained; component checks cover their original appearance times. Asset provenance and exact final portrait tests pass. |
| Continuous panel, selected flash and accumulated settings | VERIFIED — camera focus and scale tests, native stills and 60 encoded overview samples; inactive choices dim and selected cards retain the study's yellow flash/check treatment. |
| Persistent glossy black 3D cursor | VERIFIED — every visible frame7–349 tested; click targets use the same camera transform as the panel; frame299→300 continuity is under 1px. No white fallback. |
| Summary handoff | VERIFIED — no simultaneous summary text opacity at any frame284–299; native and encoded transition frames reviewed. UGC-VID-057 corrected. |
| Generate and ending, frames 300–449 | VERIFIED — all 150 component-markup hashes exactly match frozen v3. Existing dark pill, hover, warm flash, finite shake, press/pop, progress, portrait and label removal pass tests and encoded-frame review. |
| Native ending image comparison | VERIFIED for sampled comparisons — frames 312/322/324/330/334/344/352/449 pixel-identical. Frames 318/372/430 show only tiny raster differences with mean channel difference below 0.00014/255. No claim of universal pixel/encoded-bit equality. |
| Original isolated study | VERIFIED — default two picks and next-group preview tested; fresh before/current renders at 38/70/89 are pixel-identical. Its older cached preview images differ from the saved source, so the same-environment source comparison is the preservation evidence. Raw markup differs in nonvisual instrumentation/layout declarations; it is not asserted byte-identical. |
| Media delivery | VERIFIED — 15.000s, 450 decoded frames, 1920×1080, 30fps, H.264, no audio; full decode exits 0; all MP4 copies and both poster copies match. |
| Smaller cover presentation | VERIFIED — proportional 390px previews inspected for all groups, handoff, Generate and finale. This is fixed-aspect film review, not live application responsive acceptance. Small summary text is supporting detail; the active choices remain the primary visual. |
| Neighboring covers and playback/navigation contracts | VERIFIED by the combined 42-test source/component/asset suite. No neighboring cover source was edited. This does not claim a real authenticated browser walkthrough. |
| Real application generation, backend persistence, scheduling and production playback | NOT TESTED — outside this deterministic cover edit; no provider calls or deployment. |

## Commands and outcomes

- `npx eslint remotion/AICharacterPromo.tsx remotion/AICharacterSelectionStudy.tsx scripts/verify-ai-character-promo.test.mjs`: PASS.
- `npx tsc --noEmit --incremental false`: PASS.
- `node --test scripts/verify-ai-character-promo.test.mjs`: 13/13 PASS.
- `node --test scripts/verify-ai-character-promo.test.mjs scripts/verify-slideshow-promo.test.mjs scripts/verify-wall-of-text-promo.test.mjs scripts/verify-hook-video-promo.test.mjs scripts/verify-talking-head-promo.test.mjs scripts/explore-navigation-ui.test.mjs scripts/reference-cover-playback.test.mjs`: **42/42 PASS**, after final export.
- Local Remotion bundle, native comparison stills, corrected handoff stills and full 450-frame export: PASS. Rendering used approved local browser access and a scoped temporary renderer; the original renderer's unrelated recursive cleanup/external backup behavior was not invoked.
- `python tools/video_frames.py <v4.mp4> --out <review>/final-timeline --every 0.25`: 60 frames extracted; both full-timeline contact sheets visually inspected.
- FFmpeg exact frame extraction: 36 event frames covering all selections, handoff, Generate and ending; labeled boards and 390px previews inspected.
- `ffprobe -v error -count_frames -show_streams -show_format -of json <v4.mp4>` and `ffmpeg -hide_banner -v error -i <v4.mp4> -f null NUL`: PASS; metadata and decode receipt saved.
- Saved-source/current isolated-study renders at 38/70/89: exact pixel equality, recorded in `study-snapshot-pixel-checks.json`.
- Scoped `git diff --check`: PASS; only the repository's existing LF/CRLF notices.

MP4: 6,633,961 bytes; SHA-256 `7f7607db5674e55f5f908a517fdce9d35c4b65d726a839164c3649cafa1917f8`.

Poster SHA-256: `cd34cfa062924eff1961c57ebe3969664aa30776dd237873a169f30fcd5c4a71`.

## Review and rollback

- [Encoded selections](C:/Users/chund/OneDrive/Desktop/UGC/output/remotion-review/ai-character-continuous-v4-2026-11-03/encoded-varied-selections.jpg)
- [Corrected encoded handoff](C:/Users/chund/OneDrive/Desktop/UGC/output/remotion-review/ai-character-continuous-v4-2026-11-03/encoded-handoff.jpg)
- [Preserved Generate and finale](C:/Users/chund/OneDrive/Desktop/UGC/output/remotion-review/ai-character-continuous-v4-2026-11-03/encoded-generate-ending.jpg)
- [390px proportional previews](C:/Users/chund/OneDrive/Desktop/UGC/output/remotion-review/ai-character-continuous-v4-2026-11-03/scaled-390-review.jpg)
- [Native ending comparison evidence](C:/Users/chund/OneDrive/Desktop/UGC/output/remotion-review/ai-character-continuous-v4-2026-11-03/ending-pixel-checks.json)
- [Previous v3 video](C:/Users/chund/OneDrive/Desktop/UGC/output/remotion-review/ai-character-revision-v3-2026-11-03/ai-character-promo-v3.mp4)

Rollback boundary: restore only this task's source/public-media snapshots from `before/`, preserving unrelated worktree edits and append-only incident history. Native rendering can have negligible edge raster differences even when component output is exact. Final authenticated production playback remains NOT VERIFIED until a requested deployment and production check.
