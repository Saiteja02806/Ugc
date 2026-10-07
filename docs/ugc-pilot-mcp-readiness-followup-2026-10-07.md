# UGC Pilot readiness follow-up — 7 October 2026

The production MCP's image and image-to-video workflow works in Codex. This follow-up prepares the remaining source corrections and setup/download additions for a scoped release. **No production deployment or Git push has been performed in this follow-up.**

## Production source confirmed

Both live Vercel projects use commit `9390357231e31cfb72cdb67df6098d5b3c87aa4d`:

| Project | Domain | Current production deployment |
| --- | --- | --- |
| `ugc-mcp` | `mcp.getugcpilot.com` | `dpl_34shbMncaicg7Ki2HeR3C2heYtvj` |
| `ugc` | `getugcpilot.com`, with `www` redirecting to the apex | `dpl_94qjVSXUHuVFaU4ytcZjHNzShhMD` |

The isolated candidate is `C:/Users/chund/OneDrive/Desktop/UGC/.tmp/mcp-readiness-candidate-20261007`. It was created from that exact committed source. The main checkout's unrelated, unfinished changes were not substituted for the deployed version.

## Corrections prepared

- **Read-only billing:** MCP plan/capability reads and generation preflight inspect an existing free allowance without allocating one. Missing rows report zero; invalid or unavailable balances fail closed. Website default initialization remains covered by regression tests.
- **Consent redesign and accuracy:** the candidate now uses a compact consent page with normal page scrolling, a smaller account row, readable permission descriptions, and responsive light/dark styles. The generation permission says “Generate images and videos” and explains that both use UGC Pilot credits. Scope names, authentication handlers, and granted permissions are unchanged. See the [UI report and preview evidence](ugc-pilot-oauth-ui-redesign-2026-10-07.md).
- **Request tracing:** MCP responses return `X-Request-Id`, matching the structured request log. Authentication, origin/host rejection, oversized body, malformed transport response, and normal responses can be correlated. Responses consistently use `no-store`. Logs do not contain the bearer token, prompt, or account email. This is improved observability, not a demonstrated fix for the earlier intermittent transport failure.
- **Customer setup:** `/connect-ai`, the plugin ZIP, checksum, and standalone guide are included. Client choices switch correctly in the complete application's browser preview.
- **Theme compatibility:** the full application preview exposed insufficient orange-text contrast in dark mode. The page now uses scoped light/dark colors, calculated at 5.18:1 on white and 7.92:1 on the dark background. Global theme colors are unchanged. Its title also avoids repeating the brand name.

The [runtime correction patch](ugc-pilot-mcp-readiness-fixes-2026-10-07.patch) contains the eight existing-file changes against production, including the original brand-asset correction, and the two new consent presentation/style files. The onboarding/package additions are already present in the main checkout and candidate. To check the patch against the candidate, use `git apply --reverse --check --ignore-space-change --directory=.tmp/mcp-readiness-candidate-20261007 docs/ugc-pilot-mcp-readiness-fixes-2026-10-07.patch`; the whitespace option accommodates the checkout's Windows line endings.

## Verification

- Current production-source MCP suite: passed, including 24 unit checks and the read/auth/upload/delete, generation/job, token-error, migration, and real-SDK signing suites.
- Free-generation-credit suite: all eleven tests passed with the exact candidate lockfile's dependencies.
- Scoped ESLint: passed for corrected runtime files, regression fixtures, consent, and onboarding components.
- Complete Next.js build: passed with the consent redesign and setup-page theme correction, TypeScript checks enabled, and all 147 static pages generated. No type-check bypass was introduced.
- Final full-application preview: setup page, ZIP, checksum, and standalone guide return HTTP 200. All downloads match the reviewed source bytes; the ZIP is 37,623 bytes with the original SHA-256. The browser confirms the actual dark-theme colors and corrected title. No browser error or warning entries were captured in the checked preview. This is local build/layout/download evidence, not production acceptance.
- Plugin validator: passed, twelve package files and twelve tools. The ZIP remains byte-for-byte unchanged from the reviewed private package.
- Main-checkout read/auth tests and lint: passed after porting request tracing there.
- Additional live checks: missing asset returned safe `NOT_FOUND`; the connected account's completed brand profile was retrieved successfully. No additional generation was submitted or paid credits spent in this follow-up.

The first candidate type check used the main checkout's installed Runway SDK `4.4.0`, whereas production's lockfile requires `4.20.1`. Installing the candidate's own locked dependencies corrected that test-environment mismatch. Next.js generated its route/image declarations as part of the full build. The isolated candidate does not have the eight Explore errors in the main checkout; those still need reconciliation before any separate release of all main-checkout changes.

## Proposed scoped deployment

Deploy the reviewed candidate to the existing `ugc-mcp` and `ugc` projects, using each project's own production settings and environment. Stage and test each build before assigning the production domains. Preserve the MCP-only route boundary. No database migration, worker deployment, permission expansion, public plugin-directory publication, or deployment of all main-checkout changes is part of this proposal.

Production acceptance must then confirm:

1. Setup page and all three downloadable files return 200 on the real website domain; archive and guide bytes match the reviewed files.
2. OAuth discovery and existing connected-account reads still work on the MCP domain. The updated consent describes both generation types without granting additional scopes.
3. Request IDs and safe rejection behavior survive the deployed transport; correlate any renewed tool failure with production logs.
4. Existing completed image/video jobs and assets remain retrievable. The earlier paid canary is documented in the [integration report](ugc-pilot-mcp-integration-test-2026-10-07.md).

The candidate, patch, source manifest, and preview are prepared for review. Deployment approval remains a separate step: the Vercel deployment guide states that an inspection request does not authorize a release.

## Limits that remain after the source correction

The earlier transport failures have not been reproduced reliably or attributed to a specific layer. A successful retry does not close that issue. Installed private-plugin skill loading, fresh-account flows, Claude/Claude Code and ChatGPT authentication, and customer-wide plugin distribution remain pending. The ten installed-host evaluation cases have not been relabeled as passed based on direct Codex MCP testing.

Local evidence and the source manifest are under `.tmp/mcp-plugin-build/`. They and the candidate's dependencies, build output, generated types, and local environment are excluded from the distributable plugin. No secret environment file was copied into the candidate; the local build consumed the existing environment in process memory.
