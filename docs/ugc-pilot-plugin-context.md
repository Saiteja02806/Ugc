# UGC Pilot plugin context

Last reviewed: 2026-10-17

This file is the source-of-truth for the UGC Pilot plugin's release state. It is deliberately outside the distributable plugin folder so internal evidence and open gaps are not presented as user-facing capability claims. Update it whenever the package, deployed MCP catalogue, OAuth behavior, capability gates, or installed-host acceptance changes.

## Product goal

An authenticated UGC Pilot user should be able to use Codex, Claude, or another supported IDE host to plan hooks, generate available media, transfer locally selected hook/demo files, attach media, open and update shared Edit drafts, export when available, and retrieve results. The MCP server remains the authority for account isolation, permissions, rollout gates, and media work; the plugin supplies the install metadata, skills, and local transfer guidance.

## Evidence rules

Keep these states separate:

| State | Meaning |
| --- | --- |
| Source-validated | Static package checks and mocked/fixture tests passed at a particular commit. It does not prove deployment. |
| Public-preflight-validated | Production health, OAuth discovery, and anonymous OAuth challenge passed. It does not authenticate a user. |
| Installed-host-validated | A clean Codex or Claude installation completed OAuth and used the stated tool. This needs a real client session. |
| Live-capability-validated | An authenticated read-only capability call confirmed the deployed setting for the connected account. |

Never infer a later state from an earlier one. Tool discovery and the capability tools always override package copy.

## Current package candidate

- Branch: `codex/ugc-plugin-oauth-acceptance-20261017`, based on `d73ef153` with the OAuth/package acceptance changes.
- Plugin version: `0.2.2`. This avoids replacing the existing 0.2.0 public archive or the separate 0.2.1 private-upload candidate with different bytes.
- Source catalogue: 79 tools, matching the current release package contract.
- The canonical portable `mcp.json` targets `https://mcp.getugcpilot.com/mcp` as Streamable HTTP and declares OAuth with CIMD plus the initial `account:read` scope. The live issuer advertises CIMD and DCR fallback.
- `.agents/plugins/marketplace.json` declares **UGC Pilot local development** with `installation: "AVAILABLE"` and `authentication: "ON_INSTALL"`. Codex CLI requires the checkout root to be added explicitly with `codex plugin marketplace add /absolute/path/to/UGC`; merely opening the checkout did not auto-import the repository marketplace in this audit.
- The package has skills and transfer helpers only. It has no executable hook, account credential, client secret, or embedded bearer token.

## Current production evidence

On 2026-10-16, the public endpoint returned all of the following:

- `/mcp/health` returned `200` and `{ "status": "ready" }`.
- Both protected-resource metadata URLs returned the canonical MCP resource, the `mcp.getugcpilot.com` issuer, and the nine allowed OAuth scopes.
- Authorization-server metadata returned the authorize, token, revoke, and registration endpoints; PKCE `S256`; issuer-bound redirect support; and CIMD support.
- An anonymous request to `/mcp` requires OAuth with a `401` `WWW-Authenticate` challenge that points to protected-resource metadata and requests `account:read`.
- The already-connected Codex session discovered 79 live tools, matching the current release package contract. Discovery itself is separate from a clean installation.
- A previous candidate package installed through `codex plugin marketplace add` then `codex plugin add ugc-pilot@ugc-pilot-local` and reported `authPolicy: "ON_INSTALL"`. The noninteractive CLI did not open a browser, so it did not prove sign-in or callback return. This 0.2.2 candidate must repeat that install before release.
- Read-only authenticated calls succeeded for `get_profile`, `get_entitlements`, `get_capabilities`, `get_video_finishing_capabilities`, `get_audio_capabilities`, and `get_edit_export_capabilities`.
- That account currently reports image and short-video generation available; video finishing and Edit export available with `creative:write`; audio generation, upload, download, import, and voice cloning unavailable.

Use `node scripts/mcp-public-oauth-preflight.mjs` for the no-credential public preflight. It exercises only health, discovery, and the anonymous OAuth challenge. It does not create a client, follow an authorization redirect, use a token, read customer content, or generate media.

## 2026-10-17 verification evidence

- `node scripts/validate-ugc-pilot-plugin.mjs`, `node --test scripts/validate-ugc-pilot-plugin.test.mjs`, and `python scripts/test-ugc-pilot-plugin-build.py` passed for 0.2.2. The deterministic archive contains 41 files and 14 skills, and the historical 0.2.0 public ZIP remains intact with its own checksum.
- `npm run audit:mcp:oauth-public` passed against `https://mcp.getugcpilot.com/mcp`: health, protected-resource discovery, issuer metadata, PKCE S256, issuer-bound redirects, CIMD, and the anonymous `401` OAuth challenge all matched the package declaration.
- An isolated Codex marketplace copy of the candidate installed as `ugc-pilot@ugc-pilot-oauth-acceptance`, version 0.2.2, with `authPolicy: "ON_INSTALL"`. The cached `plugin.json`, `mcp.json`, Codex/Claude compatibility manifests, README, and onboarding skill exactly matched the candidate. The disposable plugin and marketplace were then removed; the existing `ugc-pilot-local` connection was preserved.
- `npm run test:mcp` passed from the clean candidate checkout. It covers OAuth/PKCE, token handling, account isolation, generation receipts, uploads, Demo records, finishing, drafts, exports, audio, references, Creative Asset groups, Library, and account settings using fixtures and database contracts.
- Authenticated, read-only production calls succeeded for profile, entitlements, generation capabilities, and video-finishing capabilities. The latter reported `available: true` for the connected account.
- The shared checkout's unrelated pending Explore changes currently make `scripts/mcp-video-finishing.test.mjs` fail because its sandboxed module loader does not whitelist the newly imported `./explore-text-fonts.ts`. This is a pending-application-release test-harness regression, not a failure in the clean plugin candidate; fix it before merging that application release.

## What is not yet proved or ready

- A public Codex directory listing has not been approved. The local marketplace is a development/test install path, not a public listing.
- The 0.2.2 OAuth-packaging candidate has not been installed and accepted in a clean host. Live discovery may remain 79 tools and does not prove the install path.
- A clean-user interactive Codex installation has not yet been observed from **Install plugin** through sign-in, consent, return callback, discovery, and a successful authenticated read-only tool. This is the remaining proof for the full install/sign-in question.
- Claude web showed a connected custom connector earlier, but a clean Claude Code plugin-install and OAuth-return test remains separate.
- The new private IDE upload path remains disabled. It requires a distinct verified private bucket and its delivery/signing configuration; production bucket policy has not been verified.
- Audio runtime is disabled in production.
- The broader application still lacks parity for Explore/slideshow working drafts and rendering, advanced character generation, voice management/default music, parts of Trending/Carousel, social publishing, and analytics.
- Public-submission material is incomplete: the validator still reports a missing reviewer demo recording, and directory/publisher review is not a code-level pass.

## Required acceptance sequence before calling the plugin production-ready

1. Deploy the reviewed source candidate to a protected staging MCP endpoint and confirm discovery exposes the expected 79 tools.
2. In a clean Codex profile, install through the local marketplace. Confirm that the `ON_INSTALL` policy opens OAuth, complete normal sign-in and consent, and confirm return to Codex.
3. Start a new chat, verify the onboarding skill appears, then call `get_profile`, `get_entitlements`, and `get_capabilities` without a write.
4. Repeat the clean-install/OAuth/read-only path in Claude Code. Treat Claude web custom-connector evidence separately.
5. With explicit content authorization, perform one bounded real hook → demo → finished download test, preserving request IDs and checking the actual output bytes. Do not generate merely to test connectivity.
6. Verify the candidate's release archive, setup page, and deployed MCP source commit match. Then separately complete directory submission/reviewer evidence before advertising public installation.
