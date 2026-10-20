# Carousel request-based autoscaling — October 16, 2026

The Carousel generation service now permits two parallel jobs with one HTTP
request per instance, request-based CPU allocation, and zero minimum instances.
Both service-level and revision-level maximums are two, and the running Cloud
Tasks queue permits two concurrent dispatches at one dispatch per second.
Interactive Carousel edits and all other worker types are unchanged.

The initial bottleneck was a shared single processing slot. Twenty batches
from five accounts arrived in one minute ahead of the affected account's ten
batches. In a small recent production sample, Structure 1 averaged 108 seconds
per batch and Structure 2 66 seconds. Repairs and replacements add workload;
increasing parallel capacity does not establish that each plan succeeds.

## Safety evidence

- Ten concurrent production ownership calls for one synthetic batch created
  exactly one job. Ten different batches created ten different jobs. All 55
  generations and content-plan items retained their exact job ownership.
- Ten concurrent claims for one synthetic job yielded one successful claim.
- Ten image-reservation calls for one synthetic carousel returned identical
  six-slide reservations. Ten independent carousels also reserved successfully.
- Synthetic fixtures and their 66 image-usage increments were removed through
  the management connection, and zero remaining fixture records were verified.
  No task delivery, generation provider request, or customer payload was used.
- Four ownership contracts and eight image-rotation regressions passed.
  Terraform validation passed for the worker and foundation configurations.

Repeat ownership checks with the management-only fixture SQL, then
`node scripts/check-carousel-parallel-ownership.mjs --execute --fixture-user <returned-user>`.
Run the management-only cleanup SQL with that exact synthetic owner afterward,
including after a failed/interrupted check. The ordinary service role cannot
delete generation rows; no permission expansion is necessary.

## Production rollout

Revision `ugc-carousel-worker-r-cdf8c936-as2` serves 100% traffic with the unchanged
production image `sha256:9b98fe7679f0b4ea1c8448b87d55994a79a2eb23a0303afa0cb86337467147d4`.
The application source was not rebuilt for this infrastructure-only change.
Request-based CPU throttling remains enabled and per-instance concurrency one.
Unused historical release tags were removed after all queued task targets were
verified to use the untagged service URL. Revisions remain available for rollback.

Production observed two active jobs simultaneously at 00:51 IST. At that check,
the affected account had 12 ready positions and 38 pending positions. This is
evidence of parallel processing, not complete delivery of today's pack or a
controlled latency benchmark. Idle scale-down remains unobserved during backlog.
Do not promise a completion time or increase beyond two from this evidence.

The gcloud rollout preserved the current image and environment. The ignored
local Terraform variable file has old image metadata from an earlier release;
do not perform a blanket Terraform apply until release metadata is synchronized
and its complete plan reviewed. This rollout used narrowly scoped service and
queue updates. The tracked Terraform scaling policy matches production.

Rollback: reduce `ugc-carousel` queue maximum concurrent dispatches to one,
allow in-flight work to settle, then return service/revision maximums to one if
needed. Keep request-based billing and ownership guards. For healthy growth,
observe queue age, overlapping claims/reservations, provider throttling,
generation outcomes and cost before considering a further increase.

Local evidence is recorded under `.codex-audits/carousel-autoscale-*.json` and
`.codex-audits/carousel-parallel-*-canary.json`. Concurrent publishing-preference
and Explore changes are excluded from this scoped infrastructure release.
