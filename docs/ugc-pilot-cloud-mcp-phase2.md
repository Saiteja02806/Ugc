# UGC Pilot Cloud MCP: Phase 2 implementation

Status: local implementation and validation complete on 2026-09-27. Production migration and deployment have **not** been performed. Phase 3 now registers six read-only tools locally; see [Phase 3](ugc-pilot-cloud-mcp-phase3.md).

## Phase 1 handoff

The user approved the 12-tool [contract](ugc-pilot-cloud-mcp-v1-contracts.md) and [schemas](ugc-pilot-cloud-mcp-v1-tool-schemas.json) on 2026-09-27. No further Phase 1 instructions are needed to implement the server skeleton. `cancel_job` remains excluded. The approved Firebase identity and first-party OAuth issuer architecture is used here.

## Routes and identity

- `https://mcp.getugcpilot.com/mcp` serves Streamable HTTP through the official MCP TypeScript server SDK. A fresh server and request context are created for each exchange. Legacy 2025 clients use the SDK's stateless compatibility path.
- `/.well-known/oauth-protected-resource` and `/.well-known/oauth-protected-resource/mcp` advertise the canonical MCP resource and `https://getugcpilot.com` as issuer.
- `https://getugcpilot.com/.well-known/oauth-authorization-server` advertises the authorization, token, registration, and revocation endpoints; PKCE S256; RFC 9207 `iss`; and the approved scopes.
- `/oauth/authorize` shows the OAuth client name, exact redirect host, and requested scopes. The user signs in with the existing Firebase UI. If Google popup sign-in falls back to a full-page redirect, the global auth handler keeps a verified user on the OAuth consent page when Firebase returns. `/oauth/authorize/decision` verifies the Firebase ID token on the server before issuing a five-minute, single-use authorization code.
- `/oauth/token` validates client ID, exact redirect URI, resource indicator, and PKCE before issuing an opaque one-hour access token and 30-day rotating refresh token. The authorization-code check, single-use consumption, and both token inserts run in one database transaction so an insert failure leaves the code retryable. Tokens and authorization codes are stored as SHA-256 hashes in the existing Supabase database. Refresh replay revokes the whole token family.
- `/oauth/revoke` revokes an access/refresh token family. `/oauth/register` supports public OAuth Dynamic Client Registration with validated redirect URIs and an atomic limit of 20 registrations per source IP per hour on Vercel. Client ID Metadata Documents are also accepted over pinned, public-address HTTPS requests with redirects disabled, a 32 KiB size limit, and a five-second absolute response deadline. Registration and consent reject malformed JSON object bodies before touching authentication or storage.
- Every `/mcp` request checks the bearer token in the database, its expiry and revocation state, and its exact audience. The Firebase UID comes from that token and is passed to the MCP request context; clients cannot supply it as a tool argument.
- `GET /mcp/health` returns 503 if the OAuth token table is unavailable. OAuth and MCP logs use structured event names and omit raw secrets, tokens, and request bodies.

## Database and configuration

The migration is [`20260927202555_mcp_oauth.sql`](../supabase/migrations/20260927202555_mcp_oauth.sql). It creates four RLS-enabled tables and restricted refresh-rotation and client-registration functions in the existing Supabase project. Only the server-side service role receives table access and function execution. No second backend or user table is introduced.

The current `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `NEXT_PUBLIC_FIREBASE_API_KEY` remain required. Optional configuration:

| Variable | Default | Purpose |
| --- | --- | --- |
| `MCP_PUBLIC_URL` | `https://mcp.getugcpilot.com/mcp` | Canonical token audience and resource URI |
| `MCP_OAUTH_ISSUER` | `https://getugcpilot.com` | First-party authorization server issuer |

The issuer and MCP domains must both route to the existing Next.js app. Live checks found that `www.getugcpilot.com` redirects to the canonical apex host, so the OAuth issuer defaults to `https://getugcpilot.com`. The local DNS lookup resolved `mcp.getugcpilot.com`, but its live `/mcp` response is Vercel's `DEPLOYMENT_NOT_FOUND` rather than the app's 404. The subdomain must be attached to the intended Vercel project during rollout. The connected local database does not yet have the migration: a bearer-token request returned `PGRST205`, and readiness correctly returned 503. The connected UGC Supabase project has only its main branch; there is no isolated remote branch for end-to-end OAuth testing. The local Docker daemon is unavailable, so the migration was verified with PGlite instead of a local Supabase stack. In keeping with the user's instruction to protect live workflows, no production database, domain, or deployment changes were made.

## Validation performed

- Installed MCP SDK `@modelcontextprotocol/server@2.1.0` and `ipaddr.js@2.5.0`, pinned in `package-lock.json`.
- Targeted ESLint and the optimized Next.js production build passed. The build includes all new MCP and OAuth routes.
- A separate raw `tsc --noEmit` run reported only a pre-existing `lib/reaction-format/generation-jobs.test.ts` fixture error; no Phase 2 type errors.
- PGlite executed the migration, confirmed four tables and restricted function grants, exercised denial as `anon` and access as `service_role`, then verified atomic authorization-code exchange (including invalid inputs and rollback on token insert failure), refresh rotation, replay revocation, and the registration limit.
- Pure tests covered redirect URI rules, PKCE S256, and scope parsing.
- Local Next.js probes confirmed protected-resource and authorization-server metadata, `/mcp` 401 with a bearer challenge, invalid registration/token requests returning 400, and readiness 503 when the migration is absent. A route-level fixture also confirmed a valid bearer reaches MCP discovery; missing, expired, revoked, or wrong-resource tokens return 401; a storage failure returns 503; and a foreign `Origin` returns 403. The route queries only the token hash, never the bearer secret.
- Client ID Metadata lookup now has a five-second total DNS and HTTPS deadline and a 32 KiB response limit measured in bytes. HTTPS stays pinned to a resolved public address with redirects disabled.
- A local production server returned 400 for `null` JSON sent to registration or consent and for a consent request with the wrong content type.

## Remaining rollout work

1. Review and apply the migration to the existing Supabase project, then verify the four tables, function grants, and `/mcp/health` against the deployed site.
2. Attach `mcp.getugcpilot.com` to the existing Vercel project, deploy the app, and verify the two hostnames serve their intended routes over HTTPS. Test a real Firebase sign-in, client registration/CIMD, consent, code exchange, refresh, revocation, and an authenticated MCP initialization from the production domains.
3. Validate the locally implemented Phase 3 read-only tools and Phase 4 media mutation tools against authenticated production data after an approved rollout. Generation and job tools belong to later phases.

Production acceptance must use the real domains, per `AGENTS.md`; localhost checks above are only compile and isolated-flow sanity checks.

## Phase 3 read-only handoff audit

The six approved read-only tools have concrete existing data sources and are now registered locally. The table below records their Phase 3 adapters.

| Tool | Existing source | Required adapter work |
| --- | --- | --- |
| `get_profile` | Verified MCP token supplies the Firebase UID. Existing Firebase admin lookup is by email, not UID. | Returns stable `id`; optional name/email are omitted until a trusted UID lookup is added. |
| `get_entitlements` | `getUserSubscription` resolves plan, access source, credit balance and generation prices. | Uses strict, read-only mode to fail when core billing queries or the active credit row are unavailable; previews an expired cycle without a write. Website calls retain their existing refresh and fallback behavior. |
| `get_saas_brand` | `getBusinessProfileForUser` scopes the row by Firebase UID. | Maps saved `source_url` (including optional app URL), name, summary and audience; missing profiles return `BRAND_NOT_FOUND`, unfinished onboarding returns `ONBOARDING_REQUIRED`, and incomplete completed contexts return `BRAND_INCOMPLETE`. |
| `list_assets` | `listMediaAssetsPage` filters owner, ready status, and nondeleted rows. | Bounded search and `(updated_at DESC, id DESC)` cursor pagination; HMAC cursor is bound to owner and filters. |
| `get_asset` | `getMediaAssetForOwner` checks owner and nondeleted state. | Requires `status = ready`, then maps the approved metadata/URL shape; unknown and cross-user IDs share `NOT_FOUND`. |
| `get_capabilities` | AI Studio generation settings define ratios, counts and durations; `getUserSubscription` defines active paid access. | Intersects backend settings with plan and minimum available credits, omits model names, and advertises image references only for video V1. |

The existing media API applies a separate Creative Library visibility filter to its list response. The approved MCP contract says owner-owned, ready, nondeleted assets and explicitly names source types that the website library hides; Phase 3 should follow that contract without silently changing the website list. The live Supabase project has no development branch, so owner isolation and pagination can be tested locally with focused fixtures, while real authenticated acceptance waits for an isolated environment or approved rollout.
