# Slideshow live input and prompt-history audit — 16 October 2026

This is an investigation, not a deployed correction. Production database reads
were owner-scoped. No paid generation, production mutation or deployment was
performed. Times below are Asia/Kolkata (UTC+05:30).

## Confirmed production evidence

| Request | Result | Actual generation inputs |
| --- | --- | --- |
| 14:46:29, jobs `981cbcfc-b37a-459b-9aeb-907bea7dbc78` / `9a56a945-73ca-46df-adeb-97617474ad2d` | Both completed at approximately 14:47:01–02; selected Sunburst | Prompt 979 characters, v3 contract, two Marketing catalogue images plus the uploaded Explore screenshot. Attachment indices `[3]`. |
| 20:45:24, jobs `a9124ef5-70dc-47d2-b4fa-41c79c143ea2` / `e3632c71-8e9a-4e6e-b88e-1c38503c8d40` | Both completed at 20:45:48 / 20:45:54; selected Flare | Prompt 620 characters, v3 contract, only the two Marketing catalogue images. Attachment indices `[]`; the uploaded screenshot is absent. |

The two latest reference URLs are the catalogue originals ending
`77e936eaeddc8d3a1c5a341449dad60c986405aeb4d2582192d9673e5d1b34c2.jpg`
and `f8129bf7e149d4521d225690299556360be88e4a14de99e82364f45ace4f4b02.jpg`.
The previously uploaded Explore screenshot asset
`7a025351-906c-43d1-83d7-166fe8580004` still exists and is ready (1763×842).
An existing uploaded asset is not automatically an attachment to a later request.

The star rewrite really ran in production at 20:45:06. Receipt
`416ff147-73a3-431e-9794-8a725227774b` records `gpt-5.6-luna`, the 979-character
original and the 620-character result. SQL equality checks prove both latest
job prompts equal that result exactly. The rewrite retained the instruction to
place the supplied screen inside the desktop. It also returned a clarification
asking what should replace the cover background; generation was allowed anyway.

The image jobs retained business context. The text rewriter receives only the
user's text, as requested; it cannot verify that an uploaded file is attached.
Stored provider operations confirm OpenAI execution/output persistence. Their
final metadata retains output dimensions/staging keys rather than a complete
provider payload manifest, so do not claim an independent provider-side attachment
receipt from these rows.

## Root causes and limits

1. **Latest generation lacked the required screenshot.** The composer submits
   `referenceImageAssetIds` only when its current `instructionReferences` array
   is nonempty (`components/workspace/ugc-chat-workspace.tsx`, approximately
   lines 243 and 678). That selection is component state, not an ordinary saved
   composer attachment draft. Remounting loses it. Admission requires some
   reference, so catalogue images alone satisfy validation even when the text
   requests an uploaded screenshot. The database proves the missing attachment;
   it does not establish which browser action removed or failed to restore it.
   The star hook changes prompt text and does not clear image selections.

2. **The implemented operation is full-image generative editing.** When uploads
   are included, the API resolves them under the owner and adds them to reference
   URLs; the worker downloads the actual bytes and supplies all images to
   `client.images.edit` (`worker/src/lib/openai-image.ts`, lines 23–32).
   There is no screen polygon, perspective transform or screenshot compositing
   stage. The v3 prompt already asks for the actual UI and forbids an invented
   dashboard; text alone does not enforce this. Earlier valid attachment delivery
   therefore does not prove visual fidelity. OpenAI's official guidance explicitly
   recommends compositing for regions that must remain pixel-identical:
   https://developers.openai.com/api/docs/guides/image-prompting.

3. **Prompt history has a real retrieval/persistence omission.** Latest media
   assets `23158269-6854-4b6f-947f-0065c93bee5e` and
   `11ae3c51-c148-4645-bf2a-338c28e10802` lack prompt/model metadata. The live
   `complete_background_job` function inserts backgroundJobId/jobType/provider
   but never copies the submitted prompt. `generate-image.ts`'s output builder
   omits prompt too. `/api/media` enriches image rows with slideshow position,
   not the job prompt, whereas the result mapper reads only metadata.prompt.
   Browser-local prompt fallback can conceal this until another browser/session
   or unavailable local state. The prompt is recoverable from the saved job;
   it was not lost everywhere and was not omitted from the provider prompt.

4. **Potential competing context remains, but is not proven as the cause.**
   Every output receives the full multi-slide user instruction and business
   context before slot/reference guidance. This can be simplified, but no
   experiment here establishes its causal effect. It cannot explain away the
   latest missing screenshot or provide exact placement.

## Corrections justified by this evidence

- Persist and restore owner/draft-scoped attachment IDs with the composer text;
  revalidate ownership/readiness before submission. Make the current attachment
  selection visible and stop a requested uploaded-image replacement when its
  required file is absent. Preserve the user's one-prompt workflow.
- Recover image history prompt/model from the linked owned job, and persist
  sufficient generation provenance for new results. Cover legacy jobs without
  prompt metadata and clean-browser history in regression tests.
- For literal screenshot placement, perspective-fit the supplied screenshot into
  a chosen/confirmed screen region after any requested generative changes.
  Preview cropping/fit and occlusion; keep the original screenshot asset rather
  than asking an image model to reconstruct it. This operation remains unbuilt.
- Keep clarification feedback separate from a claim that the task is ready.
  A missing required attachment must block submission; unresolved optional
  creative choices need an explicit product policy rather than invented detail.
- Save a request manifest (attachment IDs/order/roles, model, user text and
  effective provider prompt/version) for diagnosis, plus separate technical
  completion from user approval. Do not claim automated visual correctness
  merely because an image file was stored.

## Verification and scope

Fourteen existing media-result, prompt-rewriter schema/client and mocked API
tests pass using Node's transform-types loader. They verify rewriting and mapping,
not real screenshot fidelity; the media mapper test explicitly accepts undefined
prompt when metadata lacks it. Production records provide the runtime evidence
above. No new model comparison or visual-quality benchmark was run, and there
is insufficient evidence to promise that switching models fixes these failures.
