---
name: ugc-frame-analysis
description: Detailed source-video frame-by-frame analysis skill for UGCPilot hook/video recreation. Use when user supplies a reference video or asks to replicate precise camera, action, face, hands, timestamps, edits, overlays or pacing. Extract timestamped frames and describe every meaningful motion/shot before any starting-frame or video prompt work.
---

# Source Video Forensics — Frame-by-Frame

## Fundamental rule

A screenshot is a single visual moment, **not proof of the video's entire motion**. Never claim a frame-by-frame analysis if you only received screenshots, a thumbnail or a URL you could not access. Request/provide the video source when needed; until then label observations `single-frame only`.

## Scope and tools

Read `ugc-context-memory`, `ugc-immutable-contracts`, and `nonnegotiables.md`. Inspect actual media, not just title/caption. If video is accessible locally, use `ffprobe` or equivalent for duration/fps/resolution/audio and `python tools/video_frames.py <file> --out ... --every 0.25` for overview extraction. If frame-critical, use native frames or finer intervals near events. Inspect sheets and targeted original frames, not only compressed thumbnails.

If no media-tools access exists, describe limitation and do not hallucinate actions.

## Procedure

### 1. Establish source facts
- File/URL and access status; duration, fps, resolution, aspect, rotation, audio tracks (if any), whether cuts/edits exist.
- Scene boundaries, lighting, foreground, background, color cast, composition, camera/subject movement.
- Number of subjects and occlusions; text overlay positions and exact text where readable.

### 2. Temporal sampling protocol
- Sample scene overview at 0.25-second steps by default; faster or complex motion requires ~0.1s or EVERY source frame near the event.
- Inspect first 0–3 seconds with special care because the hook happens here; continue through full video for action continuity and endings.
- Event transitions (hand rising, mouth covering, camera tilt, object entering frame) require before/during/after frames and precise onset/offset timestamps to source-frame precision when supported.
- For scene cuts, independently analyze each shot.
- Do not infer impossible missing frames; mark unknowns.

### 3. Observation matrix — every meaningful interval

| source timestamp | camera/framing | face/head/gaze | body/hand/object action | expression | scene changes | text overlay | occlusion/blur | confidence |
|---|---|---|---|---|---|---|---|---|

Add explicit start/peak/end for gestures. Capture left vs right hand, occlusion onset, head turn direction, and camera relative movement. Distinguish optical camera movement from subject movement. Avoid broad adjectives when measurable descriptions are possible.

### 4. Action continuity
Write a storyboard in **source time** with exact ordering: starting pose -> motion -> held pose -> follow-through -> ending. Describe what MUST remain unchanged during movement, including lighting, background geometry, influencer identity and hand anatomy.

### 5. Frame candidates
For each proposed source anchor (first and alternatives), score face visibility, sharpness, identity suitability, scene/pose fidelity, ability to continue into subsequent motion. Document original source timestamp and trade-offs. Hand off to `ugc-starting-frame`.

### 6. Deliverables
- Source metadata and actual inspected frame/time coverage.
- Contact sheet + numbered frame manifest as evidence (if tools available).
- Shot list and event timeline, including first 3 seconds.
- Source scene/identity separation, major occlusion warnings.
- Candidate frame timestamps and rationale, not just a thumbnail.
- Missing evidence and confidence for any uncertain details.

## Video precision limitations

Exact 1:1 recreation by stochastic generative video cannot be guaranteed. Target behavioral similarity: camera, action chronology, emotion, lighting, pose, duration and editing style. Quantify deviations when possible, review frame-aligned outputs, and revise specific failed segments rather than making generic prompt changes.
