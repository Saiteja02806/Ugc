# Approved combined MCP release — 13 October 2026

The user approved applying PRs #46–#48's service-only group/Library migrations and releasing the combined build with group, Library, text-remix, audio-import and private-upload writes disabled. This release is complete at source `e3de4a4eb66cb7c7c6e6de6bda9bc9062aafbc63`; it does not complete full application access or production media-workflow acceptance.

## Production source and gates

Both custom domains were independently resolved through the signed-in Vercel CLI and deployment API to READY production builds at the same final commit:

| Target | Deployment | Unique build URL |
| --- | --- | --- |
| `getugcpilot.com` (www redirects here) | `dpl_H2K9hU7bq11m6fgNjyK59bTPmQkJ` | `ugc-4j7b4yp1f-ugcpilot.vercel.app` |
| `mcp.getugcpilot.com` | `dpl_DGU8S51aUof1u1ZvdojXWCAuLsWE` | `ugc-mgmzlctcz-ugcpilot.vercel.app` |

These were staged production builds, checked before promotion. The website preview was not promoted as if it were an identical production build. `MCP_ONLY_DEPLOYMENT=false` on the website and true on MCP were set at build/runtime; the MCP project's existing production configuration also reads true. Staging updated generated Vercel aliases; custom-domain promotion was performed explicitly afterward.

All five gates are explicitly false both in deployment build/runtime overrides and persisted production configuration on both projects: `MCP_CREATIVE_GROUPS_ENABLED`, `MCP_LIBRARY_WRITES_ENABLED`, `MCP_TEXT_REMIX_ENABLED`, `MCP_AUDIO_VIDEO_IMPORT_ENABLED`, `MCP_PRIVATE_UPLOADS_ENABLED`.

## Applied migrations and permission correction

Supabase project `kltxwijhluawgveykfbt` recorded these authoritative applied versions:

| Reviewed source / correction | Applied version | Canonical Git SQL SHA-256 |
| --- | --- | --- |
| Group migration originally `20261013035507` | `20261013072941_mcp_creative_asset_groups` | `25942a904843d828600dee840e225d3855d15446cf65389e1885cc4ed5335508` |
| Library migration originally `20261013062530` | `20261013072958_mcp_library_content` | `45f2ea298147507f6023f5ac90d515c75272f64bbae63567cb7fa80c3c468535` |
| Additive receipt grant correction | `20261013073411_mcp_request_receipt_permissions` | `b89611dd134a1cd2cb4ecf8745dc4f92275120d479e3c5daf21e5d4c267bfab9` |

Post-application checks discovered Supabase default ALL grants on new public tables gave the service role UPDATE/DELETE/TRUNCATE despite the original explicit SELECT/INSERT grant. The correction revokes ALL only on the two new receipt tables, then grants SELECT/INSERT. Production confirms RLS, no browser-role access, and no service-role UPDATE/DELETE/TRUNCATE. All six new RPCs are invokers with empty search paths and only service-role execution. A real PostgreSQL regression reproduces the default-grant bug, applies the correction, tests the privilege matrix and exercises allowed insert/read plus denied update/delete/truncate.

Git filenames and executable fixture references were aligned to the actual production versions without changing either approved SQL body. Migration version parity passes for all 130 local/production records. This count is ledger parity, not a proof of complete schema equivalence. Existing canonical website Carousel/slideshow save definitions and group trigger bodies retain their pre-release hashes.

## Verification

- Final commit Linux MCP workflows [38363879470](https://github.com/Saiteja02806/Ugc/actions/runs/38363879470) and [38363884468](https://github.com/Saiteja02806/Ugc/actions/runs/38363884468) passed. These include full MCP tests, package/build checks and application/worker dependency audits. [Migration guard 38363884442](https://github.com/Saiteja02806/Ugc/actions/runs/38363884442) passed.
- All 13 focused database cases passed, including the new permission regression; the isolated worktree is clean and its remote branch matches the released commit.
- All 30 public checks passed on the real production domains: setup page, exact current/older published packages and guides, privacy disclosure, MCP readiness, OAuth discovery, authentication errors and host isolation. The existing POST-only audio import route still returns 405 for GET.
- Fresh authenticated Codex CLI discovery returns 73 tools without discovery errors for both `ugc-pilot` and `ugc-pilot-3`. Native account and audio-capability reads succeed. The unused `ugc-pilot-2` connection has no tools and unsupported auth.

## Remaining acceptance and release boundaries

This active chat still exposes its cached 46-tool catalogue. Its app-server proxy cannot reach the Windows control socket (`os error 10050`), so it could not refresh/call the new tools in the loaded chat. Fresh CLI discovery proves the authenticated server catalogue; a standalone read call correctly reports that the active thread is not loaded there. No new task was created, no credentials were extracted, and this is not a claim of successful new Library owner reads through the active chat. Client refresh and intended account read/write acceptance remain pending.

Audio remains unconfigured for MCP (empty models; generation/upload/download/import unavailable). New workflows are not yet packaged in the published/private 0.1.9 plugin. Advanced-generation PR #45 and its migration are separate and were not released. Claude Code sign-in/OAuth and an intended hook → demo → finished local download remain unverified. Full application parity remains unfinished.

The secondary `trending-release-web-3f35202` preview still fails Firebase public configuration; it was not promoted or reconfigured. Both intended primary production targets passed. No customer media was uploaded/generated/edited/rendered, no bucket/IAM changed and no worker was deployed. Unrelated dirty primary-workspace work, local configuration/secrets, dependencies/build output/logs and temporary helpers were excluded from the release. The staged builds use only the clean isolated candidate; PRs remain reviewable at [PR #48](https://github.com/Saiteja02806/Ugc/pull/48).
