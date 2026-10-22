# Hook starting-image scene adherence, 21 October 2026

The reported image is a real generation failure. The selected Hook opens with a
performer at a pink keyboard in a purple-lit room, but the generated image uses
the bedroom and gray top from an identity photo. UI spacing is a separate issue.

## What the production evidence establishes

A read-only audit recovered the existing Google interaction and its retained
inputs; no new inference was submitted. Google received the canonical scene PNG
first, main face photo second, supporting photo third, and the complete compiled
scene-preservation prompt. The retained scene bytes match the decoded-frame SHA
in the job receipt. The actual model was `gemini-3.1-flash-image`, selected by the
existing worker environment override. The raw model output itself uses the
bedroom scene; its bytes match the staged provider image. The final PNG is the
normal resized derivative of that output, not an input-photo fallback.

This establishes a model instruction-following/scene-adherence failure in this
example. It does not establish a missing scene input, reversed references,
incorrect result selection, or an unsupported Google edit-mode declaration.
Google's documented Interactions image-editing API accepts image blocks plus
text and returns the generated image in `output_image`.

Sanitized incident evidence is local under
`outputs/hook-keyframe-incident-2026-10-21/interaction-readonly.json`. Customer
portraits and retained interaction contents are not committed as fixtures.

## Scoped correction

New Hook still requests declare receipt structure version 2, the selected
`imageModel`, and image `promptVersion: 2`. Their preparation key includes the
selected model. The worker includes that receipt in the existing request
fingerprint. Legacy structure-version-1 receipts and their original input keys,
provider fingerprints and recovery remain unchanged.

New drafts default to Gemini 3 Pro; users can choose Gemini Flash in the compact
image-model selector. Pro explicitly uses `gemini-3-pro-image` at 2K. New selected
Flash requests explicitly use `gemini-3.1-flash-image` at 1K, independently of the
general generator's `GEMINI_IMAGE_MODEL` override. Both use multi-image editing
with bound labels and source-byte validation. Pro supports up to five selected
person photos in this workflow; Flash up to four. The scene is transmitted as a
separate base image. Neither choice is qualified as solving facial fidelity.

Both choices retain the existing shared app image-credit policy (currently one
credit in production). The free cost endpoint quotes the selected model and the
submission reserves that same policy amount; no new provider-dollar multiplier
is invented. Model changes invalidate the previous starting-image selection and
approval without silently deleting selected photos.

Saved legacy drafts remain Flash during accepted-request recovery. A deliberate
new generation upgrades their input identity to the model-aware schema. A cached
old client may recover its existing omitted-model request; a fresh omitted-model
request gets a precredit refresh message instead of silently selecting a model.

- Bind a text label immediately before each actual image block:
  `BASE_SCENE_TO_EDIT`, `MAIN_FACE_IDENTITY`, then supporting facial views.
  These are explicit prompt labels, not undocumented provider API roles.
- State that the base frame supplies the complete scene, pose, clothes, hair,
  expression and lighting; identity images supply facial structure only.
- Add only the source-hash-matched, statically reviewed frame-zero opening-state
  description to the still prompt. Do not import motion beats, ending actions,
  stale source descriptions or unreviewed notes. Prompt preview and API use the
  same compiler.
- Before any new V2 Google submission, verify the actual downloaded base PNG's
  SHA-256, MIME, PNG header and width/height against its saved receipt. A mismatch
  throws a request-not-submitted error; no Google create call occurs.
- Keep legacy provider wire requests/fingerprints and accepted-result recovery
  unchanged. No automatic paid retry, global fingerprint bump, model upgrade,
  new quality heuristic or speculative face crop is introduced.

The new worker must be deployed before enabling website submissions with the V2
prompt. Existing stored results remain recoverable throughout that release order.

## Verification and limits

Worker TypeScript build and scoped ESLint pass. The focused suites pass 115 tests:
46 API/result/prompt-preview/draft/client checks and 69 worker/provider/receipt,
generic-image, influencer, slideshow and image-output regressions.
Tests inspect exact scene/main/support bytes and adjacent labels, reject changed
scene bytes, MIME, dimensions, order and prompt before Google create, and confirm
accepted legacy requests recover without recompiling or redispatching. Model
tests verify default Pro and explicit Flash routing, quoted credit equality,
selected-photo limits, changed-model request conflicts, stale result invalidation,
completed Pro result admission, and Pro interaction recovery without a new create.

These checks verify request correctness and compatibility. They do not show that
the new prompt produces a better image. No paid comparison, deployment, database
write or replacement of the user's existing image occurred during this change.
The model still performs generative editing; this code does not provide a mask,
pixel lock or guarantee of facial fidelity. Visual source/face review remains
necessary before the separate paid animation action.

Primary provider documentation checked:
[Google image generation and editing](https://ai.google.dev/gemini-api/docs/image-generation)
and [Interactions overview](https://ai.google.dev/gemini-api/docs/interactions-overview).
