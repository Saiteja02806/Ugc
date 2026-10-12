# Carousel copy quality: evidence required before a release

12 October 2026. Proposed experimental protocol. No Structure 2 candidate has been implemented, generated or proven by this document. No release is authorized by it.

## What the code history explains

The inspected Structure 2 history includes `bbdd514d` (bounded copy repair) and `2ad4efca` (relaxed false copy validation blocks). These are concrete generation reliability changes. The latter made close repetition advisory while retaining exact-duplicate blocking; it did not guarantee that the reader would find a new lesson.

There are writing instructions too: the current quality guidance bans several stock phrases and asks for concrete actions. However, the implementation's unsupported-claim rule around `worker/src/lib/carousel-structure-2-story-plan.ts:390` detects numeric patterns. It does not verify a qualitative claim such as improved engagement against evidence. The planner repairs a candidate when a blocking issue is identified, so accepted weak prose does not automatically receive a quality rewrite.

The prompt and format rules also require first-person stories and a proof/result beat. Without a supplied experience, that combination encourages an invented before/after story. This is an inference from the rules and outputs, not a claim that one isolated rule caused every weak story.

The latest live baseline produced 30 accepted Structure 2 plans, four copy repairs, four recent-repetition advisories and 30 stories containing unsubstantiated personal outcomes. Passing publishing checks therefore did not establish editorial quality. These findings do not prove that all earlier changes failed or establish how every historical deployment behaved.

## Scope of the proposed experiment

Keep the experiment outside customer generation. Reuse the saved public business facts, creative briefs, selected formats and provider traces. Keep model, typography, word budgets, layout, histories and repair policy matched between control and candidate. Preserve Structure 1's educational purpose and Structure 2's scenario-plus-product purpose.

Make a development set and a separate held-out evaluation set before tuning. Add service, retail and other non-software businesses; include sparse evidence, missing testimonials, ambiguous features and explicit limitations. The existing three-app sample is not a general-business benchmark.

For initial editorial calibration, independently review a small set of strong and weak examples. A review record should identify an exact slide, the problem and the evidence, not just say "boring" or give a single unexplained score. Once the criteria agree with human judgments, an automated reviewer can help scale the experiment. It must still be checked for missed claims and false rejections.

## Test changes separately

| Variant | Changed behavior | What would establish value |
|---|---|---|
| Control | Current writing and validation rules | A fresh matched baseline alongside the preserved earlier outputs. |
| Candidate A | Explicit sourced feature/limitation facts and an evidence-dependent story voice; a demonstration replaces a claimed personal result when no testimonial exists. | Fewer unsupported feature/outcome claims without losing readability or generation acceptance. |
| Candidate B | Candidate A plus a lesson plan: problem, mistaken assumption, mechanism, action and takeaway before prose. | More specific lessons and delivered hook promises than A; not merely longer copy. |
| Optional candidate C | Best prior candidate plus a calibrated editorial check with a bounded rewrite. | Further human preference improvement that justifies added calls and latency. |

Do not assume all three additions are necessary. A stronger writing model is another possible experiment if input and story design still produce weak copy. Model quality, context quality and output checking should not be changed together in a way that hides which change helped.

## The concrete information passed to the writer

A sourced feature set needs feature IDs, source excerpts or URLs, supported user actions and important limitations. A customer outcome requires separate evidence; a generated creative brief is not such evidence. Website analysis is a starting point to verify against its source, not automatically a fact database.

A lesson plan should name:

- The situation and concrete obstacle.
- What the reader learns or decides.
- Which sourced feature addresses the obstacle, and how.
- The action or worked example the reader can use.
- Which claims are allowed and which limitations must remain.

For example: consecutive meetings leave no preparation gap; the lesson is to reserve the preparation time; the supported feature is a configurable meeting buffer; the takeaway is to choose a gap based on the preparation actually needed. None of that requires claiming a real person's productivity improved.

## Reviews and proposed acceptance criteria

These are proposed release criteria to agree before the experiment, not achieved results or industry standards.

1. **Factual review:** no major unsupported feature, testimonial or outcome claims in the held-out reviewed sample; preserve material caveats. Record the supporting source for each asserted claim. Zero observed errors in a finite sample does not guarantee zero future errors.
2. **Reader value:** blinded reviewers prefer the candidate in at least 70% of comparable pairs, with ties counted as no demonstrated improvement. Review the hook promise, practical payoff, natural product connection and distinct lesson. Report results by business and format, not only a pooled score. Repeat generations and keep all failures; do not select only favorable outputs. The 70% threshold is a proposed practical target, not a statistical guarantee.
3. **Reliability:** valid-plan delivery does not regress against the matched control; failed candidates and accepted siblings are accounted for. Verify six slides, selected format, word counts, render fit and optional final CTA with the existing acceptance checks and the separately versioned evidence-dependent voice rules.
4. **Operational cost:** report calls, tokens and per-case/batch latency, including failed attempts. Set the acceptable additional cost and latency before running the expanded comparison. If an editorial pass adds cost without a meaningful preference gain, omit it.
5. **Generalization:** gains remain visible on held-out businesses and sparse descriptions. A win on the same examples used to tune the system is insufficient.

Any semantic reviewer can be wrong. A fact ID alone is not proof that a sentence follows from the fact; the relationship must be reviewed. Keep factual failure decisions distinct from softer editorial rankings. Avoid rejecting harmless stylistic variation through overly strict keyword rules, which would repeat the earlier reliability problem.

## How to protect the existing flow

- Keep experiments in a separate copy-planning module or harness. Preserve generation/job IDs, reservations, allocation, rendering, publication and scheduling during the experiment.
- If a candidate earns promotion, expose it through an explicit versioned opt-in. Jobs without that version follow their previous contract, and retries reuse the recorded version and input snapshot. No existing content is rewritten.
- Preserve the existing six-slide output interface. New voice/evidence rules must be explicit and tested; do not globally weaken the old first-person validator to admit every kind of prose.
- Test the integration and failure cases before a small controlled release: missing evidence, reviewer timeout, invalid JSON, rejected claim, repair limit, worker replay and valid siblings next to an invalid candidate.
- Bound any extra editorial rewrite. Do not fall back to an unsupported old draft merely to report success. Soft quality preferences should not create indefinite retries or discard valid neighboring plans.
- Inspect real hosted integration and saved output during a controlled release after publication authorization. Expand only after both editorial and operational evidence pass; retain rollback by generation version.

The proposed experiment is not a reason to deploy unrelated local work. The user's existing deployment deferral still applies.

## What this can and cannot prove

This can establish that readers judge the copy more useful and that supported claims, diversity and delivery improve under the tested conditions. Actual TikTok performance still needs a separately authorized publishing comparison with comparable topics, visuals, accounts and observation windows. Use metrics that the integration actually exposes; no retention measurement should be invented. Reach and visual treatment can change views even when writing is identical.

The next reviewable result should contain old/new pairs, exact failure counts, claim evidence, reviewer disagreements, tokens/latency and a recommendation to keep or discard each tested change. Confidence should come from those results, not from the proposal's description.

The principle of introducing an evaluator only when clear criteria and measurable refinement gains exist is supported by [Anthropic's workflow guidance](https://www.anthropic.com/engineering/building-effective-agents). That guidance is not evidence that any untested carousel candidate will succeed.
