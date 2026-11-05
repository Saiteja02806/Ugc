# Starting-frame real retest — 5 November 2026

**Result: source fidelity FAILED at stage2. Stage1 preserved the source scene in this trial. The workflow is not fully corrected and this output is not approved for video.**

Incident: `UGC-VID-20261105-STARTING-FRAME-SCENE-DRIFT`. This is a follow-up to the [stage1 correction](C:/Users/chund/OneDrive/Desktop/UGC/docs/starting-frame-stage1-correction-2026-11-05.md), not a replacement for its historical HTTP402 receipt. The user authorized the real OpenRouter test and subsequently requested another test. Balance was checked first: USD9.78775 available. No further permission was requested and no automatic retry was made.

## What actually happened

| Check | Stage1 | Stage2 |
| --- | --- | --- |
| Source room and tilted camera | Retained | Room changed toward identity-photo setting; tilt lost |
| Raised hand on screen-left, separate from mouth | Retained | Moved to screen-right, close to chin/mouth |
| Wide-open mouth and screen-left gaze | Both retained | Gaze retained; mouth/expression softened |
| Source hairstyle and clothing | Retained | Wavier photo hairstyle and grey photo clothing imported |
| Identity | Still visually resembles source performer; replacement pending | Selected influencer's visible features are more apparent; no measured identity score |
| Caption cleanup | Caption removed | No caption returned |

These are manual visual observations, not numerical similarity measurements. The result establishes failure on this exact scene; a single generation does not measure reliability across other scenes.

Stage2 input was correct: Image1 is the exact reviewed stage1 PNG, Image2 the original primary identity PNG, Image3 the original supporting identity PNG. SHA checks and a network-free replay through the actual payload/helper functions confirm this order. The existing prompt explicitly requests retention of composition, hand placement, background, clothing and source hairstyle. Missing source/identity attachments, reversed ordering or a requested photo-background override are not supported by the evidence.

The verified implementation limitation is that stage2 sends a full-image generative request with image references and text instructions. It sends no face-region edit mask or independently enforced fixed-scene constraint. Describing the stage as an identity lock does not create such a constraint. The visible photo-background/outfit/hairstyle carryover is consistent with reference leakage, but the model's internal weighting and exact phrase-level cause remain UNKNOWN. The report does not claim one supporting photo caused the failure or that wording alone can guarantee a fix.

The bad composition already exists in the raw stage2 PNG, before harmonization or final resizing. Local replay reproduced the real harmonized bytes exactly. Those later operations did not cause the restaging.

## All real-test inputs and outputs

Model `google/gemini-3-pro-image` via OpenRouter; 2K, 9:16. Original source timestamp0. Background, outfit and hairstyle all `source`. Custom instructions empty. Caption/physical-text cleanup enabled. No additional hair/outfit/person reference was introduced.

Inputs: [source t=0](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/starting-frame-drift-20261105/source.png), [primary identity](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/starting-frame-drift-20261105/identity-1.png), [supporting identity](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/starting-frame-drift-20261105/identity-2.png).

Full data: [input manifest](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/starting-frame-retest-20261105/inputs.json), [actual stage1 prompt](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/starting-frame-retest-20261105/scene-prompt.txt), [stage1 settings and image hashes](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/starting-frame-retest-20261105/scene-input.json), [stage2 prompt](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/starting-frame-retest-20261105/identity-prompt.txt), [stage2 settings and image hashes](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/starting-frame-retest-20261105/identity-input.json), [manual stage1 review](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/starting-frame-retest-20261105/scene-review.json).

Outputs: [stage1](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/starting-frame-retest-20261105/scene.png), [raw stage2](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/starting-frame-retest-20261105/identity.png), [harmonized](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/starting-frame-retest-20261105/harmonize.png), [final720x1280](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/starting-frame-retest-20261105/final.png). The final file uses the actual worker's output-preparation function, without creative editing.

| Real provider operation | Evidence |
| --- | --- |
| Stage1 HTTP200, one image, 15:21:00.862 IST | `gen-1793872215-NK2FA9p42Pia3f6tiAoo`, USD0.142820 |
| Stage2 HTTP200, one image, 15:23:15.164 IST | `gen-1793872358-1JC72nNnnbJYMdx5mZHl`, USD0.142566 |
| Total | Exactly2 POSTs, USD0.285386 provider-reported cost |

Saved [stage1 response](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/starting-frame-retest-20261105/scene-response.json), [stage2 response](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/starting-frame-retest-20261105/identity-response.json), and [network-free replay/output verification](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/starting-frame-retest-20261105/verification.json). Credentials and raw private base64 are not copied into the report/global memory.

## Verification receipt and limits

- Version8 prompt/version/recovery wiring: VERIFIED locally. Historical7 text and audited stage fingerprints still match. Both versions accepted by compatible receipts; incompatible old receipts reject8.
- 154 application plus105 worker tests:259 PASS, no failures/skips. Commands and logs are the same suites listed in the correction report, rerun under `.tmp/starting-frame-retest-20261105/`.
- Worker noEmit typecheck: PASS. App noEmit typecheck: FAILED on unrelated concurrent `remotion/VidmakeLaunchPromo.tsx` errors for `isWinner` and `highlight` at1198/1901/1928. Those source changes were not edited by this task. This differs from the earlier successful typecheck and is not suppressed.
- Scoped lint:0errors,1existing unused `sourceFrame` warning in API test. Scoped diff check: PASS.
- Actual source geometry after stage1: manually VERIFIED for this trial. Final source geometry/appearance: FAILED after stage2. Identity accuracy is not independently measured; no95%/100% claim.
- UI changes: NONE by this retest. No runtime application source edited in this retest; existing prompt/version corrections were inspected. Other concurrent worktree changes preserved.
- Production frontend/API/queue/billing acceptance and fresh desktop/mobile comparison: NOT TESTED. This was real provider generation using current application helpers with local receipts, not a hosted application job.
- No builds, dev server, bundling, pushes, deployments or video generations. No extra paid retry after the failed stage2.

Preflight sources consulted in this task flow: AGENTS/global mistake memory, actual Explore/clear history, nonnegotiables, context-memory, immutable-contracts, starting-frame, opening-frame-prompt, video-prompt and regression-gate. Large historical output was partly truncated; no fresh exhaustive reread is claimed. Read-only preflight prerequisites PASS. The inspected inputs are original stills; no invented video-action analysis was added.

## Remaining correction

Keep the demonstrated stage1 improvement, but do not declare the full pipeline fixed. Stage2 requires its own versioned scene-preservation correction and controlled acceptance test. Isolating identity-reference facial content may reduce background/outfit leakage; that is an untested candidate. To enforce fixed surroundings more strongly, evaluate a supported localized face-edit/mask or identity-conditioned route, and prove it retains the accepted stage1 pixels/geometry outside the intended edit. Do not silently switch provider or add an architecture rewrite. Prompt tightening alone is not an enforced face-only edit.

Regression requirement: compare source→stage1 and stage1→stage2 independently for camera, room, hand side/contact, gaze, expression, clothing and hairstyle, alongside separate identity/cleanup checks. Do not pass a valid HTTP200 image or unit test as visual acceptance. A production automated visual-fidelity gate remains NOT IMPLEMENTED. Incident stays OPEN.
