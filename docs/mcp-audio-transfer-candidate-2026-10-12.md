# Private audio transfer candidate — 12 October 2026

Status: local candidate stacked on the 43-tool audio access candidate. Source now registers 44 tools, including create_audio_upload. Production remains the 33-tool export-history release; public plugin 0.1.8 is unchanged. No customer upload/download, paid generation, IAM/bucket change or schema mutation has been performed for acceptance.

## Behavior

create_audio_upload accepts a saved client request UUID and measured filename, canonical MIME, size, SHA-256 and exact/reference purpose. It uses the existing account/plan/rollout/queue access policy and checks any existing owned audio record for conflicting or retired identity. It emits a five-minute upload capability, not an uploaded asset or durable reservation. No database quota/storage object is consumed until exact bytes reach the transfer route. A lost grant is renewed with the identical intent; a lost committed transfer is discovered through get_audio_generation using the same UUID.

The short-lived capability is domain-separated from visual media delivery, binds owner/mode/intent and uses the existing configured MEDIA_DELIVERY_SIGNING_SECRET and HTTPS application origin. No OAuth token is copied to the helper. The upload route verifies HMAC/expiry/mode, current plan/rollout, declared versus streamed bounds, SHA/container MIME and actual ffprobe/ffmpeg decoding before writing. Limits are 3 MB, complete self-contained audio and 180 seconds, with video/playlist/local-reference rejection from the existing worker probe. Bundled executables are selected per call without changing shared process environment.

The HTTP website upload is factored onto the same existing owner-aware upload service, preserving auth/plan-before-body ordering, immutable attempt objects, conflict/race handling, committed-response recovery, one shared quota/job request and cleanup of definitely rejected new recordings. The worker still finalizes ready metadata; a 202 transfer acknowledgement is not proof that processing completed. No new migration/RPC or infrastructure activation is required for this code candidate.

get_audio_asset returns a fresh download descriptor only for an owned ready record when signing/private audio configuration is available. The delivery route rechecks its ready/owner/content/object identity and validates actual generation-pinned private bytes against size, SHA and container MIME. Retired or changed rows revoke old links. Plan downgrade or generation rollout disable does not remove owned download access. Reference recordings and free tests can be downloaded by their owner but remain excluded from commercial video use; filenames retain a free-test marker.

## Local helper workflow

Candidate helper: scripts/ugc-pilot-audio-transfer.mjs. It is not yet in the released immutable plugin archive.

1. Run node scripts/ugc-pilot-audio-transfer.mjs prepare <local-audio> <new-receipt.json> [exact|reference] [request-uuid]. This measures audio container/size/SHA and durably creates the non-secret intent before any server request.
2. Pass the returned create_audio_upload arguments to the MCP tool. Feed the ephemeral descriptor JSON on stdin to node scripts/ugc-pilot-audio-transfer.mjs upload <receipt.json>. It sends the actual file bytes with redirects disabled and rechecks the file/descriptor against the saved intent.
3. If a response is lost, run recover <receipt.json>, then use get_audio_generation with its request UUID before retrying. Renew an expired grant only for the identical input; never change bytes/purpose under the old UUID.
4. When processing is ready, call get_audio_asset, then feed its complete result on stdin to download <new-output-path>. The helper requires an official HTTPS application route, expected token purpose/asset/content and expiry, enforces response bounds, verifies the SHA/container, writes exclusively and removes only its failed new file. It never overwrites an existing file or stores the signed link in receipts.

The Node helper handles binary transfer outside model context; audio is not base64-encoded into tool input. Local runtime/process/file access is needed in Codex/Claude Code. Claude.ai connector discovery alone does not provide that host capability. Signed links stay ephemeral; do not commit them or paste them into unrelated destinations.

## Verification and remaining work

53 shared website/MCP checks pass, including five new actual-byte transfer scenarios: expiry/mode/content/owner tampering, bounded complete-file probes before mutation, real local HTTP upload → lost acknowledgement → stable request recovery → same-object replay → verified download, deletion/changed-object/foreign-owner/downgrade guards, and immutable pre-issued upload intent rejection even before a receipt commits. Synthetic WAV bytes use actual bundled ffprobe/ffmpeg. Provider, database, queue and GCS boundaries are offline fixtures; private storage SDK and existing SQL quota/ownership tests remain separate evidence. The upload fixture uses actual shared services and fake RPC rows; it is not hosted concurrency proof.

Full 44-tool MCP regressions, TypeScript, touched-file lint, Next.js production compile, worker compile, ten decoder/private-storage checks, seven package validation checks and four immutable builder checks passed. Actual Next route traces contain bundled ffmpeg and ffprobe for audio upload and ffmpeg for MCP readiness. Exact-commit CI is recorded after verification. No production release is claimed. Source metadata/status success is not full media journey acceptance.

Remaining audio work includes eligible audio/default-music video import, sample delivery, cloning/verification/removal/cleanup adapters, package/version distribution and hosted cross-IDE transfer/recovery acceptance. Full application parity and the original user-intended hook/demo/finished local download journey remain unfinished.
