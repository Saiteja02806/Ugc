# Subtitle performance implementation — 14 October 2026

The named 9.6-second **Startup Codex Creator Final** took 15.6–18.2 seconds in recent website Serif exports. A connector test took 154.1 seconds because its legacy subtitle draft launched a Cloud Run Job which waited 142.1 seconds before application processing. The implementation addresses the avoidable startup path and removes a final video encoding pass from supported modern exports.

## Changes

- New connector subtitle requests normalize to version 2 through the shared finishing service. The existing server-created marker and authenticated task routing then select the warm service. The connector already has its production warm endpoint configured. Omitted-version replays resolve against the accepted draft, so legacy receipts and modern receipts retain their exact fingerprint, audio identity and output IDs. Explicit conflicting versions/settings still fail.
- Modern captioned compositions prepare the exact audio timeline and caption layout first, then compose and burn subtitles in one final video encode. This applies to single-source videos and opening-plus-demo sequences after any required independent clip edits. Legacy requests, paired reference soundtracks and their clean captioned bases keep their established rendering paths. Caption review continues to encode audio only. Fonts are validated before speech submission and reused within the same render.
- Caption content, placements, dimensions and duration remain governed by the existing parser/planners and output checks. The final encoder uses the previous caption-export CRF of 20. The uncaptioned composition's intermediate CRF-18 encode is eliminated, so final RGB pixels are not promised to be identical to the previous doubly encoded footage.
- Finishing downloads use the existing storage ADC client for generation-pinned authenticated media requests, one bounded streaming pipeline and CRC32C verification. URLs come from the configured storage endpoint/bucket and validated object key. Size limits, cancellation, private-bucket selection and exclusive destination creation remain enforced. Three read-only real downloads completed with zero stream-listener warnings; no listener limits were raised.

The earlier portrait sizing and persistent Preparing video UI changes are already present on the verified website main deployment `5fe99ee3c6c1449b20901cdb7ea592a505ed9b54`. They are preserved in this release baseline. Unrelated newer source changes in the shared working checkout are excluded from this scoped subtitle release.

## Validation

- **276 full subtitle/finishing regressions passed**, including corrected-caption export, opening/demo mixed audio, all existing styles, crop paths, speech caching, ownership, receipt recovery, cancellation, reference soundtracks and storage safety.
- **10 connector regressions passed**, including new modern requests, exact omitted-version replay of both legacy and modern receipts, and conflicting draft rejection.
- The new actual-FFmpeg test verifies one final encode for modern Clean, Serif, Editorial and Word Pop, visible caption pixels, identical expected AAC audio, no source mutation, exact caption-review speech reuse, no video encode for review and rejection of reused output directories before another speech request.
- Root and worker TypeScript, scoped ESLint and whitespace checks pass in the isolated release checkout.

The local benchmark used the actual source, saved website clip-edit snapshot and already saved transcript. No provider call, production write or upload occurred during benchmarking.

| Style | Before | After |
| --- | ---: | ---: |
| Clean | 6.366 s | 2.903 s |
| Serif box | 5.753 s | 5.081 s |
| Editorial | 8.592 s | 6.947 s |

All three retained the exact 9.566992-second duration, 478 × 850 dimensions, byte-identical ASS/SRT/VTT files and byte-identical extracted AAC audio. Five decoded-frame samples per style differed by less than two levels per RGB channel on average, consistent with eliminating an intermediate compression pass. These local timings vary with CPU contention and are not production latency guarantees. An initial run under simultaneous regression load showed Editorial slower despite one fewer encoding pass; the repeated comparison above demonstrates why fixed speed claims require production measurement.

Diagnostic evidence is retained in ignored `.tmp/portrait-player-audit/`: full test logs, `single-pass-benchmark.json`, `concurrent-benchmark.json`, download warning checks and production timing receipts. None of the saved media, transcripts, credentials, dependency junctions or generated outputs belongs in the release.

## Release and acceptance

The scoped branch starts from `5fe99ee3c6c1449b20901cdb7ea592a505ed9b54`. It changes the shared finishing service, connector schema/callback, three finishing worker modules and associated tests. No schema migration is required. Deploy the matching worker image to the interactive service and background Job, then deploy the website and dedicated `ugc-mcp` project from the same verified release source. Keep the preceding image/revisions available for rollback.

Infrastructure capacity is unchanged pending measured demand: one warm service instance and one render at a time. Simultaneous local runs test renderer isolation and CPU contention; they do not establish multi-account production queuing or justify a fixed new maximum instance count. The owner-scoped finishing API prevents overlapping active requests from the same account, so a valid production concurrency test must use authorized separate test accounts rather than bypassing that rule.

Production acceptance must verify a new connector request receives the modern server marker, dispatches without a background launch, completes as owned portrait media, retains captions/sound and remains exactly recoverable. Measure the actual production queue and worker durations before stating a new time target is achieved. Existing accepted requests must still recover without upgrade or resubmission.
