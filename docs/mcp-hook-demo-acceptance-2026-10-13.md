# Codex production hook → demo acceptance

The user authorized a short real render using the opening's last second and the demo's first second. This test uses existing media; it does not generate a new hook, add text/music/subtitles, upload media, or activate gated writes.

## Source and scope

- Production MCP: `https://mcp.getugcpilot.com/mcp`, normal authenticated `ugc-pilot-3` connection.
- Account-scoped finishing capability reported available with manual editing and separate preparation required.
- Opening: `62800b0a-f8d2-4441-b6fd-3ae29e1df849`, “Creator 006 - Shock Surprise”, 2.624 seconds, 720×1280; trim 1624–2624 ms.
- Demo: `dec71328-7cfe-4a4b-8556-0bbaf1c2150f`, “less time caurosels part 2”, 19.066667 seconds, 1080×1920; trim 0–1000 ms.
- Both inputs resolved through production `get_asset`; the dedicated demo record was also checked through `get_demo`.
- Each preparation uses `kind: hook`, `editing.format: hook`, original volume 1, music volume 0, and text null. Composition uses only the two prepared asset IDs, in opening-then-demo order.
- Keys and exact inputs were persisted in `.tmp/mcp-first-journey/` before submission. No authentication tokens or signed delivery grants are stored in those records.

## Durable stages

| Stage | Request key | Job | Output | Result |
| --- | --- | --- | --- | --- |
| Opening trim | `790275b7-8fb5-443f-b19b-33c547e412e4` | `744c34ac-2f98-42d5-b85f-b4a8ac7ee820` | `05777f50-d9ef-4c9b-8aaa-6db79017e89d` | Completed; asset metadata 1 second, 720×1280, 283954 bytes |
| Demo trim | `59925c30-5806-40e1-bbc5-53bd500abdfb` | `46abcd2b-b167-4807-b04c-dde7044f0f17` | `6d6ce915-6457-4a29-88b9-453e87ff3608` | Completed; asset metadata 1 second, 1080×1920, 1146338 bytes |
| Composition | `63ff8ae4-ed2f-4e49-80fa-de9ee9e5afee` | `9b8e9b79-b599-46ae-932d-1f85a789868e` | `eea8a1d2-331e-4e96-9a93-9089c2519557` | Completed; downloaded and decoded successfully |

An initial demo submission while the opening was active returned `FINISH_CONFLICT` (one active finishing job per owner). The same saved demo inputs and key were submitted after the opening completed. Exactly one demo job was accepted. All polling uses `get_video_finish`, which does not submit/requeue work.

## Operational finding

The first job was created at 08:03:20.599 UTC, started at 08:06:02.181 UTC and completed at 08:06:06.123 UTC. Approximately 162 seconds elapsed before processor startup, then about four seconds for processing. This is evidence of render startup latency for this sample, not a general latency guarantee or proof of its underlying cause. The existing per-owner concurrency limit requires sequential preparation and composition.

## Acceptance boundary

The Codex production path passed: resolve existing owned inputs → prepare two trims → compose opening then demo → read completed output → download actual bytes → decode and visually verify ordering. The final job started at 08:13:01.676 UTC and completed at 08:13:05.968 UTC, following creation at 08:10:37.637 UTC.

The released plugin 0.1.9's `transfer-media.mjs` saved a new file at `C:/Users/chund/OneDrive/Desktop/UGC/outputs/mcp-hook-demo-test-2026-10-13.mp4`. Asset metadata was passed on stdin, without printing or persisting ephemeral URL input. The first download attempt within the restricted process failed without producing an output; retrying the read-only download with normal network permission succeeded. This retried file transfer, not rendering. The unrelated Node REPL bridge was unavailable, so a small local process bridge passed stdin to the same packaged helper.

- File size: **866207 bytes**, matching production `get_asset` metadata and helper verification.
- SHA-256: `ff61f35e9452cccd5d4b95891ddc74fd3d0aeb27a78bc2166200dad638461a0c`; independently rehashed after download.
- `ffprobe`: **2.000000 seconds**, 720×1280 H.264 video at 30 fps, **60 frames**, with 2.000000-second AAC audio.
- Full FFmpeg decode of all streams with `-xerror` passed.
- Frames inspected at 0.5 and 1.5 seconds show the selected creator hook first and the selected product demo second.
- Receipts and verification are saved under `.tmp/mcp-first-journey/`; the final deliverable is in `outputs/`. These are local artifacts, not application source changes or a new release.

This run does not establish new-hook generation, local upload/registration, private uploads, audio import, Claude Code execution, paid subtitles, Edit export or complete application parity. Existing feature gates remain unchanged. Processor startup latency and sequential stage overhead remain concrete operational improvements to investigate.
