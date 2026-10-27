# Video analysis worksheet (copy once per ACTUAL source video)

**Do not write observations as facts before watching the source frames.** These fields are a guide for Codex and reviewers.

## Provenance

- Video ID / path / account:
- Duration/fps/resolution/rotation:
- Frames reviewed (start–end and sampling, including source PTS confirmation):
- Selected influencer reference IDs:
- Current image/video model capabilities verified from code/docs:
- Goal: continue from anchor OR recreate full source with separate segments:

## Scene lock

- Aspect ratio/camera orientation and distance:
- Framing and subject position on screen:
- Subject: visible clothing/hair/body pose (identity from influencer refs ONLY):
- Background geometry, furniture, foreground props:
- Light: direction, intensity, color, shadows:
- Source onscreen text exact wording, position and appearance:
- Audio: requested? (silent default for avatar clips):

## First 3 seconds: review dense intervals

| Actual source time and frame ID | Face visibility | Head/gaze/expression | Hands/body actions | Camera motion | Scene change / overlay | Confidence |
|---|---|---|---|---|---|---|
| 0.00 | | | | | | |
| 0.25 | | | | | | |
| 0.50 | | | | | | |
| 0.75 | | | | | | |
| 1.00 | | | | | | |
| 1.25 | | | | | | |
| 1.50 | | | | | | |
| 1.75 | | | | | | |
| 2.00 | | | | | | |
| 2.25 | | | | | | |
| 2.50 | | | | | | |
| 2.75 | | | | | | |
| 3.00 | | | | | | |

Further intervals/events: [add additional rows to end; inspect exact source frame PTS for fast movements].

## Face suitability and image quality gates

| Candidate source time | Source face visible? | Sharp? | Pose/scene preserved? | Can continue action? | Decision |
|---|---|---|---|---|---|
| Opening | | | | | |
| Later candidate 1 | | | | | |
| Later candidate 2 | | | | | |

Generated influencer frame QA: identity consistency / face quality / realistic hands / perspective / shadows / expression / correct source timestamp:

## Temporal decision

- Source anchor selected: t = ________ seconds
- Generated first image is source t = ________ seconds
- Source actions that happen BEFORE anchor:
- Source actions that happen AFTER anchor:
- For FULL source reconstruction, method for missing earlier content:
- Input model supports source video/extend-before? Evidence and limits:

## Prompt handoff

- Immutable scene/identity contracts:
- Full motion timeline mapped generated g=0 to source s=anchor:
- Starting-image prompt:
- Video-animation prompt:
- Negative instructions:
- Output video QA scores (0–5) and visible failures:
- Final status VERIFIED / FAILED / NOT TESTED:
