# IDE local media transfer: implemented candidate

Implemented on 11 October 2026 as the next part of the hook-plus-demo IDE workflow. No production uploads, renders, paid generation, transcription, publication, installation or deployment were performed.

## Result

The existing remote MCP reserves and confirms owned uploads. Plugin candidate 0.1.4 now includes a dependency-free Node.js helper that performs the local byte-transfer part. It measures actual image/video dimensions and video duration with ffprobe, hashes the file, streams signed PUT bytes, saves a non-secret recovery receipt before network activity, and downloads a completed owned asset to a new output path. Account OAuth remains in the host; the helper receives temporary storage URLs through stdin and never extracts or persists host tokens.

The helper reuses the existing upload contract rather than adding another upload backend or modifying website behavior. Its four commands are `inspect`, `upload`, `recover` and `download`. Node.js 22+ and an existing ffprobe executable are required. The installed skill's `references/local-transfer.md` documents exact inputs, runtime requirements and recovery handling. There is no automatic installation hook.

Upload inspection and transfer use the same byte hash and measured metadata. The reservation's production GCS bucket, collection, asset ID, MIME, size, expiration and create-only headers must match. The upload receipt is written exclusively and flushed before PUT. A timeout, interrupted response, HTTP error or early acknowledgment cannot be reported as a successful upload. An existing receipt prevents another PUT; recovery returns the same `confirm_upload` arguments for the host to check through MCP.

Downloads permit current production GCS or signed original application-delivery URLs. They reject alternate hosts, redirects, expired private links, HTML, metadata mismatches and unsupported headers. Real bytes are streamed to a temporary file, checked for length/type and hashed before exclusive publication. Existing files are preserved and temporary files are cleaned up after failures. The helper imposes a 1 GB download cap. The byte hash does not represent a server-authenticated checksum or a complete decode check.

## Verification

- Twelve local transfer tests passed using a real ffmpeg-generated MP4 and ffprobe, with actual binary HTTP transfers against a temporary `127.0.0.1` server. Cases cover exact upload/download bytes, signed headers, measured metadata, receipt ordering, interrupted/early responses, retries, invalid destinations, corrupt/truncated downloads, private URLs and preserving existing files.
- The full `npm run test:mcp` regression suite passed, including the new transfer tests alongside existing account/upload/generation contracts and nine finishing tests. The final added early-response case also passed in the targeted twelve-test transfer run.
- Seven plugin validation tests and three deterministic package-build tests passed. MCP CI now runs the transfer and plugin checks when the relevant plugin, finishing service or scripts change.
- Sandbox networking initially denied connections to the local HTTP fixture. The same tests passed with approved access outside that network sandbox. Test traffic did not contact production or upload customer media.
- A read-only call to the connected account's `get_capabilities` reported video generation available. This session's exposed UGC Pilot surface remains the original twelve tools; no finishing tools were exposed. This observation does not substitute for refreshed discovery or authenticated acceptance after deployment.

## Reviewed candidate

Archive: `.tmp/plugin-packages/local-transfer-reviewed/ugc-pilot-0.1.4.zip`

SHA-256: `b1f9628960ed37b0a444b8da650ba13bbfbdd320b96666a7ec4f239286a24e19`

The package contains 34 allowlisted files, nine skills and contracts for fifteen source tools. Earlier review archives remain unchanged. Installed/cached 0.1.2 and public downloads remain on their released versions; this archive is a local candidate and does not activate backend tools.

## Remaining acceptance and gaps

Deploy the finishing adapter with its MCP gate initially disabled, verify production discovery and current contracts, check existing renderer/queue readiness, then enable the MCP gate for an authorized acceptance account. Obtain `creative:write` through normal OAuth consent and install the reviewed candidate in Codex and Claude Code. Run actual local hook/demo uploads, confirmation, staged edits where requested, finishing recovery and verified final download against production. Production acceptance has not yet run.

The helper improves known-reservation recovery. It does not add reservation request-key idempotency, lost-reservation lookup, expired signed-URL renewal, backend media probing, private upload support, dedicated Demo-library registration or mutable server drafts/history. Those remain in the full IDE-access checklist. Subtitles/generation remain separate spending actions; testing connection health does not authorize them.
