# Build storage, MCP CPU and Turbopack review

Local implementation and read-only Vercel inspection. No deployment, push,
retention/configuration change, deployment deletion, paid media generation or
database change. Existing unrelated work in the large working copy is preserved.

## Confirmed changes

- The initial default Next.js 16.3.8 Turbopack production build passed, including
  TypeScript, 171 static pages and the previous Hook decoder checks. Historical
  local hangs were not reproduced or diagnosed by this successful run.
- A separate packaging check found `ffprobe-static` bundled with a nonexistent
  `/ROOT/node_modules/ffprobe-static` executable path. Audio transfer and MCP use
  its package resolver. It is now externalized alongside `ffmpeg-static`; the
  package entry, metadata and build-host platform/architecture binary are traced.
- Probe binaries for other platforms/architectures are excluded. Existing
  `/mcp` include patterns also match `/mcp/health` and the well-known MCP resource
  metadata route because installed Next uses `picomatch` with `contains:true`.
  The broad `/mcp` include has been removed; external imports supply its native
  trace. Defensive exclusions also cover those two lightweight endpoints.
  Required media consumers keep their packages and executable files. The first
  repaired build's negative postbuild check caught Windows backslash matching
  preventing exclusions from undoing explicit includes, so the overbroad include
  was removed at its source instead of weakening verification.
- Postbuild verification now checks four native consumers with isolated traced
  package files, resolves each package's executable inside that package, starts
  it with `-version`, and rejects foreign probe binaries. It also asserts the
  two lightweight MCP endpoints contain no decoder/probe package files.
- Eight static schemas for six MCP read tools now initialize once per module.
  Servers, handlers, authentication and principal checks remain per request.
- The MCP route loads its SDK/tool server only after host/origin/authentication
  and bounded POST-body validation. Rejected requests avoid importing its heavy
  SDK/provider/schema graph. No token, entitlement, response or user-data cache
  was added. Authentication and revocation are still checked on every request.

Native configuration regressions exercise Linux x64, Windows x64 and Darwin arm64
path selection with the actual installed Next matcher. Executable verification
in this workspace runs Windows binaries. A Linux build/runtime check remains
required before claiming hosted Linux acceptance.

## Read-only platform evidence

Known linked website project `ugc`, MCP project `ugc-mcp` and sibling
`trending-release-web-3f35202` were inspected through the Vercel connector. Current
website deployment `dpl_8VmfmCjFcprdyNZt65nVNia182Uo` is READY; MCP deployment
`dpl_FJQ4PJgBf1Nj9EBLvgjVYUZkmtRM` is READY. These are existing deployments and
contain none of this task's uncommitted changes.

The sibling project repeatedly starts Git builds for the same revisions as the
website. Its latest inspected build for `14be89fb3` compiled Turbopack successfully
but failed prerendering with Firebase `auth/invalid-api-key`; logs also state no
previous build cache was available. The website's build of that revision passed.
This is evidence of repeated failing sibling work, not a reason to suppress
application auth validation or copy secrets into it. Decide whether that project
still serves a purpose, then separately authorize its Git-build configuration
change or repair its intended environment. Nothing was changed remotely.

Billing export requested 21–24 October UTC, returning records covering
21 October 07:00 through 23 October 07:00 UTC:

| Meter | Reported effective cost, USD |
| --- | ---: |
| Build CPU Minutes | 0.4060 |
| Function Storage | 0.0799 |
| Deployment Storage | 0.0491 |
| Fluid Active CPU | 0.1418 |

These are usage/effective-cost observations, not a new overage or projected
monthly invoice. The export summary covers all 1,758 records; its returned service
groups and sample are truncated. It does not establish per-deployment bytes or
current retention settings.

Live MCP-project observability confirms `/mcp` dominates route CPU. One route-only
query returned 1,318,350 ms for `/mcp`. A separate route/status query showed
779,748 ms on 401 responses, 410,332 ms on 200 responses and 133,989 ms on 202
responses. Around 59% of `/mcp` CPU in that status query belongs to 401 responses;
this does not distinguish absent, expired or revoked tokens, prove abuse, or
attribute all CPU to import/registration. Auth checks must remain authoritative.
Daily granularity expanded the requested end to 24 October UTC; today is partial.
Separate queries can include newly arriving traffic and need not reconcile exactly.

The Git deployment's source-file tree endpoint returned 404. CLI authentication
could not access the known team. Consequently, exact hosted output sizes and
retention configuration are not claimed. Local traces below provide candidate
packaging evidence, not the platform's grouped/deduplicated Functions Storage.

Vercel documents Deployment Storage as retained static/build output and Functions
Storage as regional function bundles, measured over time. Local cache bytes are
not equivalent to either meter. [Deployment Storage documentation](https://vercel.com/docs/deployment-storage).

## Local storage baseline and follow-up

Stable initial Turbopack build: `MRKkZxmPVzquIGrwXcQx1`.
296 server/root trace files reference 4,454,448,879 logical bytes across traces,
versus 427,010,444 bytes across unique paths. This normalizes slash variants but
does not model Vercel function grouping or content-addressed storage.

The local `.next` folder totals 2,280,335,795 bytes, of which 1,956,187,894 bytes
are cache (about 86%). `.next` is excluded from ordinary source deployment. Do not
delete build cache to chase a deployment-storage reduction; it supports reuse.

Each lightweight MCP trace unnecessarily included three native binaries totaling
350,961,128 bytes on Windows. Removing those references reduces logical package
footprints; the native files still required by other routes remain. An additional
258,750,184 bytes of local Try UGC Pilot public media is already ignored, so raw
public-folder totals overstate deployed static media.

Broad Trending font includes and identical fonts under different runtime paths
remain candidates for a separate consumer-by-consumer audit. No fonts or legacy
public URLs were removed in this batch.

Final Turbopack build `tU1CN0xUTl4Sl46XbSJld` passes compilation, application
TypeScript, all 171 static pages and every native postbuild assertion. The source
schema/route optimizations are included in this build. Detailed local CPU methodology and limitations are in
`docs/mcp-cpu-profile-2026-10-23.md`.

Local checks so far: 47 focused regressions pass, covering MCP contracts,
per-request schema/owner separation, deferred transport loading, native trace
rules and isolated resolver failures. The broader read/auth/upload runner and
generation runner pass with isolated services; no paid generation was performed.
Scoped ESLint passes. Actual compiled-route handler checks pass GET/POST/DELETE
401, invalid-origin 403 and wrong-resource-host 421 with request IDs and no-store
headers. They make zero account/network requests and load zero read-tool
catalogue chunks. These invoke the actual compiled route directly; they do not
prove the hosted Proxy/hostname boundary. An initial local HTTP smoke fixture
hit Next's listening-host URL normalization; the check was corrected to avoid
misrepresenting forwarded headers as production-host acceptance.

| Local Turbopack trace metric | Before | After |
| --- | ---: | ---: |
| Logical bytes summed across 296 traces | 4,454,448,879 | 3,623,518,273 |
| Bytes across unique traced paths | 427,010,444 | 362,596,608 |
| MCP health trace | approximately 352.93 MB | 1,968,366 bytes |
| Well-known MCP metadata trace | approximately 352.73 MB | 1,772,507 bytes |
| Native package files in either lightweight endpoint | present | zero |

The differences are 830,930,606 logical reference bytes and 64,413,836 unique-path
bytes. These are local Windows trace measurements, **not** equivalent Vercel
Functions Storage or billed savings. The Linux probe is no longer shipped in this
Windows build. Linux configuration tests retain the Linux probe and reject Windows
paths. The subsequent isolated Linux build and executable checks also pass; see
the completed acceptance below.

After-audit: `.tmp/build-storage/turbopack-after.json`. Successful default build:
`.tmp/build-storage-mcp-2026-10-23/turbopack-verified.log`. An intermediate build
compiled and passed all four native route checks but failed the lightweight-route
assertion; that failure drove removal of the broad include. It was not deployed.
Existing webpack fallback compatibility also passes compilation, application
TypeScript and all native positive/negative postbuild assertions. Its log is
`.tmp/build-storage-mcp-2026-10-23/webpack-compatibility.log`. The current local
`.next` contains this later webpack build; the preserved Turbopack audit and log
above record its separately successful build and measurements. This task's
runtime/configuration files did not change between those successful builds.

Final validation: 47 focused tests, the full isolated auth/read/upload runner,
the isolated generation runner, scoped ESLint and diff whitespace checks pass.
No unresolved correctness blocker remains in the scoped changes. The final
follow-up priorities are hosted acceptance after authorization, comparable
production CPU/bytes measurements, separately authorizing retirement of the
unused sibling project, and measuring the remaining catalogue serialization/font
tracing candidates. Linux packaging has now been validated without deploying.
No deployment or rollback history was removed.

## Evidence paths and remaining acceptance

- `.tmp/build-storage-mcp-2026-10-23/`: platform evidence, build/test/lint logs.
- `.tmp/build-storage/turbopack-baseline.json`: initial local storage audit.
- `scripts/audit-build-storage.mjs`: repeatable read-only local storage audit.
- Native checks are part of the existing `npm run build` postbuild lifecycle.
- Production CPU/bytes/cost reduction and hosted media acceptance require an
  authorized release and comparable subsequent traffic. Keep deployment paused.

## Follow-up implementation review

Re-read the runtime/configuration changes and reran 47 focused regressions,
compiled-route rejection checks, all four isolated native resolver/executable
checks, lightweight-route exclusions, scoped ESLint and diff whitespace checks.
All passed. No new application fix was required and no introduced correctness
blocker was identified within this batch. Logs: `.tmp/build-storage-mcp-reverify/`.

Linux packaging acceptance means building and running native package checks on
Linux **without deploying**. A subsequent isolated WSL/ext4 environment using the
official Node 24 Debian image completed this check: build
`C8LzQLUNn6ooToHpF7x1J` passes default Turbopack, TypeScript, all 171 static pages,
four isolated native route package checks and lightweight endpoint exclusions.
All 47 focused tests and the isolated read/auth/upload and generation runners
pass on Linux. Compiled rejection handlers and a synthetic video encode/probe/
frame-decode smoke also pass. No application workaround was required; an empty
initial FFmpeg download was detected by prebuild and repaired by reinstalling
that dependency in the test environment. Hosted acceptance remains separate.

The sibling project is the separate `trending-release-web-3f35202` Vercel project,
not the main `ugc` website or `ugc-mcp`. The previously inspected log proves a
Firebase `auth/invalid-api-key` prerender failure in that project; it does not
prove a failure of the main site's deployment. Fresh read-only inventory and the
historical staging report establish that it appears to be an unused accidental
duplicate: nine retained deployments all failed, no READY deployment, no custom
domain, no application/CI dependency found, and both production domains belong
to the intended other projects. Recommend retiring its automatic Git builds
after separate authorization. No settings or deployment history were changed.

Detailed environment, inventory, evidence and acceptance limits:
`docs/sibling-project-linux-validation-2026-10-23.md`. Temporary Linux build disk
was removed after exporting evidence; the Windows compiled build remains intact.

Remaining measured candidates are catalogue schema conversion/serialization on
authorized MCP requests, broad Trending font tracing/duplicate runtime paths,
and repeated sibling builds. These are separate from the fixed native resolver
and eager SDK-loading issues; no promise that all CPU or storage costs are
eliminated is made. Production savings remain unmeasured.
