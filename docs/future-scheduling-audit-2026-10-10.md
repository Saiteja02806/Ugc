# Future scheduling audit — October 10, 2026

## Result

The current production scheduling path is working for the recent Instagram and
TikTok schedules examined. This conclusion is supported by saved local times,
UTC targets, worker start times, durable provider operations, platform post IDs,
and actual production worker logs. It is not based only on the calendar showing
a post as scheduled.

For **October 11, 2026 at 22:00 in Asia/Calcutta**, the application resolves and
passes **October 11 at 16:30 UTC** to Cloud Tasks. The exact example passed an
isolated test using the application's real conversion and task builder. No task
was submitted and no production post was created for this example.

## Production evidence

Database observations began at **2026-10-10 07:05 UTC**. The project contains 250
historical destination targets, including 206 published targets. Historical
failures and cancellations remain separate from successful publication.

Among targets created from October 4 onward:

| Platform | Completed targets | Worker start after requested instant | Publication confirmation after requested instant |
| --- | ---: | ---: | ---: |
| Instagram | 14 | 0.908–16.354 seconds | 33.572–98.575 seconds |
| TikTok | 2 | 6.709–7.223 seconds | 18.523–19.256 seconds |

All 16 have a saved platform post ID. None started or completed early. The only
other target created in this period was cancelled. Five completed Instagram
targets had been created at least an hour ahead; their lead times ranged from
2 hours 56 minutes to 21 hours 38 minutes. The recent saved local date/time and
timezone matched the UTC schedule instant in every applicable record.

Representative complete traces:

| Target | Selected local time | Created UTC | Requested UTC | Worker start UTC | Provider success / target published UTC |
| --- | --- | --- | --- | --- | --- |
| Instagram `0973e739-2e67-43a9-91bd-7120c3226878` | Oct 7, 09:30 Asia/Calcutta | Oct 6, 19:39:11.547 | Oct 7, 04:00:00 | Oct 7, 04:00:07.172 | 04:00:47.930 / 04:00:48.135 |
| Instagram `42e01797-7352-4872-a12d-72b42f55d316` | Oct 7, 13:14 America/New_York | Oct 6, 19:35:17.982 | Oct 7, 17:14:00 | Oct 7, 17:14:07.071 | 17:14:47.213 / 17:14:47.471 |
| TikTok slideshow `2d3fe970-acaf-492d-b160-95192d3be4b2` | Oct 10, 02:37 Asia/Calcutta | Oct 9, 20:07:40.650 | Oct 9, 21:07:00 | Oct 9, 21:07:06.709 | 21:07:18.389 / 21:07:18.523 |

The three jobs are completed and their provider operations are published. The
TikTok worker logs independently show `PROCESSING_DOWNLOAD` at 21:07:08.195,
then TikTok's `PUBLISH_COMPLETE` at 21:07:18.388. That target was requested with
`PUBLIC_TO_EVERYONE`. Its Cloud Run request began at 21:07:00.908 and returned
HTTP 200. A new instance started, then its server became ready around
21:07:05.420. This accounts for part of the delay between the requested instant
and the worker's provider call.

There were **zero overdue active targets**, **zero future pending targets**, and
no parent posts still in scheduled/scheduling/publishing/rendering states at
audit time. These are point-in-time observations, not an ongoing monitor.

## Historical early publication and current protection

The database retains **49 early Instagram publications**. Their latest actual
publication was October 3 at 11:57:27.631 UTC. The earlier audit correctly found
that generic recovery interpreted an intentionally queued future publishing
job as stalled, recovered it, and sent it to the worker before its scheduled
time. Local-to-UTC conversion was not the cause.

This audit independently read the live definitions of:

- `list_recoverable_background_jobs`
- `recover_background_job`
- `claim_background_job`
- `list_due_social_publish_jobs`

The live recovery/claim functions require a matching owner and current target
job link, and require the target to be due. Cancelled/already-published targets
can still complete cleanup. Future retry waits are also respected. The migration
`20261003121102_prevent_early_social_publishing` is present in production history,
along with the account timezone migration `20261003122024`.

The deployed worker additionally checks the target's saved time before claiming
a new provider operation, refreshing credentials, preparing media, or calling
the publisher. An early delivery is deferred without marking the target failed
or consuming a normal retry attempt. This is now deployed; the October 3 report's
statement that the additional worker guard was local describes its status then.

## Path and hosting checks

1. Scheduling controls preserve the selected local date, time, and timezone.
   Account timezone preferences supply the default; manual selection remains
   authoritative. Daylight-saving gaps and overlaps are rejected instead of
   being silently converted to another time.
2. The authenticated scheduling service re-resolves submitted local fields on
   the server, validates the lead time, and saves the UTC instant on the post
   and each target. It creates a durable publishing job and attaches that job
   to the owner-bound target before arranging dispatch.
3. The real task builder places that UTC instant in Cloud Tasks `scheduleTime`.
   The authenticated dispatch route delivers the matching publishing job.
4. The database and worker prevent early provider execution. The publishing
   operation persists provider initialization and confirmed success; the target
   is marked published after that success. Duplicate delivery reconciles
   existing publication rather than initiating another post.
5. Videos that require rendering retain the planned time. Late finalization can
   use the saved ten-minute grace window; a render that misses the deadline
   fails explicitly and requires a new time.

Live configuration checked in `ugcsaas/us-central1`:

- `ugc-social-publish-scheduler`: RUNNING, 10 concurrent dispatches, 5/sec;
  retries up to five attempts over a one-hour retry window.
- `ugc-social-publish`: RUNNING, one concurrent dispatch, 1/sec.
- Recovery timer: ENABLED, every five minutes, calls
  `https://getugcpilot.com/api/internal/jobs/recover`. Its 06:55, 07:00, and 07:05
  UTC completion logs returned HTTP 200. A fallback can therefore introduce
  additional delay when ordinary dispatch fails; it is not an exact-second
  guarantee.
- Social worker: `ugc-social-publish-worker-00068-rbj`, 100% traffic, image
  `sha256:e42643fbacdde6fdee5ad12917931a2b986ca391daf65f34a115547198bbfafc`.
- Current live web deployment: `dpl_JBWopVDJB6j4CXTHZUgwMjKdDipi`, READY,
  production domain `getugcpilot.com`, Git commit
  `4e3cbfa957d2aba2591c6e40f419fc429cc277ef`. A GitHub comparison to the previously
  verified release `bb83ce32773011562702adb90ed6966a4279cc7e` shows no changes to
  the scheduling API, dispatch, timezone conversion, or social publisher.

## Validation and limits

Passed **181 focused tests**: 96 timezone/task/dispatch/persistence/finalization
checks, 52 publisher/processor checks, and 33 scheduling UI/Hook checks. The
worker TypeScript build passed. Tests cover future-job deferral on Instagram,
TikTok, and YouTube without contacting a provider, cancellation, duplicate
delivery, durable provider operations, account lanes, and retries. An additional
isolated exact-example check confirmed Oct 11 at 22:00 India time round-trips
correctly and remains exactly 16:30 UTC in the generated task.

The actual post can become available after the selected instant because worker
startup, media processing, platform acceptance, and retries take time. The
recent completion delays above are measurements, not a latency guarantee.

There are no recent completed YouTube schedules in the October 4 onward sample,
so this audit does not claim fresh production acceptance of that provider. Its
future-time guard was exercised with mocked publisher tests. Historical provider
errors include revoked connections, token refresh failures, invalid media,
TikTok restrictions, and render-finalization failures. The eight saved failed
render-finalization records are from September 24 or earlier (two cancelled,
six drafts); they are not runnable overdue scheduled targets.

An authenticated browser session was unavailable, so new signed-in production
UI submission was not performed. Historical production traces and the real
provider success log provide the actual publishing evidence. The exact tomorrow
example is a local simulation, not an observed future publication. Older Vercel
runtime logs could not be retrieved because this project's plan retains only
one hour; the durable database records and retained Google Cloud worker logs
were used instead.

No production schedules, jobs, credentials, database schema, or deployments
were changed by this audit. No customer content was published or republished.
