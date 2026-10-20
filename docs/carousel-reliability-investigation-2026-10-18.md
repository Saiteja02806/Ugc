# Carousel planning reliability — 18 October 2026

The reproducible bottleneck is the Helpful Tips planner's coupling of visible
copy to hidden image-description metadata. A failed description used to abort
shape parsing, trigger a rewrite of the whole six-slide plan, and then disappear
behind an aggregate job error. Repeated replacements amplified the model work
and held the two generation-worker slots. This investigation fixes that path
locally; it does not establish that every historical failure had the same cause.

## Production evidence

Read-only investigation of the reported account found 110 automatic candidate
attempts: 65 completed and 45 failed. Helpful Tips accounted for 44 failures out
of 75 attempts; Product Stories accounted for one failure out of 35 attempts.
Sixty completed candidates were assigned across three daily packs. The current
pack has all 20 positions ready; the first pack has 18 ready and two decided.
Completed candidate counts include inventory beyond the final assigned pack.

Across candidates created since 16 October for the 17–18 October content days,
Helpful Tips had 160 failures and 210 successes (43.2% failed); Product Stories
had 29 failures and 196 successes (12.9% failed). These are candidate-attempt
rates, including replacement work, not percentages of users with broken packs.

For the reported account's failed candidates:

| Count | Durable evidence |
| --- | --- |
| 5 | The old batch envelope returned invalid/duplicate numeric slot indexes. |
| 1 | Product Story hook/story exactly duplicated recent accepted copy after repair. |
| 39 | Only the generic batch error was retained. No normalized plan, validation details or slides survived. |

The latest five-candidate batch retained two completed decks and three failed
Helpful Tips. Logs show both completed decks passing all six text-containment
checks before the generic batch failure. The successful records already use
Helpful Tips v58: the fixed output-position keys are deployed. They removed an
older failure mode but did not address the metadata/repair coupling.

Infrastructure evidence:

- Supabase health advisor returned no findings. Performance advisories include
  existing unindexed foreign keys; there is no evidence they explain these
  content-admission failures, and no unrelated index changes were made.
- The Carousel worker is ready, with 100% traffic on
  `ugc-carousel-worker-publish-a493dbd6`, a 300-second timeout, concurrency one
  per instance and maximum two instances.
- The queue is RUNNING, with maximum two simultaneous dispatches and one
  dispatch per second. Its retry policy is not evidence that every content
  failure gets five new model attempts; application settlement is separate.
- This account's successful generation jobs averaged 64 seconds running and
  46 seconds queued; failed jobs averaged 78 seconds running and 26 seconds
  queued. There is no timeout evidence in the inspected failures.
- All 30 hosted slide-image URLs in the latest five completed decks returned
  HTTP 200 with image content types. All 65 completed records have six ready
  slide rows (390 total).

## Reproduction and root cause

An isolated live run used the existing fictional CampaignFlow business fixture,
not customer inputs. All five provider requests returned HTTP 200 with normal
`stop` finish reasons. Nevertheless, only two of five plans passed.

Four initial plans contained image-description terms rejected by the existing
object-only rule. Examples included an actual team around a screen, but also
metadata such as "a feedback form ... inviting team input". The current policy
rejects human-subject words even in labels. This fix retains that policy.

The problem was how the planner handled the rejection:

1. One model request writes five independent six-slide decks, including copy,
   format roles, factual grounding, word-array bodies and image descriptions.
   The synthetic request was 12,668 prompt tokens before writing any output.
2. `parseCarouselContentPlanShape` threw on the first unsafe image direction.
   The resulting `invalid_plan` had no slide number. Later offending directions
   were not reported in that pass, even when all visible copy was usable.
3. Since parsing failed, the repair path had no parsed baseline to freeze.
   It requested a complete plan rewrite. In the reproduction, one repair fixed
   a description on slide four but left an unsafe description on slide five.
   Three candidates still failed after their rewrites.
4. Parse/merge errors in repair responses escaped before the existing second
   validation-repair branch. A malformed response therefore did not receive
   the intended second scoped attempt.
5. Partial planning retained valid siblings, but exposed failed siblings only
   through an error message. The runtime wrapped that failure in an
   `AggregateError`, and the job wrapper persisted the aggregate text to every
   unfinished row. Neither the specific issue nor the provider output survived.
6. Feed reconciliation then reserved replacement batches for the missing
   inventory. Existing bounds prevent an infinite loop, but the same coupled
   planning/repair path can spend the recovery budget repeatedly. Increasing
   retries or worker count alone would increase cost without fixing admission.

This explains the synthetic failures directly and is a plausible contributor
to the production Helpful Tips failure concentration. The exact cause of the
39 historical generic failures cannot be recovered from absent evidence.

## Local correction

Helpful Tips planner version advances to v59. The model, content rules, image
catalogue, rendering, entitlements, ownership, daily allocation and replacement
budgets retain their existing contracts.

- Batch parsing can collect visual issues without admitting the plan for
  publishing. The full publishing validator then reports every unsafe image
  direction as `unsafe_visual_direction` with its actual slide number.
- Scoped repair returns only `imageDirectionsBySlide` for those slides. Mixed
  image/body failures can request both exact field groups. Visible copy, roles,
  facts, grounding and valid siblings remain frozen and are revalidated.
- Malformed repair output uses the existing second-attempt budget, retaining
  the original scope and naming the shape failure. Provider errors and empty
  responses do not enter that extra shape-repair branch.
- Each failed plan now carries its original issues, final issues, slot index
  and initial/repair response evidence. The worker persists those details on
  that owned generation and marks its experiment assignment failed before
  job-level settlement. The wrapper preserves already failed causes, consumes
  completed siblings and releases only unused reservations.
- Logs identify candidate/stage/issue codes/slide numbers without logging the
  private provider response. Raw responses remain in the existing server-side
  generation diagnostics fields. No schema migration is needed.

## Controlled before/after result

The exact initial synthetic provider output was replayed unchanged. Only the
repair requests used the modified code and live model calls.

| Metric | Existing repair path | Modified repair path |
| --- | ---: | ---: |
| Completed decks | 2/5 | 5/5 |
| Repair requests | 4 full-plan rewrites | 4 metadata-only patches |
| Repair elapsed time | 25.665 seconds | 5.752 seconds |
| Repair input + output tokens | 25,721 | 7,474 |
| Repair output tokens | 2,352 | 191 |

The measured repair-token reduction was 70.9%, and repair latency fell 77.6%
in this one controlled run. This is neither a production success-rate claim
nor evidence that all future model responses will pass. Unsafe patched
directions, unsupported claims, exact duplicates and measured overflow remain
blocking. No customer data was sent to the model in this investigation.

## End-to-end boundary checks

The traced story is onboarding/profile → reserved content briefs → owned
five-item worker job → model output → parsing/validation/repair → approved
image reservation → rendering/storage → assignment/reconciliation → Trending.

| Boundary | Evidence and limit |
| --- | --- |
| Profile/brief/job ownership | Original production account/profile/day/job lineage inspected; no missing provenance errors in the inspected failures. |
| Queue/worker delivery | Production service/queue ready; inspected jobs reached the worker. |
| Model → admitted plan | Captured synthetic baseline reproduced 2/5; exact initial-output replay with scoped repair passed 5/5. |
| Planning failure → job settlement | Integration regression preserves slot-specific diagnostics and reservation handling through the real job wrapper. |
| Plan → actual renderer | All 30 repaired slides rendered successfully at 1080×1080 and 1080×1350, 60 actual renders with the production fonts and containment checks. |
| Storage/delivery | 30/30 sampled existing production slide URLs accessible; all completed account generations have six ready rows. |
| Reconciliation/readiness | Feed/recovery regressions passed; production slot counts confirm the account's complete daily packs. |
| Authenticated production UI with the new worker | Pending deployment; not claimed as verified. No customer session was impersonated and no production generation was triggered. |

Verification: worker TypeScript build passed; 103 focused worker tests,
17 feed/readiness/database recovery tests, and two planner/job settlement tests
passed (122 tests). The worker suite includes the 60 actual renders above.
The captured fixture contains fictional business copy only.

Reproduce without a provider call using the worker test suite. An optional
synthetic live probe is `node scripts/audit-carousel-planner.mjs --live` after
building the worker; it spends model tokens but never reads customer data,
enqueues jobs, uploads assets or changes production records. Full traces stay
under ignored `.tmp/carousel-planner-audit/`.

## Release and acceptance

These corrections are local. Production still serves the inspected revision.
Deploy the Carousel worker with v59, then inspect a fresh owned production
pack: verify all reserved slots, actual six-slide outputs, v59 provenance,
candidate validation stages and failure rates. Measure candidate and final-pack
success separately. Historical failed rows cannot gain missing diagnostics
retroactively. Existing completed/decided posts must remain intact.

Do not automatically replay historical customer work or enlarge the recovery
budget to demonstrate acceptance. No production content, configuration,
subscriptions, schedules, migrations or deployments changed in this work.
