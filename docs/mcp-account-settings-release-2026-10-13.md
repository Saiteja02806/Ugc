# Approved account-settings gated release — 13 October 2026

The user explicitly approved applying PR #50's service-only migration and promoting the two exact READY builds with all six new-write gates disabled. This release is complete at source `21866e2287501bf5b13b355a2fa103c0258a8afc`. It does not complete full application access, enable settings writes, or establish current-chat acceptance of the six new tools.

## Connection and migration

The primary application configuration and linked project reference point to `kltxwijhluawgveykfbt`; its server-role configuration is present. The connected Supabase MCP independently identifies the same project and successfully queried production. Fresh Supabase CLI login was unnecessarily treated as a release prerequisite. The normal browser flow encountered the account's 20-personal-token limit, so no new CLI token was created. The connected MCP applied the approved SQL without requiring a new login. The agent-started pending CLI helper was stopped after its exact process identity was verified.

Applied SQL SHA-256: `4f98c3de5370cfdfe84606c52bf8739a9716ca99bddde4b439e3a95d528274ac`. The MCP initially recorded its generated tracking version `20261013104300`. Its single stored SQL statement was verified to be 9442 bytes with the exact reviewed hash, then only that newly created ledger record was transactionally aligned to the approved source version `20261013090422`. The update asserted the 131-row count, absence of the canonical version, exact generated version/name and exact SQL hash, and required one changed row. No prior migration record or customer data was modified. All 131 canonical local migration versions now exactly match production; the generated duplicate is absent.

Production permission checks confirm RLS enabled on the new receipt table; anon/authenticated have no SELECT or RPC EXECUTE; service-role receipt permissions are SELECT/INSERT only, with UPDATE/DELETE/TRUNCATE denied. All three functions are security invoker with empty search_path and service-role execution. The receipt table has zero entries. The connected owner's pure settings read returns the existing initialized timezone and default publishing choices without inserting preferences or receipts.

The post-DDL security advisor reports the expected informational `rls_enabled_no_policy` for this service-only table. Browser access is intentionally denied; adding a browser policy merely to silence it would change the intended access model. [Advisor reference](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

## Live source and public acceptance

| Target | Approved deployment | Live domain |
| --- | --- | --- |
| Website | `dpl_2v5CayTnPNqo46BVW8YEzd9rLgRM` | `https://getugcpilot.com` |
| MCP | `dpl_6BUHLMHM1LmmQJ2vKVdmGBpPo7V9` | `https://mcp.getugcpilot.com` |

Both custom domains independently resolve to READY deployments with exact source `21866e2287501bf5b13b355a2fa103c0258a8afc`. All intentional changes in the isolated PR source are included; the checkout was clean and matches its remote branch. Both Linux MCP runs, the migration guard, local PostgreSQL/SDK tests, type/lint, configured build and package checks passed. The primary website preview passed; the secondary Trending preview failed and remains excluded.

All 36 real production checks passed: exact current and earlier ZIP/guide/checksum artifacts, setup/noindex, MCP health, OAuth metadata/errors, invalid bearer/origin rejection and website/MCP isolation. See [machine-readable verification](mcp-account-settings-production-verification-2026-10-13.json). Public 0.1.12 ZIP SHA-256: `2201e61cccb3293f0e9ab56474d466c173c9fd8f6a3b3dbdd8a454f8d5d9af58`.

The six new-write gates were explicitly false at build and runtime in both promoted stages. Persisted five earlier gates read plain false; the new settings gate is absent and defaults false. No account:write consent was requested, settings mutation called, media rendered, post published, bucket/IAM changed, or worker deployed.

## Client and package boundaries

Fresh authenticated Codex discovery sees 79 tools, including all six account-settings registrations. This active chat still caches 73 and cannot call the new tools yet. Standalone discovery does not prove current-chat owner-tool execution: that requires catalogue refresh. Production owner settings were verified through the actual SQL RPC; all six actual MCP SDK adapter cases, including website parity, were tested locally.

The private account plugin remains installed at 0.1.11 with 13 verified skills. A publisher/connection-preserving 0.1.12 overlay is prepared, SHA-256 `25ff7558c8fcffe054907ddccf2313dea6dce215b791a695060d16c37c6a9341`, but account-update tooling is no longer exposed in this session. It was not uploaded and no duplicate plugin or cache edit was attempted. The reviewed public 0.1.12 package has 14 skills and is live on the setup page. Account plugin update and current-chat new-tool acceptance remain pending.

Business Context/onboarding/logos/screenshots, broader generation/characters, Explore draft parity, server slideshow text rendering, Trending/Carousel operations, social publishing, analytics, local upload and Claude Code acceptance remain tracked gaps. Full application access is unfinished.

Ignored logs, temporary helpers, credentials/local environment files, dependencies and build output are excluded. Unrelated dirty primary-workspace UI/worker/infra/migration work is outside this explicitly approved isolated release and was not reset or deployed.

## Current-chat read acceptance — 2026-10-13 11:48 UTC

This chat now exposes all 79 deployed tools. Actual native `get_account_settings_capabilities` and `get_account_settings` calls succeeded against the connected account: storage is configured, writes are disabled, the existing timezone is initialized as `Asia/Calcutta`, and publishing preferences remain unsaved defaults. This closes the earlier current-chat catalogue/read gap; it does not establish write consent, activated writes or Claude Code acceptance. Both production domains still point to exact release source `21866e2287501bf5b13b355a2fa103c0258a8afc`. Production contains 131 migration versions and the new Business Context candidate receipt table is absent. No mutation was called.
