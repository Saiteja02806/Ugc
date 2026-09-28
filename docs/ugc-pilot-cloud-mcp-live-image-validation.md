# MCP live image validation plan

Status: MCP is deployed at `mcp.getugcpilot.com`, backed by Supabase quota migration version `20260928151747`. Public health, OAuth metadata/challenge, route isolation, authenticated reads, and the adversarial signed-PUT checks pass. The shared AI worker fix is live at source SHA `e2ddd46`. The MCP source is in the GitHub `codex/ugc-mcp` branch. A real paid image completion remains outstanding because the connected account has zero credits.

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

- Authentication allowlist follow-up on 2026-09-28: after the user reported adding both settings manually, the public Firebase project-config endpoint returned 200 and confirmed that `mcp.getugcpilot.com`, `getugcpilot.com`, and `www.getugcpilot.com` are all authorized. The MCP auth iframe/handler and their JavaScript files return 200 through the configured proxy. Live Dynamic Client Registration returned 201 for a temporary PKCE verification client, and its real production consent page loads with the requested scopes. A loopback receiver on the user computer retains the verifier and any subsequently issued tokens only in process memory. It waits for the user to sign in with an existing UGC Pilot account and approve the test connection; image generation is not automatic. The in-app attempt remained waiting without a visible Google popup or console error, so normal-browser completion is still required before the provider callback, token exchange, authenticated tools, and Google Cloud permissions can be accepted. No OAuth token or paid image job has been obtained in this run.

- Real-account acceptance follow-up on 2026-09-28: the user completed the live Google sign-in and consent flow. Production PKCE token exchange, authenticated MCP initialization/tool discovery, identity, entitlements, ready brand context, capabilities, and asset-library smoke checks passed. The local receiver was restarted with interactive input using the same registered client and redirect URI; its original two temporary tokens were revoked before restart. The renewed connection passed refresh-token rotation and repeated authenticated reads. Revoking the renewed family through `/oauth/revoke` returned successfully and its bearer was rejected with HTTP 401; the database confirms 6 token rows across the two temporary families and 0 unrevoked tokens. No token, verifier, or Google key was printed or saved. The account reports `plan=free`, `active=false`, `credits_remaining=0`, `credits_reserved=0`, `image_credit_cost=1`, and image availability false. No image was requested or credits spent. Read-only live database checks after revocation confirmed 0 unrevoked tokens for the temporary client, 0 MCP image jobs today, and 0 corresponding credit reservations today. The user was asked whether another existing eligible account is available or this account should already have paid access.

- Read-only Google Cloud verification on 2026-09-28: `ugc-ai-generation` in `us-central1` is RUNNING with five attempts and up to one hour retry duration. The Cloud Run service `ugc-ai-generation-worker` reports Ready at the URL configured for the MCP queue. The `ugc-background-job-recovery` Cloud Scheduler job is ENABLED, runs every five minutes, and targets `https://getugcpilot.com/api/internal/jobs/recover`. The expected `ugc-app-sa@ugcsaas.iam.gserviceaccount.com` exists and has `roles/cloudtasks.enqueuer` on the project, `roles/storage.objectAdmin` on `ugcsaas-media`, `roles/iam.serviceAccountTokenCreator` on itself, and `roles/iam.serviceAccountUser` on `ugc-scheduler-sa`. This verifies infrastructure configuration, not the unreadable JSON value saved in Vercel or actual dispatch/signing behavior. No queue task or image job was created by these checks.

- Live Phase 4 upload acceptance on 2026-09-28: after the user approved temporary `assets:write` access, a new OAuth session passed the production PKCE exchange and read smoke checks. `scripts/verify-mcp-live-upload.mjs --upload` reserved asset `0e45cfb3-8131-4884-9450-531258847bc6`, PUT a generated 68-byte 1×1 PNG to the signed `ugcsaas-media` GCS URL, confirmed it twice, read it back through `get_asset`, and verified the exact object size/MIME with HEAD. `delete_asset` soft-deleted the row and a subsequent `get_asset` returned `NOT_FOUND`. The live database confirms `collection=image`, `source_type=upload`, `metadata.mcpUpload=true`, 68 bytes, 1×1 dimensions, and non-null `deleted_at`. The GCS object remains because soft-delete does not remove stored bytes. The temporary OAuth family was revoked, its bearer returned 401, and the database reports eight token rows across three test families with zero unrevoked rows. This verifies the deployed credential can sign and access storage for MCP uploads; its Cloud Tasks dispatch permission remains untested. No image job or credit spend occurred. A transient Firebase `auth/network-request-failed` on the first consent click cleared on retry; the second click completed the same approved scope. Cross-account owner isolation and third-party client upload UX remain for Phase 9.

## Safety findings

- The earlier same-project `--prod --skip-domain` plan protects the website during that one deployment, but adding `mcp.getugcpilot.com` as a normal production domain on the website project creates a future release risk: Vercel automatically assigns project production domains to later production deployments. Do not use `vercel promote` on the website project for MCP because it promotes the deployment to the project's production domains.
- A separate Vercel project under the same team, built from the same UGC Pilot codebase and using the existing Supabase, storage, billing, and worker services, isolates the MCP domain and its environment variables from website deployments. This is hosting isolation, not a second business backend. The MCP source can live in the canonical `main` branch because the website deployment now blocks MCP/OAuth routes and the MCP deployment blocks website routes. The `ugc-mcp` Vercel project remains an explicit release target with `MCP_ONLY_DEPLOYMENT=true`, so a website deployment cannot take over the MCP domain.
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

`scripts/verify-mcp-live-image.mjs` uses the real production MCP domain and Node's built-in HTTP client. On 2026-09-28 its public mode passed health, both discovery documents, unauthenticated challenge, and website-route isolation. Its syntax check passed, and a missing-token guard check confirmed that paid mode stops before any network request or job submission. Authenticated production read mode has now passed; paid mode has not run. The helper reports plan, credit balance, image price, and availability before any generation attempt.

`scripts/verify-mcp-live-upload.mjs --upload` is a separate Phase 4 helper. It requires a real `MCP_ACCESS_TOKEN` with `assets:write` and a stable `MCP_UPLOAD_TEST_TAG`. It uploads only its embedded 68-byte PNG, checks the signed destination and stored object, retries confirmation to prove idempotence, then soft-deletes the test asset. Its earlier production run passed. The updated helper also attempts one 69-byte PUT and a second 68-byte PUT to verify the new size and create-only guards; this updated check has not yet been run in production. It does not request image generation or spend credits.

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

The database schema, separate Vercel deployment, MCP-only route guard, and subdomain steps are complete. The deployed Google Cloud credential has now passed real signed upload and object checks; queue dispatch and image-worker completion remain unverified. Firebase authorized domains and the real Google sign-in/consent/PKCE exchange, refresh, revocation, authenticated reads, and Phase 4 upload flow are verified. The connected account reports Free with 0 credits, so a generation-eligible account is needed before live image, credit, and queue acceptance. Phase 6 remains deferred until live image validation passes. The candidate has not been deployed to the apex website.

The focused [security review](ugc-pilot-cloud-mcp-security-review.md) identified four production hardening items after the first tiny upload passed. The MCP signed-PUT guard is now deployed at `mcp.getugcpilot.com`, and the bucket CORS preflight permits both required headers. The updated live PUT test for oversized bytes and a second write has not yet run. The shared image-worker size guard was released and passed a no-spend production queue canary. The original upload test established functionality, not the absence of adversarial storage cases.

## Quota rollout follow-up: 2026-09-28

Supabase recorded the additive quota migration as `20260928151747`; the local
filename was aligned to that version. MCP release `36e3793` built on Vercel
with TypeScript and was staged without the custom domain, then returned
`{ "status": "ready" }` against the migrated database. Promoting deployment
`dpl_6qVCFsTLKxv4DQH3s3gQ3rtCs6Tk` to `mcp.getugcpilot.com` succeeded.
The public production preflight passed afterward. The quota is five active
unconfirmed reservations and 500 MiB per account. Only owner-deleted,
unconfirmed MCP uploads are eligible for physical cleanup, after the signed
URL expires; confirmation itself has no deadline. Cleanup is retried on a
subsequent `create_upload`, so an idle deleted upload can retain its one-byte
seal until that account next uploads. The initial deletion replaces the
original object content with the seal when storage is available. Production
database checks found zero active and zero deleted-pending MCP reservations;
all three new functions are service-role-only. Supabase security advisors
reported only the preexisting informational RLS-without-policy category.
The updated live oversized/overwrite PUT test passed. An eligible-account image
job completion remains unverified.

## GitHub and release follow-up: 2026-09-28

After the user explicitly authorized publishing the MCP work to the existing
GitHub project, `codex/ugc-mcp` was pushed to
`github.com/Saiteja02806/Ugc`. The website `main` branch remains
at `e2ddd46`. A separate MCP production-target Vercel deployment
built with TypeScript, returned database health `ready` while staged, then was
promoted to `mcp.getugcpilot.com`.
Production public preflight passed after promotion; the website homepage also
returned 200. Vercel's MCP project is still deployed by explicit CLI release,
not configured to redeploy automatically when this GitHub branch changes.
Authenticated reads and the signed-PUT rejection checks then passed through a
fresh real-account OAuth connection. The oversized 69-byte PUT was rejected
with HTTP 400, the valid 68-byte PNG uploaded and confirmed, and a second PUT
through the same signed URL was rejected with HTTP 412. The test asset was
soft-deleted. The temporary OAuth token family was revoked and has zero valid
tokens. The account reported Free, inactive, and zero credits, so no image job
was submitted and no credits were spent.

## Main-branch integration guard: 2026-09-28

Before merging the MCP source into `main`, the deployment boundary was made
bidirectional. Production website hosts now return 404 for `/mcp`, `/oauth`,
and the two MCP OAuth discovery routes, while the separate MCP project still
returns 404 for website pages and APIs. Static Next.js and Firebase auth helper
paths remain available on the MCP deployment. The default issuer was also
aligned with `https://mcp.getugcpilot.com`, preventing an unconfigured website
build from advertising a second OAuth issuer. Focused routing tests cover the
MCP custom domain, the MCP project's generated Vercel hostname, the website
domain, unrelated `/.well-known` documents, and localhost development.
