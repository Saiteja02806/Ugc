---
name: wall-text-video-generation
description: Draft clean moving-footage VIDEO PROMPTS and an exact-text editing plan for wall-of-text videos. Use for “give me the prompt for wall of text,” background footage direction or turning selected overlay copy into a video prompt. Preserves supplied words; wall-text-generation writes copy and create-ugc-media performs paid generation.
metadata:
  source_version: "2.1.0"
---

# Wall Text Video Generation

Own footage direction, not overlay words. Follow the [shared workflow](../../references/creative-workflow.md). Generate clean footage and plan exact overlay editing separately.

## Inputs and handoff

For a full overlay handoff, obtain the finished `overlay_text` from the conversation, user selection or [Wall Text Generation](../wall-text-generation/SKILL.md). Preserve it character for character, including emoji, punctuation and newlines. Do not paraphrase, extend, correct or truncate it. Reuse existing copy rather than asking the user to repeat it.

If a combined request needs new copy, run the writer then the director. If a full handoff is requested without copy or permission to write it, return `needs_upstream_copy` and ask one focused question. A footage-prompt-only request can use a scene/business brief without overlay words; use `overlay_render_spec: null` when no exact text exists. Do not claim exact overlay planning is complete in that case.

## Direction

1. Prioritize explicit user constraints, then supplied visual/character references, real product assets and the relevant scene family. Default to realistic vertical 9:16 smartphone footage. Preserve requested identity, wardrobe, background and aspect ratio as direction, not a guarantee.
2. Choose close_selfie, moving_selfie, everyday_activity, lifestyle_pov, environment_only, lifestyle_montage or product_demo_hybrid using the [visual guide](references/visual-guide.md). Choose a setting independently of emotion; avoid automatically using a generic desk or dramatic surprise.
3. Specify one believable sustained behavior: passive presence, conversational expression, ordinary activity or a handheld walk. Do not force a reveal/hand-to-mouth reaction into a dense-text clip. Silent mouth movement is possible but must not be described as invented dialogue/lip-sync.
4. Write a paste-ready footage prompt containing duration, framing, setting/subject, light, motion, continuity and intended overlay region. Keep the words out of the generator prompt. Default to no baked-in text, subtitles, fake product UI, watermarks or generated audio; respect explicit audio preferences.
5. Use a continuous shot by default. For montage, keep one global text block constant across cuts. Use genuine supplied assets for a demo; do not fabricate screenshots or product features.
6. Plan duration honestly. A 6–9-second draft is a stylistic default, not an audited performance fact. A rough English reading estimate of 2.5–3.5 words/second may highlight dense copy needing pause/replay or a longer edit; never guarantee first-pass reading. Explicit duration wins for drafting; actual MCP execution must use supported 3–10-second whole durations or an explicitly agreed alternative.
7. Provide `overlay_render_spec.exact_text` unchanged, shown from the first frame to the end. Set `baked_into_generated_footage: false`, a screen-anchored position, high-contrast type and fixed text across montage. Visual wrapping must not alter stored copy. Position may overlap the subject when requested/reference-appropriate; do not force face-clear layout on every clip. Typography/coordinates are editor instructions, not MCP arguments.
8. Separate silent generated footage from optional final music/ambience or supplied audio, which requires a separate editing workflow. Avoid silently adding a soundtrack.

## Output and checks

Return only the ready prompt when asked only for a prompt. Include the exact overlay plan if requested/useful and use the [video schema](schemas/video-output.schema.json) for structured handoffs. Preserve status, production_mode, visual_direction, ready_video_prompt, negative_prompt, motion_timeline, overlay_render_spec, duration_plan, audio_plan and quality_notes in structured responses.

Check lossless copy, reference consistency, supported scene family, complete timeline, duration/overlay agreement, truthful assets and readable contrast. State that a separate editor must compose exact words. This skill neither contains a renderer nor produces the finished video itself. For actual footage generation use [Create UGC Media](../create-ugc-media/SKILL.md) with its live cost/capability/ownership checks; do not pass unsupported overlay, resolution, negative_prompt or audio fields to MCP.
