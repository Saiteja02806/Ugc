# Wall-of-Text concrete examples: implementation and test results

Date: 2026-10-02. Status: local changes tested; not deployed.

## Verdict

Concrete examples produced some clearer wording, but this test does **not**
establish that AI slop is eliminated or that every post is ready to publish.
The new prompts are a useful improvement, not a complete reliability fix.
Some accepted posts still contain filler, jargon, or altered qualifications.
An existing safety check also rejects several legitimate paraphrases.

This was an editorial review against approved inputs, not a comprehension
study with real users. Repeated core facts were not treated as a defect.
Reading speed was not an acceptance criterion.

## Changes implemented

- Planner V18 receives paired weak/preferred examples in both initial
  generation and targeted idea repair. Examples demonstrate plain wording,
  explicit actors/actions, one selected fact, and preservation of conditions.
- Writer V29 receives corresponding examples, including a stale private idea
  with an invented cause that must be discarded rather than polished.
- Examples are explicitly style guidance, never new business evidence.
  Approved facts control meaning, not exact wording.
- Both prompts perform an internal edit in the same model request. No new
  model stage, fact-normalization service, approval UI, or database field was
  added.
- The writer's higher-priority system message no longer asks for a literal
  visible business anchor. It distinguishes approved facts from fallible
  private planning text and prohibits printing editorial instructions.
- The 200-item target, ten-item planning chunks, fact snapshots/IDs, model
  settings, output schemas, word range, layout, and safety checks are unchanged.

## Test method

Read-only production input retrieval was restricted to the account requested
in the conversation. Its 30 completed recent cards use writer V28 and a saved
planner V15 plan. Their exact assigned facts, immutable snapshots, and private
ideas were replayed locally; no saved plan or production card was rewritten.

The final planner was also run for a fresh 200-item plan using that account's
current Business Context, plus ten ideas for each of six saved approved test
contexts. Twenty evenly spaced account ideas and three ideas per fixture
were passed through the actual writer and measured-layout validation.

There were intermediate evaluation rounds. The numbers below refer only to
the final writer configuration, using the final planner configuration. The
final writer run reused the already-generated, hash-matched final planner
output; it did not regenerate the 200 ideas with a different planner.

The replay used independent ten-candidate evaluation groups so that one
exhausted candidate would not prevent reviewing the other groups. These
results are per-card evaluations, not proof that a complete production
request or hosted UI passed end to end.

## Final results

| Test | Requested | Accepted by existing validators | Exhausted |
| --- | ---: | ---: | ---: |
| Same production facts and old ideas | 30 cards | 27 | 3 |
| Fresh 200-item account plan, sampled writing | 20 cards | 14 | 6 |
| Six additional contexts | 18 cards | 18 | 0 |
| Three split-condition probes and one instruction-leak probe | 4 cards | 4 | 0 |
| Total final writer evaluation | 72 cards | 63 | 9 |

- All 200 account planning items and all 60 fixture planning items were
  generated and passed the existing planning validator. This is structural
  acceptance, not a claim that all 260 ideas were editorially sound.
- All 63 accepted cards contained 24–36 whitespace-delimited words and fit
  five to eight measured lines at 50px Arial Bold.
- The explicit instruction-leak probe did not print the private instruction
  about avoiding performance promises. No such explicit claim-writing
  commentary appeared in the 63 accepted final posts reviewed.
- The direct split-condition probes retained required human approval,
  up to three drafts per month on the free plan with possible editing, and
  return timing/tags/postage/personalized-item exceptions.
- Four of the 27 accepted old-plan replays still printed the word `cadence`.
  None of the 14 accepted fresh-plan samples printed it. This is a small
  observed sample, not a statistical or human-comprehension guarantee.

## Concrete improvements

### Irregular posting without an invented cause

Saved V28 output:

> A SaaS founder may look back at recent posts and notice they appeared on scattered days. Posting only when an idea arrives can make an inconsistent cadence feel like the normal routine.

Final local output on the same fact and private idea:

> A SaaS founder may review recent posts and find them spread across scattered days instead of following a regular schedule for sharing content online.

The newer text directly explains irregular posting and drops the unsupported
explanation about waiting for ideas.

### Multiple accounts in ordinary words

Saved V28 output:

> When several Instagram accounts need attention, a marketing manager is coordinating more than one publishing responsibility. UGCPilot supports multiple Instagram accounts during that recurring publishing work.

Final local output:

> A marketing manager handling several Instagram accounts can use UGCPilot across more than one account, rather than being limited to a single Instagram account.

The newer version avoids abstract wording about coordinating responsibilities.

### Clear request/booking distinction

Final appointment fixture:

> Independent hairdressers can give clients a booking link to request an appointment time. Each request still needs the hairdresser’s confirmation before it becomes a booking.

The actor, action, and condition are understandable without the private plan.

## Confirmed remaining issues

### 1. An unclear fact cannot supply a clear, specific meaning

The approved account fact `takes long time` does not identify what takes time.
The planner selected it for 14 of 200 ideas despite the instruction to prefer
a clearer fact. Several ideas guessed marketing/content tasks.

One accepted old-plan replay became:

> For SaaS founders and marketing managers, marketing work can take a long time, so its time requirement deserves attention during planning and review cycles.

This is grammatical, but the conclusion adds little and `planning and review
cycles` is unnecessary business wording. Examples cannot recover information
that was never specified in the approved fact. The existing Business Context
review is the place to clarify the actual task; do not invent the clarification.

### 2. Examples are not a guarantee of instruction adherence

Some final planning ideas still included editorial explanations, for example:

> The application analyzes the business to create content suited to that business. The point is the business analysis behind the content, not a guaranteed marketing result.

The final writer samples did not reproduce that particular guidance as copy,
but the planning instruction was not consistently followed.

Other observed issues requiring editorial revision:

- An accepted draft fixture said `then edit and approve every post`, where
  the source said drafts **may** need editing. Approval is required; editing
  is not necessarily required. The direct qualification probe preserved
  `may`, so this is inconsistent adherence rather than a universal loss.
- A multi-account sample contrasted the feature with publishing to one
  account `at a time`. Supporting several accounts does not by itself
  establish simultaneous publishing.
- Some simple facts were padded with phrases such as `one clear format
  choice` or a repeated explanation of the same point. Core fact repetition
  is acceptable, but filler does not improve comprehension.
- Technical samples retained `encrypted` or `end-to-end encryption` without
  explaining those terms for the non-technical reader in that fixture.

### 3. Existing safety checks reject legitimate wording

All nine exhausted final candidates ended with `unsupported_business_claim`.
Eight involved the fact `Automated business analysis for tailored content`.
The checker accepts source spellings `automatic`/`automatically`, but does not
recognize `automated` as supporting those forms in a business-analysis
paraphrase. A ninth rejected ordinary language such as:

> Knowing a SaaS product well does not automatically answer the marketing question.

That sentence is not an automatic product-action claim. The check nevertheless
treats the word `automatically` as one.

These are confirmed validator false positives, separate from clarity. Some
intermediate attempts also failed layout; the nine final exhausted outcomes
were not terminal layout failures. The checker was not modified in this
prompt/examples task. Any follow-up should correct these narrow cases while
retaining rejection of unsupported automatic posting or other capabilities.

## Automated verification

- Worker TypeScript compilation: passed.
- Wall application/contract/layout suite: 161 tests passed after aligning
  the existing private-context prompt assertion with the stricter rule.
- Writer/persistence/publication/reading-budget/condition tests: 13 passed.
- Worker planner and planner-job tests: 22 passed.
- Total unique regression checks: 196 passed.
- Targeted ESLint: passed.

Automated acceptance does not check full semantic correctness or prove that
ordinary users understand a post. The examples above include issues that
passed those checks.

## Evidence and release boundary

Raw inputs, requests, model outputs, accepted layouts, failures, prompt versions,
and source hashes are in `.tmp/wall-concrete-examples-2026-10-02/`:

- `production-input.json`: owner-scoped read-only production inputs.
- `fresh-refined.json` and `fixtures-refined.json`: final planner outputs.
- `replay-final.json`, `fresh-final.json`, `fixtures-final.json`,
  `probes-final.json`: final writer evaluation.
- `read-input.mjs` and `evaluate.mjs`: evaluation harnesses.

Existing saved plans, facts, cards, and account settings were not changed.
No deployment was performed. The prompt changes are implemented and tested,
but the evidence does not support announcing that slop is solved or giving
an unconditional production go-ahead.
