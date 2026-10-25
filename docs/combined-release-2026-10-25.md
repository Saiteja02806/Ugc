# Combined Explore release — 25 October 2026

The user authorizes pushing and deploying all intentional worktree changes.
Includes stored ordinary Hook frames, automatic editable Hook text, remembered
person photos, slideshow selection/uploads/bulk appearance/Undo/in-editor
recreation, combined save/navigation, saved-caption drawer, bounded scheduling
transport, explicit 24-hour scheduling, and landing/MCP/guide changes. The latest
production articles, public tool catalogue and Instagram profile additions are
merged from origin/main through f20a4f4f; none are removed.

## Validation

- Combined regression suite: 1,168 passed, zero failed/skipped.
- Worker regression suite: 104 passed, zero failed/skipped; worker build passed.
- Additional scheduling/migration suite: 89 passed. App production webpack
  build, TypeScript and native decoder trace checks passed.
- Saved-caption browser fixture passes 1280, 390 and 320 pixel widths, right
  drawer placement, focus restoration, account isolation, blank/edit preservation,
  lost-response recovery and horizontal overflow checks.
- Scheduling browser fixture passes 24-hour/UTC conversion, midnight rollover,
  exact output selection, deliberate platform settings and mobile layout.
- Broad tests exposed old VM mocks and superseded expectations. Updated them
  for lazy preparation, text-readiness queries and in-editor slide regeneration;
  reran all 1,168 checks. A local build required execution outside the Windows
  filesystem sandbox. No failed tests are represented as skips.

## Production rollout

- Migration automatic_hook_text_drafts applied to kltxwijhluawgveykfbt as
  20261025114510. Local filename matches remote history. Function is invoker,
  empty search path, service-role-only; anon/authenticated cannot execute it.
- All 83 ordinary active public Hook frames prepared in ugcsaas-media.
  Independent storage verification and runtime-read receipts are recorded under
  .tmp/release-20261025. Private and curated frames retain their existing paths.
- Worker image source: 45bf657be7624aa2b0de6f95f3d19cb049feddd0.
  Cloud Build a95d0b2f-58df-4e57-bce1-ad763733fc2c succeeded; immutable digest
  sha256:dee0eed824f9287f9939dee1564596a1ca97340ebc981b9a7ff174cfced784ea.
- Rollout guard stopped at the first job on a gcloud client-version annotation
  change (582.0.0 to 576.0.0). Audit evidence reconstructed all eight original
  configuration fingerprints exactly; only CLI metadata was normalized. Runtime
  settings stay protected. No job execution was triggered for this verification.
- Website flags enable stored frames and automatic text on the new deployment.
  Existing text Remix remains enabled. MCP's independent environment is retained;
  it does not serve Explore UI or the website's video admission route.
- Website and MCP promoted successfully from
  c32a7893495e3a6ba92d3f5ec191f73c4cd024c6. Verified website deployment
  dpl_HegUvs5SKkZALLictfcb85EchKFd on apex/www and MCP deployment
  dpl_FZU5Wpav5wy4XckaTLnpV8KRRrLz on mcp.getugcpilot.com. Both are READY.
  All eight worker targets identify the pinned image above; all six services
  have a single verified revision at 100% traffic. Worker source matches the
  app commit's worker tree exactly.
- Independent storage verification reports 83 ready, zero missing. Three cold
  production-bucket reads with source download and decode forbidden pass exact
  hash checks; local-machine network timings are 4.2–5.2 seconds, cached reads
  under 1 ms. These are not authenticated hosted route latency measurements.
  Bucket metadata contains no automatic deletion lifecycle rule.
- Live public browser verification passes 40 layouts over four pages, five
  widths and two themes, clipboard/setup interactions, and zero page errors.
  Desktop/mobile screenshots visually checked. Twenty real-domain HTTP checks
  pass, including all seven newer articles, exact deployment identity, MCP
  health and anonymous denial on the changed APIs using supported methods.
- Receipts: .tmp/release-20261025/vercel-verify.json,
  workers-verification.json, generation-worker-acceptance.json,
  production-flags.json, frames-verify.log, storage-acceptance.json and
  public-smoke.json; public browser receipt:
  .tmp/marketing-layout-browser-live/receipt.json. Final documentation-only
  commit does not change the deployed runtime source.

## Scope exclusions and acceptance limits

Three superseded, unused design previews remain local and excluded from hosting:
public/resources/reaction-hook-library-cover-v2.webp,
public/resources/reaction-hook-library-cover-v3.webp, and
public/resources/ugc-pilot-hooks-cover.webp. Existing ignored secrets, .env.local,
private plaintext source packages, .tools, .tmp, .next, .vercel, node_modules,
worker/dist and generated browser evidence remain excluded. Encrypted private
packages already tracked in Git remain included. No functional change is deferred.

The production browser redirects Explore to sign-in. The user explicitly chooses
checks that do not require sign-in. Public live acceptance is therefore separate
from local authenticated fixtures. No signed-in editing, live paid generation,
or real social scheduling/publishing is claimed by this release report.

A concurrent read-only investigation records an existing slideshow planner
clarification issue in docs/slideshow-planner-recurrence-2026-10-25.md: the saved
business snapshot is omitted from planner input, and person-photo mapping can
ask unnecessary questions. This release does not modify that planner path and
does not claim the issue is fixed. Its investigation document is included.
