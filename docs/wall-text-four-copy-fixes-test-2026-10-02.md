# Wall-of-Text: four specific writing corrections

Date: 2026-10-02. Status: implemented and tested locally; not deployed.

## Outcome

The final focused sample passed the four requested checks. All 38 written
cards passed the existing server validation, and editorial review found no
return of the specified jargon, empty added sentences, mandatory editing from
"may need editing," or simultaneous publishing inferred from account support.
The messages are easier to understand in this review. This is a sample-based
finding, not proof of comprehension by real users or elimination of every
possible form of AI slop.

No additional reviewer, fact-clarity gate, user approval screen, or model stage
was introduced. Existing posting approval is preserved when the facts require
it. Reuse of core facts across different posts is not treated as a defect.

## Exact changes

1. Planner and writer explicitly translate "inconsistent posting cadence" into
   struggling to post regularly or posts not following a regular schedule.
   They must not explain the phrase and then print the original jargon again.
2. Remove a sentence when deleting it loses no useful information, including
   empty openings. Use one sentence for a simple problem or capability; use a
   second only for a different supported detail or condition. Do not describe a
   situation and then restate the same point as a separate conclusion.
3. Keep each action's qualification separate. "Drafts may need editing" stays
   possible; "posts require approval" stays mandatory. When both are in the
   source, both must appear, even if an older private plan mentions only one.
   Explicitly required editing is not weakened, and approval is not invented.
4. Multiple-account support is not evidence of simultaneous publishing, bulk
   posting, one-click publishing, or publishing the same post. A fact that only
   says account support is not evidence of publishing itself. Explicitly
   supported publishing and timing can still be described.

The existing concrete examples remain, with additional weak/preferred pairs
for these exact failures. Instructions operate inside the existing requests,
not through a separate reviewing call. Representative examples and focused
tests follow the official
[OpenAI prompting guidance](https://developers.openai.com/api/docs/guides/prompt-engineering).

Implementation:

- `worker/src/lib/wall-text-content-plan.ts`: planner V19; shared clarity rules
  and examples used by both initial planning and targeted plan repair.
- `lib/trending/wall-text-content-plan.ts`: app planner version synchronized.
- `lib/trending/wall-prompt.ts`: writer V30; wording and qualification rules,
  examples, and editing instruction.
- `lib/trending/generate-trending-wall-text-ideas.ts`: the writer's system
  message reinforces these same four requirements.
- `lib/trending/wall-text-content-plan-schema-contract.test.ts`: version
  assertions updated. No schema change.

## Final live-model test

The local harness called the existing planner and writer with the configured
`gpt-5.6-luna` model. Network requests were restricted to the model API. There
were no production database reads or writes during this test: account inputs
came from the previously saved production snapshot. Source hashes prevent
mixing results from different prompt revisions.

| Test group | New planning ideas | Written cards accepted |
| --- | ---: | ---: |
| Replay of relevant saved account inputs | — | 17 / 17 |
| Four approved synthetic contexts, three samples each | 40 | 12 / 12 |
| Meaning and wording probes with flawed private drafts | — | 9 / 9 |
| Total | 40 | 38 / 38 |

The account replay selected five irregular-posting facts, six daily-content
facts, five required-approval facts, and one multiple-account fact. In the
previous V29 replay, four of the five irregular-posting posts still printed
"cadence". In the final V30 replay, none did. These use the same saved facts
and private plans, but are not repeated statistical A/B trials.

The fresh contexts use different businesses and details from the instructional
examples: independent music teachers, NoteBridge with five monthly drafts,
ChannelDesk, and HarbourLoaf with a 3 pm deadline and different pickup hours.
The complete 40-item plan and all 38 final messages were read, not merely
checked for keywords. The nine probes include genuine mandatory editing,
genuine simultaneous publishing, optional editing without approval evidence,
account support without publishing evidence, and an older draft that omitted
required approval.

Final checks:

- Zero "cadence" occurrences in emitted planning/private-writing fields or
  final messages. The original approved source wording is unchanged.
- All six final draft messages with possible editing retained "may". All five
  of those whose source also required approval retained that requirement.
- All ten qualified planning ideas and their supported angles retained both
  possible editing and required approval.
- No unsupported simultaneous, bulk, single-click, or one-account-at-a-time
  comparison in the multiple-account samples.
- Genuine mandatory editing and genuine simultaneous publishing survived the
  positive controls. No approval or publishing was invented in their negative
  controls.
- The old empty opening/conclusion patterns were absent. All simple-fact
  messages used one sentence; the nine two-sentence messages added draft
  conditions or the bakery's pickup details rather than a restated conclusion.
- Accepted copy was 24–35 words, with five to eight measured lines, unchanged
  Arial Bold at 50 px. No final candidate exhausted repair.
- Thirteen model requests in the final run used only the existing planner and
  writer schemas. Extra requests were existing writer repairs, not a new
  reviewer or quality-control stage.

## Representative actual output

Saved irregular-posting input, previous V29 output:

> Recent posts may appear on scattered days instead of following a regular
> schedule. For a SaaS founder or marketing manager, that is an inconsistent
> posting cadence.

Same saved input, final V30 output:

> A SaaS founder may review recent posts and see that they appeared on scattered
> days, showing an irregular pattern rather than a regular schedule for sharing
> content.

Saved multiple-account input, final V30 output:

> UGCPilot supports more than one Instagram account, so a marketing manager
> responsible for several accounts can use the service with more than one of
> the accounts they manage.

Probe with an older draft that omitted approval, final V30 output:

> Freelance writers using NoteBridge’s free plan can turn their notes into up to
> five draft posts each month. The drafts may need editing, and a person must
> approve every post before publication.

Empty-conclusion probe, final V30 output:

> HarbourLoaf accepts online sourdough orders by 3 pm for next-day pickup from
> Tuesday through Friday. Pickup is available from 9 am to 1 pm.

The second sentence supplies a real pickup window. It does not add a vague
sentence about a "clear place in the daily routine."

## Intermediate failures and corrections

Results from earlier trials have not been discarded or counted as final passes.

- The first trial accepted 36/37 cards. It still produced two empty openings;
  one multiple-account card exhausted layout repair. The deletion instruction
  was made explicit for openings, with a matching example.
- The next trial accepted 36/37 cards, with another multiple-account layout
  exhaustion. Some simple facts still received a scene followed by a repeated
  conclusion. The prompts now explicitly request one sentence for such facts.
- The following trial accepted 37/37 cards but one qualified draft message
  omitted mandatory approval. Both prompts and the writer system message now
  explicitly require possible editing AND required approval when both exist
  in the source. A regression probe repeats that exact omission in its old
  private draft.
- The final revision accepted 38/38 cards and passed the targeted checks above.

No font, line range, word limit, repair budget, deterministic checker, data
contract, or UI was changed to obtain these results. Generation variability
remains; intermediate layout failures cannot be treated as proof that future
generations will never fail.

## Regression validation

- Worker TypeScript build: passed.
- App Wall regression suite: 161/161 passed.
- Writer behavior, persistence, reading-budget, and condition-handoff suite:
  13/13 passed on the final successful run.
- Worker planner and job suite: 22/22 passed.
- Total: 196 passing regression checks.
- Targeted ESLint and scoped `git diff --check`: passed.

One repeat regression run reported a failure of the grounding-persistence test
process. That test passed when rerun alone, and the complete 13-test suite then
passed without source changes. The cause of that isolated process failure was
not established; it is not silently counted as a successful run.

## Limits and release scope

This correction changes prompt text, examples, prompt-version constants, and
their contract assertion. The existing fact snapshot, selected-fact handoff,
200-item target, ten-item chunks, model selection, layout, safety checks,
posting approval, and legacy reviewer routing remain intact. Existing saved
content is not rewritten. Unrelated worktree changes were preserved.

The final test generated 40 new V19 planning ideas, not a new full 200-item V19
plan. The previous full-plan test used V18 and is documented separately.
Regex indicators supplement the editorial review; they do not establish
semantic correctness. Some one-sentence posts can still be wordier than a
human editor would choose. No normal-user comprehension study was performed.
No production deployment or production-domain acceptance test was performed.

Local evidence supports these narrow prompt corrections without adding a new
workflow. It does not justify saying every future output is guaranteed clear
or that all AI slop has been eliminated.

## Reproducibility

Ignored local artifacts are under `.tmp/wall-four-copy-fixes-2026-10-02/`:
`evaluate.mjs`, `replay-final-v3.json`, `fresh-final-v3.json`,
`probes-final-v3.json`, `audit-results.mjs`, and `summary.json`.
Earlier rounds remain alongside them. Raw drafts, model usage, source hashes,
accepted layouts, and terminal failures are captured there. The account input
snapshot is not included in this report or staged for publication.

Run from the project root with the existing local key; do not print credentials:

```powershell
node --env-file=.env.local --import ./scripts/next-server-only-test-loader.mjs --experimental-transform-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON .tmp/wall-four-copy-fixes-2026-10-02/evaluate.mjs replay final-v3
node --env-file=.env.local --import ./scripts/next-server-only-test-loader.mjs --experimental-transform-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON .tmp/wall-four-copy-fixes-2026-10-02/evaluate.mjs fresh final-v3
node --env-file=.env.local --import ./scripts/next-server-only-test-loader.mjs --experimental-transform-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON .tmp/wall-four-copy-fixes-2026-10-02/evaluate.mjs probes final-v3
node .tmp/wall-four-copy-fixes-2026-10-02/audit-results.mjs
```

Existing result files resume recorded work; delete nothing to rerun. Start a
separate round/result file for another independent generation or prompt change.
