# Carousel writing quality: agreed direction and proposed checks

12 October 2026. This is a discussion proposal, not a deployed or implemented Structure 2 change.

## Intended difference between structures

The user clarified the desired split after the live test:

- **Structure 1:** useful teaching. A checklist, comparison or explanation should help even without mentioning the product. Do not force a product introduction or turn the last slide into an advertisement.
- **Structure 2:** a recognizable everyday scenario that develops a useful lesson, then introduces the product where a supported feature addresses the actual problem. The product connection distinguishes it from Structure 1; useful content remains necessary.

This is compatible with a six-slide story and optional final CTA. It does not require presenting an invented successful customer as a narrator.

## What “verified customer story” means

Here it means a source supplied to the generator that supports a particular person's experience: an approved customer quote, case study or documented founder experience. The person and results must have a supporting source. Approval to use a testimonial is separate from whether its claims are supported.

A website stating that Calendly supports meeting buffers is evidence about a feature. It is not evidence that a narrator used the feature, saved hours, became more productive or felt less stress. Saying no testimonial is supplied does not mean the business has no customers; it means the generator has no basis to present a customer outcome as a fact.

First-person voice is possible when supported by an actual supplied experience. A clearly labeled illustrative story is another option. Without such evidence, my recommendation is a reader scenario: describe a familiar problem and demonstrate a relevant feature, without claiming that a specific user achieved a result. The user asked for this distinction to be explained; the final voice policy remains to be agreed.

## Example of the distinction

These are manually written illustrations, not new model outputs or validated production plans.

**Structure 1:** “back-to-back meetings leave no room to prepare.” Teach choosing meeting windows, adding gaps and keeping preparation notes. The reader can use the lesson with any suitable calendar setup. The brand is unnecessary to the lesson.

**Structure 2:** “your next call starts before you can finish your notes.” Describe the calendar problem, explain why preparation needs a protected gap, then show the relevant Calendly buffer setting. Finish with a practical next step: choose a gap that fits the preparation the meetings require. Do not claim “I saved hours every week” or invent a stress reduction.

## Proposed improvement process

1. **Give the writer an approved fact set.** Pass actual feature facts, limitations, prohibited claims and any sourced testimonials. Preserve caveats. Separate verified product facts from creative scenarios and customer evidence; an AI-generated private brief is not proof of an experience. Currently the Structure 2 writer receives a minimal business description and a creative brief, while structured `claimsToAvoid` are not carried by `buildCarouselPlanningContext`.
2. **Decide the lesson before writing six slides.** Each idea needs one concrete problem, a useful action or choice, a product feature that addresses the problem, and the reader's practical takeaway. If the product does not address that scenario, select another supported angle rather than asserting that it does. Eight format IDs should vary the reasoning: changed belief, abandoned behavior, mistaken cause, and so on.
3. **Evaluate actual content separately from layout.** Layout and word counts remain deterministic checks. Claim review must ask whether the supplied evidence supports each asserted feature or outcome, including nonnumeric outcomes. Editorial review should identify a weak slide and explain what is missing: a concrete action, a delivered hook promise, a mechanism, or a distinct lesson. A model-based critic can be piloted offline, but its judgments must be calibrated against human decisions; it is not a guarantee of truth or retention.
4. **Prove improvement on saved examples.** Preserve the live run as the baseline. Build a labeled review set from its strongest and weakest drafts, then add non-software businesses, sparse descriptions and misleading-claim cases. Compare revised copy against baseline on the same briefs, with labels hidden and order randomized. Measure human preference, unsupported claims, practical payoff, repetition, validation acceptance, provider cost and latency. Test repeated generations rather than treating one favorable run as conclusive.
5. **Introduce only changes that earn their cost.** Start with an offline experiment; do not automatically add multiple generation/critic calls to every customer job. If a quality pass produces a measurable improvement, use bounded retries and preserve successful siblings. Review hard factual failures separately from softer style rankings. Avoid an unlimited “rewrite until a model likes it” loop.
6. **Check audience outcomes after approved publication.** Compare like-for-like approved content with matched topics and comparable visuals/accounts. Views alone are influenced by reach and creative presentation. Use available completion/swipe, save and engagement measurements where exposed; do not assume that all platforms expose all of them. Evaluate the writing separately from the choice of format.

Pairwise comparisons with clear criteria and human-calibrated graders follow [OpenAI's evaluation guidance](https://developers.openai.com/api/docs/guides/evaluation-best-practices). A generator/evaluator refinement loop is most useful when its criteria are clear and refinement has measurable value; see [Anthropic's workflow guidance](https://www.anthropic.com/engineering/building-effective-agents). Neither source establishes that a particular carousel will perform well on TikTok.

## Completed Structure 1 fix

The local validator no longer flags an initial lowercase letter as a grammar defect. Planner version is `llm-carousel-planner-v52-lowercase-body-validation`. The worker build passes. All 24 Structure 1 grammar tests pass, including lowercase prose across all fifteen formats and retained repeated-word/punctuation-spacing failures. The lowercase regression failed before the correction and passed after it.

An offline replay of 72 actual provider drafts from the earlier live audit reduced grammar flags from 232 to 65. Remaining flags come from the retained grammar heuristics. This replay did not make provider calls or prove that the drafts now pass every publishing check. Other observed word-length, grounding, list/cover fit and repetition failures are outside the narrowly requested lowercase fix.

Evidence: `docs/carousel-structure-1-lowercase-replay-2026-10-12.json`. No production data was modified and nothing was pushed or deployed.
