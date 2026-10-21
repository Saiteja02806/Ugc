# Seedance editing and face inputs: findings

Scope: explain and investigate the first three findings from the prior audit.
The source-duration hypothesis is deliberately not investigated here. This is
read-only source/evidence/documentation research, with no paid inference or
production changes. Unrelated concurrent worktree changes were left untouched.

## 1. What the documented request means

"Confirmed" means supported by saved evidence. "API contract" means the named
fields, permitted values and combinations the server expects, not a document a
customer writes. Users keep uploading their clip/photos and explaining the
change. The backend must translate that intention into the provider's fields.

The prior operation used `doubao-seedance-2.5-face`, `content_filter:false`,
`omni_reference_task_type:reference`, fixed output duration and a specified
aspect ratio. The field naming is specific to ReAPI. We must not send upstream
BytePlus JSON verbatim to a different provider's endpoint.

The current ReAPI builder always writes `reference` when media are attached:
`worker/src/lib/reapi-video.ts:74`. The app API additionally rejects explicit
video editing unless the selected model is Omni:
`lib/ai-studio/video-generation-api.ts:234`, with the same restriction in
`worker/src/jobs/generate-hook-video.ts:543`. Thus adding a phrase to the prompt
or changing only one provider parameter would not finish the integration.

## 2. What the five-photo verification establishes

Saved job `cc899a93-7ad1-44a6-82f9-943399d7982c` contains five original ready
owned photo URLs. The intended main is first and the other four are supporting
views. The request fingerprint matches the saved provider operation, and the
prompt includes the image-role instruction. No photo was dropped.

Actual provider shape: `image_urls:[main,support1,support2,support3,support4]`.
`personReference:{mainImageUrl,supportingImageUrls}` is internal app metadata;
the ReAPI builder does not transmit that as a dedicated identity control.
Main/supporting distinction is communicated through order and prompt wording.
See `lib/explore/person-reference.ts:9` and `:11`.

This proves correct app selection and transport construction. It does not
prove how the model weighted the portraits, whether it fused them into a stable
identity, or that facial geometry was preserved. The provider documentation
recommends explicit `@Image N` and `@Video N` bindings; the saved prompt used
ordinary 'Image 1' wording and had no such tokens. Correct binding is worth
fixing independently, without claiming it alone will fix the creative result.

## 3. Why editing is relevant, and what it cannot establish

BytePlus's official Seedance2.5 guide explicitly presents replacement of a
video character using an image character as a video-editing example. Editing
means modifying supplied footage. ReAPI distinguishes it from making a new
clip guided by reference material. This supports edit as the documented task
category to investigate for the user's intended existing-footage modification.

That example is character replacement, not a published guarantee of replacing
only a face while preserving exact proportions and every outside pixel. It
does not establish that edit mode would pass this user's acceptance criteria.

The mode is a declared subtask within the same model and generation endpoint.
ReAPI says the model also classifies task intent and may reject disagreement.
It does not document the flag as loading a separate face-swap engine or as
locking facial identity. Its internal implementation remains undisclosed.

The latest output did remove source captions in inspected frames. Therefore
the request's reference declaration does not justify claiming that no editing
occurred internally. The failed face appearance is observed; its sole internal
cause remains unknown. Neither a stronger prompt nor an edit flag is yet a
validated solution for this footage and identity reference set.

Any proposed implementation should align operation intent, supported mode,
source role, explicit main/supporting image bindings and provider settings
before another approved visual acceptance test. No test has been run here.

## Sources and separation of services

- [ReAPI Seedance2.5 parameters and task declarations](https://test.reapi.ai/docs/seedance-2-5): provider schema, reference/edit distinction, prompt asset tokens, and classification caveat.
- [BytePlus Seedance2.5 guide](https://docs.byteplus.com/en/docs/modelark/seedance-2-5): official guide; search-indexed content explicitly places character replacement under editing. The live text fetch returned the JavaScript shell. The same official guide's [Spanish URL](https://docs.byteplus.com/es/docs/modelark/seedance-2-5) exposes the indexed English configuration example.
- [BytePlus Video Edit Enhanced](https://docs.byteplus.com/en/docs/Byteplus_LAS/Enhanced_video_editing): a separate LAS operator supports `person_replace`, access-controlled asset management and optional evaluation/retries. It is not proof that ReAPI's edit declaration uses that operator or inherits its guarantees. No LAS integration is proposed by this finding.

Existing local receipts are in
`outputs/seedance-latest-face-audit-2026-10-20/request-audit.json`,
`provider-task-confirmation.json` and the source/output comparison image.
The request reconstruction matches the saved fingerprint but is not a raw
historical HTTP capture; task GET independently confirms the provider model.
