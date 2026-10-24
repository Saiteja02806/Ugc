# Clearer source-frame validation plan

Status: evaluation design and code inspection only. No paid requests, selected
later frames, runtime changes or deployment. User wants validation before deciding
implementation. Clearer-frame benefit is a hypothesis, not an established cause
of the previous failures.

## What the implementation establishes

- `lib/explore/hook-keyframe-generation-api.ts` prepares frame index/time zero.
- `worker/src/lib/hook-keyframe-generation-contract.ts` rejects nonzero indices
  and timestamps in current receipts. `hook-keyframe-result.ts` returns index zero.
- `lib/explore/hook-keyframe-motion.ts` requires the selected index to match the
  reviewed plan; a new frame must not inherit a frame-zero plan automatically.
- `worker/src/lib/gemini-omni-video.ts` explicitly binds a starting image as the
  literal first frame and excludes source-video inputs from that mode. The motion
  description must be self-contained; saying “follow the reference video” does
  not supply that video. This observation does not establish other models' API
  capabilities or support for conditioning on an arbitrary intermediate frame.

## Stage 1: review source candidates, without generation

Select three source cases: a clear opening control, an occluded/closed-eye opening,
and a blurred or severely turned opening. Inspect the full performance segment and
its transitions before selecting candidate frames. Start with manual review and
timestamped contact sheets; do not implement an automatic selector first.

Prefer the earliest frame with adequate sharpness, exposure, face size/visibility,
and a usable pose within the same shot. Keep clothing, setting, props and the
intended performance. Do not require every face to be frontal. Consider whether
the frame provides a useful beginning to the action, not just an unobstructed face.
Exclude scene transitions, demo sections, different performers and frames with
insufficient context. If no suitable frame exists, record that outcome rather
than force a replacement. Record source hash, frame hash/index and presentation
timestamp; variable-frame-rate timestamps cannot be inferred from index alone.

## Stage 2: isolate frame selection in image generation

For each case compare original opening A with selected clearer frame B. Keep
Gemini 3 Pro, output settings, influencer photos, their order, and shared v4 image
prompt identical. Use the shared prompt without the optional frame-zero opening
description in BOTH arms, so that it does not incorrectly describe B. Freeze exact
prompt and input hashes before submission. Do not introduce v6 or another model.
The older completed tests are contextual evidence, not a matched A baseline.

Proposed bounded pilot: two outputs per arm per case, twelve images total, with
every result shown. Record errors and failures rather than replacing unfavorable
samples. Do not submit these calls merely by running preparation or documentation.

Review separate dimensions: selected-person resemblance, fidelity to the supplied
scene/clothing/lighting/crop, pose/hand/prop integrity, caption removal, and usable
opening state. Frame B is judged against B for shot fidelity; compare B against A
for loss of the source performance. A clearer source must not win solely by being
frontal or by dropping the important gesture. No claim of broad reliability from
three cases or a single influencer set.

## Stage 3: validate motion, not just the still

Only proceed for acceptable reviewed images. Define the reference's important
actions and emotional progression before viewing generated videos. Prepare each
motion plan from the actual approved image: opening pose, chronological actions,
ending state, duration, and continuity constraints. Preserve the important action
where feasible, adapting timing/order naturally; do not invent reverse motion to
force an incompatible original opening. Any dropped or changed key action must
be explicit in review. Reconcile the plan if the generated image differs from the
selected source; reject the image if the difference defeats the intended action.

Keep one video model/settings fixed across matched A/B branches. Compare complete
videos for likeness over time, coherent hands/props, scene continuity, no abrupt
reset to the source's old pose, and retention of the intended hook performance.
Record all clips. Quality and cost/latency should be assessed before expanding the
sample; paid video scope is a separate execution step, not assumed completed.

## Decision and eventual implementation

Advance only if the difficult cases show repeatable image improvement AND usable
motion without sacrificing the core performance. A clear-opening case should
remain on its original frame. Mixed results call for a selective fallback or
manual review, not catalog-wide replacement. Broaden to additional references and
influencers before claiming production reliability.

If validated, store reviewed selections and frame-specific motion plans once per
source revision, with a simple Change frame option. Version provenance/receipts,
extraction, history/recovery and motion bindings together; retain old receipts.
Never silently attach a new frame to an old opening description or motion plan.
Automation can later propose candidates with a review fallback; per-click source
analysis and a new handwritten prompt for every video are not prerequisites.
