# UGC Pilot Cloud MCP: Phase 5 image generation

Current status (30 September 2026): see [the production audit](mcp-production-readiness-audit-2026-09-30.md). The corrected MCP and video adapter are deployed. Public image/video generation, polling, uploads, default asset listing and billing pass. Existing clients must refresh permissions and tool discovery. The dated plan below is historical.

Status: implemented and locally validated on 2026-09-28. The migration has not been applied to production, and the MCP service has not been deployed or tested with a live image provider.

## Behavior

- `generate_image` requires `generation:write` and an active Starter or Growth subscription. It accepts the approved prompt, ratio, optional owned ready image reference, quantity of 1, 2, or 4, and client request ID. The reference URL is resolved from the owner's media row, never accepted from tool input. It uses the existing default image model and the existing image worker.
- Each image has a user-scoped child idempotency key and a fingerprint of the normalized request. The new `mcp_create_reserved_generation_job` database function checks the fingerprint on a retry, then calls the existing billing reservation and durable job creation functions in one transaction. A changed request ID payload fails with `IDEMPOTENCY_CONFLICT`; if job insertion fails, Postgres rolls back the reservation. Its execute privilege is limited to `service_role`.
- Queue delivery follows the existing Cloud Tasks route. If immediate delivery fails, the durable queued row remains available for the existing recovery endpoint; a matching tool retry also attempts delivery again. The tool returns job IDs without waiting for provider work. A multi-image request can return `partial:true` when earlier children were queued and a later child fails; retrying the same request can create the missing children.
- `get_job` requires `jobs:read`, checks ownership and the MCP marker, and returns only the public job state. It reveals an output asset ID only for a completed job with a ready asset still owned by the caller. Provider details and internal job errors are not included.

## Validation

- `scripts/test-mcp-generation-migration.mjs` applies the current billing and job functions plus the new migration in PGlite. It passed service-role isolation, first creation, identical retry without another reservation, changed-input conflict, invalid input, insufficient credits, transaction rollback on job insertion failure, missing plan, and stray reservation checks.
- `scripts/test-mcp-generation-tools.mjs` exercises the MCP transport with local service fixtures. It passed scope and plan checks, normalized retry, conflict, insufficient credits, partial batch and retry, reference ownership, Cloud Tasks delivery failure and retry, job ownership, completed output, and safe failure response.
- The fingerprint unit tests, targeted ESLint, and optimized Next.js build passed. A raw `tsc --noEmit` still reports the pre-existing `lib/reaction-format/generation-jobs.test.ts` fixture type error; it reports no Phase 5 errors.

## Deployment boundary and remaining work

This MCP-specific wrapper leaves the existing website image-generation code unchanged. The website's previously identified duplicate-reservation release race is still separate work. Production acceptance requires applying the Phase 2 OAuth migration and this Phase 5 migration, deploying the MCP route at its approved domain, then testing real OAuth, credit reservation and settlement, queue dispatch and recovery, provider completion, and output ownership. The recovery scheduler is optional in Terraform, so its live enabled state must also be checked before relying on unattended recovery. None of those production changes has been made here. Phase 6 video generation and its billing rules remain separate.
