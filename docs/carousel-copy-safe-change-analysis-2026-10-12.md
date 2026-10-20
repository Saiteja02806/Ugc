# Can the carousel copy problems be fixed safely?

12 October 2026. Analysis only. No runtime source, production data, customer jobs or deployment changed. The answer is **yes, the confirmed defects have bounded changes available**, but a promise of zero regressions would exceed the evidence. Editorial improvement and hosted integration still require verification after implementation.

## What was verified now

- The current worker TypeScript build succeeds.
- All 52 focused checks pass across Structure 1 grammar, Structure 2 formats, story validation, measured copy fit, planner repairs and the generation-job test file. These checks use local fixtures and mocked provider behavior; they do not establish live generation quality or production acceptance.
- All 376 runtime-file hashes under `worker/src` and `lib/carousel` match the preceding live trial. The lowercase validation correction exists, but the list/body behavior that contributed to rejected batches has not received a new runtime change since that trial.
- Structure 2 has useful existing protections: per-candidate repair, accepted siblings retained when a failure callback is provided, bounded targeted repairs, measured renderer preflight before image selection, six-slide roles, product timing and final-only optional CTA.
- The existing claim check mainly catches numeric patterns. It does not compare a qualitative outcome such as reduced cancellations with source evidence.
- Existing duplication checks compare the cover and full story with recent stories, plus slide similarity within a story. They do not directly block a single identical body slide reused between two otherwise different stories. That explains how the repeated Calendly Slide 5 could pass.
- First-person requirements occur in the output instructions, format configuration, runtime format normalizer, schema descriptions and repair instructions. Changing one prompt does not consistently change the policy.
- The worker saves `content_planner_version` with a generated plan. The inspected job-input parser and planner calls do not expose a frozen copy-quality-policy selection for a queued job. Recording the result's version is different from choosing the job's writing rules before execution.

## Changes for issues 2–6

| Issue | Smallest useful change | Main risk and safeguard |
| --- | --- | --- |
| Shared planning requires a product for every lesson | Remove the mandatory shared lesson stage from the release candidate. Structure 1 needs a concrete problem, practical action and takeaway; a product connection is optional. Structure 2 needs a supported feature interaction for its selected scenario. If the connection is missing, report it for that candidate rather than inventing it or rejecting unrelated siblings. | Imposing a new requirement on old briefs or changing assigned topics/IDs. Keep the new policy explicit and preserve existing reserved brief and generation ownership. Do not silently replace a brief or force a different format. |
| Writer/repair violates slide constraints | Keep the current word, role and renderer checks. Supply the repair with the exact failed field, count and measured fit failure; preserve valid fields. Recheck the whole candidate after any repair, including facts and meaning. | Making copy fit by truncating meaning, relaxing layout limits or endlessly retrying. Retain bounded repair attempts; no automatic sentence cutting or larger text area merely to pass. Render accepted output in each supported aspect ratio during verification. |
| Feature facts become unsupported benefits | Separate feature descriptions, allowed actions, limitations and actual outcome/testimonial evidence. Review each product or result assertion against the evidence supplied for that job. Rewrite the unsupported assertion rather than denying a real feature. | A semantic reviewer can invent support or reject valid wording. Calibrate it on labelled supported/unsupported examples and begin in report-only mode. Do not rely on fact IDs, first-person keywords or numeric regex alone as proof. Missing evidence must remain unknown; a failed reviewer must not approve an unverified experimental draft. |
| Lessons remain vague and repetitive | Review whether the hook promise is delivered, the reader gets a specific action/decision or example, and the product interaction fits that lesson. Compare body slides across the current business batch and recent accepted stories. Start softer quality preferences as advisories and targeted rewrites. | Rejecting every harmless stylistic variation or repeated necessary feature description. Distinguish an exactly copied substantive paragraph from shared vocabulary. Only hard-block defects whose criteria have been tested; a model preference is not a proven audience preference. |
| Extra stages increase work without value | Keep the direct evidence/scenario writer as the next experiment. Do not reintroduce the mandatory extra outline call. Track total calls, tokens, repair attempts, accepted plans and per-business quality, including failures. Add another stage only if it earns its cost in a matched comparison. | Moving failure to another stage or hiding its cost. Count planning/reviewer failures and overhead; do not compare only favorable accepted examples. Retain candidate-level budgets. |

These are implementation proposals, not fixes already installed. Better repair feedback is plausible but not sufficient proof: the existing repair path already specifies counts and layouts and still failed in the live trial. A subsequent experiment must demonstrate improvement.

## Protect the existing workflow

Make the copy policy a versioned, explicit selection on new experimental jobs, with a snapshot of the evidence used for that job. Jobs without the selection use the preserved old policy. Retries use the same recorded selection and evidence. The inspected runtime does not already provide this complete isolation, so it must be implemented and tested rather than assumed.

Preserve the existing rendered-slide interface, structure/format assignments, six-slide order, product placement and CTA location. New review details can remain internal metadata rather than being shown as implementation details to users. The text change should not alter image reservations, business ownership, publishing targets, scheduling or completed content.

Keep both policy versions available during a controlled rollout. Disabling new enrollment should leave older and already-versioned jobs with supported behavior. Do not roll an experimental job back by publishing a previously rejected or unsupported draft. If its evidence or review cannot be established, retain the bounded failure and actionable diagnosis.

The exact metadata storage and dispatch changes still need design and contract tests. Existing JSON fields may permit an additive implementation, but this analysis does not certify that no migration is needed. No Supabase schema, RLS or storage changes were performed.

## Verification required before release

1. **Contract and negative tests:** old job without a policy, new versioned job, retry with frozen evidence, missing evidence, no testimonial, useful education without a product, unsupported product interaction, reviewer timeout, malformed review output and an invalid candidate next to valid siblings. Test the repair cap and count all failures.
2. **False-positive calibration:** known valid feature statements and independently useful lessons must survive; fabricated experiences, unsupported outcomes and sample-pack/proof confusion must be diagnosed correctly. Freeze these examples before tuning.
3. **Replay and actual rendering:** run saved real drafts through the changed policy; render accepted examples for every supported aspect ratio. A count-only pass does not establish visual fit.
4. **Fresh matched provider trial:** compare the current writer with one change at a time, repeat generations, include new non-software businesses and sparse evidence, and preserve all outputs. The earlier 120-plan pilot was interrupted and had one batch per case; its throughput difference is promising, not a stable production estimate.
5. **Editorial review:** assess practical payoff, claim support, cover/body consistency and diversity. Human preference and TikTok metrics remain separate from AI-agent review. Neither a mocked regression pass nor a judge score proves audience engagement.
6. **Hosted verification after release authorization:** use the production domain for authenticated generation, persistence, editing and scheduling acceptance. Verify worker deployment compatibility and retry behavior for the selected policy. The user's current deployment deferral remains in effect.

The criteria are concrete: preserve legacy behavior; introduce no known major unsupported claims in the reviewed sample; avoid regressing accepted-plan delivery; demonstrate clearer useful takeaways; keep measured overhead within an agreed budget. The full mandatory lesson-first flow has not met these criteria.

## Relevant code and evidence

- Existing list/body handling: `worker/src/lib/carousel-llm-slide-plan.ts:1110`.
- Structure 2 rules and numeric claim check: `worker/src/lib/carousel-structure-2-story-plan.ts:234`.
- Initial and targeted repair instructions: `worker/src/lib/carousel-structure-2-story-plan.ts:680` and `:797`.
- Per-candidate failure and accepted-sibling handling: `worker/src/lib/carousel-structure-2-planner.ts:121`.
- Normalized story perspective rules: `worker/src/lib/carousel-structure-2-formats.ts:211`.
- Actual renderer preflight: `worker/src/lib/carousel-structure-2-measured-copy-fit.ts:7`.
- Job input boundary: `worker/src/jobs/generate-carousel.ts:18`.
- [Live comparison and limits](carousel-copy-comparison-audit-2026-10-12.md).

The practical order is to correct the deterministic output-contract defects, test an evidence-dependent voice consistently across cover and body, then measure a calibrated factual/editorial review. Do not combine these with unrelated pending UI, image or deployment changes while establishing whether the copy improvement works.
