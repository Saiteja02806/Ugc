# Explore final-video delay audit — 13 October 2026

Implementation update: the subsequent local draft-save and durable background-scheduling work is documented in [Explore fast saves and background scheduling](./explore-fast-save-background-scheduling-2026-10-13.md). It implements the single-job composition and pending scheduling proposals below behind rollout controls. The production measurements here remain historical; the new paths have not been deployed or measured in production.

The dominant measured delay is between launching a Cloud Run render execution and the worker claiming the job. Several separate renders can pay this startup cost in sequence. The publishing button waits for the verified finished asset, so this backend delay is directly visible in Schedule.

## Production evidence

Read existing production job, receipt, stage-event and Cloud Run execution records. No new render, paid generation, social post, infrastructure change or deployment was started.

The read-only telemetry helper sampled 20 recent Explore `render_demo_video` jobs. Before-worker time was 100.30–213.69 seconds, median 157.54 seconds. Worker processing was 5.04–40.30 seconds, median 12.12 seconds. These are measured samples, not service-level guarantees. The helper's `queueMs` includes all pre-claim time and must not be interpreted as only Cloud Tasks queue congestion.

The user's recent records contain this matching two-clip chain. Source/output IDs confirm that the join consumed the two preceding edited outputs:

| Stage | Created, IST on 12 October | Before processing | Processing and completion | Total |
| --- | --- | ---: | ---: | ---: |
| Opening edit | 21:58:34 | 174.372 s | 5.701 s | 180.073 s |
| Demo edit | 22:03:12 | 213.693 s | 8.993 s | 222.686 s |
| Join the two edited outputs | 22:17:52 | 121.531 s | 12.030 s | 133.561 s |

The combined job durations are **536.32 seconds, about 8 minutes 56 seconds**. Pre-processing accounts for **509.60 seconds, about 95%**. This sum excludes the gaps between requests, including time spent editing or taking other actions. It explains how this pipeline can consume nearly ten minutes, but it is not a measured ten-minute browser click-to-button trace. The user did not supply the exact event timestamp. These receipts use the backend `kind: hook`, shared by the Hook and Talking Head implementations; they do not alone identify the UI route.

All three jobs completed with attempt count zero. This chain's delay was not caused by retry backoff. Stage events show launch acknowledgement after approximately 1.1–1.7 seconds, followed by approximately 120–213 seconds until worker claim. Downloads, composition, upload and database finalization occurred after that interval.

Cloud Run's Started condition independently changed just before worker claim. Execution `startTime` appeared earlier; it must not be treated as the point at which the app began processing. Google documents separate execution timestamps and condition state. See the [Execution API](https://docs.cloud.google.com/run/docs/reference/rest/v2/projects.locations.jobs.executions). The startup logs have no useful application event during the long pre-claim interval. This evidence localizes the delay to execution/container startup, but does not prove the lower-level reason, such as image unpacking or platform scheduling. Earlier image-import observations completed quickly; attributing the entire delay to image download would be unsupported.

A separate two-clip request with subtitles took 186.89 seconds before claim and 40.30 seconds after claim. Its transcription stage lasted about 1.48 seconds; the caption render lasted about 23.59 seconds. Subtitles add real work, while startup still dominated that sample. Another request failed with `NO_SPEECH`; failure must be surfaced rather than treated as an indefinitely pending successful render.

Sanitized evidence is in `.tmp/explore-render-audit-20261013.json` and `.tmp/explore-startup-log-evidence-20261013.json`. Raw URLs, tokens, prompts and account identifiers are not included in the report.

## Workflow behavior

- Hook can save the edited opening, save the edited Demo, optionally mix custom-volume Demo audio, then combine the results. Dependent stages are sequential. Each required job can incur another startup interval.
- Talking Head + Demo uses the same finishing processor after its clip edits. It also had a separate usability issue: entering Schedule did not initiate preparation and its preview sent the user back to Edit. The local correction now exposes the existing guarded **Prepare final video** action directly in Schedule, with progress, refresh, cancellation and retry. It never starts a render on hydration. A verified result restores inline Review schedule.
- Wall of Text uses the same video finishing processor for required exports, so the startup mechanism is shared. A specific Wall request was not measured in this audit.
- Slideshow saves image posts and does not require the same Hook/Demo MP4 join. Its image generation/edit worker can have separate delays. The Hook timing sample should not be presented as a Slideshow measurement.

Review schedule is inline in the current local code across Hook, Wall, Slideshow and Talking Head. It does not navigate or open a fullscreen overlay. Actions remain in the settings card, and final Schedule post confirmation remains explicit. These local UI changes have not been deployed by this task.

## What improves the wait

1. The current continuous browser sequence preview can show the selected clips and edits while the publishing file prepares. This removes export time from viewing/reviewing the sequence. It does not create a publishing asset.
2. Local unchanged-source reuse and standard-volume Demo audio composition remove compatible unnecessary worker stages. Foreground one-second polling saves only a few seconds of completion detection; it cannot remove minute-long startup delays.
3. The optional authenticated warm Explore worker route is the direct architectural remedy for repeatedly starting one-shot processors. Its local configuration is opt-in and needs a reviewed infrastructure plan, website configuration and production acceptance. Merely warming an HTTP service while continuing to launch one-shot jobs will not fix these measured jobs.
4. Combining independent trims, text and audio into a single versioned composition job would remove additional starts/transfers. It needs contract, recovery and rendering regressions; it is not a safe one-line button change.
5. Scheduling before export completion requires a durable pending-finishing source contract. Enabling the final button against a preview URL or an unfinished source would risk publishing omitted edits, audio or captions. The current safety check is retained.

A fast preview is feasible. The current measurements do not justify promising that every publishing file or final submission will be ready within five seconds.

## Local verification

71 focused preparation, preview, workflow-state, inline scheduling and recovery checks passed with the repository's subtitle-aware test loader. TypeScript and scoped lint passed. The development preview uses real shared scheduling components, local sample media and a save callback that cannot publish. A browser interaction confirmed unchanged URL, zero dialogs, unlocked body scrolling and in-panel confirmation. Screenshots are stored under `schedule-review-20261013` in the task's visualization directory.

The subsequent expanded clip-editor verification passed 185 focused workflow/editor tests, TypeScript and scoped lint. Actual Hook and Demo editor screenshots and the prepared-sample Schedule view were captured after the layout and button changes. See `explore-clip-editor-layout-2026-10-13.md` for scope, responsive checks and limits. These local checks do not establish a production rendering-time improvement.
