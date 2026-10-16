# Reference-edit slideshow model review — October 16, 2026

## Recommendation and evidence limits

Use GPT Image 2.5 Sunburst as the first quality-focused candidate for the current
slideshow integration. Compare Gemini 3 Pro Image separately for professional
text, localization and reference edits. Keep Flare as the speed candidate after
quality acceptance. This is a documented-fit recommendation, not a measured
cross-provider winner. We have inspected actual Flare production failures under
the old v2 prompt, but have not run a paid head-to-head with corrected prompts.
The old prompt prevents blaming those results entirely on Flare.

The most reliable implementation for this product is an editing pipeline:
retain approved source pixels, edit only changed regions, render controlled
text layers and composite actual screenshots. Generative models should handle
regions that need new imagery. A city name or headline replacement does not
need the whole scene regenerated.

## Current integration findings

- The slideshow selector exposes Flare, Sunburst and Nano Banana. Default is
  Flare. Gemini 3 Pro and Seedream are not admitted slideshow model choices.
- The worker supports Gemini 3 Pro/Seedream in other workflows, but adding them
  to slideshows requires reviewing admission, reference limits, durable resume
  and prompt behavior; a label change alone is insufficient.
- The live Nano Banana route uses `GEMINI_IMAGE_MODEL=gemini-3.1-flash-image`,
  while the selector says **Nano Banana 2.1**. Current Google docs distinguish
  that model (Nano Banana 2) from `gemini-nano-banana-2.1`. Align the label and
  tested actual model before claiming a 2.1 evaluation. No route was changed here.
- OpenAI slideshow jobs use `images.edit` with reference image bytes and an
  explicit Flare/Sunburst ID. Quality is omitted (`auto`), and 4:5 results are
  normalized to 1024×1280. Higher-resolution output would currently be reduced
  to that delivery size; extra generation pixels are not automatically retained.
- Nano Banana currently requests 1K. Gemini 3 Pro's other-workflow adapter
  requests 2K. Those settings are not a fair matched image-quality benchmark.

## Model roles

| Candidate | Documented fit | Product-specific judgment |
| --- | --- | --- |
| GPT Image 2.5 Sunburst | Quality-focused base model; editing and subject preservation | First quality baseline; already admitted by slideshow API. Must validate exact text, scene drift and latency. |
| GPT Image 2.5 Flare | Smaller, speed-focused model with editing improvements | Useful for volume only after close-edit acceptance. Old failures are evidence against the old combination of prompt/model, not a controlled model ranking. |
| Gemini 3 Pro Image / Nano Banana Pro | Professional asset production, text, localization and precision control | Strong comparison candidate, especially local-language text; currently outside slideshow admission. |
| Nano Banana 2.1 | Efficient image generation/editing and multi-reference consistency | Throughput candidate; actual live configured model differs from the 2.1 label. Neither is measured against Sunburst on this app's cases. |
| Seedream 5.0 Pro | Reference-image editing and multi-reference fusion | Possible later comparison, not a reason to expand this release before evaluating existing options. |

Primary sources, retrieved October 16:

- OpenAI: https://developers.openai.com/api/docs/guides/image-prompting
  Describes Sunburst as quality-focused and Flare as speed-focused; calls for
  workload evaluation, explicit preservation constraints, and compositing where
  pixels must remain unchanged. Increasing quality is not a fidelity guarantee.
- Google: https://ai.google.dev/gemini-api/docs/image-generation
  Distinguishes Nano Banana versions and professional Pro role; documents
  reference editing, text generation, model limits and targeted changes.
- Runway: https://docs.dev.runwayml.com/guides/models/
  Lists Seedream 5.0 Pro as an image-editing/multi-reference option. Provider
  descriptions are not independent comparative benchmark results.

## Business context: current behavior and recommended scope

Yes, the slideshow API loads the authenticated owner's applied Settings profile,
freezes it in each job and appends its facts to the provider prompt. Fields:
businessName, productSummary, targetAudience, category, mainProblem, mainPromise,
valueProps, painPoints, differentiators, brandTone, visualKeywords, ctaIdeas and
claimsToAvoid. The audited completed batch includes these facts. A typed website
URL does not fetch that site or automatically capture its real UI.

For close editing, prefer a short slide-specific factual subset: business name,
relevant product fact, exact approved replacement text, required location or
language, and claims to avoid. Keep tone/style/CTA suggestions out unless the
user requested those changes. The current local v3 prompt constrains those
fields but still sends the full snapshot; context minimization is a recommendation,
not an implemented behavior change in this review.

## Proposed per-output prompt

Send this once for each output, filled with only that slide's changes. Keep the
original user request for provenance and resolve it into an explicit edit brief;
do not silently discard meaningful user constraints. Number inputs according to
the actual file order. Prefer the base slide first, then only required attachments
when a new versioned delivery contract is implemented; do not reorder old paid
jobs or their operation fingerprints.

```text
TASK: Closely edit the designated base slide. Produce one edited slide.

INPUTS
Base slide: image {base_image_index}.
Replacement asset: image {replacement_image_index}, used only in {target_region}.

ALLOWED CHANGES
{small explicit list of replacements for this output only}

PRESERVE
Keep the base slide's layout, camera angle, crop, lighting, colors, photographic
texture, objects and background, except for the allowed changes. Preserve its
headline placement, font appearance, size, line arrangement and white text-box
shape. Make the smallest necessary fit adjustment for replacement wording.
Do not redesign, polish, recolor, add props or introduce another slide's changes.

TEXT
Render the supplied replacement wording verbatim. Add no slogans, claims,
statistics or CTA. Preserve existing text outside the explicit replacements.

SCREEN REPLACEMENT, WHEN REQUESTED
Use the uploaded screen's actual interface, colors, text and layout within the
existing device screen. Keep the device frame, screen geometry and perspective.
Do not invent a dashboard. Do not put the screen on another slide.

BUSINESS FACTS
{minimal verified facts relevant to these replacements}
These facts establish meaning; they do not authorize visual or tone changes.

OUTPUT
One {ratio} slide. Keep all content inside the canvas. No contact sheet.
```

The screen instructions are a model request, not a guarantee of actual pixel
placement. Deterministic compositing remains the reliable exact-screen path.
An original JPG does not contain the source SVG or font file; exact reproduction
requires a rebuilt controlled text layer and the chosen/approved font.

## Concrete brief for the reported two slides

Output 1 (base = selected original slide 1):

- Replace the heading with exactly `Everything You Need To Start A SaaS`.
- Keep the existing white headline-box treatment and comparable typography and
  placement. Do not move it to a new region or add promotional text.
- The user allowed a different background but did not specify it. For a new
  test, either retain the original as a preservation baseline or agree one
  specific SaaS-relevant scene. Do not silently use an elaborate invented desk
  scene as the acceptance target. Do not insert the screenshot into this output.

Output 2 (base = selected original slide 4):

- Replace `Cheap Mockups?` with exactly `UGC Pilot for Marketing`.
- Replace `ClothingBrandz.com` with exactly `getugcpilot.com` inside its existing
  white box. This explicit two-part mapping removes ambiguity in the original
  combined wording; it is a proposed brief, not a recovered user instruction.
- Put the uploaded Explore screenshot inside the existing screen. Keep the dark
  room, orange light, device angle/framing and all surrounding objects unchanged.
- Preserve typography/placement as closely as possible. Add no new logos, props,
  slogan, invented metric or UI.

## Practical acceptance experiment before choosing a default

Do not compare a new model/new prompt/new size simultaneously and attribute all
improvement to the model. First establish a corrected-prompt baseline, then hold
inputs, prompt and delivery size fixed across candidates.

Use 12 representative edits (headline/brand swaps, city/language localization,
screen insertion, product swap, requested background change). Repeat each twice.
Two currently admitted candidates make 48 paid images. Expand to a third only
when that comparison can answer a remaining quality or cost question.

Score blind: unrequested scene drift, exact headline spelling, text-box/font
treatment, correct attachment placement, screen fidelity and slide-specific
scope. Record latency, failure rate and actual provider spend per accepted image,
including rejected results and retries. For controlled composites, verify image
regions outside the edit area remain unchanged, except planned resizing.

This review runs no such paid comparison and does not change model defaults,
quality settings, context shape, provider keys, UI labels or production routing.
The recommendation remains provisional until real outputs pass these criteria.
