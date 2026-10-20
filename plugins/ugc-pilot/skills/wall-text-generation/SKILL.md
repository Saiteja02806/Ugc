---
name: wall-text-generation
description: >-
  Write or revise business-specific wall-of-text overlay COPY for a short video: a compact paragraph, stacked list, POV story or dense on-screen statement. Use for “give me the wall of text for my video” or longer video overlay words. For a footage prompt use wall-text-video-generation; short first-frame hooks use ugc-hook-intelligence.
---

# Wall Text Generation

Own the words for one persistent video overlay. Follow the [shared workflow](../../references/creative-workflow.md) for existing business context and claims.

1. Reuse the product, audience, specific problem, mechanism and desired tone. If only a topic is supplied, write a truthful topic-based draft rather than inventing brand capabilities. Ask one question only when there is no usable topic/product or essential restriction.
2. Choose one central idea and a format from the [writing guide](references/writing-guide.md): paragraph, stacked list, POV/confession, contrast or short statement. Honor the requested length; default to a compact 35–60-word draft with one main tension and concrete payoff. This length is a copy starting point, not a promise of readability in a short clip.
3. Open with a specific audience situation. Develop two or three related thoughts. Close with a relevant next step only if requested or natural; do not append a generic sales CTA to every story. Use conversational, mobile-readable language, avoiding repetitive hype and unsupported outcomes.
4. Keep verified features distinct from hypothetical scenarios. Do not fabricate a customer testimonial, income, time saved, medical benefit, social proof or creator endorsement. First-person claims require a real user-supplied experience or a clearly labeled fictional/skit scenario.
5. Preserve user-requested words, emojis and formatting when revising. If the user asks for exact preservation, do not “improve” that string. Line breaks are authorial copy; later visual wrapping belongs to the editor.
6. Return only paste-ready copy if requested. Otherwise provide the copy plus a brief format/context note. Use the [copy schema](schemas/wall-copy.schema.json) only when structured output is requested. Default to one finished draft; provide alternatives only when requested.

Check business specificity, one coherent idea, natural voice, claims and requested constraints. Dense copy over a very short video may need a pause/replay or a longer edit; do not silently delete words to fit.

For copy and a video prompt together, finish the draft once and pass its exact string to [Wall Text Video Generation](../wall-text-video-generation/SKILL.md). Do not make the user repeat context or copy already available. For multiple drafts without a selection, ask which to direct or pair the requested variants clearly. A copy-only request never submits a generation job. An actual video request uses [Create UGC Media](../create-ugc-media/SKILL.md) after the directing step, with separate exact-text editing still required.
