# Repeating the source-video and prompt review

Saved 26 October 2026. This guide records the process used in the 116-reference Hook audit and the next acceptance steps. It does not claim that all revised prompts were activated or tested by generating videos.

## Why we did this

Hook 01's earlier prompt described a reach and closer framing but did not clearly explain the change to handheld movement, continued offscreen grip, irregular shake and final edge crop. The revised camera wording produced a visibly better ending with the same approved image, model and duration. It was an improved partial pass: timing, scale and camera path still differed. One improved sample does not prove repeatability or that wording alone caused every difference.

We therefore compared each other source against its own assigned prompt. We did not copy Hook 01's shake into videos whose cameras were stable.

## What is completed

- All 116 source-to-prompt comparisons: 85 normal and 31 middle-frame cases; 104 public and 12 private references.
- 31 correction-drafted records, including some earlier timing-specific corrections; 85 with no newly identified content gap. Those numbers are audit labels, not generated-video failures or passes.
- Revised candidates saved with source IDs, hashes, timing evidence and separate generation status. Private prose remains in ignored local artifacts; shared records contain sanitized pointers.
- The final 56 reviews covered 5,292 decoded thumbnails on 206 native contact sheets, with 63 targeted full-resolution checks. Every decoded thumbnail was inspected through the source ending; not every frame at original resolution.
- Source/timeline/compiler/package checks passed. The compiler suite passed 10/10 tests.

The new audit candidates have NOT replaced live application prompts. The final 56 have no new generated-output tests. Private drafts have NOT been repackaged into a released encrypted package. No deployment was performed for this audit.

## Repeat the process

### 1. Recover context and freeze the baseline

Read AGENTS.md, EXPLORE_CONTEXT.md, docs/ai-context/clear.md, nonnegotiables and the applicable local skills. Use frame-analysis and video-prompt, then opening-frame-prompt or middle-frame-recreation-prompt according to the route. Apply starting-frame guidance when preparing identity images. Follow immutable-contracts and regression-gate for implementation work.

Inspect git status and preserve existing changes. Run the repository preflight. State the scope: source review/drafts, a controlled paid pilot, runtime assignment or deployment are separate stages. An audit does not authorize generation or deployment.

For each reference, preserve its unique ID, original source file and SHA, duration, decoded count, original presentation timestamps, assigned prompt and any previous output/receipt. Titles alone are insufficient because titles can repeat. Save old prompts and outputs before revising them.

### 2. Establish the opening-image roles

**Normal:** prepare an influencer image matching the original source at t=0. Remove baked captions in the image-preparation prompt. Check the resulting image for identity, scene, framing, expression, hands, props and caption cleanup separately before using it for animation.

**Current user policy — 28 October 2026:** all new cases use the original source's first decoded frame at elapsed t=0. Do not attach a later clarity frame during starting-image preparation or animation. Preserve the opening pose, including hands/props obscuring the face, and review the generated image before animation. The earlier 31 middle-frame cases are a migration inventory, not a continuing new-request mode. Retain their old bindings and receipts unchanged for history.

For example, if the source begins with a hand over the mouth, prepare that original hand-over-mouth opening with the selected influencer photos. Do not substitute the later uncovered pose or attach a later source still. If identity quality cannot be established, stop at image review rather than passing an unsuitable image onward.

The video stage receives one approved starting image. Reuse the same selected influencer photos as appearance references only on a verified supporting route, preserving explicit user changes/removals. Bind the literal first-frame and appearance roles in the actual request; a portrait must never become an end frame. Unsupported routes keep the single-image input. Freeze the input count/roles in every controlled comparison; do not silently change an old experiment. This may help identity consistency but is not a generated-output guarantee.

**Lighting and outfit gate:** the source opening controls light direction, softness, color cast, exposure, contrast, shadow/reflection behavior, outfit, scene and camera. Identity photos control facial identity, not their clothes or lighting. Check those separately after generation. Hook7's six-still report records v4 outfit leakage and conflicting caption instructions in the face-swap alternative; it contains no video trial or reliable model-wide winner. Do not claim a prompt can preserve every exterior pixel exactly through generative recreation.

### 3. Inspect the complete source

Extract every decoded frame and create ordered contact sheets with frame indices. Retain the original input timestamps: nominal index/fps labels can differ from container timestamps. Inspect all thumbnails, including the last sheet. Open full-resolution frames around ambiguous props, gaze, occlusion, cuts, camera changes and endings. Revisit uncertain details rather than inventing them.

Record what is visible separately from explanations inferred from it. A reaching arm followed by a tilted, shaky viewpoint can support inferred phone handling; it does not establish a directly visible grip or a second phone.

### 4. Compare evidence against the assembled prompt

Use this table for each meaningful interval:

| Source interval / frame indices | Visible action, expression and gaze | Hands / props | Camera / cut / crop | Existing prompt clause | Gap or contradiction | Revision and confidence |
|---|---|---|---|---|---|---|
| t=0 through first transition | Opening pose and held reaction | Existing contact/grip | Opening composition | Exact assigned clause | Supported finding or none | Source-specific wording |
| Final transition through last frame | Final action and hold | Final contact/grip | Final framing/motion | Exact ending clause | Supported finding or none | Include follow-through |

Check opening, transitions, pauses, repeated actions and the full ending. Trace objects continuously: glasses or a stylus must not become an empty hand without source evidence. Distinguish camera motion from subject movement, zoom and actual cuts.

Inspect the final prompt produced by the real application compiler, not only prose in a report. A valid timeline can still omit an important visual detail.

### 5. Revise only evidenced gaps

Write a concise opening state, ordered timed actions, camera behavior, ending state and relevant continuity constraints. State concrete movement rather than only an emotion such as "shocked." Preserve the source's pauses and final movement. Keep captions out of generated pixels; exact on-video words belong in a separately editable text layer.

Examples from this audit: Hook 40 needed a pink stylus instead of a bare-finger gesture; Hook 45 needed its small late liquid trickle rather than a contradictory no-spill rule; Hook 78 needed the correct opening gaze; Hook 90 needed lips reopening and the final edge crop.

Do not rewrite materially correct actions merely to make the prompt longer. Mark timing-only refinement separately from a content correction and record uncertainty.

### 6. Map timing deliberately

**Source-speed trim option, 28 October 2026:** when the provider's required duration exceeds the intended source action duration, preserve source event times and append a final hold through the generated end, then initialize a reversible trim to the source endpoint. Do not apply this trim to a prompt that stretched the action over the whole generated duration. Inspect the final action before the cut and the discarded tail; reject an ending that runs late rather than silently cutting it off. Use decoded frame timestamps, preserve the raw output and existing user edits. This is a prepared pilot policy, not a deployed automatic-trim feature.

Timing instructions apply to every new original-opening recreation; historical first/middle-frame routes also required truthful time mapping. They tell the generator when to hold, transition and finish. They belong in the animation prompt, not the still-image prompt.

Example: a 4-second source with actions at 0–1, 1–3 and 3–4 seconds can map proportionally to 0–0.75, 0.75–2.25 and 2.25–3 seconds for an explicitly chosen 3-second candidate. This retains order but speeds the performance; test whether that compression still feels right. Never drop the final action just to fit the duration.

For new short-source candidates in this audit, retain elapsed action timing and extend the final pose to finish 3 seconds. This is the recorded candidate policy, not a universal rule or a live default change. Longer sources need a pacing decision before assignment; Hooks 45, 80 and 86 carry explicit gates. Retain existing gates for other references too.

Require contiguous coverage from zero to the source end, followed by an explicit output-duration mapping. Visually estimated boundaries are estimates, even when timestamp values have many decimal places.

### 7. Save and validate the draft

Maintain one source-hash-bound record per reference, including baseline, candidate, interval evidence, coverage, uncertainty and generation status. Keep private details out of tracked public reports. Verify unique IDs, source hashes, counts, full timeline coverage, no gaps/overlaps and no unresolved phase placeholders. Compile with the real application helper. Run relevant existing compiler tests and negative cases.

Keep these statuses distinct: source reviewed; correction drafted or no new content gap; compilation passed; generated output not tested/partial/pass/fail; runtime assignment; deployment. Never turn compilation into a visual pass.

### 8. Run one controlled generation before wider assignment

This stage needs generation authorization. Approve the caption-free t=0 image first. Keep that image, model, duration, image count/roles and other settings fixed while testing a prompt change. Avoid changing wording and duration together when trying to identify the cause. Preserve the exact submitted and provider-retained inputs, model ID, output and request receipt. Do not run automatic paid retries.

Compare source, previous output and revised output side by side, with source timing mapping disclosed. Review the entire generated sequence on contact sheets and inspect key frames at full resolution. Assess identity, scene, opening pose, actions, hands/props, pacing, camera, ending and caption cleanup separately.

If the instruction was absent or contradicted the source, that is a prompt gap. If it was clearly submitted but the output missed it, record an adherence failure for that sample. One failure does not prove an inherent model limit; one success does not prove reliability. Use a justified controlled follow-up before changing models or defaults.

### 9. Assign and verify only after acceptance

Preserve a rollback copy and bind each accepted prompt to the correct reference ID and source hash. Verify the actual runtime route and private-package handling, preserve user edits and test the complete generation flow. Deployment and production acceptance remain separate from local draft checks. Record exact changes, tests, skipped checks and remaining risks; append incident evidence without erasing history.

## Durable artifacts and restart instructions

- Current counts/status: [completeness register](source-to-prompt-completeness-register-2026-10-26.json).
- Per-ID public candidates and sanitized private pointers: [candidate package](reviewed-prompt-candidates-2026-10-26.json).
- Human-readable findings: [progress index](source-to-prompt-audit-progress-2026-10-26.md).
- Commands, coverage, limitations and changed files: [completion receipt](source-to-prompt-completion-receipt-2026-10-26.md).
- Controlled pilot evidence: [Hook 01 camera-v2 results](hook01-camera-v2-test-results-2026-10-26.md).
- Private coverage: [sanitized private receipt](completeness-private-sanitized-2026-10-26.md). Preserve its referenced ignored files before cleanup; public pointers do not contain recoverable private prompt text.

Disk exhaustion required removal of some task-created frame/sheet copies after inspection. Original sources, manifests, hashes and timing inputs were retained. Recreate missing sheets from those originals; do not claim they still exist or delete source media to free space.

**Restart point:** source comparison is complete for these 116 records. Check that the source hashes and actual runtime baselines still match before reusing drafts. Next is a representative controlled generation and acceptance review, followed by deliberate assignment—not repeating the inventory or claiming a completed live rollout.


## 28 October 2026 implementation policy update (local, not deployed)

The user's latest decision supersedes the historical middle-frame fallback: every NEW image preparation uses the original decoded source frame 0 only. No later clarity image accompanies it. Old receipts and accepted requests keep their exact original inputs and timestamps for recovery. New preparation is draft version 4, image receipt version 5, image prompt version 7.

Image 1 controls source pose, occlusion, lighting, clothing, scene, camera and props. Images 2 onward control influencer identity only. Remove captions AND physical logos/branding/readable text, preserving underlying objects and material. This explicitly supersedes older preserve-physical-text instructions in this guide/history. Review actual generated identity, lighting, outfit, hands and cleanup individually; an accepted provider job is not visual proof.

Use source-specific normalized PHASE directions and compile to numeric generated-time intervals. For a shorter source, map action phases to the original source duration, then append a final hold to the provider duration. Freeze the source timeline and initialize a reversible editor trim only if no saved/local/pending edits take priority; keep the raw clip. If a deliberately shorter output than the source is requested, the existing full-action compression still applies. Verify the final gesture before accepting a trim.

Reuse previously selected owned influencer photos only through Omni's supported appearance inputs, with the approved generated opening as literal first frame. An explicit empty/removal/replacement selection is authoritative. WAN and Seedance starting-frame routes remain single-image. Never describe unsupported extra images as face references in prose and assume that changes the API role.

Local structural audit: 104 public and 12 private draft plans compile timed action directions. This is not a new visual re-review of every source, a claim that each gesture is complete, a provider output pass, or production activation. See docs/opening-policy-implementation-2026-10-28.md for verification limits.
