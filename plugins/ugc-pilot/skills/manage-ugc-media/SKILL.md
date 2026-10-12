---
name: manage-ugc-media
description: Browse or retrieve the connected UGC Pilot media library, resume generation jobs, or upload and delete owned media when explicitly requested.
---

# Manage UGC Pilot media

Use the connected account's discovered UGC Pilot tools. Do not request another user's account ID or privileged credentials to access their media.

## Browse and resume

Use `list_assets` for the requested image/video collection and its pagination cursor. V1 lists image and video assets; do not promise audio or generation-history tools. Use `get_asset` for URLs and metadata rather than guessing a storage URL.

Use `get_job` when the user supplies an existing MCP generation job ID. Poll existing work without resubmitting generation. A completed job's `output_asset_ids` can be read with `get_asset`. A website-created job may not be an MCP generation job; `NOT_FOUND` also protects account isolation. Do not claim all website history is available through this tool.

When several reference images match, show the candidates and ask the user to choose. Preserve the selected asset ID for generation.

## Upload a supplied file

Uploading requires `assets:write` and a host that can send the file's real bytes. Inspect the actual file type and byte length. Call `create_upload` with inputs from its discovered schema. Use the returned signed PUT URL and headers exactly, then call `confirm_upload` with its asset ID. Treat signed URLs as credentials: do not print them in the final answer or share them with unrelated tools. Do not claim a ready asset before confirmation, use fabricated bytes, or fetch arbitrary remote URLs just to create a reference.

For a terminal-capable IDE, use the bundled [local transfer workflow](references/local-transfer.md). Its dependency-free Node helper measures real media with ffprobe, streams file bytes, saves a non-secret recovery receipt before PUT, and downloads completed outputs without overwriting user files. Follow its stdin input contract so signed URLs never enter shell command text or persisted receipts. Other hosts need their own supported binary-transfer mechanism.

When an upload succeeded but confirmation was interrupted, retry confirmation for the same asset ID. Preserve the reservation/asset ID before PUT; the current tools do not discover lost unconfirmed reservations or renew expired upload URLs. If the client cannot transfer local bytes, report that limitation and use a supported IDE, local bridge, or attachment mechanism. A remote MCP cannot read the local path.

If the transfer response itself was interrupted, the saved local receipt supplies confirmation inputs for that same upload ID. Resolve its storage state through `confirm_upload`; never assume a timeout means the upload failed or automatically repeat PUT.

For hook-plus-demo requests, upload the hook as creator footage (`collection: "influencer"`) or ordinary video, and the demo as video using the discovered schema. Both can be used by the Explore finisher. A generic upload does not create a dedicated Demo-library record. Continue through [video finishing](../finish-ugc-video/SKILL.md) when available.

## Delete

Call `delete_asset` only when the user explicitly requests deletion and the target is unambiguous. Name the item and use its verified owned ID. Ask for clarification for multiple matches or an unclear bulk request. Do not delete generated outputs as automatic cleanup. The tool removes the library entry using the product's soft-deletion behavior; do not promise that the physical storage object is erased.

For missing authentication or insufficient permissions, use the client's OAuth connection flow. For `NOT_FOUND`, explain that the item is unavailable to this connected account; do not probe other accounts.
