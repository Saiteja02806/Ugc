# Starting-frame scene drift — exact-job audit, 5 November 2026

**Finding: the image was generated, but it failed source-scene fidelity. The large composition change is already present in stage 1. Stage 2 preserved that incorrect scene rather than causing the initial restaging.**

This is a read-only application/backend audit. No new generation, request replay, build, deployment, prompt/UI change or backend mutation was performed. Only this report, appended incident memory and ignored local audit artifacts were written.

## Exact match and provenance

Matched owned job: `541e018a-69ad-4e62-a401-6526afb6c896`, source reference `explore-paired-hook-17133540b2315e0a3a05bfbd`. The connected account was verified through the profile connector before owner-scoped database reads.

The downloaded source, primary portrait and final result each have **exact decoded-pixel equality** with the user's corresponding attachment. This is not merely a similar-looking job or an inference from timestamps.

- Source image: `27abbeecffbe6bc4e30af2ddd2a5cc2cf56e7b5882b7eae28f9002c2c6a9795e`, 576×1024, original decoded frame index0/time0.
- Primary identity photo: `d89f29c4496b6b2a9bee8ad3c3fbaea9c5ef30d6bdeca5839e99e71decb9c7c3`, 720×1280.
- Supporting identity photo: `c563f687e9df6025bb7584dbb282073a803bd00adad3641f96ab8939c07699b7`, 720×1280. This second selected portrait was also sent; there were two identity photos, not just the one attached to the chat.
- Final output: `bf1c2a44b1e73b0e6252830d158e8c0a68754079c85d266fd6abae46a2ebbc3b`, 720×1280.

Saved selections: background=`source`, outfit=`source`, hairstyle=`source`; custom image instructions empty; prompt version7; Gemini3Pro through OpenRouter, startingFramePipelineVersion2, ratio9:16 and both model stages request imageSize2K.

The pipeline was reconstructed locally using those exact downloaded bytes and the saved job fields, with the network generation function replaced by an assertion that must never run. **All three stage-input fingerprints exactly match their persisted provider-operation fingerprints.** This verifies the complete assembled prompts, reference byte order, stage1-to-stage2 image binding and frozen settings at the application boundary. It is stronger evidence than inspecting current source alone. It does not claim access to the model's internal attention or hidden decisions.

## Observed flow and timing

Times are Asia/Calcutta, 5 November2026. Stage timestamps below are operation creation/output persistence, not exact upstream compute-duration measurements.

| Step | Time | Inputs/output | Finding |
| --- | --- | --- | --- |
| Job created | 14:12:40 | Frozen request and existing source PNG | Source was supplied and matched |
| Stage1 scene | 14:12:47–14:13:19 | Source opening + primary portrait + supporting portrait →1536×2752 PNG | Major scene/pose/expression/light drift already visible |
| Stage2 identity | 14:13:19–14:13:53 | Stage1 PNG + same primary/supporting portraits →1536×2752 PNG | Broadly preserves stage1's already-restaged composition |
| Harmonization | 14:13:54–14:13:59 | Local LAB/grain processing of stage2 | Exact local recomputation matches stored PNG |
| Final normalization | By14:14:01 | Saved harmonized PNG →720×1280 | Exact local recomputation matches final bytes |

Cloud Run logged job completion at14:14:01.934, worker revision `ugc-ai-generation-worker-r-ddbe2fdd`. Both paid image operations and the local harmonizer have persisted outputs, without saved errors. Technical job success is therefore confirmed; visual acceptance is not.

Stage1 provider ID: `gen-1793868167-JhyBODXlNUgACxdBdK4Q`.
Stage2 provider ID: `gen-1793868201-P9AxXCZIVfPWsXUtxLkM`.

| Source | Stage1 scene | Stage2 identity | Final |
| --- | --- | --- | --- |
| ![Source](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/starting-frame-drift-20261105/source.png) | ![Stage1](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/starting-frame-drift-20261105/scene-v1.png) | ![Stage2](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/starting-frame-drift-20261105/identity-v1.png) | ![Final](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/starting-frame-drift-20261105/final.png) |

Identity references, in their actual order:

| Primary | Supporting |
| --- | --- |
| ![Primary](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/starting-frame-drift-20261105/identity-1.png) | ![Supporting](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/starting-frame-drift-20261105/identity-2.png) |

## Quality assessment

Source: person toward frame-right with a tilted/angled head, gaze toward screen-left, a widely open mouth, raised hand on frame-left, visible room furniture and an overhead circular fixture. The final has a more centrally composed subject, gaze toward screen-right, hand on frame-right touching the mouth, a smaller open-mouth expression, a bright largely plain wall and changed light/camera relationship. The caption was removed and a cross necklace retained, but preserving those details does not compensate for changed scene geometry.

These failures are already present in the recovered stage1 output. Stage2 makes comparatively modest appearance changes while keeping that pose/background/hand placement. This is not a claim of exact identity fidelity: recognizable portrait traits are visible, but no calibrated biometric score or user acceptance was established.

| Quality dimension | Result |
| --- | --- |
| Correct source/reference files and original t0 | VERIFIED |
| Original room/camera/framing | FAILED visual review |
| Original gaze/head/hand placement and expression | FAILED visual review |
| Source lighting fidelity | FAILED visual review |
| Caption removal | Observed successful in supplied/recovered result |
| Necklace/cross retention | Observed retained |
| Recognizable identity | Qualitative resemblance; exact fidelity NOT VERIFIED |
| Animation-ready faithful original opening | NOT APPROVED due to scene/action-state mismatch |

The source's next motion was not analyzed from video in this audit. No full-video continuity or motion conclusion is claimed from these stills. There are no trees in this matched output; a separate trees output, if meant, has not been identified from the supplied attachments.

## Cause, contributors and uncertainty

### Confirmed failure location and architecture

The application supplies a full-image generative request with three images and role instructions. There is no source-preserving edit mask, fixed-background composite, pose-control channel or pixel-level scene constraint in this request. Therefore scene preservation is an instruction the generator can violate, rather than a property enforced by the application. In this request, it did violate it at stage1.

Stage2's Image1 is **the stage1 result**, not the original source frame. The identity-lock prompt explicitly says to keep Image1's composition, camera, pose, hand placement, lighting and background. It receives the same primary/supporting identity portraits, not additional hairstyle/outfit-person references. It consequently preserves the bad stage1 composition and has no original scene image to compare against. The source-role wording in stage2 refers to Image1 even though that image is now the generated scene; it cannot serve as independent original-scene evidence.

The pipeline validates source provenance, file validity and output aspect ratio, but it has no measured scene/pose fidelity gate between stage1 and the paid stage2 or before marking technical completion. Valid PNGs can therefore advance despite missing the requested shot.

### Verified prompt conflicts, not proven sole causation

The exact saved stage1 prompt simultaneously instructs:

- Preserve source gaze/expression and its light/shadows.
- Render a smooth youthful complexion with **relaxed lower eyelids and subtle expression** and no harsh forehead creases/frown lines.
- Give hands, neck, chest and face the **exact same brightness and texture**, without harsh dark shadows.
- Avoid a beauty filter or scene redesign.

The source is an expressive reaction with a wide open mouth and nonuniform illumination. The subtle-expression/beautification and equal-brightness clauses compete with faithful expression and lighting. These clauses exist in the actual fingerprint-matched request, so their presence is proven. Their individual causal effect on this particular generation is **not isolated**: no external A/B generation was authorized or performed.

The stage1 prompt has no measured description of this particular hand side, head tilt, gaze direction or visible room geometry; it relies on generic preservation wording and the source image. The two full identity portraits are competing whole-image visual context. Their contribution to background/pose leakage is plausible but not established by this single sample. It would be inaccurate to claim that the model definitely copied the supporting portrait's room or that one phrase alone caused the flip.

### Ruled out for this matched case

- Source PNG missing/not stored/wrong cached source: source checksum, attachment pixels and stage1 fingerprint match.
- Primary identity image omitted or source/identity references reversed: stage1 and stage2 reference-byte fingerprints match the correct recorded order.
- Source-background/photo-background choice mismatch: all three saved roles are source, and the corresponding instructions are present.
- Stage2 skipped: saved provider ID, input fingerprint and output prove execution.
- Prompt truncated by this application: reconstructed full scene/identity inputs match stored fingerprints; assembled texts fit the32,000-character adapter limit. Upstream internal processing is not observable.
- Harmonizer or final normalization introducing the restaged room/hand pose: those changes precede them, and both post-processing steps reproduce saved bytes exactly.
- Previous provider no-image failure: this is a distinct completed request with actual persisted images.

## Corrections recommended from this evidence

1. **Fix the stage1 contract first.** Remove generic youth/subtle-expression and equal-brightness requirements from the source-faithful route. Preserve the actual expression, skin detail, shadow variation and light direction. Version new prompts; do not change frozen old jobs/recovery fingerprints.
2. Bind concise source-specific shot constraints to the selected source SHA/t0 where reviewed evidence exists: hand on frame-left, source head tilt/gaze, actual room and source expression. Such text supplements the original frame; it does not guarantee fidelity or authorize a later-frame substitution.
3. Check stage1 source-scene fidelity independently before allowing it to proceed as a good scene. A valid image or correct aspect ratio is not sufficient acceptance. Establish pose/hand-side/camera/background criteria and failure behavior; do not add automatic paid retries.
4. Keep stage2 focused on identity within a validated scene. Merely attaching the original source as another unscoped full portrait would add competing identity context and would need controlled testing. The source can remain the application's validation authority without being an extra unlabelled stage2 face reference.
5. If the product needs stronger geometry/background preservation than whole-frame reference generation provides, benchmark a localized edit/compositing route with an explicitly controlled edit region, while preserving hands/occlusions and allowing only requested caption cleanup. This is a candidate requiring provider-capability/output testing, not a claim of implemented support or a guaranteed solution.

No application fix was made during this audit because the request was to identify/explain the flow and cause. New external generation remains unauthorized under the user's local-only instruction. The prompt conflicts and missing visual-quality gate are actionable design findings; the exact model-internal cause cannot be proven from logs alone.

## Evidence, procedures and changes

Read actual source/admission, worker routing, image download, staged pipeline, role options, durable-stage storage, harmonizer and final normalization. Consulted AGENTS, nonnegotiables, relevant Explore/clear history and context-memory/immutable-contracts/starting-frame/video-prompt/regression instructions. Large historical output was partly truncated; no exhaustive new read of its full contents is claimed. The Supabase skill had been read earlier in this conversation; its catalogued path is no longer present, so no fresh read is claimed. Preflight discoverability passed. No application edit or schema change was attempted.

Local audit checks actually run:

- Owner-scoped backend job/operation reads and first-party saved-media reads; all images decoded and stored SHA checked.
- `verify-flow.mjs` with current source loader and a transport assertion: exact stage1/stage2/harmonizer input fingerprints match; all three attachment decoded-pixel comparisons pass; zero new provider calls.
- `verify-postprocess.mjs`: saved harmonizer and final normalization bytes reproduced exactly; zero new provider calls.
- Existing Cloud Run log read confirms job completion/deployed revision. It does not contain a detailed model reasoning trace.

Ignored audit evidence under `.tmp/starting-frame-drift-20261105/`: `jobs.json`, `media-manifest.json`, `flow-proof.json`, `postprocess-proof.json`, `cloud-logs.json`, original reference/stage/final PNGs, exact [scene prompt](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/starting-frame-drift-20261105/scene-prompt.txt), exact [identity prompt](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/starting-frame-drift-20261105/identity-prompt.txt) and payload summaries with reference SHA/order. Credentials were not printed or written to these receipts. Old requests were not rewritten/retried.

Files changed: this report; appended incident evidence in `docs/ai-context/clear.md` and `EXPLORE_CONTEXT.md`; ignored local audit helpers/evidence. Runtime/UI/protected behavior remains unchanged by this audit. Status: exact-job cause location VERIFIED; source fidelity FAILED; corrective implementation and real output acceptance OPEN.
