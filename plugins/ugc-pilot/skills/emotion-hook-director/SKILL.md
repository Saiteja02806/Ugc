---
name: emotion-hook-director
description: Produce a ready-to-paste hook VIDEO GENERATION PROMPT with realistic emotional performance, camera direction and timed actions. Use for “give me a prompt for hook video generation,” reaction footage prompts or image-to-video acting direction. Drafts prompts; short hook words belong to ugc-hook-intelligence and actual paid generation to create-ugc-media.
---

# Emotion Hook Director

Turn the requested feeling and idea into observable video direction. Follow the [shared workflow](../../references/creative-workflow.md); draft-only requests do not spend credits.

1. Reuse the scene, business context, selected hook and any reference already present. If the user supplied an image, preserve its subject, outfit, location and props unless asked to change them. Do not identify an unknown person or guarantee exact identity fidelity.
2. Infer innocuous defaults: realistic adult creator, vertical smartphone medium close-up, natural light, three seconds, clear but restrained curiosity. Honor explicit duration, aspect, actor and audio preferences; drafting for another video model may use its named constraints.
3. Select one coherent emotional progression: trigger → eye/brow change → mouth/breath change → one hero gesture → held reaction. Use two or three complementary facial cues. A subtle reaction may need no hand gesture. Match prop position and eye line throughout.
4. Use a beat map from the [performance guide](references/performance-guide.md). For four or five seconds extend pauses and the landing rather than multiplying actions. Timestamped beats must cover the full duration without gaps or overlaps.
5. Write a self-contained prompt in this order: subject/reference and scene; camera/light; emotional trigger; timestamped observable actions; end frame; audio and text policy; physical continuity constraints. Do not give only an emotion label. Default to no dialogue, music, voiceover or effects unless requested. Mouth movement may be silent; do not invent speech or lip-sync.
6. Generate clean footage without baked-in words by default. Preserve selected hook words exactly as a separate post-production overlay. Never invent replacement hook copy unless the user requests copy too; then use [Hook Intelligence](../ugc-hook-intelligence/SKILL.md).
7. Return just the prompt if that is all the user asked for. Add emotion choice or an overlay plan only when useful/requested. Structured output may use the [director schema](schemas/director-output.schema.json).

For variants, vary emotion trajectories or gesture families, not only adjectives. Check believable timing, one primary action, consistent anatomy/props/identity and truthful claims. Direction is a model constraint, not a fidelity or virality guarantee. If the user requests actual generation, hand off to [Create UGC Media](../create-ugc-media/SKILL.md) and its current limits and cost checks.
