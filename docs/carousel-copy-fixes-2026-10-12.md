# Carousel copy fixes and fresh live tests — 2026-10-12

The local list/body mismatch is corrected, and an opt-in Structure 2 scenario
voice passed more plans in this sample. **Structure 1 is still unreliable, and
Structure 2 still needs factual and lesson-quality review. These changes are
not a complete quality solution or ready evidence for a production rollout.**

No push, deployment, production database write, customer generation job,
publication, image reservation or image generation occurred during these tests.
Existing unrelated worktree changes were preserved.

## What is implemented locally

### Structure 1: list/body contract and useful diagnostics

- Configured list slides return `body: null` and their configured `listItems`.
  The prompt and provider schema agree. The 18–30-word prose rule applies to
  non-list bodies, rather than asking list slides to repeat their list as prose.
- Older drafts can remove an exactly repeated list from `body`. Only matching
  ordered lines, optionally numbered or bulleted, are removed. A distinct
  introduction or additional advice remains and is validated normally.
- Body-length errors report the actual body word and character counts,
  excluding headings and CTA. Prose descriptions and repair guidance ask for
  complete short thoughts. Fresh tests show that guidance alone does not make
  the writer reliable.
- Current local planner version: `llm-carousel-planner-v54-body-count-feedback`.
  The earlier lowercase fix remains. No word, grounding or layout limit was
  relaxed; no padding, truncation or font shrinking was added.

These changes apply to the local default Structure 1 planner. They become
runtime changes only if this source is later deployed.

### Structure 1: experimental counted body repair

- Batch callers can explicitly select
  `bodyRepairPolicy: { version: "structure-1-counted-body-repair-v1" }`.
- If every blocking issue concerns an eligible non-list body, the existing
  isolated repair call can return two arrays of 9–12 words for that body.
  The parser rejects multiword tokens, punctuation padding and extra fields.
- Only requested body fields and their derived `subtext` are replaced. All
  other fields remain frozen. The reconstructed legacy body still passes
  through the complete existing publication validator.
- Grounding failures, claims, cover failures and other non-body failures keep
  the existing repair strategy. The repair budget is unchanged.
- Customer job callers do not select this policy. The single-plan generation
  path does not implement this batch-only repair strategy. Successful batch
  results record the policy version in planner/validation metadata.

This is an isolated experiment, **not a proven reliability improvement**. It
ran once in the fresh trial and the resulting body remained invalid.

### Structure 2: explicit scenario voice

- Batch callers can select
  `copyPolicy: { version: "structure-2-reader-scenario-v1" }` when no verified
  personal experience is supplied. The copy speaks to the reader or describes
  an impersonal situation instead of inventing an `I`/`we` customer narrator.
- Initial generation, full repair, targeted text repair and native-hook
  fallback share the selected voice. Covers and headings are included.
  Business context, history and original-plan data are not rewritten.
- Visible `headline` and `storyText` reject personal narrator pronouns under
  this policy. Separate CTA text is outside that narrator check. The policy is
  conservative: quoted first-person text or the literal word “us” can also
  trigger it; it is not a general-purpose testimonial detector.
- The six-slide interface, assigned roles, product introduction on slide 4,
  slide 6 CTA slot, validators for length/layout/numeric claims, valid-sibling
  handling and existing bounded repairs remain in place.
- Without a policy, legacy prompts, schemas and validation behavior remain.
  Legacy planner is v24; the scenario planner records
  `llm-carousel-structure-2-writer-v25-reader-scenario-v1`.
  The evidence contains the exact exported version strings.
- Customer jobs do not select this policy. Job creation/retry policy freezing,
  rollout selection and hosted acceptance have not been implemented or tested.
  It requires deliberate integration and versioned job handling before rollout.

This change makes voice consistent. It does **not** extract or verify product
facts, approve a lesson outline, review meaning, or measure audience response.
The broader evidence/lesson-first proposal remains unimplemented.

## Fresh live comparison

Four saved public business fixtures were used: UGCPilot, Cal AI, Calendly and
MOO. Each arm requested five plans per business, using the existing format
selectors, saved briefs, empty history and `gpt-4o-mini`. Before/after order
alternated by business. The exact same assigned formats and inputs were used
within each comparison. These are new provider calls, not mock completions or
reused results. Website extraction was not rerun: the input is the public
context captured in the earlier audit, not current customer onboarding data.

| Separate test | Structure | Before accepted | After accepted |
| --- | --- | ---: | ---: |
| List/body contract | 1 | 0/20 | 0/20 |
| Scenario voice | 2 | 14/20 | 20/20 |
| Actual-count feedback and prose guidance | 1 | 0/20 | 0/20 |
| Opt-in counted body repair | 1 | 0/20 | 0/20 |

For Structure 1, acceptance means returning a complete five-item batch. A
failed item can withhold valid siblings. Zero accepted plans therefore does
not mean every candidate slide was invalid. Two whole-batch attempts were
allowed; Structure 2 takeover was disabled to expose Structure 1 failures.
Structure 2 retained its existing valid-sibling and bounded-repair behavior.
These different failure contracts mean the structures' acceptance percentages
cannot be treated as directly comparable text-quality scores.

Structure 2 breakdown:

| Business | Legacy | Scenario |
| --- | ---: | ---: |
| UGCPilot | 0/5 | 5/5 |
| Cal AI | 5/5 | 5/5 |
| Calendly | 4/5 | 5/5 |
| MOO | 5/5 | 5/5 |

The list-contract test's initial responses had 24 list slides with non-null
bodies before the change and zero out of 24 afterward. This demonstrates that
the provider stopped adding the conflicting body layer in this sample.
The 20 accepted scenario plans had zero personal-narrator matches across their
120 visible story/headline slides; legacy accepted plans had 74 matching slides
out of 84. Different accepted-plan counts limit that comparison.

All three trials together requested 160 plans and made 136 provider calls,
using 1,178,125 reported tokens. Every recorded provider request returned HTTP
200. An HTTP success is not a successfully validated carousel. Provider IDs,
messages, schemas, outputs, usage and failures are saved in the evidence.

## Why Structure 1 still fails

The remaining failures include short prose, repeated headline/body ideas,
grammar/repetition heuristics, generic advice, multiple-idea bodies and weak
connection to the selected grounding. Additional word-count guidance still
returned 13–17-word bodies in some repairs.

The only eligible counted repair returned a 19-word UGCPilot slide 5:

> embrace creativity and allow flexibility in your content strategy.
>
> consistency is important but quality matters too. discover your balance!

This passes the count but has three sentences. The unchanged validator rejects
more than two sentences as `multiple_ideas`. It also remains broad advice.
This is a concrete example of why enforcing a response shape cannot establish
meaning or a useful lesson. Most other candidates also had non-body failures,
so the narrow policy correctly did not claim it could repair them.

The existing one-idea heuristic and grounding checks deserve a separate audit
against good and bad examples. Passing more drafts by deleting these checks
would not establish improved quality. The batch failure contract should also
be considered separately from writing quality; it was not changed here.

## Structure 2 editorial findings

I reviewed all 20 accepted scenario decks. The observations below are AI-agent
editorial review, not independent human ratings. They refer to the exact saved
fixtures and outputs, not claims about currently available product features.

| Sample (zero-based slot) | Remaining problem |
| --- | --- |
| Cal AI slot 2, cover | “assume all meal logging is equally precise can lead to confusion.” is grammatically malformed despite mechanical acceptance. |
| Cal AI slot 2, slide 4/5 | The output says photographing gives “better accuracy” and verifying entries “ensure[s] accurate tracking.” The input explicitly says estimates vary and does not guarantee exactness. |
| UGCPilot slot 1, slide 4 | It invents timely ideas based on current trends; that mechanism is absent from the supplied evidence. |
| UGCPilot slot 4, slide 4 | It says the product identifies what matters to the audience, beyond the supplied business-context generation mechanism. |
| Calendly slot 2/3, slide 5 | Outside-hours notifications and invitees proposing alternative times are not supported by the supplied facts. |
| Calendly slot 4, slide 5 | A configured buffer is presented as protecting a later appointment if a meeting overruns. The supplied fact supports booking gaps, not preventing an overrun. |
| MOO slot 3 | Comparing physical paper samples is a relevant supported mechanism and useful action. The deck still uses repetitive framing and broad conclusions. |

Several lessons reduce to “be flexible,” “consistency is key” or “use tools.”
Removing a fictional narrator has not solved this. Mechanical acceptance and
consistent voice are useful gains, but **20/20 is not a factual-quality score
and does not predict TikTok watch time, saves, likes or conversion**.

## Regression checks and practical limits

- Worker TypeScript build passed.
- 78 focused worker checks passed, covering grammar, counted repair, both
  voice policies, story planning, renderer/specs, measured fit, hook resolution
  and fallback, and slide persistence. 16 application source-contract checks
  also passed. These are scoped checks, not the entire application suite.
- Legacy Structure 2 prompts/schemas match the saved baseline for four
  businesses; 44 saved accepted plans retain identical legacy validation.
  Replaying 105 old Structure 1 drafts still accepts none under either version:
  other failures remain after redundant-list cleanup.
- All 20 accepted scenario decks passed 240 measured layout inspections:
  six slides in both supported formats, 1:1 and 4:5. Canonical placeholder
  role assets were used; there were no image downloads. This verifies font
  measurements and safe areas, not actual image quality or hosted rendering.
- Regression tests preserve unique list advice, reject malformed counted
  responses, freeze unrelated fields in targeted repair, propagate scenario
  voice into cover-only repair, preserve the legacy caller contract and reject
  unknown policy versions before provider submission.
- Scoped `git diff --check` passed for this change. The repository-wide scan
  reports an unrelated extra blank line at the end of
  `scripts/format-hook-schedule.browser.cjs`; that existing work was left alone.
  No database migration or production action is
  required to inspect this local work. Signed-in final acceptance must occur
  on the real production domain after an authorized release.

Next work should separate factual grounding and lesson usefulness from output
shape. Choose examples with explicit source support, identify precisely which
claims and actions fail, and test that reviewer/repair step independently.
Neither the counted repair nor the broader proposal has earned default rollout.

## Evidence and reproduction

- [Metrics and failure details](carousel-copy-fixes-metrics-2026-10-12.json)
- [All accepted scenario decks and counted-repair example](carousel-copy-fixes-samples-2026-10-12.md)
- [List/voice provider evidence](carousel-copy-fixes-list-and-voice-provider-evidence-2026-10-12.json)
- [Body-feedback provider evidence](carousel-copy-fixes-body-feedback-provider-evidence-2026-10-12.json)
- [Counted-repair provider evidence](carousel-copy-fixes-counted-repair-provider-evidence-2026-10-12.json)
- Harness: `scripts/audits/carousel-copy-fixes-2026-10-12.mjs` with separate
  `--body-feedback` and `--counted-repair` trials. It refuses to overwrite an
  existing run, restricts outbound calls to text completions and caps calls.
- Offline summarizer: `node scripts/audits/summarize-carousel-copy-fixes-2026-10-12.mjs`.
- Snapshot hashes: `scripts/audits/carousel-copy-fixes-2026-10-12-source-manifest.json`.
  The earlier baseline manifest is preserved with the prior comparison audit.

The counted schema uses Structured Outputs array bounds; API shape guarantees
do not establish semantic correctness. See the
[official Structured Outputs guide](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=chat).
