# Clearer-frame pilot: Hook 50

Completed 24 October 2026, Asia/Calcutta. Two real Gemini 3 Pro image results,
no generated videos or deployment. This is a local image experiment, not hosted
application acceptance or implementation of arbitrary-frame selection.

## Source and selection

Reference: `explore-paired-hook-c8b971f4cea086703e106c92` (Hook 50).
Source SHA-256: `483e11b3aba9bee6b50d202836be545df6374dceab472c07233fec38bb189da8`.
Verified original video bytes, 720 × 1280, 84 frames, 2.8 seconds.
Inspected all frames in the existing contact sheet and full-size frames 0, 24, 30.
The opening shows a side-facing performer with finger at lower lip. Frame 30 at
presentation timestamp 1.00 second shows both eyes and more facial structure,
with the same scene, clothing and gesture. It is a clearer view, not a sharpness
repair or a claim that the source opening literally contains only half a face.

## Matched requests

One fresh result from original opening; one from selected frame 30. Both use
`gemini-3-pro-image`, image size 2K, 9:16, current v4 builder with three person
photos and no optional source-specific opening description. Prompt SHA-256:
`a2d9f2cc0f7f78e60c33ebe7150b53a82fc9f84e00d03d0389f85bfaf4c81eee`.
Same main/supporting photo bytes and order as earlier tests; same v4 labels.
No v6 wording, model change, manual pose prompt, or paid video was introduced.

Frozen inputs and completed receipts are in
`outputs/recreate-ui-preview/prompt-test-clearer-frame-2026-10-24/`.
Both input and output hashes, identical prompt/person inputs and completed status
were checked. Originals are `original-opening.jpg` and `clearer-frame.jpg`.
Exact full prompt is in each `*-input.json` and expandable in the preview.

Initial restricted-network requests failed without provider IDs. An independent
DNS check returned ENOTFOUND for Google; host-network check succeeded. Preserved
both connection-error receipts before explicit network-corrected retry. Both
requests then completed once; no completed sample was discarded. Returned usage
was 4,315 and 4,205 total tokens; no invoice amount or zero-charge assertion for
connection errors is inferred. No automatic paid retries or additional calls.

## Visual findings

| Check | From original opening | From clearer frame |
| --- | --- | --- |
| Selected-person appearance | Recognizable features visually present | Recognizable features visually present; more frontal composition |
| Captions | Removed | Removed |
| Source expression/gaze | Side gaze retained broadly; mouth less exaggerated | Gaze shifts away from lens; mouth less exaggerated |
| Finger contact | Near lower lip | Shifts toward chin |
| Scene and lighting | Brighter room; background rearranged | Darker than first output, but room layout still rearranged |
| Clothing | Broad black-top category retained | Broad black-top category retained |

These are qualitative observations, not biometric or OCR scores. One sample per
condition, no fixed seed and one influencer set cannot establish causality or
reliability. The alternative source is usable for image generation, but this test
does not demonstrate that selecting it alone solves same-shot fidelity. Both
branches show remaining prompt/model compliance limitations.

## Review and next decision

Comparison PNG shows original opening, its generated result, clearer reference,
and its generated result, plus the three influencer photos. Complete originals
are linked in `http://127.0.0.1:8199/comparison-clearer-frame`, along with source
video playback (manual controls) and exact prompt. A more frontal image alone is
not a full success if the source's expression/gesture/background change.

Review still quality before any paid motion test. If the clearer result is accepted,
motion must begin with its actual finger-at-chin pose and off-camera gaze; the
source's subsequent gaze change/response must be adapted explicitly. No motion
plan was generated or validated in this pilot. Production remains frame-zero-only,
current v4 stays active and deployment remains paused.
