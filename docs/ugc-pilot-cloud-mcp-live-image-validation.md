# MCP live image validation plan

Status: rollout approved by the user. On 2026-09-28 the two additive MCP migrations were applied to the shared Supabase project; no Vercel deployment or paid image job has occurred. The isolated release branch is `codex/ugc-mcp`, based on production commit `d741487`, and excludes unrelated working-tree changes. The Vercel account requires its owner to complete two-factor authentication before the project can be configured.

## Current live state

- `https://getugcpilot.com` serves the current website. `www.getugcpilot.com` redirects there.
- `https://mcp.getugcpilot.com/mcp/health` returns Vercel `DEPLOYMENT_NOT_FOUND` (HTTP 404). The current website deployment does not contain the MCP routes.
- OAuth, asset, and image-generation fixtures and the two applied migrations pass locally. The isolated Next.js release candidate builds with the existing local environment loaded into the build process; that secret file is not in the release checkout.
- The connected Supabase main branch has both MCP migrations: `20260927202555_mcp_oauth` and `20260927202613_mcp_atomic_generation_job`. The live `reserve_billing_credits` and `create_or_get_background_job_v1` functions and their user-scoped idempotency indexes still exist. The latest website deployment is commit `d741487`; its aliases include the apex and `www`, but not `mcp.getugcpilot.com`.

## Safety findings

- The earlier same-project `--prod --skip-domain` plan protects the website during that one deployment, but adding `mcp.getugcpilot.com` as a normal production domain on the website project creates a future release risk: Vercel automatically assigns project production domains to later production deployments. Do not use `vercel promote` on the website project for MCP because it promotes the deployment to the project's production domains.
- A separate Vercel project under the same team, built from the same UGC Pilot codebase and using the existing Supabase, storage, billing, and worker services, isolates the MCP domain and its environment variables from website deployments. This is hosting isolation, not a second business backend. It must follow an MCP release branch (or manual MCP deployments), not the website's `main` branch, or a later website push could replace the MCP code. The release candidate now gates unrelated routes when `MCP_ONLY_DEPLOYMENT=true` or the host is `mcp.getugcpilot.com`; verify that gate on the deployed host.
- The current Firebase client config uses `getugcpilot.com` as `authDomain`. Reliable redirect fallback on `mcp.getugcpilot.com` needs a project-specific `authDomain` for that host, the existing Firebase helper rewrite, and the corresponding Firebase authorized domain and Google OAuth redirect URI. These changes are additive; verify the existing website sign-in afterward.
- The earlier Phase 5 candidate could report video as available before `generate_video` existed. The release candidate now reports video unavailable in both `get_entitlements` and `get_capabilities` until Phase 6 is implemented.
- The two MCP migrations created new tables/functions and grants without replacing website billing or job functions. Their service-role grant and exclusion of anon/authenticated were verified after applying them. After migration, the live homepage and sign-in page loaded and the website deployment ID was unchanged. An authenticated website flow still needs a test account.

## Approved isolation and rollout progress

1. Complete: applied the two additive migrations (`20260927202555_mcp_oauth.sql` and `20260927202613_mcp_atomic_generation_job.sql`) to the existing Supabase project. Their new MCP tables/functions are service-role-only; the existing website billing and job functions are reused.
2. Create a separate `ugc-mcp` Vercel project from the MCP release candidate. Pin its release source to a dedicated MCP branch or manual deployment flow, use project-specific environment variables, and set `MCP_ONLY_DEPLOYMENT=true`. Verify the route guard blocks website/API routes while preserving MCP/OAuth and static assets. Keep the current `ugc` project, its production branch, and its apex/`www` aliases untouched.
3. Configure `MCP_OAUTH_ISSUER=https://mcp.getugcpilot.com`, `MCP_PUBLIC_URL=https://mcp.getugcpilot.com/mcp`, and `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=mcp.getugcpilot.com` only for the MCP project. Verify the Firebase helper rewrite, authorized domain, and Google OAuth redirect URI. Confirm the existing website still signs in.
4. Build and check health/metadata on the new project's generated Vercel URL, then attach only `mcp.getugcpilot.com`. Confirm the MCP host is healthy while the apex website still serves the same deployment ID. On the MCP domain, verify registration, Firebase popup and redirect sign-in, consent, PKCE token exchange, scopes, refresh, and revocation with a test account.
5. Confirm the MCP project's Cloud Tasks configuration and the existing image worker before queueing a paid job. With the test account, queue one image using a known prompt and a unique request ID. Poll `get_job`, confirm the completed owned asset via `get_asset`, repeat the same request ID to prove no second credit reservation or provider job, and inspect credit settlement. Check queue recovery configuration and test an error path without generating another paid output.

## Stop conditions and rollback

Stop if the apex deployment ID or alias changes, health is not ready, OAuth cannot complete, the queue is not configured, or a credit reservation cannot settle. Remove the MCP domain from the separate project to stop new MCP requests; the website project remains untouched. The additive database migration is retained for inspection because dropping auth/token tables could destroy test records; any cleanup would be a separately reviewed action.

The database schema step is complete. Firebase/Google OAuth allowlists, the MCP subdomain, and the separate Vercel project are pending. The candidate has not been deployed to the apex website.
