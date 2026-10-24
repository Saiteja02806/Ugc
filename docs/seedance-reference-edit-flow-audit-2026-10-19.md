# Seedance prompt and reference delivery audit — 19 October 2026

The supplied prompt requests selective editing of the original footage. The
production Hook flow implements Seedance reference generation, not Seedance
source-video editing. The files and full prompt are present; the operation,
audio controls and duration contract do not express the requested edit.
These are verified request mismatches. They explain why the current flow
cannot promise this task, but do not reveal the model's internal reason for
each unchanged facial detail or caption. No new paid generation was run.

## Evidence tied to the actual job

- Job `a9619070-8517-4d56-b213-d44bab46c141`, provider task
  `task_01a154d2b81773e9b0c01d62ddb32fff`, worker commit
  `fac61da34608dc3f4414702ab87f3f332bdcc14f`.
- The supplied `C:/Users/chund/Downloads/cdd.mp4` SHA-256 exactly equals the
  saved reference asset: `ebd7d9a28d393319a8326d51cde1220d7768d3914498e00adf4efa6c8caf14ee`.
  Its duration is 3.166667 seconds, 720×1280, 30 fps, no audio track.
- Read all three public production image inputs and compared decoded pixels
  with the three attached PNGs. Each matches one attachment exactly. Raw PNG
  hashes differ from the clipboard copies, but decoded pixels match; there
  was no thumbnail substitution, image loss or visual quality reduction here.
- Saved/provider image order is bed (`@Image 1`, attachment 1), sofa
  (`@Image 2`, attachment 3), car (`@Image 3`, attachment 2). This is the saved
  selection order, not evidence that the UI reordered an original selection.
  Images and videos have independent 1-based numbering at the provider.
- The saved 2,027-character prompt includes all supplied sections. Direct
  worker prompt construction trims surrounding whitespace and does not use
  the UGC template, add a competing Hook script, or truncate this prompt.
- Executed the exact deployed worker job, private-media resolver, prompt
  builder and ReAPI adapter offline with the original saved inputs. Only
  storage/database boundaries were stubbed and the final fetch was intercepted
  before network access. Reconstructed request fingerprint equals the saved
  operation fingerprint `c2369fe9e38579e3c75675eb0d895f48370704d0bcd841d273efa11856827747`.
  Captured prompt, three ordered image URLs and source-video URL are identical
  to the saved inputs. This is reproducible transport construction evidence,
  not a claim that a historical raw HTTP request log was stored.

## Reconstructed provider payload

The `@Image`/`@Video` entries below are readable placeholders for verified
production URLs; the original prompt itself does not contain these tokens.

```json
{
  "model": "doubao-seedance-2.5-face",
  "prompt": "[full saved prompt, preserved verbatim]",
  "duration": 4,
  "size": "9:16",
  "resolution": "720p",
  "content_filter": false,
  "generate_audio": true,
  "output_format": "mp4",
  "omni_reference_task_type": "reference",
  "image_urls": ["@Image 1", "@Image 2", "@Image 3"],
  "video_urls": ["@Video 1"]
}
```

The actual returned output is 4.064 seconds, 24 fps, with an AAC audio track.
An inspected frame retains the source captions. Completion and distinct file
bytes do not establish successful selective face replacement or text removal.

## Confirmed operation and control gaps

1. **Seedance source edits are not implemented through this flow.**
   `components/video/video-generation-workspace.tsx` computes workflow editing
   only for `google_omni`. `lib/ai-studio/video-generation-api.ts` rejects
   explicit edit mode on Seedance, and the worker input parser does likewise.
   The ReAPI adapter hardcodes `omni_reference_task_type: reference` whenever
   any reference is attached. A prompt asking to change only the face does
   not change those structured controls. The existing admission regression
   correctly preserves references while deliberately avoiding Omni edit
   semantics; it does not establish that Seedance has its own source-edit path.

2. **Silence is not represented as a structured setting.**
   The adapter unconditionally sends `generate_audio: true` for Seedance.
   "No audio generation" remains prompt prose, while the explicit API setting
   requests an audio track. This saved job has no selected catalogue soundtrack
   or reference audio. Its AAC track is already present in provider output.

3. **Timing preservation is not represented.**
   This request uses a fixed 4-second output for a 3.166667-second source,
   and fixed portrait framing. ReAPI's documented edit contract is
   `omni_reference_task_type: edit`, `duration: -1`, `size: adaptive`, with
   a **4–30-second source**. The provided clip is below that documented source
   minimum. Simply replacing `reference` with `edit` would create an invalid
   request for this clip and is not a complete correction.

4. **Prompt references can be made unambiguous.**
   "Second reference image" was forwarded as written, without explicit
   `@Image 2` or `@Video 1`. Provider docs prescribe numbering independently
   within each media type. The saved second image is the sofa portrait; the
   car portrait attached second in this chat is the saved third image. Explicit
   role instructions should say which source to edit and which images supply
   facial appearance only, excluding their clothing, scenery and pose.
   This is a prompt clarity improvement, not proof that the model miscounted.

## Correct implementation direction

- Add an explicit operation choice for source editing versus reference
  recreation; carry it through browser, API admission, atomic queue input,
  provider request, request fingerprint and recovery. Do not infer a paid edit
  operation from arbitrary prompt keywords or silently change all Hook jobs.
- Implement Seedance-specific edit validation and its `-1`/adaptive contract;
  the current Omni-only `referenceVideoMode` semantics cannot just be reused.
  Preserve ordinary reference generation and historical operation recovery.
- Expose generated-audio control and carry the selected boolean through all
  request/receipt/recovery layers. A silent request needs `generate_audio: false`
  and output track validation. Do not depend on text instructions alone.
- For this 3.17-second clip, either choose a validated edit route supporting
  that length or obtain an eligible source with the user's agreement. Do not
  silently pad, loop, slow down or replace the source to meet the minimum.
- Number displayed references consistently with the saved provider order.
  Keep user text intact and offer explicit role directions, not hidden text
  changes that alter an in-flight or recovered job's fingerprint.
- Verify any future paid edit output for captions, motion, timing and requested
  appearance. Correct request parameters do not guarantee pixel-identical
  untouched areas or successful facial transformation on every take.

The earlier collector-host correction only enables retrieval of this provider
result. It does not change the result's creative content. Do not conflate the
two fixes or submit the same generation again expecting a different result.

## Prompt draft for an eligible source-edit operation

This is a proposed wording correction, not a tested generation recipe and
not a request to submit the current underlength source:

> Edit @Video 1 directly. Replace only the visible performer's facial appearance
> with the appearance shown in @Image 2. Use @Image 1 and @Image 3 as additional
> facial reference views. Use the images only for facial appearance; do not copy
> their rooms, clothing, hairstyle, pose or camera framing.
>
> Preserve the source clip's body, clothing, hairstyle, room, lighting, shadows,
> camera motion, framing, actions, expressions and timing. Remove every existing
> caption and text overlay, reconstructing the background beneath it. Keep the
> requested facial change consistent throughout the shot. Return a silent video
> with no dialogue, speech or added lip-sync.

## Sources and reproducible receipts

- [ReAPI Seedance request fields, media labels and edit constraints](https://reapi.ai/docs/seedance-2-5).
- [Provider's source-edit versus motion-transfer comparison and limited sample](https://reapi.ai/resources/higgsfield-genjutsu-alternatives).
- `outputs/seedance-prompt-flow-audit-2026-10-19/deployed-request-replay.json`.
- `outputs/seedance-prompt-flow-audit-2026-10-19/input-image-mapping.json`.
- Local replay scripts: `.tmp/seedance-prompt-flow-replay.mjs` and
  `.tmp/seedance-image-input-audit.mjs`.

No product source changes, merge, deployment, provider submission, production
database write or billing change was made in this prompt-flow investigation.
The earlier collector fix remains a separately tested local correction.
