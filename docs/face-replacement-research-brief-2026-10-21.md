# Copy-paste research request: faithful face replacement for UGC Pilot

Research a practical, evidence-based way to implement faithful face replacement
in UGC Pilot's Hook and Wall of Text workflows. Use current primary sources and
link to the precise pages. Separate documented capability, vendor marketing,
your inference and unknowns. Do not generate media or incur charges.

Our intended input ownership is:

| Input | Supplies |
| --- | --- |
| `@Video 1` | Actions, expressions, gaze, pose, clothing, hairstyle, camera, lighting and scene. |
| `@Image 1` | The intended person's facial features, proportions and natural facial appearance. |
| `@Image 2`, `@Image 3`, etc. | Supporting views of that same person, not alternative characters, clothes or scenes. |

The result must visibly use the intended face, without blending it with the
source performer's face. Preserve the source performance and wardrobe. Body
regeneration is acceptable if those properties remain faithful; pixel-for-pixel
preservation outside the face is a separate, stricter requirement. Sound defaults
OFF. Caption removal is requested, but distinguish that additional edit from the
face-replacement evaluation. Also support photos + prompt without a source video:
that is new performance creation, not editing a nonexistent source.

Current integration, to verify independently:

- Seedance 2.5 via ReAPI, model `doubao-seedance-2.5-face`.
- Arrays are ordered `image_urls: [main, supporting1, supporting2, ...]` and
  `video_urls: [source]`; current local prompts bind `@Image N` and `@Video 1`.
- It still declares `omni_reference_task_type: "reference"`, a fixed output
  duration and explicit aspect ratio. A separate Seedance edit contract has not
  been integrated. Omni has its own edit path; do not conflate the two.
- Earlier five-photo Seedance output did not achieve the requested facial
  appearance. All five photos were attached with the correct main first. It
  lacked the new explicit provider tokens. No successful post-change paid test
  establishes that the newer instructions solve facial fidelity.
- Sources are approximately 3.1–3.17 seconds. Investigate source and output
  eligibility separately. Do not call four seconds a facial-quality threshold.

Answer these questions:

1. For this requirement, when should ReAPI use reference recreation versus
   source edit? Verify exact request fields, indexing syntax, source/output
   lengths, ratio behavior, audio flags, validation and billing. Provide separate
   JSON examples for source editing and photo-only creation. Never mix providers'
   schemas or invent identity-strength fields.
2. What do Higgsfield Face Swap, Recast, Genjutsu and its Seedance 2.5 workflow
   publicly disclose? Is there evidence that a particular face tool actually uses
   Seedance 2.5, a character system, masks or multiple passes? Mark undisclosed
   internals unknown. Do not assume every face tool is the same generic model.
   Verify current availability before drawing comparisons with OpenAI or others.
3. Which controls actually support facial geometry: main/supporting roles,
   diverse photo angles, face visibility and resolution, dedicated identity
   controls, masks/tracking or other documented tools? Distinguish model image
   capacity from a proven useful number. Do not promise that five images or a
   9:16 crop guarantees matching features.
4. Audit every app-controlled influence: model resets/fallbacks, gallery prompt,
   user prompt, shared prefix, source/identity precedence, physical text versus
   captions, native sound flags, provider prompt expansion, seed, duration,
   aspect/resolution, original uploads versus thumbnails, crop/re-encoding,
   output postprocessing, request recovery and deployment revisions.
5. Recommend the smallest coherent implementation and a bounded acceptance test.
   Judge the target face's eye/brow shape, nose, mouth, jaw/chin and proportions
   at comparable poses, plus temporal drift, occlusion, scene/wardrobe/performance
   preservation, timing, captions and silence. Check that the output is distinct
   from the source. Define failures and manual review, not an invented accuracy
   percentage or a universal embedding-score threshold.

Return a verified capability table, unresolved questions, proposed input/request
contract, compact task-specific generation prompts, prioritized fixes, and a test
plan with cost approval before any paid call. Do not recommend deploying an
unvalidated fidelity claim or rerunning the old paid request unchanged.
