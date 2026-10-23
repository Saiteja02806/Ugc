# Sibling Vercel project and Linux validation

Scope: read-only hosting inventory and isolated local Linux checks. No deployment,
push, Vercel settings change, domain change or project deletion is authorized or
performed.

## Sibling project decision

`trending-release-web-3f35202` (`prj_sEUePx1qDIZgisRySeJTeMlMGmsI`) appears to be
an unused accidental staging duplicate. It is not the Trending screen/service.

Read-only Vercel API inventory at `2026-10-23T04:47:47.063Z` establishes:

- All nine currently retained deployments are `ERROR`; the separate `READY`
  query returns none. The deployment listing has no further page.
- Its only registered domain is `trending-release-web-3f35202.vercel.app`.
  All 63 listed aliases are generated `vercel.app` addresses. Neither listing
  has a further page; no custom domain is assigned to this project.
- `getugcpilot.com` belongs to `ugc`
  (`prj_mVOxt7AUko5egMAESaxjGyC60Kvu`). `mcp.getugcpilot.com` belongs to
  `ugc-mcp` (`prj_IU0eCl6JEnHt2mMaEV0g2Ej1NMYU`).
- The sibling remains linked to `Saiteja02806/Ugc`, production branch `main`,
  with zero deploy hooks. Git-linked failed builds are a remaining source of
  unnecessary build work; actual billed savings were not measured.
- No sibling name/project-ID references were found in application, worker,
  infrastructure or CI code. Historical documents do reference it.

The historical release record explicitly describes its accidental creation
during staging: [production root causes](./trending-slideshow-production-root-causes-2026-10-10.md).
This supports the current inventory, rather than inferring its purpose from
its name alone. Current retained records cannot prove every historical or
external use, but no active dependency was discovered.

Recommendation: retire this duplicate, beginning by disabling its automatic Git
builds once separately authorized. Keep both `ugc` and `ugc-mcp`. No settings
were changed and no deployment/rollback history was removed.

Repeatable GET-only audit: `scripts/audit-sibling-vercel-project.mjs`.
Curated evidence (no credential values):
`.tmp/sibling-linux-check/sibling-inventory.json`.

## Linux validation environment

The existing Docker Desktop engine could not start because of a stale local
socket. No Docker reset or configuration cleanup was performed. An isolated
ext4 image inside this project's ignored temporary directory provides a native
Linux filesystem through the already-installed WSL distribution instead.

The runtime uses the official `node:24-bookworm-slim` Linux amd64 image, with
every downloaded OCI layer verified against its SHA-256 digest:

- Image manifest: `sha256:2dd9a4f758e173b65fee15388f7706af6fb01ef50cf7a2c0538711d67a6981ae`.
- Runtime: Linux x64, Node `v24.22.1`, glibc `2.36`.
- The source snapshot includes current tracked and nonignored untracked files,
  excluding dependencies, build output, Git metadata, local tooling and private
  environment files. `source-manifest.json` records individual source hashes.
- Only existing `NEXT_PUBLIC_` build configuration is copied. No service
  credentials, authenticated production access or paid media generation is
  included in this environment.
- Dependencies install from the committed lockfile on Linux. Windows
  `node_modules` and `.next` remain separate.

The isolated local Linux checks establish build/packaging compatibility. They
do not establish hosted Proxy, authentication, storage or media acceptance,
which remains a distinct post-release check requiring deployment authorization.

## Completed results

Linux Turbopack build `C8LzQLUNn6ooToHpF7x1J` passed with Next.js `16.3.8`:

| Check | Result |
| --- | --- |
| Locked root dependency installation | Passed; 800 packages |
| Default `npm run build` | Passed, including TypeScript and all 171 static pages |
| Four isolated native route packages | Passed module resolution and executable startup |
| MCP health/discovery traces | Passed; no native media package files |
| Focused MCP, tracing and audit regressions | 47 passed, zero failed/skipped |
| Full isolated MCP read/auth/upload runner | Passed |
| Full isolated MCP image/video generation runner | Passed; no paid generation |
| Actual compiled MCP rejection handlers | GET/POST/DELETE 401, origin 403, host 421 |
| Compiled rejection dependency/network check | Zero catalogue chunks loaded; zero account/network requests |
| Synthetic native media smoke | Encoded a 64x64, 0.2-second H.264 clip, probed its metadata and decoded a PNG frame |
| New inventory/environment helper scripts | Syntax checks and scoped ESLint passed |

The first prebuild attempt correctly rejected an empty FFmpeg download from the
fresh dependency installation. Reinstalling `ffmpeg-static` inside the isolated
Linux environment produced the expected 79,826,272-byte executable. Its startup,
the complete build, isolated packaging checks and actual synthetic media smoke
then passed. This was an installation artifact; no application workaround or
weakened assertion was introduced.

The service runners deliberately simulate failures such as queue outages and
invalid credentials. Their corresponding warning logs are expected fixture
coverage, not production calls or unresolved build failures.

The snapshot's 4,281 file hashes were checked against the worktree afterward.
Only the read-only sibling audit helper had subsequently changed (to narrow its
saved inventory fields); application/build inputs remained identical. New
report files added after the snapshot do not affect the application build.

## Storage evidence and remaining work

The Linux build emitted 296 traces, totaling 4,001,247,935 logical reference bytes
and 233,052,107 bytes across unique traced paths. `.next` was 438,499,677 bytes,
including 313,174,721 cache bytes. These are local filesystem measurements, not
Vercel grouping, billed storage or production savings; do not compare platform
totals as an optimization percentage. The largest route trace, `/mcp`, was
193,547,876 bytes, with no missing traced files.

Four pairs of identical font files remain under application/worker runtime
paths (3,179,680 redundant unique-path bytes). Consumer-specific font tracing
and MCP catalogue conversion/serialization remain separate optimization
candidates. Neither needs to block this validated packaging change, and neither
was changed without checking all consumers.

The temporary Linux filesystem was unmounted after exporting the evidence and
its disk/partial Windows extraction were removed. Only generated Windows
`.next/cache/turbopack` cache was cleared for local validation space; the existing
Windows compiled build was preserved. This cleanup is not a hosting-cost saving.

Evidence under `.tmp/sibling-linux-check/`:

- `linux-turbopack-build.log`, `linux-focused-tests.log`, `linux-mcp-services.log`.
- `linux-compiled-media.log`, `linux-evidence-export.log`.
- `linux-full-trace-audit.json`, `linux-traces/`, `source-manifest.json`.
- `linux-image/receipt.json`, dependency install/reinstall and helper lint logs.

No scoped application defect remains from these checks. Hosted authenticated
acceptance and comparable production CPU/storage measurements remain pending
an authorized release. The sibling retirement recommendation is also unapplied.
