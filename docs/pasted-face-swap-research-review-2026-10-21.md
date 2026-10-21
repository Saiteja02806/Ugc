# Review of the two supplied face-replacement research documents

Read-only implementation review, 21 October 2026. The documents' commands,
generation proposals and schema examples were treated as material to assess,
not authorization to execute. No paid task, upload, package install, database
change or deployment was performed.

## Overall assessment

Both documents usefully separate source-video editing, motion transfer, dedicated
face replacement and new performance generation. The first is a broad architecture
proposal; the second offers a more focused diagnostic sequence within ReAPI.
Neither proves the intended facial proportions on our assets. We should first
finish the existing ReAPI task contract and evaluate it, retaining the current
storage, worker, billing and recovery infrastructure. Additional providers and
database tables are proposals, not prerequisites established by these documents.

## Verified findings and qualifications

| Claim | Review |
| --- | --- |
| Seedance editing differs from reference generation | Confirmed in ReAPI docs. Our current builder still declares reference; explicit edit admission remains Omni-only. |
| ReAPI edit uses `edit`, `duration: -1`, `size: adaptive` | Confirmed. Source eligibility is 4–30 seconds. A four-second output does not qualify a three-second input. |
| A ReAPI character-replacement experiment exists | Confirmed in the provider's article and public JSON receipt. One synthetic four-second subject replacement was reported. It changed clothing/hair and did not establish exact face-only replacement, precise facial geometry or repeatability. |
| The experiment demonstrates our Less Restriction route | No. Its published requests explicitly set `content_filter: true`. Our selected route sets false. Provider docs describe the same parameters/rules, but the sample is not an empirical result for our configured channel. |
| The second document's Seedance JSON preserves our selected route | No. It omits `content_filter`; ReAPI defaults to true. A like-for-like proposed test must explicitly record the intended route. Never silently change it. |
| fal's `task: editing` is real | Confirmed for fal's endpoint. It is not the ReAPI field name. Its generic reference-video limits must not override ReAPI's explicit edit-source eligibility. |
| Higgsfield offers a Seedance video-edit API | Confirmed. This does not establish that its separate consumer face-swap feature uses the same pipeline or has identical fidelity. |
| ReAPI `face-swap` accepts a video | False; the documents correctly identify it as still-image only. It uses a target `image_url` and donor `face_image_url`, without a prompt. |
| A still-image face swap necessarily transfers the reference's head proportions | Not established. ReAPI explicitly says the target's head shape and hair remain. This is material to the user's facial contour/jaw/head-shape expectations. |
| Swapped still + Kling Motion Control is available through ReAPI | The two operations are documented; their composition is an unvalidated proposed pipeline. It reconstructs moving footage and does not promise source-pixel preservation. |
| One successful still swap isolates the entire Seedance failure | Too strong. It shows that one engine handled one pose/image pair, not that Seedance's references, motion, preprocessing or identity weighting are proven correct. |
| One source photo is enough for the app | Not demonstrated. One photo is a useful controlled diagnostic condition, not a reason to remove supporting-view support or reduce provider image limits. |
| 480p diagnostic settles fine facial geometry | No. It can reveal gross identity failure; final fidelity acceptance also needs the intended delivery quality and difficult poses. |
| Provider completed means face replacement succeeded | False. Verify actual output provenance, appearance, timing, occlusion and silence separately. |
| The old user output might simply be the source file | It was a reasonable generic hypothesis, but prior saved evidence already shows a distinct provider output with captions changed. Do not ask the user to resupply already audited task assets or present source-URL reuse as the established cause. |

## Corrections before using the pasted examples

- Do not copy fal's `task: "editing"`, codec fields or SDK calls into the ReAPI
  adapter. Keep exact provider-specific request schemas and asset-token syntax.
- Record the complete operation: intended provider channel, mode, source length,
  source-derived shape/timing, ordered main/support images, compiled prompt and
  native audio flag. Our current ReAPI request type cannot express adaptive shape
  or automatic editing duration, so changing just the prompt is insufficient.
- Keep the main/supporting guidance, but do not label the actual supplied images
  as left/right profiles unless they show those views. Several of the five photos
  previously tested are similar angles. Do not generate invented facial anatomy
  or a beauty-enhanced identity as an automatic preprocessing step.
- Avoid the product label **Exact Face Swap** until accepted outputs demonstrate
  that promise. A dedicated tool's name does not prove full contour preservation.
- A canonical reusable person profile can be optional. Ordinary Hook/Wall
  creation should not require a new profile or separate screen. Reuse existing
  durable jobs/media/credits instead of adopting a parallel generic SQL design.
- The first document's “preserve original audio” and our “generate sound” are
  different actions. Retain default silence. If original-audio retention is added,
  implement and name it explicitly rather than changing the meaning of Sound ON.
- Caption removal is another edit. A face-only diagnostic can preserve captions
  to isolate identity; production acceptance must also check requested removal.
- Single-frame face swapping is paid, even if cheaper than video. Approval is
  still required. Never fan out hundreds of still swaps as an automatic video
  implementation or run a series of provider retries without an approved budget.
- The published sample's settled charge is historical, not a quote for our test.
  ReAPI edit auto-duration requires a submission reserve and bills source footage
  as well as output. Budget the whole attempt before requesting paid approval.

## Recommended sequence for this existing application

1. Complete the ReAPI source-edit path locally across UI, admission, provider
   request, source timing, billing estimate/reservation and saved-task recovery.
   Keep photo-only creation a separate supported intention. Keep the selected
   compatible model stable and reconcile gallery/prefix/user instructions.
2. Prepare one reviewable request using a genuine eligible source and the chosen
   main portrait. If retaining `cdd.mp4`, explicitly decide a short-source strategy;
   do not quietly pad or interpolate it and claim the original video is unchanged.
3. Ask permission for one bounded paid edit test. Evaluate target appearance and
   proportions independently from source performance, clothing, camera, timing,
   captions and audio. The request must explicitly retain the selected route.
4. Add supporting views as a controlled comparison only if useful, with approval.
   If the target appearance still fails, choose a still-swap diagnostic or a video
   face-replacement candidate based on the observed failure, not an assumed cause.
5. Treat face-swapped-still + motion transfer as a separate candidate if wider
   reconstruction is acceptable. Its promise differs from source-frame editing.

No runtime changes were made by this review. Existing local role bindings and
Sound OFF work remain un-deployed, and no acceptable new face-swap output has
been demonstrated.

## Primary sources checked

- [ReAPI Seedance task and channel rules](https://test.reapi.ai/docs/seedance-2-5)
- [ReAPI published subject-replacement experiment](https://test.reapi.ai/resources/higgsfield-genjutsu-alternatives)
- [Public experiment request/result receipt](https://test.reapi.ai/examples/higgsfield-genjutsu-alternatives/experiment-20261013.json)
- [ReAPI still Face Swap contract and head-shape limitation](https://test.reapi.ai/docs/face-swap)
- [ReAPI Kling Motion Control](https://test.reapi.ai/docs/kling-motion-control)
- [fal Seedance reference/edit schema](https://fal.ai/models/bytedance/seedance-2.5/reference-to-video/api)
- [Higgsfield Seedance video-edit API](https://open.higgsfield.ai/models/bytedance/seedance-2.5/video-edit/api-reference)
- [Magic Hour dedicated face-swap API](https://docs.magichour.ai/tools/video/face-swap-video)

## Third supplied document: task modes and generation workflows

The four `omni_reference_task_type` values are correctly listed: auto, reference,
edit and extend. Auto delegates classification; it is not another replacement
engine. The five workflow groups are explanatory categories based on media/roles,
not five additional accepted values for this parameter.

The central historical assertion is incorrect for our audited Seedance jobs:
“edit has already failed, so try reference next.” The saved five-photo task
`task_01a1596a5eb3749d8606a7384e159cd2` reconstructs to `reference`, with a matching
saved operation fingerprint. This is not a raw historical POST capture. The
separate Omni edit test must not be relabeled a Seedance edit test. Current code
still declares ReAPI reference and restricts explicit source editing to Omni.

Consequently, a properly integrated Seedance source edit remains an untested
candidate. A reference test with corrected identity bindings could also be useful,
but it would be an improved request within a previously tested mode, not our first
reference experiment. Do not conclude that both Seedance modes have failed.

For modifying supplied footage, evaluate edit with its complete supported
contract and an eligible source. For broader reconstruction, reference is a
legitimate candidate. A new performance from an already swapped still has no
motion-video input and cannot itself guarantee the original performance timing.
The pasted payloads again omit the selected `content_filter:false` route setting.

No paid comparison, application change or deployment was performed in reviewing
this third document.
