# Complete pending release - 17 October 2026

Production was verified on `6ecae38d1d47e05da9ac4f68f64577b760da36da`:
website, MCP, six Cloud Run worker services and two production jobs agreed.
The earlier public `/hookvideos` gallery, `/aivideos` redirect, Hook Remix
ending correction, slideshow attachment/history fixes and media-start timing
support are already included in that release.

This follow-up preserves all current production code and includes every pending
intentional workspace change: Trending concise-copy admission, two-line heading
regressions, fixed backend-owned batch keys, and the Saved demos inventory/upload
correction for Hook and Talking Head workflows. The source inventory records
each audited path as already released or included. No intentional path is deferred.

## Ordered rollout

1. Validate the isolated checkout based on current production main; commit and
   push the complete release. Hold automatic website/MCP Git builds while staging.
2. Confirm the production migration ledger matches the release checkout. All
   143 version/name pairs match; no SQL or migration-ledger change is required.
3. Stage website and MCP production builds from the exact source commit, keeping
   current domains on their healthy deployments. These builds must pass Next.js
   TypeScript checking before promotion.
4. Build a new immutable worker image with the same commit embedded. Roll out
   all six UGC worker services, then update video-render and carousel-replenishment
   jobs. Preserve secrets, IAM, routing, resources, scaling and timeouts. Do not
   execute jobs or change canary services or `ugc-tinder-deck`.
5. Verify readiness, image digest, commit identity and explicit revision traffic
   on all eight targets. Promote the ready web/MCP builds, restore automatic Git
   builds, and verify production domains and public/authentication boundaries.

## Validation and limits

The isolated release passed worker compilation, 145 worker checks, 139 changed
Explore checks and 30 feed/replacement/style-mixer database checks. Scoped ESLint
passed with zero errors; pre-existing unused-symbol warnings are recorded in local
evidence. All bodies retain maximum-length and measured-fit validation, factual
checks, role boundaries and bounded repair budgets.

The shared local app dependency installation is incomplete. A full isolated npm
install ran out of disk space and only that incomplete install was removed.
Small standalone validation tools recovered lint and database tests. Local app
TypeScript and the component browser fixture could not be accepted with the
broken shared dependencies; hosted production builds and post-rollout verification
are required. No compile checks are disabled to work around these limitations.

No paid generation, publication, scheduling or automatic recovery of previously
failed customer slots is part of deployment verification. Fresh model output
quality and signed-in generation acceptance are separate from deployment health.

## Exclusions

No intentional source, configuration, migration, script, test or documentation
path is excluded. Ignored local artifacts remain excluded: `.env*` except tracked
`.env.example`, `.tools/**`, `.tmp/**`, `.vercel/**`, `.release-worktrees/**`,
`node_modules/**`, `worker/node_modules/**`, `.next/**`, `worker/dist/**`,
`*.tsbuildinfo`, logs, generated previews, private Terraform state/variables and
Supabase local state. These contain credentials, local tooling or generated data.

Exact commit, deployment IDs, immutable digest, rollback snapshots, configuration
comparisons and production check receipts are kept under ignored local evidence
`.tmp/trending-planner-release-20261017/`; they are recorded only after observation.
