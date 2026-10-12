# Slideshow reference audit — 2026-10-11

Scope: trace Explore Slideshows from reference selection and instruction attachments through the image API, job payload, provider request and final output. This is an audit; no product code, production records or deployments were changed. No paid generations were submitted.

## Result

The current local code supplies the actual bytes of selected layout images and attached images to both supported providers. I did not find the Hook/Wall problem where a gallery reference was only UI metadata and never reached the provider. However, there are two concrete defects and another gap in how references are described to the model.

### 1. GPT outputs are cropped after generation

`worker/src/lib/openai-image.ts:59` requests square `1024x1024`, landscape `1536x1024`, or portrait `1024x1536`. These are not the requested 4:5, 9:16 or 16:9 ratios. `worker/src/lib/image-output.ts:23` then uses Sharp `fit: "cover"` with `position: "attention"` to produce the final selected ratio.

This discards part of an otherwise successful provider result. Captions, faces, product edges or layout elements near the edges can disappear. For a 4:5 output, the 1024x1536 provider image becomes 1024x1280, losing 256 rows (16.7% of its height). The 9:16 and 16:9 paths also require cropping; 1:1 does not.

Reproduced offline against the actual `prepareAIStudioImageOutput` function using a synthetic 1024x1536 image with separate 64-pixel top and bottom markers. The output retained all 65,536 top-marker pixels and zero bottom-marker pixels. This reproduction is `.tmp/slideshow-crop-audit.mjs`; it does not invoke a provider.

The current [OpenAI image edit reference](https://developers.openai.com/api/reference/resources/images/methods/edit) supports arbitrary resolution strings for GPT Image 2.5, subject to size constraints. A focused fix can request the intended ratio for Slideshow GPT jobs and preserve the whole generated composition during output normalization. Keep legacy provider sizing separate and validate content preservation, not only output dimensions.

### 2. Recreating a slide without extra attachments assigns the wrong role

`components/explore/format-workspace.tsx:335` stores the editor's existing image as the regeneration target. It exposes the target as `recreateView.referenceImageAssetId` at line 346, while the original selected layout images remain in `referenceImageUrls`.

`components/workspace/ugc-chat-workspace.tsx:644` uses `regenerationImageAssetId` only when there are instruction attachments. Without those attachments, it sends the existing slide through the legacy scalar `referenceImageAssetId` field.

`lib/ai-studio/image-generation-api.ts:182` appends that image and assigns `subjectReferenceIndex`. `worker/src/lib/slideshow-reference-prompt.ts:2` consequently tells the provider that the existing slide is a subject/product/style reference. It does not identify it as the existing slide to edit and preserve. By contrast, the path with extra attachments correctly supplies `regenerationReferenceIndex` and explicit preservation instructions.

The existing slide is transmitted, but its role is wrong. This can cause a request such as “change only the heading” to rebuild from the catalog layout or alter unrelated content. Actual model failure is not established by the audit, because no paid visual test was run.

A focused fix should give the regeneration target its own role with and without extra attachments, including attachment-free regeneration after removing the catalog reference. Preserve compatibility with already queued scalar subject/style jobs rather than reinterpreting them globally.

### 3. Layout-only requests do not explicitly identify the primary edit target

`components/explore/format-workspace.tsx:206` makes the selected preview slide the first image and describes other checked slides as context. However, `worker/src/jobs/generate-image.ts:108` adds reference-role instructions only for subject or attachment roles. A request containing only selected layout images sends the raw user prompt and ordered images without explicitly distinguishing the primary slide from supporting layout context.

The images reach the provider, but the intended roles are less clear than in the attachment path. The model can blend layouts or interpret an ambiguous instruction against the wrong slide. This is a prompt-contract gap, not proof that any particular output ignored its reference. If addressed, use an explicit contract/version for new jobs so already queued requests retain their existing provider fingerprints.

## Important workflow limitations

- Selecting a slideshow initially selects only the active slide as generation context; users must choose other slides or use “Use all” to include them. Unchecked images are intentionally not supplied.
- All checked reference images guide every requested output. “Versions for this slide” means alternative results for one primary slide, not one recreated result for each source slide. Users assemble the final slideshow in Edit slides. There is no automatic full-deck recreation or cross-slide identity consistency pass.
- Completion means the image was returned, processed and stored. It does not verify whether text was removed, a particular person/product was preserved, or every visual instruction was satisfied.
- Slideshow prompts are preserved rather than silently shortened. However, the Slideshow API lacks a prompt-length preflight check. OpenAI's documented edit prompt limit is 32,000 characters, including any role instructions added by the worker; exceptionally long instructions can be rejected by the provider. This is a secondary validation gap, not a dropped-prompt finding.

## What was verified

- Selected layout URLs are frozen into each queued output and resolved before provider submission.
- Multiple attached images retain their order and remain separate from layout images.
- OpenAI uses `images.edit` with every downloaded reference as a file; Nano Banana uses image input blocks containing every reference's encoded bytes.
- Invalid, foreign, unavailable or excessive reference inputs are rejected rather than silently omitted.
- Upload-pending controls block generation. Reference, attachment, prompt, model, ratio and quantity changes reset the submission key.
- Image selection resolves owned, ready generated media assets before they enter the editor; reference thumbnails and job IDs are not substituted for generated media assets.

Focused API, worker, provider, editor and UI-contract checks: **99 passed, 0 failed**. Log: `.tmp/slideshow-reference-audit-tests.log`. These tests establish input transmission and lifecycle behavior, not model likeness or visual instruction compliance. Existing output tests validate dimensions and do not catch the demonstrated edge-content loss.

## Production limits of this audit

The real production URL `https://www.getugcpilot.com/explore/slideshows` redirected the browser to `https://getugcpilot.com/sign-in`; no authenticated generation was possible in the available session.

Read-only queries against the connected UGC Supabase project found no jobs tagged `exploreFormat: "slideshow"` or using `gpt_image_2_5`. The inspected account's recent generic image jobs had neither slideshow tags nor reference-image inputs, so they cannot validate this workflow. Therefore, the local implementation is audited and tested, but production parity and visual generation quality remain unverified. An untagged older job cannot be reliably classified as a Slideshow run from these checks.

No database updates, credit-consuming API calls, pushes or deployments were performed.
