# Hook 100 real image trial — 26 October 2026

Result: FAILED image acceptance. One real image request completed; zero video
requests were submitted. All other public and private references remain unchanged.

## What was tested

The user explicitly requested one real Hook 100 image-first test, comparison to
the original t=0 frame, followed by video review before expanding to other cases.
The connected MCP image tool supports only one reference, so it cannot exercise
this three-image pilot. The isolated trial used the application's actual
`buildHookFullRecreationOpeningImagePrompt`, v4 receipt validators, v5 image
labels and `buildGeminiImageRequest` with the configured Google credential.
This verifies a real prompt/provider inference, not the deployed website's
authentication, job/credit admission, storage or queue lifecycle.

Model: `gemini-3-pro-image`, 2K, requested 9:16. Prompt version 5. One image.
The influencer was the previously used, owner-verified uploaded asset
`495d8905-7a1b-4cbf-a38f-7a526a4dbff5`, Softly Lit Neutral Bedroom Portrait.

Source: `explore-paired-hook-fc44f6214b6e17413600ec13`.
Source SHA-256: `405670a27856c31e698a0ef13b178ece82c18cc379c0cec7489b0c1c1414fa1e`.
All 112 source frames were re-inspected across four native-frame contact sheets
for this trial. Original source duration is 3.733333 seconds at 30 fps.

| Provider input order | Actual retained bytes / SHA-256 |
|---|---|
| Original opening, frame 0 / t=0 | 755421 / `9eb3c117dbf181a870d89fb3c4b3f4495e10cfe435aa035140e079d4e1218f26` |
| Later clarity frame 70 / elapsed 2.333333 s | 883352 / `df452e82eadb2e7ed8338f34e2424e623b59ef4015d646a2a3c89d63a34d5a9c` |
| Influencer identity portrait | 2470091 / `640669439c0ec80020bcaaf03dc76ccbc51c39d0fc1be42d6c0133f1899b920a` |

The retained interaction contains the exact ordered labels, three image hashes
and full prompt hash `c447077856ec062ee8383e3162d1800b0966e0d5986340229bf2a5d6c4096e03`.
The prompt explicitly requires removing captions, hook text, subtitles, emojis
and graphics. No input-role omission or prompt truncation was found in this
request. This does not establish the model's internal reason for retaining text.

## Visual review

| Criterion | Observation |
|---|---|
| Original t=0 posture | Preserved: round glasses on, fingers touching screen-right temple, off-screen-right gaze and parted mouth. The later glasses-off pose was not substituted. |
| Source scene | Broadly preserved: low tilted selfie, pale diagonal beams and windows, black ribbed sweater and white earbud. |
| Influencer identity | Plausible likeness in brows, eyes, nose, lips, freckles and skin texture; full acceptance remains limited by oblique angle and reflective glasses. |
| Anatomy | No obvious duplicated hand or fingers in this still; contact geometry is approximate. |
| Caption removal | FAILED: the original three-line caption remains prominently visible and readable. |
| Output framing | Native provider image is 1536×2752. Preserved without application resizing; full application output-normalization behavior was not exercised. |

The failed caption is the critical blocker. Animating it would carry the wrong
creator text into a clip intended to receive editable Remix text later.
The `ugc-starting-frame` procedure requires: “Only pass an approved generated
image onward to video generation.” The image was rejected, so the conditional
video stage and its frame-by-frame generated-output review remain NOT TESTED.

## Receipt and cost evidence

Completed Google interaction:
`v1_Chc1dHJlYXVEbEVyVFlqTkFQNC1HaC1ROBIXNXRyZWF1RGxFclRZak5BUDQtR2gtUTg`.

Provider usage reports 2327 input tokens (1680 image, 647 text), 1314 output
tokens (1120 image), 182 thought tokens, 3823 total. Settled currency cost was
not returned; no dollar amount is claimed. There was one inference create call
with SDK automatic retries disabled. Subsequent provider calls were reads only.
No video inference, application-credit changes, database writes, production
storage writes or deployment occurred.

Local evidence in `outputs/hook100-full-recreation-trial-2026-10-26/`:

- `trial-receipt.json`: frozen v4 frame/photo contract, operation, output and usage.
- `original-t0.png`, `clarity-anchor.png`, `identity.png`: verified references.
- `generated-opening.png`: actual reviewed provider image, losslessly decoded to PNG.
- `provider-image-original.bin`: unchanged provider image bytes.
- `image-prompt.txt`: complete submitted prompt.
- `retained-image-summary.json`: read-back labels, text and byte hashes without credentials/base64 payloads.
- `image-visual-review.json`: failure and explicit `approvedForVideo: false`.

## Changes and verification

Added `scripts/run-hook100-full-recreation-trial.mjs` and this report. Appended
trial evidence to `EXPLORE_CONTEXT.md`, `docs/ai-context/clear.md` and the existing
pilot verification receipt. No application runtime code changed in this trial.
Generated media/receipt files remain ignored local evidence.

Preflight: existing AGENTS/context/nonnegotiables and mandatory context,
immutable-contract, frame-analysis, starting-frame, video-prompt and regression
skills; connected create-media capabilities were checked before selecting the
application adapter path. `python tools/preflight.py`, script syntax, scoped
ESLint and local retained-input hash assertions provide the diagnostic checks.
The image model availability preflight and subsequent accepted interaction are
real external evidence. No UI was changed; no new production/UI acceptance is
claimed by this trial.

Incident: UGC-VID-006 recurrence, related UGC-VID-010. The latter's original-opening
pose contract passed in this image, but full recreation remains unqualified.

## Next correction

Keep the pilot narrow. Test an isolated cleanup correction that explicitly names
the three visible caption lines and their region while preserving opening pose,
scene and identity. If that still cannot reliably remove the text, evaluate a
reviewed clean source derivative prepared once. Do not crop away or blur the
source, silently process away the failed result, submit another paid request,
or expand prompts across other references without a separate deliberate trial.
