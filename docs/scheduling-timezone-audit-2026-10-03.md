# Scheduling and time-zone audit — 2026-10-03

The early-publishing defect is confirmed on `vtu19403@veltech.edu.in` and fixed
at the production database boundary. Application improvements and an additional
worker guard are implemented locally and require deployment.

## Evidence

- The Firebase admin lookup resolved the supplied verified account. No password,
  impersonated session, or test social publication was needed.
- The account had 145 published targets; 48 published before `scheduled_for`.
  Every one of those 48 jobs had a `job_recovered` event.
- A post scheduled for **2026-10-02 18:00 Asia/Calcutta** published at
  **2026-10-02 17:15:56**. Another scheduled for **2026-10-04 18:00** published
  on **2026-10-03 17:21:40**.
- The account's persisted onboarding zone is `Asia/Calcutta`. India 18:00 was
  correctly stored as 12:30 UTC. The early execution was not an offset error.
- At audit time, 49 of 190 published targets across the project were early.
  Counts are historical database observations, not an ongoing monitor.

## Root cause and live correction

Publishing jobs are created immediately and intentionally stay queued until
Cloud Tasks reaches the requested instant. Generic recovery treated their lack
of delivery for 15 minutes as a stall, incremented their attempts, and delivered
them immediately. Its selector and locked recovery did not inspect the target's
schedule. The worker recorded negative execution delay but did not prevent
provider publishing.

The production migration gates recovery selection, locked recovery, and
`claim_background_job` using the current target's owner, `publish_job_id`, and
`scheduled_for`. A future target cannot be recovered or claimed. Retry waits
are honored without clearing `next_attempt_at` or incrementing attempts.
Cancelled/published targets still support cleanup; due jobs remain claimable.
The existing target job index serves the new lookup.

Applied migration history and local filenames match:

- `20261003121102_prevent_early_social_publishing.sql`
- `20261003122024_account_timezone_preferences.sql`

The new worker check additionally defers any early-delivered post before
provider operation claims, credential refresh, media preparation, or API calls.
This code is not yet deployed. The database guard is already active for the
running publisher.

## Time-zone behavior

The previous screens detected `Intl.DateTimeFormat().resolvedOptions().timeZone`
from the browser. Onboarding already persisted a regional zone, but publication
forms independently used the current device, and the video drawer offered no
zone selector. Small fixed lists containing India were options, not a global
India default.

The new account preference initializes once from the browser region after
verified sign-in, including the initial signup session. Existing onboarding
zones are backfilled. Later sign-ins retain the saved region. Scheduling and
inline Carousel/video drawers use the same default and support per-post zone
selection. Existing posts retain their stored zone. Manually entered dates/times
pin the displayed zone against a late preference response. New automatic slots
are calculated using the selected region, including dates near midnight.

Detection follows the browser/OS regional setting; it does not infer a zone
from an email address or request precise location permission. UTC is used only
when detection is unavailable. India IANA aliases remain accepted. Existing
date conversion rejects nonexistent and repeated daylight-saving wall times
instead of guessing an instant.

The preference table has RLS and no public/authenticated grants. Its invoker
function is executable only by `service_role`. The API derives ownership from
the verified Firebase user and ignores a submitted user ID. The security
advisor reported only informational RLS-without-policy guidance for this table;
that deny-by-default configuration is intentional for server-only storage.
See [Supabase's linter explanation](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

## Validation and limits

- Production `scripts/verify-social-publish-time-guards.sql` passes: future
  recovery/claim denial, unchanged attempts while waiting, exact due-time
  eligibility, retry waits, orphan/owner mismatch denial, and generic recovery.
- Production `scripts/verify-account-timezone.sql` passes: initialize once,
  preserve region on another login, isolate owners, reject invalid zones, and
  enforce grants. Both scripts roll back all fixture writes and events.
- Tests cover 18:00 conversions and round trips for India, New York, London,
  Tokyo, Sydney, Nepal, and Chatham, as well as daylight-saving gaps/overlaps.
- Worker tests preserve cancellation, duplicate reconciliation, provider
  persistence, account lanes, and transient/permanent retry behavior. Trending
  tests retain exact chosen times, account selection, and render finalization.
- App TypeScript, worker TypeScript, scoped ESLint, and diff whitespace checks
  pass. The final focused suites pass **195 tests**: 92 scheduling/region/API
  checks, 48 worker/processor checks, and 55 Trending publishing checks.
- `https://www.getugcpilot.com/scheduling` redirects to sign-in in the available
  production browser. Authenticated deployed UI acceptance remains pending;
  database behavior was verified against the real production project.

Publishing begins when the chosen instant arrives. Network delivery, worker
startup, platform processing, and retries can make the final public post appear
later. These fixes prevent publishing before the stored instant; they do not
promise zero provider latency. Previously published posts are not removed or
rescheduled, and no content was republished during verification.
