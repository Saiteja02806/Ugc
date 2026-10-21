# Face replacement: implementation and research audit

Date: 21 October 2026, user timezone Asia/Calcutta.

## Honest implementation status

The current local code improves role binding and sound control. It does **not**
establish a correct face-swap result. No post-change paid visual benchmark or
production deployment has been performed. Existing historical failed outputs
remain failed acceptance examples; passing transport tests does not change them.

Rechecked the existing source/output/portrait comparison sheet. Captions were
removed in the sampled old output, but the intended portrait appearance was not
achieved, and hand/expression timing differs. This is an existing result, not a
new test. Five portrait views in this sheet are visually similar; the count alone
does not establish coverage of strong turns or occlusion.

## What is implemented locally

| Item | Evidence and limit |
| --- | --- |
| Main and supporting photos | Main is first; supporting order survives concurrent uploads and both queue paths. |
| Provider bindings | Seedance prefix explicitly uses `@Image 1`, supporting `@Image N` and `@Video 1`. These tokens are prompt references, not identity embeddings. |
| Source ownership | The video supplies performance, pose, clothing, camera and scene. Person photos supply facial identity/proportions. |
| Photo-only creation | Separate instructions create a new performance without claiming a source exists. |
| Shared instructions | A deterministic app-owned prefix precedes the complete combined user/reference prompt. No additional LLM rewrites the Seedance prompt in this route. |
| Sound | Frozen explicit Boolean; native ReAPI flag plus final silence enforcement for OFF. |
| Validation | 29 current API/input-role tests re-run and passed in this audit; no network or paid generation permitted by their harness. |
| Correct Seedance source-edit integration | **Not implemented.** API and worker reserve their explicit edit path for Omni; ReAPI still declares reference. |
| Demonstrated facial fidelity | **Not established.** No mask/identity-strength/character-ID control or automatic face-quality acceptance gate is implemented here. |

## Current instruction assembly, in order

1. UI combines the editable reviewed gallery performance prompt, when present,
   with the user's own instructions. The user can remove the gallery prompt.
2. Server prepends `buildExploreGenerationInstructions`: person roles, every
   supporting token, source or new-performance ownership, and sound policy.
3. Wall appends its background-only/no-text/no-logos instruction.
4. Jobs use `promptMode: "direct"`. The older UGC template, with its suggested
   indoor scene and generic reaction, is bypassed for these requests.
5. ReAPI receives the assembled prompt unchanged by our adapter. Omni instead
   adds its own source-edit wrapper and media markers.

This is a shared instruction block, reasonably described as a master prompt,
but it is neither an identity model nor a trained face lock. Main/supporting
metadata is internal; ReAPI receives ordinary ordered media arrays plus prose.

Key source locations:

- `lib/explore/generation-input-instructions.ts`
- `lib/explore/person-reference.ts`
- `lib/explore/reference-video-prompts.ts`
- `lib/explore/format-generation-prompt.ts`
- `lib/ai-studio/video-generation-api.ts`
- `components/video/video-generation-workspace.tsx`
- `worker/src/lib/ugc-video-prompt.ts`
- `worker/src/lib/reapi-video.ts`
- `worker/src/lib/gemini-omni-video.ts`
- `worker/src/jobs/generate-hook-video.ts`

## App-controlled influences and remaining gaps

| Influence | Current behavior | Consequence / next correction |
| --- | --- | --- |
| Operation intent | `recreate_performance`, `create_performance`, `general` are inferred from photo purpose/source presence. | No explicit validated `replace_face` operation yet. Make the required outcome explicit rather than treating all media requests alike. |
| Model selection | Workflow starts with Omni. Changing gallery selection/reselecting Recreate calls `setModel("google_omni")`. | A previous Seedance selection can be reset. Preserve a compatible explicit selection or visibly ask for a compatible choice. This does not prove any particular historical job used the wrong model. |
| Provider | Newly admitted Seedance/WAN jobs freeze `provider: "reapi"`. | They do not silently fall back to Omni on a new provider failure. Legacy saved operations retain their recorded route. |
| Task declaration | Every ReAPI media request declares `reference`. Explicit source edit is Omni-only in UI, API and worker. | A prompt asking for an edit is not enough to implement Seedance edit. Align operation, prompt, source eligibility, duration, shape and billing together. |
| Gallery instruction | Adds actor replacement, reviewed performance and caption-removal instructions before user text. | Helpful guidance can still conflict with a user's changed scene, identity or audio intent. Preserve visibility and separate semantic roles. |
| Gallery silence text | Hook 3's reviewed performance includes repeated silence and no-lip-sync restrictions. | Sound ON permits user audio but the combined prompt can still contain contrary prose. Keep rejected music disabled while moving sound policy out of performance descriptions. Do not silently rewrite user text. |
| Identity specificity | Prefix describes identity ownership; actual requested edit comes from gallery/user instructions. | Use an explicit face-replacement task statement when that operation is selected. Person photos alone are not an imperative or guarantee to swap. |
| Body and hairstyle | Source owns clothing, hair and pose; body regeneration is allowed. | Distinguish this from an absolute pixel-preservation claim. Do not transfer portrait clothing/background to the scene. |
| Main/supporting quality | Order is validated; exact URL duplicates are rejected. | No face-count, view-diversity, blur, occlusion or same-subject quality check. Repeated similar views can consume slots without supplying useful angles. |
| Original versus thumbnail | Upload path PUTs original File bytes. Small picker previews only render the library. Submission uses `asset.url`. | No evidence this path is sending cropped thumbnails instead of originals. |
| Upload completion order | Bounded parallel uploads store results by original picker index. Use-as-main reorders explicitly. | The first completed HTTP upload does not accidentally become the main face. |
| Source selection | Gallery source resolves server-side to the catalogued video; uploads require owned ready media. | Do not confuse preview URL, source URL and generated output URL. Old asset selection remains a separate provenance check. |
| Source preprocessing | Gallery reads MP4 duration; no source padding or frame interpolation in generation resolver. | No hidden extension makes the short supplied clip eligible for another task. |
| Text removal | Gallery removes creator overlays while preserving physical-object text. Wall says no text, letters or logos at all. | These differ. Broad Wall instruction can change physical labels too; choose task-specific text-removal scope. |
| Duration | Reference uses chosen output duration. Omni edit follows verified source duration. | Changing output length can shift action pacing; do not call it original-timeline preservation. |
| Aspect and resolution | Explicit selected output ratio/resolution; ReAPI Seedance app allows 480p/720p. | Reframing or resolution can affect visible facial detail; these are not identity controls. |
| Sound | OFF is sent natively to ReAPI and removes any output audio locally. ON bypasses automatic catalogue music. | Audio choice is distinct from facial geometry. Explicit later Edit/Demo audio remains a separate user choice. |
| Seed | Seedance adapter omits a seed. | Stochastic variation remains; repeated inputs are not guaranteed to produce the exact same video. |
| Provider rewrite | App ReAPI adapter makes no extra prompt-enhancement call. WAN moderated docs default to prompt expansion; app doesn't set `prompt_extend`. | The WAN setting is not evidence of a hidden Seedance rewrite. Provider internals beyond published behavior remain unknown. |
| Identity controls | No face mask, tracking target, identity embedding, LoRA, character ID or supported strength field is sent by this route. | Do not invent these controls or claim prose implements them. Assess only controls the exact provider documents. |
| Postprocessing | New OFF jobs remove audio with video stream copy. Other explicit sound requests keep provider pixels. | This does not repair the face, replace it with source footage, or alter facial proportions. |
| Recovery | Accepted operation ID/fingerprint is retained; recovery GETs the saved task. | A collection repair does not regenerate or improve a poor visual result. |
| Deployment | The new role/sound work remains local. | No successful production face-replacement acceptance can be claimed from these tests. |

## Research: edit versus recreation

[ReAPI's task contract](https://test.reapi.ai/docs/seedance-2-5) distinguishes
changing supplied footage from generating a new clip guided by references.
The documented edit combination is `omni_reference_task_type: "edit"`, source
4–30 seconds, `duration: -1`, `size: "adaptive"`. It is not implemented in the
current app path. A fixed four-second output does not qualify a three-second
source. Source length is eligibility, not demonstrated facial-quality causality.
The declaration also does not override a contradictory prompt classification.

For an explicit existing-footage face replacement, edit is the more aligned
contract to evaluate. For performance recreation with regenerated body/new
length, reference is a legitimate alternative. Neither establishes face quality.

[Runware's own Seedance editing guide](https://runware.ai/docs/models/bytedance-seedance-2-5/guides/editing)
separates its source-video field from supporting image references and ties edit
requests to source timing. Its schema is different from ReAPI's.
[Layer's guide](https://help.layer.ai/articles/2338375981-prompt-seedance-for-video-editing)
reports scene redrawing in its Seedance 2.5 tests and recommends unambiguous edit
verbs. These are useful warnings, not benchmarks of our assets or proof of
guaranteed facial geometry.

## Research: similar products

[Higgsfield Face Swap](https://higgsfield.ai/apps/face-swap) exposes separate
source-face and target-media inputs. Its
[engineer's article](https://higgsfield.ai/blog/AI-Face-Character-Swap-in-Video-Photo-PRO-Guide)
discusses masks and multiple passes and distinguishes face from character
replacement. The article does not establish a particular Seedance 2.5 backend.
Its [Seedance page](https://higgsfield.ai/seedance/2.5) promotes region editing and
pairing with Soul for character consistency. Those are vendor claims, not proof
that our ReAPI request has those controls or passes our acceptance criteria.

[Higgsfield's prompting examples](https://higgsfield.ai/blog/seedance-2-5-prompting-guide)
assign explicit active-reference responsibilities. Copying their sample character
descriptions would introduce a different identity; borrow the role structure,
not an invented person's face attributes, wardrobe or lighting.

OpenAI is a separate provider, not evidence of a Seedance implementation. Its
[official deprecation page](https://developers.openai.com/api/docs/deprecations)
lists the Sora Videos API shutdown on 24 September 2026, before this audit date.
Do not recommend that historical API as a currently available integration based
on an old tutorial.

BytePlus's main tutorial currently returns only its JS shell to the text fetcher;
search-indexed content is not treated here as a successful full document fetch.
ReAPI's exact contract is the implementation authority for our configured route.

## Proposed next implementation, before any paid test

1. Introduce an explicit face-replacement intent distinct from general creation
   and broader performance recreation. Validate required source/main photo and
   provider capability as one unit before credits.
2. Keep the selected compatible model; make the selected operation and route
   reviewable. No automatic provider substitution to bypass a failed operation.
3. Compile one task-specific instruction block with the agreed ownership table.
   Reconcile gallery sound/text restrictions and avoid restating the scene in a
   way that competes with the video. Preserve user text; show actionable conflicts.
4. Implement Seedance edit only with its complete request, timing, billing and
   recovery contract. Decide what to do with short sources explicitly; do not
   silently pad them or advertise a duration workaround as a fidelity fix.
5. Save a redacted request receipt: selected operation/model, ordered media IDs,
   source length, exact compiled prompt/hash, native flags and release revision.
6. Ask approval for one bounded visual test after the request is reviewable.
   Compare matched poses and several moments for eyes/brows, nose, mouth,
   jaw/chin and proportions; then turns/occlusion/temporal drift, source action,
   clothing, camera, captions and actual silence. Reject source-looking output
   rather than reporting transport success as a face-swap success.

Keep face replacement and caption removal independently assessable. A successful
first example is evidence for that example, not an invented accuracy percentage
for every face, clip or model.

The separate copy-paste research request is
`docs/face-replacement-research-brief-2026-10-21.md`.
