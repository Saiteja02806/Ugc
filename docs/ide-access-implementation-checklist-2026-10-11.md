# Complete UGC Pilot access from an IDE: code-backed change checklist

Checked 11 October 2026. This is a source audit and proposed implementation sequence, not an implemented release. No live generation, uploads, publishing, account changes, or deployment were performed. The immediate video-generation question is answered in `mcp-video-code-capability-audit-2026-10-11.md`.

Implementation update: the local candidate now adds shared website/MCP finishing services, capability checks, `finish_video`, `get_video_finish`, a separate creative scope and a plugin finishing skill. The 0.1.4 candidate additionally packages real local file inspection/upload, saved confirmation recovery and verified output download. See `ide-video-finishing-implementation-2026-10-11.md` and `ide-local-media-transfer-implementation-2026-10-11.md` for tests, rollout and remaining work. The table below records the original full-app gap checklist; these slices have not been deployed or accepted in installed hosts.

## What already works in the code

The basic MCP video-generation chain is complete: `generate_video` validates the request and owner, atomically reserves credits and creates a durable job, dispatches the queue, invokes the worker/provider, validates and stores MP4 bytes, finalizes an owned media asset, and exposes the result through `get_job` and `get_asset`. Worker compilation and focused offline tests passed. This does not certify that the same source, migrations, credentials, queues, and provider access are currently deployed and healthy.

The current MCP video request accepts a prompt of up to 1,000 characters, durations of 3–10 whole seconds, 9:16 or 16:9, batches of 1/2/4, and an optional single owned image reference. It selects `google_omni`; resolution defaults to 720p in the worker. Full website generation settings are not exposed.

Generic image/video/creator-footage upload also exists: reserve a signed PUT URL, send actual local file bytes directly to storage, then confirm. The remote MCP server cannot read a local filesystem path. The host needs authorized file access and binary HTTP transfer, or a local bridge/attachment mechanism.

## Changes needed for the first complete video workflow

| Workstream | Required change | Existing code to reuse |
| --- | --- | --- |
| Shared application services | Extract request-bound authentication from finishing/editing orchestration. Website Firebase authentication and MCP OAuth must resolve a trusted actor into the same owner/entitlement-aware services. Do not pass MCP tokens to routes expecting Firebase tokens. | `lib/mcp/auth.ts`, `lib/mcp/read-tools.ts`, `lib/explore/workflow-finishing-api.ts`, `lib/jobs/background-job-service.ts` |
| Local-file transfer | Teach the plugin to upload real hook/demo bytes through signed PUT, probe duration/dimensions, report progress, and download actual results. Add stable upload-request identity, reservation lookup and expired-URL recovery. Backend validation should inspect actual media rather than trusting submitted metadata. A packaged transfer helper is optional for terminal-capable hosts. | `lib/mcp/mutation-tools.ts`, `lib/mcp/upload-store.ts`, `lib/mcp/upload-validation.ts`, `lib/media/media-upload.ts` |
| Demo-library parity | Expose dedicated Demo upload/confirmation/registration using shared services and existing 100 MB, 1–60 second limits. Preserve hook classification for creator uploads. | `lib/demo/demo-api.ts`, `lib/demo/demo-upload.ts`, `app/api/demo/create-upload-url/route.ts`, `app/api/demo/complete-upload/route.ts`, `lib/trending/hook-video-sources.ts` |
| Saved creative drafts | Add owner-scoped draft create/get/list/update with revision conflicts. Save selected hook/demo/audio IDs, trims, exact overlay text and timing, framing, and output relationships. Reuse submitted finishing receipts; unfinished selections/edits currently depend on browser state/localStorage. | `components/explore/format-video-editor.tsx`, `components/explore/use-workflow-finishing.ts`, `lib/explore/workflow-generation-receipts.ts`, existing `explore_video_finishes` |
| Editing and final composition | Add typed MCP operations for clip preparation, demo attachment/replacement, and final composition. Reuse the current workers and validation. Format edits, framing, and demo/subtitle composition cannot all be submitted together under the existing finishing contract: prepare clips in valid stages, then compose their owned outputs. | `worker/src/lib/explore-finishing-contract.ts`, `worker/src/lib/explore-format-edit.ts`, `worker/src/lib/explore-format-render.ts`, `worker/src/jobs/finish-explore-video.ts` |
| Operation recovery | Add discoverable operation list/get/request-ID lookup covering approved editing/finishing types, safe cancellation/retry where supported, stage progress and verified output IDs. Preserve existing `get_job` compatibility; it only accepts MCP image/video generation jobs. Status reads must not silently create or requeue work. | `lib/mcp/generation-tools.ts`, `lib/jobs/background-jobs.ts`, `lib/explore/workflow-finishing-api.ts` |
| Audio and downloads | Expose editor audio through the actual audio service contracts, plus output filename/MIME/size and URL-expiry/renewal semantics. Generic MCP asset enums currently omit audio; the dedicated audio domain needs more than an enum change. | `lib/audio/api.ts`, `lib/audio/selection.ts`, `lib/explore/workflow-default-music-api.ts`, `lib/media/media-delivery.ts` |
| Plugin and permissions | Add the implemented workflows, accurate scope descriptions and incremental consent. Update tool registry checks, package allowlist, evaluation prompts and release manifests. The current validator assumes exactly 12 tools. Test each target host separately. | `plugins/ugc-pilot`, `lib/mcp/scopes.ts`, `scripts/validate-ugc-pilot-plugin.mjs`, `scripts/ugc-pilot-package-files.json` |

Dedicated Demo registration is **not required for minimum Explore hook-plus-demo composition**: a generic uploaded ready owned video can already be used as `demoAssetId`. It is required for the dedicated Demo library and legacy Trending flows that filter for `source_type=demo_upload`. Uploading a file does not by itself attach or render it through MCP.

`PRIVATE_USER_MEDIA_ENABLED=true` currently blocks new generic upload reservations because private writes are not implemented. With the existing public-upload configuration, signed PUT already works in the source. Complete private writes as a separate rollout requirement if private uploads are part of the product commitment; do not describe them as already implemented.

## Changes needed for complete current-application coverage

| Application area | Required IDE coverage and material constraints |
| --- | --- |
| Brand and onboarding | Read/start/update/submit/retry onboarding, logo upload, Business Context edits/reanalysis/apply, settings and profile revision conflicts. Current MCP reads only a completed brand. Reuse `lib/business-profiles/onboarding-drafts.ts`, `lib/business-profiles/db.ts` and existing business routes. |
| Advanced generation and characters | Runtime model/resolution/duration/reference capabilities; currently enabled image/video settings; character generation/history, candidate selection, identities and preferences. Reuse `lib/ai-studio/generation-settings.ts`, image/video generation APIs, and `lib/characters/*`. Derive candidate ownership from generation records and fingerprint every input. |
| Creative Assets and Library | Group creation/rename/deletion/membership and Library list/get/save/delete, including ordered slide outputs. Keep asset, Library-item and Carousel-generation identities distinct. Reuse `lib/media/creative-asset-groups.ts` and Library routes. |
| Trending and automatic Carousel | Explicit prepare/read/history, content mix, save/skip/reconsider/accept, editable source retrieval, revision-safe edits, rendering status and Library save. Preserve `CAROUSEL_CONTEXT.md`, ownership and render readiness. The old manual Carousel generation route returns 410 intentionally; do not revive it for agent access. |
| Explore slideshows and references | Reference catalogue, selection, ordered slideshow drafts, exact text, reorder/remove, remix receipts and Library save. **New backend rendering is required:** `lib/explore/slideshow-text-client.ts` currently exports text through browser canvas. Add an owned, bounded, idempotent worker/server compositor using the shared `slideTextSvg`/design contract and verified font parity. |
| Audio | Voices, samples, history, generation, private uploads, download/delete, selection/bookmarks and default music. Preserve existing access/credit rules and provider-required voice consent. Reuse `lib/audio/api.ts`, bookmarks and selection services. |
| Social connections and delivery | Account list/status/connect/reconnect/disconnect; schedules list/get/create/update/cancel; authorized publishing and target retry. Reuse `lib/social/oauth.ts`, `lib/scheduling/service.ts` and publishing workers. Preserve verified identity, account limits, timezone, lead time, final output readiness, TikTok privacy/music/disclosure settings and per-target outcomes. Add an IDE-compatible OAuth completion receipt/status handoff. |
| Analytics and account settings | Existing account/content reports, supported date ranges, freshness, missing metrics, explicit refresh/job status, timezone and publishing preferences. Billing can return the existing payment/portal handoff. Provider integration availability must be reported accurately. |

Capability discovery must report actual deployed feature gates and account eligibility for all these areas. A source file existing does not establish that the feature is enabled in production. Add distinct scopes for implemented brand, creative, audio, operation, social, scheduling, publishing, analytics and settings actions; already issued tokens must not silently acquire new permissions.

Ordinary creation, editing, saving, downloading, scheduling and reporting should finish inside supported IDEs. Initial UGC Pilot sign-in/consent, social-provider authorization, payment and provider-required identity verification can still use their required browser handoffs.

## Delivery sequence

1. Shared trusted-actor service boundary, accurate capabilities and scope contracts.
2. Complete local/generated hook + demo video workflow: upload, persistent draft, staged edits, attachment, composition, recovery and actual download.
3. Remaining generation settings, characters, Creative Assets/Library and brand operations.
4. Audio, server-rendered slideshow text, references/remix, and current Trending/automatic Carousel parity.
5. Social connection handoffs, scheduling/publishing and actual target outcomes.
6. Analytics, account settings, package distribution and full host acceptance.

Campaign planning, unattended reasoning, a new agent runtime and additional marketing integrations are optional later layers. They are not prerequisites for the user's requested current-application access. Reuse the established queue/worker/storage stack.

## Acceptance before claiming complete access

- From both Codex and Claude Code, upload real local hook/demo files, create/read the same server draft, apply exact text and trims, compose in the requested order with the selected audio, retrieve and download actual finished bytes without using the website editor.
- Verify the same owned draft and output are visible to the website as another client. Continue from a second IDE after losing the first chat.
- Lose submission/confirmation responses and retry: identical input returns the same operation/output; changed input under the same request identity conflicts; reservations and charges do not duplicate. Recover expired upload links and lost request keys.
- Reject foreign-owned resources, stale revisions, invalid/truncated media and false metadata; accurately report unavailable features and partial outputs.
- Exercise every application row, including real slideshow text rendering and per-platform schedule results. OAuth/publishing choices must come from authorized user intent and actual provider policy.
- Run offline checks first. Final authenticated/integration acceptance must use the deployed production domains and exact candidate source. Paid generation and publishing require an authorized acceptance run; none occurred in this audit.

Current standalone-generation verification passed: MCP handler fixtures, atomic generation migration fixtures in local PGlite, two idempotency tests, worker TypeScript build, and 27 focused worker/provider/MP4 tests with mocked services. These checks establish source behavior for tested cases; they do not establish live provider or deployment health.
