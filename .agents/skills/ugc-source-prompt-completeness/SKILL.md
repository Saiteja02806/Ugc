---
name: ugc-source-prompt-completeness
description: Full-video source-to-prompt completeness audit for UGCPilot recreation prompts. Use when asked whether a prompt explains the entire source video end to end, frame by frame, including camera movement, cuts, holds, hands/props and the final frame. Produces a timestamped gap table and a COMPLETE/PARTIAL/INCOMPLETE verdict; never claims generated-video acceptance from prompt text.
---

# Source-to-prompt completeness audit

Use this skill to answer one question: **does the assembled prompt explain the
whole source video as it actually is, with no unexplained interval, no invented
motion and no missing camera movement?**

This is an audit skill. It does not replace `ugc-frame-analysis` (source
evidence), `ugc-video-prompt` (prompt architecture), `ugc-starting-frame`
(anchor choice) or `ugc-opening-frame-prompt` / `ugc-middle-frame-recreation-prompt`
(prompt rewriting). It wraps them into a repeatable completeness gate. The
long-form process it operationalizes is
`docs/prompt-reviews/REPEATABLE_SOURCE_PROMPT_REVIEW.md`.

## Non-negotiables

1. **Inspect the actual video.** No confident completeness verdict from stills,
   a thumbnail, a poster or memory. If the media cannot be opened, label the
   result `single-frame only` and stop.
2. **Audit the final assembled provider prompt**, not the author's draft prose.
   For Hook that means the compiled `OPENING STATE` / `PHASE` / `CAMERA` /
   `ENDING STATE` / `CONSTRAINT` text after retiming and constraints; for other
   workflows it means the exact text the provider receives.
3. **Contiguous coverage from source t=0 through the final decoded frame.** Every
   interval must be explained once. No gaps, no overlaps, no silently dropped
   ending.
4. **Separate camera from subject.** Camera push/pull, pan, tilt, roll, crop,
   handheld shake, focus change, digital zoom and real cuts are different
   observations. Never describe one as another.
5. **Evidence is not inference.** Record what is visible separately from a
   physical explanation inferred from it. Unknown stays unknown.
6. **A prompt audit is not a generation pass.** Source coverage, compiled-prompt
   coverage, generated-image/video adherence and runtime activation are four
   separate statuses.

## Procedure

### 1. Freeze the baseline

Record: reference ID, source file and SHA-256, duration, fps, decoded frame
count, aspect ratio, assigned prompt, prompt/version ID, selected duration and
any duration retiming, previous outputs/receipts, and the model actually used.
Titles alone are not identity.

### 2. Inspect the complete source

Follow `ugc-frame-analysis`:

- 0.25 s overview by default; ~0.1 s or every source frame around fast events.
- Extra care for 0–3 s, every transition, pause, repeat, occlusion, prop
  handoff, gaze change, camera change and real cut.
- Inspect through the final decoded frame, not an early contact sheet.
- Open full-resolution frames for ambiguous hands, props, text, crops and
  endings.
- Retain source PTS; nominal index/fps is not container time.

### 3. Build the required evidence table

One row per meaningful interval. No merged "and then the rest" row.

| Source interval / frame indices | Camera / framing / focus | Subject pose, head, gaze | Hands / props / contact | Expression / mouth / blink | Scene, light, text, occlusion | Prompt clause (quoted) | Gap, contradiction or none | Confidence |
|---|---|---|---|---|---|---|---|---|
| t=0 → first transition | | | | | | | | |
| every transition / pause / repeat | | | | | | | | |
| final transition → last frame | | | | | | | | |

Rules:

- A hold is an interval; describe what stays still and what may drift.
- A cut is an interval boundary with a new shot description, not a continuous
  camera move.
- A repeated gesture needs each repetition and its end condition.
- If the source is a stable camera, the prompt must preserve that stability;
  do not copy another reference's handheld shake into it.

### 4. Compare the assembled prompt clause by clause

For every row, quote the actual clause (or state `missing`). Then check:

- `OPENING STATE` matches source t=0, including hands, props, gaze and crop.
- Timed phases cover the whole action in order, with contiguous intervals.
- `CAMERA` states the real camera path and timing, or that the camera is fixed.
- `ENDING STATE` matches the final frame, including gaze, mouth, hands and crop.
- Constraints do not contradict an observed action.
- Duration mapping is explicit when output length differs from the source; the
  full action is remapped, not truncated.

Runtime structural checks:

- Hook reviewed route: `hookMotionPlanDirections` must emit non-empty
  `OPENING STATE`, ordered `PHASE`, `CAMERA`, `ENDING STATE` and `CONSTRAINT`;
  `retimeSourceMotionDirections` must accept a contiguous `0 → 1` timeline with
  a complete ending.
- Hook manual/free-prose directions and Text on screen / Talking Head directions
  are not required by code to contain a `CAMERA` clause. Treat a missing camera
  description there as a real audit gap, not as "assumed stable".

### 5. Assign the verdict

- **COMPLETE** — every interval covered, camera truthful, ending covered, no
  contradiction. Still say generated adherence is untested.
- **PARTIAL** — chronology covered but a material detail is missing or timing is
  approximated; name each gap and the evidence.
- **INCOMPLETE** — a transition, camera path, hold, cut or ending is missing, or
  the prompt contradicts the source.

Separate content gaps from timing-only refinements. Do not lengthen a materially
correct prompt just to make it look thorough.

### 6. Hand off

Use `ugc-video-prompt` for rewrites, `ugc-opening-frame-prompt` for an original
t=0 animation, or `ugc-middle-frame-recreation-prompt` when later clarity
evidence assists the opening. Keep the source hash, frame indices, role
separation and duration mapping in the record. Code changes still require
`ugc-immutable-contracts` and `ugc-regression-gate`.

## Required output

1. Baseline and what media was actually inspected (timestamps/frame coverage).
2. The evidence table and the clause comparison.
3. Verdict (COMPLETE / PARTIAL / INCOMPLETE) with named gaps.
4. Camera verdict separately: truthful / incomplete / contradicted.
5. What remains unknown or inferred.
6. Status split: source reviewed · prompt compiled · generated image tested ·
   generated video tested · runtime assigned · deployed.
7. If a rewrite was produced: the exact replacement clauses and the evidence
   each one restores.

## Stop conditions

- No accessible source video.
- Only a draft or template was supplied instead of the assembled prompt.
- The source identity/hash or selected duration cannot be established.
- The request asks for a "perfect recreation" guarantee from wording alone.
- Source review would require rewriting unrelated prompts or changing runtime
  defaults without explicit approval.
