# Hook 100 three-second motion draft — review only

Status: NOT GENERATED, NOT INSTALLED in the application. Keep the approved clean
opening image; no new starting-image request is needed for this proposal.

The source contains 112 pictures at 30 fps: 3.733333 seconds. To keep its entire
action in a three-second output, use `generated time = source time × 3/3.733333`.
That is about 1.24× faster playback of the original sequence. It is not a trim
to the source's first three seconds. It is a deliberate pacing adaptation.

The intervals below are reviewed event ranges, rounded for readable direction;
they are not hard claims about the exact onset of every muscle movement.

| Source phase | Source time | Proposed generated time |
|---|---|---|
| Opening side gaze, hand already at glasses | 0.00–0.50 s | 0.00–0.40 s |
| Remove glasses and lower them | 0.50–0.90 s | 0.40–0.72 s |
| Continue looking aside, glasses lowered | 0.90–1.60 s | 0.72–1.29 s |
| Brief blink, turn toward lens | 1.60–1.93 s | 1.29–1.55 s |
| Hold frontal questioning surprise | 1.93–2.90 s | 1.55–2.33 s |
| Look back aside and keep the ending | 2.90–3.733333 s | 2.33–3.00 s |

## Proposed complete prompt

Animate the approved opening photograph into one continuous, silent, exactly
3.000-second portrait video. The first picture is the actual opening: round
glasses on the face, the screen-right hand already touching the glasses at the
temple, gaze off screen-right, lips parted. Keep the same recognizable person,
dark ribbed sweater, white earbuds, pale beams/windows, low camera position,
slight camera tilt and close crop for all three seconds.

0.00–0.40 s: Keep looking off screen-right with the hand touching the temple.
Maintain the alert, questioning expression and slightly open mouth. Only small
natural eye and head motion; do not remove the glasses immediately.

0.40–0.72 s: With the same hand, draw the glasses forward off the nose and lower
them below the face. The frames pass naturally in front of the lower face.
Keep finger contact and lens/frame geometry continuous. Keep looking off
screen-right. Remove the glasses exactly once.

0.72–1.29 s: Keep the glasses down and the hand below the face. Maintain the
sideward gaze, lifted upper eyelids, slightly knit questioning brows and parted
lips. Preserve this brief reaction before turning toward the lens.

1.29–1.55 s: Make a short natural blink and turn the head and eyes toward the
lens. Arrive nearly front-facing with widened eyes and an open, questioning
mouth. Keep the glasses below the face.

1.55–2.33 s: Hold eye contact with the lens and the same questioning surprise.
Keep brows slightly knit and lips parted. Do not turn this beat into a smile,
smirk, closed-mouth pout, playful eyebrow raise or pleased expression.

2.33–3.00 s: Shift eyes back off screen-right and follow with a small head turn.
Keep the mouth parted and expression questioning. Settle into that same pose
and maintain it through the final frame at 3.000 seconds.

Use one continuous phone-selfie shot with only subtle handheld movement. Keep
subject scale, room geometry, lighting, clothing, earbuds and facial identity
stable. No edit, transition, camera-angle change, zoom or change to another
location at any time, including the final frames. Keep the glasses lowered
after removal; do not repeat, reverse or loop the gesture. Do not add captions,
logos, music, speech or sound effects.

If a separate portrait is supplied, it guides facial appearance only. Its
background, clothes and camera are not part of this clip. The full video stays
inside the opening photograph's window scene through the very last picture.

## What this draft still cannot establish

This is more specific than the previous broad three-beat summary, but it remains
a hypothesis until a real output is checked. The prior model received the
correct FIRST_FRAME and separate identity-reference labels yet still cut to the
portrait scene. A shorter duration may remove the previous unused tail; it is
not proof of reliable expression, action timing or scene control. A next test
must explicitly request duration 3 in both provider settings and prompt, keep
the approved opening and identity fixed, and inspect every generated frame.
