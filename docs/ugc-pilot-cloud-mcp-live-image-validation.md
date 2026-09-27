# MCP live image validation plan

Status: prepared on 2026-09-28; no production change has been made. The isolated MCP-only release candidate is local commit `84529d8` on `codex/mcp-image-validation`, based on production commit `d741487`. It excludes the unrelated working-tree changes.

## Current live state

- `https://getugcpilot.com` serves the current website. `www.getugcpilot.com` redirects there.
- `https://mcp.getugcpilot.com/mcp/health` returns Vercel `DEPLOYMENT_NOT_FOUND` (HTTP 404). The current website deployment does not contain the MCP routes.
- OAuth, asset, and image-generation fixtures and the two proposed migrations pass locally. The isolated Next.js release candidate builds with the existing local environment loaded into the build process; that secret file is not in the release checkout.

## Proposed isolation

1. Review the two additive migrations (`20260927150038_mcp_oauth.sql` and `20260927183258_mcp_atomic_generation_job.sql`) and apply them to the existing Supabase project. Their new MCP tables/functions are service-role-only; the existing website billing and job functions are reused.
2. Create a production-target Vercel deployment from only commit `84529d8` with automatic domain assignment skipped. Assign `mcp.getugcpilot.com` to that deployment; keep the current apex and `www` aliases on commit `d741487`.
3. For this isolated deployment, set the OAuth issuer to `https://mcp.getugcpilot.com` so consent and token routes are available on the new deployment without changing the website. This differs from the earlier approved apex issuer and needs approval. Add the MCP subdomain to Firebase Authentication's authorized domains if it is absent.
4. Confirm the MCP host serves its health and OAuth metadata endpoints, while the apex website continues to serve the prior deployment. Verify registration, Firebase sign-in and consent, PKCE token exchange, scopes, refresh and revocation with a test account.
5. With that account, queue one image using a known prompt and a unique request ID. Poll `get_job`, confirm the completed owned asset via `get_asset`, repeat the same request ID to prove no second credit reservation or provider job, and inspect credit settlement. Check queue recovery configuration and test an error path without generating another paid output.

## Stop conditions and rollback

Stop if the apex alias changes, health is not ready, OAuth cannot complete, the queue is not configured, or a credit reservation cannot settle. Remove the MCP alias from the candidate deployment to stop new MCP requests; the website alias remains on its current deployment. The additive database migration is retained for inspection because dropping auth/token tables could destroy test records; any cleanup would be a separately reviewed action.

This plan changes the production database schema and MCP subdomain. It does not deploy the candidate to the apex website. It requires explicit approval under the original MCP stop-and-ask instruction and the user's request to protect live workflows.
