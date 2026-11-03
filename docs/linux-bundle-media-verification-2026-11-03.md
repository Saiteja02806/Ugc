# Linux bundle/media verification — 3 November 2026

## Scope

Recheck the function-tracing/public-source exclusions on Linux without deploying,
pushing, changing Vercel settings or invoking live providers. Existing dirty
worktree changes are preserved. Actual bill, Build CPU share and savings remain
UNKNOWN; this is local build acceptance, not hosted acceptance.

Runtime: isolated official Node 24 Bookworm Linux x64 image, Node 24.22.2,
glibc 2.36, WSL2 kernel. OCI layer hashes were checked before extraction.
Docker daemon was unavailable; a new disposable ext4 filesystem was used.
No private environment file or service credential was copied. Only existing
NEXT_PUBLIC build configuration was supplied. This is not a full production
worker-image certification (its Dockerfile starts from Node22).

The snapshot manifest contains 5,856 files with SHA256 hashes. Current cover-link
edits in `components/explore/ai-character-card.tsx` and
`lib/explore/workflows.ts` were included before compilation, along with context
amendments. Tests use 30 additional local authoring fixtures; these were removed
before building. Generated worker output/test artifacts were moved outside the
build source tree. Dependencies came from both existing lockfiles using root
`npm ci` and worker `npm ci --legacy-peer-deps`.

Applied actual `.vercelignore` file matching inside the disposable source tree:
95 files removed, including the same 79 public source/review files, now totaling
**151,051,178 bytes**. The earlier 150,643,153-byte figure described older media.
Original workspace assets were not deleted. Published MP4/WebP files remain.

## Findings and smallest fix

`scripts/explore-text-fonts.test.mjs` selected `ffmpeg-static` unconditionally.
The current Linux static decoder lacks `drawtext`; the mixed legacy-font export
test failed with the captured error `No such filter: drawtext`. The actual worker
Dockerfile installs system FFmpeg and Fontconfig. Added an explicit `FFMPEG_PATH`
override for this test only, retaining its prior default. All existing assertions
remain; no production renderer, native dependency, config or lockfile changed.

The clean snapshot initially lacked ignored design/contact-sheet fixtures,
causing seven authoring-test failures. Supplied exact local fixture files and
reran unchanged tests. They are not deployment dependencies.

A later decoder prebuild startup failed once. Direct spawn and the unchanged
prebuild immediately passed with the same file. Cause remains UNKNOWN; do not
describe it as an application fix or weaken the startup guard.

The first Turbopack build uncovered a separate source compatibility defect in
`worker/src/lib/carousel-manual-render.ts`: two `.js` imports could not resolve
their TypeScript siblings, and dynamic `new URL(directory, import.meta.url)`
was treated as an asset request. Changed only those imports to `.ts` (worker
tsc already rewrites relative extensions) and resolved the same three runtime
font candidates from `dirname(fileURLToPath(import.meta.url))`. Candidate order,
explicit app override, layout, SVG glyphs, styles and rendering are preserved.
Added a real-render assertion comparing default and explicit font paths.

## Verification

- Preflight tool: prerequisites readable. Scoped dirty diff reviewed.
- Linux root/worker dependency installation: PASS (948/137 packages).
- Linux worker TypeScript build: PASS.
- Linux packaging, native route, preview, encrypted-reader, promo and MCP suite:
  **100 PASS, 0 FAIL, 6 SKIPPED**. Skips require private creator fixture bytes or
  package key, deliberately absent from this clean environment. Synthetic
  encrypted-reader/access-control and route authorization tests passed.
- Linux real font/video suite with worker-compatible system FFmpeg:
  **11 PASS, 0 FAIL**. Tests cover actual encoded output, font positioning,
  mixed timing, saved edits and unchanged source bytes.
- Windows same font/video suite with prior default: **11 PASS, 0 FAIL**.
- Windows packaging/native/storage/Sharp suite: **17 PASS, 0 FAIL**.
- Linux scoped ESLint including changed test: PASS.
- Updated shared renderer: 24 compiled rendering regressions PASS on Linux and
  Windows, including default/explicit path equality and actual rasterization;
  Linux automation service regressions37 PASS, including local SQL concurrency
  checks. Linux/Windows worker builds and Linux renderer/test lint PASS.
- Linux production Webpack build: PASS before and after the renderer fix,
  including TypeScript, 371 static pages and all existing/new postbuild checks.
  Final build ID `MMbG_P9Fu0PEPXVmuBsSO`.
- Webpack emitted traces: all five catalogues (122,009 bytes) in MCP; none in
  health/discovery. All four isolated native packages resolve/start; Linux
  Sharp/libvips traces and Sharp rasterization pass. All 19 bundled Explore font
  filenames exist in each of five checked automation routes. No missing files
  in any of the 11 directly checked endpoint traces.
- Webpack local production HTTP: 64 published MP4/WebP files return 200 with
  expected content types/lengths; MP4 byte range returns matching bytes with206;
  poster bytes match; three excluded source/review samples return404.
- Compiled Webpack MCP: unauthorized GET/POST/DELETE401, wrong Origin403,
  wrong host421; zero account requests/read-tool catalogue chunks.
- Final Linux Webpack build and matching acceptance after renderer fix: PASS.
  Final Turbopack build/acceptance: PASS, exit0; build ID
  `ggmasD--d_8RrEBApVL0I`, compile2.8min, TypeScript23.9s,371 static pages,
  and every existing/new postbuild guard. Initial failure is retained in
  `linux-turbopack-before-renderer-fix.log`.
- Turbopack repeats the same catalogue/native/Sharp/19-font retention checks,
  compiled MCP rejection checks and all64-file/range/poster/404 HTTP assertions.
  Both local production servers serve the `?v=5` poster with matching bytes.
  All11 directly checked endpoint traces have no missing paths.

The additional temporary font guard initially expected an obsolete18-file
inventory. Corrected it to compare the full current filename set (19), without
weakening any existing build guard or changing production fonts.

## Remaining bundle-size findings

The read-only Webpack audit found substantial pre-existing trace breadth:
Hook keyframe685,799,477 bytes, Hook starting-frame685,591,616 bytes and the
keyframe preview source685,310,965 bytes. These are logical local trace sizes,
not confirmed Vercel package groupings, compression, storage or billed bytes.
The keyframe trace contains566,442,626 bytes of public assets, including
marketing videos and influencer-studio files unrelated to frame decoding.
Its public-file reads use dynamic paths under the public root in
`lib/explore/hook-source-frame.ts`; this explains the broad trace. Required
curated/prepared frames and historical source handling must remain available.

This follow-up does not rewrite that shared source resolver or prune unrelated
assets from generation bundles without recovery/admission verification. Treat
this as the next targeted optimization and a release packaging concern to
resolve before claiming all cost bottlenecks are cleared. Current authored
source exclusions and MCP catalogue isolation are independently verified.
The audit also repeats both Linux glibc and musl Sharp libraries across many
traces; investigate actual package grouping before inferring duplicate billing.

Turbopack's final Hook keyframe logical trace is705,560,924 bytes; MCP is
242,018,705 bytes. It also includes two separate Remotion authoring copies
(product-demo-source.mp4 and talking-head-source.mp4,8,689,271 bytes combined).
These reside under `remotion/public/`, not the excluded root
`public/explore/covers/sources/`. The temporary acceptance script initially
used a substring check that conflated both roots. Corrected it to assert the
exact excluded root, then passed inventory and HTTP assertions. Those separate
Remotion copies remain a further input/tracing optimization candidate.
The full trace audit covers507 traces per build. Do not infer Vercel package
grouping or billed storage from logical local trace totals.

Evidence: `.tmp/linux-bundle-check-2026-11-03/` includes immutable source and
fixture manifests, OCI receipt, dependency/test/font/build logs, filtered-file
inventory and native decoder diagnostics. Initial failed attempts remain saved.
Temporary harness scripts are local review artifacts, not new release inputs.
The completed Webpack compiler cache alone was cleared inside the disposable
Linux filesystem after acceptance to free1.9GB for Turbopack. This is not a
Vercel storage saving. Compiled output, source and evidence were retained.
After final evidence export, the disposable filesystem was unmounted and its
8GiB disk image plus temporary source/fixture tar files were removed. All source
originals, logs, manifests, scoped SHA256 hashes, trace JSON and acceptance
receipts remain. All eight scoped source hashes match the current worktree.

A concurrent UI edit appended `?v=5` to the AI Character poster after the frozen
compile snapshot. That URL was tested against local production HTTP and matched
the poster bytes; the later UI source edit itself is outside this build snapshot.
Do not describe these checks as certification of every concurrent worktree edit.

## Completion contract

Files changed by this follow-up: `scripts/explore-text-fonts.test.mjs`,
`worker/src/lib/carousel-manual-render.ts`,
`worker/src/lib/carousel-manual-text.test.ts`, this
receipt, the earlier `docs/function-bundle-media-review-2026-11-03.md` receipt
and append-only `docs/ai-context/clear.md`.
Incidents: `UGC-BUILD-20261103-02` and `UGC-BUILD-20261103-03` locally verified;
`UGC-BUILD-20261103-04` remains OPEN for broad Hook asset tracing. Prior tracing
incident `UGC-BUILD-20261103-01` receives Linux evidence.

Status: Linux Webpack/Turbopack and scoped runtime packaging **VERIFIED**;
hosted acceptance and broader bundle-cost cleanup **NOT VERIFIED / OPEN**.

Sources read: repository AGENTS, existing packaging receipt, relevant
Explore/Carousel and incident context, nonnegotiables, installed Next tracing
documentation/collector behavior, worker Dockerfile/media renderer, actual test
sources, and full skills `ugc-context-memory`, `ugc-immutable-contracts`,
`ugc-regression-gate`, `vercel-cost-guardian`. No claim of a fresh full reread of
the large historical ledgers. Preflight readability is not a substitute.

Protected contracts: no UI/layout/control, API shape, source timestamp/identity,
generation prompt, billing, auth policy, schedule persistence, provider or
publishing change. These flows were not live-tested by this packaging task.
Authenticated production acceptance, private reference bytes and actual cost
impact remain NOT VERIFIED. Vercel project topology/settings remain unchanged.

Rollback the explicit test-tool override and isolated renderer path/import
changes only if needed; retain all other work and assertions. The prior renderer
is saved in the evidence directory. Earlier packaging rollback is documented
in its existing receipt.
No deployment approval is requested or implied by these checks.
