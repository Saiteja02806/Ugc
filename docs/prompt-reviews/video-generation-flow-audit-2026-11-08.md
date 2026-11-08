# Video generation flow audit — 8 November 2026

## Scope and method

Question: how does a reference-style video actually get generated, where do the
normalized phase numbers become seconds, and which direct or indirect factors
can change the result?

Method:
- Three read-only sub-audits in parallel: prompt timing, starting frame, and
  model/provider + indirect factors.
- Direct verification of the critical claims by reading the source and compiling
  real prompts from the current plans.
- No provider call, paid generation, deployment or code edit was made for this
  audit.

## 1. The percentage → seconds pipeline (verified)

The phase numbers are **normalized fractions**, not seconds. They are converted
to seconds before the job is submitted, not by the video provider.

| Stage | What it does | Multiplier | Evidence |
|---|---|---|---|
| Authored plan | `PHASE [start–end]` where start/end are source time ÷ source duration; first 0, last 1 | none | `lib/explore/hook-middle-frame-motion.ts:56,63-66` |
| Validation | Requires a gap-free, overlap-free chain from 0 to 1; otherwise throws | none | `hook-middle-frame-motion.ts:90-99` |
| Conversion | `value × actionDuration`, rounded to 2 decimals | `actionDurationSeconds ?? durationSeconds` | `hook-middle-frame-motion.ts:100-102` |
| UI preview | Duration = `max(3, ceil(source - 0.001))`; action = `min(source, duration)` = source | source duration | `lib/explore/hook-keyframe-prompt-preview.ts:27,31-33` |
| API submission | `createHookSourceTimeline` freezes action = `min(source, selected)` and passes it into the compiler | `min(source, output)` | `worker/src/lib/hook-source-timeline.ts:11-19`; `lib/ai-studio/video-generation-api.ts:453-461` |
| Worker | Prompt is already literal seconds; it is trimmed and forwarded, not retimed | none | `worker/src/jobs/generate-hook-video.ts:149`; `worker/src/lib/ugc-video-prompt.ts:79-84` |
| Provider adapter | `prompt.trim()` is sent unchanged | none | `worker/src/lib/reapi-video.ts:78,82,89,107`; Gemini wrapper only adds a source prefix |

**Final hold:** when `actionDuration < outputDuration`, the compiler appends
`FINAL HOLD <action>–<output>s: Keep the completed ending pose…`. A source
shorter than the output therefore plays at source speed and holds the last pose;
a source longer than the output is compressed into the output.

### Real examples compiled from the current plans

| Reference | Source → output | Real compiled prompt (seconds) | Naive `×output` compile used earlier |
|---|---|---|---|
| Hook 01 | 3.07 → 4 s | 0–1.8, 1.8–2.14, 2.14–2.83, 2.83–3.07, **hold 3.07–4** | 0–2.35, 2.35–2.79, 2.79–3.69, 3.69–4, no hold |
| Hook 17 | 2.43 → 4 s | 0–0.35, 0.35–0.46, 0.46–0.81, 0.81–1.14, 1.14–1.35, 1.35–1.97, 1.97–2.43, **hold 2.43–4** | 0–0.58, 0.58–0.76, 0.76–1.33, 1.33–1.87, 1.87–2.22, 2.22–3.25, 3.25–4 |
| Hook 16 | 3.10 → 4 s | 0–0.47, 0.47–1.5, 1.5–1.67, 1.67–2.47, 2.47–3.1, **hold 3.1–4** | 0–0.6, 0.6–1.94, 1.94–2.15, 2.15–3.18, 3.18–4 |

This is the correct approach for source-faithful timing: the fractions preserve
source order and relative timing; the backend chooses the clock. The earlier
corpus audit compiled with `×output` and therefore overstated some timing
offsets. Content conclusions are unchanged; timing must be read from the real
compile above.

### Edge cases

- **No `PHASE` markers (was 23 of 106 plans).** Resolved locally on 8 November
  2026: all 23 now carry contiguous `PHASE` timelines authored from the 0.25 s
  source contact sheets. `retimeSourceMotionDirections` now applies the source
  clock, duration remap and final hold to every plan. Boundaries are estimates;
  generated adherence is untested.
- **Legacy receipt v4.** `createHookSourceTimeline` requires receipt version 5
  (`hook-source-timeline.ts:11-16`). A v4 receipt with `PHASE` is accepted by the
  API guard but receives no `actionDurationSeconds`, so the fractions are
  multiplied by the **output** duration and no final hold is added. New v5
  frames use the correct source clock.
- **Preview ≠ submitted prompt.** The preview compiles at
  `max(3, ceil(source))`; the submitted job compiles at the user's selected
  duration. If the user changes duration, the seconds and hold length change.
  The preview is marked `preparation_preview` and
  `canSubmitPaidAnimation: false`, but it is not the final prompt.
- **Delivered trim.** `createHookSourceTimeline` sets
  `trimEndMs = actionDuration × 1000` (`hook-source-timeline.ts:19`), and the
  initial Hook edit uses it (`generate-hook-video.ts:598`). When source <
  output, the generated clip contains the final hold but the default trim cuts
  at the source endpoint, so the delivered clip is source-length. The user can
  extend the trim. The documented "initial trim ends at the chosen duration" is
  not what the code does for source < output.
- **User text and the action grammar.** The Hook prompt rejects words such as
  "source", "reference", "original", "sound" and "N seconds" anywhere in the
  combined directions (`hook-keyframe-motion.ts:161,188-190`). A user sentence
  containing those words is rejected with the action-grammar error.

## 2. Direct factors that change the result

### A. Starting frame

- Normal Hook path: Image 1 is the **approved generated full-scene PNG**; the raw
  source frame is only Image 1 of the image model. Verified at
  `lib/ai-studio/video-generation-api.ts:368-374,714-720`,
  `worker/src/jobs/generate-hook-video.ts:667-709`.
- Exceptions: raw upload (`startingFrameJobId` absent) has no receipt/source
  binding; Talking Head `image_voice_reference` is a reference image, not a
  literal first frame.
- The approved asset is bound to the source hash, source frame index/time, image
  job, generation receipt and ratio (`lib/explore/hook-keyframe-result.ts:14-57`).
  A changed source, stale asset or different job returns 409.
- Identity photos are ordered by click order; Image 2 is the first selected
  photo and is declared "the main face identity image"
  (`lib/explore/starting-frame-workflow.ts:7-15`). There is no reorder control.
- The video API does **not** compare the animation photos with
  `receipt.personImageAssetIds`. `personImageAssetIds` is used in image
  preparation and the result guard, not in the video path. A different person's
  photos can be attached to an approved frame; the prompt then says Image 2
  decides the face.
- With any identity photo, Kling 4.0, Seedance 2.5 and WAN 3.0 switch to a
  **reference job** (`omni_reference_task_type: "reference"` /
  `generation_type: "reference"`), with the frame as Image 1. Without photos,
  they send a literal first frame. The reference route is documented in
  `EXPLORE_CONTEXT.md` but is a real fidelity difference.

### B. Model / provider

- The model label is an app alias. The same label can resolve to different
  upstream models: Omni via ReAPI vs direct Gemini, Seedance via ReAPI vs
  OpenRouter/Runway, WAN via ReAPI vs OpenRouter. The provider is pinned at
  admission (`video-generation-api.ts:705-708`) and re-verified by the worker.
- Route differences that change quality: reference vs literal first frame,
  `size:"adaptive"` vs explicit aspect ratio, moderation channel
  (`content_filter`), audio field support, prompt-length limits, resolution
  support, fixed `std`/720p tiers.
- No adapter exposes a seed, negative prompt, CFG or reference weight. The same
  prompt cannot be reproduced exactly.

### C. Prompt

- Timing is in seconds after the compile; camera, opening state and ending state
  are explicit for the 83 `PHASE` plans.
- Prompt length limits: Kling 3.0 = 2,500; Kling 4.0 = 10,000; Omni ReAPI =
  2,000; Seedance/WAN/FLUX = 10,000; direct Gemini = token preflight. Over-limit
  is rejected, not truncated, except the legacy Runway adapter (1,000-char
  slice).
- Starting-frame admission checks the **raw directions** at 6,000 chars, not the
  composed prompt. Kling 3.0 can pass admission and fail in the worker at 2,500
  after credit reservation.

### D. Settings

- Duration: the starting-frame picker offers `hookStartingFrameVideoDurations`
  — Kling 4.0 3–30, FLUX 3 5–20 — but both `buildHookAnimationPrompt` and
  `createHookSourceTimeline` cap the starting-frame prompt at **15 seconds**.
  16–30 s Kling 4.0 and 16–20 s FLUX 3 requests fail.
- Aspect: 9:16/16:9; the approved image ratio must match exactly. With a
  starting frame, Seedance/WAN send `size:"adaptive"` instead of an aspect
  ratio.
- Resolution: the approved still is normalized to 720×1280 or 1280×720 before
  animation; a 1080p request animates a 720p still. Kling 3.0 is forced to 720p
  and `std`.

## 3. Indirect factors that change the result

| # | Factor | Evidence | Impact |
|---|---|---|---|
| 1 | Kling 4.0 UI/starting-frame limit is 5 photos, but the generic policy caps it at 2 | `hook-starting-frame-video.ts:26-35`; `video-reference-policy.ts:15`; `video-generation-api.ts:502-505` | 3–5 photos pass the UI and fail submission; the 6 Nov "up to five photos" decision is not implemented for Kling 4.0 |
| 2 | Starting-frame durations 16–30 offered but compiler caps at 15 | `video-generation-workspace.tsx:1380-1383`; `hook-keyframe-motion.ts:191`; `hook-source-timeline.ts:15` | A legal-looking Kling 4.0/FLUX 3 request returns 400; long sources auto-default into the failing range |
| 3 | Composed prompt limit checked post-admission for Kling 3.0 | `video-generation-api.ts:625-628`; `worker/src/lib/video-prompt-policy.ts:32`; `generate-hook-video.ts:632-635` | Job fails after credit reservation despite passing admission |
| 4 | Identity photos are not bound to the frame receipt | `personImageAssetIds` appears in image prep/result, not the video API | A different person can be attached beside an approved frame; identity conflict |
| 5 | Reference-mode route does not pin t=0 when photos are attached | `reapi-video.ts:70-78,123-126,180-181` | The opening is reconstructed, not pinned; quality depends on the model |
| 6 | Preview compiles at `ceil(source)`, submission at the selected duration | `hook-keyframe-prompt-preview.ts:27-33`; `hook-source-timeline.ts:17` | The user can see a different timing from what is sent |
| 7 | Initial trim cuts at `min(source, output)`, not the chosen output | `hook-source-timeline.ts:19`; `generate-hook-video.ts:598` | A 3 s source at 4 s delivers a ~3 s clip; the final hold is trimmed by default |
| 8 | Legacy receipt v4 scales phases by output, no hold | `video-generation-api.ts:388-390,453-461`; `hook-source-timeline.ts:11-16` | Old approved frames get a different timing clock |
| 9 | Stale pending request reuses the prior model/duration/resolution | `lib/ai-studio/pending-generation.ts:77-96`; `video-generation-workspace.tsx:487-495` | "I changed the model and got the old settings" |
| 10 | Prompt grammar rejects common user words | `hook-keyframe-motion.ts:161,188-190` | Valid user instructions containing "source", "original", "reference" or "5 seconds" are rejected |
| 11 | Output metadata is the request, not a measurement | `worker/src/lib/video-output.ts:3-12`; `generate-hook-video.ts:586-595` | Duration/resolution/ratio can be reported incorrectly |
| 12 | No seed/negative/guidance; upstream model IDs are literals | all provider adapters | Results vary between identical requests and across provider revisions |
| 13 | Finishing re-encodes at CRF 18/20, forces 30 fps and scales/pads | `worker/src/lib/explore-video-composition.ts:148,157,301-302` | Generational loss and possible framing change at delivery |
| 14 | `NEXT_PUBLIC_ENABLE_OPENROUTER_*` gates ReAPI-routed models | `lib/ai-studio/generation-settings.ts:82-89`; `video-generation-api.ts:350-352` | Build/runtime env skew hides or exposes models without a product reason |
| 15 | History metadata omits Kling/FLUX model | `lib/ai-studio/generated-video-history-metadata.ts:2,36` | Quality differences cannot be attributed to a model |

## 4. What this means for reference-style quality

The percentage approach is correct and should stay. It is the only way to keep
source timing stable when the user changes output duration. The main quality
gaps are elsewhere:

1. **The 23 untimed plans are now timed (8 November 2026).** All 106 plans carry a
   contiguous `PHASE` timeline; content text unchanged. The remaining work is a
   controlled generation to measure adherence.
2. **UI/server mismatches** fail or weaken valid requests (Kling 4.0 photos,
   16–30 s durations, Kling 3.0 composed prompt).
3. **Identity and route binding** are weaker than the UI implies: photos are not
   tied to the approved frame, and reference-mode routes do not pin t=0.
4. **Preview, submission and trim use different clocks.** The user sees a
   preview at source-rounded duration, submits at the selected duration, and may
   receive a clip trimmed back to source length.
5. **No output measurement or seed** makes quality regressions hard to attribute.

## 5. Recommended fixes, in order

1. Add contiguous `PHASE` timelines (or explicit seconds) to the 23 no-`PHASE`
   plans. Do not change their content.
2. Fix the Kling 4.0 photo cap: align the policy, UI and adapter at 5 photos (or
   change the product promise to 2, but do not leave the mismatch).
3. Align starting-frame duration lists with the 15 s compiler cap, or raise the
   compiler and `createHookSourceTimeline` cap and test the provider limits.
4. Validate the **composed** prompt against each model's limit at admission.
5. Bind animation photos to `receipt.personImageAssetIds`, or make replacement an
   explicit, warned action.
6. Compile the preview at the selected duration (or show both "source-speed
   preview" and "submitted" seconds) so the user sees the real prompt.
7. Decide the initial trim rule: source endpoint (current) or chosen duration
   (documented). Align code, docs and tests.
8. Record the real provider/model string and probe the output duration,
   resolution, fps and aspect with ffprobe.
9. Add parity tests: UI duration/photo caps vs policy vs adapter; preview prompt
   vs submitted prompt; composed prompt at each limit; identity binding.
10. Decide whether to add seed support for reproducibility.

## 6. Verification status

- Percentage → seconds conversion: **VERIFIED in code** and reproduced with the
  real compile for Hook 01, 16, 17; Hook 15/85 have no timeline.
- Real preview/submission clock: **VERIFIED**; the earlier corpus audit used a
  naive `×output` compile, so its timing offsets were overstated (content
  conclusions unchanged).
- Kling 4.0 photo cap, 15 s duration cap, Kling 3.0 prompt limit, trim end,
  reference-mode routes, and photo/receipt gap: **VERIFIED in code**.
- Provider behavior (does the model obey the seconds, literal frame, audio,
  identity): **NOT TESTED**; no paid generation was run.
- Hosted/production env parity: **NOT VERIFIED**.

## 7. Correction to the corpus prompt audit

`docs/prompt-reviews/corpus-prompt-audit-2026-11-07.md` compiled prompts with
`durationSeconds` only. The real preview/submission passes
`actionDurationSeconds = min(source, output)`. For source < output this changes
every second value and adds a FINAL HOLD. The corpus audit's **content** verdicts
and the 23 no-`PHASE` finding stand; its **timing** comparisons should be read
with this correction. Re-checked examples: Hook 01's real hand-to-mouth phase is
1.8 s (source ~1.75 s), and Hook 17's real smile onset is 1.35 s versus ~1.5–1.6 s
observed — about 0.2 s early, not the earlier 0.66 s.

## 8. Fixes applied - 8 November 2026

| Problem | Status | Evidence |
| --- | --- | --- |
| Kling 4.0 offered 5 photos, server capped at 2 | FIXED | The API uses the starting-frame face limit for maxImages/maxReferences; five-photo admission test passes. |
| Starting-frame durations 16-30 offered but compiler capped at 15 | FIXED | Explicit maxDurationSeconds through the prompt/timeline/worker parse; 20 s Kling 4 timeline test passes. |
| Kling 3.0 2,500 limit enforced after credits | FIXED | ReAPI docs confirm 2,500; composed prompt checked at admission before reservation. |
| Generated vs delivered duration and trimmed hold not explained | FIXED (clarity) | Composer field hint, footer summary and editor trim note; 113 UI tests pass. Default trim unchanged. |
| Identity photos not bound to the approved frame | OPEN | User decision needed: remove video-stage photos or add an explicit exact-frame vs reference-mode choice. |
| Reference-mode opening not literal t=0 | OPEN (trade-off) | Kling 4/Seedance/WAN use a reference job when photos are attached. |
| Output metadata not measured, no seed, stale pending settings | OPEN | See sections 3-5. |

No paid generation was run. Provider-side behavior and hosted acceptance remain NOT TESTED.
