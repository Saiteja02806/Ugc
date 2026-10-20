# Talking Head + Demo caption fixes — 13 October 2026

The three reported concerns have local implementations and regression coverage. They have **not been deployed or accepted on production**. The startup improvement is an opt-in infrastructure change that needs the warm-worker cost decision and a verified rollout.

## Measured problem and competing workflows

The previous production subtitle test took 227.2 seconds (3:47.2). Cloud Run execution `ugc-video-render-job-zr9mm` spent about 181.9 seconds before the processor started; worker processing took about 43 seconds. This identifies startup as the dominant delay. It does not prove which lower-level image/platform startup operation consumed the time. See [the subtitle verification](talking-head-subtitles-verification-2026-10-12.md) and [the wider preparation audit](explore-render-delay-audit-2026-10-13.md).

[Vmake's official subtitle workflow](https://vmake.ai/ai-subtitle-generator) starts transcription after upload, offers styling and timestamped text correction, then exports. Its page describes exports in minutes and does not establish a universal under-10-second MP4 export guarantee. [Descript's caption workflow](https://www.descript.com/tools/video-caption-generator) likewise creates an editable transcript, lets users correct/style it, then exports subtitle files or a captioned video. Neither page exposes the vendor's internal deployment architecture. Separating interactive caption review from encoding is our implementation choice informed by those documented workflows, not a claim about their private infrastructure.

[Google documents minimum Cloud Run instances](https://docs.cloud.google.com/run/docs/configuring/min-instances) as a way to reduce latency from scaling from zero. Keeping an HTTP service warm only helps if the app actually routes the work to it; continuing to launch a fresh Cloud Run Job still pays execution startup.

## Implemented behavior

| Concern | Local change | Production status |
| --- | --- | --- |
| Three-minute processor startup | Optional authenticated Cloud Tasks route to one warm HTTP processor for new version-2 subtitle finish receipts | Off by default; not deployed |
| Waiting for MP4 before seeing captions | Separate explicit **Generate captions** request; audio-only preparation on the normal untrimmed sequence path, without final MP4 upload | Not deployed |
| Incorrect words cannot be corrected | Indexed text corrections retain ASR timestamps; original cached transcript and source audio stay intact | Not deployed |
| Captions absent from temporary combined preview | Timed browser overlay follows the combined opening/demo clock, seek, pause and word/style edits; **Preview captions** opens the existing sequence preview | Not deployed |
| Repeating transcription after editing words/styles | Review/export use the same owner-scoped speech hash and duration; corrections apply after reading the original transcript | Not deployed |
| Export encoding overhead | Explore subtitle burning uses `veryfast` at the existing CRF 20; standalone subtitle lab default remains `medium` | Not deployed |

The UI requires generated words before preparing a new subtitle-enabled publishing file. Caption-only completion has no media asset ID and cannot be scheduled. Existing finished videos remain available through their verified saved asset. Restoring requests is GET-only; no paid work starts on reload. Caption reuse requires the exact currently selected opening, demo and owned audio. Removed/replaced media hides old words. Word corrections remain in state when moving between Edit and Schedule and are included in the durable export draft. Reload before an export draft is saved does not persist unsaved word edits.

The preview is a browser rendering of timed words. It is not the final MP4. Font metrics and specialized style details can differ from the ASS render; the saved video remains the place to review final typography. Invalid/unfit corrections show a preview error rather than silently hiding captions or crashing.

## Offline processing measurements

`node scripts/explore-caption-latency.benchmark.mjs` uses the same already-downloaded 20-second, 716×1284 Talking Head + Demo audit clips and the previously saved real Scribe words. It submits no provider request and uploads nothing.

| Path | Latest local run | Earlier local run |
| --- | ---: | ---: |
| Caption review, mixed speech and font readiness | 1.634 s | 3.038 s |
| Final export with cached speech | 4.606 s | 5.942 s |

These timings exclude cloud startup, downloads, queue time, new transcription, upload, database round trips and browser polling. The machine is not the production two-vCPU container. They show that local preparation can be fast, not that the production flow has met a 10-second target. Final MP4 video duration is 20.067 seconds; the measured source sequence is 20.084 seconds, within the existing 150 ms frame-rounding tolerance. Audio-only and final composition speech files were byte-identical in the audit and in regression checks with demo-only and continuous background music.

## Compatibility and remaining boundaries

- Legacy subtitle drafts omit the new fields and retain their existing canonical fingerprint and speech identity. New drafts use `subtitles.version: 2`; caption-only drafts additionally set `captionPreview: true`.
- Paid Scribe submission still uses the durable owner-scoped claim, original-result cache, cancellation checks and uncertain-submission fence. Word/style changes do not trigger another paid transcription for identical speech. No provider switching or automatic paid resubmission was added.
- Registered paired reference soundtracks deliberately keep the verified existing composition/mixing pipeline before transcription. Preview/export cache reuse and the separate clean audio base are regression-tested. This fallback still encodes a composition for review and is not covered by the audio-only latency benchmark.
- Crops, original speech, demo-only added audio, default music timing, English/60-second scope, ownership, source snapshots, immutable output IDs and final publishing readiness remain checked.
- The warm route accepts only server-marked owned Explore subtitle finishes. Generic clip edits, subtitles-off joins and unrelated/heavy jobs retain their existing launcher. Broader Explore latency findings are not declared fixed by this caption change.
- One warm instance with request concurrency one avoids unbounded simultaneous FFmpeg work, but competing users can queue. Minimum instances are best effort and may restart; no constant latency guarantee follows from this setting.

## Warm worker configuration and cost

The proposed Terraform setting is `enable_interactive_explore_finishing = true`, with the existing worker enabled, a matching new worker image, 2 vCPU, 4 GiB, minimum 1 instance and maximum 1 instance. The service remains internal and IAM authenticated. CPU is billed per request (`cpu_idle = true`); no idle polling loop runs. Interactive requests have at least a 900-second service timeout, within the existing 1800-second Cloud Tasks dispatch deadline. The one-shot Cloud Run Job configuration remains available.

The app must set `GCP_EXPLORE_FINISH_TASK_URL` to the verified service URI plus `/tasks/jobs`. The dispatcher uses that service origin as the OIDC audience. The normal launcher configuration stays valid for legacy/unrelated jobs and rollback.

At [Google's published us-central1 request-based rates](https://cloud.google.com/run/pricing), idle CPU costs $0.0000025 per vCPU-second and memory $0.0000025 per GiB-second. An entirely idle 30-day month at 2 vCPU / 4 GiB is `(2 + 4) × 0.0000025 × 2,592,000 = $38.88`. This is a gross idle baseline, before discounts/free credits, active processing, transcription, storage, transfer and requests. It is not a fixed total monthly bill. Keeping the default `false` avoids adding this warm-instance expense but does not remove the measured startup delay.

## Verification and rollout gates

The full local subtitle feature suite passed **249 tests**, along with app/worker TypeScript. It checks actual FFmpeg outputs, all eight saved subtitle styles and three placements, ownership, provider uncertainty, cancellation, recovery, audio mixing, migration/RPC behavior, frontend state and publishing safety. **17 separate dispatch/MCP checks** passed and preserve existing routing and permission behavior. Scoped lint, changed Terraform file formatting and `git diff --check` also passed. The final command results are recorded in `.tmp/caption-full-validation.log`, `.tmp/caption-dispatch-validation.log` and `.tmp/caption-eslint-final.log`.

The migration `20261013060000_explore_caption_review.sql` was rehearsed after the existing finishing migrations in the Postgres test database. It rejects finalizing caption-only receipts into publishing assets and adds the server-created interactive routing marker to version-2 receipt jobs. Its exact function replacements fail closed if the installed function definitions differ.

Browser acceptance is pending. The isolated actual-React fixture is `scripts/explore-caption-review.browser.cjs`; its paid/API boundaries are simulated. Earlier browser automation exposed a fixture seek-event problem, corrected to use real keyboard range interactions. The rerun and provider-backed `terraform validate` were not executed because automatic approval review reached its usage limit. This was a review availability failure, not an unsafe-action determination. The connected in-app browser also could not reach the sandbox's local fixture. Unit checks cover clock transitions, seeking, text edits, stale-caption rejection and layout errors, but they do not substitute for visual browser acceptance.

Required rollout order after those checks and the cost decision:

1. Audit the current shared worktree and agree the release scope; preserve concurrent intentional project changes. Do not accidentally ship unreviewed mixed changes or omit intended release work.
2. Build and deploy the matching worker image before exposing version-2 draft creation. Keep the warm app URL unset during initial rollout and verify worker revision/health.
3. Validate the exact production function definitions and apply the additive migration. Deploy the matching website code. Legacy drafts continue to work throughout.
4. If approved, review the Terraform plan, enable the internal warm receiver, verify Cloud Tasks invoker IAM/queue connectivity and warm readiness, then configure the app URL. An HTTP min-instance change without the routing change is insufficient.
5. On `https://getugcpilot.com`, verify Generate → correct words → Preview captions → seek across Demo → prepare → watch/download the owned final MP4 → reload without resubmission. Cover music, paired reference music, all style/position families, cancellation, uncertainty and cross-account rejection. Confirm a caption-only result cannot schedule/publish.
6. Measure first and repeat clicks for queue wait, worker startup, download, audio preparation, ASR, encode, upload and ready detection. Record the distribution for 20- and 60-second sequences and concurrent demand before claiming a production target.

Rollback the warm route by unsetting `GCP_EXPLORE_FINISH_TASK_URL` before disabling the warm-only receiver flag; keep a worker image that understands version-2 receipts. Restore minimum instances to zero to end the idle expense. The additive migration and saved original transcripts can remain. Do not roll back to a worker that cannot understand a pending caption-only draft.
