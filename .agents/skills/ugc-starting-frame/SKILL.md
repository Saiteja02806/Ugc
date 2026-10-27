---
name: ugc-starting-frame
description: UGCPilot influencer starting-frame selection and image prompt skill. Use when the source video's first frame has an occluded, blurred, angled, cropped or otherwise unusable face; when deciding between first/middle frames; or when generating a photorealistic frame from a source scene and influencer identity references. Must preserve original source timestamp and motion continuity.
---

# Starting Frame: First vs Middle Frame, Identity-Safe

## Full-recreation routing

For the user's full source-video recreation goal, apply
[ugc-middle-frame-recreation-prompt](../ugc-middle-frame-recreation-prompt/SKILL.md)
when a later clear frame is needed. It distinguishes clarity evidence from a
separately reconstructed original-t=0 animation opening. The anchor-to-output
timestamp rules and continue-only examples below apply when the selected later
pose is literally supplied as first frame; they must not silently replace the
full-recreation goal. A clear original t=0 opening uses
[ugc-opening-frame-prompt](../ugc-opening-frame-prompt/SKILL.md).

## 0. Two separate reference roles

**Source video frame** governs camera angle, framing, environment, body, clothing, hands, scene objects, perspective, lighting and the chosen motion phase.

**Influencer identity photos** govern facial identity, features, overall natural realism and consistent appearance. Do not accidentally make identity photos override the source environment, nor make source person's face override influencer identity.

## 1. Choose first frame only if suitable

Inspect the opening video frames and score each candidate on 0–5 (not pseudo-scientific model probabilities):
- Face features visible: eyes, nose, mouth/jaw when necessary for identity (critical).
- Face size and clear focus adequate for selected image generator.
- No severe occlusion by hands, phones or props.
- Pose/camera framing matches meaningful source shot.
- Stable source frame (no extreme motion blur or off-screen person).
- Continuation to next source action is plausible from this instant.

If first frame passes, prefer t=0 and avoid unnecessary complexity.

## 2. If inadequate, inspect later frames

Search early and middle sections for the clearest *useful* candidate, not simply the prettiest selfie. A later frame may be face-clear but have a completely different pose, object layout or shot; that might break video continuity. Choose the earliest suitable timestamp that keeps fidelity to the relevant source sequence, or record why a later timestamp is necessary.

Examples:
- Hand covers mouth at t=0.0, hand uncovers at t=1.2 -> candidate t=1.3 if face clear and remaining motion can still be recreated.
- Hand moves toward mouth at t=0.0, t=0.4 clear -> candidate t=0.4 may preserve more of the gesture than choosing t=2.0.
- Subject never has an unobstructed face -> request a suitable identity-led adaptation or compose a minimally changed starting image with an explicit deviation; do not pretend the exact original pose is retained.

## 3. Anchor metadata contract

Every chosen image must have:

```
reference_video_id: <actual id>
source_frame_timestamp_seconds: <exact decimal>
selection_reason: <face visibility / continuity>
source_frame_role: scene_pose_reference
identity_reference_ids: <actual ids>
video_generation_t0_maps_to_source_time: <same selected timestamp>
recreation_mode: continue_from_anchor | full_video_multisegment
```

Keep the same timestamp in database/job state and prompt. Do not substitute a `video.currentTime` from an unrelated clip or depend on stale selected reference state.

## 4. Starting-frame image-generation prompt contract

Use a structured prompt, customized from **observed** source frames:

```
Create one photorealistic, animation-ready 9:16 starting frame.
SOURCE SCENE REFERENCE: [describe actual selected source timestamp, frame geometry,
    camera height/yaw/tilt, subject distance and position, pose, hands,
    wardrobe, visible objects, background and occlusions, lighting/shadows].
INFLUENCER IDENTITY REFERENCES: [same selected influencer across images;
    preserve face structure, eyes, nose, lips, jawline, skin tone family,
    hairline and natural features; no source person's identity leakage].
ANCHOR: this image corresponds to source video at t=[N.NN] seconds,
    NOT necessarily the source video's first frame.
FACE VISIBILITY: [state actual extent needed and smallest permissible
    hand/pose deviation; do not invent an unseen pose as source fact].
FIDELITY: realistic skin, anatomy, contact shadows and occlusions,
    natural camera/phone look; no glossy synthetic skin or extra fingers.
NO: extra subjects, different outfit, altered environment, inconsistent
    reflection, forced eye contact, unnecessary stylization, overbeautification.
OUTPUT: one still image with correct starting pose, no text overlay unless
    specifically required at generation stage.
```

Actual prompt details must come from `ugc-frame-analysis` output, not this template.

## 4B. Inspect the GENERATED influencer image separately

A clear source frame is not proof that the generated influencer starting image is good. After generation, perform a second quality gate:

- Does the selected influencer look recognizable and consistent with identity references? Check face geometry, eyes, nose, lips, skin tone and hairline.
- Does the generated pose still match the chosen source timestamp and camera perspective?
- Are face details sharp and natural, with no extra hands, warped fingers, duplicated facial features or inconsistent shadows?
- Are expressions and occlusions physically compatible with the next planned source action?

If the SOURCE frame is clear but the GENERATED influencer face is poor, first debug the image prompt, identity source selection, generator settings and reference roles. **Do not automatically move to a middle frame just to mask an image-generation failure.** If an angle is fundamentally unsuitable even after controlled retries, compare alternative source timestamps and document that tradeoff. Record both `source_frame_quality` and `generated_influencer_frame_quality` separately. Only pass an approved generated image onward to video generation.

## 5. The crucial temporal truth

A mid-video image supplied as frame 0 to an image-to-video generator normally anchors its output at **source t = selected timestamp**. A text prompt cannot causally cause that initial image to represent an earlier source pose. To recreate SOURCE t=0..end, use one of:

- **Continue-only mode:** generate from selected source time to end and disclose that early content was omitted.
- **Full-video mode:** separately generate source t=0..anchor as a pre-roll using a suitable earlier image or backward extension (only when the model supports it); generate anchor..end from clear influencer anchor, then edit/stitch with continuity checks. Do not guarantee the first segment based on words alone.

Hand off to `ugc-video-prompt` with anchor metadata and explicit mode.

## 6. Acceptance tests

- Clear opening frame -> source t=0 is selected.
- Occluded opening -> candidate timestamps + quality scores documented.
- Source scene unchanged except explicitly allowed visibility adjustment.
- Selected frame truly belongs to selected video and selected influencer.
- Result has identifiable influencer features without distortions; generated-image quality is evaluated independently of source-frame quality.
- Prompt receives correct temporal anchor and action transition.
- When midframe: no false statement that the single generated clip recreated earlier unseen seconds.
