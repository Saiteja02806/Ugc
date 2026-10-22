# Hook starting-image white edge strips: 21 October 2026

## Confirmed cause

The thin white strips in the user's generated bedroom image were introduced by
our output normalization. They are separate from the provider's failure to keep
the keyboard scene.

Read-only inspection of the existing completed job
`808b8505-90e7-4adb-9654-fa5918a22125` found:

| Image | Dimensions | Entirely white columns |
| --- | --- | --- |
| Original scene | 720 × 1280 | None |
| Main person photo | 1122 × 1402 | None |
| Raw provider output | 768 × 1376 | None |
| Stored final output | 720 × 1280 | 0–2 and 717–719 |

The raw provider image has aspect ratio 0.5581395 instead of 9:16 (0.5625), a
0.7752% difference. The old composition-preserving `contain` resize scales it to
approximately 714.42 × 1280, rounds the image width and fills the remaining three
columns on each side with white. Reapplying that transform to the retained raw
provider bytes reproduces the stored final PNG byte-for-byte.

## Bounded correction

`prepareAIStudioImageOutput` accepts an opt-in `cropNearRatioPadding` policy.
Only new Hook image jobs with the model-aware version-2 receipt and version-2
prompt enable it. Existing accepted version-1 jobs, ordinary image generation
and slideshow transformations keep their previous behavior.

When a uniform, centered `cover` resize would remove at most 1% of either image
extent, including conservative pixel rounding, the new policy uses it. It never
stretches the horizontal and vertical axes independently. For this actual
768 × 1376 provider response, a uniform scale of 0.9375 produces 720 × 1290;
cropping five output pixels from the top and five from the bottom yields
720 × 1280 without the white side strips. Facial proportions retain the same
uniform scale. This crops only the newly generated provider image, not the Hook
source video, extracted source frame or uploaded person photos.

If a larger crop would be necessary, normalization retains the complete image
using the existing `contain` fit. Larger aspect mismatches can therefore still
produce padding. This change does not introduce a quality rejection, additional
provider request, credit reservation or a billing change. It does not remove
white borders already drawn into the provider's own image.

The current output metadata has no transform-policy field; no schema or output
identity changes were added for this correction. Existing stored images and
accepted operation receipts are not altered or reprocessed automatically.

## Verification and limits

- Worker TypeScript build passes.
- Seven image-output tests pass, covering ordinary outputs, slideshow edge
  preservation, the exact 768 × 1376 incident dimensions with four edge markers,
  landscape rounding, and larger/boundary ratio mismatches retaining legacy fit.
- Scoped lint passes.
- A local transform of the retained raw provider image has zero entirely white
  columns; the old final image has three on each side. Its aspect-preserving
  crop removes 10/1290 of the scaled height (0.7752%).
- No new paid inference, production media change, database write or deployment
  was performed in this verification.

The locally normalized image still shows the wrong bedroom scene because that
was already present in the provider response. Removing normalization padding
does not solve scene preservation or qualify facial fidelity. That requires
separate visual validation of the revised image-generation request.

Ignored local evidence is under
`outputs/hook-keyframe-incident-2026-10-21/`: `edge-padding-receipt.json`,
`output-transform-receipt.json`, `edge-padding-local-fix-receipt.json` and
`output-no-normalization-padding-local.png`.
