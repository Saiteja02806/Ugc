# Temporal Recreation Modes — First/Middle Frame

## Mode A: First frame suitable

- `source_anchor_sec: 0.0`
- Input image shows selected influencer at exact source shot opening pose.
- Generation prompt covers source t=0 to end, subject to per-generation clip duration.
- Segment timeline: generated t=0 = source t=0. No pre-roll needed.

## Mode B: First frame unsuitable, middle frame chosen; continuation acceptable

- `source_anchor_sec: 1.5`, for example.
- Input image shows source pose at 1.5s with influencer face sufficiently clear.
- Generated t=0 = source 1.5s. Prompt only motions from original 1.5s onward.
- Explicitly disclose absent 0..1.5s content; do not call it the entire source recreation.

## Mode C: Full-video recreation needed with middle-frame anchor

1. Analyze the full source including original t=0, meaningful holds and ending.
2. Retain the later clear frame as preparation evidence with its actual timestamp.
3. Reconstruct a separate influencer opening matching source t=0 scene/pose,
   using original opening, clarity evidence and identity photos in distinct roles.
4. Approve that real image, then send it as literal FIRST_FRAME and write the
   full original action timeline. Map all source event times to requested output
   duration; selection of a clarity frame does not define an action boundary.
5. Review complete video output including final-tail scene/emotion/prop continuity.

Use multisegment or source-motion alternatives only when supported and appropriate
to the user's goal. They are alternatives, not mandatory extra paid stages.
See `../../ugc-middle-frame-recreation-prompt/SKILL.md` for the full procedure.

**Important:** A prompt cannot retroactively inject source t=0..1.5s into a generator that must begin at its provided midframe. The video itself must exist in output from another generation/editing step. A model's advertised 'extend' or 'reference video' mode must be checked in its current documentation/API before using it.

## Example generated timeline (source anchor=1.50)

| Gen time | Source time | Motion instruction |
|---|---|---|
| 0.00s | 1.50s | Start EXACTLY in anchor frame pose, expression, hand position |
| 0.20s | 1.70s | Continue reference action seen in source at 1.7s, preserving orientation |
| 0.60s | 2.10s | Follow source action at 2.1s, don't restart earlier gesture |
| 1.50s | 3.00s | Match source 3.0s end pose/scene |

This example is a methodology. Replace all descriptions/timestamps with actual inspected footage.

## Visual QA rubric (0–5 each; subjective until a calibrated evaluator exists)

- Identity (face geometry/skin/hair)
- Camera/composition (angle/crop/perspective)
- Background/props/wardrobe
- Gesture and head-motion chronology
- Facial expression and emotion dynamics
- Temporal pacing and edit boundaries
- Realistic hand anatomy/occlusion
- Overlay text precision (post-production)

Do not average away critical failures: identity mismatch, wrong chronological source segment or broken scene continuity are blockers even when other categories score well.
