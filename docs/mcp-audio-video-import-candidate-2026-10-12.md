# Saved audio to video import candidate — 12 October 2026

Full application access remains unfinished. This candidate is stacked on private audio transfer PR #42, based on `613c50c88015100040263d99444f779ca455525f`. It adds `import_audio_for_video` and `get_audio_video_import`, bringing candidate source registration to 46 tools. Production still exposes the 33-tool export-history release; no import migration, release, customer media operation or package refresh has occurred.

## Customer behavior

An explicitly selected, owned, ready saved recording or generated speech becomes an independent audio attachment for the existing video finisher. Voice references and free tests are rejected. The private `audio_assets` ID is not a finisher input: only the new ready `media_asset_id` can be used for `demoAudioAssetId` or `backgroundAssetId`. Importing does not generate speech, render a video or reserve generation credits.

Save a client request UUID before submission. Reads by that UUID recover pending/ready/removed status without copying bytes. Retrying the identical accepted request preserves its reservation, storage location and immutable content. A committed snapshot survives retirement of its original recording. An uncopied pending reservation cannot substitute changed source bytes. `import_id` also identifies a pending copy for existing `delete_asset`; deleting the copy does not delete the original private recording.

Imports use the application's current media-upload policy, matching the website's saved-audio attachment flow. The current default creates a public editing snapshot while keeping the original private; this candidate does not establish globally private video media. If the separate private-upload gate is selected, the private bucket identity and enforced public-access-prevention policy must pass, with no public fallback.

## Implementation and migration

The owner-aware service checks source purpose/status, UUID identity, private owner/key identity, SHA-256, size, MIME/container and duration. Actual bundled ffprobe/ffmpeg decode the complete audio, bounded to 12 MiB and 180 seconds. Destination writes are create-only; reads pin the exact GCS generation and verify size, checksum, request metadata and MIME. A transient storage error is never treated as proof that an object is absent. Lost reservation, storage-write and completion acknowledgements recover the same identity.

New imports default off unless `MCP_AUDIO_VIDEO_IMPORT_ENABLED=true` and audio configuration/probe prerequisites are ready. `get_audio_capabilities` reports `video_import_available`. Accepted requests retain recovery when the new-creation gate changes. Existing private-upload signing/probing/cleanup, bucket selection and quota policies remain in force.

`20261012135219_mcp_audio_video_import.sql` adds two service-only security-invoker functions with an empty search path. Both explicitly revoke execution from PUBLIC/anon/authenticated and grant service_role. Reservation reuses the existing request uniqueness, per-owner advisory lock, maximum five pending uploads, shared 500 MiB pending quota and cleanup leases. Completion binds owner, request, asset, immutable source snapshot, storage generation and decoded duration. No table, bucket, IAM, renderer or existing RPC is replaced. A schema-cache notification follows the grants.

LF SQL: 6970 bytes; SHA-256 `cbfb87f007f1e8789be37ea64dc6aee6c326e4994cf51a7aab33ebbc909d69c8`. Use the committed bytes for any later migration application.

Ordinary visual upload lookup/list/renew/confirm excludes audio copies. This avoids exposing incompatible visual schemas or renewing a PUT link that could replace imported audio. Existing owned asset deletion handles both pending and ready copies.

## Local verification

The final source passed:

- Seven actual-migration PGlite database checks: ACL/search-path isolation, source/owner exclusion, stable replay and shared quotas, request collisions, completion proof, cleanup leases and actual existing finisher acceptance of the ready audio media ID.
- Seventeen shared-service/MCP checks using the real ffprobe/ffmpeg binaries: WAV and generated MP3 decoding, MIME aliases and mismatches, interrupted acknowledgements, immutable object proof, simultaneous same-request calls, source retirement/change, deletion of pending/ready copies, ordinary visual-upload isolation and private-policy refusal without fallback.
- Full `npm run test:mcp`, final TypeScript, touched-file ESLint, Next.js production build and worker build, each exit 0.
- Seven plugin validator checks and four deterministic package-builder checks. Public plugin 0.1.8 remains unchanged; the audio helper is not yet distributed in that package.
- Clean `git diff --check`. The MCP Next route trace includes bundled ffmpeg and ffprobe on Windows. Linux execution is a separate remote-CI check.

PGlite uses the real existing audio collection constraint and candidate RPC definitions. Queue/provider/GCS boundaries are disposable fixtures; passing these checks is not hosted storage, customer rendering or cross-IDE acceptance. Earlier fixture/module failures were corrected and the corrected suites passed. The earlier automatic approval-review usage failure resolved through the normal approved execution path; it is no longer a blocker.

## Production evidence and remaining steps

Read-only production schema inspection confirmed `media_assets` already permits collection `audio`, and both media/audio tables have RLS enabled with no client policies. Existing upload lease/cleanup RPCs are invoker functions with empty search paths and service execution. The two candidate import RPCs are absent. The security advisor returned one INFO notice for RLS enabled without policy; no new candidate migration has been applied.

Production remains runtime `415405fc834577c7547583e66ebbb989f985b85b`; website deployment `dpl_4bszasuCMsTM3ibWiH1eFBgbUfFA`, MCP deployment `dpl_D2GUbYmA4YVWiuNDDYxgD4rsRPwc`, as previously verified. This candidate does not independently re-prove those deployment identities. Native tool inventory currently lists 33 tools. No customer generation, transfer or render was invoked to demonstrate connectivity.

The user's screenshot confirms the Claude.ai connector is authenticated. Current local `claude auth status --json` still reports signed out and `claude mcp list` reports the installed plugin failed to connect. That IDE sign-in/OAuth and read-only acceptance remain pending.

Next release work is exact-commit CI/review, coordinated application/MCP deployment, migration application through the authorized production review path, capability/catalogue verification, public audio-helper instructions/package distribution and an intended hosted workflow in Codex and Claude Code. The prior explicit production approval applied to PR #39's migration/gated release; it does not by itself approve this new import schema change. Private user-media infrastructure/activation is separate.

The first acceptance priority remains the user's hook → demo → finished local download journey. Sample/default music, voice clone/verification/removal, broader generation, creative draft/editor/reference flows, slideshows, Trending/Carousel, Library, business/settings, publishing and analytics remain in the [main audit](mcp-remaining-work-audit-2026-10-11.md). Full parity is not established by a 46-tool catalogue or green local checks.
