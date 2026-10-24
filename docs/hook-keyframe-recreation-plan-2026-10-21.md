# Hook recreation with an approved starting frame

## Current handoff clarification

The user clarified the final interaction on 21 October: generate the starting
image here, inspect it, then click **Use as starting frame**. Return that owned
generated image to the existing video form's image box with a **Starting frame**
label. The existing Generate video action then animates it. A separate Animate
screen is no longer required. This replaces the earlier screen proposal below.

The backend must bind the selected image to the provider's explicit first-frame
role; ordinary reference-image attachment or prose alone does not establish it.
Only the approved full-scene image and current motion instructions go to this
new animation path. The original reference clip and person photos are not sent
again. Keep fixed output duration, eight seconds for Hook 15, and sound OFF by
default. Image generation and animation remain separate deliberate billed actions.

The duration/UI review passed 220 targeted checks, one review-server check,
scoped lint and a full production build. Its first attempt hit local cache-space
and sandbox file-permission errors; only the verified generated webpack cache
was cleared, then the build succeeded. There was no deployment. The next local
increment is connecting the clarified image generation and first-frame handoff;
these earlier checks do not validate that unfinished integration.

Status: first two local increments completed: free source/identity preparation,
separate image/motion prompt contracts, all98 motion rewrites and editable
animation prompt auto-fill. Not deployed or enabled
by default. Image inference and first-frame video admission are not connected
yet. No paid generation, upload or production database change was performed.
The previous single Seedance edit test remains a separate completed diagnostic;
its paid authorization is not reused here.

## Second increment: all98 prompt adaptations and editable auto-fill

The correct rewrite method is to reuse reviewed source observations, write
self-contained motion directions, then check the actual opening pose and action
order against canonical video frames. Changing only phrases such as "follow the
video" does not establish that an image can supply the missing motion. Full-frame
reinspection is reserved for complex or unclear sequences; sampled checks plus
the detailed prior notes are identified as such, never called a new full audit.

Three agents authored98 ID+SHA-bound plans and verified local canonical videos.
An independent reviewer compared all98 prose plans and visually spot-checked
continuity. The final set has87 statically reviewed four-second adaptations
and11 cases requiring decisions:15/19/22/28/39/51/57/64/72/83/84. These are current
display titles; the stable IDs in the data and review page determine identity.

The local preparation screen now contains separate visible stages:

1. Starting image: main/support photos and editable image changes, with the
   complete scene-versus-face instructions available for inspection.
2. Animation preparation: auto-filled opening, ordered actions, camera and ending
   from that Hook's rewritten plan; editable directions with Restore suggested
   instructions, plus a sound OFF-by-default switch. The full four-second prompt
   preview reflects the selected sound setting and stays separate from still
   image instructions. Text relying on absent video/portraits or contradictory
   sound/duration commands produces an error instead of a ready-looking preview.

Motion edits persist independently and do not require regenerating the still.
Existing preparation drafts remain readable. Changed photo/source/image inputs
still invalidate the corresponding starting-image approval. A custom motion edit
cannot reuse an earlier compiled motion readiness receipt.

The updated prompts auto-fill only in the new default-off preparation flow.
Ordinary video-reference Generate and accepted jobs keep their original prompt
contract. Image inference and first-frame video admission are still upcoming;
all98 remain blocked from paid animation, including the87 static reviews.
Static wording review is not image acceptance or generated-face qualification.

The review page at `outputs/hook-motion-rewrite-2026-10-21/index.html` pairs
all98 rewritten prompts with source videos and inspected frame sequences. It
defaults to the11 unresolved references. Its builder rehashes every source again
and stops on missing/mismatched evidence. No AI generation or upload occurs.

Validation:216 targeted checks plus the local review-server check pass; ESLint
and the final Next webpack build including TypeScript pass. The source review
receipts record4,276 inspected frame indices across9,751 total decoded frames;
32 complex videos were reviewed in full contact-sheet sequences in this pass.
The rest use explicit sampled source frames plus their prior all-frame notes.
Read-only local review is served at `http://127.0.0.1:8188/`, using a fixed
allowlist and loopback binding; HTTP playback-range and forbidden-file checks
pass. Browser layout acceptance is still pending because Work browser use is
disabled. No paid or production action was taken.

## First implementation increment

- `ENABLE_HOOK_STARTING_FRAME_PREPARATION=true` before dev startup/build opts into the free preparation
  preview. The Hook page passes this server-owned gate; the extraction endpoint
  independently enforces it. Default remains off. Recreate opens an internal
  Starting image screen; the normal Generate path and other workflows retain
  their current behavior. Closing/reopening and explicit reload retain the draft.
- Extraction accepts a canonical active Hook ID, not a URL or poster. It checks
  the release video SHA-256, decodes full-size frame zero and returns PNG bytes
  with provenance. The browser verifies the image digest and selected source.
  Cache/download/decode work is bounded and temporary; nothing enters the media
  library. Authentication and Create access are checked before every extraction.
- The screen reuses owned influencer history, the existing person-photo picker
  and photo guide, Explore-scoped uploads and the existing influencer builder
  in a separate tab. It preserves main/support order. Choosing another saved
  influencer clears old supporting photos. The preparation preview currently
  accepts one main plus up to four supporting photos; this is not a change to
  existing video models' independent reference limits or a provider limit claim.
- Browser drafts contain asset IDs, source/frame hashes and instructions, not
  signed URLs or image data. Restoration resolves owned media again. Changed
  source/owner/input checkpoints are rejected, and unreadable drafts are not
  silently overwritten. Photo, source or image-instruction changes invalidate
  any generated-image approval. An uploaded portrait cannot itself be approved
  as the generated full-scene starting image. Sound defaults off.
- The image compiler separates scene Image 1, main face Image 2 and supporting
  views Image 3 onward. Its exact instructions are visible for inspection. This
  is a contract for the next image-stage integration, not an inference result.
- All 98 active Hook prompts have a separate hash-bound motion-review inventory;
  six manually authored action plans are available as drafts. All 98 remain
  unapproved for paid animation until their first-frame action review passes.
  The old source-video prompt helper is preserved. See
  `docs/hook-keyframe-prompt-audit-2026-10-21.md` for exceptions and numbering.

This increment deliberately ends at **Save preparation**. It does not present a
working Generate/Approve/Animate action before their paid admission, recovery and
ownership contracts exist. Arbitrary starting-frame selection, generated-result
comparison/approval, and the two separately billed generation steps are the next
increments. No ending-frame feature is included.

### Validation of this increment

- 45 new offline checks cover extraction (including actual local FFmpeg decoding),
  source/frame integrity, default-off route admission, ownership-scoped draft
  restoration, image roles, approved-image invalidation, real motion-compiler
  handoff, model-independent sound ownership, and Hook-only Recreate entry.
- 170 existing generation, reference upload and workspace checks pass. Combined
  targeted coverage is 215 unique checks; none submits a provider operation.
- Targeted ESLint, full TypeScript and the final Next webpack production build
  pass. The first sandboxed build hit Windows EPERM in generated `.next` output;
  retry with normal filesystem access completed successfully. The generated
  extraction route trace includes the FFmpeg binary.
- Browser visual review is still pending because the computer-use browser tool
  could not start (kernel assets path error). Rendered component/state tests do
  not substitute for browser layout or deployed/authenticated acceptance.
- No paid image/video generation, media upload, production database change,
  commit, push or deployment was performed for this increment. The release
  switch remains off by default; no facial-fidelity result is claimed.

## Product flow

Recreate → Create your starting frame → Approve image → Animate → Review video.

The user confirmed **starting-frame-only for the first version**. Ending-frame
generation and controls are deferred until this path has been tested. The first
quality checkpoint is the starting image itself; video generation remains a
separate deliberate action after image approval.

The reference supplies the scene, pose, framing, clothing, lighting and intended
performance. The user's selected influencer supplies the facial features and
proportions. First make that combination visible in an image, then let the user
approve it before starting video generation. This provides an earlier review
checkpoint; it does not establish that still editing or subsequent animation
will preserve every facial feature perfectly.

Hook Recreate is the first scope. The current prompt/photo-only Generate path
remains available independently. Wall of Text can reuse the components after
this flow is qualified; it is not silently migrated in the proposal.

## Proposed screen

Use an internal Hook workspace step rather than a cramped image popover or a
different application. Preserve UGC Pilot's existing typography, dark surfaces,
orange action color, navigation and results history. The visual priority is a
large image comparison, not a gallery of tiny selected-image cards.

```text
Explore / Hook video / Recreate                         Back to hooks

       1  Starting image                 2  Animate

Create your starting frame

Reference frame             Your influencer             Starting image preview
[actual source frame]       [selected main photo]        [large generated result]
00:00.000                   [Choose influencer]          [Compare with source]
[Change frame]              [Upload photos]              [Inspect face]
                            [Create influencer]

                            Supporting views (optional)
                            [same person, other angles]

Image instructions (editable)
[Generate starting image · image cost]

                                  [Approve image & continue]
```

- Reference frame and influencer photo always have distinct labels and roles.
- Existing saved influencers come from the current owned character identities /
  influencer collection. Do not substitute the stock CreatorReferencePicker's
  17 sample creator photos for the user's own influencer history.
- Reuse the existing Build character screen at `/explore/build-character` when
  the user chooses Create influencer. Preserve the Hook draft while leaving and
  restore it on return. Upload photos is an alternative, so users are not forced
  to pay to generate a new influencer when they already have usable photos.
- One clear main face photo is required for the image stage. Supporting views
  are optional; recommend two distinct slight turns, not duplicate front photos.
  The keyframe uses the source scene's aspect ratio; face-photo aspect ratio is
  not the controlling requirement.
- Keep original source hairstyle/clothing by default, consistent with the
  established requirement. Expose appearance changes as image-stage instructions.
- Remove creator captions during image generation. Preserve physical object
  text and reconstruct the background behind overlays.
- Require deliberate approval of a generated image. Inspection should include
  a face zoom and reference photo alongside the result. One candidate by default;
  regeneration is a separate billed action, never automatic.
- Generated frames/extracted source stills belong to this Hook draft and a
  dedicated starting-image purpose. Do not flood the generic Your images
  collection or change the Explore-only upload-library scope.
- On narrow screens stack source, influencer and result. Keep captions, image
  selection, error feedback and approval controls accessible without hovering.

## Frame extraction and deferred ending frames

Default to the actual first decoded frame of the current canonical, trimmed
reference. A poster/thumbnail is not evidence of the true first frame. Cache
extraction by source SHA-256, decoded frame index/time and extraction version.
Use canonical source media, not a stale preview containing previously removed
laptop/display frames. Extraction is a local media operation, not AI generation.

Show Change frame as an explicit option. A hand over the face or a blink can
make the first frame hard to inspect. If the user selects another source time,
record that timestamp and adapt the opening actions to that pose. Do not silently
skip footage or instruct an action already completed in the selected frame.

Version 1 exposes only the starting image. For a later version, an ending frame
may be useful for a particular final
gesture, composition, product reveal or intentional loop. It is not a general
facial-consistency switch. Two incompatible poses/identities, nearly identical
endpoints or an overambitious transition can still yield poor intermediate
motion; the video needs review regardless of its endpoint inputs.

For a future optional ending image, use the same influencer and the already approved
starting image as identity/appearance context while matching the canonical end
frame's pose/composition. Approve it separately. Do not independently generate
two unrelated characters, or reuse the start as end unless a loop is requested.

Free example extraction from the hash-verified copy of the user's original
`csdss.mp4` is under `outputs/keyframe-recreation-plan-2026-10-21/`:
`actual-first-frame.png` (decoded frame 0) and `actual-last-frame.png` (frame103).
The original Downloads path was no longer accessible, so extraction used the
workspace copy with the original recorded SHA-256. These stills have not been
face-edited or caption-cleaned. Both show a hand over the lower face, illustrating
why blindly demanding both endpoints would not by itself solve the problem.

## Two distinct prompt stages

Image-stage inputs:

1. Scene frame: composition, body pose, hands, clothing, source hairstyle, camera,
   lighting and background.
2. Main influencer photo: intended facial features/proportions.
3. Supporting photos: additional views of that same person; not scene/clothing.

Example image-edit instruction:

> Use the scene frame as the composition. Replace the performer's facial
> appearance with the person in the main influencer photo, using supporting
> photos only for that same person's facial features and proportions. Preserve
> the pose, hands and occlusions, clothing, source hairstyle, framing, background
> and lighting. Match the face to the scene lighting. Remove creator-added text
> and reconstruct the underlying background. Return one clean starting image.

The existing Nano Banana multi-image editing path is a candidate to qualify;
the image stage must use its real multi-image contract. ReAPI's separate
Face Swap endpoint retains target head shape, so it is not automatically an
answer to reference head/jaw proportions. Its Head Swap operation also changes
hair and outline, conflicting with default source-hairstyle preservation. Do
not select either by name without evaluating the required result.

Version 1 video-stage input is the approved full-scene starting image. The face
replacement is already part of that image. An approved ending image is deferred.
The prompt describes motion; it must not ask for another face replacement or
refer to an absent video. Separate portrait photos are not mixed into ReAPI's
first/last-frame request.

Example motion prompt for the user's reaction clip, adapted for four seconds:

> Animate the approved starting image as one continuous four-second reaction.
> Begin with the same hand covering the mouth. During the opening, make a small
> downward glance and blink, then look toward the camera. In the middle, lower
> that hand toward the chest and open the mouth in surprise. Near the end,
> raise the same hand to cover the mouth again and finish with a surprised gaze.
> Keep the approved facial features and proportions, hairstyle, clothing,
> framing, warm room lighting and background consistent. Use natural movements.
> Do not add captions or text. Sound is off.

This is a self-contained draft example, not a paid-tested prompt. Timing beats
must be reviewed against the selected opening pose and requested duration. A
start/end image constrains endpoints; it does not transfer the source video's
exact motion or every intermediate expression automatically.

## Actual prompt audit

Audited the active release through `getHookReferenceGalleryItems`, not the older
nine-Hook paired catalog. Results:

- Active Hook references: 98.
- Reviewed prompts present: 98; source SHA-256 matches: 98.
- Prompts containing original-video wording: 98.
- Prompts referring to source/retained duration: 97.
- Prompts describing hand actions: 96.

The action observations are useful source material. They are not all ready to
send unchanged to image-to-video. Coverage and source binding are verified;
new output fidelity is not. Per-reference machine-readable audit:
`outputs/keyframe-recreation-plan-2026-10-21/hook-prompt-audit.json`.

Introduce separate versioned keyframe-image and animation prompts. For each
hook, preserve reviewed actions and camera observations, remove instructions
that rely on watching the original video, align the initial pose and ending
with the approved images, and express ordered actions/timing in words. Store
review status; missing or changed source hashes should require review rather
than silently use a generic prompt. Do not rewrite accepted jobs' saved prompts.
String replacement alone cannot qualify all 98 motion prompts.

## Verified Seedance/ReAPI handoff

Use ReAPI's explicit frame contract for this new path:

```json
{
  "model": "doubao-seedance-2.5-face",
  "prompt": "<self-contained motion prompt>",
  "image_with_roles": [
    { "url": "<approved starting image>", "role": "first_frame" }
  ],
  "duration": 4,
  "size": "adaptive",
  "resolution": "720p",
  "generate_audio": false,
  "content_filter": false,
  "output_format": "mp4"
}
```

Version 1 sends exactly one `first_frame`. A future ending-image option would
add one `last_frame` entry, never a last frame without first. Do not include
`image_urls` or the source `video_urls` in this
path; adding video would change how frame inputs are treated. Do not send
`omni_reference_task_type: edit` or the old always-reference declaration here.
Do not append the current person-photo/master edit instructions to the motion
prompt: the approved scene image now owns both appearance and scene.

This is fixed-duration image animation. A three-second source clip can supply
the extracted still while requesting four seconds of output; it no longer needs
to satisfy the four-second source-video editing minimum or be padded. Fixed
duration avoids that edit mode's automatic 30-second output reservation. This
does not establish that total cost is lower: show separate image and video costs
using the applicable no-video-input rate before either action is submitted.

## Integration points and safeguards

- `FormatWorkspace.selectReference` currently goes straight to generation.
  Add a Hook recreation draft/step before that existing video-generation stage.
- Add source-frame extraction/cache and a dedicated keyframe admission contract.
  The current image endpoint accepts Hook neither as `exploreFormat` nor as a
  multi-reference image-edit purpose; multiple URLs are currently Slideshow-only.
  Reuse worker image adapters/billing/recovery primitives without pretending a
  Hook is a Slideshow or changing Carousel policies.
- Integrate existing owned character identities/history, uploads and the current
  main/supporting-photo guidance. Do not make a new global identity store just
  for this wizard. Validate assets/ownership and canonical source hashes.
- Add a distinct typed video generation mode for approved-starting-frame animation.
  Current ReAPI builder only exposes general images/video references and source
  edit mode; it does not send `image_with_roles` today.
- Gate by the exact connected provider's first/last-frame capability before
  reserving credits. Seedance/ReAPI is the first qualified contract; do not
  assume identical fields or support across Omni, WAN or Kling providers.
- Preserve sound OFF by default in the animation step and enforce actual silence.
- Save owner-scoped drafts, asset IDs, source hash/frame timestamp, selected
  influencer/main/support views, approved keyframe IDs, prompt versions and exact
  submission receipts. Reference/identity changes invalidate only the affected
  approvals; they do not auto-generate another image/video.
- Keep two separately labeled billed actions: image generation and video
  generation. Require approved input images before video submission, freeze
  each request, recover accepted IDs, and never automatically charge for retries.
- Reuse existing generic media/job metadata where adequate. No migration or
  production database modification is part of this planning work.
- Test extraction/canonical hash, pose-aware prompts, role exclusivity, fixed
  duration, ownership/model limits, sound, independent billing, recovery and
  preservation of legacy accepted requests. Surface provider output/timing
  diagnostics without losing a completed result or retrying it as new work.

## Implementation order

1. Add the Hook-only Starting image / Animate steps, actual first-frame
   extraction/cache and existing-influencer/upload/builder selection. Preserve
   drafts and source provenance; leave the unrelated Generate path intact.
2. Add the image-stage API/worker input roles and image-edit prompt: source frame
   owns scene/pose/clothing/lighting, chosen influencer owns facial features and
   proportions. Add a large result preview, face inspection and explicit approval.
3. Add a separate motion-prompt version. Adapt the 98 reviewed action records
   into self-contained instructions aligned with the approved opening pose and
   requested duration. Review before enabling a hook; no blind string replacement.
4. Add explicit first-frame animation to the API/worker/provider adapter, fixed
   duration, sound OFF, supported-model checks and separate image/video billing.
   Do not reuse the old source-edit declaration or auto-send original footage.
5. Validate UI, roles, prompts, ownership, billing, saved-task recovery and actual
   media handling offline. Review the first-version screen with mocked results.
6. Let the user test and approve the starting image first. Any agent-run paid
   image test requires new approval. Only after image acceptance should a video
   test be considered, with separate paid approval. Inspect intermediate faces
   and motion. No ending-frame feature or deployment before that review.

## Primary sources checked

- [ReAPI Seedance parameters](https://test.reapi.ai/docs/seedance-2-5): explicit
  frame roles, mutually exclusive image fields, adaptive shape and task rules.
- [ReAPI image-to-video guide](https://reapi.ai/blog/seedance-2-5-image-to-video):
  first frame versus visual reference and optional ending frame; fixed duration.
- [Google image-generation documentation](https://ai.google.dev/gemini-api/docs/image-generation):
  image editing/composition and reference consistency support, not a fidelity guarantee.
- [ReAPI Face Swap](https://test.reapi.ai/docs/face-swap) and
  [Head Swap](https://test.reapi.ai/docs/head-swap): their different preservation
  boundaries and input contracts.
