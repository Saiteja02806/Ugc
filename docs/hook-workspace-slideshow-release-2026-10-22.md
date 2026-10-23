# Hook workspace and slideshow execution release — 22 October 2026

Status: **PAUSED by the user** before source push or website/worker deployment.
The separately approved additive slideshow-plan migration had already succeeded.
Keep it in place; do not resume deployment without a new user instruction.
This pending release follows PR #81.
Release branch: `codex/hook-workspace-slideshow-release-20261022`, based on
`b81f02e767486be2882436fddbbbb71b56d50250`.

## Complete scope

- Hook Recreate opens a focused overlay, with source and person/model/count inputs
  above a generated-results grid. Each image has Use this. The right-side Starting
  frame tab is removed. The existing Create image box receives the selected scene;
  Change opens a Starting frames library with verified recent owned results.
  Enlargement, retained preparation and repeatable Recreate remain.
- Gallery Hook preparation cannot silently use the legacy source-video edit
  contract. Approval hands the verified image and reviewed motion directions to
  the composer. Pending accepted jobs retain their frozen recovery contract.
- Wall references 08 and 09 are removed, including stale cached gallery data.
- Stable named slideshow uploads/source numbers, private image-aware planning,
  per-output base/attachment isolation, provider labels and version-4 contracts.
  Prior accepted version-2/3 requests keep their existing behavior.
- All associated API, worker, UI, test, script and documentation changes in the
  audited worktree are included. No intentional source fix is omitted.

## Database

Approved additive migration applied successfully in production. Supabase recorded
version `20261022092140`; the local migration filename and references were aligned
with that authoritative version. It creates one private table and a service-only
security-invoker claim function. Verified RLS enabled, anon/authenticated reads
denied, anon execution denied and required service-role access granted.

Existing history drift is recorded, not silently repaired: local migrations
`20261020150800_recover_completed_provider_output` and
`20261021131000_default_trending_slideshows_to_structure_2` remain unapplied, while
production version `20261019173229` is absent from the local canonical history.
These predate this release. No deferred billing recovery change or default
content-mix migration was applied. The new slideshow migration matches its
production ledger version. Canonical reconciliation guard and parity unit tests
pass; complete historical ledger parity does not pass.

## Validation

- Combined application/UI/planning/recovery/catalogue suites: 355 passing tests.
- Worker/provider suites: 46 passing tests; worker compilation passes.
- Renamed production migration is independently retested in PGlite.
- Scoped source lint: zero errors, one existing VideoPanel image warning.
- Current UI changes require fresh visual acceptance. Browser access was rejected;
  prior screenshots show previous revisions. No paid generation was submitted.
- Production-target hosted builds and native decoder bundle checks are required
  before promotion. Local checks do not establish signed-in production acceptance
  or generated-image fidelity.

## Release sequence and evidence

1. Approve/apply/verify the additive database migration (completed).
2. Freeze the inventory and commit all intentional source changes.
3. Build/deploy the image worker from that exact commit and verify its active
   pinned digest plus baked/runtime commit identity.
4. Merge main and build/promote the website and MCP project with the same release.
5. Verify public production serving and release identities; record any remaining
   authenticated/browser acceptance gaps.

Ignored local evidence, including the complete path-by-path exclusion inventory,
is under `outputs/release-workspace-*`. Credentials/environment files, dependencies,
generated build/cache data, local checkouts, diagnostics and media are excluded.
The previously deferred 60-image public catalogue upload remains excluded.

Historical checkpoint: deployment was paused and these changes were local at this
point. The user resumed the complete release on 23 October. Current checks, scope,
excluded paths and deployment receipts are recorded in
`combined-release-deployment-2026-10-23.md`; use that record for current status.
