# Hook starting-frame release candidate — 21 October 2026

## User-visible flow

Recreate opens Create your starting frame, with the canonical opening scene and
the existing owned person-photo chooser. Main photo and supporting views retain
their separate roles. The image prompt edits the scene using those facial
references and removes creator captions. Generate starting image is a deliberate
paid action with its own estimate. Its completed owned result is displayed for
inspection; Use as starting frame is the primary next action.

Using the image returns to the existing Hook video form. The image box says
Starting frame, Seedance 2.5 is selected explicitly, the adapted motion prompt
is filled, Hook 15 uses eight seconds and sound defaults OFF. Generate video is
a separate deliberate action. The video request contains only the owned image
job/asset identity, motion prompt, duration and settings; it excludes the source
video and person/audio references. ReAPI receives the actual first_frame role.

## Scope and database boundary

The user approved all intentional worktree changes, including prior Hook/Wall
sound/input fixes, slideshow attachment preflight, analytics Refresh GET
invalidation, Trending default allocation, tests, scripts and documentation.
The analytics migration rename preserves SQL under its already-applied version.
The new Trending SQL changes defaults only. Neither migration is executed by
this release: production database changes remain explicitly deferred.

All unignored intentional paths in the audited worktree are included. No small
fix is intentionally omitted. Existing ignored local credentials/configuration,
dependency/build caches and generated evidence are excluded. In particular:

- `.env*` except the tracked empty example: local environment and secrets.
- `.tools/`, `.vercel/`, `.codex/`, `.agents/`: local tool/auth/task state.
- `node_modules/`, `worker/node_modules/`, `.next/`, `worker/dist/`,
  `*.tsbuildinfo`: installed dependencies and regenerable build output.
- `outputs/`, `output/`, `out/`, `.tmp/`, `tmp/`, `tmp-logs/`,
  `local-run-logs/`: generated reviews, media, screenshots and diagnostic output.
- Other pre-existing excluded paths remain specified by `.gitignore` and
  `.vercelignore`; no ignored path is promoted into source by this release.

Added `outputs/` to `.vercelignore` so local reference/test media and screenshots
cannot be included in a CLI website upload. The worker Cloud Build uploads only
`worker/`, whose own ignore rules exclude environment, dependencies and dist.

## Local acceptance and limits

- Production webpack build and application TypeScript pass (170 static pages).
- Worker TypeScript build passes. Scoped lint has no errors; the existing video
  composer has one native-image optimization warning.
- Starting-frame component: 12 tests. Existing video composer: 81 tests including
  new first-frame handoff/ownership cases. Combined Hook suite passed 257 before
  those two composer cases were added; counts overlap and are not additive.
- Video backend agent: 84 admission/provider/worker/regression checks. Image
  agent: 21 API/result and 34 image worker/receipt/regression checks. Combined
  older release regression check: 221 tests and three static migration checks.
- Actual desktop and mobile component walkthroughs, chooser and guide popup are
  recorded in `docs/hook-keyframe-ui-review-2026-10-21.md`.

Browser evidence uses a nonspending development fixture with a visibly labelled
sample image. It is not proof of a generated face match or production acceptance.
No paid generation, provider resubmission or production database action occurred
during these checks.

## Rollout

The first PR run passed video delivery and migration guards and built the main
UGC preview, but its MCP audit found newly published SDK advisories. Updated the
root server/core to 2.3.1 and transitive SDK override to 1.32.1. Both root and
worker production audits now report zero vulnerabilities; worker dependencies
were already clean. Enabled the patched SDK's optional 10,000-element tool-input
limit and shared 64 KiB transport/route body cap. Real in-memory transport tests
reject excess input before tool execution and accept two maximal framing tracks
plus all 20 overlays. The upgrade alone would not enable this protection; see
the [official advisory](https://github.com/modelcontextprotocol/typescript-sdk/security/advisories/GHSA-46jr-4wx8-v453).

The historical `trending-release-web-3f35202` Vercel project has only its own
vercel.app domain and already had an ERROR production deployment; its preview
fails Firebase configuration. It does not own getugcpilot.com or the Trending
screen route. Its unrelated configuration is not changed by this release. The
live website target is `ugc`; the separate MCP target is `ugc-mcp`.

Publish the complete source, require CI, and stage the website without assigning
production domains. Deploy the matching worker source and verify its pinned
image plus exact revision startup identity before promoting the new entry.
Persist the website feature flag only once that worker is ready. Check the real
production domain without generating media. Keep rollback available and record
actual deployment identities separately from local test results.
