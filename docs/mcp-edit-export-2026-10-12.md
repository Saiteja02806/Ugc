# Dedicated saved Edit export through MCP — 12 October 2026

Status: implementation candidate on `codex/mcp-edit-export`, stacked on the released Edit opening feature. Full application parity and real customer workflow acceptance remain unfinished. No production customer draft, render, upload, generation or publishing action was invoked for validation.

## Behavior

`get_edit_export_capabilities` reads runtime availability through account:read. `export_edit_draft` requires creative:write and a saved draft UUID, expected revision and stable request UUID. It exports that saved revision with the existing `render_edit_video` worker, trim/text schema, overlay layout and output dimensions. It accepts no caller owner, media URL, draft content, ratio or project. No generation-credit reservation or external AI provider is added; a requested export does submit actual render work.

The new service validates current owned raw source readiness, canonical source identity, duration, supported text and truncation before an atomic database RPC freezes the revision, render snapshot, background job and receipt. Source and draft are revalidated and locked in the transaction. An interrupted or repeated request recovers the original job; newer website/IDE edits remain unchanged. A changed draft/revision for the same request is rejected. Existing queue dispatch/recovery and job attempt identity are reused.

`get_edit_export` uses jobs:read and never dispatches work. It returns safe request/draft/revision/job status and an exact ready owned output asset ID. Unconfirmed requests, cancelled/failed jobs and removed outputs have explicit states. A conditional invoker trigger registers a completed MCP export as an immutable `edit_export` media asset during the existing worker finalization transaction. It preserves deleted outputs and suppresses artifact creation for removed drafts/sources. Website-only render requests are unaffected. The existing `get_asset` delivery/download workflow retrieves a ready output. The runtime gate reuses the already deployed `MCP_VIDEO_FINISHING_ENABLED`; read recovery is independent of creation gates.

No existing website API, editor UI, worker, billing policy, plugin identity or OAuth scope is replaced. Shared renderer/finalizer contracts remain authoritative. Dedicated website export's legacy request contract remains unchanged. This does not implement Explore/slideshow working drafts or complete broader application parity.

## Evidence and limits

- Five actual-baseline PGlite transaction checks passed: concurrent/response-loss replay, immutable saved snapshot, edits after queue, source/owner/revision guards, zero partial writes after insertion failure, exact ready artifact identity/dimensions/duration, output/project/source removal, non-MCP completion behavior and backend-only execution/RLS.
- Five actual MCP/service checks with mocked storage and queue boundaries passed: strict scope/input validation before activity, interrupted committed export recovery, source/range/text rejection, transaction revision conflict, safe completed output identity, disabled creation with read recovery, cancellation and failure states.
- Complete MCP suite passed, including discovery/annotations for 33 registrations and previous generation, finishing, Demo, upload recovery, operation and saved draft regressions. TypeScript, targeted ESLint and diff checks passed.
- Twenty unchanged worker/Edit overlay/finalizer regression checks passed; the worker package builds successfully. Migration reconciliation guard and six parity-check unit tests passed. The historical local/remote migration-ledger drift is not repaired or replayed by this additive feature.
- Production read-only schema preflight confirmed no existing export table/functions or render triggers, service insert permission on media/jobs and RLS on all affected existing tables. Security advisors reported only the known INFO `rls_enabled_no_policy` notice, with no WARN/ERROR.
- PGlite queued calls are not hosted multi-session concurrency acceptance; mocked queue/storage checks are not an actual hosted render/download. A requested real workflow in Codex and Claude remains necessary before claiming end-to-end acceptance.

Local production compile, exact-commit CI, reviewed migration apply, hosted builds and production promotion will be recorded after verification. No production schema or runtime release is claimed by this candidate evidence.
