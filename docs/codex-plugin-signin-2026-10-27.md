# Codex plugin compatibility and live sign-in receipt

Date: 27 October 2026. Status: **VERIFIED for the tested Codex CLI/app-server installation, normal OAuth and account reads.** Public distribution, the desktop Install button, Claude, candidate backend features and complete application parity remain separate acceptance boundaries.

## Scope and source

Worktree: `.tmp/pr71-release-repair-20261026`, branch `codex/pr71-release-safeguards-20261026`, based on PR71 commit `729cc229102979fec2816d140a3fad97c7eefbdf`. This patch is local and uncommitted/unpushed. The primary dirty checkout and older unfinished candidate were preserved. Production application, configuration, schema, workers, publishing and media were not changed. Only normal OAuth authorization/token issuance and safe account reads reached the existing production service.

The Agent Plugins schema and current OpenAI packaging guide permit an MCP server authentication extension. The installed **Codex 0.164.0-alpha.11.1** parser rejects that field before loading the server. Preserve the portable root manifests and endpoint; remove `mcpServers.ugc-pilot.extensions` from `mcp.json` and let normal protected-resource OAuth discovery select registration. Compatibility `.mcp.json` remains unchanged. This is a tested compatibility decision for this client version, not a claim that the documented extension is invalid everywhere.

New package **0.2.10**: 47 files, 18 skills, source inventory 106 tools. ZIP **142,178 bytes**, SHA-256 **ae5cb61e758d97004098c811f89a1a623606477307001293ab957bd85c125074**. The 0.2.9 ZIP remains byte-identical, SHA-256 `409411370c124c6337570501068fde1f5d6a7f0fe737fd710ec621a6376b733c`. No older release was overwritten. Website source/download links were not advanced or deployed by this task.

## Actual Codex evidence

The script extracts the exact ZIP without URL rewriting, authentication overrides, credentials or gateway headers. It copies the repository marketplace's AVAILABLE/ON_INSTALL policy and installs through the actual Codex CLI into a new ignored profile. It then uses that same client's app-server; it never runs a model turn or copies tokens from another profile.

| Boundary | Result |
| --- | --- |
| Unchanged 0.2.9 negative control | FAIL as expected: 18 skills, no bundled server, parser warning |
| Corrected 0.2.10 exact archive | PASS: 18 skills, `ugc-pilot` bundled server, zero parser warnings |
| Thread-bound live plugin server | PASS, production origin `https://mcp.getugcpilot.com` |
| Normal Codex OAuth | PASS on fresh second attempt; automatic CIMD client, PKCE S256, only `account:read`; user completed normal consent |
| Same-client reads | `get_profile`, `get_entitlements`, `get_capabilities` PASS with structured account data |
| Connected account | Account ID hash matches the user's previously verified production account; no raw account/token copied into receipt |
| Discovered live inventory | **79 tools**, distinct from the unreleased PR71 source inventory of 106 |
| New app-server process, same isolated profile | PASS: native `oAuth` state, 79 tools, same account and all three reads without another login |

The first live attempt reached the browser's Authentication complete page but its native completion event failed and a new process reported notLoggedIn. Its token-exchange/persistence failure cause remains UNKNOWN; the original harness did not retain its error detail. The second normal attempt and subsequent process restart passed. Do not erase the failed attempt or claim universal first-attempt reliability from this sample.

Sanitized ignored artifacts (relative to this worktree):

- `.tmp/live-plugin-signin-20261027/codex-svi7adpr/receipt.json`: exact 0.2.9 negative control.
- `.tmp/live-plugin-signin-20261027/codex-2j6_vwiu/receipt.json`: corrected loader-only positive control.
- `.tmp/live-plugin-signin-20261027/codex-akaj9406/receipt.json` and `recovery-receipt.json`: first failed native login and denied anonymous read.
- `.tmp/live-plugin-signin-20261027/codex-511qkyeo/receipt.json` and `recovery-receipt.json`: successful OAuth/reads and fresh-process recovery.

Receipts exclude authorization codes, callback URLs, access/refresh tokens and returned account contents. Native test profiles remain ignored and separate from the user's normal Codex profile. Do not add them to Git or release archives. All test app-server processes have exited.

## Validation and protected behavior

Passed: 14 catalogue/plugin tests, 11 staging-isolation safeguard tests, 10 actual-archive Python tests, package validator, scoped ESLint, Python compilation and `git diff --check`. The old archive negative control exits 1 intentionally. An initial check used the nonexistent name `mcp-staging-isolation.test.mjs`; the correct `check-agent-staging-isolation.test.mjs` was subsequently run and passed 11/11. No claim of a passing nonexistent runner.

Protected behavior: existing production endpoint and automatic OAuth/PKCE VERIFIED; minimal read consent VERIFIED; immutable old archive VERIFIED; account continuity/restart VERIFIED; application/Explore/editor/scheduling/worker files unchanged VERIFIED by diff scope. Their interactive UI, output quality and publishing behavior were **NOT TESTED** in this package-only task. No application build was needed or claimed for unchanged runtime code. No generation, render, upload, schedule or provider-publication tool was invoked.

Preflight sources actually read: primary `AGENTS.md`, entire `EXPLORE_CONTEXT.md`, entire `docs/ai-context/clear.md`, `nonnegotiables.md`, mandatory context-memory/protected-contract/regression skills, connection skill, package source/tests and current client-generated protocol schemas. The read-only `tools/preflight.py` was run. Current official documentation: https://developers.openai.com/plugins/build/plugins . Relevant history: UGC-OPS-011 (parser rejection), UGC-OPS-003 (build versus actual acceptance) and UGC-OPS-005 (source/deployment/catalogue drift).

Files in this implementation: plugin `mcp.json`, three plugin/version manifests, plugin README and client-setup reference; `scripts/validate-ugc-pilot-plugin.mjs`, its test, `scripts/test-ugc-pilot-plugin-build.py`, new `scripts/check-ugc-pilot-codex.py`; three new 0.2.10 download artifacts; this receipt and plugin context. Primary append-only incident ledger receives the evidence update. Prior PR71 audit/manifest/staging receipt files predate this implementation and are preserved.

Rollback boundary: revert this package-only patch and remove only its new 0.2.10 artifacts if desired. Do not overwrite 0.2.9, revert primary user work, alter production or delete test accounts/media. No rollback of hosted application settings is required.

## Remaining release gates

This fixes and proves the tested local package/client boundary against the real existing service. It does **not** deploy PR71's 106-tool backend, update the normal installed plugin, advance public download links, publish a directory listing, or establish all application parity. Desktop Install-button UX and other Codex versions remain unverified; Claude was deferred at the user's explicit instruction. A public-directory demo recording/approval remains outstanding. Preserve the independent PR71 schema/server/review/release gates and the recorded first-attempt OAuth uncertainty.
