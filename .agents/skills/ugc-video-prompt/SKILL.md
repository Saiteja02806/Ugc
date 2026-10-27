---
name: ugc-video-prompt
description: Precise UGCPilot video recreation prompt engineer and audit. Use for writing, revising, debugging, or validating source-video analysis, influencer starting-frame image prompts, and image-to-video animation prompts, especially when the source first frame is unsuitable and a middle frame anchors the generated clip. Requires timestamped frame evidence and temporal consistency checks.
---

# Recreate Video Prompt Composer — Temporally Anchored

## Select the prompt-writing skill

Use [ugc-opening-frame-prompt](../ugc-opening-frame-prompt/SKILL.md) when the
approved animation image matches original source t=0. Use
[ugc-middle-frame-recreation-prompt](../ugc-middle-frame-recreation-prompt/SKILL.md)
when a later source frame assists identity preparation for full recreation.
That route reconstructs and approves source t=0 before first-frame animation.
A later literal first-frame image remains continuation unless the user selects
another supported reconstruction route. The audit procedures below support the
evidence; keep the final provider prompt concise.

## Why this skill exists

A wrong prompt can ruin the entire Recreate flow even when the generated starting image looks correct. The image prompt and motion prompt are coupled. Do not improve facial visibility by silently discarding chronology, hand gestures, camera motion or the real source reference timeline.

## Required inputs

1. Actual source video and analysis from `ugc-frame-analysis`: duration/fps, shot cuts, scene details, complete action sequence, fine-grained first 3-second timeline, overlay text, camera changes and uncertainty labels.
2. Actual selected source anchor timestamp and generated image from `ugc-starting-frame`.
3. Chosen influencer identity reference set; documented priority of each image.
4. Generation model's *actual* capabilities: image-to-video start-frame support, duration limits, seed, reference video, end frame, extension/backwards extension, input sizes, text and audio handling.
5. Output use: source-action faithful silent clip, hook-and-demo, or another explicitly requested form; aspect ratio and duration.

If source video cannot be viewed, do NOT produce a confident frame-by-frame replication prompt. You may create a provisional prompt labeled as based only on supplied still(s).

## Three-stage prompt architecture

### Stage A — Source analysis (facts, not creative writing)

Produce `SourceVideoSpec` with factual camera/scene/subject/gestures/action chronology. In the first 3 seconds, document all material motion transitions; for fast events use source-frame timestamps. Do not assume exact dialogue or sound based on lip shapes. Preserve the true subject's actions without copying their identity into the influencer.

Required fields:
```
source_video_id, source_duration_sec, source_fps, aspect_ratio,
shot_segments: [{source_start,source_end,framing,camera_motion,lighting,background}],
subject: {screen_position,scale,orientation,head_pose,gaze,expression,wardrobe},
actions: [{start_sec,peak_sec,end_sec,subject_part,direction,speed,intent,occlusion}],
on_screen_text: [{start_sec,end_sec,exact_text,position,style,certainty}],
reference_frame_candidates: [{timestamp,face_visibility,continuity_risks}],
unknowns: []
```

If output is structured data, validate presence and types before downstream use. No prompt field should silently disappear due to model-token truncation or parser fallback.

### Stage B — Starting frame prompt

Use the exact selected scene timestamp, source-scene geometry and influencer identity role. Refer to `ugc-starting-frame`; it owns face visibility, frame-choice and image prompt requirements. Record whether the frame deliberately differs from original in a small occlusion adjustment and why.

### Stage C — Video animation prompt

Write a complete prompt for **movement starting from the delivered image**, not a generic text summary of the source clip. Include:

- `ANCHOR`: generated input image = source at t=[exact].
- `MODE`: original-opening animation (including a reconstructed opening), continuation, or supported multisegment reconstruction.
- `DURATION`: generated segment duration and source timeline range.
- `LOCKED`: influencer facial identity, skin/hair, subject geometry, background, clothing, props, phone camera optics, light direction and scene continuity.
- `FIRST-FRAME STATE`: precise body pose, head angle, gaze, hands and objects at t=0 of generated segment.
- `TIMELINE`: each motion described in **generated time AND mapped source time**, with onset and completion, transition speed, pauses, and emotion.
- `CAMERA`: handheld vs static movement, angle, distance, focus and crop changes tied to moments.
- `PHYSICS`: hand/finger continuity, realistic overlap, movement direction and gravity.
- `TEXT`: captions/overlays to be applied in an editor for exact spelling/layout unless user explicitly requests model-generated text.
- `AUDIO`: default no generated audio for the project's silent-avatar clip workflow unless the task explicitly changes it.
- `NEGATIVES`: no identity drift, morphing face, sudden wardrobe/background swap, extra hand/fingers, unrelated props, changed camera orientation or action timing.

## Temporal alignment rule (NON-NEGOTIABLE)

Let `s` = source timestamp used as input image; `g` = generated time from first frame. For continue-from-anchor mode, map `source_time = s + g`, not `source_time = g`.

Example source (illustrative, not observed fact):
- t=0.0 woman looks at camera; right hand at chest.
- t=0.7 hand rises to mouth.
- t=1.1 hand covers mouth.
- t=1.8 hand drops; face clear.
- t=2.6 eyebrows lift and subject turns left.

If input image is at source t=1.8, generated t=0 starts with hand lowered. Video prompt must NOT instruct 'hand rises and covers mouth' as if replaying source t=0.7..1.1 unless explicitly making a non-original looping/re-enactment. For full recreation, reconstruct and approve a true source-t=0 opening or use a supported alternative with continuity review. See `references/temporal-recreation-modes.md`.

## Required output format

A. **Evidence summary:** video actually viewed? frame coverage and unknowns.
B. **Source specification:** environment, lens/framing, camera, subject/wardrobe, light, actions, text, timecoded gestures.
C. **Frame decision:** first/mid anchor, exact timestamp, why face-clear and what temporal content is skipped/reconstructed.
D. **Starting-image prompt:** text ready to pass to image model, using correct identity and scene roles.
E. **Animation prompt:** motion beginning precisely from the delivered image, timeline mapped to source, silent by default.
F. **Quality-control rubric:** similarity in face identity, background, camera, hand gesture, chronology, duration, realism; describe objective misses and iteration changes.
G. **Caveats:** unsupported full-video reproduction and actual model limitations (not hidden).

## Prompt audit procedure (when user says prompt is wrong)

Trace **raw selected source video → frame extraction → video-analysis model input/output → prompt template → prompt assembly → token truncation → image model → image metadata → video-model input → output clip**. Compare IDs, timestamp, prompt versions and rendered generations at each step. Find whether wrong source, stale state, merged identity/scene instructions, dropped timecodes or model limitation caused drift. Build a regression corpus with first-frame and midframe cases; store sanitized prompt fixtures and golden observable properties (not a single fragile exact generated text match).

NEVER claim 'perfect' original recreation solely from prompt text. The goal is verifiable high-fidelity reconstruction; use visual QA and iterate on failed subsegments.
