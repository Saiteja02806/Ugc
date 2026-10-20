# Controlled Wall writing experiment — 26 September 2026

## Conclusion

The recommendation needs one important priority adjustment: resolve pressure to pad simple facts before relying on examples or additional retries. Examples alone did not reliably solve repetition under the current 24-word minimum. Flexible length produced more concise, useful copy in this small test, but it is not compatible with current production rules as-is. A semantic reviewer was useful, not infallible.

No application code, prompt, database, or deployment was changed. Only an isolated experiment and this report were created.

## Method

- Six fixed, complete facts: approval before publishing, confirmation email, bakery ordering/pickup restrictions, limited monthly drafts, founders' posting difficulty, and description-based idea generation.
- Two runs per condition: 36 generated messages, 12 per condition.
- Current configured writer model and reasoning settings, also used for the independent review calls. Actual settings are recorded in the raw results.
- Current condition uses the actual current prompt builder and writer system instruction.
- Examples/24 condition adds bad-to-good examples and removes the stale visible-business-anchor system wording, retaining the 24–48-word range.
- Flexible condition uses that same revised instruction package, but allows fewer than 24 words and overrides the minimum-line instruction for generation. It retains a 48-word ceiling. Thus it tests removal of minimum-length pressure as a package, not word count alone.
- No private planner fields were supplied: this deliberately isolates writing from planning. All conditions receive the same complete facts. Extraction, source capture, fact-schema changes, deduplication, and 200-item planning changes were not implemented or tested here.
- A separate model call reviewed interleaved outputs without condition labels, scoring standalone clarity, absence of repetition, and factual fidelity. This is not a human-reader study or an unbiased objective quality score.
- All generated messages were independently measured using the existing layout/render-fit code. This is not the complete production acceptance pipeline; layout success is distinct from word-policy or semantic acceptance.

## Initial results

| Condition | Samples | All three model-review criteria passed | Measured layout passed | Existing 24–48-word policy passed |
| --- | ---: | ---: | ---: | ---: |
| Current instructions | 12 | 3 | 11 | 12 |
| Concrete examples, still minimum 24 words | 12 | 4 | 12 | 12 |
| Same examples, flexible minimum length | 12 | 10 | 11 | 1 |

All 36 were rated understandable by the reviewer. The failures were principally repetition and unsupported additions, not incomprehensible vocabulary. Do not interpret 3/12 as meaning nine current messages were impossible for people to understand.

Average lengths were 26.9, 25.0, and 16.9 words respectively. The small sample does not establish production success rates or statistical significance.

### Actual examples

Current:

> ContextDraft reads the business description and suggests content ideas from the details included there, so its suggestions are based on the information provided in that description.

Examples, minimum 24 words:

> ContextDraft reads a business description and suggests content ideas from the details it contains, so the ideas are tied to information in that description.

Flexible minimum:

> ContextDraft reads the business description and suggests content ideas based on the details it contains.

Both longer examples repeat the same point. The shorter example retains it without the repeated clause.

A longer fact still required a fuller sentence:

> On the free plan, freelance writers can create up to three draft posts each month from their notes, though the drafts may need editing.

This flexible-condition output used 24 words and retained the free-plan limit, quantity, frequency, source, and editing qualification. The intended rule is “use enough words for the meaning,” not “always write less.”

## Reviewer controls and retries

Four control cases were included without labels:

1. Approval fact contradicted by “published without human approval”: rejected for factual contradiction.
2. Email timing repeated twice: rejected for repetition.
3. Next-day pickup without the supplied deadline and pickup restrictions: rejected for missing conditions.
4. Clear, faithful email statement: accepted.

All four control expectations were met. This narrow control set does not prove general reviewer reliability.

The eight failed examples/24 outputs each received one targeted rewrite attempt with the review feedback and the same 24–48-word instruction. Three rewrites passed model review; two of those were only 11 and 22 words, outside the required range. Only one passed model review, word count, and measured layout together. Five still failed model review.

Manual inspection also found calibration concerns: the reviewer accepted a repair beginning “Because SaaS founders must divide their attention between building and managing their products,” though the source fact did not explicitly establish that cause. It also accepted some approval wording that could blur human approval versus automated publication after approval. Therefore reviewer approval must not be treated as proof of factual accuracy.

## What to implement or investigate next

1. Preserve complete selected facts and their conditions. This experiment assumes good facts; it does not prove extraction is fixed.
2. Test and agree on flexible minimum-length/layout behavior for simple complete thoughts. Eleven of twelve flexible outputs violate the current minimum word policy, and the nine-word approval sentence fails the current minimum-line layout. A prompt-only change is insufficient.
3. Keep specific writing examples, but do not rely on examples to overcome contradictory length requirements.
4. Extend final semantic review to fact-based outputs with precise rejection reasons. Calibrate against both good and bad examples and retain deterministic checks.
5. Retry only failed messages; recheck the rewritten text for factual meaning, word policy, and measured layout. Do not silently publish failed rewrites.
6. Then implement and test planner coverage separately, followed by a full 200-item run and actual-reader evaluation. This experiment does not validate the full recommended architecture.

The current one-fact restriction plus a hard length floor leaves little legitimate material with which to expand a short fact. If the product must always show longer Wall text, a separate design option is to provide genuinely supporting information for one coherent point. Inventing examples, consequences, or conditions merely to fill space is not acceptable.

## Verification and artifacts

Business Context tests and the Wall test command (including its behavior posttest) passed again. These are software regression checks, not comprehension measurements.

- Experiment: `.tmp/wall-clarity-review/controlled.mjs`
- Raw outputs, reviews, controls, and repairs: `.tmp/wall-clarity-review/controlled-results.json`
- No production reads or writes; only model API requests and local artifact generation.
