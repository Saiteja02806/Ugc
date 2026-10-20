# Captioned Explore video scheduling failure

The second screenshot shows 14 October 2026, 15:04 in Asia/Calcutta while
the computer clock shows 14:57. That selection has sufficient lead. It is a
different failure from the earlier ambiguous 02:49 AM/PM selection.

## Production evidence

The production domain's `/api/schedules` logs contain three matching errors
at 14:57:14, 14:57:21 and 14:57:24 IST:

`Failed to create schedule: SubtitleError VIDEO_DURATION_INVALID`

The message says videos must be between 0 and 120 seconds. The request fails
while verifying the Explore finishing receipt, before inserting a schedule.
The API maps the uncaught exception to the screenshot's generic 500 message,
`Could not create this schedule right now.` A genuine minimum-lead rejection
instead has HTTP 409 and code `schedule_time_too_soon`.

At the time of investigation, production deployment
`dpl_5Ycj52ZnJnBzZNY8eQU964uatEFL` served source
`585f40422f1d859e052c0e154993a5066252eec3` on getugcpilot.com.

The connected account's latest completed receipt was saved at 14:56:22 IST:

- Request: `085597c1-a9e9-4f7d-9e71-b3292fe26584`.
- Output: `e9b614ae-624b-44dc-ae30-19271e29f541`, ready owned MP4.
- Video duration: 9.566667 seconds.
- Saved speech duration: 9567 milliseconds.
- Transcript duration: 9567 milliseconds; 37 words.

This is valid persisted media. The logs do not identify the requested asset,
so the latest receipt is a matching reproduction rather than an assertion
that those request IDs explicitly named that asset. Earlier captioned
completed receipts have the same valid duration fields and the same defect.
No new Explore video schedule was saved during the failed attempts.

## Cause and correction

`ExploreFinishingRequestStore.read()` selects the saved speech duration and
parses the receipt. The parser validates the transcript correctly but drops
`speech_duration_ms` from its returned object. Scheduling then reparses that
object to verify owner, output, worker job, draft and fingerprint. The second
parse validates the transcript against `Number(undefined)`, or NaN, producing
the duration error even though the video is short and valid.

The receipt parser now retains the validated authoritative speech duration
alongside the transcript. Repeated parsing is stable. It does not derive the
duration from untrusted transcript metadata or the rounded container duration.
Malformed durations and transcripts become a typed receipt-validation error
and cannot create publishing rows. Existing draft fingerprints, ownership
checks, source IDs and completed media remain intact. No regeneration or
database correction is needed.

## Misleading status and asynchronous recovery

The controller retained help for an earlier time rejection after a corrected
attempt returned a generic server failure. It now describes that later request
as unconfirmed and retains its exact durable input for safe replay.

A second reproduced race allowed a slow hydration GET to overwrite a newer
accepted schedule with the old time-rejection message, or an older lookup
error. Generation guards now prevent obsolete reads from changing the latest
result, stored receipt or error. Hydration remains read-only; only explicit
user action sends a schedule. Network/500 failures never authorize changing
an uncertain durable request or creating a duplicate.

These changes preserve the current simple Talking Head + Demo schedule form,
including the independently prepared direct Schedule post workflow.

## Verification and release boundary

- The exact saved production receipt snapshot reproduced the old duration
  error through the actual app receipt store and scheduling policy. With the
  patch, that same snapshot verifies successfully. Wrong owner/output still
  reject. The snapshot was read only; no production post was created.
- Focused regressions cover both Hook and Phone contracts, 9567/19200 ms
  transcripts, actual store projection and repeated parsing, scheduling and
  rendered-post finalization, malformed duration/transcripts, late hydration
  success/error/old-result races and uncertain-request replay.
- Web TypeScript, worker build, scoped ESLint and diff whitespace checks pass.
- All 203 focused API, finishing, scheduling, recovery and MCP compatibility
  tests pass; evidence is `.tmp/schedule-receipt-regressions-20261014.log`.
  Eight compiled worker speech-policy/audio checks also pass. An additional
  regression confirms the second screenshot's exact 15:04 / 14:57 inputs in
  both India timezone aliases, including the elapsed five-minute boundary.

The parser and controller changes are local and uncommitted. This investigation
does not push or deploy them, change existing production schedules or publish
customer content. Production acceptance requires the website release and an
authenticated check against getugcpilot.com. Worker and MCP consumers share
the corrected parser; their build/compatibility checks do not establish that
those hosted runtimes have been released.

The user requested this investigation only. No recurring monitoring was set up.
