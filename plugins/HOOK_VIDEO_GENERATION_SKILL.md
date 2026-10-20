---
name: emotion-hook-director
description: Direct realistic emotion-led UGC and AI-influencer video hooks. Use when a user asks for a hook video prompt, reaction prompt, facial expression, emotional performance, or a short influencer clip (especially 3–5 seconds). Translate the requested feeling into a believable second-by-second facial and physical performance, with camera, identity, audio, and editing constraints. Works for image-to-video or text-to-video.
---

# Emotion Hook Director

**Job:** Turn a user's idea into a **ready-to-paste short-form VIDEO GENERATION PROMPT**. The output is not merely an emotion label: it is a tightly directed performance that a generative video model can attempt to render.

**Grounding:** This skill was distilled from 19 short vertical reference clips. See `references/reference-video-observations.md` for clip-by-clip visual observations and their limits. See `references/emotion-recipes.md` for an emotion vocabulary; `references/prompt-patterns.md` for templates; `references/evaluation.md` for validation. Study these resources selectively as needed; do not paste them into the user's output.

## 1. Activate when relevant

Use when the request concerns: video hook, reaction footage, UGC influencer video prompt, emotional acting, animated facial expression, viral-style opening, reaction to a discovery, skeptical glance, shock, awe, disbelief, frustration, curiosity, relief, delight, or a reference clip's emotional choreography.

Do **not** invoke the acting skill for mere still-image composition, general social-media caption writing, ordinary subtitle formatting, or a long video storyboard unless the request explicitly asks for an emotional performance.

## 2. Understand the request

Extract or sensibly infer the following. **Do not ask multiple questions when the intent is usable.** Ask one question only if an essential asset or restriction is missing and cannot be assumed.

| Variable | What it controls | Default if unspecified |
|---|---|---|
| `hook_goal` | What the viewer should feel / wonder | Curiosity about a surprising discovery |
| `viewer_context` | Audience's relevant situation | Everyday short-form viewer |
| `primary_emotion` | The dominant readable feeling | Curious disbelief |
| `secondary_emotion` | A restrained emotional shift | Quiet delight / anticipation |
| `intensity` | Subtle 1 / clear 2 / dramatic 3 | Clear 2 |
| `duration_seconds` | Hook clip duration | 3.0; 3–5 if unspecified and context demands |
| `trigger` | What caused the character's reaction | Looking at phone/laptop, or unseen off-screen discovery |
| `actor` | Age-appropriate subject / avatar reference | Realistic adult creator |
| `identity_reference` | Image to preserve | Respect provided image; no fictional face change |
| `wardrobe_scene` | Where, wearing what, with which props | Preserve supplied reference; otherwise everyday setting |
| `camera` | Perspective, crop, motion | Vertical 9:16, smartphone UGC medium close-up, natural light |
| `text_overlay` | Words edited over video | Separate optional overlay suggestion; not baked into generation |
| `audio` | Speech, music, silence | Silent unless requested otherwise |
| `destination` | Video model / platform, if named | Model-agnostic natural-language video prompt |

If the user says “same influencer / use this avatar,” explicitly preserve **face structure, eyes, nose, lips, jawline, natural skin tone family, hairline and hair**, and preserve outfit and location unless requested otherwise. Do not invent the identity of an actual person in an image.

## 3. Core performance formula

Every good emotional hook includes five decisions:

**TRIGGER → EYE / BROW CHANGE → MOUTH / BREATH CHANGE → ONE PHYSICAL GESTURE → HELD REACTION.**

Not every visible beat must happen strictly in this order. The model may begin in the middle of an expression for a strong first frame. Still ensure the beats connect as **one recognizable emotional progression**, not a random checklist.

1. **Trigger:** A laptop screen, phone alert, someone off-screen, unexpected result, or a fact implied by the overlay. A coherent attention target makes acting believable.
2. **Microexpression:** Gaze locks, eyebrows lift or knit, blinks slow, eyes narrow or widen, lips part, mouth tightens, jaw relaxes. Pick **2 or 3 complementary cues**, not every cue.
3. **Hero gesture:** ONE meaningful signature action, e.g. hand covers mouth, glasses come off, palm touches forehead, headphones come off, brief head tilt, hand opens palm-up. Some subtle emotions need no hand gesture.
4. **Timing:** Assign specific time windows and allow tiny pauses; use the appropriate beat map below.
5. **Landing:** End on a sustained, legible expression or visual question that makes the next video segment feel worth watching.

**Avoid multiplying actions.** For a 3-second hook, a plausible example is: eyes widen → glasses lower → short stunned look. An implausible example is: jump → spin → cry → laugh → grab head → point.

## 4. Choose the correct beat map

**A. Immediate reaction (the dominant pattern in these references):** First frame already communicates the reaction. Useful when the on-screen hook text supplies the trigger.

- `0.0–0.5s`: Start visibly surprised, skeptical, concerned, or amused. Eyes and brows sell the hook before the gesture.
- `0.5–1.6s`: Make a controlled expression change: a slightly wider gaze, lip part, brow crease, or brief disbelieving glance.
- `1.6–2.5s`: ONE hero gesture: hand toward mouth / lower glasses / palm-up question / forehead touch / headphone removal.
- `2.5–3.0s`: Hold the reaction; avoid abrupt, unnecessary changes. End with an open question or knowing look.

**B. Discovery reaction (when the viewer should perceive cause → effect):**

- `0.0–0.7s`: Neutral, focused on a real prop or offscreen target.
- `0.7–1.4s`: Gaze pauses, brows shift, eyes register new information.
- `1.4–2.4s`: The chosen emotion emerges and ONE signature gesture completes.
- `2.4–3.0s`: Sustain the result, perhaps a subtle inhale or small smile.

**C. Skeptical / disgusted / frustrated reaction:**

- `0.0–0.6s`: Neutral task activity or mild confusion.
- `0.6–1.5s`: Slight brow knit, one eyebrow higher, squint, lips press together; avoid cartoon grimaces.
- `1.5–2.5s`: One questioning or rejecting action (head angle, palm-up, slow headphone removal).
- `2.5–3.0s`: Brief direct-to-camera knowing stare or unimpressed look.

**D. Quiet delight / hope / relief:**

- `0.0–0.7s`: Concern, thoughtful gaze, or held anticipation.
- `0.7–1.7s`: Tension softens through the eyes and mouth; mouth corners rise naturally.
- `1.7–2.6s`: One small gesture, e.g. hand near lips, relaxed exhale, discreet nod.
- `2.6–3.0s`: Hold the authentic smile, not a huge forced grin.

For 4–5 second clips, stretch the **pause and landing**, or introduce one coherent extra beat. Never fill time with repetitive open-mouth acting. For clips shorter than ~2 seconds, start on the main emotion and use at most one gesture.

## 5. Emotion and gesture selection

Pick from `references/emotion-recipes.md`. Map the hook's *human problem* to a reaction, not simply to the advertiser's desired excitement:

- Surprising upside → **disbelief → interested delight**.
- Overwhelming tasks / expensive manual work → **fatigue → frustration**, or **skepticism → relief** if a solution appears.
- Counterintuitive claim → **skepticism → curiosity**, not automatically extreme shock.
- Unexpected bad outcome → **alarm / regret → disbelief**.
- Hidden trick / clever method → **recognition → surprised amusement**.
- Somebody saying something unbelievable → **incredulous side-eye → question gesture**.
- Personal transformation → **hesitation → hope / confidence**.

**Intensity controls physical magnitude:**

| Level | Performance | Best use |
|---|---|---|
| `1 subtle` | Minor eye/brow change, micro-smile, light head tilt; no large gestures | Trust-building founder / product content |
| `2 clear` | Readable eyes + mouth, one short natural gesture | Default creator hook |
| `3 dramatic` | Open-mouth disbelief, hand-to-mouth / glasses removal / hands on head **if context supports** | High-interruption reactions; use sparingly |

**Variation guardrail:** Do not assign hand-over-mouth to every surprise hook. Alternate gesture families according to subject and setting. A gesture must be physically possible from the first frame and consistent with the props shown.

## 6. Write the generation prompt

Produce **ONE fully self-contained prompt**, organized in this exact order:

1. **Identity / scene:** Preserve provided influencer reference or define an adult creator. Keep environment, outfit, hair and skin consistent, with an obvious object of attention.
2. **Camera:** Format, approximate framing, smartphone realism, steadiness, lighting.
3. **Intended performance:** Primary emotion, transition, intensity; *what causes it*.
4. **Timestamped actions:** Usually 3–4 connected beats, with eyes/brows, mouth, hands, and gaze specified at the right moments.
5. **End frame:** Strong held reaction that transitions naturally into a demo/story.
6. **Audio / overlay:** Explicitly state audio setting; recommend overlay text as a post-production element, not as a generation requirement unless requested.
7. **Negative constraints:** No facial warping, frozen mouth, unnatural hands, exaggerated jerkiness, outfit/identity drift, fake looking camera motion, unnecessary cuts or unexplained props.

Use **observable verbs**: “lifts her brows,” “briefly freezes,” “lowers the glasses with one hand,” “looks back at the laptop,” “lets a small smile appear.” Avoid intangible direction alone: “look viral,” “be emotionally compelling,” “act authentic,” “make a great hook.”

Write in natural, direct language that a video generation model can follow. Assume video models have limited capacity to precisely coordinate six things at once. Prefer a small number of well-specified actions to prose overload.

### Video text policy

Most reviewed examples contain an overlaid written hook that creates the *reason* for the reaction. Generate the actor video **without rendered words by default**, then provide one concise optional overlay line for editing. If the user specifically wants text inside the generated video, warn briefly that AI video generators may misrender exact typography and suggest adding it in an editor instead.

### Audio policy

Default: **No dialogue, no singing, no music, no sound effects, no voiceover**. The actor may silently part their lips in surprise, but do not describe speech or lip-sync. When speech is explicitly requested, add a short natural line and lipsync/timing instructions; avoid simultaneously specifying silent footage.

### Reference image policy

When there is a subject image, start:

> Use the provided [female/male] avatar image as the exact **identity and visual reference**. Preserve the same recognizable facial structure, natural skin tone, eyes, nose, lips, jawline, hairline, hair, and overall natural realism. Maintain the reference outfit and background unless the user specifically changes them.

Do not overstate “exact pixel match” or promise identity preservation; it is a prompt constraint, not a guarantee.

## 7. What to deliver to the user

If asked for a **single hook prompt**, return:

- `Emotion choice:` a short one-line characterization, only if helpful.
- `Video generation prompt:` the full copy/paste prompt with timed actions.
- `Suggested text overlay:` one concise line if relevant, labeled as post-production overlay.

If asked for **variants**, provide 2–3 genuinely different emotion trajectories / gestures (not paraphrases of the same hand-to-mouth surprise). If asked for **a skill or plugin integration**, give reusable methodology and templates, not merely one generated example.

Do not claim a hook is “proven viral,” has a measured retention lift, or is guaranteed to perform. These reference clips provide visual examples, not performance metrics.

## 8. Required silent self-check before finalizing

Read `references/evaluation.md` and verify:

1. Emotional progression is concrete and readable by 0.5s when using an immediate-reaction hook.
2. One primary emotion, optional secondary emotion, and no contradictory facial direction.
3. One coherent hero gesture and no physically impossible actions.
4. Time windows cover the full stated duration without overlap or omissions.
5. Trigger or attention target exists; eye line is consistent.
6. Subject continuity, hands, prop placements, lighting and camera remain physically plausible.
7. Audio behavior is explicit and consistent.
8. Text overlay is separated unless user demands in-video lettering.
9. No invented testimonial, unverified product claim, or performance guarantee.
10. A generator can paste the prompt without guessing key details.

For examples of **complete outputs**, read `examples/ready-to-use-prompts.md`. For a machine-friendly input/output contract, read `references/integration-schema.json`.
