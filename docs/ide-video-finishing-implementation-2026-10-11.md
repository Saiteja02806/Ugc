# IDE video finishing: implementation and rollout

Implemented in the local worktree on 11 October 2026. This is the first video-workflow slice of the complete IDE-access plan. It is tested source and a local plugin candidate; no production deployment, uploads, paid generation, transcription or publication were performed.

Follow-up: the reviewed 0.1.4 candidate now adds a packaged Node/ffprobe transfer helper, real binary upload/download tests and saved upload-confirmation recovery. See [local media transfer implementation](ide-local-media-transfer-implementation-2026-10-11.md). The 0.1.3 package details below record the first finishing candidate; use the newer report's reviewed archive for the combined candidate. Production/installed-host acceptance remains pending.

## Implemented

- Three additive MCP tools: `get_video_finishing_capabilities`, `finish_video`, and `get_video_finish`. The original twelve tool contracts are preserved.
- `finish_video` accepts owned opening/demo IDs and the shared renderer's trim/text/audio/framing/subtitle draft. Generated and uploaded ready clips can use the same finishing path. The final composition plays the opening, then the demo.
- Clip edits and single-clip framing use separate preparation stages before final demo/subtitle composition, matching the existing worker contract. The plugin explains these dependencies.
- Shared server-only finishing service used by the website's Firebase-authenticated routes and the OAuth-authenticated MCP adapter. Website JSON responses, status codes, fingerprint policy, request identity and recovery behavior remain compatible.
- Separate `creative:write` scope and consent copy. Existing `generation:write` tokens cannot authorize finishing. Job reads remain under `jobs:read`, and completed assets are retrieved through existing `get_asset`/`assets:read`.
- Stable UUID request identities, immutable submitted drafts and atomic existing receipts protect replay/conflicts. Read-only status never creates or dispatches work, even after plan/rollout changes. An absent receipt is `unconfirmed`, not proof that an interrupted submission did not commit.
- Live finishing capability reporting derives availability from the account, MCP rollout flag, existing Explore flags and queue/storage configuration. Read-only checks do not refresh credits or initialize a free allowance.
- Plugin 0.1.3 candidate has nine skills, updated Codex/Claude/portable manifests, host evaluation scenarios, scope guidance and a `finish-ugc-video` workflow. Local file instructions use signed PUT with real bytes and explain host transfer requirements.

The code reuses current queues, workers, media ownership validation and database RPCs. No database migration or worker deployment change was added by this slice. Existing renderer migrations and matching worker configuration must already be present for activation.

## Validation

| Check | Result |
| --- | --- |
| Full `npm run test:mcp` | Passed: 24 unit tests, real SDK/HTTP discovery and existing read/upload/generation behavior fixtures, OAuth and generation SQL fixtures, storage signing, and 9 new finishing tests. |
| Website finishing API/store regression tests | 27 passed, including legacy fingerprints, response compatibility, gates, foreign/stale jobs, completed outputs and uncertain requests. |
| Website UI recovery and finishing SQL receipt tests | 39 passed; SQL runs in local PGlite, with no production database mutation. |
| Plugin schema/metadata/reference validation | Passed: 9 skills, 15 reviewed tools and 32 package files. Seven validator tests passed. Public directory approval and review recording remain separate acceptance items. |
| Deterministic plugin build tests | Three passed, including byte stability and refusing to overwrite an existing release with different bytes. |
| Application TypeScript | `tsc --noEmit --incremental false` passed. |
| Tracked change whitespace checks | Passed for this implementation's paths. |

The first broad MCP run exposed an outdated fixture that classified only the original five write tools. The fixture now checks `finish_video` as a write and verifies its new scope/strict schema. A UI test invocation initially omitted TypeScript transformation; it passed with the repository's transformation mode. These failures were corrected before reporting the final checks.

## Reviewable package

Local archive: `.tmp/plugin-packages/ugc-pilot-0.1.3.zip`

SHA-256: `4d2965c7f2f18d4377e2afc2a959953888cbcf51fbfc18b369f06c9caef431a7`

The archive points at the existing remote endpoint. Installing it does not deploy or enable new server tools. Public downloads and the production setup page remain on their existing released package until a coordinated release.

## Controlled activation

1. Review the source and complete the existing renderer/migration/queue readiness checks for the candidate deployment. Include the intentional worktree release scope if the user requests pushing/deploying all changes.
2. Deploy the website/MCP code with `MCP_VIDEO_FINISHING_ENABLED` unset or false. Original generation/upload access continues; new finishing starts fail closed. Read-only finishing status remains available.
3. Check the production MCP's advertised tools/scopes and unchanged account/generation/upload behavior. Production acceptance uses `https://www.getugcpilot.com` and `https://mcp.getugcpilot.com/mcp`.
4. Enable `MCP_VIDEO_FINISHING_ENABLED=true` only after the existing `EXPLORE_FINISHING_ENABLED` and matching renderer are ready. Manual edits, framing and subtitles continue to require their existing individual Explore gates. Do not enable a feature merely because its tool exists.
5. Reauthorize `creative:write` for a test account through normal consent and refresh host discovery. Install the reviewed candidate in both Codex and Claude Code.
6. With an authorized acceptance run, upload real local hook/demo files through each host, optionally prepare exact text/trim stages, compose, recover interrupted responses and download actual output bytes. Verify ownership rejection and the same result in the website. Paid generation/transcription are separate explicit acceptance actions.
7. Publish the reviewed versioned package/setup links only after host acceptance. Disable the MCP flag to stop new IDE finishing submissions if a problem appears; accepted jobs remain durable and status reads remain available. Website finishing uses its existing flags.

## Remaining implementation

This slice provides submission and recovery of committed finishing drafts, not a new mutable server editor or discoverable operation history. Save request keys and exact inputs for recovery. Still required for complete IDE parity:

- Mutable server drafts with revisions, list/discovery and richer cancellation/retry APIs.
- Upload reservation idempotency, lost-key/expired-link recovery, backend media probing, and dedicated Demo-library registration. The generic uploaded video already works as an Explore demo.
- Audio upload/generation/library adapters, remaining models/references/settings and character operations.
- Brand/onboarding, Creative Assets groups, full Library and current Trending/automatic Carousel adapters.
- Server-rendered slideshow text; the current manual export depends on browser canvas.
- Social connection completion handoffs, scheduling/publishing, analytics and account settings.

See `ide-access-implementation-checklist-2026-10-11.md` for the complete phased plan. No changes were made to unrelated ongoing source work, Carousel behavior, billing plans, live credentials or deployments.
