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
