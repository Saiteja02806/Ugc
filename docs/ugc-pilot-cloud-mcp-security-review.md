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
also need the two added headers in the bucket's CORS configuration; the
Terraform definition is updated, but the deployed bucket must be checked.
The database fix requires migration
`20260928111109_mcp_oauth_atomic_family_revocation.sql`
before the MCP route deployment. The worker fix changes the shared image worker;
it needs a coordinated worker release and production monitoring under the
source-parity policy in `infra/gcp/README.md`. None of these fixes is
active on the deployed services until that rollout completes.

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

Before declaring the fixes live, apply the migration, deploy MCP and worker
from the same reviewed revision, then perform a new small upload through the
real MCP domain. Confirm an oversized PUT fails and a second PUT fails without
leaving test media visible. A repeated live image run also needs a paid account
with available credits; the connected test account is Free with zero credits.
The high finding's repeated bounded abandoned uploads still call for a
per-account quota and cleanup policy before wider public rollout.

Scan ID: `088cca54-2a76-4ff3-af31-52b98636eaf4`.
