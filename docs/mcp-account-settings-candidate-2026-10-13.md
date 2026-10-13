# MCP account defaults — candidate 0.1.12

Base: PR #49, `fb7728fc8ac4f1e66ad55fb45b6830d267ad1b38`. Branch: `codex/mcp-business-settings`. This candidate adds six account-settings tools to the 73-tool released contract; 79 is a source count, not evidence of deployment or installed-client discovery.

## Behavior

The tools read the application's six publishing defaults and persisted timezone, update only requested defaults, initialize an unset timezone, and recover accepted changes by request UUID or paginated owner-scoped history. They use the same records and validation as the website. Existing initialized timezones retain the application's initialize-once policy. Saved posts and selected social-account restrictions are unchanged.

Writes require separate `account:write` OAuth consent and `MCP_ACCOUNT_SETTINGS_WRITES_ENABLED=true`. The example flag is false, and unset is false. Old grants and refresh tokens do not acquire this scope. Capabilities report that schema verification is still required; configured credentials are not schema readiness.

Separate opaque revisions protect preferences and timezone. Partial writes preserve omitted fields. Service-only SQL commits the mutation and immutable receipt together. UUID/input reuse recovers the historical receipt; it does not restore old values over later website edits. Stale revisions require a fresh read and reconciliation. Browser roles have no receipt-table access or RPC execution; service-role receipt access is select/insert only, including under Supabase default ALL grants.

## Validation

- Full `npm run test:mcp` passed, including six real PostgreSQL account-settings cases and six actual MCP SDK adapter cases.
- Database checks cover defaults without initialization, partial updates, owner boundaries, stale/invalid rollback, lost acknowledgements, immutable replay, initialize-once behavior, RLS and the execute/grant matrix.
- Adapter checks cover discovery/scopes/gates, rejected invalid input before storage, recovery, timezone policy, stable history pagination and actual website partial-save/read parity against the same SQL records.
- OAuth migration and revocation checks preserve old scope sets during refresh; scope parsing accepts the new consent separately.
- TypeScript, targeted ESLint, configured Next build, skill validation, seven plugin package checks and five deterministic ZIP/extracted-helper checks passed.
- All 20 previous tracked download artifacts and both media/audio transfer helpers plus both MCP configs are unchanged from the base. The built setup page selects the three 0.1.12 download artifacts and retains noindex.

Plugin 0.1.12 contains 14 skills and 41 allowlisted entries. ZIP: 124094 bytes, SHA-256 `2201e61cccb3293f0e9ab56474d466c173c9fd8f6a3b3dbdd8a454f8d5d9af58`.

Migration `20261013090422_mcp_account_settings.sql` is local and unapplied. Canonical LF SHA-256: `4f98c3de5370cfdfe84606c52bf8739a9716ca99bddde4b439e3a95d528274ac`.

## Release and remaining work

This is a review candidate. No production migration, settings flag activation, account change, media render, billing operation or social post was run. Local fixtures do not establish multi-connection production race acceptance. Installed Codex/Claude consent and owner acceptance still require a coordinated deployment and normal OAuth flow.

PR #49's protected website stage is accessible after the user completed ordinary Vercel sign-in. Its real downloaded 0.1.11 archive matches the reviewed SHA-256, and its guide/checksum plus noindex are present. Browser navigation to the separate staged MCP health endpoint was blocked by the client; that verification and promotion remain pending. No protection bypass grants were created.

Full application access remains incomplete. Business Context drafts/apply/reanalysis, onboarding, logos/screenshots, broader generation and characters, Explore draft parity, server slideshow text rendering, Trending/Carousel operations, social publishing and analytics remain separate work. The five existing gated features remain disabled in production. Account defaults do not close these gaps.

Ignored dependencies, build output, local logs and temporary evidence are excluded. The primary workspace's unrelated dirty UI/worker/infra/migration changes are outside this isolated draft PR; none were reset or deployed.

## Remote review checkpoint

Draft [PR #50](https://github.com/Saiteja02806/Ugc/pull/50) has exact source `21866e2287501bf5b13b355a2fa103c0258a8afc`, verified against the remote branch. Both Linux MCP workflows passed: [38377603423](https://github.com/Saiteja02806/Ugc/actions/runs/38377603423) and [38377582419](https://github.com/Saiteja02806/Ugc/actions/runs/38377582419). They include the complete MCP suite, plugin metadata/build checks and application/worker dependency audits. [Migration reconciliation guard](https://github.com/Saiteja02806/Ugc/actions/runs/38377603435) passed. The primary `ugc` website preview passed. The separate `trending-release-web-3f35202` preview failed; not every PR check is green, and that preview is excluded from acceptance. CodeRabbit's status is not recorded here as a substantive source review.

The isolated checkout is clean. Both live domains were read again after these checks and remain READY at the prior released source `e3de4a4eb66cb7c7c6e6de6bda9bc9062aafbc63`. Both PR #49 staged builds remain READY at `fb7728fc8ac4f1e66ad55fb45b6830d267ad1b38`. Neither this candidate nor those staged builds were promoted.

## Protected production stages — reviewed and not promoted

PR #49 was subsequently approved and promoted; live source is now `fb7728fc8ac4f1e66ad55fb45b6830d267ad1b38`, with 33 successful live checks and the private plugin installed at 0.1.11. This account-settings candidate remains separate.

Both candidate builds at exact source `21866e2287501bf5b13b355a2fa103c0258a8afc` are READY:

| Target | Deployment | Protected URL |
| --- | --- | --- |
| Website | `dpl_2v5CayTnPNqo46BVW8YEzd9rLgRM` | `https://ugc-eqkfhq60r-ugcpilot.vercel.app` |
| MCP | `dpl_6BUHLMHM1LmmQJ2vKVdmGBpPo7V9` | `https://ugc-ad505ybpc-ugcpilot.vercel.app` |

Stages were uploaded from the clean isolated checkout with explicit existing project/team IDs, `--prod --skip-domain`, matching source metadata, correct website/MCP isolation, and all six new-write flags false at build/runtime. The signed-in protected website renders the actual 0.1.12 setup; the three downloads and noindex are present. Its downloaded ZIP exactly matches SHA-256 `2201e61cccb3293f0e9ab56474d466c173c9fd8f6a3b3dbdd8a454f8d5d9af58`, and the standalone guide matches canonical source. The separate protected MCP stage's HTTP health is not yet browser-verified; READY means platform build readiness only. Final acceptance must run on the real production domains after authorized release.

Production schema reads confirm both existing settings tables' columns/defaults and service-role SELECT/INSERT/UPDATE grants match requirements. The new table and both RPCs are absent, and migration history remains 130 versions with the candidate unapplied. Persisted five existing gates read plain false on both projects; the new account-settings gate is absent and defaults false, in addition to the stages' explicit false overrides. No secrets were printed or copied into the checkout, and no temporary deployment access grant was created.

Release proposal: apply only the service-only `20261013090422` migration, verify RLS/grants/history, promote the two exact READY builds with all six new-write flags disabled, then run public regressions and authenticated read-only account acceptance. Do not enable writes, change customer defaults, generate media, schedule posts, deploy workers, alter bucket/IAM or include unrelated primary-workspace changes. The user's earlier approval covered PR #49 promotions; this new production schema/release needs its own authorization.

The user subsequently explicitly approved this migration and gated release. That approval persists for the exact recorded scope. Execution is paused at CLI authentication: an isolated migration checkout was initialized with only the 131 reviewed canonical SQL files, but `supabase link --project-ref kltxwijhluawgveykfbt` returned `Invalid access token`. No DDL or migration-history change ran. Normal Supabase CLI authentication needs refreshing before the canonical-version dry run/application; the release should not repeatedly request production approval for the same scope. Production remains the verified 0.1.11 source while this is resolved.

A bounded second attempt omitted the inherited `SUPABASE_ACCESS_TOKEN` for the child process and used the CLI's existing saved login. It returned the same invalid-token response. No token value was printed or copied. The user was asked to complete the installed CLI's normal `supabase login` browser flow and enter verification only in their terminal. No database mutation or live candidate promotion was attempted during this authentication check. The existing connected MCP can perform schema inspections; it does not refresh the CLI login or establish the canonical migration version on behalf of this isolated CLI checkout.

## Connected-MCP fallback completed

The user correctly challenged the CLI prerequisite. The app configuration and live connected Supabase MCP identify the same UGC project, so a new CLI token was unnecessary. The approved SQL was applied through MCP, its exact hash verified, and only the new generated history record was aligned to the already approved canonical source version with guarded SQL. All 131 source/production versions match. Both approved builds are now live, all 36 public checks pass, and fresh authenticated discovery sees 79 tools. See [final release evidence](mcp-account-settings-release-2026-10-13.md) for permissions, advisor context and the remaining private-plugin/current-chat acceptance boundaries. No settings writes were enabled or performed.
