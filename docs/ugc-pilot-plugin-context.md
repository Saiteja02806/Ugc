# UGC Pilot plugin context

Last reviewed: 2026-10-18

Use this file as the release record for the UGC Pilot Codex/Claude plugin. Update it when the package, deployed MCP catalogue, OAuth behaviour, capability gates, installed-host acceptance, or media-transfer readiness changes. Keep source validation, deployed endpoint checks, and real user acceptance separate.

For the current production 79-tool product-parity matrix, see `mcp-current-capability-audit-2026-10-17.md`. This file tracks the plugin and host-install lifecycle rather than every application feature.

## Goal

An authenticated user should be able to use a supported IDE host to discover UGC Pilot, complete OAuth, plan or generate available media, transfer selected local hook or Demo files, attach and edit owned media, export a finished result, and recover the result. The MCP server remains the authority for permissions, account isolation, feature gates, and all media work.

## Evidence definitions

| State | What it proves |
| --- | --- |
| Source validated | Package checks and fixture/contract tests passed for a commit. It does not prove a deployment. |
| Public preflight validated | Health, OAuth discovery and the anonymous OAuth challenge passed. It does not authenticate a user. |
| Installed-host validated | A clean Codex or Claude Code install completed sign-in, consent, callback return and a stated tool call. |
| Live-capability validated | An authenticated read-only request confirmed the connected account's deployed capability. |

Never infer a later state from an earlier one. Live capability tools override package documentation.

## Current evidence

- Candidate branch `codex/ugc-plugin-oauth-acceptance-20261017` contains plugin version `0.2.2`. Its portable `mcp.json` uses `https://mcp.getugcpilot.com/mcp`, OAuth CIMD and the initial `account:read` scope. It is separate from the historical public `0.2.0` archive and the private-upload `0.2.1` candidate.
- Candidate package checks passed: deterministic package validation, seven Node package tests and five Python archive tests. The package contains 41 files, 14 skills and a 79-tool catalogue declaration.
- The shared checkout currently contains the historical `0.2.0` package, which also validates with 41 files, 14 skills and 79 declared tools. Do not use that result as proof that the separate `0.2.2` OAuth candidate was deployed or installed.
- Public OAuth preflight passed against the live MCP endpoint: health, protected-resource metadata, authorization-server metadata, PKCE S256, issuer-bound redirects, CIMD and anonymous `401` challenge.
- A disposable isolated Codex marketplace installation reported version `0.2.2` with `authPolicy: ON_INSTALL`; the installed manifests and onboarding files exactly matched the candidate. This validated packaging, not browser OAuth return.
- `claude plugin validate` accepted the candidate's `0.2.2` Claude manifest.
- On 2026-10-17, the shared checkout's full `npm run test:mcp` suite passed after its Explore font fixture loader was updated. It exercises OAuth/PKCE, account and scope isolation, generation receipts, uploads/downloads, Demo attachment, finishing, Edit drafts/exports, audio, references/remixes, groups, Library and account settings. The test's local loopback transfer server needs an environment where `127.0.0.1` is permitted.
- On 2026-10-17, the current shared source passed TypeScript's repository-wide no-emit check, the focused `hook-workflow-preview` tests (9/9), the Hook component's ESLint check, and the plugin package tests (7/7). These are source checks only; they do not replace a full runtime bundle or installed-host acceptance.
- The release-critical path was also rerun directly on 2026-10-17: local upload/download transfer passed 14/14 against its temporary loopback server, Demo-tool tests passed 7/7, and video-finishing tests passed 10/10. The transfer suite required local `127.0.0.1` socket permission; it did not contact production or transfer account media.
- Authenticated production read-only calls for profile, entitlements, generation capabilities and finishing capabilities succeeded, including a fresh repeat on 2026-10-17. The connected account reported video generation and finishing available. No content was generated, uploaded, edited, rendered or published during this check.
- The local Claude Code client is version `2.1.76`, but `claude auth status` reported `loggedIn: false` on 2026-10-17. Its enabled UGC Pilot package is the older `0.1.8` package from `ugc-pilot-private-beta`; `claude mcp list` therefore reports its UGC Pilot endpoint as failed to connect. Claude web connector status does not change this result.
- Vercel inspection on 2026-10-17 found the website project `ugc` and isolated MCP project `ugc-mcp` both `READY` in production at commit `683d750c16c721be03bf7ef23844d4fb4d00aec0`. Those deployments are from `codex/explore-overview-release-20261017`, not the `0.2.2` OAuth/package candidate at `2a6c859`, so their health does not establish candidate install acceptance.
- A root `npm run build` started normally on 2026-10-17 but remained at Next's `compile` stage without emitted diagnostics or file progress beyond the expected build scaffold. It was stopped after a bounded observation period and is **inconclusive**, not a passing source-build check. The clean candidate's normal Turbopack build is also not evidence because its temporary `node_modules` junction lies outside Turbopack's filesystem root. Resolve a reproducible clean-source build before staging any new candidate.

## Current local scheduling candidate — 18 October 2026

- `codex/mcp-scheduling-writes-20261017` now merges the current `origin/main` source into the local candidate and adds plugin version `0.2.4`, with 84 source tools and 15 skills. It adds one separately scoped `publishing:write` tool, `create_schedule`; no social OAuth, edit, cancellation, retry, immediate publication or analytics tool was added.
- `create_schedule` is disabled unless the deployed MCP has both a configured scheduling runtime and `MCP_SCHEDULING_WRITES_ENABLED=true`. It supplies only the selected owned source, selected owned connection IDs, an explicit future time, an IANA timezone and a stable request ID to the existing scheduling service.
- The candidate adds a service-only OAuth `email_verified` snapshot. It carries no email or Firebase credential. Existing token rows deliberately default to `false`, so only fresh consent after the migration can make TikTok/YouTube targets eligible. The migration has not been applied to production.
- On 2026-10-18, the exact merged candidate commit `ab7d7631` (including current `origin/main` commit `284e3a50`) passed the complete `npm run test:mcp` suite when its temporary `127.0.0.1` transfer server was permitted. The latest production source's focused reference-access regression tests also passed. Deterministic package validation and the five archive tests report 42 files, 15 skills and 84 tools. These are source/package checks only; they did not make an external request other than the test-local loopback transport.
- On 2026-10-18, the live public OAuth preflight passed again for `https://mcp.getugcpilot.com/mcp`: health, protected-resource and authorization-server metadata, PKCE S256, issuer-bound redirects, CIMD and the anonymous `401` challenge. The connected production account's read-only `get_profile`, `get_entitlements`, `get_capabilities`, `get_video_finishing_capabilities` and `get_edit_export_capabilities` calls also succeeded. It reported Growth access, 317 available credits, video generation, video finishing and Edit export available. This did not perform an install, consent callback, upload, generation or render.
- The local Git commit has not been pushed because the session's automatic review requires explicit authorization before sending the private source to GitHub. The candidate requires a protected staging deployment, fresh OAuth acceptance in both hosts, and a real user-approved media task before it can be called released or production-ready.

## Current local analytics successor — 18 October 2026

- `codex/mcp-analytics-read-20261018` starts from the 84-tool scheduling candidate and prepares plugin version `0.2.5`, with **89** source registrations and **16** skills. It adds `get_analytics_capabilities`, `get_instagram_account_analytics`, `get_instagram_content_analytics`, `get_tiktok_analytics` and `get_youtube_analytics`.
- All five tools are read-only. Report reads require fresh `analytics:read` consent, and the four report tools also require the consent-time verified-identity snapshot. The capability check requires only `account:read` so it can explain missing consent or storage without accessing a report. The OAuth consent view names the new scope.
- Instagram tools read only persisted application snapshot tables. TikTok and YouTube tools select only completed, owner-scoped background-job outputs that still match current connected accounts. The new saved-result reader does not call a provider, enqueue a refresh, read private publishing records, change social connections, schedule, publish or spend credits.
- Focused source evidence passed on 2026-10-18: 12 saved-snapshot/policy tests, 8 OAuth scope tests and 5 analytics MCP contract tests. The contract suite checks discovery metadata, missing-scope and unverified-identity rejection before data access, owner propagation, no private-record leakage and fail-closed malformed cache handling. This successor has not run the full MCP suite, been pushed, deployed, staged, or exercised through an installed host.

## Known gaps

- Neither the earlier 0.2.2 OAuth candidate nor the 0.2.4 scheduling candidate has been deployed to protected staging or production.
- The 0.2.5 analytics successor is also local only. It exposes saved reports, not provider refresh, social OAuth, schedule publishing or analytics mutation.
- A clean Codex desktop installation has not yet been witnessed from **Install plugin** through sign-in, consent, callback return, and a successful authenticated read-only request.
- Claude web connector evidence is not a substitute for a clean Claude Code plugin install and OAuth-return test.
- The local Claude Code package must be upgraded from `0.1.8` to the reviewed `0.2.2` candidate after normal `claude auth login` succeeds. Confirm `claude auth status`, then use `/mcp` in a new Claude Code session to complete the UGC Pilot OAuth consent and run the stated read-only acceptance prompt.
- Private IDE uploads remain gated pending a verified private bucket and delivery/signing configuration. Audio runtime is also gated in production.
- A real hook-to-Demo-to-download workflow needs explicit content authorization. Do not create customer media simply as a connectivity test.
- A public directory listing/reviewer demo recording is still missing.

## Required release acceptance

1. Deploy the reviewed candidate to protected staging and verify its health/discovery reflect the intended source and tool count.
2. In a clean Codex profile, install it, complete normal OAuth, return to Codex, and run only `get_profile`, `get_entitlements` and `get_capabilities`.
3. Repeat that clean install/OAuth/read-only flow in Claude Code.
4. After fresh `analytics:read` consent in a staging account with a verified email and known saved snapshots, verify one saved report in each host. Confirm that it reports stored freshness truthfully and does not start a provider refresh.
5. With a user-selected, owned hook and Demo, run one bounded real finishing task and verify the downloaded output's bytes, duration and saved receipt.
6. Confirm the release archive, setup page and deployed source commit match. Complete directory-review materials before public listing.
