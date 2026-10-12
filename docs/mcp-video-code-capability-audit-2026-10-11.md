# MCP video generation: current code capability

Checked 11 October 2026 at the user's request. Scope: source inspection, worker compilation, and offline tests. No production generation, upload, account mutation, or paid provider request was made. Tests use mocked services or a local in-memory PGlite database.

Subsequent local implementation adds separately gated video finishing tools; see `ide-video-finishing-implementation-2026-10-11.md`. The omissions below describe the original twelve-tool surface audited before that implementation.

## Verdict

The current source implements the complete basic short-video generation path through MCP. An authorized IDE agent can submit a prompt, receive a durable job receipt, poll it, and retrieve the completed owned video asset. This is an implemented path, not merely a tool listed in discovery.

This audit establishes source capability and offline correctness for the tested cases. It does not certify current deployed source parity, production credentials, queue/worker health, or video-provider availability. Those are separate operational checks; live generation was explicitly outside this audit.

## Traced implementation

| Boundary | Source | Finding |
| --- | --- | --- |
| HTTP and authentication | `app/mcp/route.ts`, `lib/mcp/server.ts`, `lib/mcp/read-tools.ts` | Authenticated requests reach a registered `generate_video` handler. Owner identity comes from authenticated Firebase UID and the required OAuth scope. |
| Tool validation | `lib/mcp/generation-tools.ts:140` | Validates prompt, duration, ratio, batch size, optional owned image reference, and stable request ID. Rejects unknown fields. |
| Job payload | `lib/mcp/generation-tools.ts:169` | Maps the request to `generate_hook_video`, `model: google_omni`, direct prompt mode, owner/project, and unique video ID. |
| Reservation and dispatch | `lib/jobs/background-job-service.ts:51`, `lib/jobs/background-jobs.ts:421` | Calls the atomic `mcp_create_reserved_generation_job` RPC, then dispatches the durable queued job. Replays reuse work and can recover missing delivery. |
| Worker selection | `worker/src/jobs/index.ts:86` | Dispatches `generate_hook_video` to `runGenerateHookVideoJob`. |
| Provider execution | `worker/src/jobs/generate-hook-video.ts:79`, `worker/src/lib/hook-video-provider.ts`, `worker/src/lib/gemini-omni-video.ts` | Google Omni routes to the Gemini adapter. The adapter has real SDK submission, provider-operation resumption/polling, and output-byte retrieval. |
| Output storage | `worker/src/jobs/generate-hook-video.ts` | Validates generated MP4 bytes and uploads the output to storage. Existing stored output can be reused. |
| Asset completion | `worker/src/processor.ts:316`, `worker/src/lib/supabase.ts:455`, `supabase/migrations/20260829093001_production_baseline_v1.sql:9313` | Worker calls `complete_background_job`. The SQL creates/updates a ready owned `generated_video` media asset and adds `mediaAssetId` to the job output. |
| IDE retrieval | `lib/mcp/generation-tools.ts:174`, `lib/mcp/read-tools.ts:288` | `get_job` returns the owned ready output asset ID; `get_asset` returns actual asset URL and metadata. |

## Supported scope today

- Text-to-video generation and image-to-video using one owned ready image.
- Whole-second durations from 3 through 10 seconds.
- Vertical 9:16 or landscape 16:9; batches of 1, 2, or 4.
- Prompt length up to 1,000 characters.
- Fixed MCP video model selection: `google_omni`; the current worker defaults its resolution to 720p.
- A generation receipt, status/progress, safe failure reporting, and completed video retrieval.

Prerequisites include sufficient credits, active plan eligibility, `generation:write` permission, database and queue configuration, an appropriate running worker, provider credentials/access, and read permissions for subsequent job/asset retrieval.

Current MCP does not expose the website's complete model/settings selection, video reference inputs, demo attachment, clip combination, overlay editing, or scheduling/publishing workflow. Uploading media and generating a clip do not by themselves execute that full composition flow.

## Checks executed

| Check | Result | Scope |
| --- | --- | --- |
| `scripts/test-mcp-generation-tools.mjs` | Passed | Actual MCP handler with mocked database/queue transport: video validation, scope and plan rejection, duration billing, payload mapping, reference ownership, completion, retries/conflicts, partial batches, and queue recovery. |
| `scripts/test-mcp-generation-migration.mjs` | Passed | Real migration function bodies executed against local in-memory PGlite: role isolation, video inputs, credit reservation, replay/conflicts, insufficient credits and transaction rollback. |
| `lib/mcp/generation-idempotency.test.ts` | 2 passed | Stable normalized fingerprints and owner/operation/child-scoped request identifiers. |
| `npm.cmd run worker:build` | Passed | TypeScript compilation of current worker source. |
| Focused worker/provider tests | 27 passed | Current compiled worker, mocked Gemini SDK, routing, durable provider operations, prompt/reference handoff, MP4 validation, and prevention of uncertain duplicate submission. |

Worker test command:

```powershell
node --experimental-test-module-mocks --test worker/src/jobs/generate-hook-video.test.mjs worker/src/lib/gemini-omni-video.test.mjs worker/dist/jobs/generate-hook-video.test.js worker/dist/lib/generation-provider.test.js worker/dist/lib/video-output.test.js
```

Expected simulated queue-outage log messages occurred in the passing MCP recovery fixtures; they were not live production outages.

The audited worker file already had unrelated uncommitted edits. This audit compiled the current worktree, did not change those source files, and did not deploy it. The only new source-controlled artifact from this audit is this report; worker build output is generated verification material.
