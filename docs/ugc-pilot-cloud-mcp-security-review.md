# UGC Pilot Cloud MCP security review

The 2026-09-28 Codex Security scan reviewed the deployed Phase 2–5 MCP,
OAuth, signed upload, billing, and image-worker paths at commit `9542838`.
It found four source-backed issues: one high and three medium. This was a
focused static review; the rest of the 1,948-file repository and future video
path were deferred. The findings were not reproduced as live attacks.

| Issue | Live state at scan | Local candidate fix |
| --- | --- | --- |
| Signed PUT accepted more bytes than the client's declared upload size | Application checked the size only during optional confirmation. | MCP-only `x-goog-content-length-range` signed header limits each PUT at GCS. |
| Signed PUT could overwrite an asset after it was confirmed ready | Link remained writable until expiry. | MCP-only `x-goog-if-generation-match: 0` signed header permits only the first write. |
| Refresh could race with family revocation | Separate database requests could miss newly rotated rows. | Both database functions take the same family advisory lock; the route revokes through one atomic RPC. |
| Image reference downloader buffered before size check | A large reference could consume worker memory first. | Shared OpenAI/Gemini downloader counts stream bytes and stops at 25 MiB. |

The upload headers are part of the `create_upload.required_headers` contract.
Clients must send every returned header with their PUT. Existing website upload
callers do not request these MCP-specific signing options. Browser upload clients
also need the two added headers in the bucket's CORS configuration.
The database migration
`20260928111109_mcp_oauth_atomic_family_revocation.sql` was applied to
production and its service-role grants and family lock were checked. The new
MCP route is built at deployment `dpl_DBAu6tr6Cba32QRZHnrksi4HdsRe`; its
health and OAuth metadata passed on the isolated Vercel URL. At the time of
the scan, the custom `mcp.getugcpilot.com` alias still pointed to the previous
deployment and the bucket lacked the two request headers in browser CORS.
The worker fix changes the shared image worker; it needs a
coordinated worker release and production monitoring under the source-parity
policy in `infra/gcp/README.md`.

Google Cloud documents the
[`x-goog-content-length-range` PUT guard](https://docs.cloud.google.com/storage/docs/xml-api/reference-headers),
[`x-goog-if-generation-match: 0` create-only guard](https://docs.cloud.google.com/storage/docs/request-preconditions),
and [CORS header allowlist](https://docs.cloud.google.com/storage/docs/cross-origin).

Local checks passed: MCP tool fixtures, signed-URL header generation with a
local test key, OAuth migration and role-isolation checks in PGlite, worker
TypeScript type-check, and bounded-download tests. The full app TypeScript
check still reports unrelated existing fixture errors in onboarding and
reaction-generation tests. A worker output build in the managed worktree was
blocked by local filesystem permissions; the worker compiled into a temporary
directory for its focused tests.

Before declaring all fixes live, coordinate the shared worker release, then run
the updated tiny upload verifier through the real MCP domain. It checks that an
oversized PUT and a second PUT fail, then soft-deletes its test asset. A
repeated live image run also needs a paid account
with available credits; the connected test account is Free with zero credits.
The high finding's repeated bounded abandoned uploads still call for a
per-account quota and cleanup policy before wider public rollout.

Scan ID: `088cca54-2a76-4ff3-af31-52b98636eaf4`.

## Rollout update: 2026-09-28

The bucket CORS preflight now permits both MCP upload request headers from
`https://www.getugcpilot.com`. The hardened MCP deployment
`dpl_DBAu6tr6Cba32QRZHnrksi4HdsRe` was promoted to
`mcp.getugcpilot.com`; a fresh public health, discovery, authentication
challenge, and route-isolation check passed. The website domain still serves
its separate deployment `dpl_AzNbSeuQLPhyJYLL13x9RmPjwr1t`. The production
upload byte-range and create-only behavior still needs a real signed PUT test.
The four-file worker source change was released at commit `e2ddd46` and
passed the bounded-download tests. Cloud Build `45ebf71f-54cf-4a35-9e28-1431e4914eea`
produced image digest `sha256:bdaeeefbdb90ea2c0d5d33fca5964223dc9443d4151ddce6f899f6ec41600117`.
The production website deployment `dpl_4YiBjzNmq9rd8LKWXiXs3arWGzv2` and
AI worker revision `ugc-ai-generation-worker-00109-raf` now report the same
source SHA. A no-spend production cutover canary passed app dispatch, Cloud
Tasks delivery, worker consumption, and source identity; it failed on its
deliberately missing prompt before any paid provider call. Other worker
services stayed on their prior images. The separate MCP quota migration was
applied in Supabase as version `20260928151747`, and production MCP deployment
`dpl_6qVCFsTLKxv4DQH3s3gQ3rtCs6Tk` was promoted to `mcp.getugcpilot.com`.
The staged deployment returned database health `ready` before promotion; the
public health, OAuth discovery/challenge, and route-isolation checks passed
afterward. The three quota functions are executable by `service_role` only,
and there were zero active or deleted-pending MCP upload reservations at
promotion. The updated live oversized/overwrite PUT test and a credit-spending
image completion test remain outstanding.

The MCP source branch was subsequently pushed to the existing GitHub project
at `7c34f90`, after explicit user authorization. A new production-target
deployment `dpl_9eXnyucrrxe586Gp2FQqqASPaYA4` was staged, returned health
`ready`, and was promoted to `mcp.getugcpilot.com`. The public production
preflight passed after promotion. This direct Vercel release does not yet set
up automatic deploys from GitHub; the website `main` branch was unchanged.
