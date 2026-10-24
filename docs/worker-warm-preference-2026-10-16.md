# Warm editing and finishing preference — October 16, 2026

After reviewing the idle cost and cold-start tradeoff, the user requested that
the two previously warm services remain warm. Carousel editing and Explore video
finishing now have a service-level minimum of one each. Revision minimums stay
zero and unused historical tags remain removed, avoiding the previous eight
warm referenced revisions. This supersedes the idle-zero preference in
`worker-idle-cost-rollout-2026-10-16.md`.

Request-based CPU/billing remains enabled. Warm minimum instances can incur the
reduced idle rate. The minimum is a managed warm target, not a guarantee that
every request avoids startup: instances may restart or additional instances
may need to start under load.

No container image, environment, timeout, CPU/memory, per-instance concurrency,
job handler, queue limit, task URL, IAM policy, customer data or schedule was
changed. The current idle0-named revisions remain current: their name records
their creation, while the service-level minimum is now one. Carousel generation
continues scaling 0-2 separately.

Terraform validation passed for the Carousel and video worker modules. Live
configuration and before/after runtime hashes are recorded in
`.codex-audits/worker-warm-restore-*.json`. Old revision tags remain absent.
Only the scoped infrastructure changes and this chat's context sections are
released; ongoing publishing-preference and Explore UI changes are excluded
in `.codex-audits/worker-warm-restore-excluded-worktree.txt`.
