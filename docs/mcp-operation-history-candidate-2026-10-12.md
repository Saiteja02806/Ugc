# MCP operation history and control candidate — 12 October 2026

Status: reviewed locally, not yet committed or released. This additive candidate starts from upload-recovery branch head `70a36c742bddc55dd2a444161184c6c9253d7056` in the isolated `codex/mcp-operation-history` checkout. The live MCP server still has twenty-two tools; the candidate registers twenty-six. Full customer application access remains the objective.

## Contract

- `list_operations` discovers owned website and MCP jobs, excludes internal test jobs, and filters canonical type/status/project before bounded pagination. Signed cursors bind owner and every filter. Creation timestamp plus ID gives stable ordering; database microseconds are preserved.
- `get_operation` exposes a safe status summary and verified ready output media IDs from supported output fields. It hides raw inputs, outputs, provider diagnostics, storage keys and queue identifiers. Existing Explore finishing requests can recover their stable request key. Domain-specific Library, audio and Carousel retrieval still need their own adapters.
- `cancel_operation` and `retry_operation` require the new `jobs:write` OAuth scope. Existing read, generation and finishing grants do not authorize controls. The normal website consent explains asynchronous cancellation and retry credit reservation.
- Controls require a saved UUID request ID, an owned operation ID and the exact `expected_updated_at` revision returned by the read tool. A changed revision is rejected; it is not automatically retried with a new identity.
- An owner/request advisory lock and job row lock protect a durable receipt recorded in the same transaction as the existing cancel/retry function. Exact replay returns the receipt without applying the action to a later revision or funding another retry. Changed inputs conflict. Existing attempt limits, provider uncertainty/moderation exclusions and original-plan credit rules remain authoritative.
- New retries check dispatch configuration before credit mutation. Existing deterministic queue delivery and recovery preserve a funded queued job after delivery failure. Replaying a receipt can recover delivery but does not create another retry transaction.

The candidate SQL was created with the Supabase CLI as `20261011172649_mcp_operation_recovery.sql`. It adds the service-only RLS receipt table, one owner/history pagination index and a SECURITY INVOKER control RPC with an empty search path. It does not replace existing cancellation/retry functions. Before release, production catalog reads confirmed these additions are absent and both existing function bodies match the local tested baseline after whitespace normalization. Their service-only execution grants remain intact. No unrelated historical migration drift will be repaired or replayed.

## Validation

- Complete MCP regressions, including twenty-six-tool registration and HTTP transport, passed.
- Six new actual-baseline database control tests plus nine existing funded-retry database regressions passed. They cover receipt replay, conflicts, owner/revision checks, credit rollback, asynchronous cancellation and service-only invoker/RLS grants. PGlite checks exercise the actual SQL; hosted multi-session concurrency is not claimed.
- Six new service/tool integration tests passed with the real Supabase client and mocked REST/queue boundaries. They cover strict schemas, scopes before database access, bounded/filter-bound history, safe diagnostics/output ownership, dispatch failure and recovery.
- The existing shared-job suite passed all 55 checks.
- Full TypeScript and the Next.js 16.3.8 production build passed; the build generated 153 static pages. The consent/setup TSX changes add scope copy and the connection command without altering component state or hooks.
- Seven package/schema tests and three deterministic Python package-build tests passed. Plugin candidate 0.1.6 retains the durable actual-byte upload/download helper and adds explicit operation-control/recovery instructions. Its private archive has 34 entries, 99,714 bytes and SHA-256 `bb7d7bd08fc8e141251d60c6be06257bde8bd0bac2ba098f2b147963ca3c120b`.
- Production security advisors returned the existing INFO-only RLS/no-policy notice, with no WARN/ERROR finding. Service-only tables intentionally deny ordinary client access. Remediation reference: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy.

## Acceptance and remaining work

Normal Codex OAuth reconnect for the current twenty-two-tool release is complete. Actual native tools in this desktop chat successfully read production finishing capabilities (available; manual editing, framing and subtitles), five Demo records and zero pending uploads. This establishes read execution, not a generated/rendered video or local-file transfer.

The new control permission must be deployed in the website consent path before the MCP release. After exact-commit CI and staged build verification, apply only the reviewed additive migration, verify its catalog/grants, stage both production projects and promote the tested website before the MCP runtime. Verify their exact alias identities and fresh twenty-six-tool discovery. Normal incremental `jobs:write` consent is required before account control acceptance.

No production media upload, registration, generation, transcription, finishing render, deletion, cancellation, retry or publishing was submitted for testing. Public plugin download 0.1.2 and installed Codex/Claude packages remain unchanged. Complete execution in both IDEs is still pending. Mutable creative drafts, advanced generation/characters, audio, full editor/references, slideshow rendering, Trending/Carousel, Library/groups, business/settings, social and analytics adapters remain unfinished as detailed in the remaining-work audit.
