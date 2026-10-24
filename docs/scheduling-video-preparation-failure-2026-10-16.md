# Hook + demo preparation failure — production investigation, 16 October 2026

## Finding

Both reported posts failed during owned-media finishing, before platform scheduling.
The uploaded opening `06 Hook07 Detailed` has video starting at 0.025 seconds
and audio starting at 0 seconds. The current composition probe rejects every
video/audio stream with an absolute start timestamp greater than 0.000001 seconds.
This deterministically raises `COMPOSITION_TIMELINE_UNSUPPORTED`.

The demo starts at zero and is not the failing input. Retrying the identical
composition will encounter the same guard. This is a renderer compatibility
limitation for an otherwise readable H.264/AAC upload, not evidence of an AI
generation failure or an Instagram/TikTok rejection.

## Production evidence

All displayed times below use Asia/Calcutta on 16 October 2026. Selected publish
times are distinct from actual worker failure times.

| Selected publish time | Saved post | Finishing job | Actual failure time | Result |
| --- | --- | --- | --- | --- |
| 20:18 | `d4c06624-c838-4541-87b5-7e7866cdd7d3` | `ef1338b0-6b2a-4698-8c9b-7ff6ebd90bc1` | 20:08:51.937 | `COMPOSITION_TIMELINE_UNSUPPORTED` |
| 20:37 | `b37989d3-b5ba-46b3-b6a9-1f377f864412` | `ba7546fc-6aa7-49a3-8073-8a343fbef4ad` | 20:30:44.378 | `COMPOSITION_TIMELINE_UNSUPPORTED` |

Both jobs reached `composing_explore_video`, failed at 30% on their first
execution attempt, and saved this diagnostic:

> This file's track start times need timing review. Choose a file whose tracks start together.

Both use the identical frozen composition fingerprint
`2c7c9544c357c87bbca73f819312f69792e6bb86deda34bd27f31161324c6f4a`.
Both scheduled posts have zero platform target rows. The 20:37 selection points
to the connected TikTok account named `clara_ugcpilot`; the 20:18 selection points
to a connected Instagram account in the same owner's workspace. Platform access
was not exercised by these failed preparations.

Read-only FFprobe inspection of the actual production storage objects confirmed:

| Input | Stream | Codec | Start (seconds) | Duration (seconds) |
| --- | --- | --- | --- | --- |
| Opening `a5120f53-97ae-4021-9f5e-b7c617a57f1e` | Video | H.264 | 0.025000 | 3.431000 |
| Same opening | Audio | AAC | 0.000000 | 3.456000 |
| Demo `cdad612c-afd5-40f8-b8f6-8947a7d50e4f` | Video | H.264 | 0.000000 | 9.200000 |
| Same demo | Audio | AAC | 0.000000 | 9.210000 |

The earlier completed preparation `a433669f-dd3c-4e63-bc2e-0fcffae61c44`
used this same demo with a different generated opening. That corroborates the
input-specific diagnosis; it does not prove arbitrary other uploads will work.
The original opening and demo still have `ready` media records.

## Why Scheduling hides the cause

1. `worker/src/lib/explore-video-composition.ts:42` rejects the nonzero video
   timestamp before encoding the edited opening.
2. `lib/explore/workflow-finishing-service.ts:14` has a safe-message allowlist
   for selected subtitle/provider errors, but no composition-timeline entry.
   Its failure branch at line 96 therefore returns the generic message
   `Finishing did not complete. Your original media is unchanged.`
3. `lib/explore/pending-schedule-service.ts:91` records the failed preparation
   with generic `explore_preparation_failed` and that already generic message.
4. Scheduling maps the failed render state to `Video preparation failed`
   (`lib/scheduling/types.ts:253`) and offers a retry. That retry cannot correct
   this deterministic input timing limitation.

The finish receipts themselves still say `queued`; the service correctly derives
the terminal failure from the linked background jobs. Receipt status alone would
therefore give a misleading diagnosis.

## Safe remediation scope

- First expose a fixed, allowlisted, actionable message for
  `COMPOSITION_TIMELINE_UNSUPPORTED`. Do not pass arbitrary raw worker errors
  into the UI. Identify a source-file timing issue and explain that an unchanged
  retry cannot resolve it.
- Add narrowly bounded timeline handling that preserves the relationship of
  picture and original audio. Do not simply remove the guard or independently
  reset every track: current `setpts=PTS-STARTPTS` / `asetpts=PTS-STARTPTS`
  filters would erase relative timing, and duration calculation currently uses
  video duration rather than accounting for this leading interval.
- Verify a 25 ms delayed video, delayed audio, common nonzero origins, a material
  offset, missing/invalid timestamps, video-only files and ordinary zero-start
  clips. Include actual A/V sync, output duration, trim/text timing, hook/demo
  boundary, background music, and preserved original-file hashes.
- An immediate file-level workaround is a separately saved re-export with an
  explicitly aligned timeline, inspected and previewed before replacing the
  selected opening. Leave the original asset and existing posts intact.
- Any later recovery must use an explicit future publish time. These selected
  times have passed; this investigation did not retry or reschedule them.

## Validation and limits — initial investigation

- Read production scheduled posts, job records, job events, finish receipts,
  media records and selected social-connection identities. No tokens were read.
- FFprobe successfully read both actual production files, establishing the
  exact track starts above. Sandbox DNS initially failed; read-only inspection
  succeeded with approved network access.
- Existing offset-video safety test passed:
  `node --test --test-name-pattern='offset-video' scripts/explore-video-composition.test.mjs`.
- The finishing API suite could not initialize against the current worktree:
  its VM import harness rejects `./explore-text-fonts.ts`, introduced by separate
  existing font work. This is a local test-harness limitation, not the observed
  production failure. No broad passing-suite claim is made.
- Investigation only: no application/worker code, production records, media,
  schedules or deployment was changed, and no generation/publication was started.

## Implementation follow-up — local fix after user authorization

The worker now supports nonnegative input track starts up to 100 ms while
preserving the relative timing of the selected picture and original audio.
Larger/negative/nonfinite starts and inconsistent or overlong media remain
blocked. Inputs with zero starts retain the existing filters and duration path;
output validation still requires zero-start tracks.

Delayed video uses its relative timestamp with first-frame padding on the
existing 30 fps output grid. Delayed audio gets the corresponding number of
silent samples at 48 kHz. A short delayed audio tail extends the last picture
rather than cutting off the audio. Common track origins normalize together.
This uses FFmpeg's documented [fps start_time and adelay filters](https://ffmpeg.org/ffmpeg-filters.html).
Container end bounds also prevent double-counting MOV edit-list intervals
reported in stream duration by older FFprobe versions.

The finishing service now maps `COMPOSITION_TIMELINE_UNSUPPORTED` to an explicit
safe instruction to re-export/replace the affected clip when timing remains
unsupported. Raw worker error strings are still excluded. Existing receipt
identities, ownership, source hashes, billing/provider behavior, cancellation,
deadline handling and platform scheduling are unchanged.

### Exact failed composition verification

Downloaded local copies of the actual production hook, demo and selected music
were rendered using the exact saved trims, text, font choices and music mode.
No server-side records or source objects were altered. The repeatable offline
command is:

```powershell
node scripts/verify-explore-timing-recovery.mjs <local-hook> <local-demo> <local-music>
```

- Bundled FFmpeg/FFprobe: completed at 720×1280, 12.633984 seconds.
- Installed FFmpeg/FFprobe 8.1: completed at 720×1280, 12.666016 seconds.
- These lengths differ by one 30 fps frame. Both are within the existing
  bounded output tolerance of the selected 12.666-second composition.
- The newer-tool output is `.tmp/explore-timing-recovery-lRJq5a/render/composed.mp4`.
  Each render directory includes `verification.json` with dimensions, durations,
  segments and original SHA-256 values. All three original hashes were unchanged.
- Inspected a three-frame contact sheet covering the hook and demo: correct
  source order, authored hook overlay and demo CTA are present.

### Regression results

97 checks passed across composition, finishing/caption styles and placements,
single-pass trim/text/audio export, job recovery, whole-video/demo audio,
finishing API, pending schedule service and malformed metadata boundaries.
New synthetic cases measure visible event timing and audible leading silence
and tails, not just render success. Cases include a 25 ms video delay, 80 ms
video/audio delays, framing, common starts, video-only/missing optional
metadata, negative/nonfinite/large starts and duration-limit overflow.

The initial combined invocation omitted flags required by two existing suites;
those suites subsequently passed all 12 checks with
`--experimental-test-module-mocks --experimental-transform-types`. The other
83 checks passed in the combined run; the new metadata suite passed 2 checks.
The finishing API's existing font-import test harness was updated and its
23 checks pass, superseding the initial-investigation harness limitation.

Worker build, application TypeScript and scoped ESLint passed. Evidence logs:
`.tmp/scheduling-timing-regressions.log` and
`.tmp/scheduling-timing-extra-tests.log`.

### Release boundary

This is a verified local fix using actual production input bytes, not a deployed
production acceptance result. Release the worker and web service changes before
claiming the Scheduling screen is fixed for customers. Production media, failed
posts and account connections have not been mutated or retried. Recovering a
past-time post requires an explicitly selected future publishing time; never
automatically publish missed posts as part of verification.
