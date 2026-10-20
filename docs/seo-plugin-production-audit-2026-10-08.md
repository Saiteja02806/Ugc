# UGC Pilot SEO and plugin production audit — 8 October 2026

This is the pre-release audit. The later [hosted release report](plugin-production-release-2026-10-08.md) supersedes its deployment, download, dependency, and consent status. Both hosted projects now serve the reviewed 0.1.1 release, while public installed-client acceptance and intermittent transport reliability remain open. Retain the findings below as the original baseline.

**Verdict: public plugin rollout is not ready.** Production MCP account reads and a fresh image generation work, and the deployed SEO pages pass crawl checks. Customer setup/downloads are absent from production, intermittent MCP transport errors reproduced, dependency security checks fail, and installed-host/fresh-account acceptance remains incomplete.

This audit inspected the shared working tree, tested the real production domains, and delegated an independent SEO analysis. The repository contains hundreds of unrelated existing changes; passing a scoped MCP test is not approval of the entire application. No source fix, dependency upgrade, deployment, push, or public-directory submission was performed by this audit. One image test used one UGC Pilot credit.

**Regression results**

| Check | Result | Scope |
| --- | --- | --- |
| `npm run test:mcp` | Passed | 11 unit checks plus read/auth/upload/delete, generation/job, token-error, OAuth migration, generation migration, and real-SDK offline signing suites |
| `npm run test:free-generation-credits` | Passed, 11 tests | Free allowance, reservation/refund, paid sources, concurrency, and database role restrictions in test fixtures |
| Scoped ESLint | Passed | MCP/OAuth/discovery, setup page, plugin validator, and SEO page code |
| Standalone `tsc --noEmit --incremental false` | Passed at its check point | Shared source can change while the audit is running; final production build is authoritative |
| Plugin validator | Passed | 12 allowlisted files, 12 tools; package format does not prove host installation behavior |
| ZIP SHA-256 | Matches earlier reviewed package | `f7d363d5f297cc7a04f34bf5c0e2c8d428e3920773df0807183c6b5423df23b5` |
| Diff whitespace | Passed | No push/staging performed |
| Full production build | Final recheck passed, 146 static pages generated | Type checking enabled; the first failed build was superseded after the shared files acquired the missing `duration: null` fields |
| Application production dependency audit | Failed | 1 critical and 7 high package entries |
| Worker production dependency audit | Failed | 3 high package entries |

The MCP suites use fixtures and a local database emulator. They cover ownership, scope checks, strict inputs, idempotency, partial batches, queue outages, duration pricing, token lifecycle, and storage failures, but they do not replace production acceptance on each target client.

**Live production evidence**

| Check | Result |
| --- | --- |
| MCP health | HTTP 200, ready |
| Protected-resource and authorization-server discovery | HTTP 200; resource and OAuth issuer both use `mcp.getugcpilot.com` |
| Missing/invalid bearer | HTTP 401, no-store, resource metadata challenge |
| Invalid Origin | HTTP 403 |
| Invalid client registration / empty token request | HTTP 400 with safe errors, no-store; no valid client or token created |
| Host isolation | Website `/mcp` and MCP-host `/pricing` return 404 |
| Connected account profile, entitlements, capabilities, library, brand | Passed |
| Existing completed image/video jobs and output assets | Retrieved after transport retries |
| Missing asset | Safe `NOT_FOUND`, nonretryable, after retry |
| Fresh image, completion, and retrieval | Passed |
| Returned media URL headers | New image: HTTP 200 image/png; previous video: HTTP 200 video/mp4, checked with HEAD requests |
| Identical generation replay | Same job ID; no additional observed charge |
| Setup page and ZIP/checksum/guide | All HTTP 404 on production |

Production issuer discovery is authoritative. Local fallback configuration names the website origin, but the deployed configuration correctly advertises the MCP origin; probing OAuth on the website is not a valid failure test for this deployment.

Fresh test request: `ugc-readiness-20261008-ceramic-mug-v1`, one 9:16 image. Job `8cc17263-42d8-4450-989f-9575bc14fe45` completed with asset `6f348ef3-8c61-44d8-8dc8-c4ef1674756c`. Creation/completion timestamps show approximately 19 seconds for this run. The exact replay returned the same completed job. Credits moved from 187 to 186, with zero reserved credits afterward. This is a bounded canary, not a latency guarantee or broad billing certification. The result was retained in the account.

Today's video check retrieved the job and asset generated on 7 October; no new video was generated today. The previous image/video paid canary and its limitations remain documented in `docs/ugc-pilot-mcp-integration-test-2026-10-07.md`.

Five concurrent job/asset read calls failed with client transport-send errors; individual retries then succeeded. The test does not identify whether the client, network, connection reuse, platform, or server caused the failure. Public health/auth probes remained available. Production responses lacked the local source's `X-Request-Id`, so the new tracing path is not accepted on production. Correlate a repeated failure with client and server logs before claiming the problem is fixed.

These production URLs currently redirect from www to the canonical website and return 404:

- `/connect-ai`
- `/downloads/ugc-pilot-0.1.0.zip`
- `/downloads/ugc-pilot-0.1.0.zip.sha256`
- `/downloads/ugc-pilot-setup.md`

**Release gates**

1. Resolve the security audit findings and assess actual runtime exposure. Recheck both application and worker lockfiles after upgrades.
2. Preserve and validate the exact intended release source. Today's final shared-checkout build passes with type checking enabled and 146 static pages generated. The earlier two missing `duration` errors are resolved in the final build; they are not an outstanding blocker. A scoped release still needs validation of its own source and locked dependencies.
3. Deploy the reviewed website setup/downloads and MCP fixes, preserving the separate website/MCP route boundary. Verify real production download bytes against the reviewed ZIP and checksum.
4. Reproduce and trace transport failures. Preserve the same generation request ID after an uncertain submission; do not recover by creating another charge.
5. Validate fresh-account OAuth and installed plugin workflows in ChatGPT, Claude, and Claude Code. Run the existing ten evaluation cases, including unsupported requests and uncertain retries. Complete live cross-account, insufficient-scope, refresh/revoke/reconnect, and test-upload cleanup acceptance.
6. Finish directory submission metadata and reviewer materials, then submit and publish separately on each platform.

The local billing correction uses `initializeFreeCredits: false` in MCP reads and preflight. Regression fixtures pass. Its production behavior on a fresh free account was not exercised in this audit, and the correction's deployment is unverified. Current production happy-path tests used an existing paid account. Current deployed consent wording likewise was not revalidated through a new OAuth flow.

**Security findings and practical limits**

Application audit entries: `proxy-addr` (critical), `next`, `@modelcontextprotocol/sdk`, `@grpc/grpc-js`, `@firebase/firestore`, `@firebase/firestore-compat`, `firebase`, and `source-map-js` (high). Worker entries: `next`, `geist`, and `source-map-js` (high). Counts include packages inheriting a dependency's advisory; they are not counts of distinct confirmed exploits.

`proxy-addr@2.0.7` is pulled through Express and the older SDK, with the production Google GenAI package holding an optional SDK peer. The critical advisory requires particular proxy trust configuration; this audit did not establish that condition. Its patch is 2.0.8. [Maintainer advisory](https://github.com/advisories/GHSA-jqcg-44mw-7w3h)

The older SDK is 1.29.0; the flagged OAuth issue concerns HTTP clients connecting to untrusted MCP servers, rather than SDK-built MCP servers. The audited server imports the separate `@modelcontextprotocol/server` package. Remove or update the older dependency and check client usage rather than claiming the UGC Pilot authorization server is compromised. The SDK patch is 1.31.0. [SDK advisory](https://github.com/advisories/GHSA-6qxp-vccf-f47h)

Next.js is 16.3.7 in the current application and worker locks. The image-optimization advisory identifies 16.3.8 as patched; other reported Next advisories also require review against actual features and hosting. Current image allowlisting is restricted to Google hosts. [Next advisory](https://github.com/advisories/GHSA-cjq9-62q9-8jv4)

Do not run an automatic forced Firebase downgrade based on npm's proposed fix. Choose compatible patched transitive versions and rerun auth, generation, rendering, and billing regression checks. Audit results describe current local locks; today's deployed dependency locks were not independently fetched.

Automatic approval review initially blocked the npm scan because it can transmit private dependency names. Both locks were then inspected: all 872 application and 181 worker entries resolve to public `registry.npmjs.org`, with no private/git/file/linked entries. A retry with that evidence was approved and both scans completed. Nothing remains blocked by that approval review.

**How customers connect**

Use the same hosted Streamable HTTP endpoint on supported clients: `https://mcp.getugcpilot.com/mcp`. Each customer signs into their own UGC Pilot account and approves OAuth permissions. Their UGC Pilot plan/credits pay for generation separately from the AI subscription. The plugin supplies configuration and workflow skills; the server stays hosted.

- ChatGPT beta: eligible users can create a personal connection through Plugins → plus → Add custom MCP server, configure OAuth, install it, and invoke it with `@`. Account/workspace policies apply. [Official connection instructions](https://developers.openai.com/plugins/deploy/connect-chatgpt)
- Claude beta: Customize → Connectors → Add custom connector, enter the endpoint, review detected OAuth settings, sign in, and enable it for the conversation. Organization setup can require an owner. [Claude connection instructions](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp)
- Codex and Claude Code: use the supported MCP connection or compatible local plugin installation documented in `plugins/ugc-pilot/skills/connect-ugc-pilot/references/client-setup.md`. Codex direct OAuth works in this audit; the complete installed-host evaluation remains pending.

The earlier report records an account-scoped private ChatGPT plugin. That record does not prove customer-wide installability or public publication. Uploading a ZIP as an ordinary chat attachment does not connect the hosted tools.

Current scope: 12 tools for account/brand reads, library/assets, uploads/deletion, image generation, 3–10 second video generation, and job retrieval. Counts are 1, 2, or 4. The beta does not expose carousels, audio generation, scheduling, or social publishing.

**Directory distribution**

For ChatGPT/Codex, use the OpenAI plugin submission portal. Complete publisher verification, upload the package, resolve checks, supply reviewer access and realistic tests, and publish after approval. The current manifest lacks the required MCP-review listing fields `websiteURL`, `supportURL`, `privacyPolicyURL`, and `termsOfServiceURL`; `homepage` does not substitute for them. [OpenAI submission requirements](https://developers.openai.com/plugins/deploy/submission)

For Claude, submit separately through its developer portal. A connector-only submission references the remote server; a plugin bundle combines MCP configuration and skills and is hosted on GitHub for review. After approval, publish the listing. Reuse the backend with platform-specific packaging and acceptance tests. [Claude distribution instructions](https://claude.com/resources/articles/build-plugins-for-claude)

Public discovery, installation, and per-user OAuth are separate steps. Hosting the MCP endpoint or making a downloadable ZIP does not automatically add a directory listing.

**SEO**

The independent agent's crawl review passed for all 13 public sitemap pages and 23 internal destinations. Canonicals, titles/descriptions, robots handling, and private-route exclusion work. Google index inclusion and acquisition performance are unverified. The largest measured overhead is eight globally preloaded fonts totaling 2,583,724 decoded bytes. The separate `docs/seo-improvement-plan-2026-10-08.md` contains the evidence and 30-day plan.

**Retained test evidence**

- `.tmp/mcp-regression-2026-10-08.log`
- `.tmp/free-credit-regression-2026-10-08.log`
- `.tmp/seo-mcp-lint-2026-10-08.log`
- `.tmp/seo-mcp-types-2026-10-08.log`
- `.tmp/seo-mcp-build-2026-10-08.log` and `.tmp/seo-mcp-build-final-2026-10-08.log`
- `.tmp/seo-mcp-audit-2026-10-08.json` and `.tmp/seo-mcp-worker-audit-2026-10-08.json`
- `.tmp/live-mcp-release-20261008.json` and its probe script
- `.tmp/authenticated-mcp-audit-20261008.json`
- `.tmp/live-mcp-media-20261008.json` and its HEAD-only probe script

These local artifacts are test evidence, not plugin package contents. Preserve the test results alongside a stable release snapshot before deployment.
