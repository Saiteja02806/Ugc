# Live carousel text quality audit — 12 October 2026

Fresh generation reproduced serious problems. Structure 1 returned no accepted batches in this sample; Structure 2 delivered all requested text plans but accepted unsupported personal outcomes and repetitive storytelling. Neither result establishes TikTok retention or audience approval.

## What was actually tested

- Real OpenAI requests, using the existing `gpt-4o-mini` provider, not mocked responses or hand-written slide text.
- Three public business briefs: UGCPilot, Cal AI and Calendly. Each received ten fresh creative briefs from the existing brief planner. The same briefs were used for both structures.
- Two five-carousel batches per business per structure: **60 requested carousels**. Each accepted carousel has six slides. Both allowed Structure 1 batch attempts and its isolated repairs were exercised; Structure 2 used its existing validation, measured copy-fit and repair rules.
- Controlled format rotation: ten Structure 1 formats of its fifteen-format library, and all eight Structure 2 formats. No performance multipliers or hook-template overlays were supplied. This tests baseline generation, not a performance-weighted selection experiment.
- Existing deployed source snapshot `9e3a1306cafb431c4af4ddc470e30b0f068f6fd6`, extracted without changing the current checkout. Structure 1: `llm-carousel-planner-v50-single-statement-social-hook`; Structure 2: `llm-carousel-structure-2-writer-v23-actionable-copy-repair`; brief planner: `carousel-content-plan-creative-briefs-v6-item-context-concept-lanes`.
- The latest completed production planner metadata checked before the run reported Structure 2 v23 and `gpt-4o-mini`. Pending local typography changes were deliberately excluded from this deployed-source test.
- Run: **09:23:39–09:27:21 UTC**, or **14:53:39–14:57:21 India time**, 12 October 2026. Elapsed: 221.648 seconds, with the three businesses running independently.

The isolation harness calls the actual planner functions and real provider. It does not invoke the authenticated hosted job endpoint, store generated plans in production, allocate images, render finished carousels, or publish posts. Copy measurement ran on Windows; production's Linux font environment was not reproduced. The harness supplied earlier accepted visible copy as history, with Structure 2 story text carried in the history `subtext` field rather than the worker's `headline` field. In-batch history is produced by the unmodified planner. These differences limit conclusions about exact hosted layout and historical duplicate detection; they do not account for the independent word-length, lowercase grammar, or unsupported testimony findings.

Public brief sources: [UGCPilot](https://getugcpilot.com/), [Cal AI](https://www.calai.app/), [Calendly scheduling](https://calendly.com/scheduling). The briefs expressly supplied no personal success story or customer testimonial. Cal AI's brief also included its variable photo accuracy. All fixtures, actual request messages, responses, provider IDs and timestamps are preserved in the evidence file.

## Measured generation results

| Business | Structure 1 accepted / requested | Structure 2 accepted / requested | S2 accepted after copy repair | S2 freshness warnings |
|---|---:|---:|---:|---:|
| UGCPilot | 0 / 10 | 10 / 10 | 1 | 0 |
| Cal AI | 0 / 10 | 10 / 10 | 2 | 4 |
| Calendly | 0 / 10 | 10 / 10 | 1 | 0 |
| **Total** | **0 / 30** | **30 / 30** | **4 / 30** | **4 / 30** |

“Accepted” means the existing text planner returned a valid plan. It does not mean publication occurred or that the copy passed this editorial review. Structure 1's result is a batch outcome: one failed candidate can reject all five. It does not establish that every individual draft failed independently.

All **37 provider requests returned HTTP 200**, with completion and request IDs. There was no observed provider authentication, availability or HTTP failure. The split was three shared brief requests, 24 Structure 1 requests (12 initial batch calls and 12 isolated repairs), and ten Structure 2 requests (six initial batches and four copy repairs).

Two Structure 2 batch responses finished at the token limit. The existing envelope-recovery logic recovered the two batch payloads; their ten plans subsequently passed validation, with two Cal AI copy repairs. A successful recovery in this run does not guarantee recovery of a future response missing slide content.

Actual provider usage was **270,765 prompt tokens + 68,082 completion tokens = 338,847 tokens**. This includes retries and repairs. It is not a per-carousel cost estimate.

## Structure 1: useful intent, unreliable delivery

All six requested batches failed after both permitted attempts. The recorded failures include body copy below the minimum word count, lowercase openings treated as grammar errors, list/cover line-budget failures, repeated headline/body ideas, and grounding mismatches. Longer retries did not produce an accepted batch in this sample.

A confirmed internal conflict exists in the tested source:

- `worker/src/lib/carousel-text-presentation.ts` asks for lowercase conversational body copy.
- `worker/src/lib/carousel-llm-slide-plan.ts`, the grammar check around line 1602, rejects a lowercase initial letter on a body after slide 1.
- The real generated drafts followed the lowercase instruction and received grammar failures. This conflict is also present in the current local source at the time of this audit; it was not repaired here.

This is one cause, not the sole cause. Body-length and other failures remain even if lowercase handling is corrected. Some line-fit results may differ in the production font environment; the text-length and prompt/validator conflict do not depend on font measurement.

The rejected drafts show why Structure 1 is still worth preserving. Calendly's list included defining working hours, sharing a booking link and adding meeting buffers. Cal AI's comparison differentiated photographing a meal from scanning a packaged-food barcode. Those give the reader usable choices. However, other drafts ended in generic encouragement, promised engagement growth without evidence, or said “swipe for more” on the final slide. The current sampled implementation did not deliver this teaching potential reliably.

For automatic plan-aware rotation, the worker can take over a failed Structure 1 batch with Structure 2 after two unsuccessful attempts. That takeover was intentionally not invoked in this comparison; it would obscure whether Structure 1 succeeded. It only applies when the production recovery prerequisites are met. This test supports that takeover as a plausible explanation for an imbalance toward Structure 2, but does not prove which historical production batches took that path.

## Structure 2: readable stories with weak evidence and payoff

I read all 30 accepted stories, including all 180 slides. The judgments below are editorial assessments, not model scores or measured audience reactions.

| Quality dimension | Observed result |
|---|---|
| Recognizable reader problem | Often useful: scheduling emails, back-to-back meetings, blank-page pressure, and choosing a meal input method. |
| Clear progression | Consistently readable problem → realization → product → claimed improvement → takeaway. |
| Practical payoff | Inconsistent. Some product mechanisms are concrete; many reframes and endings say to be flexible, use tools or improve a mindset without a specific next step. |
| Credibility | **All 30 stories contain unsubstantiated first-person after-use results**, despite no supporting testimony in the briefs. |
| Variety | No exact duplicate slides-2–6 sequence within a business in these 30 stories. Nevertheless, four Cal AI plans were accepted with recent-repetition advisories. |
| Difference between formats | All 30 slide-3 reframes begin with “I realized”, “I learned” or “I discovered”; 13 covers begin with “i thought”. Eight format IDs do not produce eight clearly distinct reading experiences in this sample. |

Specific examples from the accepted copy:

1. **UGCPilot, batch 1, slot 4:** “My engagement has improved, and I feel fulfilled.” The input supplied no engagement results. Batch 2, slot 3 similarly claims increased engagement. Both passed without a claim warning.
2. **Cal AI, batch 1, slot 0:** “Now, I never miss logging a meal anymore.” This is an invented absolute personal outcome. Batch 1, slot 2 and batch 2, slot 2 refer to “accurate data”, while the provided description warns that photo estimates vary. Those stories discuss variability earlier but fail to carry the limitation into their product benefit and proof.
3. **Calendly, batch 1, slot 3:** “Now, I save hours each week on scheduling tasks.” No personal time-saving evidence was supplied. Other accepted copies claim significantly fewer conflicts or improved productivity without proof.
4. **A stronger mechanism:** Calendly's batch 1, slot 4 identifies meeting buffers as the way to create preparation gaps. It gives the reader a concrete product concept. Its claim that the narrator's stress decreased still needs real evidence or different framing.
5. **Thin payoff:** UGCPilot's batch 2, slot 2 concludes with finding tools to simplify planning; it does not give an example of a small change to make. Cal AI's batch 2, slot 1 offers photo/barcode entry, but its “in seconds” claim is not supplied by the brief.

The tested unsupported-claim validator detects certain numeric claim patterns; it does not verify that a narrator experienced the claimed improvement. Plain-language outcomes such as improved engagement, reduced stress and saved hours can therefore pass. First-person story rules create pressure to invent a narrator, while the available context contains no testimonial evidence. First-person wording itself is not proof of fabrication; the unsupported presentation of a completed personal outcome is the issue.

Recent repetition is explicitly advisory in Structure 2. It can flag similar copy and still return an accepted plan. This run reproduced that behavior on four Cal AI stories. The absence of exact duplicates in a small fresh sample does not invalidate the separate prior production finding of duplicated bodies.

## What the evidence supports

Structure 2 is more reliable at returning validated text in this sample, but it is not established as better TikTok content. Its relatable problems may encourage a first swipe; the predictable product-success pattern, weak takeaways and unverifiable outcomes are reasons a reader may lose interest or trust. That is an editorial inference, not retention data.

Structure 1 offers more opportunity for useful lists, comparisons and checklists, but the tested pipeline blocks delivery. Comparing engagement between structures now would confound writing quality with validation failure and automatic takeover.

Before a fair audience experiment, the priority is to align Structure 1's prompt and validation, preserve its format-specific practical value, ground Structure 2's claims in supplied evidence or use clearly hypothetical situations, and require a concrete payoff. Copy diversity should be evaluated by its meaning and lesson, not only format IDs or exact string differences. These are proposed fixes; no runtime changes were made for this audit.

This is a small sample of three software/app businesses, with two batches per structure, not a statistically representative test of all industries or all fifteen Structure 1 formats. To determine actual audience preference, publish comparable approved examples and measure views alongside completion, swipes, saves and engagement when those measurements are available. This test did not publish posts, collect new social analytics, or test view-based recommendation behavior.

## Evidence files

- `docs/carousel-live-text-quality-metrics-2026-10-12.json`: per-business counts, token usage, warnings and failure messages.
- `docs/carousel-live-text-quality-samples-2026-10-12.md`: all accepted Structure 2 stories and all first-attempt Structure 1 drafts, explicitly labeled as rejected batches.
- `docs/carousel-live-text-quality-provider-evidence-2026-10-12.json`: public business fixtures, exact provider prompts and responses, both attempts, repairs, validation results and real request/completion IDs. Credentials are not included.
- `.tmp/carousel-live-copy-audit-2026-10-12/run.mjs`: isolated live-test harness; `.tmp/carousel-live-copy-audit-2026-10-12/analyze.mjs`: deterministic report exporter. These did not alter application runtime source.

No application code, database record, customer feed, image allocation, social post or deployment was changed by this test. The new evidence and reports remain local.
