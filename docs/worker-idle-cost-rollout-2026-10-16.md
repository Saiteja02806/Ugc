# Editing and finishing idle-cost rollout — October 16, 2026

Carousel editing and the Explore finishing HTTP video service now have zero
minimum instances. They keep request-based CPU allocation. Unused historical
revision tags were removed, eliminating the previous eight-instance warm floor
across their referenced revisions. The first request after an idle period may
wait for startup. This is a latency tradeoff, not a job-format or output change.

## Change boundary

- `ugc-carousel-edit-worker-r-cdf8c936-idle0` receives 100% of editing traffic.
- `ugc-video-render-worker-r-cdf8c936-idle0` receives 100% of finishing traffic.
- Both retain image
  `sha256:9b98fe7679f0b4ea1c8448b87d55994a79a2eb23a0303afa0cb86337467147d4`.
- Hashes of each complete runtime container spec match before and after:
  images, environment/secrets references, resources, service identity, timeout,
  startup probes and request concurrency are unchanged. No IAM mutations ran.
- Service/revision minimums are zero. Request-based CPU throttling stays true.
  Existing maximums are retained. Old revisions were retained for rollback;
  only their unused traffic tags were removed.
- Cloud Tasks queues remain RUNNING with their original rate/concurrency
  limits. The video-render Cloud Run Job, scheduler jobs, recovery, billing,
  customer media, saved drafts and all application code were untouched.
- Terraform no longer hardcodes one warm editing instance or implicitly forces
  one warm video instance when interactive Explore finishing is enabled. The
  ignored local video Terraform variable file also has minimum zero. Do not
  blanket-apply old release image variables without reviewing the full plan.

## Verification

Production Vercel routing variables were checked using the environment tools:
Carousel edits use the untagged edit-service base URL, and Explore finishing
uses the untagged video-service `/tasks/jobs` URL. Both queues were empty and
there were no active edit/finishing jobs before rollout. The seven-day log
sample had 31 requests, one using a historical tagged URL; that was a GET
`/version` check on October 14 IST, not an operational render task.

Terraform validation passed for both modules. Using the repository's required
Node loader/TypeScript flags, 38 queue-routing, subtitle/finishing and recovery
tests passed, including composition, upload/finalization, ownership, cancellation
and saved-output reuse. Thirteen Carousel edit-render regressions also passed.
Initial test invocations without the required loader/transform flags failed to
initialize; the corrected invocations passed all 51 tests.

Two authenticated Cloud Tasks were submitted to the unchanged service URLs with
random nonexistent job IDs. Each new revision read the job store, safely dropped
the absent job, and returned HTTP 200. No synthetic database record, customer
mutation, media generation, transcription/provider call, or publication was
created. Both startup logs report verified cdf8c936 build/runtime identity.
These are routing/startup/auth/database-access checks, not end-to-end customer
render acceptance or proof of a restart after an observed zero-instance period.

At rollout completion, scale-to-zero is configured. Instance metrics are delayed
and idle removal is asynchronous; do not claim that all physical instances have
already disappeared. Under request-based billing, minimum-zero idle instances
do not carry the minimum-instance idle rate. Starts, shutdowns, requests,
retained storage and scheduled execution can still incur costs.

Before/after snapshots, configuration hashes, delivery logs and test logs are
in `.codex-audits/idle-scale-*`. Unrelated ongoing publishing-preference and
Explore UI changes were excluded, with exact paths in
`.codex-audits/idle-scale-excluded-worktree.txt`. Only this change's sections of
the shared context files are included in the scoped release.

## Recovery

If first-request startup latency is unacceptable, restore minimum one on the
current service/revision while retaining request-based billing. Do not restore
unused historical tags merely to keep a worker warm. Historical image/revision
rollback remains available, with the warning that old revisions may contain a
positive minimum. No application migration or data rollback is needed.
