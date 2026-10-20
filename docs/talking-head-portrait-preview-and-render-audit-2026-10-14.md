# Talking Head portrait preview and nine-second render audit

14 October 2026, Asia/Calcutta. The preview and progress UI fixes are local and have not been deployed by this task. Production media and timings below were verified against the connected account's actual records and playable outputs.

## Result

The selected Creative Asset is **Startup Codex Creator Final**, with a reported duration of 9.6 seconds and dimensions of 478 × 850. Its opening frames show the Google clock visible in the supplied screenshot; the same file then cuts to the speaker and a screen recording. Final files are approximately 9.567 seconds at 478 × 850, with square pixels. They remain portrait, approximately 9:16.

The shared `WorkflowMediaPlayer` forced `aspect-video` and `w-full`, presenting portrait footage inside a landscape player with black side areas. The file itself was not converted to 16:9. A second forced landscape rule existed on the uploaded Hook/Demo sequence player.

The local fix removes those landscape constraints. Players use native media dimensions, preserve the entire frame, remain centered, and fit the available width and viewport height. Finished Edit and Schedule previews now receive the saved width and height before metadata loads. Unknown dimensions continue to resolve from the actual video. Source changes, audio controls and existing Strict Mode detach/restore behavior are preserved.

The finishing button previously used only the short-lived client request flag. Quiet polling cleared that flag while the server continued rendering, so the button could return to **Prepare final video** while disabled. A separate `processing` state now keeps **Preparing video…** and `aria-busy` active through pending worker jobs and completed-output loading. The status paragraph announces updates with `role="status"`; polling still does not change the client request flag or resubmit work.

## Actual website timings for this source

These are server job creation-to-completion measurements, including dispatch, worker preparation, rendering, upload and saving. They exclude the browser's initial submission/authentication time and the subsequent status read/media load. The Talking Head foreground hook polls once per second when visible; network and asset loading add further time. Polling is not the main measured bottleneck.

| Production request time (IST, 14 Oct) | Request | Queue/dispatch | Worker | Total |
| --- | --- | ---: | ---: | ---: |
| 03:55:01 | Serif box, bottom | 0.650 s | 36.361 s | 37.011 s |
| 04:04:52 | Serif box, bottom | 0.846 s | 36.418 s | 37.264 s |
| 10:38:23 | Serif box, top | 0.874 s | 17.332 s | 18.206 s |
| 11:05:52 | Serif box, bottom | 0.842 s | 15.473 s | 16.315 s |
| 11:09:41 | Serif box, bottom | 0.665 s | 14.946 s | 15.611 s |

Separate caption-preview requests completed in **7.919 s** and **6.709 s**. Caption generation/review and final burned-in video rendering are separate operations. Generating captions does not make a finished publishing video immediately available.

For the latest website bottom-caption export, the checkpoints divide the 15.611 seconds as follows:

| Stage interval | Time |
| --- | ---: |
| Dispatch, download and initial checkpoints | 1.245 s |
| Clip/audio preparation up to speech lookup | 4.307 s |
| Speech lookup up to subtitle-render checkpoint | 0.211 s |
| Subtitle layout, encoding and remaining composition | 9.181 s |
| Upload and saving through completion | 0.667 s |

Checkpoint intervals include adjacent work and checkpoint writes; they are not a CPU profiler. These measured runs support an observed **roughly 16–18-second website preparation wait** for this clip with Serif captions. They are not a completion-time guarantee. The earlier approximately 37-second runs show that latency has varied. This task did not attribute that production change to a particular renderer deployment.

## Fresh production render

A single additional render was requested through the authorized UGC Pilot connector, using this exact owned source, Serif box captions at Bottom, no appended demo, no music and no source edits. The stable request key and exact payload were saved before submission. No post was scheduled or published. The new finished video remains in Creative Assets.

The connector dispatched a **background Cloud Run Job**, while the measured website requests above used the interactive finishing service. It completed successfully on its first attempt:

| Measurement | Time |
| --- | ---: |
| Job creation to worker claim | 142.128 s |
| Worker claim to completion | 12.007 s |
| Creation to completion | **154.135 s (2 min 34 s)** |

The `render_job_launched` checkpoint occurred at 1.355 seconds; the worker first claimed the job at 142.128 seconds. This proves a long wait before processing in this background route. It does not establish a more specific cause such as container provisioning versus scheduling without execution-level telemetry. The connector's serialized draft also differs from the website's version-2 composition snapshot, so the 12-second worker result is not a direct renderer-speed comparison.

The interactive service inspected during the audit has 2 vCPU, 4 GiB memory, one minimum and maximum instance, and concurrency 1. Concurrent website requests can therefore queue even though the inspected website requests queued for less than a second. No infrastructure settings were changed.

## Media and UI verification

- Both an existing website output and the fresh production output load in the browser with video dimensions 478 × 850 and duration 9.566667 seconds.
- FFprobe reports H.264 video, AAC audio and square pixels. Fresh output video duration is 9.566992 seconds; audio duration is 9.566 seconds. Full video/audio decoding finishes without errors; decoded audio is non-silent.
- Ten sampled frames across the fresh file preserve the portrait screen recordings and talking head. Serif captions are visible within the frame during speech; inspected frames show no stretched footage, landscape side padding in the file, or clipped captions. This sampling does not certify every transcript word or every frame.
- An isolated browser fixture imports the actual shared player and Edit/Schedule components. **36 cases pass**: Edit final, Schedule final, selected source and Hook/Demo sequence previews, each with portrait, landscape and square footage at 1440 × 900, 1280 × 720 and 390 × 844.
- Each case verifies displayed/native aspect-ratio parity, viewport height bounds, controls, inline playback and no horizontal overflow. Missing saved dimensions, actual playback, source replacement, audio rendering, unmounting and Strict Mode cleanup also pass.
- **86 focused regressions pass**, including worker-pending progress, quiet polling, completed-output recovery, source ownership, caption editing, subtitle controls, scheduling and sequence previews. TypeScript, scoped ESLint and whitespace checks pass.

Reproduce focused regression validation:

```powershell
node --import ./scripts/subtitle-test-loader.mjs --experimental-test-module-mocks --experimental-transform-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test --test-concurrency=1 scripts/workflow-finishing-ui.test.mjs scripts/workflow-source-video.test.mjs scripts/talking-head-schedule-preview.test.mjs scripts/workflow-composition-panel.test.mjs
node node_modules/typescript/bin/tsc --noEmit
```

Ignored diagnostic evidence is in `.tmp/portrait-player-audit/`: `telemetry.json`, `production-test-request.json`, `media-check.json`, `subtitle-contact-sheet.jpg`, `results.json`, `run.cjs`, and desktop/mobile screenshots. Credentials and private media are not committed.

## Release boundary

Changes belong to the shared player, its CSS, the optional preview dimension fields, finished preview projections, sequence sizing, finishing progress and focused regressions. Existing unrelated worktree changes were preserved. There was no push, website deployment, worker deployment or infrastructure modification.

The browser session redirected to production sign-in. Production media and server timing were verified through the connected account, but an authenticated browser click-to-playable measurement and final deployed UI acceptance remain outstanding. After the website release, verify Creative Assets → Talking Head → Edit → Prepare final video → Schedule on the production domain, including portrait geometry and stable rendering status. The existing caption batching work in this worktree is a separate renderer change with its own release requirements.

## Follow-up: confirmed worker execution diagnosis

The user requested a deeper check of subtitle timing and possible worker issues. This follow-up made read-only production/database/Cloud Run checks and local read-only media downloads. It did not submit another render or change infrastructure.

For **Startup Codex Creator Final**, caption generation took 6.709–7.919 seconds; recent final Serif exports took 15.611–18.206 seconds. If both sequential operations are required, those separately observed durations imply roughly **22–26 seconds of server work**, before browser request/loading overhead. That combined number is an inference, not a measured authenticated browser click-to-playable stopwatch. Existing generated captions can be reused, so repeat final exports need not repeat the caption-generation step.

The fresh background execution was mapped to its exact Cloud Run task. Controller and task timestamps clarify the previously unresolved pre-processing wait:

| Cloud Run observation (UTC) | Evidence |
| --- | --- |
| Execution acknowledged at 05:55:55.223475 | 1.19 seconds after the application job was created |
| Image import completed at 05:55:57.415303 | Platform condition: image imported in 2.19 seconds |
| Resources available at 05:55:57.521240 | Platform condition: provisioned imported containers |
| Task scheduled at 05:56:11.435973 | Scheduling preceded actual task startup |
| Task started at 05:58:13.062594 | Started condition: deployed execution started in 2 min 15.54 seconds |
| Application worker claimed at approximately 05:58:16.160 | 142.128 seconds after application job creation |
| Application completed at 05:58:28.167832 | 12.007 seconds after claim |
| Task and execution completed successfully | Exit code 0; one successful task; no recorded retry or capacity/quota failure |

The task spent approximately **121.6 seconds between scheduling and actual start**. This confirms slow background execution startup. Image import was fast; the platform conditions do not identify the reason for the remaining startup gap. No evidence from this execution establishes that insufficient workers, exhausted capacity, quota failure or a worker crash caused it. The distinction between controller execution start and actual task start follows the separate resources exposed in the [Cloud Run execution API](https://docs.cloud.google.com/run/docs/reference/rest/v2/projects.locations.jobs.executions).

The regular website requests carry the server-created `interactiveFinishingVersion: 1` marker and route to the warm HTTP service. The connector's version-1 subtitle draft lacks that marker and uses the background launcher. The version-2 routing restriction is explicit in `20261013060000_explore_caption_review.sql` and `lib/jobs/explore-interactive-dispatch.ts`; legacy/heavier jobs retain the background route. Do not treat the connector test's startup time as the website's usual subtitle-render time.

The latest three website Serif requests and the recent caption preview completed with no retries and queue times below one second. Their Cloud Run requests returned HTTP 200; the inspected service log window (04:45–06:10 UTC) contains no ERROR-severity entries. These website waits are mainly renderer/audio preparation work. The service is limited to **one instance and one concurrent request**, so multiple simultaneous users can still queue. The inspected single-account jobs do not establish acceptable latency under concurrent load.

The live service startup log reports build `a870105bf2237f51b1d1d2d64ee969d531764b4f`. The corresponding local Git commit contains the batched Serif/Editorial measurements. This confirms that batching is present in the currently inspected service, although this task did not deploy it. Earlier documentation describing it as pending should not be read as the current service's measured state. Both warm and background runtimes inspected here use the same image digest.

### Storage stream warnings

Both warm-service and background logs contain `MaxListenersExceededWarning` for 11 `error` and `close` listeners on a `PassThrough` stream. Three read-only downloads using the worker's actual `ExploreFinishingStorage.download` path reproduced the warning. Tracebacks locate the added listeners in `teeny-request`'s nested stream pipeline, used by the Google Cloud Storage download library. Each download completed; sampled warned streams were destroyed after completion. The warning count was the same for each new stream.

This is a reproducible warning worth cleaning up, but it does not prove an accumulating memory leak or a failed render. [Node's event documentation](https://nodejs.org/api/events.html#eventsdefaultmaxlisteners) describes this threshold as a warning, not a hard listener limit. In the measured background run, warnings first appeared after the worker had started, so they cannot explain the preceding two-minute startup delay. No listener threshold was raised and no warning was suppressed.

Of the 14 owner-scoped subtitle jobs inspected from 12–14 October, 13 completed and one older request failed with `NO_SPEECH`. That failure occurred during speech processing; it is not evidence of a worker crash. Different source durations and legacy routes are included in this count, so it must not be interpreted as a nine-second render-time distribution.

Recommended priorities are to retain the warm route for supported interactive caption jobs, investigate the scheduled-to-start background gap using platform telemetry/support if it continues, validate concurrent-user queuing before increasing service capacity, and clean up the storage stream warning independently. Preserve legacy speech identity and recovery behavior when considering any routing changes. Diagnostic evidence is saved under `.tmp/portrait-player-audit/worker-diagnostics.json`, `execution-detail.json` and `stream-warning-check.json`.

## Proposed implementation order

The user asked for the right approach to solving the measured delays. This is a proposal, not an infrastructure change or an implementation claim.

1. **Keep short interactive subtitle work on the warm service.** The website already does this for its bounded version-2 flow. Extend new supported connector requests to the modern contract and verified routing path; preserve the version, fingerprint, audio identity and recovery behavior of existing saved requests. Do not simply reroute every legacy/heavy job or rewrite accepted receipts. Instrument dispatch mode, task scheduling, task startup and worker claim independently so a future two-minute wait is attributable immediately.
2. **Reduce work per export.** Retain the already deployed batched caption measurements. The next renderer improvement is combining compatible trim/text/crop, clip joining, audio mixing and subtitle burn into fewer final encoding passes. Prioritize the common single-source Talking Head flow, then two-clip compositions. Preserve source dimensions, caption pixels, mixed sound, join timing and clean reference-track bases. Reuse verified transcripts for style/position-only changes, as the durable cache already supports. Consider caching the exact prepared speech audio under an owned, complete audio-timeline identity so an unchanged timeline does not require rebuilding it solely to recover its checksum; trim, source/audio changes, gain and playback settings must invalidate that cache.
3. **Scale for simultaneous users after measuring.** Keep concurrency 1 per rendering instance initially. Load-test 1, 3 and 5 simultaneous short exports; monitor queue time, render duration, memory, failures and cost. A proposed first capacity step is retaining one warm instance while allowing a bounded maximum of three, if concurrent tests show contention and the account's quota/budget supports it. More instances improve aggregate capacity; faster individual exports require renderer efficiency or measured CPU improvements. Benchmark 2 versus 4 vCPU before increasing resources. Minimum-instance and concurrency settings should follow [Cloud Run's performance guidance](https://docs.cloud.google.com/run/docs/tips/general).
4. **Expose accurate progress.** Show separate Generating captions, Rendering video, Loading preview and Ready states. Use measured elapsed time rather than an invented percentage/countdown, and retain one durable request through retries. The portrait and persistent preparation-status fixes from this task are local and need website release and authenticated production acceptance.
5. **Handle storage warnings separately.** Test the storage library's nested-pipeline cleanup and compatible dependency versions; do not silence all listener warnings globally. Verify aborts, interrupted downloads and repeated downloads, plus stable memory under sustained rendering. The existing warning has not been shown to cause the measured delay.

Suggested acceptance targets, to be validated rather than promised: less than two seconds of dispatch wait when warm capacity is available, under ten seconds for a nine-second final export using reviewed cached captions, and roughly 15–20 seconds for first-time caption generation plus export. Verify the actual production button-to-playable experience at normal and simultaneous load, and record median and slow-run percentiles. No setting changes, dependency upgrades or new renderer changes were made for this proposal.
