# Local media transfer in an IDE

Use the bundled [transfer helper](../scripts/transfer-media.mjs) when the host can execute local commands. It requires **Node.js 22+** and **ffprobe** on PATH, or an explicitly supplied `--ffprobe /absolute/path/to/ffprobe`. It uses no npm dependencies and does not install software. If either runtime is absent, use an existing supported binary-transfer mechanism or report the missing runtime. Remote MCP access alone cannot read local files.

Resolve the helper relative to this installed skill directory, not the application's repository. Use absolute media, output and receipt paths. Invoke executables with argument arrays when the host supports them; properly quote file paths when using a shell. Never put signed URLs, OAuth tokens or raw MCP responses in shell command text. The helper's upload/download inputs arrive as JSON on stdin through the host's process API. Do not save this ephemeral input to a workspace file or print it.

## Upload

1. Run `node /absolute/path/to/transfer-media.mjs inspect /absolute/path/to/hook.mp4 --collection influencer`. For a demo, choose `video`; for a still, choose `image`. Add `--ffprobe` when needed. Parse stdout as JSON. This reads real file headers, measures visual dimensions/video duration and hashes actual bytes. It creates no reservation or remote job.
2. Pass the returned `create_upload` object to the discovered MCP `create_upload` tool. Its schema remains authoritative. An optional title may be added to the tool arguments; preserve the helper's inspection unchanged. Save `upload_id` immediately in the operation record. A lost reservation response still requires care: creation currently has no request key or reservation-discovery tool. Do not blindly repeat it.
3. Run `node /absolute/path/to/transfer-media.mjs upload /absolute/path/to/hook.mp4 --receipt /absolute/path/to/hook-upload.json`, supplying `{ "inspection": <step 1 output>, "reservation": <create_upload output> }` on stdin. Use the same `--ffprobe` option as step 1 if required. The helper remeasures/hashes the file, checks the signed destination/headers, saves a non-secret receipt exclusively **before** PUT, then streams the bytes. It accepts the current production `ugcsaas-media` GCS bucket and create-only asset destination. It cannot bypass an unavailable private-media upload route.
4. On success, pass stdout's `confirm_upload` object to the MCP `confirm_upload`. Only a successful confirmation produces a ready asset for finishing. Confirm the hook and demo separately; do not submit local paths to `finish_video`.

The helper does not call MCP, extract host credentials or create reservations. A helper upload success means storage acknowledged PUT; it is not account confirmation. Keep the non-secret local receipt until the workflow is complete. It contains the upload ID, byte hash/length and measured confirmation inputs, with no signed URL or local media path.

## Recover an interrupted transfer

Run `node /absolute/path/to/transfer-media.mjs recover /absolute/path/to/hook-upload.json` and use its `confirm_upload` inputs with MCP. This local read performs no transfer. Retrying account confirmation is idempotent for identical dimensions/duration.

The receipt exists before PUT, so its presence is not proof that storage accepted the file. `UPLOAD_UNCONFIRMED`, `RECEIPT_EXISTS`, a crash or lost response all require checking the **same** upload ID. The helper refuses a second PUT using an existing receipt. `UPLOAD_NOT_READY` requires bounded rechecks; it does not prove an in-flight PUT cannot commit. Resolve the original attempt before intentionally creating another reservation. Expired signed URLs cannot currently be renewed. Preserve the old ID and report that limitation rather than claiming automatic resumable upload.

## Download a completed asset

Call `get_asset` for a completed owned output. Run `node /absolute/path/to/transfer-media.mjs download /absolute/path/to/finished.mp4`, supplying `{ "asset": <get_asset output.asset> }` on stdin. The helper accepts current production GCS URLs or an unexpired original UGC Pilot signed delivery link. It refuses alternate hosts, redirects, login HTML, mismatched MIME/lengths and unsupported media headers. It streams to a temporary file, verifies the bytes and hash, then publishes the result without replacing any existing path. The parent output directory must already exist.

Report stdout's absolute `path`, `file_size_bytes` and optional hash only after `downloaded: true`. Renew expired private links through `get_asset`. The 1 GB download cap is a local resource limit. Hashes prove the saved bytes equal the received bytes; they do not provide a server-authenticated checksum or a media-decoding guarantee. Backend probing and complete render acceptance remain separate validation steps.
