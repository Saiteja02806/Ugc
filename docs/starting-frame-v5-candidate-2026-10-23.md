# Current starting-frame prompt refinement: v5 candidate

## Paid pilot completed after user approval

Six fresh direct Google requests completed on the same three reviewed sources and main-plus-two-support photos used previously. Model gemini-3-pro-image, 2K, 9:16, source/main/support/support order and image-label text are identical between versions. The labels deliberately stay v4 to isolate shared-prompt wording. Each source uses its existing hash-matched reviewed opening description in both conditions; the previous manually focused descriptions are not used. Input hashes, actual prompt versions/hashes, fresh request UUIDs, provider operation IDs, returned usage and original output hashes are retained in outputs/recreate-ui-preview/prompt-test-v5. All six calls completed; no retry. No app generation job or account-credit receipt was created; direct provider billing applies.

| Source | Current v4 | Revised v5 | Interpretation |
| --- | --- | --- | --- |
| Held glasses | Selected-person appearance more apparent, but room, clothing and glasses placement change. | Room/crop and dark top closer to source; appears to retain more source-performer facial appearance. | Scene gain does not establish a usable person recreation. |
| Pink keyboard | Shelving stays screen-right and overall arrangement closer to source. | Shelving moves screen-left, camera/desk arrangement changes despite stronger preservation wording. | Revision fails to improve scene consistency in this sample. |
| Drink can | More detailed/sharp image and selected-person resemblance more apparent; ceiling/window geometry changes. | Source geometry closer, but softer/smoother rendering and source-performer appearance more apparent. | No overall improvement demonstrated. |

All six omit creator captions on visual inspection. Both can results retain printed-looking physical label content, but exact label transcription is not verified. No OCR or biometric assessment was run. These judgments need user review, especially resemblance. Only one sample per version per source, one person set, no controlled seed; v4 precedes v5 in each pair. This is developmental evidence, not a reliability estimate or proof that prompt wording alone caused the differences.

Recommendation: retain v4 as the application default; do not promote v5 or bulk-author per-video prompts. No additional paid tests queued and deployment remains paused. Local page http://127.0.0.1:8196/comparison-v5 includes source, main/support photos and each fresh output; click for original images. Three browser screenshots captured with all images loaded and no page errors. Preparation validates baseline prompt hashes against prior v4 snapshots and hashes all input bytes; seven compiler tests pass including unchanged v4 output and opt-in v5 provenance. Earlier sections below describe the pre-test proposal.

User chose the current v4 approach after mixed results from longer, manually focused scene prompts. Keep generating a new photograph of the selected person using the source as visual direction. Do not return to face-swap instructions or author a separate prompt for every video.

## Evidence and hypothesis

The glasses, keyboard and drink-can comparisons show different tradeoffs between likeness, pose and scene fidelity. The reclining candidate contains authoring errors and is not a clean comparison. The laptop comparison is incomplete because its baseline was blocked. One sample per condition with no controlled seed does not identify the cause or establish reliability.

V4's “as a guide” and “Compose the scene naturally around my influencer” permit interpretation of composition. That wording is a plausible contributor to drift, not a proven cause. V5 removes the latter instruction and makes preservation more concrete without adding a long description of every object.

## Changes

1. Retain the v4 task, selected person's facial-feature instructions and main/supporting image order.
2. Specify the source camera viewpoint, tilt, crop, subject scale, placement, background layout, clothing and lighting. Keep objects on their visible sides; avoid zooming out or redesigning the setting.
3. Separate facial appearance from performance: use person photos for facial proportions and the source for pose, gaze, mouth opening, contact and occlusion. Do not turn a side profile forward to show more face.
4. Continue using only an existing source-hash-matched, reviewed opening-state description. Where its scene/pose wording conflicts with visible pixels, the source image takes precedence. No automatic caption transcription or new per-video prompt generation was added.
5. Explicitly remove overlay outlines, shadows and text boxes and reconstruct the covered scene. Keep physical object labels. Prompt wording cannot guarantee caption removal.
6. Preserve explicit user image instructions and all input validation.

## Implementation and limits

`buildHookKeyframeImagePrompt({ ..., promptVersion: 5 })` compiles the candidate for a controlled test. Omitting that argument still produces byte-identical v4; application API and prompt preview continue using v4. Candidate output reports version 5, so test receipts must record it and the actual prompt hash. Do not label candidate calls v4 or reuse previous request IDs.

No image generation, production prompt switch or deployment was submitted for this refinement. The user asked to review changes before subsequent testing. Local tests check compilation, input/role contracts, baseline stability and source provenance; they do not validate image quality.

Suggested next comparison: fresh v4 and v5 on the same glasses, keyboard and can inputs, with identical model/settings and person photos. Judge selected-person resemblance, framing/background, gesture/occlusion and caption removal separately. Repeat promising cases and include a second person before promoting the candidate. This test plan is not queued; existing images are historical evidence only.
