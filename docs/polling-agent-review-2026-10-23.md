# Polling changes: agent implementation and review

Local work only. No deployment, paid generation, database or worker changes.
The large existing working copy was preserved; changes here concern browser
status reads, recovery and their regression fixtures.

## Agent work and parent review

- Inactive-panel agent implemented backward-compatible enabled propagation and
  retained discovered job IDs. Parent review caught the distinction between
  `enabled` and format-scoped `recoveryEnabled`: standalone AI Studio must keep
  reading known IDs without an Explore format. Thirteen actual hook/observer tests
  now cover inactivity, reactivation, completion, account changes and coverage.
- Status-coordination agent wrote a fresh active-list receipt policy and 18
  tests. A second agent identified equal-timestamp conflicts; differing payloads
  now force a detail GET, including timestamps differing below millisecond
  precision. Parent integrated the policy only into recoverable workflow jobs.
- Independent reviewer reproduced hung recurring Audio/Reaction reads and
  Audio saved-receipt starvation in failing tests. Parent fixed these and the
  additional partial-failure case. All four independent regressions pass.
- Agents independently reran and reviewed the integrated code. Parent reviewed
  the code and combined results rather than accepting agent summaries alone.

## Resulting behavior

Inactive AI Studio panels stop initiating list/detail polling, focus and reconnect
reads. Saved/discovered IDs and already arriving results remain available. Server
work continues and reactivation reconciles completion; owner-scoped keys prevent
cross-account cache reuse.

Automatic workflow detail reads may use a matching public job receipt from a
currently observed, enabled, successful account-owned active list no older than
7.5 seconds. Invalidated, failed/retrying, stale, inactive or missing list entries
fall back to normal authenticated detail GETs. Newer detail data and ambiguous
equal-time changes are never overwritten by a stale list snapshot.

Explicit returned `refetch()` invalidates only the exact detail query, then reads
the server. Direct multi-job consumers retain their old default behavior. This
keeps Check status authoritative. Completion after active-list disappearance is
collected through a real detail read; list absence never means completion.
An additional review regression found a cached terminal job remaining stopped
after another tab retried the same ID. A fresh active-list entry now restarts
its detail checks; stale lists cannot revive newer terminal state, and ambiguous
equal-time receipts still require an authoritative GET.

Recurring Audio and both Reaction loops now bound status reads using the existing
20-second deadline. Mutations are not wrapped or replayed. Audio reads general
history when other jobs are pending, with exact-key fallback for an older saved
receipt outside that history window. Successful general-history updates survive
a failed exact-key lookup, while its saved key/error and backoff remain intact.

## Evidence

- Final combined regression run: 225 tests pass, zero failures. Includes prior
  starting-image recovery, Hook/Wall/Slideshow recovery, owner/auth/cache,
  Audio/Reaction, finishing and pending scheduling checks.
- Scoped ESLint and application TypeScript pass. The final production webpack
  build and postbuild Hook decoder bundle verification pass.
- Same controlled three-job, twelve-cycle QueryClient scenario: 48 requests
  before versus 12 with coverage, followed by three terminal detail GETs in both
  scenarios (51 versus 15 total). This assumes list-first controlled scheduling;
  real network timing can produce extra safe fallback reads. It is not a measured
  production invoice reduction.
- Hook integration tests verify fresh-list reuse, two consecutive explicit
  refetches reaching the server, disappearance collecting final output, failed
  lists falling back and inactive covered panels remaining quiet.

Logs: `.tmp/polling-agents-2026-10-23/tests-final.log` and `build-final.log`.

## Remaining review and next steps

General terminal-job mount/reconnect cache tuning remains conservative: collected
outputs, explicit retries, status transitions and output collection must continue
to refresh. Do not globally freeze terminal queries merely to reduce counts.
The terminal cached job reappearing after a same-ID retry is fixed and tested.

After the polling batch, measure Settings section chunks before lazy-loading
heavy sections. Production request/byte attribution, actual mobile-device checks
and authenticated acceptance require the real production domain after a separately
authorized release. Default Turbopack remains unqualified from previous batches;
the supported webpack build is the local compilation check. Query result wrapping
may subscribe to extra status flags; this is a minor render-optimization candidate,
not evidence of a user-visible regression.
