---
name: ugc-opening-frame-prompt
description: Write and verify a concise source-faithful video animation prompt when the approved influencer image recreates the original source opening at t=0. Use for ordinary first-frame recreation; route later clarity-frame preparation to ugc-middle-frame-recreation-prompt.
---

# Animate the original opening

Produce clear performance direction grounded in the observed video. Optimize for
faithful action and expression, not maximum prompt length. Do not promise perfect
generation from prompt wording alone.

## Establish the visible sequence

Use `ugc-frame-analysis` to inspect the complete source and gesture boundaries.
Read project context/nonnegotiables through `ugc-context-memory`. Confirm the
approved influencer image actually matches source t=0: head/gaze, hands, props,
occlusion, camera and scene. A poster or later clear face is not opening evidence.
For later clarity preparation, use the sibling
[middle-frame skill](../ugc-middle-frame-recreation-prompt/SKILL.md).

Keep an internal evidence table: source ID/hash, source frame index/time,
observed action intervals, selected identity asset IDs, approved opening asset
and hash, output duration, sound choice and actual provider input capability.
Missing evidence stays unknown; do not invent motion from a still.

## Resolve duration before writing

Preserve the requested duration in both prompt and provider settings. If the
full source action must fit a shorter output, explicitly remap event boundaries:
`generated_time = source_time × output_duration / source_duration`.
For a requested segment, record its source range instead. Do not silently trim
the ending, inherit source seconds unchanged, or substitute four seconds for
three. If the route cannot support the requested duration, explain it before
submission. Use a continuous final hold when output exceeds action duration.

## Write at the useful level of detail

- State output duration, approved opening, scene and camera once.
- Describe meaningful actions and holds in order, with contiguous generated-time
  intervals covering the whole output. Group phases only when gaze, gesture and
  expression stay the same; do not impose an arbitrary beat count.
- Use observable cues: gaze direction, brow position, eyelid opening, lip shape,
  hand contact and object movement. An emotion label alone is insufficient.
- Preserve pauses that define the reaction. Do not turn a sideward hold into a
  continuous turn, a surprised parted mouth into a smile, or a blink into a cut.
- Describe the ending through the final frame. Add one concise continuity line
  for actual risks: identity, outfit, scene, hands/props, camera and unrequested
  text/audio. Avoid a catalogue of unrelated negatives.

Keep frame numbers, hashes, workflow history, clarity-selection reasoning and
the full evidence table outside provider prose. Refer only to inputs actually
delivered. Exact overlay copy belongs in the editor. Remove repeated instructions
and contradictions; never shorten by losing an observed action.

## Review and acceptance

Check against the evidence table and actual delivered opening. Inspect the final
assembled provider prompt, reference roles, duration and truncation, not only the
template. Respect existing user edits and frozen requests.

Return the prompt plus a short timing/evidence note when useful; for a prompt-only
request return only the prompt. Drafting does not authorize paid generation.
For an authorized trial, review the real still first, then the complete clip
against source frames on the same clock or declared retiming. Inspect transition
boundaries and every final-tail frame. Grade action order, timing, emotion,
identity, scene and anatomy separately. Job completion and correct request roles
do not prove visual acceptance. Keep rollout narrow until the trial passes.
