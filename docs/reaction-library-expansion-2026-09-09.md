# Reaction library expansion — 9 September 2026

Source: `D:/green_mat/new batch`.

22 clips reviewed. 15 clean clips imported and active; 7 held for cleanup. Production catalog increased from 61 to 76 active clips (+24.6%); 19 backgrounds remain active.

The existing v2 process was retained: visual reaction tags in priority order, subject count, composition, bottom-center placement and reviewed height; source SHA-256 identity; alpha validation; existing importer; production database/storage verification. No matcher or rendering code changed.

Every source decoded completely. Actual alpha was sampled at 2 fps and six frames per source were visually reviewed, including the first eight seconds used by production. No exact SHA-256 duplicates were found. Files 09 and 15 use the same underlying cat reaction with different framing; they remain separate assets under the existing checksum-based process.

The import verified source checksums, uploaded object size/type/checksum, and active rows. All 15 persisted mappings passed field-by-field comparison and the existing brief validator and matcher with compatible production backgrounds. The 7 held checksums are absent from production.

The original 61 clips and 19 backgrounds were compared with their previous
reviewed manifest: all remain active and the original clip reaction tags are
unchanged. The new cat holding its head adds the first `facepalm`-tagged clip.
Raw ProRes MOVs are worker inputs; usable customer previews are the resulting
1080×1920 H.264 MP4s.

## Mapping decisions

All filenames below have the suffix `_green_removed_edge_clean_prores4444.mov`, with `(1)` retained where present.

| File | Status | Reactions (primary first) | Subjects | Composition | Height | Review |
| --- | --- | --- | --- | --- | --- | --- |
| 01 (1) | Active | celebration, playful | group | full_body | 90% | Group performs a coordinated upbeat dance; generous transparent padding. |
| 01 | Held | confusion, shock | two | bust | 75% | Visible dark horizontal band across the bottom of the alpha canvas. |
| 02 (1) | Held | facepalm, regret | one | bust | 80% | Subject disappears at approximately 4.5–6.5 seconds and repeatedly later; not suitable for the default first-eight-second render. |
| 02 | Active | facepalm, disappointment | one | bust | 90% | Cat presses paws to its head while opening its mouth; exaggerated frustration. |
| 03 (1) | Active | celebration, unbothered | one | bust | 85% | Woman fans and throws money behind stacks of cash. |
| 03 | Active | playful, unbothered | one | bust | 80% | Boy approaches, gestures and smiles; framing changes from full body to bust. |
| 04 (1) | Active | celebration, playful | two | full_body | 75% | Two people dance in matching outfits. Final blank tail is after the eight-second production window. |
| 04 | Held | disappointment, regret | one | close_up | 72% | Visible vertical border lines remain in the transparent canvas. |
| 05 | Active | disappointment, concern | two | bust | 90% | Interview reaction changes from two people to one person with a strained sympathetic expression. |
| 06 | Active | laughter, playful | two | bust | 90% | Two men laugh, bend forward and cover their faces; generous transparent padding. |
| 07 | Held | laughter, celebration | one | bust | 75% | Strong magenta halo along hair, shoulders and arms. |
| 08 | Active | playful, unbothered | two | bust | 90% | Two seated men sway and move rhythmically. |
| 09 | Active | shock, confusion | one | full_body | 72% | Wide-eyed seated cat turns with an open mouth. Same underlying reaction as file 15, with different framing. |
| 10 | Active | side_eye, deadpan | one | close_up | 75% | Cat gives a sustained unimpressed stare and slight sideways glance. |
| 11 | Active | confusion, concern | group | full_body | 75% | Child looks uncertain while several adults lean in, point and react. |
| 12 | Held | side_eye, confusion | one | close_up | 75% | CapCut watermark and an opaque black background near the end. |
| 13 | Active | side_eye, confusion | one | close_up | 90% | Child tastes food, wrinkles their face and gives a sideways look. |
| 14 | Active | disappointment, regret | one | close_up | 65% | Close-up of a crying person with an open mouth; square source requires conservative scale. |
| 15 | Active | shock, confusion | one | bust | 78% | Wide-eyed open-mouthed cat with a tighter zoom than file 09. |
| 16 | Active | side_eye, concern | one | close_up | 72% | Dog alternates sideward and frontal uneasy wide-eyed looks. |
| 17 | Held | shock, concern | one | bust | 85% | CapCut watermarks and full-height vertical border lines. |
| 18 | Held | playful, celebration | one | full_body | 75% | Visible purple outline along clothing, arms and legs. |

## Verification artifacts

- Reviewed manifest: `scripts/data/reaction-assets-2026-09-09.json`.
- Import result: `.tmp/reaction-asset-import/2026-09-09T04-16-34-555Z-execute.json`.
- Source inspection and motion sheets: `.tmp/reaction-batch-2026-09-09/`.
- Production canary plans/results: same review directory.
- Existing importer, manifest and batch-matcher tests: 19 passed.

Production canaries use the existing isolated `hook-v6-locked-canary` account, three jobs of five clips, validated deterministic captions, the existing matcher, and the live `https://getugcpilot.com/api/internal/jobs/launch-render` endpoint. This verifies exact new assets without relying on random selection from the whole catalog. These are internal preview renders; nothing is scheduled for social publishing.

## Final production result

All 15 new clips rendered successfully through the deployed worker. All three five-clip jobs completed with `readyCount = 5`, `failedCount = 0`, and no shortfall. All 15 creatives are `preview_ready` with final media assets and HTTPS previews.

The 15 final MP4s were downloaded from production, decoded completely without errors, and verified as H.264/yuv420p, 1080×1920, 30 fps, with duration matching the persisted render plan. Contact sheets were visually checked for caption placement and foreground composition. Verification completed at 2026-09-09T04:30:20.702Z.

Jobs:
- `cfba0dca-4c4f-456d-9490-4408ef9c1180`
- `2b676324-b47a-4c6a-8cc4-8ef53c55ad4d`
- `3f168224-e44f-40ad-8dd7-23bcaac172b8`

Detailed output receipt: `.tmp/reaction-batch-2026-09-09/production-render-verification.json`.

This acceptance check covers exact-asset eligibility, persisted mapping, production storage integrity, the live render-launch endpoint, deployed worker compositing, ready-media persistence and final MP4 decoding/visual review. Captions were deterministic QA inputs passed through the existing validation/matching boundary; a new AI copy-generation request and authenticated customer swipe/scheduling actions were not part of this asset-import verification.

No deployment is required for these catalog additions. The source manifest, context update and report are saved locally; no Git push was requested.
