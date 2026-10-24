# Analytics performance audit — 22 October 2026

The freshness windows and return-event behavior below are superseded by the
locally verified follow-up in `analytics-return-refresh-2026-10-24.md`. The
historical test results here still describe the 22 October implementation.

## Scope and verified changes

Reviewed the active Instagram Analytics workspace, deferred YouTube/TikTok panels, snapshot requests, job observers, account/range cache identity, and the snapshot/activity API source. The older multi-platform dashboard in `analytics-dashboard.tsx` is dormant and is not on the user-facing route.

- **Stale data after returning to a mounted tab:** snapshot queries explicitly disabled focus revalidation. A stale snapshot can now revalidate when the tab becomes visible. Saved content stays rendered during the read; returning again while it remains fresh adds no snapshot requests. This retains the existing 30-minute Instagram and five-minute YouTube/TikTok browser freshness policies.
- **Authentication could hold loading indefinitely:** the previous 20-second request timeout started after Firebase token acquisition. Authentication, fetch, and response-body parsing now share the existing `withReadDeadline` boundary. Late token acquisition checks cancellation before issuing any GET or refresh POST. No automatic refresh POST retries were added.
- **Completed job requests resumed unnecessarily:** job eligibility used the initial POST's job status, which could still say `processing` after a completed poll. Eligibility now uses the latest observed job, so completed, failed, cancelled, or expired jobs stay stopped when visibility changes.

## Existing behavior retained and checked

Snapshot reads return saved data before provider synchronization; account identity can render while metrics/activity are pending. The two independent Instagram snapshot requests run without waiting for each other. Unselected social platforms do not prefetch analytics. Owner, connection authorization revision, and date range form distinct cache identities. Existing content survives refresh-start errors, hidden job polling pauses, platform changes cancel old reads, and repaired initial storage errors recover with Refresh.

The server snapshot source already avoids provider dispatch during GET and scopes account rows to the authenticated owner and authorization revision. The activity source reads paginated, thin target records and requests titles for visible rows. No production database, index, provider, or dispatch changes were made.

## Local verification

- All 100 tests under `lib/analytics` passed, including six new request-client tests for stalled authentication/transport/body parsing, owner checks, and cancellation.
- The isolated Edge browser fixture exercises the actual workspace/hooks with mocked hosted boundaries: account rendering independent of metric reads, deferred platforms, preserved stale content, a mounted tab returning to a 31-minute-old snapshot, fresh focus deduplication, job completion delivery, stopped terminal jobs, hidden polling, range/authorization/owner isolation, and retry recovery.
- Scoped ESLint passed. Root-level TypeScript/build verification is coordinated separately.

These are local fixture and source-code checks. They do not establish production API timings, provider synchronization time, cold-start latency, or a real 30-minute heap profile. Deployment remains paused; final authenticated acceptance and timing measurements must use `https://www.getugcpilot.com` after the intended release is deployed.
