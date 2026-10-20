---
name: ugc-hook-intelligence
description: Write, rewrite, transcribe or evaluate short on-screen hook TEXT for UGC videos using the user's business context. Use for “give me hook text,” first-frame words, screenshot hook extraction or hook copy variations. For hook video prompts use emotion-hook-director; for paragraph or list overlays use wall-text-generation.
---

# UGC Hook Intelligence

Own the hook words. Read the [shared workflow](../../references/creative-workflow.md) for business context, claim grounding and handoffs.

## Write or review hook text

1. Identify the audience's specific tension and the real feature or demonstration that can resolve it. Reuse the available business context; ask one question only if the product/topic is missing.
2. Use different mechanisms from the [pattern catalog](references/hook-patterns.md): viewer question, relatable POV, contrast, discovery, effort regret, mini-demo or identity conflict. Keep any factual claim within the evidence supplied.
3. Write original, paste-ready words. For a 3-second first frame, roughly 5–10 words is a useful starting point; for 4–5 seconds, roughly 7–15. These are reading heuristics, not performance guarantees. Respect the requested language, count, tone and emojis. Default to five alternatives when no count is specified.
4. Check specificity, first-frame clarity, audience fit, natural phrasing and whether the next demo can deliver the promised payoff. Reject fabricated proof and generic “this is insane” copy without context. Rank only when requested; any score is a creative judgment, not predicted views.
5. If asked only for hooks, return only the requested hooks. Otherwise add a short rationale or test hypothesis when useful. Structured integrations can use the [hook schema](schemas/hook-output.schema.json).

This skill does not author full wall-of-text paragraphs or timed acting prompts. For copy plus video direction, write the requested hook text, then pass the selected string unchanged to [Emotion Hook Director](../emotion-hook-director/SKILL.md). For a paragraph/list, use [Wall Text Generation](../wall-text-generation/SKILL.md). For an actual clip, use [Create UGC Media](../create-ugc-media/SKILL.md).

## Screenshot extraction

Read all visible images and requested occurrences. Preserve legible spelling, punctuation, line order and emojis. Label each string as full_hook, subtitle_fragment, interface_text or uncertain. Record location and confidence; never infer blurred/hidden words as if transcribed. Repeat duplicates if the user asks for every instance. Request tighter crops when necessary.

The [source library](references/source-hook-library.md) is the supplied best-effort transcription collection, not an exact audit or proof of reach. Use it only for structural inspiration. The [worked examples](references/examples.md) are illustrative; their brand facts and testimonials must not migrate into new copy.

## A/B analysis

State the audience, control, changed message and hypothesis. Choose an actual metric such as hook-to-demo retention or landing clicks before a test. A screenshot grid alone cannot establish a causal winner. Do not run an experiment or claim measured results unless data is supplied.
