# Hook04 corrected-prompt controlled test — 26 October2026

Status: BLOCKED at starting-image generation. The user explicitly replaced Hook01 with a different case, suggesting Hook3/4; Hook04 selected. Hook01 repeat attempt never reached a generation POST (0video submission attempts); it is not counted as this pilot.

## Source and frozen inputs

Reference explore-paired-hook-b43622d1486957644f3317e6; SHA aad28dc09ced6ec5d053dfd12e9fb8329ed2b9725202e9328b62204c162649b1. Normal original-t0 case, source3.066667s/92decoded frames/720x1280. All92source thumbnails reviewed across4sheets this turn; original-resolution t0 inspected. Source opening: surprised open mouth and raised brows toward laptop, glasses on, white zip-front top, hand low at keyboard. The sequence holds, covers mouth, reaches toward camera, then tilts upward with wall-dominant lower-right cropped ending. Camera handling inferred from reach/view change, not a directly visible phone grip.

Corrected motion prompt copied exactly from the reviewed candidate package to outputs/hook04-corrected-pilot-2026-10-26/video-prompt.txt. Full source mapped to3s, no omitted ending. Image prompt uses the normal v4 builder: source t0 governs scene/pose, same previously selected influencer portrait governs identity, baked caption/emojis explicitly removed. Preserve glasses/laptop/white top/desk/wall/window geometry; no arbitrary new scene. Prepared with actual request builder and role labels, hashes and duplicate guard.

Planned image: gemini-3-pro-image,2K,9:16,source+one identity portrait. Planned video ONLY after visual approval: gemini-omni-1.1-flash,3s,720p,9:16,one approved FIRST_FRAME,no extra portrait/video/endframe. No live prompt assignment or deployment.

## Result

Default sandbox model checks failed DNS (ENOTFOUND); approved network read-only checks then returned both exact model IDs and131072input-token limits. One image POST was attempted with network access. It returned HTTP402 and no usable explanatory provider message. The receipt marks provider-rejected, imageSubmissionAttempts1, videoSubmissionAttempts0. No image operation ID or output image was returned. HTTP402 indicates a payment-related refusal; exact account balance/project/billing cause UNKNOWN. Settled charge status NOT VERIFIED. No automatic paid retry or billing/config change.

No starting image exists to visually approve; video generation and source/output frame comparison NOT PERFORMED. Source clarity is not a generated-image acceptance. Do not submit animation from the unmodified source performer or substitute Hook01 image.

## Artifacts and receipt

Local folder: outputs/hook04-corrected-pilot-2026-10-26/. Contains source-t0.png, image-prompt.txt, video-prompt.txt, preparation-receipt.json and generation-receipt.json. Source and influencer hashes/request SHA recorded in preparation; wire SHA confirmed on the one attempted POST. Helpers .tmp/prepare-hook04-pilot.mjs, .tmp/run-hook04-image-trial.mjs and read-only .tmp/check-hook04-provider.mjs. Existing trial artifacts preserved.

Checks: sourceSHA and identitySHA PASS; all source thumbnails plus t0 actually reviewed; frozen image-request preflight PASS; exact-model read-only metadata PASS; request wire equality/hash PASS; successful generation FAILED HTTP402. Starting-image visual acceptance/video fidelity/production NOT TESTED. App code, worker code, runtime assignments, user edits, database and schedule unchanged by this trial. No application lint/build/browser tests claimed.

Preflight: tools/preflight.py previously passed for the authorized one-pilot task before user switched selection; actual Hook04 source/hash/request then checked separately. Skills actually read in this test: starting-frame, video-prompt, opening-frame-prompt, frame-analysis, immutable-contracts; nonnegotiables and relevant audit/pilot receipts. Context-memory/regression-gate were read in continuing audit context. Large Explore/clear context not claimed as freshly read in full; no application code edited.

UGC-VID-013 remainsOPEN: this attempt provides no generated adherence evidence. Next: restore generation billing/access for the same provider credentials, then explicitly authorize one fresh image retry. Preserve this rejected receipt; review image first and submit one conditional video only after it passes.
