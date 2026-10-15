# Slideshow delivery verification — 2026-10-15

Status: v57 language relaxation implemented and locally verified; production acceptance pending.

## User-requested language relaxation

Planner v57 records nearby word repetition, lexical grounding overlap, generic
phrasing, dictionary-based solution tone and sentence/punctuation heuristics as
advisories. Valid natural writing no longer fails solely on those signals.
Missing/invented anchors, unsupported claims, promotional Helpful tips, invalid
slide structure, actual duplicated copy, unsafe images and measured overflow
remain blocking. This explicitly supersedes the earlier blanket instruction
below against changing quality checks: the user requested this targeted change
after reviewing the false-rejection evidence.

Offline regressions accept the previously rejected repeated `to`, paraphrased
concept and `Record the missing approval` examples. A five-item synthetic batch
retains all five advisory-only plans in one request, without repair calls.
Structure 2 and saved mix allocation are unchanged. This is worker-only and
does not establish that the historical five missing slots have been delivered.

## Deployed and verified

- Website release 39288aea distinguishes queued, generating, finalizing and failed slideshow preparation.
- Queue recovery checks deterministic Cloud Task existence before spending attempts; missing-task recovery uses an owner-restricted service RPC and locked snapshot comparison.
- Migration 20261015135636_guard_missing_queued_job_recovery and queue-scoped cloudtasks.tasks.get permission are applied.
- Migration 20261015145119_defer_feed_recovery_for_active_carousel is applied. Production returned waiting_source_job while the owned source was queued/running and restored falsely failed unbound positions.
- Carousel worker revision ugc-carousel-worker-426957f5 serves 100% traffic. Its immutable image digest is sha256:ba75271c19acea7471bca8e870c05f9fa1d8e4152c4bdebcea0e568aa680dd02.
- Queue ugc-carousel is RUNNING and background recovery scheduler is ENABLED.
- Remote main contains eb8d1b927d09d3c64d113a3338cbd353083625b0. The final website deployment was still pending at the last check; the prior production website release was verified directly through its signed production audit route.

## Production acceptance failure

The five missing slots were processed by the new worker in job 221101e4-bb10-480d-afdd-ccc455ae92c8, experiment batch 1dfafea6-6358-42bf-9b4d-da67fd455445. All five generations failed validation. Reported failures include repeated copy, multiple ideas and disconnected grounding. Counted-body transport and isolated/scoped repair improvements do not establish reliable helpful-tip generation.

At 22:44 IST, the account's saved pack contained 45 decided cards and five failed positions. All 45 delivered cards were Structure 2; no Structure 1 card from this recovery was delivered. Saved preferences remain 50% helpful tips and 50% product stories with CTA. Existing reviewed cards were preserved; this historical pack cannot become 25/25 by adding only five cards.

Historical acceptance limit before v57: do not label the delivery issue solved,
regenerate the reviewed 45 cards, substitute Structure 2 into helpful-tip slots,
or silently expand retry budgets. The v57 relaxation above targets demonstrated
false rejections; reliable delivery still requires production verification.

## Validation

- Carousel contracts: 78 passed.
- Carousel worker regression suite: 70 passed.
- Scoped/count transport tests: five passed; partial job settlement: one passed.
- Queue and preparation status plus both database guards: six passed; real-task lookup unit test: one passed.
- Root typecheck and scoped website lint passed before release; worker TypeScript and cloud image builds passed.
- A separate local website build could not run in the isolated checkout because duplicate dependency installation exhausted disk space. Only that temporary node_modules was removed. The production website 39288aea built successfully on Vercel.

## Excluded concurrent work

Unrelated, ongoing Explore/media/generation changes were excluded from this scoped repair release. Exact paths and status are recorded in .codex-audits/slideshow-release-excluded-worktree.txt. Generated node-compile-cache and local audit/build artifacts were also excluded. They were neither staged nor reverted.

## Follow-up worker regression review

The exact deployed worker commit 426957f5 was rebuilt in its clean checkout; 57 planner/render contract tests, six queue/status/database-guard tests, and one partial-settlement test passed (64 total). The current Carousel worker is active, its queue is RUNNING, and recovery is ENABLED. The primary ugc website deployment for eb8d1b92 completed successfully; the separate trending-release-web project failed its build and is not the primary production site.

Production evidence at 22:46 IST: the current worker had one completed Structure 1 generation with six stored slides, 19 failed generations, and five processing generations. One partial batch preserved its one completion alongside four failures. These are worker-wide observed items, not the user's personal pack or a controlled before/after experiment. The user's pack still had 45 decided positions and five failed positions. Eighteen baseline worker jobs already reported grounding failures, so the ongoing grounding problem predates this update; this does not establish that every new failure is unrelated to the changes.

Only the Carousel worker was redeployed for this repair. The AI-generation, Carousel-edit, Reaction-render, Social-publish and Video-render services still report their a3a707bd revisions. No evidence from this check establishes a wider worker outage, but untested flows cannot be certified as regression-free. Queue recovery and partial preservation are confirmed improvements; reliable helpful-tip generation and complete daily quota delivery are not confirmed. An intermediate release introduced phrase-valued word arrays; v56 constrains individual tokens, while writing/grounding failures remain. Do not represent passing unit tests as production acceptance.

## Root-cause diagnosis — 22:54 IST

The latest owned failed job reached the worker at 22:42:31 IST and failed at 22:43:37 IST. All five associated generation rows have zero slides and no saved raw response/normalized plan/validation JSON. This is a failure before rendering, not completed content lost by the frontend. The UI has no valid assets to deliver. Recovery limits then stop further automatic attempts; requested helpful-tip slots do not fall back to promotional stories because the account mixer preserves structure identity.

The failure has several causes:

1. Genuine invalid model output: production errors include invalid slide numbers, prohibited image subjects, unsupported claims, too many sentences, repeated slide copy and content disconnected from its selected source.
2. False rejections in existing deterministic checks. An offline replay against the exact deployed worker accepted the control fixture, then rejected a grammatically sound two-sentence body solely because it used `to` twice within ten normalized words, crossing the sentence boundary. The checker discards punctuation/sentence boundaries. It also rejected `Record the missing approval ... Add a short owner comment ...` as friction rather than a solution: `missing` triggers the problem dictionary while the valid imperative verbs `Record` and `Add` are absent from the solution dictionary.
3. Lexical grounding: source alignment requires at least one exact token from the first eight filtered source words in the concept and middle slides. The replay rejected `How to stop details disappearing between apps` against `Campaign planning and reporting are scattered across tools`. That illustrates a plausible paraphrase rejected by lexical matching, not proof that every live grounding rejection is false. Weak stop-word filtering also leaves terms such as `and`, `are`, `not` in some anchors.
4. The output contract does not enforce array position. Each slide may match any of six role schemas, while the parser requires strict array order; duplicate/out-of-order slides can conform to the transport schema and fail parsing. Image direction is a free string checked only after generation.
5. Targeted repair is incomplete: shape, slide-role, historical repetition or slide-to-slide repetition failures can bypass body/scoped patching and request a full plan. This lets a repair change valid fields and introduce a new failure. Budget exhaustion then settles unfinished generations as failed. The earlier all-or-nothing failure is improved by partial sibling preservation but does not make each item valid.
6. Diagnostics gap: rejected plans are not saved on the failed generation rows; persistence happens only when a validated content plan enters rendering. Error messages are bounded/truncated, so their final text is insufficient to judge every sentence or accurately replay the full five-item request. The offline cases use synthetic data, no customer payloads and no provider calls.

The repetition, solution-classification and lexical-grounding checks existed in baseline a3a707bd. They were not all introduced by the latest repair. An intermediate 39288aea release did introduce phrase-valued counted arrays; v56 constrains the token transport, but the preexisting semantic checks and repair gaps remain. Passing structural regression tests did not cover these valid-language counterexamples or demonstrate production completion.

Correction priorities: add the valid-language counterexamples to evaluation coverage; distinguish real repeated content from grammatical function words and sentence boundaries; handle action/negative wording without a narrow verb whitelist; align grounded concepts with verified evidence without relying solely on arbitrary first-eight-token matches; constrain unique slide identities/order; repair failed fields without regenerating valid siblings; retain bounded owner-scoped rejected-plan diagnostics. Keep unsupported-claim, actual duplicated-copy, image safety, structure mix and rendering-fit protections.

Offline evidence: .codex-audits/slideshow-root-cause-offline-20261015.json. No production code or data was changed during this diagnosis.
