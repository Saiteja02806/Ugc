# Reviewed content import — 30 September 2026

Production verification completed at 2026-09-30T17:01:25.778Z.

Imported **10 unique hooks** and **11 Wall backgrounds**. **Nine Wall backgrounds are active; two are stored inactive for placement review.** Six other Wall files were not uploaded, and one exact hook duplicate was skipped. Existing library content and configuration were preserved.

## Sources and processing

- Wall: `C:/Users/chund/OneDrive/Desktop/WOT_real/notbeen/notbeen` — 17 supplied MP4s.
- Hook: `C:/Users/chund/OneDrive/Desktop/hook videos/notbeen` — 11 supplied MP4s, 10 exact unique sources.
- The user approved the content. Technical validation and tagging were performed locally before production writes.
- Every supplied file decoded completely. All supplied files were 720×1280 H.264 and contained an audio stream. Silent derivatives were prepared using `-map 0:v:0 -c:v copy -an -map_metadata -1 -movflags +faststart`; encoded video-packet SHA-256 checks confirmed that video packets were unchanged. No video was looped, slowed, padded, or re-encoded. All originals remain at their original paths.
- Prepared hashes differ from original hashes because their audio/container data differ. Both hashes and original names are recorded in the reviewed manifests and preparation receipt. No prepared hash matched an existing production row.
- Five frames per source were reviewed: start, 20%, middle, 80%, and near-end. Wall sources with unrelated branded demo footage before six seconds were excluded because the existing Wall flow requires a background-only clip of at least six seconds.

## Established upload path

GCP is the final object store. Raw supplied files were not bulk-uploaded directly. Local checks, silent preparation, reviewed mappings and dry runs preceded the existing importers. The Hook importer first imported a three-video canary; the Wall importer first imported one background. Both then resumed the remaining batch without replacing existing rows.

The importers create processing/inactive records, upload the MP4 and 360×640 WebP thumbnail to batch-specific keys, verify the objects, and activate complete records. Wall placement review is then persisted only for new batch/hash targets. The two placement holds have both `status=inactive` and `placement_analysis=null`; they cannot appear through active-only inventory queries. Final verification caught their initial active flags and the flags were corrected before acceptance.

Hook originals use the existing Dynamic audio path after preparation; no per-video audio lock was added. The existing reaction-to-writing-format rules remain unchanged. Approved audio selection was checked for each new hook with a representative eight-second demo, and for each active Wall at its native duration. Actual customer copy and demo length still determine the soundtrack selected for each later composition.

## Hook mappings

Reaction tags: shock_surprise: 6; confidence_approval: 1; concern_anxiety: 2; amusement_laughter: 1.

Visual groups: indoor_selfie_medium: 3; desk_laptop_reaction: 4; indoor_selfie_closeup: 1; bedroom_reaction: 1; headphones_reaction: 1.

Each new file uses its own conservative provisional creator key (`creator_062`–`creator_071`), following the established generated-face identity policy. Existing creator identities were not merged or changed.

| File | Reaction tag | Visual group | Text position | Duration |
| --- | --- | --- | --- | --- |
| Face_swap_video_editing_instruct_20260928144705-Vmake (online-video-cutter.com).mp4 | shock_surprise | indoor_selfie_medium | below_face | 3.292s |
| Face_swap_video_editing_instruct…_202608291207.mp4 | confidence_approval | desk_laptop_reaction | below_face | 1.917s |
| Perform_face_swap_and_background_20260928145402-Vmake (online-video-cutter.com).mp4 | shock_surprise | indoor_selfie_closeup | above_head | 4.875s |
| Perform_face_swap_and_replicate_202608291213.mp4 | concern_anxiety | indoor_selfie_medium | above_head | 8.792s |
| Perform_video_face_swap_and_20260928144900-Vmake (online-video-cutter.com).mp4 | shock_surprise | desk_laptop_reaction | above_head | 2.917s |
| Remove_text_swap_face_202608212145.mp4 | amusement_laughter | bedroom_reaction | above_head | 1.792s |
| Swap_face_and_replicate_actions_202608291207.mp4 | shock_surprise | desk_laptop_reaction | above_head | 3.875s |
| Video_face_swap_and_editing_20260928144913-Vmake (online-video-cutter.com).mp4 | shock_surprise | desk_laptop_reaction | above_head | 3s |
| Video_face_swap_editing_instruct_20260928144908-Vmake (online-video-cutter.com).mp4 | shock_surprise | headphones_reaction | above_head | 4.959s |
| watermark-removed-Swap_face_and_replicate_actions_202608291212.mp4 | concern_anxiety | indoor_selfie_medium | above_head | 10s |

## Wall mappings

Active visual groups: indoor_medium: 4; indoor_closeup: 3; outdoor_walking_selfie: 1; outdoor_static_selfie: 1. The active sources play once at their native duration, 6.016–10 seconds. They use the existing lower-middle zone, with multiframe eight-line 50px placement proofs. The existing v2 placement schema and manual-review override are retained; no placement algorithm was deployed.

The representative-frame analyzer does not detect every tilted or changing face reliably. Manual review therefore adjusted placement and kept two difficult close-ups inactive. This review is evidence for these clips, not a guarantee for arbitrary future text.

| File | Visual group | Status | Duration |
| --- | --- | --- | --- |
| Face_swap_and_video_editing_20260918235257 (2).mp4 | indoor_medium | active | 7.834s |
| Perform_face_swap_and_edit_202608212149-Vmake.mp4 | indoor_closeup | active | 7.834s |
| Perform_face_swap_and_edit_20260919000153 (2).mp4 | indoor_medium | active | 7.5s |
| Perform_face_swap_in_video_20260925161944-Vmake.mp4 | outdoor_walking_selfie | active | 6.834s |
| Perform_video_face_swap_and_20260925161936-Vmake.mp4 | indoor_closeup | active | 8s |
| Swap_face_and_edit_video_20260918235536 (3).mp4 | outdoor_static_selfie | active | 10s |
| Swap_face_in_video_20260925161523-Vmake.mp4 | indoor_medium | active | 8s |
| Swap_face_in_video_20260925161846-Vmake.mp4 | indoor_closeup | inactive | 8s |
| Video_face_swap_and_edit_20260925161920-Vmake.mp4 | indoor_closeup | inactive | 8s |
| Video_face_swap_and_edit_20260925161940-Vmake.mp4 | indoor_closeup | active | 8s |
| Video_face_swap_and_editing_20260925161906-Vmake.mp4 | indoor_medium | active | 6.016s |

## Intentionally held or skipped

| File | Disposition | Reason |
| --- | --- | --- |
| Perform_face_swap_in_video_20260925182825-Vmake.mp4 | Not uploaded | Cuts to unrelated branded product-demo footage before six seconds; a clean Wall-only segment is below the existing minimum. |
| Perform_video_face_swap_and_20260925161929-Vmake.mp4 | Not uploaded | Below the existing six-second Wall minimum; preserved without looping, slowing, or padding. |
| Remove_text_and_swap_face_20260925161454-Vmake.mp4 | Not uploaded | Below the existing six-second Wall minimum; preserved without looping, slowing, or padding. |
| Swap_face_and_replicate_actions_20260925161512-Vmake.mp4 | Not uploaded | Below the existing six-second Wall minimum; preserved without looping, slowing, or padding. |
| Swap_face_in_video_20260925161853-Vmake.mp4 | Not uploaded | Below the existing six-second Wall minimum; preserved without looping, slowing, or padding. |
| Video_face_swap_and_edit_20260925182840-Vmake.mp4 | Not uploaded | Cuts to unrelated branded product-demo footage before six seconds; a clean Wall-only segment is below the existing minimum. |
| ssdsa.mp4 | Skipped duplicate | Exact SHA-256 duplicate of hook-09; one catalog record per unique source. |
| Swap_face_in_video_20260925161846-Vmake.mp4 | Uploaded; inactive | Stored for future placement review; eye overlap in changing/tilted close-up framing. Keep ineligible. |
| Video_face_swap_and_edit_20260925161920-Vmake.mp4 | Uploaded; inactive | Stored for future placement review; eye overlap in changing/tilted close-up framing. Keep ineligible. |

The short Wall originals are 4.352s, 5.184s, 5.184s, and 5.504s. Their content approval was retained; they fail the existing duration requirement. The two demo-tail files are eight seconds overall but have less than six seconds of clean background footage.

## Verification and scope

- 20 existing importer/manifest contract tests passed.
- All 21 uploaded MP4s were fetched from their public production URLs. Their exact byte size and SHA-256 matched local prepared files, and all decoded completely. Public thumbnails were fetched and verified as 360×640 WebP.
- Database metadata was checked against the reviewed mappings: unique hashes, source batch, dimensions/duration, visual groups, reactions, creator keys, Hook format, text placement, audio mode and status.
- Final local checks confirmed all 28 original source hashes remain unchanged and all 21 production video streams retain their original codec, dimensions and frame rate. The existing Wall selector accepted exactly nine new active backgrounds and rejected the two inactive holds.
- Existing content/configuration fields and statuses were compared for all 190 prior overlay-media records, 118 prior avatar records and 11 Hook formats. Usage counters and activity timestamps were excluded from the preservation comparison because normal customer use can update them.
- Production catalogs now contain 201 overlay-media records and 128 avatar records. Those are table totals, including existing non-Wall overlay content.
- The live production domain was checked at `https://www.getugcpilot.com` (HTTP 200). Public media verification used production storage URLs.
- This is an asset import. No application code, worker, schema, matcher, audio catalog, feature flag, customer plan, schedule, or social publication was changed. No Git push/deployment was requested or performed.
- Production AI copy generation, authenticated customer browsing/saving/scheduling, and a deployed-worker render job were not exercised by this import verification.

## Saved artifacts and safe replay

- Active Wall manifest: `scripts/data/wall-text-videos-real-2026-09-30.json` (nine assets only).
- Held Wall evidence: `scripts/data/wall-text-videos-held-2026-09-30.json`. This is intentionally not an executable importer manifest.
- Hook manifest: `scripts/data/hook-silent-approved-2026-09-30.json`.
- Local preparation, reviewed placement, baseline/after snapshots, proofs and public verification receipt: `.tmp/content-import-2026-09-30/`.
- Hook importer receipt: `.tmp/hook-silent-video-import/hook-silent-2026-09-30-approved/2026-09-30T16-40-39-569Z-full-batch-result.json`.
- Wall importer receipt: `.tmp/wall-text-video-import/wall-text-real-2026-09-30/import-result.json`.

Active-only Wall dry run:

```powershell
node --experimental-strip-types scripts/import-wall-text-video-assets.mjs --folder .tmp/content-import-2026-09-30/wall-active --manifest scripts/data/wall-text-videos-real-2026-09-30.json --dry-run
```

Do not replay the temporary all-uploaded Wall manifest: the existing importer can reactivate inactive entries. The saved active-only manifest excludes both placement holds. Only use reviewed safe mappings and the existing importer for future changes.
