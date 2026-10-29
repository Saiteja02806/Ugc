# Analytics freshness on return — 24 October 2026

The event-only/no-periodic-read policy below is superseded by the user's renewed
freshness request and the [29 October automatic-check follow-up](analytics-freshness-fix-2026-10-29.md).
Provider cooldowns remain unchanged. This document retains the historical behavior
and validation; neither receipt constitutes authenticated production acceptance.

Status: implemented and tested locally. No deployment, migration, production
database mutation or live provider synchronization was performed for this task.

## Why older data could stay visible

The active `/analytics` route mounts `InstagramAnalyticsWorkspace`, which uses
the shared snapshot resource hook. The old browser freshness windows were 30
minutes for Instagram and five minutes for TikTok/YouTube. A server snapshot read
could consider Instagram current for another hour. Recent post metrics and feed
discovery separately used one-hour windows. Reading a server snapshot does not
itself fetch new provider metrics, so reducing only the browser cache would not
address all of that delay.

The publishing-activity query used a 30-minute cache and inherited the account
QueryClient's disabled focus refresh. Also, the usual visibility-change handling
does not cover a laptop returning to the same visible tab with only a window
focus/pageshow event. A manual Refresh event could remain selected indefinitely,
leaving the mounted hook attached to its historical manual refresh query.

These findings come from repository behavior and isolated browser reproductions;
they are not a measured trace of the user's production visit.

## Behavior now

- Saved metric snapshots and publishing activity use a one-minute browser
  freshness window. Screen entry/remount, tab visibility, window focus,
  pageshow and reconnect can revalidate stale data. Fresh data remains cached.
- There is no recurring timer for fetching snapshots/activity and no background
  provider refresh loop. A visible idle page sends no snapshot requests merely
  because its data becomes stale. A subsequent entry/return event performs the
  check. A burst of return events joins the current read rather than cancelling
  it and issuing replacements.
- The extra window-return listener respects visibility, connectivity and a
  one-minute attempt/error cooldown. Normal TanStack visibility/reconnect
  behavior remains available. The helper is local to Analytics and does not
  alter global QueryClient defaults or other screens.
- Server synchronization is separate: Instagram account/feed and posts published
  in the last day become eligible after fifteen minutes. Posts aged one to seven
  days retain six-hour metric caching; older posts retain daily caching. Signed
  thumbnails retain their independent twelve-hour policy. YouTube/TikTok retain
  their five-minute server policy.
- GET remains a private, authenticated, read-only snapshot operation. A due
  snapshot enables a background-sync POST, with existing active-job reuse,
  authorization checks, idempotency and cooldowns. Automatic attempts can try
  again on a later visit after a failed start; explicit Refresh clicks do not
  replay on focus. Successful saved data stays visible during errors/refresh.
- A completed manual attempt is consumed after the next successful authoritative
  snapshot read. This uses cache event ordering, so responses completing within
  one millisecond cannot strand the hook in manual mode. A refresh-start error
  stays visible through the cooldown instead of disappearing behind a concurrent
  successful snapshot read.
- Only a known active sync job receives temporary status polling. Those existing
  checks pause while hidden and stop at completion/failure/cancellation or the
  fifteen-minute observation limit. This is distinct from repeatedly querying
  social providers or continuously refreshing the Analytics dashboard.
- Account, date range and authorization revision remain separate cache scopes.
  Unselected platforms do not prefetch. The existing request deadline still
  bounds token acquisition, HTTP and parsing together.

The UI can display provider data only after the provider exposes it. These
changes remove extra application cache delay; they cannot promise immediate
Instagram/TikTok/YouTube metric availability.

## Verification

- All 103 `lib/analytics` tests pass. New coverage checks the fifteen-minute
  boundary, unchanged older-post windows, read-only GET and server sync admission,
  return-event deduplication, visibility/offline/error guards and listener cleanup.
- The existing actual-workspace Edge fixture passed with the new cases:
  laptop/window focus updates metrics plus publishing activity; wake-event bursts
  issue one read per resource; fresh server snapshots issue no refresh POST;
  two minutes of visible idling issue no periodic reads; completed manual Refresh
  permits a later automatic cycle. Existing range/owner/consent isolation,
  stale-content preservation, hidden polling, terminal-job stopping, queue errors,
  deferred platforms and initial storage-error recovery also pass.
- Browser boundaries are local fixtures, with controlled clocks/events; this is
  not a real laptop sleep study or authenticated production acceptance. Browser
  evidence: `.tmp/analytics-return-browser-final4.log` and
  `.tmp/analytics-loading-browser/results.json`.
- Unit evidence: `.tmp/analytics-return-all-tests.log`. Application TypeScript
  and scoped lint are checked separately; no provider calls are required for
  these local checks.

## Release acceptance

Website release required; no worker code or migration needed. Before accepting
the fix as live, sign in on `https://www.getugcpilot.com`, open Analytics, leave
and return after data is stale, and confirm its saved-data GET and any eligible
background job update the observed screen without a browser refresh. Confirm
fresh immediate returns add no duplicate reads and active idle time does not
produce recurring Analytics requests. Measure provider lag separately from
request, queue, and UI update latency.
