# Saved audio to video MCP checkpoint — 12 October 2026

Full application parity is unfinished. This is an uncommitted implementation checkpoint, not a release or successful end-to-end verification.

## Current source and production boundary

The isolated checkout is `C:/Users/chund/.codex/worktrees/mcp-full-app-access/UGC`, on `codex/mcp-audio-video-import`, based on commit `613c50c88015100040263d99444f779ca455525f` from the attached private audio transfer candidate PR #42. No import commit, PR, migration application, deployment, package refresh or customer media operation has occurred.

The existing production release remains the previously verified 33-tool runtime `415405fc834577c7547583e66ebbb989f985b85b`. The audio access/transfer candidates are not deployed. The current import source adds two registrations to the prior 44-tool candidate: `import_audio_for_video` (`assets:write`) and `get_audio_video_import` (`assets:read`). The 46-tool catalogue has not been executed/discovered or accepted in either host.

## Implementation written

- `lib/audio/video-import.ts`: owner-bound saved-audio selection, readiness gate, durable reservation/status and same-request recovery. Only ready, non-test generated/exact recordings qualify. Private audio IDs are distinct from finisher audio media IDs.
- `lib/audio/video-import-storage.ts`: independent snapshot in the application's current media-upload destination, create-only GCS writes, checksum/request metadata, generation-pinned bounded reads and recovery of a committed write whose response was lost. Only a real 404 means missing; transient failures cannot authorize replacement.
- `supabase/migrations/20261012135219_mcp_audio_video_import.sql`: CLI-created additive migration with service-only invoker reservation/completion functions and empty search paths. It uses the existing media table, MCP request uniqueness, per-owner advisory lock, pending upload count/byte quota and cleanup lease. No bucket, IAM, global privacy cutover, table or renderer changes.
- `lib/mcp/audio-video-import-tools.ts`: strict input contracts, existing OAuth scopes and safe metadata/status output. `lib/mcp/server.ts` registers it; audio capabilities and finisher argument descriptions direct callers to the separate import.
- Ordinary visual upload lookup/list/confirmation excludes these audio copies, preserving the existing visual output schemas and preventing upload renewal from replacing immutable audio content.
- The existing website `WorkflowSavedAudioPicker` similarly obtains selected private audio and creates an independent generic audio media attachment. Public snapshot storage under the current default policy does **not** mean a fully private final-media workflow. The original private record remains private.

New import creation defaults off with `MCP_AUDIO_VIDEO_IMPORT_ENABLED`. Known accepted requests retain recovery behavior. The separate MCP private writer gate and verified private-bucket policy still apply; no fallback to public storage after private destination failure is permitted.

## Verification actually observed

An initial `npx tsc --noEmit` succeeded before the later registration/guard/timeout changes. It is preliminary evidence and does not verify the final source.

The first disposable SQL run passed two checks (function privilege/search-path isolation and invalid-source rejection) and failed five. The fixture had loaded the old production baseline media constraint without the existing `20260930153000_ai_studio_audio_references.sql` migration that admits audio. Its finisher setup also included an unrelated renderer-lease patch requiring the full worker ledger. The fixture was corrected to load the real later audio constraint and exercise the actual finishing functions without that unrelated patch. These corrections have **not** passed a rerun.

The first service test process failed during module loading because the credentials mock omitted `getMissingVercelGcpCredentialEnvVars`. That mock and the existing `next/server` resolution adapter were corrected. No service test passed before this correction, and its rerun has **not** executed.

The two corrected verification commands were rejected before execution because automatic approval review reported a usage-limit failure, with a stated retry time of 10:23 PM. The response explicitly said this was a review failure rather than an unsafe-action determination. No default-sandbox rerun, alternate executor, repository copy or other workaround was used to bypass review. No test handles remain running.

## Source review findings still to resolve

1. Pending import summaries currently return no media asset ID. They need an independent `import_id` (owner-scoped and recoverable by the saved request UUID) so the existing `delete_asset` can remove a stuck snapshot. Keep `media_asset_id` ready-only for the finisher. Otherwise repeated failures can strand pending quota slots with no complete MCP cleanup flow.
2. Add the new SQL and service tests to `test:mcp`; standalone files are not enough for required CI coverage. Verify generic visual lookup/renew/confirm isolation, and deletion of both pending and ready audio copies through the actual adapter.
3. Run both corrected suites, then full MCP regressions, final TypeScript, touched-file lint, application build/tracing and appropriate worker/media checks. Finish source/security review and preserve exact results before creating a draft PR.
4. Verify generated/exact MIME aliases, concurrent completion/lease recovery, changed/deleted sources, owner collisions, private-policy refusal and ordinary-upload interactions with meaningful assertions. A fake GCS test proves adapter behavior, not hosted storage execution.
5. Production migration/deployment, public plugin audio instructions/helper packaging and real Codex/Claude use remain separate uncompleted release/acceptance steps. The prior user approval was for PR #39's exact private-upload migration and gated deployment; it does not authorize applying this new migration by itself.

The reviewed but **unapplied** follow-up is saved at `C:/Users/chund/OneDrive/Desktop/UGC/.tmp/audio-import-review-followup.py`. It must use the normal approved isolated-checkout execution path when approval review is available. It adds the separate import identity and required suite wiring; it is not evidence that either change is applied or tested.

Current official Supabase function guidance was reviewed: [Database functions](https://supabase.com/docs/guides/database/functions). It supports invoker execution, schema qualification with an empty search path and explicit revocation of default public execution. Documentation is design guidance, not proof of this candidate's behavior.

The basic hook → demo → finished local download journey remains the first acceptance priority, with no customer generation performed merely to demonstrate connectivity. Saved audio is one additional parity gap; advanced generation, broader drafts/editor/reference flows, slideshows, Trending/Carousel, Library, business/settings, publishing and analytics remain in the main audit.
