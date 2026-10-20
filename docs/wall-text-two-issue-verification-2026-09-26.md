# Two agreed changes: implementation and verification

## Scope

Implemented only the agreed changes: allow one or two useful planning sentences, and improve preservation of conditions from Business Context to the final writer. Final Wall word limits, font, layout, reviewer routing, 200-item target, database schema, and historical content are unchanged. No deployment or production data changes.

Planner V17 replaces the 8–14-word rule with one or two sentences, a 60-word ceiling, and the existing 400-character storage limit. Initial generation, validation, and targeted repair share this rule. Single-sentence ideas remain valid; a second sentence must add supported information.

Shared extraction instructions explicitly preserve conditions from across source sentences in each applicable claim. Writer V28 receives the immutable fact snapshot as qualificationContext alongside the selected fact, so it can retain a restriction saved elsewhere. That context may restrict the selected claim, not introduce unrelated capabilities. Fact IDs and receipts are unchanged.

## Tests

- Worker build and targeted ESLint passed.
- Business Context: 20 tests passed.
- Wall suite: 161 tests plus 11 behavior tests passed.
- New qualification-handoff tests: 2 passed; included in the Wall posttest command.
- Worker planner tests: 15 passed, including new two-sentence, short-sentence, and sentence/word-ceiling checks.
- Total: 209 tests passed. Diff whitespace check passed.
- Full app typecheck remains blocked by the existing unrelated `lib/reaction-format/generation-jobs.test.ts:64` fixture missing BackgroundJobRecord fields.

## Fresh live results

Used synthetic inputs through the real local extraction, snapshot, planner, writer, and validation functions. Five businesses produced 50 planned ideas (ten each) and 25 final Wall outputs (five per business). All five batches returned their requested outputs. There were 19 model requests including retries. This was not a full 200-item run, production acceptance test, or human-reader study.

Three additional live probes deliberately placed the condition in a separate snapshot entry from the selected fact. On the successful run, all three outputs preserved the tested conditions and passed the existing generation validation:

- Bakery: 4 pm cutoff, Tuesday–Saturday pickup, 8 am–noon hours.
- Publishing: required human approval before publication.
- Drafting: free plan, up to three drafts per month, possible editing.

Actual bakery output:

> Customers can order sourdough online for pickup the next day, as long as the order is placed by 4 pm. Pickup is available Tuesday through Saturday, from 8 am to noon.

The broader bakery run also restored pickup windows when they were absent from the selected fact but present elsewhere in the approved snapshot. This is evidence that the new handoff addresses the observed missing-condition case.

## What is and is not resolved

**Implemented and verified:** longer planning ideas are accepted and produced; conditions present elsewhere in the saved snapshot reach the writer; the tested final outputs retained important deadlines, limits, and approval requirements.

**Not fully resolved:** allowing two planning sentences did not consistently eliminate repetition. One generated plan said:

> Once the hairdresser confirms the appointment request, the client receives an email. The email follows the hairdresser’s confirmation.

The final output also repeated that point:

> When an independent hairdresser confirms a client’s appointment request, the client receives an email afterward, which follows the hairdresser’s confirmation of the requested appointment time.

Thus the two-sentence option works as implemented, but the hypothesis that it alone solves stretched wording is not supported consistently. No additional unrelated changes were made to conceal this outcome.

Extraction still sometimes separates conditions across fact entries despite the stronger prompt. The new writer handoff compensates when the condition remains in the snapshot; it cannot recover information absent from the entire snapshot. Prompt-based condition preservation is not a deterministic guarantee. Some sampled planning context also still introduces interpretations beyond the selected fact, so this run does not establish complete factual correctness.

Raw artifacts: `.tmp/wall-clarity-review/two-sentence-results-2026-09-26.json` and `.tmp/wall-clarity-review/condition-probe-results.json`. The first probe launch exited without diagnostic output; the clean rerun completed all three probes. No failed outputs are counted as passes.
