# Live trial of the proposed carousel writing flow

12 October 2026. **Recommendation: do not implement the complete lesson-first flow yet.** Explicit feature evidence and a scenario-based voice showed useful changes in this sample. Adding a separate lesson-planning call did not establish better delivered content and introduced another failure point. Neither candidate meets the proposed release criteria.

This is an actual fresh text-provider experiment, not a prediction based on prompt wording. It did not create customer jobs, images, posts or deployments. All 376 checked files under `worker/src` and `lib/carousel` have the same hashes before and after the experiment.

## What was compared

Four public business fixtures: UGCPilot, Cal AI, Calendly and MOO business-card printing. MOO was a new retail category held out from the earlier three-app test. No testimonial or personal outcome evidence was supplied. That does **not** mean these businesses have no real testimonials; those were deliberately excluded from the experiment inputs.

Each business requested five plans per structure and variant: 4 × 5 × 2 × 3 = **120 requested plans**. The first three businesses reused their earlier public creative briefs unchanged; MOO received a fresh brief from the existing brief planner. Every variant used the same briefs, selected format IDs, empty recent history, `gpt-4o-mini`, local typography, output shape and existing repair allowance.

| Variant | Experimental change |
| --- | --- |
| Control | Current local writer, including the Structure 1 lowercase fix. |
| Evidence | Explicit sourced feature facts and limits. Structure 1 teaches without compulsory product promotion. Structure 2 uses reader scenarios and a conditional feature demonstration instead of an invented personal result. |
| Lesson | Evidence variant plus a fresh pre-writing outline for each brief: problem, mistaken assumption, lesson, supported mechanism, action and takeaway. |

The two experimental Structure 2 copies explicitly change their perspective contract from first person to reader scenarios. They preserve the other locked format policies, word counts, layout checks, output interface and repair limits. Their isolated format JSON, normalizer and writer prompt were changed together. This is an experimental architectural adaptation, not evidence that merely appending more facts to the unchanged runtime would produce these results. Evidence and voice were changed together; this trial does not isolate their individual contributions.

Structure 1 used the first five educational formats: list, mistakes, how-to, comparison and swap. Structure 2 alternated its first and second selection batches across businesses, covering all eight existing story formats. Format assignments match across variants for each business. No Structure 2 takeover was allowed after a Structure 1 failure, to keep the structure outcomes distinguishable.

## Delivery results

| Variant | Structure 1 delivered | Structure 2 delivered |
| --- | ---: | ---: |
| Control | 0/20 | 15/20 |
| Evidence and scenario voice | 0/20 | 20/20 |
| Evidence, scenario voice and lesson planning | 0/20 | 9/20 |

| Business | Structure 2 control | Structure 2 evidence | Structure 2 lesson |
| --- | ---: | ---: | ---: |
| UGCPilot | 5/5 | 5/5 | 5/5 |
| Cal AI | 5/5 | 5/5 | 0/5 |
| Calendly | 0/5 | 5/5 | 4/5 |
| MOO | 5/5 | 5/5 | 0/5 |

“Delivered” means an accepted text plan returned from the tested planner. It does not mean a published post or editorial approval. These results are a small pilot, with one five-item batch per business and variant, not a statistical estimate of production success.

The MOO lesson batch failed before slide writing: some outlines omitted the mechanism, and two supplied no fact IDs. Ten requested plans—five per structure—were therefore blocked at planning. The other 110 requested plans reached the writer. For Structure 2, the lesson variant delivered 9/15 among cases that reached writing, or 9/20 including the planning failure. Both denominators matter.

Every Structure 1 writing batch still failed after its allowed attempts. One failing candidate can withhold all five plans under its existing batch contract; **0/20 does not mean every individual draft was independently invalid**. The lowercase change is present, but it does not resolve the remaining format and copy defects.

One concrete example is the UGCPilot control list draft: Slide 2 repeats its two list items in a separate numbered `body`, while also returning `listItems` and a heading. That extra body is checked as a list line, violates the line budget and is too short for the ordinary body requirement. Similar list defects blocked the batches before all siblings could be returned. Other checks flagged text length, spacing/grammar, repeated heading/body meaning and generic copy. More context did not repair this output-contract problem.

The failed Calendly control and Cal AI lesson Structure 2 plans mainly retained body-layout and word-count defects after targeted repairs. Those failures are preserved; they were not silently replaced by better examples.

## What the actual wording shows

The AI agent read all **44 accepted Structure 2 stories**, plus rejected draft examples. This is an editorial audit, not a human panel, a blinded preference result or evidence of TikTok retention. The earlier metric artifact's “Human reading” label has been corrected to “AI-agent reading.”

**A meaningful improvement:** all 15 accepted control stories contain unsubstantiated first-person after-use results. None of the accepted evidence or lesson stories uses first-person wording in Slides 2–5. For example, MOO control says: “People remember me better because of it.” No evidence in the brief supports that experience or result. The evidence variant's paper-finish story instead gives a supported action: “Order a sample pack from MOO to experience paper finishes firsthand.” That provides something a reader can actually do.

**The voice change is incomplete:** 13/20 evidence covers and 4/9 lesson covers still use first-person wording, despite the experimental no-invented-narrator instruction. For example, “i thought my digital design would look perfect in print.” The proposed policy must cover hook guidance as well as body prose; passing the changed perspective check does not establish compliance with the desired editorial rule.

**Facts do not prevent unsupported conclusions:** UGCPilot evidence Slide 5 says, “When you focus on your audience, engagement improves naturally.” Website/business-specific generation does not substantiate that outcome. Calendly evidence says meeting limits reduce cancellations; no cancellation-reduction evidence was supplied. MOO evidence treats a generic paper/finish sample pack as assurance that a custom digital design will print as expected. A sample pack and a proof of a customer's specific artwork are different things.

**The useful lesson is still often too weak:** much copy ends with “embrace flexibility,” “focus on what resonates,” or “enhance your productivity.” Those statements do not teach a concrete decision rule or show an example. A product mechanism can be factually supported while the surrounding story offers little practical payoff.

**The extra lesson call was not enough:** UGCPilot's lesson variant still ends with broad statements such as “embrace resources to enhance your process.” In the accepted Calendly lesson plans, slots 0 and 2 repeat the same Slide 5 text exactly: “Define your availability to manage client expectations. Share your Calendly link for easy scheduling.” A separate outline did not guarantee distinct lessons or a better demonstration. The metrics record repeated accepted body slides within each business and variant.

**The planning stage itself needs review:** MOO's outline suggested requesting a physical proof, which was not in the supplied fact set; the presence of a valid upload-feature ID would not prove that instruction. It also produced empty mechanisms. The mechanical outline validator rejected the batch, but it cannot detect every unsupported action. Passing a fact-ID check is not semantic verification.

The shared outline's mandatory product-mechanism rule is also a poor fit for the user's Structure 1 purpose. An independently useful lesson should remain valid without a product mechanism. Reusing one product-required planning contract for both structures can reject legitimate educational ideas. This is a defect of the tested proposal, not a new application rule.

## Calls, overhead and experiment limitations

The comparison initiated **89 provider requests**, with 87 recorded HTTP-200 completions and provider IDs. Recorded usage is **550,920 prompt + 117,595 completion = 668,515 tokens**. One request timed out/aborted; one in-flight request was interrupted when the initial harness stopped. Usage for that interrupted request is unknown.

The evidence Structure 2 arm used five calls, including one repair, for 20 accepted plans. The lesson Structure 2 arm used 21 writer/repair calls for nine accepted plans, **plus** the shared outline calls. It had 18 targeted repair calls. More calls did not establish more useful delivered text. Raw latency and tokens are recorded by batch; they are diagnostic observations, not production SLA or billing estimates.

The pre-writing outline requests were made once per business and reused for both structures. Four outline calls recorded 7,378 tokens; MOO's one creative-brief call recorded 1,972 tokens. No model judge or additional editorial rewrite was used.

Two experiment interruptions are retained separately:

1. Initial setup was stopped before Structure 2 ran after finding that its normalizer restored an old first-person rule on Slide 5. Five completed setup responses recorded 38,619 tokens; two in-flight requests have unknown usage. Those calls are excluded from the comparison outcome table.
2. The first main harness stopped when MOO's unsupported/incomplete outline threw an error. It was resumed with completed comparisons preserved and that failure counted, while the independent control and evidence variants continued. One unfinished Calendly request had to restart. The request ceiling was raised from 100 to 220 to accommodate the existing bounded repair policy; only 89 main requests were initiated. No writer policy or repair allowance was tuned after seeing the results. Consequently this is an interrupted exploratory pilot, not a pristine preregistered benchmark.

Inputs came from publicly described products and manually prepared fact packs. This trial **does not test automatic website extraction, stale/missing source handling, authenticated customer workflows or hosted worker health**. A production implementation would need to create and verify that evidence reliably from the supplied link; success with curated public facts does not establish that capability.

The samples also exclude earlier history and image selection. Same-batch repetition is visible, but this trial does not measure long-term content diversity or image allocation. It tests selected formats, not every possible Structure 1 batch rotation.

## What is worth doing next

Keep the user's distinction: Structure 1 teaches an independently useful lesson; Structure 2 develops a scenario and introduces a relevant product interaction, with an optional CTA after the useful final takeaway. A product should not be forced into Structure 1.

The evidence/scenario variant is the stronger next candidate, but it is **not ready to ship**. The next isolated iteration should first make its cover and body voice consistent, verify feature-to-action claims and remove outcome guarantees. Use short worked decisions—such as choosing a paper sample to compare feel, or choosing buffer time according to preparation needs—rather than replacing every weak statement with “be flexible.” Preserve output layout requirements throughout repairs.

Separately repair and test Structure 1's list/body contract and repair behavior. Do not weaken line limits just to count invalid copy as success. Validate sibling delivery behavior before deciding whether that batch contract should change.

Discard the tested mandatory shared lesson stage as a release candidate. Redesign educational planning without a compulsory feature, and let scenario planning report “no supported connection” instead of inventing one. Only promote an additional planning call if a matched trial shows clearer practical takeaways and stable delivery.

The proposed 70% blinded human preference gate has **not** been measured. This pilot establishes concrete problems and promising changes, but no audience watch-time, likes, saves or view improvement. Those require a separately authorized publishing comparison.

## Evidence and public feature sources

- Full prompts, provider IDs, outputs, failures and accepted plans: [provider evidence](carousel-copy-comparison-provider-evidence-2026-10-12.json).
- Counts, batch timings, tokens, repeated slides and rejected-draft validation: [metrics](carousel-copy-comparison-metrics-2026-10-12.json).
- Accepted stories and initial rejected Structure 1 drafts: [all copy samples](carousel-copy-comparison-samples-2026-10-12.md).
- Public feature references: [UGCPilot](https://getugcpilot.com/), [Cal AI](https://www.calai.app/), [Calendly scheduling](https://calendly.com/scheduling), [Calendly buffers](https://calendly.com/help/how-to-use-buffers), [Calendly meeting limits](https://calendly.com/help/how-to-set-meeting-limits), [MOO business cards](https://www.moo.com/us/business-cards).

The saved [test harness and source manifest](../scripts/audits/carousel-copy-comparison-2026-10-12/README.md) preserve the experiment setup. Original working scripts and isolated snapshots are under `.tmp/carousel-quality-experiment-2026-10-12`. Reports remain local. No application flow has been implemented or deployed by this trial.
