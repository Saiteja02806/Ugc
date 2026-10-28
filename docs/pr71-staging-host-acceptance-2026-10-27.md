# PR71 staging builds and host acceptance — 27 October 2026

Result: matching staging builds verified; original Codex package fails actual host loading; neither host's complete OAuth/callback/safe-read journey is accepted. The user subsequently requested moving sign-in testing to the real application to avoid staging's additional authentication layer. No production release, setting change or publication occurred.

## Matching builds actually created

Source: `729cc229102979fec2816d140a3fad97c7eefbdf`, PR71, plugin0.2.9. Vercel fetched the exact Git SHA; no dirty checkout was uploaded.

| Role | Staging project | Deployment | Result |
| --- | --- | --- | --- |
| Website | `prj_ZblBbIB3tOpMRKAQLUY0CbcbTSOI` | `dpl_2psCcgVGuUkoKpt6CnyDV8zTwaG5` | READY; stable `ugc-agent-staging-web.vercel.app` resolves to this build |
| MCP | `prj_1x1ziEhzA29U5gWMISdIQRjCyHKU` | `dpl_Bs35uwhNVLuv5kSDJo8o71hJL62p` | READY; stable `ugc-agent-staging-mcp.vercel.app` resolves to this build |

Both use the dedicated staging Supabase URL `https://zmmayoyslgtvrmwiabqq.supabase.co`, Firebase/GCP project `ugc-agent-staging-20261023`, staging OAuth issuer/resource and staging website origin. Only staging configuration was read. Service-role and encryption variables remain Sensitive; they were not retrieved or copied. Individual non-secret configuration reads verified the actual values; the bulk environment API returned encrypted representations even when decryption was requested and was not used as plaintext proof.

Added explicit false values for `MCP_BUSINESS_CONTEXT_WRITES_ENABLED`, `MCP_BUSINESS_ONBOARDING_WRITES_ENABLED` and `MCP_BUSINESS_MEDIA_WRITES_ENABLED` in these staging projects only. All prior staging gates remain false. Billing remains test_mode and social reconciliation/background onboarding remain disabled. No worker, bucket, provider application, migration or billing was provisioned.

## Protected readiness verified

Initial short-lived staging development OIDC request returned HTTP403 `TRUSTED_SOURCES_ENVIRONMENT_MISMATCH`. User explicitly approved temporary development-to-production self-access in the two staging projects, with restoration after checks. Here production is Vercel's stable environment within each staging project, not either real UGC production project.

The MCP dashboard customization preserved its four default environment pairs and added only development-to-production self-access. A website API payload preserving those defaults was rejected by automatic approval review as broader than the approved pair; the successful narrowed website payload allowed only development-to-production self-access. No rejected payload was applied indirectly. Both projects retained SSO on all deployments throughout.

Through normal short-lived staging OIDC credentials held only in child-process memory:

- MCP health HTTP200 ready.
- Protected-resource metadata HTTP200, exact staging resource/issuer, all13 candidate scopes.
- Authorization metadata HTTP200, staging authorize/token URLs, PKCE S256 and CIMD.
- Anonymous application MCP request HTTP401 with its account:read challenge; root route HTTP404 on MCP-only host.
- Website sign-in/connect pages HTTP200; connect page links0.2.9.
- Hosted ZIP HTTP200 application/zip,142182bytes, SHA256 `409411370c124c6337570501068fde1f5d6a7f0fe737fd710ec621a6376b733c`, matching committed candidate ZIP.

After the user changed direction, **both temporary Trusted Sources settings were restored to their recorded prior null values and read back**, with `ssoProtection.deploymentType=all`. No automation bypass secret was created. Existing shareable links were not managed by this task; a dashboard row was observed, so no claim is made that the project has zero pre-existing grants.

## Actual installed-host findings

Disposable profiles and fixtures are under ignored `.tmp/pr71-host-acceptance-20261027/`. They do not replace the user's existing client configuration. The initial fixture retargeted JSON/Markdown production URLs to the verified staging domains, kept executable helpers byte-identical, and recorded all47 package source/fixture hashes. It is a staging test copy, not the unmodified public archive.

### Codex original package: FAILED

Actual installed client: `codex-cli0.164.0-alpha.11.1`. CLI marketplace/add and plugin/add succeeded for0.2.9 with ON_INSTALL. Through the actual app-server, plugin/read loads18skills but returns `mcpServers=[]`; a thread-bound server-status read is empty. Loader warnings explain why: portable `mcp.json` server `extensions` is rejected with `unknown field extensions, expected url or headers`. Root portable configuration takes precedence over the compatibility `.mcp.json`. This is UGC-OPS-011, recorded OPEN before any compatibility experiment.

Package validation did not catch this real host boundary. The original installed candidate has not passed install-to-sign-in acceptance.

### Disposable Codex diagnostics: PARTIAL

Only in the ignored fixture, removing the portable server extension makes plugin/read report the bundled `ugc-pilot` server. An environment-placeholder header added to that portable entry does not produce accepted gateway access in this Codex build; the server encounters Vercel protection. No credential was embedded in that file.

A separate direct staging MCP configuration, explicitly distinguished from the plugin, used supported `env_http_headers` and only `account:read`. Normal `codex mcp login` produced an authorization URL using official Codex CIMD, PKCE S256, staging resource and a loopback callback. The user reported `The requested action is invalid`; exact source, screen and cause are UNKNOWN. Do not conflate this report with the earlier different `This connection link is invalid` event or infer callback success. The login attempt was stopped when the user changed direction.

### Claude Code: NOT ACCEPTED

The existing Claude2.1.76 installation reports signed out. The official npm2.1.311 binary was fetched into temporary npm cache without changing that installation. A separate CLAUDE_CONFIG_DIR installed staging plugin0.2.9 successfully and reported signed out.

Its original protected connection timed out during negotiation. The disposable header/metadata diagnostic reached a registration attempt rejected by Vercel protection; a later CLI MCP login invocation reported that its piped stdin was not a terminal. These are not successful OAuth or authenticated-read evidence. No Claude model turn ran and no application token was extracted. A future acceptance must use an interactive client and normal account sign-in, not label the harness failure as an application OAuth defect.

### Staging website onboarding message

User reported `Business profile needs attention` and missing `GCP_AI_GENERATION_TASK_URL`/`GCP_BACKGROUND_JOB_TASK_URL` plus Google credentials after Google sign-in. This is consistent with deliberately unprovisioned staging background workers; it does not alone prove whether Firebase sign-in or OAuth completed. Do not copy production worker credentials into staging, enable background setup, or fake onboarding completion to pass account-read testing. The OAuth consent controller has a separate sign-in path; brand reads require onboarding while profile/entitlement/capability checks have separate contracts.

## Next agreed direction and scope

Use the real application for narrowly scoped normal sign-in and safe reads after resolving the package-loader defect. This avoids requiring media workers for authentication testing. It does not authorize deployment of PR71, production configuration/migrations, provider publishing or a claim that existing production certifies an unreleased server candidate.

Before a canonical packaging fix, complete mandatory repo preflight and add an actual host-loader regression. Preserve the richer supported portable metadata only through a compatible packaging strategy validated on target clients. The one-field fixture experiment establishes a narrow loading boundary, not the final release design or a permanently repaired default login. Do not silently promote that experiment.

## Completion and protection receipt

- Scope: exact staging builds, staging-only three false gate values, temporary approved self-access and verified restoration, real client install/discovery diagnostics, non-secret evidence.
- Application source, canonical plugin/archive and production unchanged VERIFIED by targeted diff/hash and mutation target scope. No publication, generation, media transfer, migration or model turn performed.
- Production UI/source/identity/schedule execution NOT TESTED. No fake before/after UI acceptance.
- Sources used: deployment/protected-access/env skills and current official Vercel documentation; official Codex plugin/MCP/app-server and Claude MCP documentation; actual client help/generated protocol schemas; candidate manifests/registry/OAuth/read-tool/controller code; prior release/setup receipts; root nonnegotiables/context-memory/immutable/regression procedures and relevant ledger/Explore portions. Large context histories were not fully reread; no application-code edit was made.
- Files changed by this task: this receipt and current context/readiness links, plus append-only UGC-OPS-011 and UGC-OPS-005 follow-up in the primary ledger. Ignored test profiles, schemas, fixture hashes and non-secret receipts are local test artifacts; original source remains unchanged. Documentation changes remain local/unpushed.
- Remaining: supported canonical Codex package loading; normal live sign-in/callback/same-client safe read; clean interactive Claude acceptance; exact-candidate release configuration and broader media/provider acceptance. Status PARTIALLY VERIFIED, not production-ready.
