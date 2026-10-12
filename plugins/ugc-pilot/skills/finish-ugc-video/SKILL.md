---
name: finish-ugc-video
description: Attach a demo to owned UGC Pilot footage, trim or add exact video text, frame clips, render a finished video, and recover its saved finishing receipt through the connected MCP.
---

# Finish a UGC Pilot video

Use discovered `get_video_finishing_capabilities`, `finish_video`, and `get_video_finish`. Check capabilities before new work. If tools or a requested feature are unavailable, report that state. Finishing requires `creative:write`, recovery `jobs:read`, and output retrieval `assets:read`. Existing generation permission does not grant editing permission; use normal OAuth reauthorization when needed.

Resolve the opening and optional demo to ready owned asset IDs using `get_asset`. For local files, use signed PUT and confirmation with actual bytes; see [media management](../manage-ugc-media/SKILL.md). A generic ready uploaded video can serve as the Explore demo; it does not register it in the dedicated Demo library. Generate new footage only when requested, using [media creation](../create-ugc-media/SKILL.md).

Read the discovered finishing schema for exact fields. The minimal composition is `draft: {sourceAssetId: openingId, demoAssetId: demoId}`. The opening plays first, then the demo. Optional audio inputs must be existing owned assets; this workflow has no audio generation/upload tools. Preserve chosen clips, wording, order and audio. Add paid subtitles only when requested and reported available.

## Prepare edits in valid stages

1. For trim, volume or manual text, submit a single-clip draft with `editing`, `kind: "hook"`, no demo/framing/subtitles. Text times are relative to the trimmed clip. Pass exact authored words through `text` or up to 20 `textOverlays`, using `text: null` for a sequence.
2. Wait for the completed owned output. For single-clip crop/pan, submit that output with `sourceFraming`, no editing/demo/subtitles. Framing points start at zero and remain within the selected frame.
3. Use prepared outputs as the final opening/demo IDs, with selected music/demo audio and, when requested and enabled, English subtitles. Demo framing can accompany demo composition. Manual editing and single-clip framing require their separate preparation stages.

Each stage uses a fresh random UUID `request_key`. Save the key, exact normalized inputs and receipt in the conversation and, when the host can persist workspace files, a local non-secret operation record for recovery. Reuse that same key and identical inputs after interruption. Changed edits require a new intentional stage; do not change the key to bypass a conflict or uncertain outcome.

## Recover and retrieve

Poll `get_video_finish` with the saved key, using increasing waits and a bounded period. This read never starts or requeues a render. It also supports a known website finishing request key. `get_job` continues to cover MCP image/video generation only.

`unconfirmed` means the receipt is not yet visible; an interrupted submission may still commit. Keep the same key. For `pending`, report the job and progress. For `uncertain`, stop automatic resubmission and report the receipt; transcription may already have been accepted. For failed/cancelled work, report the result before starting another stage under the user's existing authorization.

For `completed`, call `get_asset` for returned `output_asset_ids`. Use actual URLs for supported previews/downloads, renewing private links through `get_asset` when needed. Download real bytes to the user's chosen path when local transfer is available, and report the saved path. A receipt is not a finished file, and a URL is not proof of a local download.

In a terminal-capable IDE, use the bundled [local transfer helper](../manage-ugc-media/references/local-transfer.md) to verify and save the download. Preserve the user's existing files by choosing a new output path.

Scheduling, publishing, unfinished server draft editing, operation-history discovery and dedicated Demo registration remain separate capabilities. Do not invent tools. Hosts without local-file/binary-transfer support require a supported bridge or attachment mechanism for local upload/download.
