# Starting-image identity audit and rounded picker buttons

29 October 2026. No generation, paid retries, production mutation or deployment.

## Verified saved job

Read-only production database audit found completed image job `e191eb25-640e-4538-b331-f77e54919b6a`, created2026-10-29 11:05:30 UTC. Model key `gpt_image_2_5` maps to GPT Image2.5 Sunburst. Source `explore-paired-hook-892b0f65083c8cf03270a7c9`; contract version5, promptVersion7, original opening frame index0/t=0, source-frame SHA256 `aac0d4408907a6e9caf5c22d5e15514831ef3115b3a130c1103d9dafb5198e9b`.

The stored request contains two image URLs in order: source opening, then the selected influencer photo. `personImageAssetIds` contains the intended photo asset. Downloaded existing source/identity/output files were visually inspected. The identity and output match the supplied screenshots. Local copies: `.tmp/starting-frame-quality/source.png`, `identity.png`, `output.png`.

The saved prompt explicitly assigns Image1 to scene/camera/pose/clothing/light and Image2 to influencer identity, prohibits blending the source performer's identity, and requests caption/logo/text removal. The local worker's Sunburst route preserves image order and adds explicit input labels. Two targeted mocked-provider job tests PASS for ordered source/person inputs and opening-only delivery. This validates current code, not the historical provider's internal interpretation. No complete historical provider HTTP request or provider request ID was available from the queried job output.

## Visual findings

| Dimension | Finding |
| --- | --- |
| Identity likeness | Insufficient: result remains visually close to the source performer rather than clearly adopting the supplied influencer's proportions. Reject this image for identity quality. |
| Opening pose | Result largely follows the stored original t=0: closed eyes/open mouth and glasses being lifted. The user's first screenshot shows glasses still on the face and is a different source moment. Do not call that difference proof of an incorrect generated pose. |
| Scene/outfit | Source room geometry, dark straps and framing largely preserved. Some generative detail/crop/light variation remains. |
| Caption cleanup | Added source words and emojis removed in the output. |
| Hands/prop | Glasses/hand action largely retained; likeness failure is a separate criterion. |

Evidence does not support saying the influencer photo was absent from the saved job. It supports weak identity transfer for this result. Prompt/reference weighting versus model capability remains unresolved; one result cannot prove a permanent model constraint. The prompt already contains identity instructions, so adding the same sentence again is not an established fix.

The picker screenshot shows0of10selected: a hovered/outlined tile is not proof of selection in that screenshot. The historical job independently records one selected photo; do not infer an empty submission from a later chooser state.

## Recommended controlled next test

Keep this exact source t=0, selected identity, model, output settings and one output fixed. Compare the current source-heavy wording to a concise identity-first candidate that explicitly makes the supplied influencer the only subject while preserving the source action, light and clothing. Review identity, pose, scene, cleanup and hands separately. Only after that evidence compare models or input-role alternatives. No candidate was applied or generated in this audit; existing jobs/prompts remain frozen. Do not move to a later frame to hide the identity failure.

## Requested UI change

Scoped pill-radius styling added for person-photo picker section buttons, source tabs, upload/refresh actions and footer buttons. Existing card thumbnails, layout, selected state, click handlers, global buttons, scheduling and generation settings unchanged. `UGC Pilot images` remains a text link.

Files: `components/explore/format-person-image-picker.module.css`, `scripts/starting-frame-compact.browser.cjs`, this receipt and incident/context notes. No prompt/model/runtime generation logic changed.

Verification:44 focused selection/upload/reference checks PASS;2 mocked provider source-role tests PASS; local actual-component browser at1280px/390px PASS for opening/selection retention and computed999px radius on source tabs, Upload photos and Done. Scoped ESLint and diff whitespace PASS. Screenshots in `.tmp/starting-frame-compact/chooser-1280.png` and `chooser-390.png`; isolated fixture, not hosted acceptance. Production button appearance and a newly generated identity-correct image remain NOT VERIFIED.

Preflight: scoped Explore/context/nonnegotiable contracts, ugc-context-memory, ugc-immutable-contracts, ugc-ui-clarity, ugc-starting-frame, ugc-video-prompt and ugc-regression-gate; Supabase skill for read-only job inspection. Incident UGC-VID-STARTING-IDENTITY-20261029 remains OPEN for output quality; local rounded-button styling verified.
