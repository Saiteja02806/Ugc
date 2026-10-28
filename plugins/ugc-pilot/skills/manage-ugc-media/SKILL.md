---
name: manage-ugc-media
description: Browse owned UGC Pilot visual or audio media, recover existing jobs, transfer supplied files and manage requested voice preferences or editing attachments through discovered tools.
---

# Manage UGC Pilot media

For application Creative Asset groups use [group management](../manage-ugc-groups/SKILL.md); for saved Carousel/slideshow entries use [Library management](../manage-ugc-library/SKILL.md). Generic media assets and those application identities are separate.

Use the connected account's discovered UGC Pilot tools. Do not request another user's account ID or privileged credentials to access their media.

## Browse and resume

Use `list_assets` for the requested image/video/creator-footage collection and its pagination cursor. Current tools list these visual assets. Use discovered `list_operations`/`get_operation` for owner-scoped application background-job history; use the separate discovered audio tools for private recordings, following [audio workflow](references/audio-workflow.md). Use `get_asset` for URLs and metadata rather than guessing a storage URL.

Use `get_job` when the user supplies an existing MCP generation job ID. Poll existing work without resubmitting generation. A completed job's `output_asset_ids` can be read with `get_asset`. A website-created job may not be an MCP generation job; `NOT_FOUND` also protects account isolation. Do not claim all website history is available through this tool.

When several reference images match, show the candidates and ask the user to choose. Preserve the selected asset ID for generation.

## Upload a supplied file

Uploading requires `assets:write` and a host that can send the file's real bytes. Inspect the actual file type and byte length. Call `create_upload` with inputs from its discovered schema. `create_upload` reserves a pending asset and a signed PUT link. `renew_upload` refreshes that link. Use the returned signed PUT URL and headers exactly, then call `confirm_upload` with its asset ID. `confirm_upload` verifies the stored file and makes it ready; it does not take a confirm token and does not spend credits. Treat signed URLs as credentials: do not print them in the final answer or share them with unrelated tools. Do not claim a ready asset before that verification, use fabricated bytes, or fetch arbitrary remote URLs just to create a reference.

For a terminal-capable IDE, use the bundled [local transfer workflow](references/local-transfer.md). Its dependency-free Node helper measures real media with ffprobe, streams file bytes, saves a non-secret recovery receipt before PUT, and downloads completed outputs without overwriting user files. Follow its stdin input contract so signed URLs never enter shell command text or persisted receipts. Other hosts need their own supported binary-transfer mechanism.

When an upload succeeded but confirmation was interrupted, retry confirmation for the same asset ID. When the discovered schema supports request IDs and recovery tools, use the helper’s `prepare` command to save the exact reservation inputs before calling `create_upload`. Recover a lost response with `get_upload` by request ID; retry identical creation inputs with that same request ID only when the reservation is absent. `list_uploads` can find older pending reservations. Resolve the original transfer before `renew_upload`; existing bytes need confirmation, and a timed-out request may still be committing. Never overwrite an object or create a replacement reservation automatically. If the client cannot transfer local bytes, report that limitation and use a supported IDE, local bridge, or attachment mechanism. A remote MCP cannot read the local path.

If the transfer response itself was interrupted, the saved local receipt supplies confirmation inputs for that same upload ID. Resolve its storage state through `confirm_upload`; never assume a timeout means the upload failed or automatically repeat PUT.

For hook-plus-demo requests, upload the hook as creator footage (`collection: "influencer"`) or ordinary video, and the demo as video using the discovered schema. Both can be used by the Explore finisher. For a dedicated Demo-library entry, call `register_demo` after successful upload verification when that tool is discovered. It runs directly, preserves the asset ID, and enforces the Demo limits: 1–60 seconds and at most 100 MB. Browse it through `list_demos`/`get_demo`; use `get_asset` for playable delivery. Generic upload alone remains available for Explore composition. Continue through [video finishing](../finish-ugc-video/SKILL.md) when available.

## Delete

Use `delete_demo` for a verified dedicated Demo when available; it hides the Demo and its linked source together while preserving existing renders. Call `delete_asset` only when the user explicitly requests deletion and the target is unambiguous. Name the item and use its verified owned ID. Ask for clarification for multiple matches or an unclear bulk request. The first delete call returns a preview. Show the affected item and pass `confirm_token` only after an explicit yes. Do not delete generated outputs as automatic cleanup. The tool removes the library entry using the product's soft-deletion behavior; do not promise that the physical storage object is erased.

For missing authentication or insufficient permissions, use the client's OAuth connection flow. For `NOT_FOUND`, explain that the item is unavailable to this connected account; do not probe other accounts.

## Audio recordings and preferences

For voice catalogue/preferences, saved private audio, local audio upload/download or importing a selected recording into a video, read [audio workflow](references/audio-workflow.md). Its helper is separate from visual uploads and accepts the audio API descriptor rather than `create_upload`. Use live capabilities and preserve the user's selected purpose, file, audio and stable request identities.

## Business logos

For a supplied local business logo, read [business logo workflow](references/business-logo-workflow.md). It uses dedicated recoverable reservations and a separate helper, not generic image upload. Confirmation verifies bytes before an intended onboarding attachment; screenshots remain separate work.
