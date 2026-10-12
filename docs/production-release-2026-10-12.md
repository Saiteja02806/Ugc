# Combined production release — 12 October 2026

Status: validated source and additive database preparation; deployment pending.

The user authorized auditing and deploying the current changes, including all
screen updates. The initial inventory records 444 changed/new paths. The release
includes intentional application, worker, configuration, migration, plugin,
script, test and documentation changes. Secrets, machine configuration, caches,
local originals served from external storage and temporary verification output
stay outside the release. The final included/excluded manifests will be recorded
before publication.

## Source and production preservation

- Initial branch: `codex/complete-release-20261009`, source `bb83ce32`.
- Preserve four newer `origin/main` commits through `e4cd2222`, including enabled
  Talking Head/Audio workflows and safe image retirement.
- Preserve the already deployed MCP/Edit/private-upload/export-history stack
  through `origin/codex/mcp-edit-export-history` (`415405fc` runtime; branch tip
  `c693ddbf`). The current website serves plugin 0.1.8 and 33 tools; publishing
  the initial checkout's older 0.1.4 plugin would regress that release.
- New audio-access branches are not part of this deployed ancestor; do not
  activate their unapproved creation/transfer gates. Existing private-upload
  creation remains gated off. Carousel reader-scenario and counted-repair
  policies remain opt-in; they are not enabled for customer jobs.

## Release contents

- Focused Explore navigation and Create/Edit/Schedule layouts for Talking
  Head + Demo, Hook, Wall of Text and Slideshows, including responsive controls,
  finished-video recovery and independent source/demo editing.
- Slideshow reference contract V2, owned existing-image recreation, reference
  roles, intact instructions, default 4:5 sizing and whole-image containment.
- Original reference text and editable Remix Text, reference audio provenance
  and preview/composition handling.
- Settings-based publishing defaults, account restrictions and retry behavior,
  with a “Change default settings” link instead of repeated questions.
- Trending image-edit/readiness improvements, owner-bounded asset lookup,
  carousel Inter typography, lowercase/list-body contracts and image allocation
  repair integration.
- Character reference validation/session fixes and generation/media safety
  changes, plus all relevant regressions and audit documentation.
- Preserve the complete production plugin, OAuth, Demo, operations, Edit and
  private-upload stack during reconciliation.

## Deployment order

1. Commit the reviewed local changes, reconcile production ancestors and inspect
   every conflict. Freeze the final source and validate that exact release.
2. Run website/worker TypeScript builds, application and worker regressions,
   migration guards, MCP/package checks, scoped lint and real-component browser
   fixtures for the changed screens.
3. Verify production schema and ledger. Apply only missing, reviewed compatible
   changes: text-remix storage, reference-audio tagging and expanded publishing
   preferences. Three carousel image/takeover repairs are already applied and
   must not be executed again. Align the old retirement migration filename with
   the authoritative applied ledger rather than ship two copies.
4. Build one immutable worker image from the clean release source. Record its
   digest and baked Git SHA. Update the runtime SHA together with the image.
   Preserve existing secrets, permissions, queues, gates, concurrency and
   resource limits.
5. Deploy the worker before the website can enqueue slideshow V2 inputs.
   Relevant targets are the six UGC worker services plus the video-render and
   carousel-replenishment jobs. The separately sourced Tinder service and
   inactive canary jobs are not release targets.
6. Stage production-environment builds for `ugcpilot/ugc` and `ugc-mcp` without
   moving live domains. Verify project, source and target, then inspect health,
   protected staging, route isolation and package integrity before promotion.
7. Promote the tested builds and verify `getugcpilot.com`,
   `www.getugcpilot.com` and `mcp.getugcpilot.com`, worker traffic/digests/startup
   identity, production errors, and available authenticated screen journeys.
   Do not create paid generations or actual social posts merely as a smoke test.

## Checks found during preparation

- Worker/website TypeScript initially passed; all 603 compiled worker checks
  pass with a workspace temporary directory.
- All 932 selected application checks pass, including access isolation, durable
  request recovery, slideshow contracts, workflow references and publishing defaults.
- Website production compilation, TypeScript, MCP regressions, plugin 0.1.8
  integrity (33 tools, ten skills), worker compilation and dependency audits pass.
  Scoped lint has zero errors and nine existing unused-symbol warnings.
- Production compilation found a slideshow CSS Module selector without a local
  class. It is now scoped to `.workspace`, preserving the focus ring while
  allowing compilation. The repaired Webpack build passed.
- Browser checks pass for desktop/mobile Trending publishing, six-slide image
  replacement, slideshow creation/recreation/recovery, character references,
  reference stacks, Remix Text and Explore scheduling. The Remix fixture now
  waits for source text to load before reading it; its exact-text assertions stay intact.
- Production now has the three reviewed additive migrations: text Remix receipts
  `20261012135237`, reference audio pairing `20261012135247` and publishing
  defaults `20261012135300`. RLS/privilege/default checks pass; all 126 local
  migration versions match the production ledger. Historical filename alignment
  preserves SQL bodies and does not replay migrations.
- Complete manifests: [included paths](production-release-included-paths-2026-10-12.txt)
  and [all 404 excluded local paths and their reasons](production-release-excluded-paths-2026-10-12.md).
  No intentional project change in this branch is omitted.

## Rollback and limits

Record the current Vercel deployments and each Cloud Run image, revision and
runtime SHA before changing traffic. Website rollback can point domains at the
previous working deployment. The additive database changes remain in place;
do not drop customer data to undo a website release. If worker rollback becomes
necessary, stop new slideshow V2 submissions and drain those jobs before
returning to a worker that does not understand V2 inputs. Existing paid-request
fences and saved schedule targets remain intact.

Local tests and measured layout do not prove AI output quality or hosted
provider acceptance. Structure 1 reliability and Structure 2 factual/lesson
quality remain documented limitations. Any unavailable signed-in acceptance
will be explicitly reported rather than inferred from HTTP 200 or unit tests.
