# Combined production release — 12 October 2026

Status: LIVE. Production source is
`4d7947a62b783a93f37d2bc3ceefdc0c1132b1e1`. Promoted on 12 October 2026;
signed-in production acceptance and final log inspection completed after
15:24 UTC. A documentation/test-only follow-up records this evidence without
changing the deployed application or worker source.

The user authorized auditing and deploying the current changes, including all
screen updates. The initial inventory records 444 changed/new paths. The release
includes intentional application, worker, configuration, migration, plugin,
script, test and documentation changes. Secrets, machine configuration, caches,
local originals served from external storage and temporary verification output
stay outside the release. Every included path and all 404 excluded local paths
are recorded in the manifests linked below.

## Source and production preservation

- Initial branch: `codex/complete-release-20261009`, source `bb83ce32`.
- Preserve four newer `origin/main` commits through `e4cd2222`, including enabled
  Talking Head/Audio workflows and safe image retirement.
- Preserve the already deployed MCP/Edit/private-upload/export-history stack
  through `origin/codex/mcp-edit-export-history` (`415405fc` runtime; branch tip
  `c693ddbf`). This release serves plugin 0.1.8 and 33 tools; publishing
  the initial checkout's older 0.1.4 plugin would regress that release.
- Separate audio-access/import/plugin candidate branches are not part of this
  release. Their coordinated release is being handled in another checkout;
  documentation about that work is preserved here, without merging its source
  or overwriting a subsequent deployment. Existing private-upload
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
  with a “Change default settings” link in the Trending modal/Hook drawer
  instead of repeated questions. Explore's separate Schedule editor retains
  its per-post controls; this release does not claim all publishing surfaces
  have removed them.
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

Previous Vercel deployments were website `dpl_4bszasuCMsTM3ibWiH1eFBgbUfFA`
and MCP `dpl_D2GUbYmA4YVWiuNDDYxgD4rsRPwc` at the retained export-history
ancestor. Previous worker revisions/digests are included in the safe release
receipt. Recheck live targets before any rollback because a separate audio
release may follow this one. Website rollback can point domains at the
previous working deployment. The additive database changes remain in place;
do not drop customer data to undo a website release. If worker rollback becomes
necessary, stop new slideshow V2 submissions and drain those jobs before
returning to a worker that does not understand V2 inputs. Existing paid-request
fences and saved schedule targets remain intact.

Local tests and measured layout do not prove AI output quality or hosted
provider acceptance. Structure 1 reliability and Structure 2 factual/lesson
quality remain documented limitations. No paid generation, new upload, actual
social publication or forced replenishment was submitted for this release's
acceptance. Existing historical renders are not regenerated by deploying a
new font. Absence of errors in the sampled window is not a guarantee that
future customer generations will succeed.

## Final deployed targets

| Target | Production destination | Verified release |
|---|---|---|
| Website `ugcpilot/ugc` | https://getugcpilot.com (www redirects here) | Final observed Git build `dpl_6c36CneZZahS6nm1ZvPFuztPU8Mu`, READY, production, Next.js, source `4d7947a6`, build 125.8 seconds |
| MCP `ugcpilot/ugc-mcp` | https://mcp.getugcpilot.com | `dpl_FoAACavGxABJ5mZBRvZ796gLEfSr`, READY, production, Next.js, source `4d7947a6`, build 74.1 seconds |
| Six Cloud Run services | `ugcsaas / us-central1` | Each service has 100% traffic on `<service>-r-4d7947a6`; exact digest below |
| Two active Cloud Run jobs | `ugc-video-render-job`, `ugc-carousel-replenishment` | Updated to the same exact digest and runtime SHA; not executed |

Worker digest:
`us-central1-docker.pkg.dev/ugcsaas/ugc-worker/ugc-worker@sha256:e5045bed113509ba073a16ceb7f65abac0917eb93beb077e734194fe81fa20f0`.
Cloud Build `2534d0c1-829a-4786-8af6-9f03824288ee` succeeded. The six services
are AI generation, Carousel, Carousel edit, video render, Reaction render and
social publishing. Every startup log matches baked/runtime SHA `4d7947a6`,
`workerReleaseVerified=true` and bundled Inter Variable Medium available.
Secrets, gates, commands, probes, resource limits, networking, service accounts,
concurrency and timeout settings were compared and preserved. Internal-only
worker ingress remains internal. The first staging image was never given
production traffic because its Inter family lookup fell back to DejaVu Sans;
the final image's build assertion and startup checks prove that fix.

Both `main` and the release branch were verified remotely at the deployed
source before the documentation/test-only evidence follow-up. Safe target,
rollback and validation metadata: [release receipt](production-release-receipt-2026-10-12.json).

The manually staged/promoted website build was
`dpl_APkxhGiNzNPGiAWBezoc1zPWgD9W` (122.1-second build). After the source
push, Vercel's automatic `main` build of the same `4d7947a6` commit became
active. Domain/source metadata, signed-in saved defaults and an empty recent
error/fatal log sample were verified on that final automatic build too. The
evidence follow-up contains only documentation and a browser test, with no
application/worker change. The separate audio candidate is being rebuilt on
this production ancestor in its own checkout and may supersede these targets.

## Production screen acceptance and regression coverage

- Signed-in Settings → Preferences loaded saved TikTok Everyone/comments on,
  AI disclosure on, YouTube Everyone (Public), Made for kids off and subscriber
  notifications off. No preference save was needed. Age restrictions and
  comment moderation remain managed at the destination platform.
- Explore lists all four workflows and all four quick starts, including Talking
  Head + Demo and Audio generation. Talking Head's Use video switches correctly
  to upload/Creative Assets. Create, Edit and Schedule panels load for Talking
  Head, Hook, Wall of text and Slideshows. Slideshow defaults are 4:5, one
  image, optional 2–10 reference images, with per-slide replacement controls.
  Empty drafts keep generation/save/review actions disabled as appropriate.
- Audio generation loads the live voice catalogue, saved bookmarks and text to
  speech controls. Trending loads existing ready content. Library loads owned
  demos. The calendar loads existing posts; its scheduling workspace loads
  connected accounts/media and closes without submitting a post.
- The exact Trending defaults modal and Hook drawer were exercised in isolated
  real-component browser tests with saved settings, creator restrictions,
  failure/retry and mobile cases. The production Trending Like action records
  a real decision and was not triggered merely to reach that modal. The
  calendar workspace is separate and does not prove that modal's live journey.
- 932 selected application checks and 603 compiled worker checks passed.
  TypeScript, hosted production builds, complete MCP suite, plugin integrity,
  migration guards, additive-migration SQL checks and production dependency
  audits passed. Scoped lint: zero errors, nine existing unused-symbol warnings.
- Current workflow acceptance fixture passed 28 combinations (four workflows
  at seven viewport sizes), including desktop/mobile controls, draft retention,
  Create/Edit/Schedule, touch targets, no horizontal overflow and no JS errors.
  Seven independent Talking Head/demo clip layout cases also passed. These
  replace the acceptance role of the older responsive fixture's stale selectors;
  no claim is made that its full legacy selector sequence passed unchanged.
- Other real-component checks cover six-slide background replacement,
  slideshow creation/recreation/recovery, Remix Text/source fidelity, reference
  stacks, character reference recovery and scheduling review. They do not
  represent new production paid renders or actual published posts.

## Post-deploy observability

- Final Cloud Run scan: zero ERROR-or-higher events on the six new revisions
  in the last hour. MCP scan: no error/fatal runtime log entries in the recent
  30-minute window. Website request scan: zero HTTP 5xx rows in that window.
- Website stderr did contain ten warning events across protected Hook video
  streaming and Wall text overlays: PassThrough listener-limit warnings and
  legacy `url.parse()` deprecation. Aggregated clusters first appeared on
  1 October and 25 July, respectively, before this release. A sampled protected
  Hook request returned HTTP 206 despite its warnings. No application exception
  is present in those ten events. The warnings remain a follow-up issue;
  the website logs are not described as completely clean.
- Vercel team drain inventory is empty. Platform logs were inspected; external
  error tracking and long-term alert coverage were not established by this
  release. Runtime-log retention limits older comparisons. No security or
  monitoring protection was weakened to conduct acceptance.
