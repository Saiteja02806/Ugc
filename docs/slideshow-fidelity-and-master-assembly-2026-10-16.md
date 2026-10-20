# Slideshow fidelity and master-slide assembly investigation

## Fresh production evidence

The release `d73ef153` deployed the preservation policy. The latest customer
batch `09e14462-478d-4a58-af80-d04a2cef4847` was submitted on 16 October
2026 at 14:46:29 IST and completed at 14:47:01–02 IST. It uses contract **v3**
and `gpt_image_2_5`, which the worker routes to **Sunburst**. Both provider
operations are `output_persisted`, with retries disabled after persistence.

The two jobs contain the same complete 979-character user prompt, selected
Marketing reference slides **1 and 4**, the uploaded dark Explore screenshot,
and the frozen business profile. Their base roles are respectively `[1,2]`
and `[2,1]`, with attachment `[3]`. Their shared batch/version identifies one
two-slide version. This is fresh evidence after rollout, not the older v2/Flare
case. Deploying v3 again or proposing Sunburst as an untested recovery does not
resolve this result.

The new supplied second output retains more of the original dark fireplace,
laptop framing and two-level headline treatment than the earlier output.
However, its white marketing website is visibly different from the uploaded
dark Explore page. The cover retains the headline's white-box treatment but
invents a busy office scene, numerous props and extra marketing copy.

## What failed, and what remains uncertain

- **Exact screen placement is missing as an operation.** The model receives
  images through `images.edit`; there is no screen rectangle/quadrilateral,
  mask, perspective compositor or protected surrounding-pixel region. V3
  explicitly requests the real screenshot but cannot force pixel insertion.
  This is an execution-method and acceptance gap, not evidence that the
  screenshot was omitted.
- **The background brief is underspecified.** Changing the cover background
  was expressly requested, but a specific new scene was not supplied. The model
  chose the scene and added unnecessary visual material. A per-slide brief
  should identify what may change and what must remain. Poor aesthetic fit must
  not be confused with a technical image-decoding or queue failure.
- **Inputs still contain competing material.** Both jobs receive all selected
  slide images, the full multi-slide prompt and the full business profile,
  including CTA ideas and visual keywords. V3 says these cannot override the
  reference. They still create interpretation work; source inspection cannot
  prove their exact causal weight in the model's output.
- **Completion has no visual-fidelity meaning.** The worker validates image
  bytes, normalizes and stores them; it does not verify screenshot matching or
  requested-only changes. Quality settings are provider defaults. There is no
  controlled evidence that increasing quality would fix the incorrect UI.
- Original references are flattened raster images. Exact original font files
  and editable SVG geometry were not provided; image prompting can approximate
  their appearance but does not recover the original layers.

## Confirmed assembly problems

1. Batch/version grouping already exists, but the screen renders version chips
   followed by individual cards in a forced one-column grid. It does not present
   one grouped strip of the version's images with a primary whole-version action.
2. `Use image in slide` calls `useImage`. Unless Recreate established a replacement
   target, that method appends to the current draft. `Edit version` instead calls
   `useSlideshow`, which replaces the sequence with the generated outputs.
   Automatic complete-version offering only applies to an empty draft.
   An existing two-slide draft plus a newly selected cover can therefore become
   three slides. This reproduces the mechanism; the screenshots do not establish
   the customer's exact click history.
3. A generated version contains only the selected outputs. Output slot 2 for
   selected master slides 1 and 5 is not master slide 2. The editor generates new
   position IDs and does not reconstruct the full master sequence.
4. The current editor admits owned ready media UUIDs only and has no original
   reference picker/import action. Catalogue originals are not automatically
   owned image assets. The legacy v1 save path can represent originals, but
   switching the current editor to that old path would lose current editable
   draft guarantees and is not a safe shortcut.
5. Marketing 01 actually has **12** reference slides, while the current editor
   and saved-slideshow contract allow **2–10**. Keeping all 12 is a separate
   limit decision. A picker must show the limit and never silently truncate.

## Simulation and validation

Eight existing grouping/catalogue tests passed. A bounded local helper
simulation formed one complete group from out-of-order outputs for master
slides 1 and 5. Current generated-only initialization yielded two slides.
The existing master assembly helper yielded the intended sequence:

`[new 1, original 2, original 3, original 4, new 5, original 6, original 7, original 8, original 9, original 10]`

The current v2 draft reader rejects null original-asset IDs, while the historical
v1 save reader accepts mixed original/generated choices. The assembly helper
is not wired into the current editor. Local simulation evidence lives under
`.codex-audits/slideshow-assembly-20261016/`; it is not production UI acceptance.

## Concrete correction design

- Show each generation/version as one container with ordered thumbnails side
  by side (horizontal scrolling on narrow screens), slot status, and one
  **Use this version** action. Keep a separate explicit replace/add action for
  an individual image. Archive the prior draft before switching versions.
- Offer **Keep other reference slides** and **Add from reference**. Preserve
  reference ID/source hash, original slide ID/number and output-slot mapping.
  Resolve catalogue IDs on the server, import/reuse selected originals as owned
  ready raster assets, and retain the current v2 save/editable-draft validation.
  Never accept arbitrary browser URLs as publishable source images. Importing
  unchanged slides needs no paid image generation.
- Assemble generated replacements in their original positions and retain the
  other chosen originals. Make the full ordered sequence visible before saving.
  Never merge another batch/version or replace a newer draft on a late result.
- For exact UI placement, add a separate screen-placement editor: confirm four
  corners, perspective-warp the actual uploaded screenshot into the approved
  image and preserve the surrounding pixels. Render exact headline/box layers
  separately when that precision is required. No image-generation workaround
  is implemented by this audit.
- Present a concise per-slide edit brief: original slide 1 allows a specific
  background and headline change; original slide 4 retains its scene and allows
  the specified text and screen replacement. Send only needed visual inputs
  and relevant business facts in a new versioned contract. Historical admitted
  jobs and paid-operation fingerprints must remain unchanged.
- Test partial completion, retry/reload, original ordering, source switching,
  duplicate actions, 10-slide capacity, stale results, owned-media access,
  save/reopen and scheduling. Keep model success distinct from user acceptance;
  do not automatically spend credits to repair subjective visual failures.

This investigation made no production changes and triggered no paid generation.
The correction design above is not implemented or deployed by this report.
