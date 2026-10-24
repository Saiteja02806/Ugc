# Trending slideshow Save recovery and latency

Implemented and verified locally on 24 October 2026. Production release remains
paused. Production database and Cloud Run/Cloud Tasks inspection was read-only.

## Findings

The browser previously treated `saving` as component-local state and did not
represent an already queued/rendering edit in the reopened editor's Save button.
The feed polled known pending records, but its initial saved-edit read swallowed
failures and did not retry. A navigation remount during PATCH could read before
the save completed. Token acquisition was outside the polling timeout.

The Carousel PATCH loaded a complete editor before saving, even though the save
service independently loads and validates authoritative source data. After
dispatch, it loaded the whole editor again inside the dispatch failure handler.
A failure of that final read could mark the accepted render failed. This path
is confirmed in code; no browser trace ties it conclusively to the user's exact
failed attempt.

Production examples for the reported account (UTC timestamps in DB):

| Job | Revision | Created | Start delay | Worker duration | Result |
|---|---:|---|---:|---:|---|
| `e4e3346b-37f8-4843-b45d-505f442ff8a2` | 4 | 2026-10-23 18:48:45 | 9.48 s | 17.34 s | Completed; all six slides rendered |
| `4b065ffa-7280-4516-b527-92bb04289d1c` | 3 | 2026-10-23 18:46:21 | 11.61 s | 9.87 s | Completed; one slide rendered |
| `dee570cc-4c81-45a0-b60b-7f77b4c876ab` | 5 | 2026-10-23 18:52:53 | 1.05 s | 4.50 s | Completed |
| `83663f06-e378-4977-87f2-4c5b76f905ce` | 2 | 2026-10-23 18:43:39 | 39.76 s | — | Failed: stale render |

Worker duration includes reads, raster work, uploads and state persistence; it
is not solely image rendering. These measurements exclude the preceding PATCH
validation and browser image loading. They do not establish a post-fix speedup.

Read-only infrastructure inspection found revision
`ugc-carousel-edit-worker-bodycopy-fac61da3` receiving 100% of traffic, 1 CPU,
2 GiB, one request per instance, revision maxScale 1 and queue concurrency 1.
Service minScale is 1. An initial observation of revision minScale 0 was
corrected after inspecting the service-level setting; cold starts are unproven.
Serial job capacity permits queue contention but the precise cause of each
historical wait was not traced through request-level Cloud Run logs.

## Changes

- PATCH returns the persisted queued record immediately after successful job
  dispatch, removing two full editor loads while retaining save-time ownership,
  source admission and optimistic revision validation.
- Shared browser requests bind the expected account and bound authentication,
  HTTP and parsing. In-flight writes are shared by owner/format/creative/assignment
  across route remounts. Navigation cancels obsolete reads, not accepted writes.
- Small saves (at most 48 KB UTF-8) use browser keepalive. Browser termination,
  network loss before receipt, or larger submissions before server acceptance
  cannot be guaranteed to commit. The UI does not claim those were saved.
- A failed/ambiguous PATCH receives one read-only recovery attempt. Only the same
  scope, next revision and submitted Carousel fields in a queued/rendering/ready
  state count as this save. No automatic PATCH replay is introduced.
- Reopened pending jobs show Rendering and a background-work explanation. Close
  leaves rendering running. Progress resumes on visibility/online return. Ready
  unchanged edits show Edits saved; new typing is preserved during refresh.
- The feed retries failed initial recovery, then adopts completed image URLs.
- Worker renders/uploads two slides per batch, drains both on failure and
  persists outputs in source order. Fingerprint reuse and ownership/revision/job
  fencing are unchanged. No partial slideshow becomes ready.
- Terraform prepares two edit-worker instances and two queue dispatches. It
  retains one warm instance and one request per instance; active resource usage
  can increase when independent edits overlap. Generation queues are unchanged.

## Verification

- 34 client/API/read-access tests passed, including single-write navigation
  recovery, lost response recovery, late-token cancellation, queue response and
  real dispatch failure handling, source admission and revision fencing.
- 18 worker tests passed, including real six-image raster/text visibility,
  unchanged-slide reuse, bounded concurrency, completion order, monotonic
  progress, draining a failed pair and no partial publication.
- Actual editor Edge fixture: desktop/mobile save, route unmount during PATCH,
  full document reload, pending/saved button states, foreground return, lost
  response, temporary status failures and preservation of newer unsaved typing.
- Actual Trending gallery plus editor, 1366x900 and 390x844: click Save once,
  navigate to another document before response, return after one deliberately
  failed recovery read, switch browser tabs while pending, complete render,
  return to the new image URL, leave/return again and reopen the saved editor.
  Exactly one PATCH per scenario. Headless visibility changes were also
  dispatched explicitly for deterministic event-listener coverage.
- Website TypeScript, worker compilation and scoped lint checked separately.
  Browser suites use local auth/API fixtures; no customer edit or render job was
  created by these tests. Existing unrelated workspace changes remain intact.
- Terraform formatting checks passed. Full validation could not load the
  installed Google provider because Windows Application Control blocked its
  executable, including outside the sandbox. Validate both infrastructure roots
  on an approved runner before applying; no bypass or infrastructure apply ran.

Evidence: `.tmp/trending-edit-final-unit.log`,
`.tmp/trending-edit-worker-tests.log`, `.tmp/trending-edit-browser-run3.log`,
`.tmp/trending-edit-feed-browser-final.log`, `.tmp/trending-carousel-text/`,
`.tmp/trending-history-recovery/saved-edit-return-{1366,390}.png`.

## Release and production acceptance

No migration needed. Release the dedicated Carousel edit worker, website and
matching queue/worker scaling configuration after deployment is resumed. Do not
substitute the general video-render service for the dedicated edit worker.
Terraform changes are prepared only; no infrastructure apply has run.

Final acceptance requires signing into `https://www.getugcpilot.com`, saving one
owned slideshow edit, switching screens/tabs and confirming the same job/revision
completes and its new image is shown without a second Save. Compare request,
queue, worker and image-load timings separately. Local fixture results do not
constitute that hosted acceptance or establish a production latency improvement.
