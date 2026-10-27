---
name: ugc-middle-frame-recreation-prompt
description: Prepare full-video recreation prompts when an unsuitable original opening needs a later clear source frame for identity preparation. Separate the clarity anchor from the reconstructed t=0 animation opening and preserve the complete source action timeline.
---

# Full recreation with a later clarity reference

The later frame solves a visibility problem; it does not move the beginning of
the requested source performance. Keep three distinct roles:

- Original source t=0 controls opening pose, scene, hands and camera.
- Later clarity anchor belongs to the same source at its exact reviewed
  index/time. It supports partly obscured scene/appearance continuity; it is
  neither influencer identity authority nor an automatic motion boundary.
- User's influencer photos control facial identity.

## Prepare the correct animation opening

Read project context/nonnegotiables through `ugc-context-memory`. Use
`ugc-frame-analysis` and `ugc-starting-frame` to inspect the entire source,
original opening, candidate clear frames and meaningful transitions. Choose
clarity by actual visibility/usefulness; there is no fixed 1.5-second rule.

Record source ID/hash, original opening evidence, clarity index/time/hash,
selection reason, ordered identity asset IDs and output duration. Preserve the
roles in preparation, receipts, jobs, recovery and output evidence.

Write a still prompt reconstructing source t=0 with the chosen influencer. Use
the original opening as scene/pose authority, later frame as separately labeled
supporting evidence and user photos as identity authority. Preserve original
hand/prop occlusion; do not replace the opening with the frontal, glasses-off or
uncovered later pose. Identify source captions to remove, using actual text/region
when known; added caption pixels are not physical scene features to preserve.
Do not add another paid preparation stage by default.

Inspect the generated image for identity, original pose, hand/prop continuity,
scene and caption cleanup. Source clarity does not prove generated-image quality.
Only the approved reconstructed opening becomes animation's literal FIRST_FRAME.

## Choose the truthful animation mode

For full recreation, generated t=0 maps to original source t=0. Write motion from
the complete observed source sequence using
[the opening-frame skill](../ugc-opening-frame-prompt/SKILL.md), including duration
remapping and concise performance-writing rules. Clarity-selection time is
provenance, not a cue to accelerate, pause or finish a gesture.

If a later-pose image is literally sent as animation frame zero, the clip starts
in that later pose. Prompting earlier gestures cannot restore original t=0. Use
continuation only when the user accepts omitting the opening, and record the
source range/time mapping. Otherwise reconstruct the opening or evaluate a
supported alternative with continuity review. Do not claim full recreation from
a contradictory middle-pose first image.

## Guard against the observed failures

- Clear frame has glasses off: do not send that pose as literal first frame
  while directing the original removal. Rebuild glasses-on t=0, then remove once.
- Hand covers mouth at t=0: preserve the opening hand/occlusion. Use later clear
  evidence for preparation, and include original uncovering in the motion.
- Three seconds requested from a 3.73-second source: map the entire sequence
  into three seconds when full coverage is intended. Do not retain 3.73-second
  beat timestamps in a three-second request.
- Optional animation identity references: verify provider roles and inspect
  output for scene/wardrobe leakage. Correct labels did not prevent Hook 100's
  ending cut to the portrait setting. Do not silently drop selected photos or
  replace actual model capabilities with claims in a prompt.

## Deliver and qualify

Keep role/hash/timestamp evidence separate from provider prose. Deliver a compact
still prompt when needed, a self-contained timed motion prompt and a brief
role/time mapping. Never promise perfect identity or motion from this technique.
Drafting does not authorize generation. For an authorized real test, approve the
reconstructed image first, then compare all video frames for chronology,
expression, hands, scene and ending. Preserve failed outputs, avoid duplicate
submissions and change no other reference until the pilot passes.
