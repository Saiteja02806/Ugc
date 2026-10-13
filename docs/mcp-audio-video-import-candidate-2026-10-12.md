# Saved audio to video import candidate — 12 October 2026

Full application access remains unfinished. This candidate is stacked on private audio transfer PR #42, based on `613c50c88015100040263d99444f779ca455525f`. It adds `import_audio_for_video` and `get_audio_video_import`, bringing candidate source registration to 46 tools. Production still exposes the 33-tool export-history release; no import migration, release, customer media operation or package refresh has occurred.

## Customer behavior

An explicitly selected, owned, ready saved recording or generated speech becomes an independent audio attachment for the existing video finisher. Voice references and free tests are rejected. The private `audio_assets` ID is not a finisher input: only the new ready `media_asset_id` can be used for `demoAudioAssetId` or `backgroundAssetId`. Importing does not generate speech, render a video or reserve generation credits.

Save a client request UUID before submission. Reads by that UUID recover pending/ready/removed status without copying bytes. Retrying the identical accepted request preserves its reservation, storage location and immutable content. A committed snapshot survives retirement of its original recording. An uncopied pending reservation cannot substitute changed source bytes. `import_id` also identifies a pending copy for existing `delete_asset`; deleting the copy does not delete the original private recording.

Imports use the application's current media-upload policy, matching the website's saved-audio attachment flow. The current default creates a public editing snapshot while keeping the original private; this candidate does not establish globally private video media. If the separate private-upload gate is selected, the private bucket identity and enforced public-access-prevention policy must pass, with no public fallback.

## Implementation and migration

The owner-aware service checks source purpose/status, UUID identity, private owner/key identity, SHA-256, size, MIME/container and duration. Actual bundled ffprobe/ffmpeg decode the complete audio, bounded to 12 MiB and 180 seconds. Destination writes are create-only; reads pin the exact GCS generation and verify size, checksum, request metadata and MIME. A transient storage error is never treated as proof that an object is absent. Lost reservation, storage-write and completion acknowledgements recover the same identity.

New imports default off unless `MCP_AUDIO_VIDEO_IMPORT_ENABLED=true` and audio configuration/probe prerequisites are ready. `get_audio_capabilities` reports `video_import_available`. Accepted requests retain recovery when the new-creation gate changes. Existing private-upload signing/probing/cleanup, bucket selection and quota policies remain in force.

`20261012150824_mcp_audio_video_import.sql` adds two service-only security-invoker functions with an empty search path. Both explicitly revoke execution from PUBLIC/anon/authenticated and grant service_role. Reservation reuses the existing request uniqueness, per-owner advisory lock, maximum five pending uploads, shared 500 MiB pending quota and cleanup leases. Completion binds owner, request, asset, immutable source snapshot, storage generation and decoded duration. No table, bucket, IAM, renderer or existing RPC is replaced. A schema-cache notification follows the grants.

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

## Review and remote verification

Draft PR: https://github.com/Saiteja02806/Ugc/pull/43, base `codex/mcp-audio-transfer`. Runtime/source commit `9df9f3ee56b3068ec8373c4364bb03ee709a5151` is pushed and matches the remote branch. Both exact-commit Ubuntu MCP workflows succeeded: https://github.com/Saiteja02806/Ugc/actions/runs/38265467157 and https://github.com/Saiteja02806/Ugc/actions/runs/38265462700. They run the full MCP suite, plugin checks/deterministic builder and application/worker production dependency audits. Migration reconciliation guard https://github.com/Saiteja02806/Ugc/actions/runs/38265467264 also succeeded. These runs establish Linux offline-contract execution, not a production release or hosted media workflow.

Production migration follow-up: the user explicitly approved this migration and gated deployment. The normal Supabase migration tool then applied it successfully as ledger version `20261012150824`. The local filename/fixture are aligned to that authoritative version with SQL bytes unchanged. Both deployed function-body MD5 values match the reviewed source (`38e3e7f17179f27c4ba84b52839e37a0`, `1a7134b548559ca829e62cc8a866712a`); invoker mode, empty search paths, service-only execution and denied anon/authenticated execution are verified. No customer row/object was created. The prior authorization rejection is resolved for this exact approved action; staged application/MCP deployment and hosted acceptance are next.


Production baseline preservation: immediately before promotion, authoritative domain inspection found a newer release `4d7947a62b783a93f37d2bc3ceefdc0c1132b1e1` on both website and MCP. Website alias maps to `dpl_APkxhGiNzNPGiAWBezoc1zPWgD9W` (`ugc-amwvs6q7u-ugcpilot.vercel.app`); MCP maps to `dpl_FoAACavGxABJ5mZBRvZ796gLEfSr` (`ugc-7hi8zv01h-ugcpilot.vercel.app`). This supersedes the earlier export-history runtime baseline. The isolated audio branch is merging this production release so no newer application/migration/font changes are reverted. Only two evidence-document conflicts arose; the newer audio records were preserved. The imported-audio fixture now reads the production-reconciled existing audio constraint filename, without changing its SQL.

The already-created stages `dpl_G75Y3uJNv7TB4vKWsYysm9pFPPSv` (website, READY) and the pending MCP stage were built from pre-merge `c499e9c9ec7816a1cad24e05ca00a8dac9a73cfd`. They must not be promoted because they do not include the new production baseline. Revalidation and replacement stages from the merged commit are required. No custom production domain was promoted by this task, and the approved import migration remains applied. The worker is not redeployed in this audio release.

## Approved gated audio release — 2026-10-12 15:38 UTC

The user's approval was carried out. Both real production targets serve runtime `88f581e91101d3c471c9d675b12e9daee5ac4a49`, preserving production ancestor `4d7947a62b783a93f37d2bc3ceefdc0c1132b1e1`. Website deployment `dpl_6DHVinx38oPsKeCv6VX5551vva6H` (`ugc-e4puytk3r-ugcpilot.vercel.app`) was promoted first; MCP deployment `dpl_7Gan3STBMWFzk1J8P3seaZmu1rsV` (`ugc-8quvryj6p-ugcpilot.vercel.app`) second. Apex, www and MCP custom aliases were verified against these exact READY deployment IDs and full runtime commit. Superseded pre-merge builds were not promoted. A same-source automatic website rebuild had changed its previous deployment ID; the preserved source baseline stayed `4d7947a...`.

Both replacement builds explicitly received `MCP_AUDIO_VIDEO_IMPORT_ENABLED=false` and `MCP_PRIVATE_UPLOADS_ENABLED=false` as build/runtime overrides. Migration `20261012150824` remains applied. Post-release read-only inspection reconfirmed both function body hashes, invoker mode, empty search path, allowed service-role execution and denied anon/authenticated execution. No infrastructure or worker deployment, customer transfer, generation or render was performed.

Exact merged-source Linux CI passed in runs https://github.com/Saiteja02806/Ugc/actions/runs/38270474287 and https://github.com/Saiteja02806/Ugc/actions/runs/38270469474; migration guard run https://github.com/Saiteja02806/Ugc/actions/runs/38270474320 passed. Local build, type/lint, full MCP, worker, package and extracted-helper checks had also passed. The protected-stage website was read through the normal Vercel connector and showed all three 0.1.9 downloads and noindex; staged MCP health returned ready. CLI 59.13.1 curl mishandled global flags, so the supported Vercel fetch connector was used; no protection setting was changed.

All 30 checks in the production release verifier passed against https://www.getugcpilot.com and https://mcp.getugcpilot.com. This includes setup links/noindex, exact 0.1.9 ZIP/guide/checksum, all older archives/checksums/guides, support/privacy, health, OAuth metadata/PKCE, invalid token/origin/request guards and deployment isolation. ZIP SHA-256 remains `16a171c466f29e476f5a326c0525e0cfe586931a7c0fb233c1893f0c28a9e435`; all fourteen older local release artifacts are unchanged. The existing authenticated native video-finishing capability read succeeded after deployment.

The deployed source registers 46 tools; this ongoing chat still exposes the cached 33-tool catalogue. Fresh authenticated 46-tool discovery and live audio capability reads are pending a supported client refresh. No refresh or private-plugin publish/update capability is exposed among the available management tools; no token/cache extraction or alternate authentication was used. Public plugin 0.1.9 is downloadable at https://www.getugcpilot.com/connect-ai. Installed private/IDE packages have not been proven updated. Claude.ai OAuth evidence does not establish local Claude Code authentication or terminal transfer acceptance.

Full application parity remains unfinished. Next acceptance is fresh read-only audio discovery/capabilities, followed by an intended user-selected hook → demo → finished local download workflow in Codex and Claude Code. Import/private-media activation and the broader application gaps remain separately tracked. Logs, helpers, cache/build output and local environment files remain excluded by `.vercelignore`; versioned public downloads are included. No unrelated runtime change was omitted or rolled back.


## Current follow-up — 13 October 2026

The approved audio restoration and private plugin 0.1.9 update are complete. All 30 production release checks pass; this chat discovers 46 tools and authenticated audio readiness is false because MCP configuration is incomplete. Advanced PR #45 has passed exact-head core CI and the primary preview, with a separately diagnosed Firebase configuration failure on its secondary preview. Its migration remains unapplied. Historical pending statements above are superseded by [current restoration evidence](mcp-release-restoration-2026-10-13.md). Full application and intended IDE media-workflow acceptance remain unfinished.
