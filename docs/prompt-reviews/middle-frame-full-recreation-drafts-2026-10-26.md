# Middle-frame recreation prompt drafts — 26 October 2026

**DRAFTS ONLY — NOT ACTIVATED.** The user chose to finish drafts without paid generation. All 31 generated-output qualifications remain NOT TESTED. No image/video create request was submitted.

Each case has a reconstructed original-t=0 image prompt followed by a concise timed motion prompt. The later clear frame assists preparation; it is not animation frame zero. Original scene/pose and selected influencer identity have separate input roles.

The displayed durations are illustrative whole-second durations close to the source length, not changes to application defaults. Full source actions are explicitly retimed. The separate Hook 12 pilot below uses exactly three seconds. Beat boundaries are source-reviewed approximations; Hook 71 has a documented nominal-clock/PTS discrepancy. Detailed provenance and exact timing mapping are in the companion JSON.

## Prepared three-second pilot: Hook 12

Source duration: 2.433333 seconds. Clarity anchor: frame 36 / 1.200 seconds. Original opening: frame 0 / 0.000 seconds. The source was inspected across all 73 native frames at contact-sheet resolution plus full-resolution opening and critical frames.

```text
Animate the approved opening image into one continuous 3-second portrait video. Keep the same person, low fixed tabletop camera, bright kitchen windows, hanging lights, silver laptop and white mug throughout.

0.00-0.74s: Hold the mug tilted at the lips for a sip, head angled slightly screen-left. The free fingers stay hooked over the laptop edge.
0.74-1.36s: Lower the mug below the chin with the same hand while the eyes lift sharply upward. Keep holding the handle; do not set the mug down.
1.36-1.91s: Bring the gaze toward the mug and camera, widen the eyes and part the lips. A thin trickle of drink falls from the lower lip back toward the mug.
1.91-3.00s: Lean slightly closer with very wide eyes looking down toward the cup and a rounded open mouth. Keep the mug beneath the chin as the thin trickle continues. Hold this surprised reaction through the final frame; do not smile.

Preserve natural fingers, mug contact and the laptop geometry. One uninterrupted kitchen shot, no cut to the portrait's room or clothes. The extra portrait guides facial appearance only. No captions, music, speech or sound effects.
```

The image prompt is in `../hook12-opening-image-test-prompt-2026-10-26.txt`. Offline input/hash checks passed. No generated starting image exists for this trial, so its video gate has not passed.

## All 31 source-specific draft pairs

### Hook 12

Stable ID: `explore-paired-hook-03d314d5268b8c31ec390bf1`. Source: 2.433 s. Draft output: 3 s. Clarity: frame 36 / 1.200 s.

**Opening-image prompt**

```text
Create one photorealistic portrait opening image, reconstructing the original video at t=0.
Image 1 is the original source t=0 image: it controls opening pose, hands/props, composition and scene. Image 2 is a later clear frame from the same source, used only as supporting visibility/continuity evidence, not the opening pose or identity authority. Image 3 and every subsequent image are the selected influencer identity references; use their identity without their background or clothing.
Opening: Seated behind a silver laptop, the person holds a large white mug to the mouth with the screen-left hand; free fingers rest on the laptop top at screen-right. Head angled slightly screen-left.
Scene and camera: Fixed low tabletop portrait view, laptop filling lower half; bright kitchen windows, greenery and hanging lights behind.
Reconstruct original t=0 mug-at-mouth posture and laptop geometry with requested influencer identity; later clear face is identity preparation evidence, not the opening pose.
Remove the source caption/graphic overlay: Gaming website that makes you money while you sleep 😴💸 Region: Centered on laptop lid, approximately middle-to-lower image. Restore the underlying scene naturally without erasing physical props or real scene signage.
Preserve the original opening hand/prop occlusion while transferring the selected influencer identity. No added text. This still must be visually approved against the original opening before animation.
```

**Video prompt**

```text
Create a 3-second continuous portrait video from the approved reconstructed opening image, matching the original opening pose: Seated behind a silver laptop, the person holds a large white mug to the mouth with the screen-left hand; free fingers rest on the laptop top at screen-right. Head angled slightly screen-left.
Scene and camera: Fixed low tabletop portrait view, laptop filling lower half; bright kitchen windows, greenery and hanging lights behind.
0–0.74s: Keep the white mug tilted at the lips for a sip; free fingers stay hooked over the laptop edge.
0.74–1.36s: Lower the mug beneath the chin while lifting the eyes sharply upward; keep holding the handle.
1.36–1.91s: Bring the gaze toward the mug and camera; eyes widen and lips part. A thin trickle of drink falls from the lower lip back toward the mug.
1.91–3s: Lean slightly closer with very wide eyes angled down toward the cup and a rounded open mouth. Keep the mug under the chin as the thin trickle continues; free fingers remain on the laptop.
Final state: Closer wide-eyed reaction with rounded open mouth, mug still held under chin, thin drink trickle toward mug and free fingers on laptop.
Keep the approved influencer identity, source clothing, scene and hand/prop continuity through the final frame; any appearance reference affects identity only, never its portrait background. No added captions, text or generated audio.
```

**Review risks**

- Mug occludes lower face at t=0; preserve mug/hand contact without copying source identity.
- Do not invent a cup placement or extra action.

Generated image/video: **NOT TESTED**.

### Hook 15

Stable ID: `explore-paired-hook-43cc1dae0a6cfcb03e0a9333`. Source: 8.600 s. Draft output: 9 s. Clarity: frame 32 / 1.067 s.

**Opening-image prompt**

```text
Create one photorealistic portrait opening image, reconstructing the original video at t=0.
Image 1 is the original source t=0 image: it controls opening pose, hands/props, composition and scene. Image 2 is a later clear frame from the same source, used only as supporting visibility/continuity evidence, not the opening pose or identity authority. Image 3 and every subsequent image are the selected influencer identity references; use their identity without their background or clothing.
Opening: Seated person in a light striped shirt, eyes closed, both hands raised in front of the chest, palms/fingers facing outward in a dismissive gesture.
Scene and camera: Stationary vertical phone view, medium upper-body framing; pale wall, wooden door at screen-left and wall switches at screen-right.
Reconstruct t=0 eyes-closed, hands-forward gesture using original source composition; selected1.066667s palms-up pose is only clarity evidence.
Remove the source caption/graphic overlay: Normal people: “I don’t have experience/I can’t do game dev” Region: Centered over chest during first approximately5.67s; absent in final held phase. Restore the underlying scene naturally without erasing physical props or real scene signage.
Preserve the original opening hand/prop occlusion while transferring the selected influencer identity. No added text. This still must be visually approved against the original opening before animation.
```

**Video prompt**

```text
Create a 9-second continuous portrait video from the approved reconstructed opening image, matching the original opening pose: Seated person in a light striped shirt, eyes closed, both hands raised in front of the chest, palms/fingers facing outward in a dismissive gesture.
Scene and camera: Stationary vertical phone view, medium upper-body framing; pale wall, wooden door at screen-left and wall switches at screen-right.
0–1.05s: Open eyes, glance upward and screen-right, draw hands toward upper chest with a skeptical expression.
1.05–2.44s: Raise open palms beside the shoulders, lightly move hands and turn the head between camera and screen-right; faint disbelieving smile.
2.44–3.38s: Mouth opens and changes shape while palms remain lifted; expression becomes emphatic.
3.38–4.5s: Bring both hands back onto upper chest and continue small head turns with expressive mouth movement.
4.5–5.93s: Open palms beside shoulders again with a restrained smile and sideways glances.
5.93–9s: Hands drop out of frame and expression settles; hold a largely still direct-to-camera look, ending with a small closed-mouth smile.
Final state: Hands down, mostly still, looking toward camera with a restrained closed-mouth smile.
Keep the approved influencer identity, source clothing, scene and hand/prop continuity through the final frame; any appearance reference affects identity only, never its portrait background. No added captions, text or generated audio.
```

**Review risks**

- This8.6s source has several gesture phases and a final2.93s still phase; compressing to3s changes observed pacing.
- Visible mouth movement is observed; no speech transcription or phoneme accuracy verified.
- Manifest final PTS8.6 differs from index257/30=8.566667; beat clock uses elapsed index/30, not packet-precise timing.

Generated image/video: **NOT TESTED**.

### Hook 19

Stable ID: `explore-paired-hook-e683292d4cd22b2a8b5a9cd8`. Source: 2.933 s. Draft output: 3 s. Clarity: frame 44 / 1.467 s.

**Opening-image prompt**

```text
Create one photorealistic portrait opening image, reconstructing the original video at t=0.
Image 1 is the original source t=0 image: it controls opening pose, hands/props, composition and scene. Image 2 is a later clear frame from the same source, used only as supporting visibility/continuity evidence, not the opening pose or identity authority. Image 3 and every subsequent image are the selected influencer identity references; use their identity without their background or clothing.
Opening: Airplane cabin window and seat-back edge fill frame; no face is visible at t=0.
Scene and camera: Handheld portrait phone shot pans/rotates away from bright airplane window into cabin, revealing seated person; slight tilted view and arm extending toward camera.
Preserve actual window-only t=0 opening. Later clear face plus influencer portraits must condition identity revealed after pan; a face close-up is not an acceptable substituted opening image.
Remove the source caption/graphic overlay: I could LITERALLY KISS the flight attendant that showed me this 🤭🤭😩 Region: Upper center over window/cabin, later above person's head. Restore the underlying scene naturally without erasing physical props or real scene signage.
Preserve the original opening hand/prop occlusion while transferring the selected influencer identity. No added text. This still must be visually approved against the original opening before animation.
```

**Video prompt**

```text
Create a 3-second continuous portrait video from the approved reconstructed opening image, matching the original opening pose: Airplane cabin window and seat-back edge fill frame; no face is visible at t=0.
Scene and camera: Handheld portrait phone shot pans/rotates away from bright airplane window into cabin, revealing seated person; slight tilted view and arm extending toward camera.
0–0.41s: Move across bright airplane window, keeping cabin wall and seat-back edges visible.
0.41–0.92s: Continue rotating/panning inward away from window; seated person enters at screen-right.
0.92–1.84s: Settle on seated smiling person in dark top with headphones around neck; arm extends toward camera.
1.84–3s: Hold cabin selfie framing with slight natural wobble; person smiles, subtly tilts head and changes mouth expression.
Final state: Seated smiling person faces phone in tilted cabin selfie framing.
Keep the approved influencer identity, source clothing, scene and hand/prop continuity through the final frame; any appearance reference affects identity only, never its portrait background. No added captions, text or generated audio.
```

**Review risks**

- A literal window-only first image carries no influencer facial evidence; single-image FIRST_FRAME alone cannot guarantee identity after reveal.
- May require identity-conditioned reference support or a controlled multi-stage reveal; visual qualification required before activation.
- Do not invent an influencer face in original t=0 window opening.
- Small manifest PTS/index discrepancies exist toward end; timing is nominal index/30.

Generated image/video: **NOT TESTED**.

### Hook 20

Stable ID: `explore-paired-hook-f1afdb3229e127c8b6563087`. Source: 3.233 s. Draft output: 4 s. Clarity: frame 60 / 2.000 s.

**Opening-image prompt**

```text
Create one photorealistic portrait opening image, reconstructing the original video at t=0.
Image 1 is the original source t=0 image: it controls opening pose, hands/props, composition and scene. Image 2 is a later clear frame from the same source, used only as supporting visibility/continuity evidence, not the opening pose or identity authority. Image 3 and every subsequent image are the selected influencer identity references; use their identity without their background or clothing.
Opening: Person in gray sweatshirt with both hands raised close to face, one directly crossing mouth/nose and the other beside face; eyes briefly closed.
Scene and camera: Fixed upper-body portrait phone shot, pale room and doorway behind; camera slightly below eye level.
Reconstruct original near-face hand positions and eyes-closed opening before mouth-cover hold; selected2s hands-behind-head image cannot serve as literal opening.
Remove the source caption/graphic overlay: I found the best AI Video Generator and it’s FREE! 🤯 Region: Centered across lower chest. Restore the underlying scene naturally without erasing physical props or real scene signage.
Preserve the original opening hand/prop occlusion while transferring the selected influencer identity. No added text. This still must be visually approved against the original opening before animation.
```

**Video prompt**

```text
Create a 4-second continuous portrait video from the approved reconstructed opening image, matching the original opening pose: Person in gray sweatshirt with both hands raised close to face, one directly crossing mouth/nose and the other beside face; eyes briefly closed.
Scene and camera: Fixed upper-body portrait phone shot, pale room and doorway behind; camera slightly below eye level.
0–0.21s: Complete bringing hand over mouth; other hand lowers out of the main face area.
0.21–1.65s: Hold hand over mouth with wide eyes looking slightly screen-left; startled stillness.
1.65–2.47s: Raise both hands along cheeks to sides/back of head as mouth opens widely.
2.47–4s: Hold both hands behind head with elbows out, wide eyes and open mouth in strong disbelief.
Final state: Both hands behind head, elbows spread, eyes wide and mouth open.
Keep the approved influencer identity, source clothing, scene and hand/prop continuity through the final frame; any appearance reference affects identity only, never its portrait background. No added captions, text or generated audio.
```

**Review risks**

- First frames contain motion blur and hand overlap; preserve opening gesture instead of forcing the clear2s pose at t=0.
- Keep held surprise phase rather than adding a new reaction cycle.

Generated image/video: **NOT TESTED**.

### Hook 26

Stable ID: `explore-paired-hook-09c4e9b5de6a85f0f4c371da`. Source: 3.267 s. Draft output: 4 s. Clarity: frame 73 / 2.433 s.

**Opening-image prompt**

```text
Create one photorealistic portrait opening image, reconstructing the original video at t=0.
Image 1 is the original source t=0 image: it controls opening pose, hands/props, composition and scene. Image 2 is a later clear frame from the same source, used only as supporting visibility/continuity evidence, not the opening pose or identity authority. Image 3 and every subsequent image are the selected influencer identity references; use their identity without their background or clothing.
Opening: Close-up, sunglasses fully over eyes, screen-left hand pinching glasses temple, mouth partly open; striped dark/light shirt.
Scene and camera: Fixed close portrait phone framing against plain beige wall; only small head/phone movement.
Rebuild sunglasses-on t=0 image with influencer identity;2.433333s clear face assists identity only. Motion must include the earlier glasses-on hold then removal.
Remove the source caption/graphic overlay: Broke people are gonna KISS me after seeing THIS 😭💸 Region: Upper center above forehead. Restore the underlying scene naturally without erasing physical props or real scene signage.
Preserve the original opening hand/prop occlusion while transferring the selected influencer identity. No added text. This still must be visually approved against the original opening before animation.
```

**Video prompt**

```text
Create a 4-second continuous portrait video from the approved reconstructed opening image, matching the original opening pose: Close-up, sunglasses fully over eyes, screen-left hand pinching glasses temple, mouth partly open; striped dark/light shirt.
Scene and camera: Fixed close portrait phone framing against plain beige wall; only small head/phone movement.
0–1.35s: Hold sunglasses over eyes with fingers at temple and partly open mouth.
1.35–2.45s: Keep glasses on while lips purse into a rounded surprised shape and head lifts slightly.
2.45–2.82s: Lift sunglasses upward off eyes and away toward screen-left, revealing eyes.
2.82–3.43s: Look slightly screen-right then toward camera; eyes widen and mouth opens in surprise.
3.43–4s: Lean toward camera, hold incredulous wide-eyed look while mouth shape softens.
Final state: Glasses removed from eyes; face leans closer with raised eyebrows and surprised expression.
Keep the approved influencer identity, source clothing, scene and hand/prop continuity through the final frame; any appearance reference affects identity only, never its portrait background. No added captions, text or generated audio.
```

**Review risks**

- Removal begins around2s, not immediately at t=0 and not at anchor2.433333s.
- Last manifest PTS3.333333 exceeds index97/30=3.233333; nominal frame-index timing requires packet review for exact alignment.

Generated image/video: **NOT TESTED**.

### Hook 30

Stable ID: `explore-paired-hook-9309a041061ae5abc6970d52`. Source: 2.100 s. Draft output: 3 s. Clarity: frame 40 / 1.333 s.

**Opening-image prompt**

```text
Create one photorealistic portrait opening image, reconstructing the original video at t=0.
Image 1 is the original source t=0 image: it controls opening pose, hands/props, composition and scene. Image 2 is a later clear frame from the same source, used only as supporting visibility/continuity evidence, not the opening pose or identity authority. Image 3 and every subsequent image are the selected influencer identity references; use their identity without their background or clothing.
Opening: Close portrait of seated person, hand diagonally covers mouth, brows slightly furrowed, gaze lowered toward screen-left.
Scene and camera: Mostly stationary portrait phone shot against pale textured wall; slight handheld wobble.
Reconstruct original hand-over-mouth t=0; clarity1.333333s frame already shows emerging chin/open-mouth action and must not replace opening.
Remove the source caption/graphic overlay: new obsession unlocked: playing a game where I have access to a missing k-pop idol’s phone and I have to figure out what happened to her Region: Centered over lower face/chest. Restore the underlying scene naturally without erasing physical props or real scene signage.
Preserve the original opening hand/prop occlusion while transferring the selected influencer identity. No added text. This still must be visually approved against the original opening before animation.
```

**Video prompt**

```text
Create a 3-second continuous portrait video from the approved reconstructed opening image, matching the original opening pose: Close portrait of seated person, hand diagonally covers mouth, brows slightly furrowed, gaze lowered toward screen-left.
Scene and camera: Mostly stationary portrait phone shot against pale textured wall; slight handheld wobble.
0–1.29s: Keep hand over mouth, gaze lowered and mildly furrowed; small eye movements.
1.29–1.67s: Look up, widen eyes and begin opening mouth behind hand.
1.67–2.43s: Lower hand from mouth to chin as jaw drops; eyebrows lift.
2.43–3s: Hold open-mouth disbelief with hand at chin and eyes fixed slightly off-camera.
Final state: Hand at chin, mouth open, eyes wide in disbelief.
Keep the approved influencer identity, source clothing, scene and hand/prop continuity through the final frame; any appearance reference affects identity only, never its portrait background. No added captions, text or generated audio.
```

**Review risks**

- Hand and caption overlap lower face; cleanup must preserve hand and anatomy.
- Final manifest PTS2.133333 differs from nominal index62/30=2.066667; boundaries use nominal elapsed frame time.

Generated image/video: **NOT TESTED**.

### Hook 35

Stable ID: `explore-paired-hook-bdc5af5aedfac3ddb93b4348`. Source: 3.500 s. Draft output: 4 s. Clarity: frame 78 / 2.600 s.

**Opening-image prompt**

```text
Create one photorealistic portrait opening image, reconstructing the original video at t=0.
Image 1 is the original source t=0 image: it controls opening pose, hands/props, composition and scene. Image 2 is a later clear frame from the same source, used only as supporting visibility/continuity evidence, not the opening pose or identity authority. Image 3 and every subsequent image are the selected influencer identity references; use their identity without their background or clothing.
Opening: Very close face view, tearful/reddened eyes looking upward, hand laid across mouth with long pale pink nails; pale background.
Scene and camera: Tight largely stationary handheld portrait close-up with slight natural drift.
Reconstruct original hand-across-mouth t=0 with requested identity and tearful expression;2.6s clarity image is later hand-lowered state.
Remove the source caption/graphic overlay: just thinking about all the selfies I deleted before I knew about this Region: Centered across mouth/hand. Restore the underlying scene naturally without erasing physical props or real scene signage.
Preserve the original opening hand/prop occlusion while transferring the selected influencer identity. No added text. This still must be visually approved against the original opening before animation.
```

**Video prompt**

```text
Create a 4-second continuous portrait video from the approved reconstructed opening image, matching the original opening pose: Very close face view, tearful/reddened eyes looking upward, hand laid across mouth with long pale pink nails; pale background.
Scene and camera: Tight largely stationary handheld portrait close-up with slight natural drift.
0–1.6s: Keep hand across mouth, tearful eyes blink and glance upward; restrained distressed half-smile.
1.6–2.63s: Turn eyes farther upward/sideways as hand slides down from mouth toward cheek and chin.
2.63–3.31s: Lower hand enough to reveal lips, then lift fingers toward the eye/upper cheek.
3.31–4s: Touch/wipe just beneath eye with fingers and hold upward tearful gaze.
Final state: Fingers under eye/upper cheek, lips revealed, tearful upward gaze.
Keep the approved influencer identity, source clothing, scene and hand/prop continuity through the final frame; any appearance reference affects identity only, never its portrait background. No added captions, text or generated audio.
```

**Review risks**

- Subtle tearful expression, tear sheen and finger/eye contact require visual qualification.
- Do not replace restrained distress with exaggerated screaming or generic shock.

Generated image/video: **NOT TESTED**.

### Hook 39

Stable ID: `explore-paired-hook-99ff813ebc24c61f1c92828e`. Source: 3.867 s. Draft output: 4 s. Clarity: frame 43 / 1.433 s.

**Opening-image prompt**

```text
Create one photorealistic portrait opening image, reconstructing the original video at t=0.
Image 1 is the original source t=0 image: it controls opening pose, hands/props, composition and scene. Image 2 is a later clear frame from the same source, used only as supporting visibility/continuity evidence, not the opening pose or identity authority. Image 3 and every subsequent image are the selected influencer identity references; use their identity without their background or clothing.
Opening: Close-up person in purple shirt wearing oversized sunglasses, screen-left hand gripping temple, mouth wide open.
Scene and camera: Close portrait phone view, largely fixed with small natural head movement; plain indoor background.
Reconstruct sunglasses-over-eyes opening, not1.433333s glasses-low clarity pose; maintain purple-shirt/source composition with influencer identity.
Remove the source caption/graphic overlay: I could literally kiss the game dev that showed me this 🤯😭 Region: Upper center above forehead. Restore the underlying scene naturally without erasing physical props or real scene signage.
Preserve the original opening hand/prop occlusion while transferring the selected influencer identity. No added text. This still must be visually approved against the original opening before animation.
```

**Video prompt**

```text
Create a 4-second continuous portrait video from the approved reconstructed opening image, matching the original opening pose: Close-up person in purple shirt wearing oversized sunglasses, screen-left hand gripping temple, mouth wide open.
Scene and camera: Close portrait phone view, largely fixed with small natural head movement; plain indoor background.
0–0.45s: Hold sunglasses over eyes, mouth open, fingers on temple.
0.45–1.21s: Pull sunglasses down past eyes toward mouth/chin; reveal very wide eyes while jaw stays dropped.
1.21–2.31s: Hold glasses low at chin/upper chest with fixed wide-eyed open-mouth surprise.
2.31–3.45s: Drop glasses out of frame, turn head slightly sideways and back, maintaining surprised expression.
3.45–4s: Bring hand to forehead/hairline and lean slightly closer; lips purse while eyes remain wide.
Final state: Hand at forehead/hairline, wide eyes and rounded/pursed lips; glasses no longer over eyes.
Keep the approved influencer identity, source clothing, scene and hand/prop continuity through the final frame; any appearance reference affects identity only, never its portrait background. No added captions, text or generated audio.
```

**Review risks**

- Removal and forehead gesture are separate phases; do not omit long glasses-low surprise hold.
- Small manifest PTS/index discrepancy near end; timings nominal index/30.

Generated image/video: **NOT TESTED**.

### Hook 46

Stable ID: `explore-paired-hook-4aa27111a23b04a6dd27717b`. Source: 2.400 s. Draft output: 3 s. Clarity: frame 62 / 2.067 s.

**Opening-image prompt**

```text
Create one photorealistic portrait opening image, reconstructing the original video at t=0.
Image 1 is the original source t=0 image: it controls opening pose, hands/props, composition and scene. Image 2 is a later clear frame from the same source, used only as supporting visibility/continuity evidence, not the opening pose or identity authority. Image 3 and every subsequent image are the selected influencer identity references; use their identity without their background or clothing.
Opening: Person in black shirt and clear eyeglasses, hand across mouth/chin, head tilted, gaze toward camera.
Scene and camera: Handheld close portrait; purple wall at screen-left, bright window/curtain screen-right; slight wobble.
Restore original hand-covering-mouth posture using later2.066667s clear face only as identity clarity; preserve eyeglasses throughout.
Remove the source caption/graphic overlay: “bro rate my startup idea 💀🥀” Region: Upper center above hairline. Restore the underlying scene naturally without erasing physical props or real scene signage.
Preserve the original opening hand/prop occlusion while transferring the selected influencer identity. No added text. This still must be visually approved against the original opening before animation.
```

**Video prompt**

```text
Create a 3-second continuous portrait video from the approved reconstructed opening image, matching the original opening pose: Person in black shirt and clear eyeglasses, hand across mouth/chin, head tilted, gaze toward camera.
Scene and camera: Handheld close portrait; purple wall at screen-left, bright window/curtain screen-right; slight wobble.
0–1.17s: Hold hand across mouth, looking toward camera; slight downward gaze and blink.
1.17–1.88s: Lower hand away from mouth and lift it out toward upper screen-right as eyes briefly close and a restrained smile emerges.
1.88–2.33s: Hand leaves face area; face becomes unobstructed, head and phone shift slightly.
2.33–3s: Hold direct camera look with a faint closed-mouth smile.
Final state: Unobstructed face, eyeglasses remain on, small closed-mouth smile.
Keep the approved influencer identity, source clothing, scene and hand/prop continuity through the final frame; any appearance reference affects identity only, never its portrait background. No added captions, text or generated audio.
```

**Review risks**

- This is restrained amusement, not a large jaw-drop; do not import generic shocked performance.
- Eyeglasses are not removed in source.

Generated image/video: **NOT TESTED**.

### Hook 47

Stable ID: `explore-paired-hook-892b0f65083c8cf03270a7c9`. Source: 2.767 s. Draft output: 3 s. Clarity: frame 51 / 1.700 s.

**Opening-image prompt**

```text
Create one photorealistic portrait opening image, reconstructing the original video at t=0.
Image 1 is the original source t=0 image: it controls opening pose, hands/props, composition and scene. Image 2 is a later clear frame from the same source, used only as supporting visibility/continuity evidence, not the opening pose or identity authority. Image 3 and every subsequent image are the selected influencer identity references; use their identity without their background or clothing.
Opening: Person in dark camisole holds clear eyeglasses away from face at screen-right, lenses near mouth/nose level; eyes partly closed, mouth open.
Scene and camera: Portrait close/upper-body phone framing; gray angled wall behind, strong warm side light, mostly fixed.
Reconstruct glasses-off t=0 with glasses held away from face;1.7s clarity image already has glasses on. Animate putting glasses ON, never removing them.
Remove the source caption/graphic overlay: Part time job ❌ Coloring Books ✅ Region: Upper center above forehead. Restore the underlying scene naturally without erasing physical props or real scene signage.
Preserve the original opening hand/prop occlusion while transferring the selected influencer identity. No added text. This still must be visually approved against the original opening before animation.
```

**Video prompt**

```text
Create a 3-second continuous portrait video from the approved reconstructed opening image, matching the original opening pose: Person in dark camisole holds clear eyeglasses away from face at screen-right, lenses near mouth/nose level; eyes partly closed, mouth open.
Scene and camera: Portrait close/upper-body phone framing; gray angled wall behind, strong warm side light, mostly fixed.
0–0.47s: Bring eyeglasses toward face from screen-right; eyes open while mouth stays open.
0.47–0.9s: Set glasses onto nose and over eyes, fingers at screen-right temple.
0.9–1.63s: Keep fingers at temple, peer through glasses with raised brows, open mouth and small head tilt.
1.63–3s: Hold glasses-on pose with small head/eye movements and sustained incredulous open-mouth look.
Final state: Eyeglasses on eyes, fingers still touching temple, mouth open.
Keep the approved influencer identity, source clothing, scene and hand/prop continuity through the final frame; any appearance reference affects identity only, never its portrait background. No added captions, text or generated audio.
```

**Review risks**

- Opposite action to sunglasses-removal references; generic removal template would reverse source choreography.
- Avoid rigid overdescription of fingers; preserve observed contact and glasses direction.

Generated image/video: **NOT TESTED**.

### Hook 50

Stable ID: `explore-paired-hook-c8b971f4cea086703e106c92`. Source: 2.800 s. Draft output: 3 s. Clarity: frame 30 / 1.000 s.

**Opening-image prompt**

```text
Create one photorealistic portrait opening image, reconstructing the original video at t=0.
Image 1 is the original source t=0 image: it controls opening pose, hands/props, composition and scene. Image 2 is a later clear frame from the same source, used only as supporting visibility/continuity evidence, not the opening pose or identity authority. Image 3 and every subsequent image are the selected influencer identity references; use their identity without their background or clothing.
Opening: Close indoor selfie, head turned toward screen-left, eyes wide, mouth rounded open; fingertips rest just below the lower lip.
Scene and camera: Portrait close-up with slight handheld drift, dim pale wall and dark doorway behind; no cut.
Reconstruct source frame0 side-facing mouth-open pose with fingertips below lip; the frontal clarity frame30 is supporting evidence only.
Remove the source caption/graphic overlay: SAY BYE BYE TO CLAUDEMAX... (small trailing emoji; exact punctuation not verified) Region: Lower-middle over upper chest, approximately y=70–82%. Restore the underlying scene naturally without erasing physical props or real scene signage.
Preserve the original opening hand/prop occlusion while transferring the selected influencer identity. No added text. This still must be visually approved against the original opening before animation.
```

**Video prompt**

```text
Create a 3-second continuous portrait video from the approved reconstructed opening image, matching the original opening pose: Close indoor selfie, head turned toward screen-left, eyes wide, mouth rounded open; fingertips rest just below the lower lip.
Scene and camera: Portrait close-up with slight handheld drift, dim pale wall and dark doorway behind; no cut.
0–0.21s: Keep the open-mouthed sideward stare and fingertips at the lower lip.
0.21–1.07s: Turn the head and gaze gradually toward the lens, keeping raised brows and the rounded open mouth.
1.07–3s: Hold the direct-camera surprised stare with slight natural head movement and fingertips still below the lip.
Final state: Front-facing wide-eyed, open-mouthed stare; hand remains near chin/lower lip.
Keep the approved influencer identity, source clothing, scene and hand/prop continuity through the final frame; any appearance reference affects identity only, never its portrait background. No added captions, text or generated audio.
```

**Review risks**

- Do not begin already facing camera from the clarity anchor.
- Caption transcription is partial; remove the complete source overlay rather than regenerate it.

Generated image/video: **NOT TESTED**.

### Hook 52

Stable ID: `explore-paired-hook-114b58d5c22018e273a346de`. Source: 3.467 s. Draft output: 4 s. Clarity: frame 13 / 0.433 s.

**Opening-image prompt**

```text
Create one photorealistic portrait opening image, reconstructing the original video at t=0.
Image 1 is the original source t=0 image: it controls opening pose, hands/props, composition and scene. Image 2 is a later clear frame from the same source, used only as supporting visibility/continuity evidence, not the opening pose or identity authority. Image 3 and every subsequent image are the selected influencer identity references; use their identity without their background or clothing.
Opening: Seated at a table in a bright room, both palms/fingertips braced at temples, elbows out, eyes squeezed shut and mouth open.
Scene and camera: Fixed portrait medium shot from table height; ceiling fan and dark cabinet remain in background.
Match frame0 hands-at-temples and eyes-closed/open-mouth state, not the later eyes-open clarity frame13.
Remove the source caption/graphic overlay: Small top 'pov...' sentence; exact copy not confidently legible in reviewed sheets. Region: Near top center, approximately y=20–29%. Restore the underlying scene naturally without erasing physical props or real scene signage.
Preserve the original opening hand/prop occlusion while transferring the selected influencer identity. No added text. This still must be visually approved against the original opening before animation.
```

**Video prompt**

```text
Create a 4-second continuous portrait video from the approved reconstructed opening image, matching the original opening pose: Seated at a table in a bright room, both palms/fingertips braced at temples, elbows out, eyes squeezed shut and mouth open.
Scene and camera: Fixed portrait medium shot from table height; ceiling fan and dark cabinet remain in background.
0–0.23s: Open the eyes and close the mouth into a small tense smile while keeping both hands against temples.
0.23–1.27s: Hold hands at temples, make a small sideward glance and brief blink, then face forward with a restrained smile.
1.27–1.77s: Lift fingers away from temples and bring both hands inward across cheeks to cover mouth and nose.
1.77–4s: Hold both palms over the lower face, brows pinched and eyelids narrowing; make small sideward eye shifts without lowering hands.
Final state: Both hands still cover mouth/nose; eyes narrowed above them, seated posture unchanged.
Keep the approved influencer identity, source clothing, scene and hand/prop continuity through the final frame; any appearance reference affects identity only, never its portrait background. No added captions, text or generated audio.
```

**Review risks**

- Do not replace the final covered-mouth hold with a generic smile.
- Top caption exact wording unverified.

Generated image/video: **NOT TESTED**.

### Hook 64

Stable ID: `explore-paired-hook-775bf4f0fc41f253d04663e2`. Source: 3.033 s. Draft output: 4 s. Clarity: frame 23 / 0.767 s.

**Opening-image prompt**

```text
Create one photorealistic portrait opening image, reconstructing the original video at t=0.
Image 1 is the original source t=0 image: it controls opening pose, hands/props, composition and scene. Image 2 is a later clear frame from the same source, used only as supporting visibility/continuity evidence, not the opening pose or identity authority. Image 3 and every subsequent image are the selected influencer identity references; use their identity without their background or clothing.
Opening: Seated in an industrial-ceiling café, eyes wide and mouth broadly open, one arm extended toward the phone; laptop not yet prominent at the bottom.
Scene and camera: Portrait phone view pulls back/reframes in the opening to reveal tabletop and open laptop, then steadies; source ceiling pipes/greenery remain.
Rebuild the tight opening composition and extended arm from frame0; frame23 later wider view cannot substitute for opening camera distance.
Remove the source caption/graphic overlay: Travel Agents... are we cooked??; small secondary line appears later and is not confidently transcribed. Region: Center over chest, approximately y=48–70%. Restore the underlying scene naturally without erasing physical props or real scene signage.
Preserve the original opening hand/prop occlusion while transferring the selected influencer identity. No added text. This still must be visually approved against the original opening before animation.
```

**Video prompt**

```text
Create a 4-second continuous portrait video from the approved reconstructed opening image, matching the original opening pose: Seated in an industrial-ceiling café, eyes wide and mouth broadly open, one arm extended toward the phone; laptop not yet prominent at the bottom.
Scene and camera: Portrait phone view pulls back/reframes in the opening to reveal tabletop and open laptop, then steadies; source ceiling pipes/greenery remain.
0–1.15s: Keep wide eyes and a sustained open mouth while the extended arm/phone movement widens the framing to reveal the laptop at lower-left.
1.15–2.15s: Hold the astonished gaze over the laptop with the arm still reaching toward the foreground.
2.15–2.9s: Withdraw the extended forearm from the lens toward the tabletop while keeping the open-mouth reaction.
2.9–4s: Settle hand near laptop/table and hold the same forward, open-mouthed stare with a small head dip near the end.
Final state: Seated behind laptop, hand on/near table, mouth remains open and eyes directed forward/down toward screen.
Keep the approved influencer identity, source clothing, scene and hand/prop continuity through the final frame; any appearance reference affects identity only, never its portrait background. No added captions, text or generated audio.
```

**Review risks**

- The camera reframe is part of source action; do not lock the entire clip to clarity-anchor framing.
- Fine hand placement near laptop should receive full-resolution generation QA.

Generated image/video: **NOT TESTED**.

### Hook 71

Stable ID: `explore-paired-hook-8d49391ade6ddf5261d43d2a`. Source: 3.100 s. Draft output: 4 s. Clarity: frame 45 / 1.500 s.

**Opening-image prompt**

```text
Create one photorealistic portrait opening image, reconstructing the original video at t=0.
Image 1 is the original source t=0 image: it controls opening pose, hands/props, composition and scene. Image 2 is a later clear frame from the same source, used only as supporting visibility/continuity evidence, not the opening pose or identity authority. Image 3 and every subsequent image are the selected influencer identity references; use their identity without their background or clothing.
Opening: Reclining close selfie on patterned bedding, brows drawn up/in, eyes narrowed in a crying expression, one hand covers mouth and lower nose.
Scene and camera: Handheld portrait selfie shakes and changes distance/angle as the person moves; patterned fabric/pillow background remains continuous.
Restore source0 hand-over-mouth pose using frame45 only for visible face continuity; keep the opening occlusion.
Remove the source caption/graphic overlay: My boyfriend changed my alarm so now I have to fly to turn it off😭😭💔 Region: Dark caption strip across forehead/top quarter, approximately y=19–28%. Restore the underlying scene naturally without erasing physical props or real scene signage.
Preserve the original opening hand/prop occlusion while transferring the selected influencer identity. No added text. This still must be visually approved against the original opening before animation.
```

**Video prompt**

```text
Create a 4-second continuous portrait video from the approved reconstructed opening image, matching the original opening pose: Reclining close selfie on patterned bedding, brows drawn up/in, eyes narrowed in a crying expression, one hand covers mouth and lower nose.
Scene and camera: Handheld portrait selfie shakes and changes distance/angle as the person moves; patterned fabric/pillow background remains continuous.
0–1.38s: Maintain the hand over mouth and distressed brow/eyelid expression while the handheld framing wobbles.
1.38–1.78s: Lower the covering hand below the chin, revealing a tense open mouth and tearful-looking expression.
1.78–2.67s: Continue the uncovered distressed reaction with pinched brows and small mouth movement as the phone moves closer and upward.
2.67–4s: Keep reacting with eyes narrowing and mouth opening/closing slightly; handheld view rises and tilts, ending closer to frontal with hand off mouth.
Final state: Uncovered face with distressed brows and parted mouth; close handheld framing, hand remains lowered.
Keep the approved influencer identity, source clothing, scene and hand/prop continuity through the final frame; any appearance reference affects identity only, never its portrait background. No added captions, text or generated audio.
```

**Review risks**

- TIMING DISCREPANCY: curated index45/time1.5s and extracted outputPTS1.5s differ from manifest nominal index45=1.55s at approximate fps29.032258. Beat clock here uses metadata duration3.1s and nominal frame clock; confirm original input PTS before frame-exact production use.
- Do not reinterpret distressed expression as laughter just because mouth opens.

Generated image/video: **NOT TESTED**.

### Hook 85

Stable ID: `explore-paired-hook-bee95bd7a34b5d2a72775282`. Source: 6.033 s. Draft output: 7 s. Clarity: frame 180 / 6.000 s.

**Opening-image prompt**

```text
Create one photorealistic portrait opening image, reconstructing the original video at t=0.
Image 1 is the original source t=0 image: it controls opening pose, hands/props, composition and scene. Image 2 is a later clear frame from the same source, used only as supporting visibility/continuity evidence, not the opening pose or identity authority. Image 3 and every subsequent image are the selected influencer identity references; use their identity without their background or clothing.
Opening: Close upright indoor selfie, hand covers mouth and nose, eyes directed toward camera, eyebrows gently raised; black top and pale tiled/paneled background.
Scene and camera: Mostly steady portrait close-up; framing creeps closer during the clip with small handheld drift.
Generate the actual covered-mouth frame0 pose; anchor180 at6s is effectively the final frame and must never become the literal opening of full recreation.
Remove the source caption/graphic overlay: Wtf did I just find in my LAST YEAR OF UNI (trailing emoji not confidently transcribed) Region: Top center above forehead, approximately y=15–27%; source overlay disappears at very end. Restore the underlying scene naturally without erasing physical props or real scene signage.
Preserve the original opening hand/prop occlusion while transferring the selected influencer identity. No added text. This still must be visually approved against the original opening before animation.
```

**Video prompt**

```text
Create a 7-second continuous portrait video from the approved reconstructed opening image, matching the original opening pose: Close upright indoor selfie, hand covers mouth and nose, eyes directed toward camera, eyebrows gently raised; black top and pale tiled/paneled background.
Scene and camera: Mostly steady portrait close-up; framing creeps closer during the clip with small handheld drift.
0–1.51s: Hold hand over mouth/nose and stare toward the lens; keep the restrained wide-eyed expression.
1.51–2.47s: Blink and roll the gaze upward toward screen-left while keeping the hand in place.
2.47–5.53s: Return gaze toward the lens and hold wide eyes with the hand still covering mouth and nose.
5.53–6.27s: Close eyelids briefly, then slide the covering hand outward onto the screen-left cheek, revealing parted lips.
6.27–7s: Hold palm against cheek, reopen eyes wide and stare into lens with slightly parted lips and raised brows.
Final state: Palm against cheek, mouth uncovered and slightly open, eyes widened toward lens.
Keep the approved influencer identity, source clothing, scene and hand/prop continuity through the final frame; any appearance reference affects identity only, never its portrait background. No added captions, text or generated audio.
```

**Review risks**

- Final-frame clarity anchor would omit virtually all source performance if used as animation frame zero.
- Long covered-mouth hold is deliberate; do not accelerate uncovering to the anchor time or force all clips to three seconds.

Generated image/video: **NOT TESTED**.

### Hook 93

Stable ID: `explore-paired-hook-61eb29067f56267684b7cfe6`. Source: 2.733 s. Draft output: 3 s. Clarity: frame 41 / 1.367 s.

**Opening-image prompt**

```text
Create one photorealistic portrait opening image, reconstructing the original video at t=0.
Image 1 is the original source t=0 image: it controls opening pose, hands/props, composition and scene. Image 2 is a later clear frame from the same source, used only as supporting visibility/continuity evidence, not the opening pose or identity authority. Image 3 and every subsequent image are the selected influencer identity references; use their identity without their background or clothing.
Opening: Seated bright-room portrait, fingertips touch lower lip/chin, gaze toward screen-right, eyebrows raised and mouth partly open in a suppressed smile.
Scene and camera: Steady portrait medium close-up; light wall and red wall section/cabinets behind.
Reconstruct frame0 fingertips-to-lips pose, not frame41 hand already lowering/away from mouth.
Remove the source caption/graphic overlay: Small multiline top caption; exact copy not confidently legible in sheets. Region: Top center, approximately y=15–28%. Restore the underlying scene naturally without erasing physical props or real scene signage.
Preserve the original opening hand/prop occlusion while transferring the selected influencer identity. No added text. This still must be visually approved against the original opening before animation.
```

**Video prompt**

```text
Create a 3-second continuous portrait video from the approved reconstructed opening image, matching the original opening pose: Seated bright-room portrait, fingertips touch lower lip/chin, gaze toward screen-right, eyebrows raised and mouth partly open in a suppressed smile.
Scene and camera: Steady portrait medium close-up; light wall and red wall section/cabinets behind.
0–1.24s: Hold fingertips at lips and look screen-right with lifted brows and a growing smile.
1.24–1.57s: Lower the hand away from lips to chest while opening into a broad smile, gaze still screen-right.
1.57–2.12s: Hold the open smiling reaction, briefly narrowing/closing eyes with small head movement.
2.12–3s: Lift the hand upward and place it across the forehead while leaning/tilting head slightly, smiling through the final frame.
Final state: Hand rests across forehead, eyes narrowed with broad open smile and head tilted.
Keep the approved influencer identity, source clothing, scene and hand/prop continuity through the final frame; any appearance reference affects identity only, never its portrait background. No added captions, text or generated audio.
```

**Review risks**

- Do not stop after uncovering; preserve final hand-to-forehead gesture.
- Caption exact wording unverified.

Generated image/video: **NOT TESTED**.

### Hook 94

Stable ID: `explore-paired-hook-f12c90a72871c0cdaf3503db`. Source: 3.933 s. Draft output: 4 s. Clarity: frame 29 / 0.967 s.

**Opening-image prompt**

```text
Create one photorealistic portrait opening image, reconstructing the original video at t=0.
Image 1 is the original source t=0 image: it controls opening pose, hands/props, composition and scene. Image 2 is a later clear frame from the same source, used only as supporting visibility/continuity evidence, not the opening pose or identity authority. Image 3 and every subsequent image are the selected influencer identity references; use their identity without their background or clothing.
Opening: Seated at desk behind pale keyboard, glasses on, screen-right hand gripping frame at temple, gaze slightly upward with lips closed/pursed.
Scene and camera: Fixed portrait medium desk shot, warm overhead light, wall decor and chair remain unchanged.
Restore glasses-on frame0 with hand gripping temple. Clarity frame29 already has glasses above/off eyes and is not opening-pose authority.
Remove the source caption/graphic overlay: Graphic symbols including red starburst, LinkedIn 'in' square and flame. Region: Upper center above head, approximately y=10–26%. Restore the underlying scene naturally without erasing physical props or real scene signage.
Preserve the original opening hand/prop occlusion while transferring the selected influencer identity. No added text. This still must be visually approved against the original opening before animation.
```

**Video prompt**

```text
Create a 4-second continuous portrait video from the approved reconstructed opening image, matching the original opening pose: Seated at desk behind pale keyboard, glasses on, screen-right hand gripping frame at temple, gaze slightly upward with lips closed/pursed.
Scene and camera: Fixed portrait medium desk shot, warm overhead light, wall decor and chair remain unchanged.
0–0.58s: Hold glasses at temple and stare slightly upward with closed/pursed lips.
0.58–1.19s: Lift glasses up and away from face in one continuous motion, carrying them out through upper-right of frame.
1.19–2.51s: Lower arm out of view and hold an uncovered upward/forward stare with slightly parted lips and a small head movement.
2.51–4s: Blink, lower gaze slightly toward the desk, then settle with lips closed and head subtly angled to screen-left.
Final state: Glasses remain off; hands below frame, lips closed, slight sideward head angle behind keyboard.
Keep the approved influencer identity, source clothing, scene and hand/prop continuity through the final frame; any appearance reference affects identity only, never its portrait background. No added captions, text or generated audio.
```

**Review risks**

- Remove glasses once; do not start glasses-off then invent a second removal.
- Decorative overlay symbols should be removed; keep real wall decorations.

Generated image/video: **NOT TESTED**.

### Hook 96

Stable ID: `explore-paired-hook-50dd086ef9d1c758d5ae3bb5`. Source: 2.867 s. Draft output: 3 s. Clarity: frame 43 / 1.433 s.

**Opening-image prompt**

```text
Create one photorealistic portrait opening image, reconstructing the original video at t=0.
Image 1 is the original source t=0 image: it controls opening pose, hands/props, composition and scene. Image 2 is a later clear frame from the same source, used only as supporting visibility/continuity evidence, not the opening pose or identity authority. Image 3 and every subsequent image are the selected influencer identity references; use their identity without their background or clothing.
Opening: Seated at desk in red top, both palms cover mouth and nose, gaze lifted with brows raised; keyboard and desk mat in foreground.
Scene and camera: Fixed portrait medium desk view with warm ceiling light and wall decor.
Rebuild both-hands-covering-mouth frame0, not clear frame43 with hands already at chest.
Remove the source caption/graphic overlay: Red starburst and LinkedIn logo above GOATED LEADS (small lettering). Region: Upper center above forehead, approximately y=9–27%. Restore the underlying scene naturally without erasing physical props or real scene signage.
Preserve the original opening hand/prop occlusion while transferring the selected influencer identity. No added text. This still must be visually approved against the original opening before animation.
```

**Video prompt**

```text
Create a 3-second continuous portrait video from the approved reconstructed opening image, matching the original opening pose: Seated at desk in red top, both palms cover mouth and nose, gaze lifted with brows raised; keyboard and desk mat in foreground.
Scene and camera: Fixed portrait medium desk view with warm ceiling light and wall decor.
0–0.87s: Hold both hands over mouth and nose, eyes looking upward/forward in surprise.
0.87–1.29s: Lower both hands together from mouth toward chin/chest, revealing an open rounded mouth.
1.29–1.78s: Keep palms together at upper chest and hold the open-mouth, raised-gaze reaction.
1.78–3s: Remain seated with palms together and small natural finger/head movement; keep eyes lifted and mouth partly open through the ending.
Final state: Palms together at chest, mouth open, gaze slightly upward.
Keep the approved influencer identity, source clothing, scene and hand/prop continuity through the final frame; any appearance reference affects identity only, never its portrait background. No added captions, text or generated audio.
```

**Review risks**

- Do not replay hands-to-mouth before lowering; source begins already covered.
- Avoid interpreting joined hands as repeated clapping.

Generated image/video: **NOT TESTED**.

### Hook 100

Stable ID: `explore-paired-hook-fc44f6214b6e17413600ec13`. Source: 3.733 s. Draft output: 4 s. Clarity: frame 70 / 2.333 s.

**Opening-image prompt**

```text
Create one photorealistic portrait opening image, reconstructing the original video at t=0.
Image 1 is the original source t=0 image: it controls opening pose, hands/props, composition and scene. Image 2 is a later clear frame from the same source, used only as supporting visibility/continuity evidence, not the opening pose or identity authority. Image 3 and every subsequent image are the selected influencer identity references; use their identity without their background or clothing.
Opening: Low tilted close selfie under pale window beams, round glasses on, white earbuds, black ribbed sweater; screen-right hand at glasses temple, gaze screen-right and lips parted.
Scene and camera: Portrait low-angle close-up with slight phone drift; tilted beams and bright window remain fixed scene authority.
Use an approved reconstructed t0 glasses-on influencer opening. Clear frame70 at2.333333s is glasses-off direct-camera evidence only.
Remove the source caption/graphic overlay: POV: you finally understand how to use Claude for marketing Region: Lower-middle over sweater, approximately y=63–81%. Restore the underlying scene naturally without erasing physical props or real scene signage.
Preserve the original opening hand/prop occlusion while transferring the selected influencer identity. No added text. This still must be visually approved against the original opening before animation.
```

**Video prompt**

```text
Create a 4-second continuous portrait video from the approved reconstructed opening image, matching the original opening pose: Low tilted close selfie under pale window beams, round glasses on, white earbuds, black ribbed sweater; screen-right hand at glasses temple, gaze screen-right and lips parted.
Scene and camera: Portrait low-angle close-up with slight phone drift; tilted beams and bright window remain fixed scene authority.
0–0.54s: Hold the glasses at temple and the sideward wide-eyed stare with parted lips.
0.54–0.96s: Pull the glasses forward and down once, clearing the eyes and carrying them below the chin while looking screen-right.
0.96–1.71s: Hold the glasses-off sideward stare, lips parted, eyebrows lifted; hand and glasses stay low.
1.71–2.07s: Blink and turn the head/gaze toward the camera.
2.07–3.11s: Hold the direct-camera wide-eyed surprise with parted lips, without smiling or continuously turning.
3.11–4s: Turn gaze/head back toward screen-right and hold the sideward surprised expression to the final frame.
Final state: Glasses off, eyes screen-right, mouth parted, same tilted window-beam scene.
Keep the approved influencer identity, source clothing, scene and hand/prop continuity through the final frame; any appearance reference affects identity only, never its portrait background. No added captions, text or generated audio.
```

**Review risks**

- Prior improved real three-second Hook100 trial was reported better but had only partial source fidelity: glasses removal timing, brow expression and camera drift still need qualification. This source plan is not a new generated-output acceptance.
- Keep sideward hold, blink-turn, frontal hold and final sideward tail distinct.
- Do not carry optional portrait identity-reference background into the ending.

Generated image/video: **NOT TESTED**.

### Hook 101

Stable ID: `explore-paired-hook-ddcfb2950d40f37771058b73`. Source: 3.767 s. Draft output: 4 s. Clarity: frame 28 / 0.933 s.

**Opening-image prompt**

```text
Create one photorealistic portrait opening image, reconstructing the original video at t=0.
Image 1 is the original source t=0 image: it controls opening pose, hands/props, composition and scene. Image 2 is a later clear frame from the same source, used only as supporting visibility/continuity evidence, not the opening pose or identity authority. Image 3 and every subsequent image are the selected influencer identity references; use their identity without their background or clothing.
Opening: Nighttime outdoor selfie aimed steeply upward from chest/below chin, face foreshortened near lower edge against mostly black sky, mouth slightly open.
Scene and camera: Handheld portrait camera rapidly reorients from very low skyward angle to a face-centered street selfie, revealing bright magenta sign and illuminated buildings; continued walking/turning causes background parallax.
Reconstruct the extreme low-angle source0 chin/sky composition. Frame28 clear centered face is later scene evidence; do not begin in its leveled framing.
Remove the source caption/graphic overlay: I could literally KISS the business owner who showed me this Region: Middle over upper chest, approximately y=63–81%. Restore the underlying scene naturally without erasing physical props or real scene signage.
Preserve the original opening hand/prop occlusion while transferring the selected influencer identity. No added text. This still must be visually approved against the original opening before animation.
```

**Video prompt**

```text
Create a 4-second continuous portrait video from the approved reconstructed opening image, matching the original opening pose: Nighttime outdoor selfie aimed steeply upward from chest/below chin, face foreshortened near lower edge against mostly black sky, mouth slightly open.
Scene and camera: Handheld portrait camera rapidly reorients from very low skyward angle to a face-centered street selfie, revealing bright magenta sign and illuminated buildings; continued walking/turning causes background parallax.
0–0.32s: Keep chin high in low upward view while the phone begins to lift/reorient, face emerging from lower frame.
0.32–0.78s: Reframe continuously to a centered more level face view, revealing bright street signs/buildings; settle into a slight closed-mouth smile.
0.78–2.23s: Continue the moving street selfie with a small smile and gaze near lens as buildings drift behind.
2.23–2.79s: Raise a hand to cover/touch the lower mouth and chin while smiling; keep walking-camera drift.
2.79–3.4s: Turn head and gaze toward screen-right, keeping hand against lower mouth/chin.
3.4–4s: Turn back toward lens with hand still near mouth and a restrained smile, maintaining continuous night-street background.
Final state: Face closer to frontal, hand at lower mouth/chin, small smile, illuminated street behind.
Keep the approved influencer identity, source clothing, scene and hand/prop continuity through the final frame; any appearance reference affects identity only, never its portrait background. No added captions, text or generated audio.
```

**Review risks**

- Camera reframe must precede the centered selfie; a static frontal opening loses defining source action.
- Background signage is real scene content; remove caption overlay without erasing the actual street signs.
- Hand rises only after the centered smiling phase.

Generated image/video: **NOT TESTED**.

### Hook 104

Stable ID: `explore-paired-hook-185ed6ac17073e3bc1b8f6b5`. Source: 3.333 s. Draft output: 4 s. Clarity: frame 37 / 1.233 s.

**Opening-image prompt**

```text
Create one photorealistic portrait opening image, reconstructing the original video at t=0.
Image 1 is the original source t=0 image: it controls opening pose, hands/props, composition and scene. Image 2 is a later clear frame from the same source, used only as supporting visibility/continuity evidence, not the opening pose or identity authority. Image 3 and every subsequent image are the selected influencer identity references; use their identity without their background or clothing.
Opening: Purple-lit room, glasses on, phone held screen-left at face/chest height, eyes down toward phone, lips slightly parted and fairly neutral; blue patterned outer layer over light top.
Scene and camera: Portrait medium close-up initially stable, then a gradual closer lean/reframe as reaction builds; purple room and chair stay continuous.
Rebuild source0 phone-reading neutral state. Frame37 already shows phone lowered and shocked open mouth; do not begin in that later reaction.
Remove the source caption/graphic overlay: I love Gen Z because WDYM we made a Bible buddy that will literally text you and remind you to spend time with God Region: Center/lower-middle over chest, approximately y=61–80%; crosses lower face later as framing closes. Restore the underlying scene naturally without erasing physical props or real scene signage.
Preserve the original opening hand/prop occlusion while transferring the selected influencer identity. No added text. This still must be visually approved against the original opening before animation.
```

**Video prompt**

```text
Create a 4-second continuous portrait video from the approved reconstructed opening image, matching the original opening pose: Purple-lit room, glasses on, phone held screen-left at face/chest height, eyes down toward phone, lips slightly parted and fairly neutral; blue patterned outer layer over light top.
Scene and camera: Portrait medium close-up initially stable, then a gradual closer lean/reframe as reaction builds; purple room and chair stay continuous.
0–0.76s: Read the phone with lowered gaze and slight lip movement, maintaining the initially restrained expression.
0.76–1.36s: Widen eyes and open mouth into a rounded shocked expression as phone lowers out of the lower-left foreground.
1.36–2.52s: Hold the open-mouth wide-eyed reaction and lift free hand beside lower face, beginning to lean closer to camera.
2.52–3.12s: Bring hand across mouth, covering the open lips while moving into a closer face view.
3.12–4s: Hold hand over mouth with wide eyes and raised brows, continuing slight lean-in through final close-up.
Final state: Close wide-eyed face with hand over mouth; glasses stay on and purple room persists.
Keep the approved influencer identity, source clothing, scene and hand/prop continuity through the final frame; any appearance reference affects identity only, never its portrait background. No added captions, text or generated audio.
```

**Review risks**

- Preserve the neutral-reading to surprise transition rather than directing shock from frame zero.
- Keep glasses on throughout; blue reflections on lenses are source lighting, not a removal cue.
- Foreground phone and covering hand need continuity QA.

Generated image/video: **NOT TESTED**.

### creator-account-1-01

Stable ID: `creator-account-1-01`. Source: 2.700 s. Draft output: 3 s. Clarity: frame 51 / 1.700 s.

**Opening-image prompt**

```text
Create one photorealistic portrait opening image, reconstructing the original video at t=0.
Image 1 is the original source t=0 image: it controls opening pose, hands/props, composition and scene. Image 2 is a later clear frame from the same source, used only as supporting visibility/continuity evidence, not the opening pose or identity authority. Image 3 and every subsequent image are the selected influencer identity references; use their identity without their background or clothing.
Opening: Arms extend together toward screen-left/front across foreground; eyes closed, chin raised. Seated behind half-open silver laptop in brown sleeveless knit top.
Scene and camera: Fixed low tabletop portrait, laptop lower-left; pale bedroom, shelf and ceiling light.
Reconstruct original extended-arm stretch, closed eyes and chin-up posture, not1.7s hand-on-head clarity pose.
Remove the source caption/graphic overlay: AI Coloring Books + Pinterest = 💰💰💰/day Region: Upper center above head. Restore the underlying scene naturally without erasing physical props or real scene signage.
Preserve the original opening hand/prop occlusion while transferring the selected influencer identity. No added text. This still must be visually approved against the original opening before animation.
```

**Video prompt**

```text
Create a 3-second continuous portrait video from the approved reconstructed opening image, matching the original opening pose: Arms extend together toward screen-left/front across foreground; eyes closed, chin raised. Seated behind half-open silver laptop in brown sleeveless knit top.
Scene and camera: Fixed low tabletop portrait, laptop lower-left; pale bedroom, shelf and ceiling light.
0–0.26s: Hold the forward/side arm stretch, eyes closed and chin slightly raised.
0.26–0.74s: Release stretch, sweep one arm up over head and settle hand on hair while turning face sideways.
0.74–1.33s: Hold hand on head and sideways, slightly upward gaze; other arm rests lower.
1.33–1.74s: Switch the raised-hand gesture across the crown, tilt head and draw free hand downward.
1.74–2.44s: Hold hand on head with head tilted, then start lowering it toward laptop.
2.44–3s: Bring hands forward to laptop; lift lid more upright until it occupies more foreground, face settling toward screen.
Final state: Hands forward at laptop, lid more upright and foreground larger; face looks toward it.
Keep the approved influencer identity, source clothing, scene and hand/prop continuity through the final frame; any appearance reference affects identity only, never its portrait background. No added captions, text or generated audio.
```

**Review risks**

- Exact arm crossing/hand switching requires continuity review; do not replace stretch with generic shock.
- Preserve final laptop-lid movement and increased foreground occlusion.
- Times are nominal elapsed source-frame times, not verified packet-level transition boundaries; creator manifest container PTS can include an approximately0.066016s initial offset.

Generated image/video: **NOT TESTED**.

### creator-account-1-02

Stable ID: `creator-account-1-02`. Source: 2.733 s. Draft output: 3 s. Clarity: frame 44 / 1.467 s.

**Opening-image prompt**

```text
Create one photorealistic portrait opening image, reconstructing the original video at t=0.
Image 1 is the original source t=0 image: it controls opening pose, hands/props, composition and scene. Image 2 is a later clear frame from the same source, used only as supporting visibility/continuity evidence, not the opening pose or identity authority. Image 3 and every subsequent image are the selected influencer identity references; use their identity without their background or clothing.
Opening: Hand rests behind screen-left side of head, chin raised, neutral lips, eyes looking upward. Seated in white short-sleeve shirt beside open laptop.
Scene and camera: Fixed medium portrait phone view; laptop left foreground and bedroom background.
Reconstruct original chin-up, hand-behind-head opening;1.466666s wide-eyed forward lean is later performance.
Remove the source caption/graphic overlay: Why did I find this AFTER being broke?!😭 Region: Upper center; caption absent on final frame. Restore the underlying scene naturally without erasing physical props or real scene signage.
Preserve the original opening hand/prop occlusion while transferring the selected influencer identity. No added text. This still must be visually approved against the original opening before animation.
```

**Video prompt**

```text
Create a 3-second continuous portrait video from the approved reconstructed opening image, matching the original opening pose: Hand rests behind screen-left side of head, chin raised, neutral lips, eyes looking upward. Seated in white short-sleeve shirt beside open laptop.
Scene and camera: Fixed medium portrait phone view; laptop left foreground and bedroom background.
0–0.88s: Hold hand behind head and upward gaze with small eye movement.
0.88–1.46s: Turn attention toward laptop and lean forward; eyes widen, brows lift and jaw drops.
1.46–1.83s: Hold forward lean and open-mouth stare at laptop.
1.83–2.41s: Bring both hands to cover mouth and hold wide-eyed shock.
2.41–3s: Lower hands, then reach toward phone/camera while leaning closer, mouth still parted.
Final state: Arm extended toward camera, face closer and wide-eyed, lips parted.
Keep the approved influencer identity, source clothing, scene and hand/prop continuity through the final frame; any appearance reference affects identity only, never its portrait background. No added captions, text or generated audio.
```

**Review risks**

- Do not skip original calm gaze or final reach.
- Reaching hand enters foreground; preserve anatomy and avoid cut to another scene.
- Times are nominal elapsed source-frame times, not verified packet-level transition boundaries; creator manifest container PTS can include an approximately0.066016s initial offset.

Generated image/video: **NOT TESTED**.

### creator-account-1-03

Stable ID: `creator-account-1-03`. Source: 2.033 s. Draft output: 3 s. Clarity: frame 55 / 1.833 s.

**Opening-image prompt**

```text
Create one photorealistic portrait opening image, reconstructing the original video at t=0.
Image 1 is the original source t=0 image: it controls opening pose, hands/props, composition and scene. Image 2 is a later clear frame from the same source, used only as supporting visibility/continuity evidence, not the opening pose or identity authority. Image 3 and every subsequent image are the selected influencer identity references; use their identity without their background or clothing.
Opening: Clear eyeglasses on eyes, one hand grips screen-right temple, eyes wide and mouth open while seated at laptop in brown knit top.
Scene and camera: Fixed medium-close portrait with laptop lower-left, pale bedroom behind.
Rebuild glasses-on original opening.1.833333s clarity already has glasses removed and cannot be literal first image.
Remove the source caption/graphic overlay: AI Coloring Book + Amazon = 💰💰💰/week Region: Upper center. Restore the underlying scene naturally without erasing physical props or real scene signage.
Preserve the original opening hand/prop occlusion while transferring the selected influencer identity. No added text. This still must be visually approved against the original opening before animation.
```

**Video prompt**

```text
Create a 3-second continuous portrait video from the approved reconstructed opening image, matching the original opening pose: Clear eyeglasses on eyes, one hand grips screen-right temple, eyes wide and mouth open while seated at laptop in brown knit top.
Scene and camera: Fixed medium-close portrait with laptop lower-left, pale bedroom behind.
0–1.43s: Hold glasses on with fingers at temple, wide-eyed open-mouth attention toward laptop; free hand lowers.
1.43–2.26s: Lift glasses upward off eyes and carry them toward screen-right; lips round as eyes remain wide.
2.26–2.7s: Hand and glasses move aside, leaving face unobstructed; lean slightly forward with rounded lips.
2.7–3s: Maintain forward gaze and reopen jaw in surprise, glasses off to side.
Final state: Unobstructed face without glasses, open-mouth surprised look toward laptop.
Keep the approved influencer identity, source clothing, scene and hand/prop continuity through the final frame; any appearance reference affects identity only, never its portrait background. No added captions, text or generated audio.
```

**Review risks**

- Animate one removal, not putting glasses on or repeating removal.
- Keep laptop/background and outfit continuous while glasses move offscreen.
- Times are nominal elapsed source-frame times, not verified packet-level transition boundaries; creator manifest container PTS can include an approximately0.066016s initial offset.

Generated image/video: **NOT TESTED**.

### creator-account-1-06

Stable ID: `creator-account-1-06`. Source: 2.533 s. Draft output: 3 s. Clarity: frame 20 / 0.667 s.

**Opening-image prompt**

```text
Create one photorealistic portrait opening image, reconstructing the original video at t=0.
Image 1 is the original source t=0 image: it controls opening pose, hands/props, composition and scene. Image 2 is a later clear frame from the same source, used only as supporting visibility/continuity evidence, not the opening pose or identity authority. Image 3 and every subsequent image are the selected influencer identity references; use their identity without their background or clothing.
Opening: Tight face view, yellow pencil held upright with eraser touching lower lip, eyes very wide and gaze toward camera; black top.
Scene and camera: Mostly fixed close phone shot with slight natural movement, pale wall and chair behind.
Reconstruct t=0 pencil-eraser contact at lower lip;0.666667s clarity shows pencil already moved aside.
Remove the source caption/graphic overlay: So this is why everyone’s deleting CANVA😱🤯 Region: Upper center above forehead. Restore the underlying scene naturally without erasing physical props or real scene signage.
Preserve the original opening hand/prop occlusion while transferring the selected influencer identity. No added text. This still must be visually approved against the original opening before animation.
```

**Video prompt**

```text
Create a 3-second continuous portrait video from the approved reconstructed opening image, matching the original opening pose: Tight face view, yellow pencil held upright with eraser touching lower lip, eyes very wide and gaze toward camera; black top.
Scene and camera: Mostly fixed close phone shot with slight natural movement, pale wall and chair behind.
0–0.51s: Hold pencil eraser at lower lip, round eyes fixed toward camera and lips slightly pursed.
0.51–1.18s: Move pencil away toward screen-right and raise hand beside outer eye/temple.
1.18–2.25s: Rest fingertip beside temple while holding pencil upright; maintain wide-eyed attentive stare with small mouth movement.
2.25–2.8s: Mouth opens into round surprise while fingertip stays beside temple.
2.8–3s: Round/purse lips and lean closer toward phone; preserve hand beside temple.
Final state: Face closer, rounded lips and wide eyes; hand/pencil remain beside temple.
Keep the approved influencer identity, source clothing, scene and hand/prop continuity through the final frame; any appearance reference affects identity only, never its portrait background. No added captions, text or generated audio.
```

**Review risks**

- Prop is a pencil, not a drinking straw; do not generate sipping.
- Maintain pencil length, hand contact and natural facial proportions during final lean.
- Times are nominal elapsed source-frame times, not verified packet-level transition boundaries; creator manifest container PTS can include an approximately0.066016s initial offset.

Generated image/video: **NOT TESTED**.

### creator-account-2-01

Stable ID: `creator-account-2-01`. Source: 4.167 s. Draft output: 5 s. Clarity: frame 68 / 2.267 s.

**Opening-image prompt**

```text
Create one photorealistic portrait opening image, reconstructing the original video at t=0.
Image 1 is the original source t=0 image: it controls opening pose, hands/props, composition and scene. Image 2 is a later clear frame from the same source, used only as supporting visibility/continuity evidence, not the opening pose or identity authority. Image 3 and every subsequent image are the selected influencer identity references; use their identity without their background or clothing.
Opening: Seated at wooden table with laptop lower-left; screen-left fist supports cheek, other hand holds yellow translucent soft object near chest, gaze lowered to it.
Scene and camera: Initially fixed medium portrait with pale wall; final phone/camera moves closer and tilts, creating blur.
Reconstruct original cheek-on-fist, gaze-down, yellow-object-in-hand opening.2.266667s anchor is a later dropped-object reaction.
Remove the source caption/graphic overlay: My sister is actually nuts why is this her wedding invitation 😭😭 Region: Centered across chest/table edge. Restore the underlying scene naturally without erasing physical props or real scene signage.
Preserve the original opening hand/prop occlusion while transferring the selected influencer identity. No added text. This still must be visually approved against the original opening before animation.
```

**Video prompt**

```text
Create a 5-second continuous portrait video from the approved reconstructed opening image, matching the original opening pose: Seated at wooden table with laptop lower-left; screen-left fist supports cheek, other hand holds yellow translucent soft object near chest, gaze lowered to it.
Scene and camera: Initially fixed medium portrait with pale wall; final phone/camera moves closer and tilts, creating blur.
0–0.72s: Look down at yellow object while cheek rests on fist; lightly turn object in other hand.
0.72–1.84s: Shift gaze toward laptop/camera, lift brows and peer forward while maintaining cheek support and object hold.
1.84–2.72s: Jaw drops, eyes widen; release yellow object onto table where it falls/settles upright.
2.72–3.6s: Lift supporting hand from cheek to cover mouth; hold startled wide-eyed look.
3.6–4.4s: Keep mouth covered and reach free hand toward phone/camera across foreground.
4.4–5s: Camera tilts/moves closer with blur; maintain mouth-covered expression as face becomes larger.
Final state: Closer tilted/blurred face view, hand still over mouth; table/object largely leave composition.
Keep the approved influencer identity, source clothing, scene and hand/prop continuity through the final frame; any appearance reference affects identity only, never its portrait background. No added captions, text or generated audio.
```

**Review risks**

- Yellow object is visually soft/translucent; do not assert exact physical product identity.
- Object release and final camera motion require review; do not invent a camera cut.
- Compression to3s accelerates original4.166667s sequence; retain all phases and declare retiming.
- Times are nominal elapsed source-frame times, not verified packet-level transition boundaries; creator manifest container PTS can include an approximately0.066016s initial offset.

Generated image/video: **NOT TESTED**.

### creator-account-2-02

Stable ID: `creator-account-2-02`. Source: 2.533 s. Draft output: 3 s. Clarity: frame 61 / 2.033 s.

**Opening-image prompt**

```text
Create one photorealistic portrait opening image, reconstructing the original video at t=0.
Image 1 is the original source t=0 image: it controls opening pose, hands/props, composition and scene. Image 2 is a later clear frame from the same source, used only as supporting visibility/continuity evidence, not the opening pose or identity authority. Image 3 and every subsequent image are the selected influencer identity references; use their identity without their background or clothing.
Opening: Leaning forward toward laptop, clear glasses on eyes, both hands gripping temples; eyebrows drawn and mouth slightly parted, gray sleeveless top.
Scene and camera: Fixed medium-close portrait across wooden table; laptop lower-left and angled pale wall behind.
Reconstruct original glasses-over-eyes and both-hands-at-temples pose;2.033333s anchor already has glasses on crown.
Remove the source caption/graphic overlay: Part time job ❌ Coloring Books ✅ Region: Centered across upper chest. Restore the underlying scene naturally without erasing physical props or real scene signage.
Preserve the original opening hand/prop occlusion while transferring the selected influencer identity. No added text. This still must be visually approved against the original opening before animation.
```

**Video prompt**

```text
Create a 3-second continuous portrait video from the approved reconstructed opening image, matching the original opening pose: Leaning forward toward laptop, clear glasses on eyes, both hands gripping temples; eyebrows drawn and mouth slightly parted, gray sleeveless top.
Scene and camera: Fixed medium-close portrait across wooden table; laptop lower-left and angled pale wall behind.
0–0.95s: Peer downward through glasses toward laptop, hands at both temples, brows furrowed.
0.95–1.58s: Lift glasses upward from nose onto top of head with both hands; eyes remain focused on laptop.
1.58–2.13s: Release glasses at crown and lower hands beside ears, look up with mouth opening in disbelief.
2.13–2.57s: Continue lowering hands toward table, briefly close eyes then look forward again.
2.57–3s: Hold hands low near table, glasses remain on head, open-mouth puzzled stare forward.
Final state: Glasses on crown, hands lowered, mouth open and puzzled gaze.
Keep the approved influencer identity, source clothing, scene and hand/prop continuity through the final frame; any appearance reference affects identity only, never its portrait background. No added captions, text or generated audio.
```

**Review risks**

- Glasses remain on head after lifting; do not remove them fully or place them on table.
- Preserve furrowed/puzzled expression rather than generic joy.
- Times are nominal elapsed source-frame times, not verified packet-level transition boundaries; creator manifest container PTS can include an approximately0.066016s initial offset.

Generated image/video: **NOT TESTED**.

### creator-account-2-03

Stable ID: `creator-account-2-03`. Source: 2.900 s. Draft output: 3 s. Clarity: frame 31 / 1.033 s.

**Opening-image prompt**

```text
Create one photorealistic portrait opening image, reconstructing the original video at t=0.
Image 1 is the original source t=0 image: it controls opening pose, hands/props, composition and scene. Image 2 is a later clear frame from the same source, used only as supporting visibility/continuity evidence, not the opening pose or identity authority. Image 3 and every subsequent image are the selected influencer identity references; use their identity without their background or clothing.
Opening: Head angled down, screen-right hand spread horizontally across forehead/eyes; mouth open. Dark sleeveless top at wooden table, laptop left.
Scene and camera: Largely fixed upper-body portrait, pale angled wall; final reach shifts framing slightly closer.
Reconstruct original hand-across-eyes t=0 occlusion;1.033333s anchor has already uncovered eyes.
Remove the source caption/graphic overlay: Part time job ❌ Coloring Books ✅ Region: Centered across chest. Restore the underlying scene naturally without erasing physical props or real scene signage.
Preserve the original opening hand/prop occlusion while transferring the selected influencer identity. No added text. This still must be visually approved against the original opening before animation.
```

**Video prompt**

```text
Create a 3-second continuous portrait video from the approved reconstructed opening image, matching the original opening pose: Head angled down, screen-right hand spread horizontally across forehead/eyes; mouth open. Dark sleeveless top at wooden table, laptop left.
Scene and camera: Largely fixed upper-body portrait, pale angled wall; final reach shifts framing slightly closer.
0–0.79s: Hold hand across forehead/eyes while looking downward, mouth open and shoulders still.
0.79–1.21s: Slide hand down past eyes to hover across mouth/chin, lift gaze toward camera.
1.21–2.07s: Rest hand at mouth/chin, alternate small sideways gaze and brief eye close, restrained amused expression.
2.07–2.48s: Keep hand near mouth and extend free hand toward camera across foreground.
2.48–3s: Lean/reach closer and hold subtle smile with hand remaining near lips.
Final state: Closer face view, hand at mouth/chin and restrained smile, free arm extended.
Keep the approved influencer identity, source clothing, scene and hand/prop continuity through the final frame; any appearance reference affects identity only, never its portrait background. No added captions, text or generated audio.
```

**Review risks**

- Preserve forehead-to-mouth direction; do not reverse to raising hand over eyes.
- No claim of speech from visible mouth shapes.
- Times are nominal elapsed source-frame times, not verified packet-level transition boundaries; creator manifest container PTS can include an approximately0.066016s initial offset.

Generated image/video: **NOT TESTED**.

### creator-account-2-04

Stable ID: `creator-account-2-04`. Source: 3.900 s. Draft output: 4 s. Clarity: frame 32 / 1.067 s.

**Opening-image prompt**

```text
Create one photorealistic portrait opening image, reconstructing the original video at t=0.
Image 1 is the original source t=0 image: it controls opening pose, hands/props, composition and scene. Image 2 is a later clear frame from the same source, used only as supporting visibility/continuity evidence, not the opening pose or identity authority. Image 3 and every subsequent image are the selected influencer identity references; use their identity without their background or clothing.
Opening: Hand touches forehead/brow, eyes briefly closed, mouth open in disbelief; seated behind upright silver laptop at screen-right in dark sleeveless top.
Scene and camera: Fixed close portrait at desk; laptop hides screen-right torso, pale room and ceiling fan behind.
Reconstruct eyes-closed forehead-touch original opening;1.066667s clarity remains forehead pose but differs in gaze/expression.
Remove the source caption/graphic overlay: pov: you’re dating an IT guy Region: Upper center above head. Restore the underlying scene naturally without erasing physical props or real scene signage.
Preserve the original opening hand/prop occlusion while transferring the selected influencer identity. No added text. This still must be visually approved against the original opening before animation.
```

**Video prompt**

```text
Create a 4-second continuous portrait video from the approved reconstructed opening image, matching the original opening pose: Hand touches forehead/brow, eyes briefly closed, mouth open in disbelief; seated behind upright silver laptop at screen-right in dark sleeveless top.
Scene and camera: Fixed close portrait at desk; laptop hides screen-right torso, pale room and ceiling fan behind.
0–1.5s: Hold fingers at brow with open mouth; open eyes and look toward laptop, intermittent blinks.
1.5–1.88s: Slide hand downward from brow over nose/mouth, beginning mouth-cover reaction.
1.88–3.11s: Keep mouth covered, gaze toward laptop; eyes briefly close during held reaction.
3.11–3.59s: Slide hand back up from mouth along face to forehead while expression softens into a small smile.
3.59–4s: Tilt head against hand at brow and hold faint smile looking toward laptop.
Final state: Head tilted toward hand at forehead, restrained smile and laptop-directed gaze.
Keep the approved influencer identity, source clothing, scene and hand/prop continuity through the final frame; any appearance reference affects identity only, never its portrait background. No added captions, text or generated audio.
```

**Review risks**

- This source has two hand transitions, forehead→mouth→forehead; preserve both.
- Laptop must stay fixed at screen-right and not disappear during hand movement.
- Times are nominal elapsed source-frame times, not verified packet-level transition boundaries; creator manifest container PTS can include an approximately0.066016s initial offset.

Generated image/video: **NOT TESTED**.

### creator-account-2-05

Stable ID: `creator-account-2-05`. Source: 3.200 s. Draft output: 4 s. Clarity: frame 43 / 1.433 s.

**Opening-image prompt**

```text
Create one photorealistic portrait opening image, reconstructing the original video at t=0.
Image 1 is the original source t=0 image: it controls opening pose, hands/props, composition and scene. Image 2 is a later clear frame from the same source, used only as supporting visibility/continuity evidence, not the opening pose or identity authority. Image 3 and every subsequent image are the selected influencer identity references; use their identity without their background or clothing.
Opening: Close seated portrait in dark top, holding yellow translucent soft object beside screen-right cheek/chest, lips closed and brow slightly furrowed, gaze off screen-left.
Scene and camera: Initially steady close portrait against angled pale wall; final approach creates tighter face framing.
Reconstruct original closed-mouth sideways gaze and object-in-hand opening;1.433333s anchor already has jaw dropped.
Remove the source caption/graphic overlay: My sister is actually nuts why is this her wedding invitation 😭😭 Region: Upper center above head. Restore the underlying scene naturally without erasing physical props or real scene signage.
Preserve the original opening hand/prop occlusion while transferring the selected influencer identity. No added text. This still must be visually approved against the original opening before animation.
```

**Video prompt**

```text
Create a 4-second continuous portrait video from the approved reconstructed opening image, matching the original opening pose: Close seated portrait in dark top, holding yellow translucent soft object beside screen-right cheek/chest, lips closed and brow slightly furrowed, gaze off screen-left.
Scene and camera: Initially steady close portrait against angled pale wall; final approach creates tighter face framing.
0–1.38s: Hold yellow object near chin/chest and stare slightly screen-left with closed lips, small object/eye movements.
1.38–1.88s: Eyes widen and brows rise, jaw drops into a round open mouth while object stays raised.
1.88–2.79s: Hold open-mouth surprise, glance sideways then forward, object still in hand.
2.79–3.21s: Move yellow object out of face area and bring hand over mouth.
3.21–4s: Lean/move closer for tight face view, keep mouth covered and eyes wide, then glance slightly sideways.
Final state: Very close face, hand covers mouth, eyes wide and gaze slightly sideways; object mostly outside frame.
Keep the approved influencer identity, source clothing, scene and hand/prop continuity through the final frame; any appearance reference affects identity only, never its portrait background. No added captions, text or generated audio.
```

**Review risks**

- Soft yellow object exact identity unknown; preserve visible shape rather than invent brand/product.
- Do not omit calm beginning or final mouth cover when compressing duration.
- Times are nominal elapsed source-frame times, not verified packet-level transition boundaries; creator manifest container PTS can include an approximately0.066016s initial offset.

Generated image/video: **NOT TESTED**.

### creator-account-2-06

Stable ID: `creator-account-2-06`. Source: 3.167 s. Draft output: 4 s. Clarity: frame 85 / 2.833 s.

**Opening-image prompt**

```text
Create one photorealistic portrait opening image, reconstructing the original video at t=0.
Image 1 is the original source t=0 image: it controls opening pose, hands/props, composition and scene. Image 2 is a later clear frame from the same source, used only as supporting visibility/continuity evidence, not the opening pose or identity authority. Image 3 and every subsequent image are the selected influencer identity references; use their identity without their background or clothing.
Opening: Person in mauve sleeveless top seated behind silver laptop screen-right, hand covers mouth, brows lifted and gaze toward laptop/camera.
Scene and camera: Fixed medium-close portrait with warm pale room and window/curtain behind; small natural movement.
Reconstruct original mouth-cover opening;2.833333s clarity is the final uncovered open-mouth pose.
Remove the source caption/graphic overlay: pov: you’re dating an IT guy Region: Upper center above head. Restore the underlying scene naturally without erasing physical props or real scene signage.
Preserve the original opening hand/prop occlusion while transferring the selected influencer identity. No added text. This still must be visually approved against the original opening before animation.
```

**Video prompt**

```text
Create a 4-second continuous portrait video from the approved reconstructed opening image, matching the original opening pose: Person in mauve sleeveless top seated behind silver laptop screen-right, hand covers mouth, brows lifted and gaze toward laptop/camera.
Scene and camera: Fixed medium-close portrait with warm pale room and window/curtain behind; small natural movement.
0–1.77s: Keep mouth covered, alternate laptop-directed and slight sideways glances, with small blinks and restrained amused eyes.
1.77–3.03s: Maintain mouth-cover hold, briefly close eyes then reopen, shoulders largely still.
3.03–3.37s: Lower hand from mouth toward chest as jaw opens into rounded surprise and eyebrows rise.
3.37–4s: Hold mouth open with hand lowered out of face area, gaze toward laptop/camera; no new gesture.
Final state: Face unobstructed, mouth open, hand lowered, same seated framing.
Keep the approved influencer identity, source clothing, scene and hand/prop continuity through the final frame; any appearance reference affects identity only, never its portrait background. No added captions, text or generated audio.
```

**Review risks**

- Long mouth-cover hold defines pacing; do not uncover immediately at t=0.
- Ending is surprised open mouth, not a broad closed-mouth smile.
- Times are nominal elapsed source-frame times, not verified packet-level transition boundaries; creator manifest container PTS can include an approximately0.066016s initial offset.

Generated image/video: **NOT TESTED**.

