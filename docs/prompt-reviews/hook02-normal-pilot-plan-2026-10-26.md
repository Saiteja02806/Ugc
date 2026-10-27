# Hook 02 normal opening-frame pilot

Status update: the user subsequently approved one image and conditional video test. The single image request was rejected by Google with HTTP 400 safety violations; no image was returned and no video was submitted. Generated quality remains NOT TESTED. See `hook02-normal-pilot-result-2026-10-26.md`. No catalogue assignment or deployment is part of this isolated pilot.

## Minimal scope

Use only `explore-paired-hook-7c53cba88343579e7e15c8b0`, current title Hook 02. Preserve the original t=0 opening, replace identity with the same previously selected influencer used for Hook 100, remove the added caption, then animate the complete source sequence into three seconds. Review the actual starting image before requesting video. No automatic paid retries or rollout to other references.

Source SHA-256: `f1f7b5ed3d54066e857a354ea2ae735d67c8066b7fc7ff0406831b8418e03a7d`.
Stored t=0 PNG SHA-256: `f6db3ac5430dded9a9a8e8969a7cda803137ca9e63816a93a2f87b1af873fb7d`.
Identity asset: `495d8905-7a1b-4cbf-a38f-7a526a4dbff5`; SHA-256 `640669439c0ec80020bcaaf03dc76ccbc51c39d0fc1be42d6c0133f1899b920a`.

## Source evidence and retiming

Freshly inspected all 91 decoded frames through four contact sheets, plus full-resolution frames 0, 24, 60 and 90. Original ffprobe frame PTS confirms the event-boundary clock; source duration is approximately 3.066992 seconds including the final frame's duration. Source t=0 is suitable; no later clarity image is required. Glasses partially cover the eyes but do not prevent inspecting the visible face.

| Source seconds | Generated seconds | Observed action and required hold |
|---|---|---|
| 0.00–0.30 | 0.00–0.29 | Laptop lid moves upright toward screen-right; neutral face, glasses on. |
| 0.30–0.80 | 0.29–0.78 | Neutral screenward pause. |
| 0.80–1.366667 | 0.78–1.34 | Eyes widen, mouth opens; hold before hands rise. |
| 1.366667–1.966667 | 1.34–1.92 | Both hands rise to eyeglass temples. |
| 1.966667–2.40 | 1.92–2.35 | Glasses pulled forward, then lowered. |
| 2.40–3.066992 | 2.35–3.00 | Glasses stay low, eyes wide, lips relax slightly; same camera and scene. |

Generated time = source time × 3 / 3.066992, rounded to hundredths in provider prose. Boundaries describe visible transitions sampled at source-frame precision, not a guarantee that a generative model follows exact times. No source frames are intentionally skipped. Overlay text is removed in the still; exact user-facing text belongs in the editor.

## Proposed inputs and generation gates

Image test: one Gemini 3 Pro image at 2K, 9:16. Actual transmitted order must be Image 1=verified source t=0 PNG, Image 2=verified influencer portrait. Use the separate image-prompt file; no later frame or additional identity is implied.

Image gate: compare output directly with source t=0 and identity portrait. Check neutral closed mouth, screen-right gaze, glasses on, laptop/hand placement, unchanged camera/crop/scene/outfit, identifiable influencer, natural skin and intact fingers. Inspect the entire caption region for remaining letters, emoji, outlines or replacement artifacts. Normalize only using the existing preserve-composition path, inspect the exact normalized input again and bind approval to its hash. Any material failure stops this trial before video; no automatic paid image retry.

Video test, only after image approval and paid-generation authorization: use the existing Gemini Omni adapter, 3 seconds, 720p, 9:16, generated audio disabled. First-frame input is the approved normalized image; influencer portrait remains a separately labelled identity reference if supported by that exact adapter. Freeze and inspect the final assembled provider prompt, actual model identifier, image hashes, image roles and duration before accepting the run. No automatic paid retries. A completed job does not pass visual review.

## Frame-by-frame video acceptance

Extract every generated frame with original PTS and pair it against source time `generated_time × 3.066992 / 3`. Make a source-left/generated-right comparison and transition contact sheets. Review every frame, including the full final tail; record actual coverage and timestamp differences rather than claiming success from thumbnails or job status.

Grade separately: opening match; identity and naturalness; neutral pause and surprise hold; hand-rise/removal chronology; glasses and finger continuity; camera/scene/outfit; final held pose; absence of captions and generated audio. A skipped action, glasses-on-head substitution, duplicate glasses, early removal, major identity/anatomy error, or ending loss fails the pilot. For this pilot use ±0.20 seconds as an initial event-boundary comparison tolerance, while recording measured deviations; this is an evaluation target, not a model promise. Document any failure and revise only the affected direction before seeking a separate retry.

Broader rollout is conditional on real output review and user acceptance. Existing normal prompts, the 31 middle-frame assignments, frozen jobs, user edits, UI, scheduling, billing configuration and storage objects remain unchanged. Rollback consists of discarding this pilot's drafts/outputs; no runtime rollback is needed.

## Preparation receipt

Files created by this pilot: this plan, the sibling `hook02-normal-pilot-image-prompt-2026-10-26.txt`, `hook02-normal-pilot-video-prompt-2026-10-26.txt`, and the local evidence receipt under `outputs/hook02-normal-pilot-2026-10-26/`. Project context and mistake ledger receive append-only notes. No application code was edited.

Sources/skills used: AGENTS.md; continuing-task EXPLORE_CONTEXT.md and mistake-ledger history; nonnegotiables.md; ugc-context-memory; ugc-immutable-contracts; ugc-frame-analysis; ugc-starting-frame; ugc-video-prompt; ugc-opening-frame-prompt; ugc-regression-gate. Source review, hash/PTS checks and draft timing validation are preparation evidence. Live application acceptance, provider-input verification and generated-output fidelity remain NOT TESTED. UGC-VID-013 remains OPEN.
