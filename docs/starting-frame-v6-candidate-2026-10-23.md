# Starting-frame v6: concise refinement of current v4

Status: local test candidate only. V4 remains the application default; v5 and
historical test prompts remain reproducible. No paid generation or deployment.

The user wants the same reference shot with their influencer: same position,
clothing, background, emotion and lighting. V4's “as a guide” and “Compose the
scene naturally” wording permits interpretation; this is a plausible contributor
to drift, not a proven sole cause. Stronger preservation in v5 did not consistently
improve the earlier outputs, so this revision keeps v4's person instructions and
output rules and makes a smaller change to the shot direction.

## Changes from v4

Opening:

> Generate a new photograph recreating the shot in Image 1 (VISUAL_REFERENCE), with my influencer from Image 2 (MY_INFLUENCER) as the person in that shot. Keep the same scene and visible moment, with my influencer's own recognizable face and natural appearance.

Visual direction:

> Recreate the same camera angle, framing, subject size and position, body pose, head angle, gaze, emotion and expression shown in Image 1. Keep the same clothing, background layout, lighting direction and color, and the same visible objects and hand gestures. Preserve any parts of the face covered by hands or objects. Use Image 2 and its supporting photos for my influencer's facial features and proportions; use Image 1 for how they are posed, dressed and lit. Recreate this shot without redesigning the scene, changing the crop or importing clothing and backgrounds from the influencer photos.

When a source-matched opening description is included, append:

> The opening description is supplementary: follow Image 1 if its visible scene or pose differs from the description. Continue using the influencer photos for facial features.

Person-photo instructions, optional supporting views, creator-caption removal,
physical object text preservation and explicit user image instructions retain
v4 behavior. The stored glasses description is not silently rewritten. The new
precedence sentence makes that description supplementary to the visible source.

## Acceptance still needed

Local validation checks input order, source matching, version isolation and prompt
budgets; it cannot establish image quality. Next visual test should compare fresh
v4 and v6 outputs using the same Gemini model/settings and identical input bytes,
including the scenes that drifted. Inspect selected-person likeness and scene,
pose, clothing, lighting and caption removal separately. One pleasing image is
not sufficient evidence for promoting the prompt. Sunburst remains a separate
model comparison; do not change model and prompt together and attribute the result
to either alone.
