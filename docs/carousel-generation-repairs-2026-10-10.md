# Carousel generation repair and acceptance — 10 October 2026

Status: v23 repair committed, pushed and deployed in `9e3a1306cafb431c4af4ddc470e30b0f068f6fd6`.
Concurrent Explore, scheduling and image-generation changes are preserved.

## Current production delivery

A fresh read supersedes the earlier 11:34 IST job-count snapshot. Two real
five-candidate jobs started at 11:36 IST on deployed worker `bb83ce3`:

- `0d01f59d-a1bb-4650-a19f-57e9996f087e`: four candidates completed, one
  rejected for generic copy; the batch job correctly reports a partial failure.
- `695e5518-e51d-4b90-bedf-2c2cf6163983`: five candidates completed at
  `2026-10-10T06:10:29.959Z`, rendering 30 slides.

All nine completed candidates have six ready slides and a final Slide 6
`product_asset` screenshot, establishing production acceptance of the deployed
metadata migration. The affected October 10 feed now has seven ready and three
decided Carousel slots, zero failures, recovery count zero and no recovery error.
Assignments and generations belong to the same owner. All six URLs in the
sampled newly generated slideshow return HTTP 200, nonempty `image/webp` content.
These jobs were already initiated outside this repair turn; this task did not
restart the feed or rewrite existing generation state.

## Remaining causes and v23 repair

The rejected candidate's repair repeatedly used `one platform`, which the
existing writing-quality validator blocks. Its feedback only said "generic
marketing language", so the model changed surrounding words but kept the exact
trigger. The validator now identifies the matched phrase. Initial, full-plan
repair and targeted-copy repair prompts list the same prohibited language and
ask for concrete actions/observations supported by business context. The quality
gate is retained.

The second batch's initial JSON contained all five complete plans but missed the
root closing brace, then emitted approximately 18,800 whitespace characters.
That discarded valid candidate copy and caused five full-plan model repairs.
The parser now recovers only one or two missing outer object terminators.
Incomplete strings, candidates, fields, extra text and other invalid syntax
still fail. All normal slide parsing, grounding, uniqueness, word counts and
actual renderer-fit validation run afterward. This is syntax recovery, not
generated copy. `providerEnvelopeRepaired` records it in accepted diagnostics.
Prompts request compact JSON and real scene descriptions rather than file paths.

## Validation

- Worker TypeScript build passes.
- 44 focused worker tests pass, including the exact failure shape, rejection of
  truncated content, retention of unaffected copy, isolated phrase repair,
  real font metrics and six-slide rendering/persistence contracts.
- 33 planner/runtime/feed-replenishment tests pass.
- Scoped ESLint has zero errors; its two unused-symbol warnings predate this
  change.
- One live text-only check uses entirely invented Weeknote test data. It repairs
  Slides 3/5/6 in one request, removes the blocked phrase, and passes both
  publishing and actual renderer measurements. Provider request
  `req_f24bf764a56240c2949195d0fe1aeb02`, 1,435 total tokens. It reads/changes no
  customer rows and starts no image or publishing jobs.
- Automatic approval review rejected the original probe that would have sent
  production-derived copy to OpenAI. That probe was not executed; the successful
  alternative contains only invented test data.

## Rollout and limits

Cloud Build `5f3bf9b9-69f8-4ce7-98a3-84a156e6c6ea` succeeded using the clean
committed worker source. The image digest is
`sha256:1aa2154ba2c1969d71f0c7950f4dc5bdbaf5aace8a183c96d8f94b1f8afb9f1f`.
Generation revision `ugc-carousel-worker-00110-lpb` became ready at
`2026-10-10T06:34:16.104Z` (12:04 IST) and serves 100% of traffic. Startup
logs verify build/runtime commit `9e3a130`, `workerReleaseVerified: true`,
`llm-carousel-structure-2-writer-v23-actionable-copy-repair`, available fonts
and configured OpenAI. Its warm minimum, maximum instances and concurrency
remain one. The dedicated edit worker retains the preceding working release.

Production website aliases, including `www.getugcpilot.com`, resolve to READY
deployment `dpl_94sKRBZADvLDSsA6M5rGVSXhDRs4` on the same source commit.
The real homepage returns HTTP 200; the signed-out feed API returns its expected
HTTP 401 JSON response. A direct worker version request from this workstation
returned a gateway 404 because ingress is internal-only. Runtime verification
therefore uses the actual startup
record and Cloud Run readiness/traffic instead of claiming that request passed.
No worker access controls were changed for the check.

The intended release contains only the generation-worker planner, parser,
regressions and Carousel documentation. The production schema and edit worker
already contain the preceding fixes. The existing deployment configuration and
serial queue limits remain in effect. No customer batches are mass-retried.

Production delivery has been observed on v22. The v23 change additionally has
local regressions and a synthetic live provider check; it does not guarantee
every future model response will pass validation. A rejected surplus candidate
does not imply failed delivery when the user's reserved feed is fully populated.
No new customer generation was started on v23 during this acceptance check.
