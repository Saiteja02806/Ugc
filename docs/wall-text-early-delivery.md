# Wall-of-text early delivery

The 200-idea planner keeps running as one durable job. Every ten ideas (two
complete briefs), its current worker claim commits the chunk and a publication
event in one transaction. An opted-in daily writer may use fresh published ideas
before the plan becomes active. Full activation still requires 200 ideas and 40
briefs, and incomplete plans cannot recycle used ideas.

The database serializes daily writer admission by business profile. One intent
owns a feed's Wall slot count, explicit retry key, generator and layout versions. Repeated notifications,
changing requested counts, and partial writer output reuse that intent's job.
Other in-flight Wall jobs are allowed to finish before admitting a new intent.
The request must have enough unused published inventory for its whole batch.
Manual Wall preparation outside the daily feed retains the full-plan gate.

The worker makes an awaited, five-second wake-up request after committing a
chunk. A failure leaves the event available to `/api/internal/jobs/recover`.
Publication claims have tokens, so a late acknowledgement cannot complete a
newer claim. The callback reconciles only Wall content. Recovery also resumes
failed opted-in plans independently of whether today's feed is already full;
automatic reopening stops after three planner jobs. Existing job retries remain
bounded by each job's attempt budget. Explicit feed retry uses a new retry key.

## Rollout and rollback

1. Apply the additive migration, then the global-default migration.
2. Deploy the app and AI generation worker, then verify both versions.
3. Every new Wall plan receives `early_delivery_enabled = true`; the insert
   trigger also maintains `wall_text_early_delivery_accounts` for publication
   and recovery queries. Existing plans retain their original lifecycle.
4. Observe published count, publication delivery, writer identity, item
   reservations, first-ready time, and eventual full activation.

To stop new early admissions, disable the account flag. An existing intent keeps
permission to finish, even when the flag is off. Do not remove the additive schema
or revert the worker until admitted jobs and opted-in plans have settled. The old
worker save/completion entry points reject opted-in plans because they do not
carry a worker claim. Publication delivery and planner recovery are separate
from finished post availability.

## Verification

`npm run test:wall-text-early` runs the worker interruption tests and an embedded
PostgreSQL test that replays the complete canonical migration chain. SQL tests
cover publication atomicity, stale claims, cancelled workers, inventory shortfall,
duplicate admission, acknowledgement fencing, rollback-safe reservations,
partial-plan non-reuse, full-plan activation and browser-role access denial.
Embedded PostgreSQL serializes requests; its duplicate-call test verifies
idempotency, not independent database-session lock contention. Production
verification must additionally exercise concurrent requests and real queue
delivery. `npm run test:wall-text` checks the existing Wall contracts.

No fixed first-post latency is promised: model duration, source readiness and
the shared AI worker queue still affect it. The live test must measure first-ready
time and verify that the rest of the plan finishes without replacing saved posts.
An account with an already complete plan cannot measure initial planning latency
without a separately authorized fresh plan and fresh Wall demand.
