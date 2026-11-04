# Hook54 preview compression

Status: uploaded and verified; local catalogue mapping updated. No build, push or deployment. Live gallery activation is pending.

- Reference: explore-paired-hook-cdddd09fdd3b5a23d9949205 (Hook54).
- Previous preview: 6,273,894 bytes. New preview: 126,871 bytes, 97.98% smaller.
- Full duration retained: 1.766667 seconds. No action trimmed. Preview resized to432x768, H.264/yuv420p/30fps with fast-start metadata. Original720x1280 source remains unchanged.
- Original AAC audio stream copied; source/output encoded-audio SHA256 both3f98e5637e71d3102e73a217fdd622c2c323b6a392032140ddaa3ca66be8be7f.
- New SHA256: a7d2bbf5ba52df1c0c74a82599cf91d91b9a94ac7bb75dfaf6aac8168ca8f7a7.
- Hosted URL: https://storage.googleapis.com/ugcsaas-media/explore/paired-references/v1/a7d2bbf5ba52df1c0c74a82599cf91d91b9a94ac7bb75dfaf6aac8168ca8f7a7.mp4

## Scope and protection

Only previewSha256/previewStorageKey changed in worker/src/lib/explore-hook-reference-addition-release.json. Structural comparison confirms every other reference and this reference's other fields unchanged. Original source, old preview, poster, audio pairing, prompts and saved edits remain unchanged. New upload used a fresh content-addressed key with create-only precondition and immutable caching; no existing object overwritten. Rollback is restoring the two old mapping values, without deleting either asset.

## Checks actually performed

- Read context-memory, immutable-contracts, UI-clarity and regression-gate skills; repository AGENTS preflight, full protected contracts and relevant Explore/ledger sections under existing scoped-history authorization. tools/preflight.py PASS. Preserved unrelated worktree changes. No Next.js implementation changed.
- FFmpeg conversion, ffprobe duration/streams, complete FFmpeg decode PASS. Inspected0.7second output frame: face, towel, scene and caption remain readable at gallery resolution.
- New Google Cloud object downloaded and SHA256 verified; HTTP200/video-mp4 and range HTTP206 verified.
- Real hosted Chrome playback advanced0.001646→0.626162s, readyState4, zero media error; seek/play reached actual ending1.766667s. No authenticated gallery claim.
-13 direct Node tests PASS: scripts/hook-reference-addition-release.test.mjs, scripts/explore-reference-preview.test.mjs, scripts/reference-cover-playback.test.mjs, scripts/reference-video-player.test.mjs. Scoped git diff --check PASS.
- Initial upload authentication attempts were blocked by local PowerShell wrapper policy and sandbox credential-directory access. Existing gcloud.cmd login used after approved escalation; no keys printed or saved.

## Changed paths and evidence

worker/src/lib/explore-hook-reference-addition-release.json; EXPLORE_CONTEXT.md append; docs/ai-context/clear.md append incident UGC-UI-20261103-HOOK54-PREVIEW-WEIGHT; this receipt. Temporary conversion/upload artifacts in .tmp/hook54-preview-compression-2026-11-03/ include preview.mp4, quality-check.jpg, upload.mjs, release-before.json and receipt.json.

NOT VERIFIED: authenticated production gallery using the new URL, exact original user failure cause, network-specific startup time and cross-device visual acceptance. The earlier file did play directly, so compression addresses confirmed file weight without claiming it proves the complete cause. Build/deployment remains disallowed until explicit authorization.
