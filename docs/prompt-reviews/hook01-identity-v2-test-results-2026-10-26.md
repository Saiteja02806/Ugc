# Hook 01 identity-focused image and single-frame video test

Result: **starting image passes this controlled pilot; video is a PARTIAL PASS and is not approved for wider rollout.** One image submission and one conditional video submission were made. No automatic paid retries, application changes or deployment occurred.

## Scope and controls

The user requested continuing with the next test after discussing caption removal, image identity and measured normal-case motion timing. This trial uses the already prepared identity-v2 instruction package for Hook 01, then animates only the approved starting image. Extra influencer portraits are not sent to the video model.

Reference: `explore-paired-hook-4585ee949081c4e5cd835cd3`. Source SHA-256: `ba0fbb042edc19951270e602dbad9ebb413ebecda1069092bf6d63b2066c1e49`. Original source frame index/time: 0/0. The source t=0 PNG, selected influencer portrait, image order, Gemini 3 Pro model, 2K, 9:16, sampling and safety defaults match the earlier trial. No source masking, blur, timestamp substitution, extra identity photos or model switching was introduced.

The changed variable is the full textual instruction package: production-normal v4 subject-first wording, role labels and explicit source-feature exclusions. This is not an experiment isolating a single sentence. Original Attempt 1 and its receipt are preserved. The prepared image prompt, preparation receipt and timed video prompt were not changed during execution.

## Starting-image result

- Model `gemini-3-pro-image`, 2K, 9:16; actual raw output 1536×2752. One request completed.
- Operation: `v1_ChdHeTNmYW9MNEVJeXcycm9QcVBHV3FBURIXR3kzZmFvTDRFSXl3MnJvUHFQR1dxQVE`.
- Retained operation confirms exact scene bytes, identity bytes and complete prepared prompt.
- Raw output and exact normalized 720×1280 animation input were visually inspected. The person now qualitatively resembles the selected influencer in brows, eyes, facial structure and individual skin characteristics rather than retaining the original heavy makeup/source appearance. This is a visual judgment, not a biometric score or repeatability guarantee.
- Caption removal, broad original scene, upward-right open-mouth opening and low hands pass the controlled pilot gate. No obvious critical visible anatomy defect was found.
- Framing/head placement and expression remain approximate. The source necklace is omitted because the candidate explicitly requested that exclusion. Accessory policy requires review before generalizing this prompt; this result does not authorize blanket jewellery removal.

Comparison: `outputs/hook01-normal-pilot-2026-10-26/identity-v2/starting-image-comparison.png`. Image approval is hash-bound in `image-visual-review.json`. One successful candidate does not establish why the earlier output failed or show that all ordinary references are repaired.

## Video result and source comparison

- Existing Gemini Omni adapter; model `gemini-omni-1.1-flash`, 720p, 9:16, exactly 3.000 seconds, 24fps, 72 decoded frames.
- Operation: `v1_ChdEQzdmYXBQWkc4aUExZThQeWRhS3VRYxIXREM3ZmFwUFpHOGlBMWU4UHlkYUt1UWM`.
- The final request and retained operation verify exactly one image with FIRST_FRAME role and the complete frozen 923-character motion prompt. No extra portrait, last frame or source video was sent.
- Final delivered clip has no audio stream. Existing audio removal preserves all72 decoded raw/final picture hashes. Absence of final audio does not establish whether the provider internally generated any audio.
- Earlier source review covered all91 source frames. Current review inspected all72 generated frames through three native contact sheets and six paired sheets, pairing every generated picture with its nearest original-source timestamp. Full-resolution generated indices41,48,71 and original source90 were additionally inspected.
- Source duration is3.066992s. The comparison derivative compresses the full source to3s (about1.022× playback); generated playback is unchanged. Original files are preserved. Pair mappings and source/output hashes are saved in `source-comparison/comparison-manifest.json`.

| Property | Result |
|---|---|
| Opening hold and action order | PASS: long surprised opening, hand rises to mouth, opposite hand reaches, covered-mouth ending. |
| Identity and scene continuity | PASS qualitatively within visible facial regions: selected appearance remains, same room/top, no cut to portrait background. |
| Caption cleanup | PASS: no caption reappearance observed. |
| Timing | PARTIAL: visible hand lift begins around1.625–1.667s versus directed1.76s; mouth-covered pose around2.00s versus phase end2.09s. These visual boundaries have frame/definition uncertainty. |
| Expression | PARTIAL: broad wide-eye surprise retained; source early blink is absent and expression is not identical. |
| Reaching hand and camera | PARTIAL: reach occurs, but hand withdraws by about2.4s rather than sustaining the source's camera interaction. |
| Final framing | FAIL: source ends with a strongly tilted close edge crop and face partly outside view. Generated ending is closer than its opening but stays substantially wider and more centered. |

The timing instructions produced the intended broad order and hold in this sample. No untimed control video was run, so this trial does not measure the causal improvement from timestamps. A valid duration and correct prompt receipt are not full visual acceptance.

## Next boundary

Keep the accepted opening, single-image input, model, duration and source mapping fixed. The next candidate should address only the reaching-hand/camera interaction and final crop, preserving the successful opening hold and mouth-cover action. Do not simultaneously change the image, add a portrait, change duration or introduce an ending-frame route. No further paid attempt was submitted. Other normal and middle references remain unchanged.

## Verification and completion receipt

Preflight: current AGENTS.md instructions and continuing Explore context, nonnegotiables and ledger history including UGC-VID-013/014/015/016. Newly read applicable context tails and full skill files: ugc-context-memory, ugc-immutable-contracts, ugc-starting-frame, ugc-video-prompt, ugc-opening-frame-prompt, ugc-frame-analysis and ugc-regression-gate. Repository preflight PASS. Existing worktree changes preserved.

Checks: both runner syntax checks PASS; scoped ESLint on image runner, video runner and comparison helper PASS; frozen request/prompt/image validation PASS; real retained image/video records PASS; ffprobe duration/frame/audio checks PASS; all72 raw/final frame hashes equal; duplicate-image and duplicate-video attempts are rejected locally before network activity and leave the receipt unchanged. One attempted image and one attempted video are recorded. Settled provider charges NOT VERIFIED; usage metadata retained. No application credits or database writes.

Added files: `.tmp/run-hook01-identity-v2-trial.mjs`, `.tmp/run-hook01-identity-v2-video.mjs`, `.tmp/compare-hook01-identity-v2.mjs` (ignored operational helpers); this report; `docs/prompt-reviews/hook01-identity-v2-test-receipt-2026-10-26.json`. Appended `EXPLORE_CONTEXT.md` and `docs/ai-context/clear.md`. Generated receipts, outputs, approval, frame review,72frames, sheets and comparisons are under `outputs/hook01-normal-pilot-2026-10-26/identity-v2/`; `artifact-file-list.json` lists local artifacts. No application/worker source, runtime defaults, reference assignments, UI or scheduling controls were edited.

Protected statuses: source/identity bytes, original t=0 mapping, frozen prompt selection and image-before-video gate VERIFIED. Single video image/no portrait VERIFIED. No automatic paid retry VERIFIED. Wider identity reliability, authenticated production application, UI/scheduling behavior and full source-faithful ending NOT VERIFIED; no broad build/browser acceptance is claimed for isolated provider tests. UGC-VID-016 records a successful candidate sample without being marked universally fixed; UGC-VID-013 remains OPEN for motion fidelity.
