---
name: ugc-native-slideshow
description: Write, rewrite or review native-looking UGC SLIDESHOW COPY, slide sequences and semantic slide JSON for TikTok, Instagram or carousel planning. Use for slideshow text, cover hooks, body-slide wording, requested slide counts and visual intentions. Produces a content plan; finished slide rendering, Carousel generation and publishing require separate tools.
---

# UGC Native Slideshow

Follow the [shared workflow](../../references/creative-workflow.md) for business context and claims. Produce the copy and semantic sequence the user requested. Do not submit a media job for a text/JSON request.

1. Reuse audience, product, problem, tone, evidence and constraints. Honor an explicit slide count (at least two for this format); otherwise choose a concise sequence of 4–7 slides. A single requested image is a separate one-slide copy task, not valid slideshow JSON.
2. Choose one content format: personal_shift, story_confession, quick_tips, educational_method, fitness_routine, product_assisted or goal_based_routine. `goal_based_routine` organizes a goal into an ordered practical routine with a purpose and actionable cue for each step; do not guarantee the goal will be achieved.
3. Start with exactly one cover. Use a specific hook with an optional subline. Each subsequent slide has one idea and a clear semantic role: body, result or cta. A result slide does not imply fabricated proof; it may state a truthful takeaway.
4. Choose a presentation mode for each slide from the [layout guide](references/layout-guide.md). Keep format (narrative) distinct from presentation (text hierarchy). Mode requirements: cover needs hook; numbered_shift needs headline and body_1; pill_story and outlined_story need body_1; minimal_statement needs headline; educational_method needs headline, body_1 and example; routine_explanation needs headline, why and cue; cta needs headline. Cover role uses cover mode, cta role uses cta mode; body/result use the remaining modes.
5. Write natural, concrete copy and a visual_intent per slide. Use the [pattern library](references/pattern-library.md) for structure, never as proof of fitness/health outcomes or a real personal transformation. First-person claims need supplied experience or a clear fictional label. No invented product capability, measurement or endorsement.
6. Product placement should support the story rather than appear on every slide. Use only real supplied product assets. Prefer one meaningful mention and an optional relevant CTA; honor an explicit product-placement brief.
7. Return slide-by-slide words if requested, or the [semantic schema](references/output-schema.json) when JSON is requested. Unused optional text fields can be null or omitted. Visible copy must be nonempty. Verify requested slide count, exactly one first cover, mode requirements and consistent claims.

The layout guide contains typography and spacing ideas, including Inter and 1080×1920 reference geometry. Those are suggestions for a separate renderer; explicit user/target layout takes precedence. Do not treat this semantic JSON as the application's current Carousel worker payload or invent an export endpoint. This package drafts slideshow text and visual intentions; it does not render, export, schedule or publish slides.
