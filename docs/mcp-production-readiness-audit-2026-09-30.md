# UGC Pilot MCP and production readiness audit

Audit date: 30 September 2026, Asia/Calcutta. **Verdict: the corrected public MCP passes production image/video acceptance; full production sign-off remains incomplete.** Vercel access was restored, the MCP fixes and video adapter were deployed, and fresh image/video jobs completed through the public endpoint and settled once each. The connected UGC Pilot client still needs renewed OAuth permissions and tool discovery. Website/worker release parity, browser consent and the other gates below remain outstanding.

## Deployed MCP acceptance update

- Current production deployment: [`dpl_6UAon2P2TJG1gV4Y1JBFk9w48HLx`](https://vercel.com/ugcpilot/ugc-mcp/6UAon2P2TJG1gV4Y1JBFk9w48HLx), `ugc-j7wg25hhb-ugcpilot.vercel.app`. Both the Vercel dashboard and public tests confirm the production domain uses this release.
- The initial release exposed a framework/native `Request` constructor incompatibility: authenticated `tools/list` returned 503 with a `TypeError`. It was immediately rolled back before generation was charged. Constructing the buffered request from its URL, method, headers and abort signal fixes the problem. A regression uses Next.js's actual separate fetch implementation and reproduces the old exception. Both MCP suites and the corrected Vercel build pass.
- The final upload manifest includes all **28 intentional changed/new files** in the isolated MCP checkout. Vercel metadata records source digest `a627670f1795646627adbc51694d3edfd315a9db0be48c88b2e05c82512106dc`, base `af159b8960a38bea36b3d029ade8fd4be3fffe0c`, and an uncommitted source snapshot. No Git push occurred. Secret/local environment files, credentials, `.vercel`, dependency/build caches and temporary evidence were excluded. The website checkout and deployed worker images were not released by this MCP deployment. This report's final acceptance update was written after the source snapshot was deployed.
- Public health, isolated hosting, OAuth discovery, PKCE exchange, authorization-code replay rejection, refresh rotation, twelve-tool discovery, default asset listing, old image/video polling, video capabilities and the 64 KiB request limit all pass.
- Public signed upload acceptance passes with the upgraded Storage SDK: oversized PUT rejected with 400, normal PNG uploaded, overwrite rejected with 412, confirmation retry idempotent, owned asset readback and object HEAD successful. Both tiny acceptance assets were soft-deleted; physical GCS objects remain under the existing product deletion policy.
- Fresh public image request `mcp-deployed-image-audit-20260930`: job `28406edb-7071-4778-a366-0bcc0bc64787`, asset `28626c90-4991-448f-aa7c-9e776ba027cc`; completed, PNG **720 × 1280**, **1,349,320 bytes**, exactly one committed **1-credit** reservation. A transient test-runner network failure after submission was resumed with the same request ID and returned the same job.
- Fresh public video request `mcp-deployed-video-audit-20260930`: job `8ee451f2-338c-4584-ab5e-261f0d14c7ae`, asset `14df82b2-1584-4c02-a062-8f95e8fa5fd6`; completed in approximately **36.5 seconds**, exactly one committed **12-credit** reservation. Remote FFprobe confirms H.264 **720 × 1280**, **3.000-second** video, AAC audio, **3.008-second** container and **1,169,795 bytes**.
- The same funded Growth account used **13 additional credits**, moving from **567 to 554**, with **0 reserved**. Including the earlier backend canaries, this audit used **26 credits total**. Temporary acceptance token families were revoked and return 401.
- The existing UGC Pilot connection in this chat identifies a different active Starter account. Profile, entitlements, capabilities and default asset listing work; a cross-account asset lookup correctly returns `NOT_FOUND`. Its job call returns **Insufficient scope**, and its cached tool inventory still has eleven tools without `generate_video`. Reconnect **UGC Pilot MCP** to renew `jobs:read`/`generation:write` and refresh discovery; Vercel authorization is already resolved. The local Codex CLI has no configured MCP servers, so its login command cannot renew this connection.

Public outputs: [generated image](https://storage.googleapis.com/ugcsaas-media/images/generated/oPQhLloYHKQFCysJ4cznV2dv8v02/ai-studio/7300d375-e3f5-42a1-a373-1f7a4b82eb2d.png), [generated video](https://storage.googleapis.com/ugcsaas-media/videos/hooks/oPQhLloYHKQFCysJ4cznV2dv8v02/ai-studio/1a39e0e8-0296-4d16-a975-e68b232108de.mp4).

Latest evidence: `.tmp/deployed-mcp-production-acceptance.log`, `.tmp/deployed-mcp-production-result.json`, `.tmp/deployed-mcp-video-ffprobe.json`, `.tmp/mcp-deployed-vercel.jpg`, and the isolated checkout's `.tmp/vercel-fixed-deploy.log`, `.tmp/vercel-fixed-deployment-proof.json`, `.tmp/deployment-source-proof-fixed.json` and `.tmp/mcp-redeployment-tests.log`.

## Scope and release identity

- Production MCP: `https://mcp.getugcpilot.com/mcp`, separate Vercel project `ugc-mcp`.
- Production website: `https://getugcpilot.com`; `www` redirects to the apex. The deployment inspected was `dpl_HkTvAin3Ufbqy8f2HRtL4SdNf8C8`, source `7cd0a46a50765d3b99d9705969ce20f0fb2a12e9`.
- Supabase production project: `kltxwijhluawgveykfbt`; GCP project: `ugcsaas`, region `us-central1`.
- Authoritative MCP source was the clean `codex/mcp-schema-clarity` checkout at `af159b8960a38bea36b3d029ade8fd4be3fffe0c`. The audited release candidate is branch `codex/mcp-production-audit`, at `C:/Users/chund/OneDrive/Desktop/UGC/.tmp/mcp-production-audit`.
- The main workspace contains substantial pre-existing, intentional work and older MCP source. Applicable fixes were also applied there, without replacing its other changes. Use the isolated candidate for the MCP release; the main workspace is not an interchangeable MCP release source.
- This audit covers live MCP requests, database permissions/migrations/billing, hosting isolation, GCP queues/services, runtime error samples, dependencies, application checks and worker checks. It does not certify every website flow, provider, or load scenario.

## Findings and corrections

| Priority | Finding and evidence | Correction | Production status |
|---|---|---|---|
| P1 | `get_job` returned an SDK output-validation error for actual PostgREST timestamps such as `2026-09-30T13:10:03.612151+00:00`. | Normalize timestamps to UTC ISO strings at the MCP response boundary. Regression covers microseconds and a non-UTC offset. | Deployed; old and fresh image/video polling pass on the public endpoint. |
| P1 | `list_assets` failed the entire page when an owned `audio` upload appeared outside the MCP enum. | Filter to supported collections in the database before pagination; return `NOT_FOUND` for an unsupported single-asset lookup. Audio rows are preserved. | Deployed; default listing passes for the audit account and the connected client. |
| P1 | Website/MCP source uses Next.js `16.2.11` and Sharp `0.34.5`. The original application runtime audit reported 55 affected packages: 2 critical, 32 high, 21 moderate. Counts include inherited findings, not 55 distinct vulnerabilities. The separate worker lockfile also contained critical/high findings. | Upgrade Next.js and its ESLint config to `16.3.7`, Sharp to `0.35.5`, Storage to `8.2.0`; update safe transitive resolutions. Scope a UUID `11.1.1` override to Gaxios, whose installed consumer uses the compatible `v4()` API. Move Shadcn to build/dev dependencies; its CSS import remains available during builds. | All four local runtime audits report zero known vulnerabilities. MCP updates are deployed; the website and worker release/parity checks remain pending. |
| P1 | Vercel runtime logs show scheduling cancellation failing with `cloudtasks.tasks.delete` denied. The app had only `roles/cloudtasks.enqueuer`; the timer queue had no additional binding. | Applied `roles/cloudtasks.taskDeleter` to `ugc-app-sa` on `ugc-social-publish-scheduler` only. Added the matching Terraform resource and documentation. | Live binding applied and read back. App-identity cancellation acceptance remains unverified: operator impersonation lacks `iam.serviceAccounts.getAccessToken`. No real scheduled task was deleted in the test. |
| P2 | OAuth token handlers returned asynchronous operations without awaiting them inside their `try` block. Database rejection could escape the safe error response. | Await code exchange and refresh rotation. Both database failure paths now return uncached OAuth `server_error` responses with HTTP 503. | Deployed; local failure-path tests and public PKCE/refresh/revocation acceptance pass. |
| P2 | MCP POST bodies were buffered without an application byte limit; descriptor mirroring also parsed a cloned body. | Enforce 64 KiB on the actual body stream, then reuse it for transport. Tests cover omitted/false Content-Length, streamed oversize input, normal discovery and malformed JSON. | Deployed; oversized public request returns 413. |
| P1 | First deployment's request reconstruction assumed the Next.js incoming request shared Node's native `Request` constructor brand. Authenticated POST returned 503. | Rebuild from URL and explicit request properties. Regression reproduces the exception with Next.js's distinct fetch implementation. | Rolled back the first release; corrected deployment passes public discovery, uploads and generation. |
| P2 | The audited candidate's production build failed on incomplete onboarding/reaction fixtures and tool descriptor mutation typings. | Repair the fixture types; keep Next.js TypeScript validation enabled. | Candidate build passes. |
| P2 | Main-workspace checks failed on a synchronous state update in a Reaction effect, generated scripts under `output/`, and outdated navigation/theme/Carousel source assertions. | Reset sound state when its preview/activity context changes; ignore the already-generated output directory; update stale assertions to the current intended UI. Move the deprecated Open Graph Edge route to Node.js. | Main-workspace build and checks pass at the final audit snapshot. Existing unrelated edits continued during the audit. |
| P2 | MCP checks lacked a single reproducible test command and focused CI gate. Worker Docker builds used `npm install` despite a committed lockfile. | Add `npm run test:mcp`, focused CI, and offline real-SDK signing verification. Worker Docker now uses `npm ci --legacy-peer-deps`. | Local checks/lockfile install pass. CI has not run remotely. A Docker image was not built or deployed. |
| P2 | Active workers have several different image digests/tags, rather than one demonstrably shared release. | Record the evidence and retain the documented coordinated release requirement. | Unresolved release verification; no worker was redeployed. Tags suggest different builds but do not alone prove source provenance. |
| P1 | Original public MCP had eleven tools, excluded video jobs from `get_job`, and did not expose `generate_video`. | Implement the V1 video adapter, duration pricing, owned image references, atomic reservation, operation-scoped retry keys, completed video lookup and matching capabilities. | Migration applied and adapter deployed. Twelve public tools and real public video generation/polling/output/billing pass. Existing clients must refresh scopes and tool inventory. |

The security update follows the [Next.js upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-16), the [Next.js Windows RCE advisory](https://github.com/vercel/next.js/security/advisories/GHSA-p293-qw3h-jr36), the [AVIF image optimization advisory](https://github.com/vercel/next.js/security/advisories/GHSA-2xp9-vwfh-vxw4), and [Sharp 0.35.5 release](https://github.com/lovell/sharp/releases/tag/v0.35.5). The Windows-only advisory's hosting condition should not be conflated with the AVIF advisory. [Storage 8 release notes](https://raw.githubusercontent.com/googleapis/google-cloud-node/main/handwritten/storage/CHANGELOG.md) require Node 22 or newer; the worker uses Node 22 and the MCP project configuration uses Node 24. The task-deletion role can be [scoped to one queue](https://docs.cloud.google.com/tasks/docs/access-control).

## Real production image acceptance

The user authorized using a funded Pro-tier account. The selected account had an active complimentary Growth grant, with 580 credits available before the test. No account email, password or bearer token is included in this report.

- Stable request ID: `mcp-production-audit-20260930`.
- Job: `c4512614-97c7-48fe-93b9-0fea5924a307`; completed in approximately 18.6 seconds.
- Generated asset: `c330fbbe-d81b-4ea4-adee-6cb1092bc1a0`; ready, owned image, 720 × 1280.
- `get_asset` succeeded. The actual output returned HTTP 200, `image/png`, 1,274,182 bytes.
- Repeating the generation request returned the same job. Database checks found exactly one matching job and one reservation.
- Reservation amount: **1 credit**, status `committed`. Balance after the image: **579**, reserved balance **0**. The later video test reduced the balance to 567.
- `get_job` failed on its output timestamp schema. Therefore the complete MCP generation/polling flow **failed acceptance**, despite successful provider execution, persistence and billing settlement. No second paid generation was submitted.
- Temporary audit token families were revoked in `finally`; revoked access returned HTTP 401. The final database check found **zero active audit tokens**. Registered audit clients and consumed/revoked records remain as audit history.

OAuth testing used an operator-seeded, short-lived authorization code for the authorized account, then the real public PKCE exchange, refresh and revocation endpoints. This validates those server paths; it does **not** validate Firebase browser login or the consent screen.

## Real production video canary

The local, validated MCP adapter used the real production database, billing, Cloud Tasks and deployed AI worker. Its account context was an operator fixture; Cloud Tasks used the existing operator's credentials in memory. This is backend integration acceptance, not acceptance of the undeployed public `generate_video` endpoint.

- Stable request ID: `mcp-video-production-audit-20260930`.
- Requested: one three-second vertical video, using the freshly generated owned orange image as its reference.
- Job: `69e6e004-16b0-41ec-b536-29a34820eb1f`; completed in approximately **37.3 seconds**, with the existing Gemini provider.
- Generated asset: `11bc428e-644a-46dc-8215-de60326c33c2`; owned, ready `generated_video`.
- Actual MP4: HTTP 200, **890,536 bytes**, H.264 **720 × 1280**, three seconds of video; container duration **3.008 seconds**, including AAC audio. FFprobe validated the actual file rather than relying on database duration metadata.
- Retrying the identical request returned the same job. Exactly one **12-credit** reservation was committed. Final available balance: **567**; reserved balance: **0**.
- Before deployment, the public MCP retrieved this video through `get_asset`, but `get_job` returned `NOT_FOUND` and discovery exposed eleven tools. After the corrected release, both this job and the fresh public video job poll successfully, with twelve tools in discovery.
- The V1 adapter uses `google_omni` for the approved 3–10 second range. The website's current Seedance default starts at four seconds; the adapter does not expose provider/model selection or accept external reference URLs or video references.

Outputs: [test image](https://storage.googleapis.com/ugcsaas-media/images/generated/oPQhLloYHKQFCysJ4cznV2dv8v02/ai-studio/b0e8363d-1205-478b-b131-1b46294ef991.png), [test video](https://storage.googleapis.com/ugcsaas-media/videos/hooks/oPQhLloYHKQFCysJ4cznV2dv8v02/ai-studio/c952ba3e-a3e7-4a6d-934f-0acb1d780edc.mp4).

## Live coverage

| Area | Result |
|---|---|
| Health and discovery | Health 200; protected-resource and OAuth metadata correct; S256/code/refresh discovery present. Health establishes storage readiness, not complete provider readiness. |
| Authentication | Missing/revoked token 401 with resource challenge; live registration, PKCE exchange, code replay rejection, refresh rotation and revocation pass. |
| Hosting isolation | Website/API routes return 404 on the MCP host. MCP discovery is isolated from the website host. Website remains on its separate deployment. |
| Read tools | Profile, entitlements, capabilities, owned brand, generated assets and default asset listing succeed after deployment. |
| Upload lifecycle | Embedded 68-byte PNG uploaded. A 69-byte attempt was rejected and did not create the object; overwrite rejected with 412; confirmation retry returned the same asset. Own test asset soft deletion succeeded. |
| Billing/queue/worker/output | Earlier backend image/video canaries plus fresh public image/video jobs completed and settled once each; 26 credits total, no reserved credit remains. Public generation uses the deployment's app identity and production queue/worker. No provider failover was exercised. |
| Database security | Four OAuth tables have RLS and exclude anon/authenticated reads. Eight MCP security-definer functions use empty search paths and service-role-only execution. Five MCP migrations are applied, including the video extension. |
| Database advisors | 120 informational RLS-without-policy findings; consistent with service-only tables, not evidence to grant public access. Performance advisor: 96 missing FK-index findings and 55 unused-index findings; optimization work remains, with no indiscriminate index deletion. |
| GCP | Inspected services report Ready; queues report Running. Background-job recovery scheduler is enabled every five minutes. Carousel replenishment scheduler is paused; confirm intended policy before changing it. The sampled last-day Cloud Run ERROR query returned no entries; this is bounded evidence, not proof of no errors. |
| Website runtime samples | Scheduling IAM failure above plus URL.parse deprecation warnings were observed. Provider SDK warning cleanup should be monitored after release. |

Observed active worker tags: AI `audio-references-c067e39`; Carousel/Reaction `worker-gcp-571cc7e`; social publish `worker-gcp-2063f45`; compatibility video worker `worker-gcp-20260924193045`. Verify immutable image revision labels and the authoritative video-render Job against the intended release before declaring source parity.

## Local validation and evidence

- Main-workspace `npm test`: **1,078 passing checks** across pretest/main batches at final acceptance.
- `npm run worker:test`: **291 passing checks** (276 main + 15 posttest).
- Authoritative `npm run test:mcp`: **24 unit checks** after the request compatibility fix, read/upload/auth contracts, image/video generation and duration pricing, strict video inputs, retry/conflict, partial batch and queue recovery, owned outputs, asynchronous OAuth failures, four PGlite suites covering five migrations, and offline real-SDK signing all pass. The main-workspace MCP suite was also rerun successfully after porting the fix.
- Main-workspace MCP suite also passes against its older source (9 unit checks, available migration suites and behavior checks). It is not a substitute for the authoritative suite.
- Both Next.js release builds pass with TypeScript checks enabled. The isolated MCP build received the existing local environment in process memory; no secret environment file was copied into its checkout.
- Lint passes with zero errors: 39 warnings in the combined workspace and 20 in the isolated candidate at the final snapshot. Remaining warnings were not globally disabled.
- Runtime dependency audits for main app, its worker, isolated MCP app and isolated worker: **0 known vulnerabilities**. This is an advisory-database snapshot, not a security guarantee.
- Full dependency audits including development dependencies also report **0 known vulnerabilities** for both application checkouts.
- Terraform configuration validation and format check pass. The live scheduling binding was applied narrowly, without applying unrelated Terraform changes.
- Worker lockfile installation with `npm ci --legacy-peer-deps --ignore-scripts` succeeds. Native Docker/FFmpeg container acceptance remains outstanding.

Evidence resides under the ignored `.tmp` directory:

- [Live paid acceptance log](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/mcp-audit-live.log)
- [Live reads and generated-output verification](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/mcp-audit-output-verification.log)
- [Actual get_job error](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/mcp-audit-job-diagnostic.json)
- [Final application tests](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/mcp-video-root-app-tests.log)
- [Final worker tests](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/mcp-audit-worker-tests-acceptance.log)
- [Authoritative MCP acceptance suite](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/mcp-production-audit/.tmp/mcp-video-tests.log)
- [MCP production build](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/mcp-production-audit/.tmp/mcp-video-build.log)
- [Website production build](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/mcp-video-root-build.log)
- [Production video canary log](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/mcp-production-audit/.tmp/video-production-canary.log)
- [Production video billing and FFprobe evidence](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/mcp-production-audit/.tmp/video-production-canary-result.json)
- [Final public MCP verification](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/mcp-audit-final-public-diagnostic.log)
- [Final dependency audit](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/mcp-audit-root-dependencies-final.json)
- [Verified live queue IAM](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/mcp-audit-gcp-queue-iam-after.json)

## Remaining acceptance gates

1. **Completed:** Vercel project access restored, CLI login completed, corrected MCP deployed and production aliases verified.
2. **Completed:** old and fresh image/video polling, asset listing, twelve-tool discovery/capabilities, real public generation, signed uploads, idempotency and billing settlement pass.
3. Reconnect the existing UGC Pilot MCP client to renew job/generation permissions and refresh tools. Then verify `get_job` and `generate_video` through that client. Separately exercise Firebase browser popup/redirect login and consent approval/denial on the real domain; the acceptance code fixture does not establish these flows.
4. Release the website and worker dependency updates through the complete intended release scope, preserving the other intentional changes. Build a worker image, verify its source revision, and verify each relevant deployment target. No Git push, website deployment or worker deployment occurred during this audit.
5. Verify cancellation/rescheduling through the deployed app identity now that the narrow queue role is present. Operator impersonation was denied; no broader impersonation grant was added.
6. Public MCP video acceptance is complete. Authenticated website flows required for launch remain unverified; successful MCP generation does not establish browser consent, every provider or every website flow.
7. Establish the desired workload, then exercise concurrent generation/upload, queue recovery, provider timeout/failure, and monitoring/alerts under that workload. No production load test, social publication, checkout purchase, backup restore or disaster-recovery exercise was performed.

The corrected MCP is live and its endpoint acceptance passes. The existing client permission/tool-cache issue and the broader unverified gates prevent a complete production-ready sign-off today.
