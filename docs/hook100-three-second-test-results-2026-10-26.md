# Hook 100 three-second prompt test

Result: PARTIAL PASS. Original action order, caption cleanup and ending scene
continuity improved. Expression, timing and framing still differ from source;
the result is not approved for wider reference rollout.

## What changed

Re-inspected all 112 source frames across four native sheets before writing.
Applied `ugc-middle-frame-recreation-prompt` and `ugc-opening-frame-prompt`:
the later frame remains clarity evidence, approved image recreates t=0, and the
motion covers original opening to ending. Source action is compressed from
3.733333 seconds to three seconds (about 1.244× pace), not trimmed at source 3 s.

The new prompt is 1326 characters versus the previous 2417. It separates
opening hold, removal, sideward pause, blink/turn, frontal reaction and ending.
It describes parted lips and questioning surprise instead of a broad instruction
to lift brows. Exact prompt: `docs/hook100-three-second-test-prompt-2026-10-26.txt`.
No application runtime prompt or model default was changed for this experiment.

Kept the same approved caption-free image, normalization, portrait, model and
input roles. Changed prompt and requested duration together. This combined test
does not isolate whether duration or wording prevented the prior ending cut.

## Real provider result and review

- One new Google Omni create, zero new image creates. Model
  `gemini-omni-1.1-flash`; 720p; 3.000 seconds; 24 fps; 72 pictures.
- Operation: `v1_Chd4dXZlYXBmYk11TEY2OTRQdE9HOGtBZxIXeHV2ZWFwZmJNdUxGNjk0UHRPRzhrQWc`.
- Retained provider record confirms both exact image hashes, FIRST_FRAME and
  separate IMAGE_REF roles, and complete revised prompt. Existing earlier
  accepted trials/receipts remain unchanged.
- Inspected all 72 frames across three sheets and both paired source-comparison
  sheets; additionally inspected indices 20, 38, 48 and 71 at 640-pixel width.
- PASS: begins glasses-on, removes once, pauses aside, turns to lens, looks
  aside again; no smile, captions, bedroom cut or wardrobe change.
- Remaining: removal finishes around 0.96 s instead of directed 0.75 s; frontal
  turn completes around 1.6 s rather than 1.55 s; strongly contracted inner
  brows look worried/confused rather than source's wide-eyed surprise. Subject
  scale moves closer than desired. Hand/glasses mechanics are approximate.
- Final output is silent; all 72 decoded raw/final frame hashes match after
  existing audio removal. Provider-input correctness is verified; complete
  visual equivalence is not established.

Usage: 2589 input tokens, 17376 video output tokens, 687 thought tokens, 20652
total. Settled currency amount was not returned. No app-credit changes, database
writes, storage writes, deployment or automatic paid retry.

## Artifacts

Folder: `outputs/hook100-full-recreation-trial-2026-10-26/caption-v2/motion-3s-v1/`.
Contains frozen `trial-receipt.json`, actual `video-prompt.txt`, generated raw and
silent MP4s, retained provider summary, normalized opening, detailed
`video-frame-review.json`, 72 extracted frames and three contact sheets.

`source-comparison/source-vs-generated-retimed-3s.mp4` shows source left and
actual result right. Source is explicitly sped up to three seconds in this
comparison derivative; generated output and originals are unchanged.

## Changes, validation and limits

Changed diagnostic scripts `scripts/run-hook100-video-trial.mjs` (separate
three-second receipt, exact duration and saved prompt) and
`scripts/compare-hook100-source-generated.mjs` (declared retimed comparison).
Added the exact prompt, this report and local JSON visual review. Appended results
to Explore context and incident ledger. Runtime/UI/scheduling code unchanged.

Scoped ESLint and both script syntax checks PASS. Offline preflight verifies
3-second input settings and unchanged approved-image hashes. Real output probe
and raw/final 72-frame comparison PASS; retained provider hash/role/prompt checks
PASS. Full application build was not rerun for diagnostic-only changes.
Authenticated production application and queue/storage lifecycle NOT TESTED.

Preflight skills/context: existing project context, protected contracts,
frame-analysis, video-prompt, both dedicated prompt-writing skills and regression
gate. Same source and generated-image evidence remains bound to UGC-VID-010/011.
UGC-VID-011 ending cut did not recur in this one trial; it remains OPEN pending
broader validation. Do not generalize one success to every reference.

Next prompt refinement should retain the clean image and three-second duration,
reduce inner-brow contraction, preserve wide eyes/parted lips, and constrain
subject scale while tightening removal timing. No additional paid test or wider
rollout was performed after this result.
