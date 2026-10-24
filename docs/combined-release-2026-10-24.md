# Combined release — 24 October 2026

The user authorized deployment of all intentional current changes and production
verification afterward. This supersedes the earlier pause. Rollout is in progress;
this initial inventory does not claim live acceptance.

## Included

- Explore: twenty approved cleaner Hook frames; hide Hooks 27/84/89 from new
  discovery; immutable v3 frame receipts, legacy recovery, matching motion
  suggestions and history. Hook 88 remains unapproved and keeps frame zero.
- Starting images: five supported still models, shared v4 prompt, provider error
  explanation, inline person photos, complete images and variation inspection.
- Hover-only reference previews, responsive generated-video results, scheduling
  footer/visibility corrections, and shared reusable saved post captions.
- Hook Remix v7 and its preserved experiment/evaluation documentation.
- Trending slideshow edit-save navigation recovery, paired slide rendering,
  dedicated edit-worker instance cap two and queue dispatch concurrency two.
- Landing hero/brand spacing/copy and all intentional accompanying source,
  configuration, tests, migration, scripts, documentation and approved PNG assets.
- Regression review: refreshed stale harness imports and assertions for current
  catalog membership, exact source-duration display, explicit WAN reference mode,
  native audio resolution and the shared preview styles. Ordinary video reads
  no longer fetch a generation job unless Remix provenance was requested.

## Prerequisites and order

Saved-caption migration applied in production as `20261024061601`; local source
filename matches. The table is RLS-enabled and inaccessible directly to anon and
authenticated roles. Only the service role receives SELECT/INSERT/UPDATE.
No customer caption rows were created or modified for this migration.

Hold automatic Vercel builds before pushing. Release one complete source revision,
build a pinned worker image, update relevant six worker services and two
production jobs, and verify baked/runtime SHA and ready traffic. Apply the exact
dedicated edit queue/instance scaling change while preserving identities,
secrets, ingress and unrelated settings. Then stage/promote website and MCP
builds from that source and restore their prior ignored-build-step settings.
Live acceptance uses `https://www.getugcpilot.com`.

## Exclusions

No intentional Git-visible project path is excluded. Full included-path and
content-hash inventory is recorded alongside this report before commit.

Excluded local paths/categories are `.env*` containing local credentials,
`.tools/**` credentials/dependency caches, `.vercel/**` local account/project
metadata, `.next/**`, `node_modules/**`, `worker/node_modules/**`, `worker/dist/**`,
`.tmp/**`, `outputs/**`, `output/**`, `artifacts/**`, `.release-worktrees/**`,
`.codex-artifacts/**`, `.codex-audits/**`, ignored `*.log`, Terraform
`.terraform/**`, `*.tfstate*`, `*.tfplan` and secret-bearing local `*.tfvars`.
These are credentials, generated build/cache state, local QA receipts/media or
environment-specific deployment state. Terraform source changes are included.
Canary-only jobs and the unrelated Tinder deck service are outside this worker
release; active production workers/jobs sharing this source remain in scope.

## Validation and acceptance

Combined application regression suite: 1,316 tests pass. Worker compilation and
729 worker checks are validated; five cache tests initially hit sandbox-denied
atomic file renames and their six-test file passed with normal temporary-file
access. Seventy provider-adapter checks pass with providers mocked. Website
production build, type checking, native-route bundle verification, scoped lint,
migration guard and seven migration/database tests pass. Terraform formatting
checks pass; the two scaling fields will be applied through the supported Cloud
Run/Cloud Tasks APIs because the local Terraform provider executable is blocked
by Windows Application Control. No protection is disabled or bypassed.

The complete included-file hash inventory is
`combined-release-inventory-2026-10-24.json`; ignored local entries and their
reasons are in `combined-release-excluded-paths-2026-10-24.md`. Rollout receipts,
source SHA, target verification and live acceptance are saved in ignored
`outputs/release-2026-10-24/`. This document freezes preflight scope; it does not
claim that a passing local fixture is hosted acceptance. No new paid media
generation or social publication is implied by opening Recreate or by a build.
