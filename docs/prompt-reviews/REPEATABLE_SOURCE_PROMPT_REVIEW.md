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

**Middle-frame case:** the later clear frame is evidence for identity preparation, not permission to skip the opening actions. Reconstruct the influencer at the ORIGINAL t=0 pose using the original opening and later clarity evidence. Approve that reconstructed opening, then animate the complete original t=0-to-end sequence. Store the clarity timestamp separately from animationOpeningSourceTime=0.

For example, if the source begins with a hand over the mouth but a later frame shows the face clearly, use the later frame to help prepare identity. The approved animation opening still needs the original hand-over-mouth pose, followed by the source's subsequent actions. Do not start the performance from the later uncovered pose.

The video stage normally receives one approved starting image. Additional user-selected images are a separate explicit case; do not silently add a portrait, end frame or source video to a controlled test.

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

Timing instructions apply to BOTH normal and middle-frame routes. They tell the generator when to hold, transition and finish. They belong in the animation prompt, not the still-image prompt.

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
