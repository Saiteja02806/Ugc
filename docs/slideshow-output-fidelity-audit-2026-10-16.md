# Slideshow output fidelity audit — October 16, 2026

## Conclusion

The latest two-slide request was delivered correctly but executed through a
broad adaptation prompt rather than a sufficiently constrained edit workflow.
The user's intent was small business-specific changes, preservation of the
reference treatment, and insertion of an actual uploaded screen. The supplied
outputs instead redesign the scene and invent a product interface. These are
instruction-following and reference-fidelity failures, despite technically
successful provider jobs. Increasing queue capacity cannot fix them.

This is a read-only production investigation plus local stubbed replay. No
customer jobs, credits, provider calls or application behavior changed here.

## Latest batch, distinct from the earlier audit

Batch `2324bf8d-02c7-4010-8b76-19a93fcb94b7` was admitted at 13:14:40–41 IST
and completed at 13:15:09–13 IST. Jobs:

- Output 1: `3e09119d-3575-480a-865f-7946604e6343`.
- Output 2: `3bf345b6-65b2-48da-87d0-3f0ebbfeb0c2`.

Both use GPT Image 2.5 Flare, ratio 4:5, reference contract **v2**, one version
and two output slides. Both provider operations are `output_persisted`; both
one-credit app reservations are committed. Unlike the earlier rejected batches,
this completed batch did not fail for insufficient provider credits.

Both jobs contain the full exact supplied user prompt, the saved UGCPilot
business-profile v2 snapshot and three image inputs in this order:

1. Marketing slide 1, `slide-1-77e936eaeddc`: parcels/person clothing-brand cover.
2. Marketing slide 4, `slide-4-f8129bf7e149`: Cheap Mockups / ClothingBrandz.com.
3. Uploaded `7a025351-906c-43d1-83d7-166fe8580004`: the actual dark Explore page.

The user selected slides **1 and 4 correctly in this batch**. The earlier batch
`618eb823...` selected 1 and 5 (Pinterest); that historical mismatch is not an
explanation for this latest batch. Original catalogue numbering and selected
output numbering differ: original slide 4 is output slide 2 here.

Output 1 has style indices `[1,2]`, output 2 `[2,1]`, attachment `[3]` in both.
Image bytes stay ordered `[1,2,3]`; the prompt identifies a different primary
reference per output. The secondary reference still goes to each output.

## Observed output deviations

| Requirement | Supplied output | Assessment |
| --- | --- | --- |
| Change the cover background/content for SaaS, keeping the same font/white shape and making only slight changes | New warmly lit desk/laptop scene with much larger headline near the top and a different white shape | Requested words were adopted; preservation of typography, placement and treatment was weak. A cover background change was authorized, but the exact replacement scene was unspecified. |
| Keep the second reference's scene and screen placement; replace copy with UGC Pilot marketing text | New desk, plants, lamp, laptop framing, plain white headline; original two-level text treatment is absent | Clear excessive redesign beyond a screen/copy replacement. |
| Put the uploaded screen into the existing device | Both results depict invented light dashboards; the uploaded image is a dark Explore grid | Reference delivery succeeded, but screenshot fidelity failed. The screen instruction also appears to have spilled into the cover. |
| Keep exact visual elements | Original references are flat JPG images, not editable SVG/font layers | Font files and original vector shape geometry are not available to preserve deterministically through image prompting alone. |

## Confirmed prompt-flow problems

- V2 calls selected images style inspiration, using “Take inspiration” rather
  than a strict base-image edit contract. Its stronger preservation paragraph
  only applies to a separate regeneration/edit target, absent in this request.
- V2 permits explicitly requested text “preferably near the middle.” It does
  not require matching reference text placement, scale, line breaks, font or
  background shape. It also combines default caption removal with an exception
  for explicitly requested visible text, adding interpretation work.
- Saved business facts are followed by an instruction to use business tone and
  visual direction consistently. This can compete with preserving the native
  reference style; professional business tone is not authorization to redesign.
- Every output receives the entire multi-slide instruction text plus all three
  images. The slot identifies output 1 or 2, but v2 does not explicitly prohibit
  applying another output's screen/background changes. There is no extracted,
  independently confirmed edit specification per slide.
- The API uses `images.edit`, not text-only generation. It sends real reference
  image files. It supplies no mask, screenshot compositing, deterministic text
  renderer or post-generation semantic acceptance check. Persisting valid image
  bytes marks success even if the reference was not faithfully followed.
- A URL in the prompt does not cause a website crawl. Business facts come from
  Settings; the uploaded screenshot is the only actual site image input here.

These mechanisms plausibly explain the visible redesign, but source inspection
cannot establish the model's internal weighting of each instruction. The
trace establishes a flawed editing contract, not a claim to know model reasoning.

## Settings and non-causes

The adapter requests 1024×1280 for these versioned 4:5 slideshow jobs, followed
by composition-preserving normalization. Reference downloads pass the original
bytes without a resizing/recompression stage. The selected source JPGs are
1080×1444, so the output ratio differs slightly; that is not sufficient to
explain a wholly new dashboard, scene or text treatment.

The adapter leaves quality at the provider default (`auto`). This is not proof
that low quality caused the failure, and raising quality cannot guarantee
instruction fidelity. OpenAI's official guidance distinguishes output-quality
settings from preservation constraints and recommends explicit unchanged regions.
It also recommends compositing when a region must stay pixel-identical:
https://developers.openai.com/api/docs/guides/image-prompting

Do not blindly add `input_fidelity: high` for this model based on older model
advice; the reference documents that parameter for older GPT Image models:
https://developers.openai.com/api/reference/resources/images/methods/edit

## Existing local fix versus production

Current normal Cloud Run service traffic points to
`ugc-ai-generation-worker-r-cdf8c936`, commit
`cdf8c9361d59b74c4a97c00592de6ad3f29370e5`. The relevant latest jobs record v2.
The preservation-focused **v3 implementation is still local**. It explicitly
preserves the designated base's style, composition and text treatment, confines
business context, scopes changes by output and discourages invented dashboards.
Its presence in the working tree does not improve production jobs yet.

Local replay used the real compiled worker with provider/storage stubs. Both
v2 operation fingerprints exactly match the latest saved production records;
both prompts are 4,083 characters and include all three images and the user's
unchanged text. A separate hypothetical v3 replay retains these inputs, adds
the preservation/scoping guidance, and has distinct fingerprints. Its prompts
were 6,064 characters at the initial audit. The user's subsequent close-edit
clarification strengthens the still-local v3 wording to 6,718 characters; the
repeated replay still matches both unchanged v2 production fingerprints and
passes all preservation checks. The replay passes without network or paid generation.
This verifies construction, not provider obedience or new output quality.

Local account evidence remains in `.tmp/slideshow-input-audit/`:
`latest-2324-jobs.json`, `latest-provider-replay.test.mjs` and
`latest-slide-{1,2}-{v2,v3}-provider-prompt.txt`. These private input snapshots
must not be committed as application fixtures or sent to external diagnostics.

## Correction order

1. Deploy the compatible preservation worker, then the web API admitting v3;
   leave existing v2 inputs and their paid-operation fingerprints unchanged.
2. Verify first/fourth-reference mapping and acceptance on a fresh authorized
   generation. Review composition, headline wording/treatment and screen match,
   rather than using job completion as visual acceptance.
3. For reliable exact screenshot insertion, add a deterministic screen placement
   path: identify/confirm the screen corners and perspective-warp the actual
   screenshot into that region, preserving the approved surrounding photograph.
   Use controlled text/font/shape layers when exact typography is required.
4. Separate shared changes from each slide's allowed changes, with explicit
   reference/output labels. Treat screenshot replacement as scoped content;
   never allow the business profile to request a new scene by itself.

V3 is a bounded prompt correction, not a completed exact-compositing system.
No model switch, higher paid quality setting, automatic retry or new generation
was introduced by this audit.
