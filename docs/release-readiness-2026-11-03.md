# Release readiness and deployment order — 3 November 2026

Follow-up: see [release-gates-2026-11-03.md](release-gates-2026-11-03.md) for the current test, CORS and combined Linux gate results. The findings below describe the earlier review; its not-applied CORS and failing-test statements are historical. The rollout order and unverified hosted/image acceptance boundaries still apply.

**Status: PREPARED FOR REVIEW, NOT CLEARED FOR PRODUCTION.** No staging, commit,
push, image build/push, deployment, traffic change, job execution, SQL apply,
bucket-policy apply or Vercel setting change was performed in this review.
The request was treated as release preparation following the earlier no-deploy
boundary. Do not infer approval for production operations from this document.

## Complete scope

Inventory of the reviewed dirty worktree:484 paths plus the inventory receipt,
all included as intentional
project work, approximately403MB before Git compression. No visible intentional
path was silently excluded. Source, tests, config, migration syntax repair,
auth/social fixes, current UI and original/published media all remain in scope.
The inventory includes authoring media in Git even where the existing website
upload ignore excludes it. Ignore rules do not authorize deleting originals.

Exact path/state/size/SHA256 inventory and saved status are under
`.tmp/release-readiness-2026-11-03/inventory.json` and
`.tmp/release-current-status.txt`. Refresh the inventory before staging because
other work is continuing; this document/new evidence files need inclusion too.
The inventory is a preservation manifest, not a claim of exhaustive line-by-line
approval of all changes. No immutable release commit has been created yet.
Shareable inventory: `docs/release-readiness-inventory-2026-11-03.json`;
its own hash is omitted to avoid self-reference.

Existing ignored secrets/local environment files, dependencies, generated worker
output, Next caches/builds, temporary test output, CLI state and local credentials
must remain outside Git release inputs. `.env.example` is intentional template
source and remains included. No secret values were printed by this review.

## Verification and fixes

- Base application suite initially659/663PASS. Four failures referenced old
  selected-button classes, old Wall-of-Text naming and inline schedule/caption
  controls. Updated source assertions to inspect current shared controls/CSS,
  retaining default-time/backend/caption payload and persistence checks.
  Final base suite: **663PASS/0FAIL**.
- Worker TypeScript build: PASS. Worker hold/durable-image/render/editorial
  suites initially90/94PASS. Four legacy Carousel-execution tests did not opt
  into the newly explicit resume policy. They now set false only in the test and
  restore the prior environment on teardown; runtime/default hold is unchanged.
  Final selected worker suite: **94PASS/0FAIL**.
- Actual image-job/helper fixture suites: **49PASS/0FAIL**, including supporting
  identity photos, owned starting-frame inputs and provider rejection paths.
- Two app Carousel execution fixtures had the same hold mismatch. Explicit
  test-only resume preserves missing-queue/ambiguous-dispatch assertions and the
  separate held/no-reservation test. Final focused suite: **3PASS/0FAIL**.
- Application non-incremental TypeScript check: PASS (final rerun recorded in
  types-final.log). Scoped corrected-test lint and whitespace checks: PASS.
- Changed-file sweep:50 files,654 tests; initial629PASS/25FAIL. After app hold
  fixture correction, final631PASS/23FAIL. These remaining failures are in
  `scripts/explore-format-generation-ui.test.mjs`,
  `scripts/explore-workflow-job-recovery.test.mjs`, and
  `lib/viral/viral-isolation-contract.test.ts`. Do not mark this sweep green.
- A temporary in-memory source loader reran the two composer/recovery suites
  against prior HEAD video/image component source:103PASS/22FAIL, reproducing
  the same22composer/recovery failures. All other fixtures/dependencies stayed
  current. This is a narrow baseline comparison, not a complete HEAD checkout
  test or proof that every failure is harmless. Some fixtures expect older
  model/duration/foreground-job behavior; reconcile them with approved behavior
  and add behavioral evidence before release. The separate Viral source
  assertion also needs review; no production behavior was weakened to pass it.
- Prior scoped Hook Linux builds: Webpack and Turbopack PASS, strict asset/native/
  font/catalogue guards PASS;105Linux testsPASS/3private-fixtureSKIP and108Windows
  testsPASS. That verified snapshot no longer covers every current release input.
  Auth/social runtime files and media have drifted; see `linux-snapshot-drift.json`.
  Freeze current source and rerun release build/acceptance after fixes.

Readiness corrections in this review affect tests only:
`lib/theme.test.ts`, `lib/trending/creative-card-actions-ui.test.ts`,
`lib/trending/hook-video-library-render-contract.test.ts`,
`lib/carousel/generation-jobs-behavior.test.ts`, `worker/src/processor.test.ts`.
Readiness documentation/inventory and the append-only incident ledger were also
updated. The Viral assertion experiment was restored; no partial assertion fix
is claimed for that unresolved suite.
No application/runtime scheduling, auth, billing, provider or worker behavior was
changed by these corrections. Other existing file modifications remain intact.

## Live read-only findings

- GCP service/job metadata captured without changing it. Six worker services
  exist: AI generation, Carousel, Carousel edit, reaction render, social publish
  and video render. Two production jobs use the worker image: Carousel
  replenishment and video render. Generation uses revision
  `ugc-ai-generation-worker-r-aae72c9a`; other worker services retain
  `r-17fe15f2b` revisions. Old images/revisions are rollback evidence.
- Separate Tinder service and canary jobs are not production worker targets for
  this release. Preserve them. Sibling Vercel projects remain unchanged.
- Live media bucket CORS still permits legacy GetUGCPilot/localhost origins but
  lacks `https://vidmake.io` and `https://www.vidmake.io` in its PUT rule.
  Captured `live-cors.json`; prepared additive `reviewed-cors.json` using the
  existing offline helper. **Not applied.** Real browser upload acceptance is
  still required after an authorized application.
- Cached local Vercel project metadata identifies `ugc`, Next.js and Node24.x;
  live settings were not changed or freshly certified. Root now requires
  Node>=24.12.0 and pins Firebase Auth1.13.8. Worker Dockerfile uses Node22 and
  requires its own immutable-image build/startup check; a Node24 local compile
  alone is not worker-image acceptance.
- Dirty migration change is a missing SQL terminator repair in the existing
  Startup-plan migration. Do not bulk replay/reapply historical migrations.
  Check hosted history/schema and apply only a separately reviewed missing
  additive requirement, if any. No database mutation occurred here.

## Required rollout order

1. **Close readiness gates and freeze source.** Resolve/reconcile the23failing
   assertions with behavioral evidence, review current auth/social/media drift,
   refresh complete inventory, secret/path review, lint/types/release regressions,
   Linux Webpack/Turbopack guards, and commit the exact intentional release.
   Verify required schema/history and live runtime versions. Do not silently
   omit a smaller fix from the combined release.
2. **Upload prerequisite, when authorized.** Review the captured additive CORS
   diff, apply only the two required origins to the existing PUT rule, preserve
   all other rules/origins, and verify a real signed-in browser upload. Keep the
   captured previous policy for rollback. Do not apply all Terraform.
3. **Build one immutable worker image from that exact worker tree.** Pin its
   digest and baked/runtime commit metadata. Preserve ingress, IAM, secrets,
   capacities, queues and job settings. Do not execute a paid/media/publish job
   merely as a health check.
4. **Worker hold and compatible runtime before website admission.** Update and
   verify the Carousel worker/replenishment job hold first. Confirm no target
   explicitly sets AUTOMATIC_CAROUSEL_GENERATION_PAUSED=false unintentionally.
   Use zero-traffic candidates for affected services, verify Ready plus startup
   identity/image/commit and bounded no-provider checks, then switch traffic.
   Update other affected runtime targets from the reviewed dependency matrix:
   generation, Carousel edit, video render service/job and any shared-renderer
   consumers. Review the shared processor impact for reaction/social services
   before deciding whether their existing images suffice. Job image updates do
   not execute jobs. Preserve held durable work and do not purge/replay queues.
   Old in-flight calls may finish; this is not retroactive cancellation.
5. **Website/API (and required MCP target) only after worker acceptance.** Release
   the exact reviewed commit through the established Git deployment path once;
   avoid a duplicate CLI deployment. Verify Vercel READY, exact SHA, native/asset
   guard results, domains and aliases. Deploy MCP only if it is a required target
   for this combined source; do not disconnect or change sibling settings.
6. **Hosted acceptance.** Check actual production domain, redirect/auth/account
   isolation, upload, current starting-frame options/recovery, media playback,
   durable schedules/targets and runtime errors. Provider/publishing tests require
   their own bounded explicit authorization and evidence. Record all final image,
   revision, deployment and remote-commit identities.

Rollback website admission first while retaining worker compatibility for jobs
already accepted; then roll worker traffic back only after compatibility checks.
Never replay an uncertain paid stage or duplicate a scheduled publication.
Keep prior CORS, worker images/revisions and website deployment IDs available.

## Current decision

**Do not start production deployment yet.** Concrete blockers are23unresolved
test failures, the missing live Vidmake upload origins, and release-source drift
outside the accepted Linux snapshot. Local CORS review and full path inventory
are prepared. Monetary savings, hosted generation/scheduling acceptance and
current Vercel deployment grouping remain UNKNOWN/NOT VERIFIED.

Procedure sources: repository AGENTS, relevant Explore/Carousel/protected and
incident context, prior combined-release/order receipts, actual changed files,
context-memory/immutable/regression/UI/scheduling/cost-guardian procedures.
The external Vercel skill path advertised earlier in the session is no longer
present; no claim of reading it. Operational guidance here comes from the
repository's actual established rollout procedures. No skill-imposed permission
pause or production operation was invoked. Incident UGC-TEST-20261103-RELEASE
records the test corrections; broader failures remain open.
