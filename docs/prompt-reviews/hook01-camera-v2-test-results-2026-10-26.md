# Hook01 revised camera prompt test

Result: **IMPROVED PARTIAL PASS, no wider rollout**. The user explicitly requested one video with the revised prompt and comparison. One video was generated; no new image or paid retry.

## Prompt change and frozen controls

The revised prompt explicitly describes the free hand reaching toward and retaining the recording phone outside its view, desk-supported to handheld movement, irregular shake/motion softness, continued tilt/approach and final face partly outside the right edge. Source phone handling is inferred from arm movement and viewpoint change, not a directly visible grip. The prompt avoids inventing a second visible phone. Earlier reaction/cover sequence and timing boundaries are retained. Exact prose: `hook01-normal-pilot-video-prompt-camera-v2-2026-10-26.txt`.

Same approved normalized opening SHA707b3aac1fa74865af7a1935f1db666cfaff6c999c17392be81a65fe10a8de9c, model `gemini-omni-1.1-flash`,3seconds,720p,9:16,one FIRST_FRAME,no extra portrait/source video/last frame. No sampling/safety overrides. Retained provider interaction independently verifies the complete revised prompt and unchanged single input. Operation: `v1_ChdCVF9mYXBMQ0pJWDl2ZElQd1lLQWdRcxIXQlRfZmFwTENKSVg5dmRJUHdZS0FnUXM`.

## Frame review

All72generated frames reviewed across3native sheets; additional paired source/generated sheets5–6 cover every generated ending picture. Full-resolution generated indices63,67,71 inspected. Source91frame and previous72frame reviews remain available. Comparison derivative maps full source3.066992s to3s while leaving both generated videos unchanged.

| Property | Previous result | Revised result |
|---|---|---|
| Hand-cover and initial hold | Present | Retained broadly |
| Late handheld shake/blur | Weak/absent | Visible uneven displacement and motion softness around2.6s onward |
| Final face outside edge | Remained centered | Face moves partly outside right edge |
| Source timing/camera trajectory | Did not match | Improved behavior, but movement still begins later and final scale/path differ |
| Scene/captions | Same scene,clean | No caption reappearance or portrait-room cut observed |

The free hand reaches and leaves view around2.1s; actual offscreen grip remains unobservable. Blink now occurs around0.58–0.67s, later than source. No obvious critical anatomy defect was found in inspected pictures, with occlusion limiting assessment. New background areas exposed by generated movement are not independently verified source details.

This sample demonstrates that the same model/image can produce a late shake and off-center ending. Better wording is associated with improvement; one output per prompt does not isolate individual wording effects or establish repeatability. Remaining differences should not be called proof of an inherent model constraint. No alternative model or automatic next test was run.

## Artifacts and verification receipt

Local artifacts under `outputs/hook01-normal-pilot-2026-10-26/identity-v2/camera-v2/`: frozen preparation/generation receipts,image approval copied from accepted image,raw/silent videos,retained provider inputs,72frames,3native sheets,6paired sheets,comparison manifest and `video-frame-review.json`. `source-comparison/source-previous-revised-3s.mp4` compares source/previous/revised. Earlier trial files unchanged.

Added ignored helpers `.tmp/run-hook01-camera-v2-video.mjs`, `.tmp/compare-hook01-camera-v2.mjs`; this report; sibling `hook01-camera-v2-test-receipt-2026-10-26.json`. Appended EXPLORE_CONTEXT.md and clear.md. Existing corrected prompt was not modified during execution. No application/worker/default/UI/scheduling/reference assignment changes or deployment.

Continuing preflight: existing AGENTS,Explore context,nonnegotiables and ledger; ugc-context-memory,immutable-contracts,frame-analysis,video-prompt,opening-frame-prompt and regression-gate. Opening-frame and regression skills reread in this execution. Syntax/scoped ESLint PASS; frozen prompt/image checks PASS; wire and retained provider input checks PASS; duration3.000s/72frames24fps720×1280 PASS; final no audio stream; raw/final72decoded-frame hashes equal. Local duplicate submission guard rejects another create and preserves receipt. No new image,exactly1video,no automatic retries. Actual settled provider charges NOT VERIFIED; usage saved.

VERIFIED: source binding,t0 input,approved opening,provider prompt/image count,duration,attempt limit and output review coverage. PARTIAL: source action/camera fidelity. NOT VERIFIED: broad repeatability,production application acceptance,all other references. UGC-VID-013 remains OPEN with improved pilot evidence.
