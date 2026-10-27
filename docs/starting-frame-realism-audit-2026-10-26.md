# Starting-frame realism audit — 26 October 2026

Assessment: the current path can produce a recognizable influencer in a broadly similar shot, but does not establish reliable preservation of pose, photographic texture or natural appearance. This is a local source and saved-output audit, not production acceptance or a new generation experiment.

## Scope and evidence

Reviewed the normal/pilot prompt builders, generation API, Gemini request builder, image worker, output normalization and result admission. Visually inspected four existing files from `outputs/hook100-full-recreation-trial-2026-10-26/caption-v2/`: `original-t0.png`, `identity.png`, `generated-opening.png` and `approved-animation-opening.png`. Read earlier Hook 100 trial reports and relevant Explore history for Hook 50 and glasses/hand/keyboard failures. Historical reports are supporting records, not fresh reproduction of those trials.

Sources read: AGENTS.md engineering instructions; nonnegotiables.md; relevant portions of clear.md and EXPLORE_CONTEXT.md; ugc-context-memory, ugc-immutable-contracts, ugc-starting-frame and ugc-video-prompt skills. The full large context/incident documents were not re-read in this audit. No application code, prompt defaults, reference choices, provider settings or UI changed. Existing worktree changes were preserved.

## Findings

1. **Whole-image synthesis remains the mechanism.** The Gemini adapter sends ordered reference images and a text prompt. Its request builder exposes aspect ratio and output size, but no mask or local-edit boundary. The source is guidance, not a pixel lock. Correct hashes and image labels verify inputs, not photographic fidelity. This observation applies to the inspected adapter; no claim is made that every supported provider has identical capabilities.
2. **The normal path uses v4.** `HOOK_KEYFRAME_IMAGE_PROMPT_VERSION` is 4; v6 is explicitly a test candidate. V4 asks for natural skin and scene/pose adherence, but also says to compose naturally around the influencer and prioritize recognizable likeness over exact source facial geometry. Different facial geometry is expected for a different identity; this wording does not establish the cause of any specific output defect. Full-recreation assignments use a separate v5 builder.
3. **Saved Hook 100 result is a partial fidelity pass.** It retains the broad tilted selfie, side gaze, parted mouth, hand at glasses, sweater, earbud and window setting. The caption is removed. Framing/head placement and glasses-to-face geometry are approximate rather than exact. The portrait has visible fine skin detail; the generated face appears smoother in some areas while retaining cheek marks. These are qualitative visual judgments, not measured texture or identity scores. Changed hair volume and facial shape are not automatically defects when identity changes.
4. **Output normalization can further reduce fine detail.** Gemini Pro requests 2K; the worker prepares a 720×1280 portrait output. The helper resizes and may crop at most a small near-ratio margin; it does not explicitly apply skin smoothing. The raw generated image already differs, so normalization cannot explain all differences. A matched-resolution controlled comparison is needed to quantify its contribution.
5. **Admission checks are technical.** The result resolver checks ownership, job completion, receipt/model/hash linkage, asset provenance and dimensions. Client selection is deliberate approval; the inspected backend path does not assess skin texture, pose similarity or photographic realism. A completed/verified asset is not a quality pass.

## Proposed quality contract for discussion

- Source frame controls camera, crop, head/body pose, gaze, expression, hand/prop contact, wardrobe, environment and scene illumination. Allow the anatomy changes necessary for the chosen influencer.
- Influencer photos control facial identity, intrinsic skin tone, hair identity and individual skin characteristics. Transfer the person into the source illumination; do not transfer portrait lighting or erase natural detail.
- Match the source's photographic rendering: sharpness, depth of field, motion softness, exposure, white balance, shadow softness, noise/compression and ordinary phone-camera appearance. Adding pores or sharpening everywhere is not a substitute for matching that rendering.
- Review identity, pose/contact, scene/camera and photographic naturalness independently. Reject a critical miss even if the other categories pass. Preserve the exact selected timestamp and opening/clarity roles.

## Next controlled experiment

Freeze one source frame, ordered identity photos, model, output size and all existing settings. Compare the current prompt against one restrained fidelity revision; use multiple recorded outputs per condition because one success cannot establish reliability. Inspect raw images and equal-resolution derivatives. Include a natural clear opening and a difficult glasses/hand example before broader adoption. Do not change frame selection and model simultaneously. No new paid request was submitted by this audit.

If prompt-only trials still alter the scene or rendering materially, investigate an explicitly supported local-edit/mask route as a separate experiment. Do not promise exact pixel preservation from textual instructions or assume the currently inspected Gemini adapter supports such a route.

## Verification receipt

- VERIFIED by source inspection: prompt routing, reference order construction, Gemini request controls, normalization and technical result checks described above.
- VISUALLY REVIEWED: the four named saved stills, with qualitative findings above.
- NOT TESTED: fresh provider inference, multi-model comparison, statistical reliability, full video chronology, authenticated production requests and deployed-version parity.
- Protected UI/scheduling behavior: NOT TESTED; no runtime files changed.
- Commands: read-only PowerShell/rg/git-status inspection and local image viewing. No build or automated behavioral test was run for this documentation-only audit.
- Incident: UGC-VID-014, recurrence of UGC-VID-004/006; OPEN. Provider-internal cause remains UNKNOWN.
- Files changed by this audit: this report; append-only entries in clear.md and EXPLORE_CONTEXT.md. Rollback boundary: remove only these audit additions, preserving all pre-existing work.
