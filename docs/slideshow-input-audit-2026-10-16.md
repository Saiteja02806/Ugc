# Slideshow input and prompt audit — 16 October 2026

Read-only production investigation. No generation requests, credits, production
writes or behavior changes were made.

Follow-up: the reference-preserving v3 prompt policy has since been implemented
locally. See [implementation and verification](slideshow-reference-preservation-2026-10-16.md).
The historical findings below describe the audited v2 batch; they do not claim
deployment or visual acceptance of the follow-up.

## Production batch matching the screenshot

Batch `618eb823-1cb6-4e0d-9456-c2993aedbfb8` was admitted on 16 October at
01:17:30 IST and completed around 01:18 IST. Its two jobs are
`2f430de6-5979-43af-8e76-0d02f10701c6` and
`8c760045-ac41-411b-a558-a8d8741abd3e`. Both used GPT Image 2.5 Flare,
one version with two 4:5 slides, and completed provider operations.

Both jobs contain the applied UGCPilot business-profile version 2 snapshot:
business name, product summary, SaaS-founder audience, category, problem,
promise, tone, value propositions, pain points, differentiators, visual
keywords, CTA ideas and claims to avoid. They do not crawl the website URL
from the prompt; these facts come from the saved Settings profile.

Both jobs contain these three image inputs, in this order:

1. Marketing catalogue slide 1 (`slide-1-77e936eaeddc`): clothing-brand cover,
   person seated among parcels and the white headline background.
2. Marketing catalogue slide 5 (`slide-5-e556e747aa2d`): dark laptop scene,
   Pinterest screen and “Inspiration? Pinterest” headline.
3. Uploaded asset `7a025351-906c-43d1-83d7-166fe8580004`, named
   `Screenshot 2026-10-16 011600.png`: the dark UGCPilot Explore screen.

Only the two selected catalogue slides were included, not all twelve. The
second output corresponds to original slide 5, not original slide 2. The saved
user instruction names a “cheap mockups” reference, while selected slide 5
actually shows Pinterest; this is a concrete image/instruction mismatch worth
making visible, rather than silently deciding which reference the user meant.

Slide 1's roles are style `[1,2]`, attachment `[3]`. Slide 2's roles are style
`[2,1]`, attachment `[3]`. The byte/image order remains `[1,2,3]`; only the
primary layout role changes. Thus each output gets both style images and the
uploaded attachment, with its intended primary layout identified explicitly.

## Prompt and provider path

The UI submits selected reference URLs, uploaded asset IDs, the complete user
instructions, model, ratio, slide count and version count. The API checks owned
attachments and trusted references, loads the applied business context, freezes
roles and output positions, and queues one job per slide/version.

The worker constructs each prompt as:

1. Output ratio/composition guidance.
2. Selected slideshow style roles, described as inspiration for composition,
   lighting and atmosphere.
3. Attachment role mapping, described as person/product/object/background or
   other guidance according to the user's instructions.
4. Default no-reference-overlay-text guidance, with an explicit exception for
   visible text requested by the user.
5. The user's complete multi-slide instructions, unchanged.
6. Saved business facts and a general instruction to adapt the slideshow.
7. The output's version/slide position and a one-image-only instruction.

For this batch, each reconstructed prompt is 4,083 characters. Both prompts
were replayed through the real worker with provider/storage stubs. Captured
provider calls contained all three images, the saved facts, the unchanged user
instructions and the correct slide position. The computed operation
fingerprints matched the persisted production operation fingerprints for both
jobs. OpenAI operation records are `output_persisted` with provider request IDs.
The actual adapter downloads the images and supplies image files to
`images.edit`; they are not just URLs written inside a text prompt.

Exact historical HTTP request bodies are not retained. The prompt files here
are reconstructions from saved inputs using the matching worker path, supported
by provider-operation records and a successful boundary replay, not a claim to
have recovered a historical wire capture.

Validation: 30 API/business-context tests, 21 image-worker tests and the dedicated
production-input replay passed. All provider calls in these tests were stubbed;
no paid generation occurred.

## Findings

- The latest batch's transport includes all requested categories of input.
  There is no evidence here of a dropped upload or missing business context.
- An earlier two-output batch at 20:13 IST on 15 October, including job
  `70f999c6-2019-4910-846a-68d4b54dca92`, contains five references but no
  business-context snapshot or slide-position grouping. The old omission was
  real; do not describe all historical generations as having business context.
- The current reference contract is broad style adaptation, not a strict
  minimal-change edit. Strong preservation wording is only added for an explicit
  regeneration/edit target; this new two-slide batch has no regeneration target.
- Every output receives the whole multi-slide instruction text. No per-slide
  instruction extraction separates the first-image change from the second-image
  screen replacement. This creates scope ambiguity and a plausible route for
  layout or attachment use to spill into the wrong slide.
- The uploaded Explore screenshot was visually inspected. The output shown in
  the user's screenshot was also inspected: it depicts a fabricated white
  dashboard instead of preserving the uploaded dark screen. Inclusion as a
  reference is confirmed; faithful screen reproduction is not achieved.
- The prompt permits rendering user-requested text but supplies no guarantee of
  matching the reference font/shape or preserving a screenshot's pixels. Existing
  caption defaults and loose style guidance can compete with precise-edit intent.

## Suggested correction, not implemented by this audit

For requests to make small changes, explicitly use the corresponding selected
slide as the base image, scope the requested changes per output, and preserve
everything else. Identify the uploaded screenshot as the exact screen content
for the relevant slide. If exact UI fidelity is required, composite the actual
screenshot into the device screen instead of asking an image model to redraw it.
Keep business facts as supporting context rather than permission to redesign.

Local evidence is under `.tmp/slideshow-input-audit/`: `jobs.json`,
`slide-1-captured-provider-prompt.txt`, `slide-2-captured-provider-prompt.txt`,
`attachment.png`, `output-slide-1.png`, `output-slide-2.png`, and the passing
`provider-replay.test.mjs`. These files contain this account's inputs and should
remain local audit evidence.
