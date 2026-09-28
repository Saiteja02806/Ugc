# MCP live image validation plan

Status: rollout approved by the user. On 2026-09-28 the two additive MCP migrations were applied to the shared Supabase project and a separate `ugc-mcp` Vercel project was deployed from committed release candidate `b7866af`. The MCP subdomain is attached to that project and its database health check passes. No paid image job has occurred. The release branch is `codex/ugc-mcp`, based on website production commit `d741487`, and excludes unrelated working-tree changes. Signed-in Vercel dashboard access is working; no two-factor prompt is blocking the rollout. The source was uploaded directly to Vercel; no GitHub push has been authorized or performed.

## Current live state

- `https://getugcpilot.com` serves the current website. `www.getugcpilot.com` redirects there.
- `https://mcp.getugcpilot.com/mcp/health` now returns HTTP 200 with `{ "status": "ready" }`. The host is served by the separate `ugc-mcp` project. The website project does not contain the MCP routes.
- OAuth, asset, and image-generation fixtures and the two applied migrations pass locally. The isolated Next.js release candidate builds with the existing local environment loaded into the build process; that secret file is not in the release checkout.
- The connected Supabase main branch has both MCP migrations: `20260927202555_mcp_oauth` and `20260927202613_mcp_atomic_generation_job`. The live `reserve_billing_credits` and `create_or_get_background_job_v1` functions and their user-scoped idempotency indexes still exist. The latest website deployment is commit `d741487`; its aliases include the apex and `www`, but not `mcp.getugcpilot.com`.

## Live Vercel checks on 2026-09-28

- Initial direct-source deployment `dpl_BjSp54EF8WK8iqXAdUPn4Ea7CVEC` stopped at Firebase prerendering because its public configuration had not yet been added. No source secrets were uploaded.
- Public configuration deployment `dpl_98u9mHHHrnhCrshB9jPDK5F3RjD2` built successfully. After the user approved production access, the existing Supabase service-role key was saved as a Production Secret in `ugc-mcp`.
- Earlier deployment `dpl_AaMZhJAx1z5cod7EiaeVmFWxhf1U` became Ready and uses the same committed source `b7866af`, with the MCP issuer/resource/host guard, public Firebase configuration, database key, and existing storage/image-queue settings. Vercel shows `mcp.getugcpilot.com` as Valid Configuration, connected to Production.
- On the real MCP domain, health and both OAuth metadata routes return 200. An unauthenticated `/mcp` request returns 401 with the protected-resource discovery challenge. `/` and `/api/jobs` return 404, confirming that the website and its APIs are blocked on this project. The generated Vercel host also blocks website routes and rejects `/mcp` with 421 because the approved resource uses the custom host.
- No website project deployment was created on 2026-09-28. The existing website deployment `dpl_AzNbSeuQLPhyJYLL13x9RmPjwr1t`, commit `d741487`, and apex/`www` aliases remain unchanged. The live homepage and sign-in page return 200; authenticated website acceptance is still pending.
- The existing Vercel `GOOGLE_CLOUD_CREDENTIALS_JSON` is stored as a Secret and cannot be revealed or copied through its dashboard. No matching service-account key file was found in the repository. The user was asked for the existing key file path or to enter the Secret directly in the new project. Production access for `ugc-mcp` is approved, but that credential has not been added. Image generation remains unavailable until it is configured.
- Firebase authentication settings are not accessible from the current browser account. A read-only request using the active repository Google Cloud account also returned 403. The user was asked which signed-in Google account to use; no Firebase or Google OAuth settings were changed.
- Follow-up on 2026-09-28: the MCP project still has 19 project environment variables, no accepted explicit Google credential variable, and no linked shared variables. Its current deployment is still `dpl_AaMZhJAx1z5cod7EiaeVmFWxhf1U`. Using Firebase SDK's public `GET /v1/projects` configuration endpoint with the existing browser API key returned 200 and confirmed that `getugcpilot.com` and `www.getugcpilot.com` are authorized, while `mcp.getugcpilot.com` is absent. The API key was not printed. Add the MCP domain through the correct Firebase account, then verify the Google OAuth redirect URI and live popup/redirect sign-in; no authentication setting has been modified.

- Credential setup follow-up on 2026-09-28: the user saved `GOOGLE_CLOUD_CREDENTIALS_JSON` as a Production Secret in `ugc-mcp`, bringing the project to 20 environment variables. Their redeployment `dpl_6veBScfZddoPEPbE1conVqH5ck5T` is Ready in Production and serves `mcp.getugcpilot.com`. The live public verification helper passed database health, both OAuth discovery documents, the unauthenticated challenge, and website-route isolation after the build completed. Secret contents are not readable, so the JSON identity, key validity, storage signing, and queue permissions have not yet been verified. A fresh public Firebase project-config request returned 200 and still showed the MCP domain absent from authorized domains. No authenticated tool or paid image job was run.

## Safety findings

- The earlier same-project `--prod --skip-domain` plan protects the website during that one deployment, but adding `mcp.getugcpilot.com` as a normal production domain on the website project creates a future release risk: Vercel automatically assigns project production domains to later production deployments. Do not use `vercel promote` on the website project for MCP because it promotes the deployment to the project's production domains.
- A separate Vercel project under the same team, built from the same UGC Pilot codebase and using the existing Supabase, storage, billing, and worker services, isolates the MCP domain and its environment variables from website deployments. This is hosting isolation, not a second business backend. It must follow an MCP release branch (or manual MCP deployments), not the website's `main` branch, or a later website push could replace the MCP code. The release candidate now gates unrelated routes when `MCP_ONLY_DEPLOYMENT=true` or the host is `mcp.getugcpilot.com`; verify that gate on the deployed host.
- The current Firebase client config uses `getugcpilot.com` as `authDomain`. Reliable redirect fallback on `mcp.getugcpilot.com` needs a project-specific `authDomain` for that host, the existing Firebase helper rewrite, and the corresponding Firebase authorized domain and Google OAuth redirect URI. These changes are additive; verify the existing website sign-in afterward.
- The earlier Phase 5 candidate could report video as available before `generate_video` existed. The release candidate now reports video unavailable in both `get_entitlements` and `get_capabilities` until Phase 6 is implemented.
- The two MCP migrations created new tables/functions and grants without replacing website billing or job functions. Their service-role grant and exclusion of anon/authenticated were verified after applying them. After migration, the live homepage and sign-in page loaded and the website deployment ID was unchanged. An authenticated website flow still needs a test account.

## Approved isolation and rollout progress

1. Complete: applied the two additive migrations (`20260927202555_mcp_oauth.sql` and `20260927202613_mcp_atomic_generation_job.sql`) to the existing Supabase project. Their new MCP tables/functions are service-role-only; the existing website billing and job functions are reused.
2. Complete: created and deployed a separate `ugc-mcp` Vercel project from the committed MCP release candidate. Pin its release source to a dedicated MCP branch or manual deployment flow, use project-specific environment variables, and set `MCP_ONLY_DEPLOYMENT=true`. Verify the route guard blocks website/API routes while preserving MCP/OAuth and static assets. Keep the current `ugc` project, its production branch, and its apex/`www` aliases untouched.
3. MCP environment values are configured: `MCP_OAUTH_ISSUER=https://mcp.getugcpilot.com`, `MCP_PUBLIC_URL=https://mcp.getugcpilot.com/mcp`, and `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=mcp.getugcpilot.com` only for the MCP project. Verify the Firebase helper rewrite, authorized domain, and Google OAuth redirect URI. Confirm the existing website still signs in.
4. Public hosting checks complete: the release built, generated-host checks passed, only `mcp.getugcpilot.com` was attached, and health/metadata pass on that domain while the website retains its deployment and aliases. On the MCP domain, verify registration, Firebase popup and redirect sign-in, consent, PKCE token exchange, scopes, refresh, and revocation with a test account.
5. Confirm the MCP project's Cloud Tasks configuration and the existing image worker before queueing a paid job. With the test account, queue one image using a known prompt and a unique request ID. Poll `get_job`, confirm the completed owned asset via `get_asset`, repeat the same request ID to prove no second credit reservation or provider job, and inspect credit settlement. Check queue recovery configuration and test an error path without generating another paid output.

## Prepared live verification helper

`scripts/verify-mcp-live-image.mjs` uses the real production MCP domain and Node's built-in HTTP client. On 2026-09-28 its public mode passed health, both discovery documents, unauthenticated challenge, and website-route isolation. Its syntax check passed, and a missing-token guard check confirmed that paid mode stops before any network request or job submission. Authenticated and paid modes have not run.

- `node scripts/verify-mcp-live-image.mjs --public` performs only public checks and explicitly reports that authenticated/image validation did not run.
- With a real OAuth access token in `MCP_ACCESS_TOKEN`, `node scripts/verify-mcp-live-image.mjs` initializes MCP and checks discovery, profile, entitlements, brand, capabilities, and the asset library. It does not create an upload, delete an asset, or queue an image.
- `--generate` additionally requires `MCP_IMAGE_PROMPT` and a stable `MCP_IMAGE_CLIENT_REQUEST_ID`. Use one approved prompt and one request ID for this acceptance test. It submits one image, repeats the identical request, requires the same job ID, polls for up to 10 minutes, retrieves the owned generated asset, and checks the nonempty image object with HEAD. It reports credit balances before/after, but those aggregate balances alone do not prove a single reservation if the account has other activity.
- If a request or polling times out, keep the same prompt and request ID. A job may already exist. The helper never chooses a replacement request ID and never prints a token, prompt, or raw server error.
- This is a production transport/adapter test helper. It does not satisfy Phase 9's actual local-client, ChatGPT, or Claude interoperability checks, nor the full OAuth/media/security acceptance checklist.

After a completed run, inspect that real job with this read-only query, replacing `PASTE_JOB_ID` with the reported UUID. Require exactly one job and reservation for its owner/key, reservation amount equal to the advertised image cost, `committed` status, matching reservation background job ID, a settlement timestamp, queue delivery ID, and an owned ready output asset. Inspect worker logs for attempts/provider completion and verify the existing recovery scheduler separately.

```sql
with test_job as (
  select id, user_id, job_type, idempotency_key, status,
         queue_message_id, output_json
  from public.background_jobs
  where id = 'PASTE_JOB_ID'::uuid
    and job_type = 'generate_image'
    and input_json->>'mcpSource' = 'ugc-pilot-cloud-mcp'
)
select job.id as job_id, job.status as job_status, job.queue_message_id,
       (select count(*) from public.background_jobs as other
        where other.user_id = job.user_id
          and other.job_type = job.job_type
          and other.idempotency_key = job.idempotency_key) as job_count,
       (select count(*) from public.billing_credit_reservations as other
        where other.user_id = job.user_id
          and other.idempotency_key = job.idempotency_key) as reservation_count,
       reservation.amount, reservation.status as reservation_status,
       reservation.background_job_id, reservation.settled_at,
       job.output_json->>'mediaAssetId' as output_asset_id,
       exists (
         select 1 from public.media_assets as asset
         where asset.id::text = job.output_json->>'mediaAssetId'
           and asset.user_id = job.user_id
           and asset.collection = 'image'
           and asset.status = 'ready' and asset.deleted_at is null
       ) as owned_ready_output
from test_job as job
left join public.billing_credit_reservations as reservation
  on reservation.user_id = job.user_id
 and reservation.idempotency_key = job.idempotency_key;
```

On 2026-09-28 the existing website project was also rechecked: `GOOGLE_CLOUD_CREDENTIALS_JSON` is a project Secret for Production/Preview, its Copy to Clipboard action is disabled, and the team Shared tab says "No shared variables." It cannot currently be linked as a team variable. [Vercel documents](https://vercel.com/docs/environment-variables/sensitive-environment-variables) sensitive values as non-readable after creation; the original JSON is needed to add the existing credential to the new project. No credential was replaced, rotated, or removed.

## Stop conditions and rollback

Stop if the apex deployment ID or alias changes, health is not ready, OAuth cannot complete, the queue is not configured, or a credit reservation cannot settle. Remove the MCP domain from the separate project to stop new MCP requests; the website project remains untouched. The additive database migration is retained for inspection because dropping auth/token tables could destroy test records; any cleanup would be a separately reviewed action.

The database schema, separate Vercel deployment, MCP-only route guard, and subdomain steps are complete. The Google Cloud credential is now saved in the redeployed MCP project; its runtime identity and permissions still need verification. Firebase/Google OAuth allowlists, the authenticated account flow, and live image/credit validation remain pending. Phase 6 remains deferred until live image validation passes. The candidate has not been deployed to the apex website.
