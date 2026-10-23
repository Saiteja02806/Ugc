# MCP registration CPU review — local evidence

Status: local source optimization only; no deployment, account mutation or paid generation.

## Finding and change

`app/mcp/route.ts` authenticates each request before invoking the transport. The installed `@modelcontextprotocol/server` 2.3.1 invokes the factory in `lib/mcp/server.ts` separately for requests; that factory registers 79 tools across 15 registrar functions. The SDK converts output schemas while registering and converts advertised schemas for `tools/list` again.

Eight static input/output schemas for six tools in `lib/mcp/read-tools.ts` were constructed inside its registrar on every request. They now initialize at module scope, matching that module's existing shared schemas. Every transport still creates its own server, tool descriptors and handlers. Principal checks remain inside request handlers; auth/token revocation and feature gates are unchanged. No auth, entitlement, output, catalogue or user-data cache was introduced.

## Local measurements

`scripts/profile-mcp-registration.mjs` runs actual application registrars and the installed SDK with global network access replaced by a throwing function. It exercises authenticated-fixture `tools/list`; authentication database time is deliberately excluded. Five requests warm up each run. All response bodies are consumed.

- 80-request baseline: mean total CPU 42.575 ms/request; mean factory CPU 16.2125 ms/request.
- 80-request optimized run: mean total CPU 35.9375 ms/request; mean factory CPU 14.4875 ms/request.
- Both runs returned 79 tools, 211,355 response bytes and identical tool-catalogue SHA-256 `e67559c83ca12f573cc5dd9f1b198ba0ac35326360156b6ff014f31d7702609b`.

Separate runs show substantial scheduler/GC variation, so these full-request averages do **not** establish a production percentage saving. A same-process, alternating-order microbenchmark performed 500 actual read-registrar calls to a registration sink per round: baseline CPU 1,250 / 1,188 / 1,109 / 1,313 ms; optimized samples fell below the process CPU clock resolution (reported zero). This isolates removal of approximately 2.2–2.6 ms of repeat schema construction per request in that local test. Zero reported CPU does not mean literal zero work.

The baseline source was captured before editing in ignored `.tmp/mcp-profile/read-tools-baseline.ts`. Optional `MCP_PROFILE_READ_TOOLS_BASELINE` runs it through a VM with the original imports; `MCP_PROFILE_ITERATIONS` changes sample count. These ignored local artifacts are not deployable source or a durable benchmark fixture.

## Validation

- Two dedicated tests in `scripts/mcp-static-read-schemas.test.mjs` pass: schema reuse, fresh handlers/servers, normal validation, missing-scope rejection and concurrent owner isolation through the real SDK.
- `scripts/test-mcp-read-tools.mjs` passes bearer route validation, discovery, read tools, upload creation/late confirmation, owner isolation, retries, storage failures and soft deletion.
- Scoped ESLint passes for the application file, profile script and regression tests.
- Parent task performs combined TypeScript/build validation separately.

## Remaining investigation

Most of the 79-tool catalogue remains outside this narrow change. SDK conversion/serialization and repeated static schema creation in other registrars still need profiling. A shared `McpServer` would violate per-request serving/lifecycle isolation; do not use one as a shortcut. Auth caching would affect revocation and is outside this patch. Production route CPU must be interpreted alongside invocation/method frequency and actual traffic; local `tools/list` profiles alone cannot assign all `/mcp` CPU to registration.

## Follow-up: defer transport until a request passes rejection checks

The parent task found substantial production `/mcp` CPU associated with HTTP 401 responses. Previously `app/mcp/route.ts` imported the entire SDK/server/tool graph eagerly, before knowing whether authentication would succeed. The route now imports `@/lib/mcp/server` only after host/origin validation, per-request authentication and bounded POST-body handling. No token lookup, revocation, transport limits or request-scoped server behavior changed. The import is naturally cached by the runtime; no user-data or token cache was added.

Five focused route tests pass: no SDK initialization for unauthenticated GET/POST/DELETE, host/origin and body-size rejection; auth on each authorized request and subsequent revocation; independent concurrent principals and tool-auth metadata mirroring; and 503 handling on module-load failure. The full actual auth/read/upload regression script passes after this change as well.

`scripts/profile-mcp-cold-import.mjs` runs the actual route in a fresh Node process with network access forbidden and observes SDK module loads through Node's loader hook. The updated route imports **zero SDK modules** and returns 401 for all three methods. An ignored eager baseline restores the old static import on otherwise identical current source and imports nine SDK modules. One local pair measured 198 ms wall / 328 ms CPU for lazy module import versus 2,017 ms wall / 2,626 ms CPU eager. These figures include Node's TypeScript loader and dependency evaluation; they are not Vercel cold-start timings, billed CPU estimates or a production savings forecast. They establish the deferred dependency graph, not that all 401 CPU will disappear. Native authentication dependencies and route/framework overhead still exist.

Parent final Turbopack build passed. `scripts/verify-built-mcp-rejections.mjs`
passes direct compiled GET/POST/DELETE401, invalid-origin403 and wrong-host421
checks with zero network/account requests and zero loaded read-tool catalogue
chunks. These checks do not exercise hosted Proxy or authentication integrations.
See `docs/build-storage-mcp-audit-2026-10-23.md` for final validation and limits.
