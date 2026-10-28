# UGC Pilot production audit — 2026-10-16

## Decision

UGC Pilot is **not ready for an unqualified public-production claim**. The deployed MCP server is healthy, has a correctly discoverable OAuth implementation, and the current authenticated Codex connection can run its read-only capability tools. The 0.2.2 distributable source candidate is internally tested. It still lacks a clean installed-host OAuth acceptance run, public directory approval, deployment acceptance, and several deliberately disabled product capabilities.

## What was checked

| Area | Result | Evidence |
| --- | --- | --- |
| Portable package | Pass with correction | `plugins/ugc-pilot/mcp.json` now declares OAuth/CIMD, protected resource, and a minimal initial scope. Package validation checks the exact declaration. |
| Codex Install path | Earlier candidate installed; 0.2.2 recheck pending | `codex plugin marketplace add <checkout-root>` then `codex plugin add ugc-pilot@ugc-pilot-local` must install 0.2.2 with `authPolicy: ON_INSTALL`. The noninteractive CLI does not open a browser, so a person must complete sign-in/consent in an interactive client. |
| Public directory Install button | Not ready | No directory approval or public listing was found. A local marketplace and a ZIP are not a public directory release. |
| OAuth metadata | Pass | Live health, protected-resource metadata, issuer metadata, PKCE S256, issuer binding, CIMD, and anonymous 401 challenge passed on 2026-10-16. |
| OAuth return after login | Not yet proven | Source validates redirect URLs, PKCE, issuer propagation, authorization-code exchange, refresh rotation, and token revocation. A clean host session has not completed this flow during this audit. |
| Live connection | Partial pass | 79 current `ugc_pilot_3` tools were discovered and six read-only calls succeeded. This proves a prior OAuth connection works, not a fresh plugin install. |
| Candidate MCP code | Pass locally | `npm run test:mcp`, plugin validation, type checking, and the focused private-upload checks passed earlier at the candidate source. |
| Live/package catalogue | 79-tool contract | The current package and live discovery both use the 79-tool contract. Tool discovery does not prove a clean package install or OAuth return. |
| Video generation | Available for this account | `get_capabilities` reports short-video generation for 3–10 seconds, counts 1/2/4, and 9:16 or 16:9. No test generation was submitted. |
| Hook/demo composition | Available for this account | Finishing reports `opening_then_demo`, manual editing, and `creative:write`. No new render was submitted during this audit. |
| Edit export | Available for this account | Read-only capability call reports the four expected ratios and `creative:write`. |
| Audio | Disabled | Audio generation, upload, download, video import, and voice cloning all report unavailable. |
| Private IDE upload | Disabled and unverified | The source guard is fail-closed, but the separate private bucket/policy and delivery configuration are not production-verified. |

## Install and OAuth behavior

The expected flow is:

1. For local testing, add the checkout root with `codex plugin marketplace add <checkout-root>`. Codex then displays **UGC Pilot local development**, and the user selects **Install plugin** (or runs `codex plugin add ugc-pilot@ugc-pilot-local`).
2. The marketplace `ON_INSTALL` policy and portable `mcp.json` OAuth declaration tell the host this connection needs user authentication.
3. The host reads protected-resource and authorization-server discovery, then opens the UGC Pilot authorization page with PKCE and its OAuth client identity.
4. The user signs in and consents. The server returns the exact registered callback URI with `state`, `code`, and issuer identity; the host exchanges the code and starts authenticated MCP calls.

Steps 2 and 3 are backed by the current live endpoint. Source tests cover request validation and the authorization-code exchange. Step 4 must be completed in a clean host session because it depends on real Codex/Claude redirect handling and the user's sign-in state. OpenAI's documentation also specifies that OAuth may be prompted on first protected use unless a marketplace policy requests authentication on install; the local marketplace explicitly chooses the latter. [Plugin authentication guidance](https://developers.openai.com/plugins/build/auth) and [plugin packaging guidance](https://developers.openai.com/plugins/build/plugins) describe these host contracts.

## Tool-code conclusion

The tools are not merely stubs. The MCP server registers a declared 79-tool source catalogue; the test suite exercises authorization, OAuth/PKCE, account isolation, generation receipts, demos, uploads, private-upload denial paths, finishing, drafts, exports, audio, references, groups, Library, and settings using fixtures or database contracts. The correct operational claim is narrower: a passing local suite shows source behavior under controlled dependencies. It does not prove that every rollout gate, external provider, storage bucket, or host client behavior is live.

## Next action

Create protected staging deployments for the reviewed candidate, then run the clean Codex install → OAuth return → read-only connection test. No customer media generation, rendering, upload, or publishing is needed for that first acceptance run.

## 17 October update

The 0.2.2 candidate now has a successful Codex CLI marketplace install and cache byte-comparison, as well as passing package/archive, full local MCP, live OAuth-discovery, and authenticated read-only checks. This proves the portable package is accepted by Codex and carries the intended OAuth declaration. It still does **not** prove the interactive browser callback: the CLI install does not open a browser. Complete a clean desktop Codex installation and normal UGC Pilot consent, then issue the read-only connection prompt before claiming installed-host readiness. Claude Code needs the same separate clean-host acceptance.
