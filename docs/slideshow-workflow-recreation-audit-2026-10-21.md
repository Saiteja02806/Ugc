# Reference slideshow recreation: findings and correction design

21 October 2026. Investigation of manual Explore Slideshows, with one local
missing-attachment guard correction. The conversational editor, scoped generation
contract and screenshot compositor described below are proposed work, not shipped
features. Automatic Trending Carousel planning is outside this change.

## Verdict

The saved workflow completes image jobs, but it does not reliably reproduce the
requested edits. Input transport and billing/recovery tests do not establish
visual acceptance. A longer prompt or a chat transcript alone will not correct
the operation that currently asks an image model to redraw an exact screenshot.

The useful direction is one conversation that sees the images and maintains a
validated edit plan, followed by separate execution for generative changes,
actual-image placement and editable text. Users should not have to learn several
per-slide prompt forms or repeat all their requirements on each revision.

## Fresh production evidence

Read-only account-scoped production history was inspected through the connected
UGC Pilot tools and database. Recent general image jobs concern character work;
they are not slideshow evidence. The latest saved Explore slideshow batch found
for this connected owner is from **16 October at 20:45 IST**.

| Batch | Model/contract | Saved inputs | Observed result |
| --- | --- | --- | --- |
| `6506f728-4364-4533-a69b-c4e03b53e265` | Flare / v3 | Two selected reference slides; **zero prompt attachments** | Both outputs use the laptop/fireplace scene, including output slot 1 that should use the clothing-brand cover. Neither uses the requested real screen. |
| `09e14462-478d-4a58-af80-d04a2cef4847` | Sunburst / v3 | Same reference cover/laptop slides plus the uploaded Explore screenshot | The cover has the replacement headline but adds a busy office, signs and promotional props. The laptop output invents a light marketing website instead of the supplied dark Explore page. |

Latest batch jobs are `a9124ef5-70dc-47d2-b4fa-41c79c143ea2` (slot 1) and
`e3632c71-8e9a-4e6e-b88e-1c38503c8d40` (slot 2). They preserve different base-role
orders, `[1,2]` and `[2,1]`, but the physical provider-image order remains the
same and both jobs contain the full multi-slide instruction text. The images
were downloaded from their recorded output URLs and visually inspected; the
slot-1 error is not inferred from job status alone.

The latest prompt explicitly asks for “the provided screen image,” yet there is
no attachment role or third image. The present local preflight rejects that exact
saved prompt without an attachment. This establishes the stored-input gap, not
why the historical attachment disappeared or that the current fix is deployed.

Earlier jobs `981cbcfc-b37a-459b-9aeb-907bea7dbc78` and
`9a56a945-73ca-46df-adeb-97617474ad2d` do have the screenshot as image 3. Their
incorrect screen output demonstrates that restoring an attachment is necessary
but insufficient for exact reproduction.

Evidence is retained locally under `.tmp/slideshow-workflow-audit-20261021/`:
account-scoped job summaries, both references, and four exact generated outputs.
The prior `.tmp/slideshow-input-audit/attachment.png` was inspected as the real
dark Explore screenshot. These are local evidence, not new test generations.

## Current path and failure boundaries

1. The composer retains prompt text and owned attachment IDs by owner/source.
2. The API resolves references, validates uploads and freezes business context,
   slideshow positions and v3 role indices before queuing one job per output.
3. Each worker receives all selected slide images, the complete multi-slide
   request and the complete business snapshot. The designated base is identified
   through prose/indices. There is no compiled per-slide operation plan.
4. OpenAI receives the actual image files through `images.edit`. There is no mask,
   screen quadrilateral, protected-region compositor or exact text-layer contract
   in this path. Nano Banana also receives all selected image inputs.
5. Returned image bytes are validated, normalized and saved. The completion state
   does not evaluate the selected base, requested words, unrelated scene changes
   or screenshot identity.

`lib/explore/slideshow-prompt-plan.ts` explicitly accepts **text only**. The
sparkle feature cannot see selected images, read screenshot pixels, identify
which source contains the laptop or recover fonts. It is a wording helper, not
the proposed image-aware conversation.

Competing references/full-deck instructions are a plausible cause of the latest
base mix-up. The exact model-internal cause is not observable. These outputs do
not establish that Flare versus Sunburst, higher quality, or a particular new
prompt will solve it. An actual comparison is required before making such claims.

## Local correction implemented

The missing-screenshot helper used to ignore a whole sentence whenever it
contained `do not`, `don't`, `without` or `never`. Consequently:

> Use my uploaded screenshot inside the laptop, do not change anything else.

was considered not to need an attachment. Negation now applies to the matching
placement action. Positive requests before/after unrelated preservation wording
are detected; explicit exclusions remain valid, including curly-apostrophe
“Don’t use my screenshot.” This remains a conservative English preflight, not
general language understanding or proof that an arbitrary attached image is the
correct screenshot.

The same helper is consumed by the Create button and the server admission path.
The regression verifies **zero credit reservations and zero queued jobs** when
the needed attachment is absent, and admission with the unchanged prompt and
correct attachment role when it is supplied. Historical paid jobs, fingerprints,
provider settings and saved images are not rewritten.

## Proposed experience

Keep the existing Create → Edit slides → Schedule responsibilities and existing
save, reference picking, attachment, history and recovery actions. Introduce a
conversation in Create that understands the selected thumbnails and uploads.
The earlier one-box decision remains the current implementation; a conversation
is a newly requested direction, not permission to add per-image setup forms.

Example interaction:

- User: “Recreate this for UGC Pilot. Change the cover title and put this screen
  in the laptop. Keep the same style.”
- Assistant observes the actual source slides and upload, then states: “I’ll
  change the cover headline, keep its white label treatment, and place your dark
  Explore screenshot in the laptop on original slide 4. Other selected elements
  stay as they are.”
- If the user also wants a different cover background without describing one,
  ask that single consequential question, preferably with a few relevant choices.
  Missing screenshots, contradictory text, uncertain slide identity and unreadable
  text merit clarification; facts visible in the images do not.
- Show a compact live summary beside the same preview. Generate is the existing
  explicit action after resolving required inputs. Conversation turns do not
  automatically generate paid images.
- User: “Keep this version, just make the title smaller.” Update that text layer
  on the chosen slide; retain accepted images and neighboring slides.

When no ambiguity affects execution, proceed with an explicit conservative
assumption. Distinguish close editing from a requested creative redesign.
Do not let business-profile tone or CTA suggestions invent extra ad copy.

## Internal plan: the conversation must control something concrete

Maintain an owner-scoped server draft with a monotonically increasing revision,
reference/upload IDs and hashes, the original request, accepted decisions,
unresolved questions and per-slide operations. Keep original source positions
distinct from selected output positions. Never target a slide by the phrase
“second image” after the selection has changed.

Each planned slide needs:

- Stable position ID, original reference ID/slide ID/number, validated owned
  base-image ID and the chosen accepted version when editing an existing result.
- Requested changes and explicit preservation constraints, with their source
  user turn. Image observations and uncertain estimates are separate from user
  instructions. Text found in a reference cannot override application rules.
- Exact text strings plus editable layout/style layers where available.
- Attachment roles bound to the operation that needs them. Screen insertion
  includes the exact screenshot ID, four target corners and an explicit fit/crop
  choice; suggest corners automatically and let the user adjust when uncertain.
- Execution type, required unresolved input and an acceptance checklist.

Treat the planner model's response as a proposal. Server validation resolves
owned/catalogue identities, checks indices, readiness, bounds and source revision,
and refuses operations with missing required assets. A plan hash/revision joins
the existing idempotency and provider-operation fencing for a **new versioned
contract**. Existing v2/v3 retries keep their original effective prompts and
fingerprints. A late result cannot replace a newer approved draft.

Do not pass a growing transcript into every image request. Compile the relevant
instructions and inputs for that slide. For generative edits, make the target
base the first actual image; include only needed attachments and necessary
style context. Preserve relevant business facts and exclusions without turning
every fact into an instruction. Plan-level source identities preserve references
that are not physically needed in that provider request.

## Route each requested change to the right operation

| User intent | Execution | Acceptance |
| --- | --- | --- |
| Keep an original slide | Import/reuse the selected original; no image generation | Correct original/hash and order |
| Put this UI/logo/image in this region exactly | Composite the supplied asset with a validated region/perspective transform | Correct source, fit and region; surrounding pixels preserved |
| Change a headline or text size | Render editable text/shape layers with exact strings | Exact wording, bounds, contrast, no overflow |
| Change a photographic background | Localized generative edit; use region/mask protection where supported | Requested scene plus protected surrounding content |
| Redesign the whole slide | Explicit generative redesign | Agreed brief and visual review |

Perform generative work first, then compose precise assets and text last. Sending
the finished screen through another whole-image generation step can undo its
fidelity. A mask guides generative edits; deterministic recompositing of protected
source pixels supplies stronger guarantees outside the edit region.

A flattened reference does not contain its original SVG layers or font file.
Exact typography may require a supplied/licensed font, a reusable reference
template, or an explicitly accepted approximation. Extracting text/geometry and
removing old baked text is separate preparation work; adding new text over the
old text is not a complete edit. The current simple Remix Text styles do not
recover every source's typography automatically.

For this specific two-slide example, resolve the requested cover background,
prepare its clean background/label layout, render “Everything you need to start a
SaaS” separately, and use the **original laptop photograph** as the screen slide's
base. Replace its old heading region separately and composite the real dark
Explore screenshot in its display. There is no need to ask a model to invent a
new UGC Pilot website. Leave other originals as an explicit user selection and
retain the existing 10-slide limit until a separate limit change is implemented.

## Verification before claiming the quality problem is solved

Use the actual historical request/assets as a fixed benchmark, plus text-only,
single-slide, background, multiple-attachment and follow-up-edit cases. Compare
the current pipeline with scoped generation and with the proposed mixed renderer
using the same base/brief/model/settings. Repeat enough to observe variability;
one attractive sample is not a reliability measurement. Record cost and latency.

Evaluate each requested property independently: correct base slide, exact words,
preserved scene/typography where required, actual screenshot, absence of invented
claims, per-slide scope and deck order. OCR/vision checks can flag problems but
cannot certify exact pixels or replace the user's visual acceptance. Exact-source
compositing permits stronger source/region/protected-pixel tests.

First generate a small representative preview; allow whole-deck generation after
the direction is accepted. Failed checks should identify the specific slide and
operation. Repair that operation from the last accepted version, with bounded
cost and explicit generation actions, rather than repeatedly regenerating the
whole deck. Save/reopen, source changes, account isolation, interrupted requests,
partial completion and stale revisions must also pass on production.

## Validation completed in this investigation

- Worker TypeScript build passed.
- **71 distinct checks passed** across the image admission, composer, prompt
  rewrite, grouping, assembly and image-worker suites. Provider/storage boundaries
  were stubbed; these are transport/recovery regressions, not new model outputs.
- Updated real-component browser fixture passed text-only rewrite, owned
  attachment recovery after reload, owner/source isolation, unavailable-media
  recovery, missing-screen blocking and the new scoped-negation cases. Windows
  sandbox initially prevented Edge startup; the isolated rerun passed outside it.
- Application TypeScript passed. Scoped ESLint has zero errors and two existing
  unused-variable warnings in the browser fixture (`savedPng`, `uploadCount`).
- Two real references, four stored generated outputs and the actual uploaded
  screenshot were visually inspected. No new paid image/text generation ran.
- Production `/explore/slideshows` redirects this browser to sign-in. Final
  signed-in production UI acceptance and a fresh controlled quality comparison
  remain unverified. No deployment, database write or saved customer-media change
  was made.

## Implementation order

1. Release the tested input guard through the normal web release and verify it
   signed in. This prevents a class of invalid requests; it is not the full
   visual-quality repair.
2. Build the image-aware conversation and validated revisioned plan behind a
   feature flag; preserve the present composer as a fallback.
3. Add the exact screenshot placement and text-layer operations; compile isolated
   per-slide generative work through a new frozen contract.
4. Run the real benchmark and production save/reopen/selection flow before
   broad enablement. Retain per-operation costs and quality findings in receipts.

Official OpenAI guidance supports conversational image editing through the
[Responses API](https://developers.openai.com/api/docs/guides/image-generation#multi-turn-image-generation).
That is an available implementation option, not a requirement to replace the
current durable image worker. Its documented
[text-placement, consistency and composition limitations](https://developers.openai.com/api/docs/guides/image-generation#limitations)
support keeping precise rendering separate. The current models and parameters
should be checked against the [image edit API](https://developers.openai.com/api/reference/resources/images/methods/edit)
before adding masks or new provider options.
