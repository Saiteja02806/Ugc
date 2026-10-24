# Starting-frame simplification and quality review — 23 October 2026

Status: deployment paused at the user's request. The approved picker/layout direction is now implemented locally; see [implementation evidence](explore-person-picker-implementation-2026-10-23.md). Generation-quality proposals below are distinct from these UI changes.

## Deployment boundary

The preceding combined release was already merged as main commit `4ba59522bf4f8229691674eaff450abae4ab65c4` (PR 83). Website production is Ready on `dpl_EGzBxh3cxcEVn9yiBRHj4SV8fuoq`; the generation worker is active on `ugc-ai-generation-worker-release67c3de6b`, with verified baked/runtime source `67c3de6b4a66c3083a98f9472ea8cb32cb6d5201` and pinned digest `sha256:4773fd915d06e03749de617b1f9fef2a33f9434ca91c4cc1a723b502be6834de`.

The separate MCP domain still resolves to the previous ugc-mcp deployment `dpl_FJQ4PJgBf1Nj9EBLvgjVYUZkmtRM`. Its remaining rollout is paused. The user-requested hover-only reference playback change has not been implemented or deployed. No rollback, new deployment, production configuration write or paid generation was performed during this review. Public release checks passed before the pause, but these checks do not prove the separate MCP target contains the new release.

## Existing generation evidence

Read-only database inspection identified the screenshot's two completed Hook 100 jobs:

- `3b63be1c-0f5d-411c-9d17-8e3473d36293`, 12:28:47 UTC.
- `f2458b9b-72cd-4aab-8fd5-8b325a44ed72`, 12:29:34 UTC.

Both saved requests use Gemini 3 Pro, prompt version 4, the same frame-zero source digest, two identical selected person asset IDs, empty custom instructions, and the same compiled prompt hash `374401abdd8a0ddf5a8852dd774692578a5063a2c0777fe63a0e04703a35923e`. The saved reference-image array contains three images: scene, main person, supporting person. The singular source field is a compatibility field; current worker code sends the array instead of appending that field as another image. The jobs have distinct generation/media identities and persisted Gemini provider operations.

The actual saved prompt already says:

> Omit creator-added captions, hook text, subtitles, emojis and graphic overlays.

It also includes the reference-specific opening description: low-angle selfie, round glasses, white earbuds, slightly open mouth, hand on screen-right touching the glasses. The screenshot visibly shows that one result retains the original caption. The other changes the background substantially. These are visible output-quality failures despite the instructions being present. This does not establish that the prompt alone, reference order alone or selected photos alone caused the failures.

The original caption is already reviewed in reference-text-catalog.json: “POV: you finally understand / how to use Claude / for marketing”, visible from 0 to 3800 ms. That exact caption and its location are not currently compiled into an explicit image-cleanup plan. The image builder uses only the opening-state description; the motion plan's camera/environment and wardrobe constraints are not individually represented in a frame-zero scene profile. Later motion beats must not simply be copied into a still prompt.

The production result resolver validates ownership, completed status, source/receipt identity, model, media provenance, dimensions and ratio. It does not inspect whether captions remain, whether the background drifted or whether the intended likeness was achieved. A successful provider job therefore does not mean the requested image succeeded visually.

Recovery of the two existing Google interactions using the locally configured credential returned 404. This does not establish whether they expired, belong to another credential/project, or are otherwise unavailable. The provider's exact retained wire inputs have not been recovered for these jobs; request claims above refer to persisted application evidence and current forwarding code. Browser use is currently disabled, so this review uses the supplied screenshot rather than a fresh live visual check. No new inference was submitted.

## Recommended interaction

Keep one focused Recreate workspace. Show the source plus the currently chosen person; remember the user's explicit person selection within their account so switching references does not require choosing again. When a person must be chosen or changed, expand the existing image library inside this workspace rather than stacking a second modal. Keep the library collapsed otherwise, preserving the prior requirement not to display every influencer's face by default.

Use sensible model/one-variation defaults and collapse advanced settings. A deliberate Generate action shows the price before submission. Show results in the same workspace. Keep one explicit review/Use frame step, since animation is another paid action and these failures demonstrate why automatic approval would be premature. Applying the frame closes preparation and fills the existing Create image box. Starting frames history remains available there for changing a prior approved choice. Do not make choosing, preparing, saving and using into four separate confirmation screens.

Reference cards should remain still until pointer hover or deliberate keyboard preview, pause/unload on leave, and use explicit tap-to-preview on touch. Merely scrolling cards into view must not start every video. This is requested behavior, still pending implementation.

## Recommended generation approach

Keep a stable shared identity/recreation contract, with structured, source-hash-bound frame-specific guidance. Vary the verified setting, composition, clothing, gesture/occlusion, gaze and expression, together with exact creator-caption regions/text to remove. Do not invent unrelated handwritten prompts per clip, infer later actions as opening poses, or discard the approved identity-first approach based on one failed scene.

For curated references, evaluate a reviewed clean source frame prepared once and reused, with the clean derivative bound to its original source and verified to retain scene/pose. This may separate text cleanup from identity generation; it still needs validation and does not guarantee identity fidelity. Do not blur/crop away the source scene or silently add a paid cleanup request to each customer generation.

Add an output review/check for creator text before presenting a result as ready. OCR is a useful signal, not proof that every overlay was removed; physical signs and clothing text must be distinguished from creator captions. Flag suspect results for correction/review, preserve them with their request identity, and never silently charge for retries. Keep human likeness/scene review until a representative comparison establishes reliable behavior.

Before changing the production prompt, compare the existing baseline with the proposed structured guidance on the same model, source and person photos across several references and people. Assess caption removal, scene/pose adherence and intended likeness separately. No additional paid comparison is authorized by this thinking pause.

## Additional issue: face photos alongside the starting frame

The user requests an optional Add face references control next to the selected starting frame in Create. The supplied screenshot shows a side-facing person with part of the face obscured; changing the starting frame works, but the user cannot supply clearer views for animation. This concerns video generation after frame approval, separately from the photos already used to generate that still.

Current code explicitly rejects combining startingFrameImageUrl with referenceImageUrls, avatarImageUrl or personReference in worker/src/jobs/generate-hook-video.ts. The Omni adapter also enforces separate starting-frame and reference modes. Adding a visible upload tile alone would therefore not implement this request. Provider support for a literal first frame plus separate appearance references must be verified per selected model and route before enabling the option; general multi-image support is not sufficient evidence.

Proposed behavior: retain the selected starting frame as the opening composition, and optionally reuse the explicitly selected influencer photos or let the user add/change clear photos of the same person inline. Show which photos will actually be sent. Update UI state, API validation, owned-asset handling, worker contracts and provider role mapping together, with tests that references are neither dropped nor treated as additional timeline frames. Do not promise perfect facial consistency. For unsupported routes, explain the limitation and offer a verified compatible route or revision of the starting image; never silently ignore the photos.

Prefer original clear person photos as appearance evidence. Generating extra frames is not the default remedy: synthesized views may introduce further facial differences and need separate review. Any model comparison requires explicitly scoped testing; no paid generation, runtime change or deployment was performed for this added issue.

## Additional issue: starting-frame placement and fragmented photo library

The user supplied two more Hook Recreate screenshots and asked to add this issue
and check other Explore workflows. This section records the review and proposed
solution. No application code, production state or generation request changed.

### What the screenshots and current code establish

- The generated frame is in a separate full-width section below the inputs,
  although substantial space remains beside the selected person. A single result
  occupies a narrow centered card in that lower section. Settings consume a large
  bordered area above the actual result. The current structure explains this:
  `components/explore/hook-starting-frame-workspace.tsx:541` renders the gallery
  after the input body; `hook-starting-frame-workspace.module.css:114` reserves
  the top row for source/controls, and `:143` stretches gallery tracks while `:145`
  bounds the image width. Automatic scrolling to results does not resolve the
  inefficient allocation of space or allow direct comparison with the inputs.
- The supplied selected result is visibly blank. The screenshot alone cannot
  establish whether this was loading, delivery failure, rendering or the actual
  image contents. `hook-starting-frame-workspace.tsx:554` renders the output image
  without a load/error state; `:422` enables approval from job/input readiness
  without knowing whether the preview displayed. Record preview reliability as
  a separate open issue, not a proven image-generation or signed-URL failure.
- `components/explore/format-generation-references.tsx:396` presents Your
  influencers, Your images and UGC Pilot images as competing image sources. They
  answer storage questions rather than the user's task: choose this person's
  photo. The same picker also has a main/supporting selection sidebar and its
  own Done action, opening another dialog over preparation.
- These inventories are distinct today. Your images loads only ready Explore
  reference uploads through `lib/explore/format-reference-images.ts:12`.
  Your influencers loads owned generated character history through
  `lib/characters/identity.ts:134`, including ready image/influencer media tied
  to character jobs. UGC Pilot images is the stock creator catalogue. Removing
  a tab alone would hide saved generated people; merging these inventories is
  part of the proposed solution. There is no evidence that every visible photo
  is already duplicated across both owned inventories.

### Proposed interaction

Updated after the user's correction: **keep generated starting frames below the
setup**. This supersedes the proposed right-hand result column. Keep the existing
visual language and one focused preparation surface. Reduce the source/person and
settings area's unused space, bound secondary controls, and give the results below
a clear heading and appropriately sized uncropped previews. A loading area must
not look like an already selected blank output.

```text
Create your starting frame
---------------------------------------------------------
Source + chosen person · Change photos
[inline photo library only when opened]
Optional image instructions · Model · count
---------------------------------------------------------
Your starting frames
Selected preview · Variations · Enlarge
Loading / error / retry beside the affected preview
---------------------------------------------------------
Generate · explicit price             Use selected frame
```

On narrow screens, use a compact source/person summary followed by the result;
collapse optional settings and place variations directly under the selected
preview. Fit portrait, square and landscape images to available width and height.
Keep the footer reachable without covering the final control or image. One result
uses the main preview; multiple results use a selectable thumbnail strip with
explicit selected state, pending/failed state and a separate enlarge action.

Latest correction: the user rejects the proposed merge. Keep generated people
and uploads as separate sources. Recommend **My AI influencers** with the helper
"Created in Build AI influencer", and **Uploaded photos** with the helper "Photos
you uploaded in Explore". The code confirms the distinction: character history
is generated person media; the upload query is restricted to Explore reference
uploads. The earlier Your photos merged-library proposal is superseded.

Preserve ownership, current media verification, stable asset/job identity,
pagination, refresh, scoped errors and selection limits within each source. Keep
the main/supporting selection intact when switching sources. Do not broaden
Uploaded photos to every unrelated Creative Assets upload or include generated
scene/starting-frame outputs in My AI influencers. Empty uploads offer Upload
photos; empty influencer history offers Create a new influencer. Both sources
remain available without silently switching to stock images.

The screenshot's top-right mark near the library actions is interpreted as a
possible compact catalogue entry; its exact icon/behavior is not confirmed. The
recommendation is a small labelled **UGC Pilot images** control near Upload photos
that switches the same inline grid, clearly identifies the stock source and offers
a route back to the previously selected owned source. An unexplained person icon
alone risks looking like account settings or the influencer builder. Keep the two
owned sources as labelled tabs; the stock catalogue remains the smaller control.
The user subsequently authorized this direction. The local implementation and its limits are recorded in [implementation evidence](explore-person-picker-implementation-2026-10-23.md).

Expand this grid inline only on Change photos; keep it collapsed otherwise. One
selected main photo and optional same-person supporting photos remain explicit.
Use consistent select/remove/make-main behavior across uploaded and generated
photos. Selecting an image must not unexpectedly close the library or generate
anything. Keep one explicit Use selected frame approval after review. Retain
**Starting frames** history in the video composer's image chooser as a distinct
purpose; completed scene frames are not identity photos.

For preview delivery, distinguish loading from failure and a completed job from
a viewable image. Provide Retry preview / refresh the verified media URL without
submitting or charging for another image generation. Require the selected image
to display successfully on a review surface before enabling approval. Trace the
reported blank result with the actual production media request and browser state;
do not mark it fixed solely from a new layout or a successful job receipt.

### Other workflows checked

| Workflow / entry | Current source finding | Follow-through |
| --- | --- | --- |
| Hook Recreate | Both screenshot issues are in the shared starting-frame workspace and person picker. | Primary reported case; redesign both together. |
| Wall of Text Recreate | `components/explore/format-workspace.tsx:628` mounts the same workspace with `preparationFormat="wall_text"`. | Same layout, picker and preview-state exposure by shared implementation; validate the actual Wall entry. |
| Talking Head Recreate | `components/explore/hook-workflow-preview.tsx:390` mounts the same workspace with `preparationFormat="talking_head"`. | Same shared exposure; preserve Talking Head's script, demo and audio behavior. |
| Hook / Wall normal Create image chooser | `components/video/video-generation-workspace.tsx:1443` uses FormatGenerationReferences without influencerLibrary. It retains Your images / UGC Pilot images and can expose Starting frames. | Source-tab confusion also exists here, though the three-tab influencer variant is preparation-specific. Preserve general image roles and starting-frame history. |
| Talking Head normal Create image chooser | `components/explore/workflow-creation-form.tsx:150` uses WorkflowImageLibrary; `workflow-image-library.tsx:43` repeats Your images / UGC Pilot images. | Update this independent chooser too; changing only preparation would leave inconsistent libraries. |
| Slideshows | Source slides use SlideshowReferencePicker; editing/library backgrounds use ImageLibraryPicker and ImageLibraryBrowser. These do not render the three reported tabs or the shared starting-frame workspace. | No exact recurrence found in these source paths. Preserve legitimate distinctions between source slides, output slides and reusable backgrounds; inspect loaded previews/scrolling during visual acceptance. |

These are screenshot and current-source findings, not new authenticated production
acceptance. The three video workflows share the defect surface; that is not evidence
of an independently reproduced blank image in each workflow. The hidden Phone
workflow shares WorkflowCreationForm but is not a public Explore acceptance target.

### Acceptance still required

Check all four public workflows from their actual entry points. For the video
flows, cover no photos, uploaded/generated photos, both inventories, partial
library failure, main/supporting changes, cancel/reopen, restored preparation,
one/four results, pending/failed images, failed/expired preview delivery, changes
after generation and return to the composer. No image selection, preview retry or
opening action should trigger paid generation. Existing receipt, input and motion
checks remain alongside preview readiness.

Use the Explore laptop/short-screen/mobile matrix and representative zoom checks.
Check top and bottom scroll positions, actual visible image pixels, keyboard focus,
footer reachability and comparison with the source. Local fixtures can establish
layout and failure behavior; authenticated final acceptance must use
`https://www.getugcpilot.com` after an authorized release. No new visual acceptance,
runtime fix or deployment is claimed by this review.

Review reference: [Web Interface Guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md)
for focus visibility, useful error recovery and image/layout handling. Product
recommendations above are grounded in the supplied screenshots and repository.

## Next decision

The approved picker interaction is implemented and checked locally. Hosted acceptance remains pending deployment and an authenticated production check. Prompt/cleanup experiments are separately scoped; see the prompt pilot record for their evidence. Deployment remains paused until the user resumes it.
