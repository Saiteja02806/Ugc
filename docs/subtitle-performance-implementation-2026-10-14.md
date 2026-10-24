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

## Production result

PR [#63](https://github.com/Saiteja02806/Ugc/pull/63) was merged as `585f40422f1d859e052c0e154993a5066252eec3`. The website deployment `dpl_5Ycj52ZnJnBzZNY8eQU964uatEFL` and connector deployment `dpl_ALKxyF9zH33MDbWMku7h5wKJTUBR` are READY on that commit, serving `getugcpilot.com` and `mcp.getugcpilot.com`. Concurrent main changes to account selection were preserved. The separate linked `trending-release-web-3f35202` build failed with `auth/invalid-api-key`; that project's Firebase configuration was excluded from this scoped release. The application preview build and MCP contract CI passed.

Cloud Build `343940b5-aaed-443f-be7c-8ddbb818258b` produced worker digest `sha256:03741177c98efba44a7bb4decf31cbfa842c4a9fb0280f8997fb99db78ea2feb`. Both the service and background Job now use it. The service sends 100% of production traffic to `ugc-video-render-worker-00104-dnm`. Its baked and configured Git identities both equal `490cc978bce8132b48e4b695c05ad25c988e2c21`; worker source is identical on the merged commit. CPU remains 2, memory 4 GiB, minimum/maximum instances 1 and concurrency 1. Previous image/revisions remain available for rollback.

A fresh Serif-bottom export of **Startup Codex Creator Final** completed on 14 October at 09:05:43 UTC:

| Measurement | Legacy connector baseline | Updated connector |
| --- | ---: | ---: |
| Waiting before processing | 142.128 s | 0.909 s |
| Worker processing | 12.007 s | 9.688 s |
| Saved request to saved output | 154.135 s | **10.597 s** |

The accepted new draft has subtitle version 2 and server-created `interactiveFinishingVersion: 1`. It dispatched to the warm service without a Cloud Run Job operation or `render_job_launched` event. It completed without an error code, worker error logs or `MaxListenersExceededWarning`. Replaying the exact legacy request returned its original job/output; replaying the modern omitted-version request returned its original new job/output. Neither replay launched another render.

This timing reused this owner's already saved exact transcription, confirmed by the receipt's null `transcription_started_at`. It is not a measurement of first-time speech recognition or the Edit button's click-to-playable latency. First-time transcription, foreground status polling and browser media loading can add time; no fixed ten-second guarantee is established.

The owned new output reports 9:16, 478 × 850, H.264/AAC and 9.566667 seconds. A full FFmpeg decode found no errors; the container duration is 9.567 seconds and decoded video duration 9.566992 seconds. Sampled frames show readable Serif captions over portrait footage. Extracted AAC bytes match the legacy baseline exactly and audio is non-silent. Evidence is saved locally in `production-acceptance.json`, `production-media-check.json` and `production-subtitle-contact-sheet.jpg` under the ignored audit directory.

The user chose the completed layout checks for final UI verification because the production test browser was signed out. The actual player passed 36 combinations across Edit, Schedule, source and sequence views, portrait/landscape/square media and desktop/mobile sizes, including controls, playback, missing metadata, source changes, no overflow and React Strict Mode cleanup. A new signed-in Edit interaction was not claimed.

Local renderer runs with one, three and five simultaneous exports all succeeded. Their durations rose from 4.742 seconds alone to 7.397–7.511 seconds with three and 11.826–11.997 seconds with five. These establish CPU contention and isolation locally; production demand and queue capacity across multiple accounts remain unmeasured. The startup delay fix therefore does not assert that the system had too few workers, and capacity was not increased without supporting load evidence.

## First-time transcription follow-up

A read-only recheck at **14:46 IST on 14 October** confirmed that both production domains still serve the merged release and the new worker revision still receives 100% of service traffic. The seven available revision log entries contained no errors, stream-listener warnings or failed HTTP requests. This is the observed log window, not a claim about unmeasured future load.

The exact source's first caption-review request, created at **03:54 IST on 14 October**, completed in **7.919 seconds**: 0.968 seconds waiting and 6.951 seconds processing. Its first transcription claim-to-render checkpoint took **1.320 seconds**; the full transcription stage including preparation/checkpoints took 1.404 seconds. The earlier legacy full export's first transcription claim-to-render checkpoint took 1.197 seconds. These durations include submission, recognition, saving the result and checkpoint overhead; they are not isolated provider API latency.

The current cached export spent only 0.143 seconds in the transcription stage. No new uncached full export has been measured on the new worker. The earlier 7.919-second caption-review result and current 10.597-second final-export result are separate runs with different deployed worker versions; their sum must not be presented as an observed click-to-playable duration. Recognition was a small part of these nine-second-source timings, while the 142.128-second legacy startup wait was the dominant avoidable delay.

No cache was cleared, paid transcription resubmitted, media altered or extra render created for this follow-up. The evidence is retained in ignored `first-transcription-audit.json`.
